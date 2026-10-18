/**
 * The runtime: everything a compiled theme may call.
 *
 * Small on purpose. The generated code touches `__rt.h` to build elements,
 * `__rt.filters` for registered filters, and the helpers below for the
 * language's own semantics — Liquid truthiness, `blank`, ranges, loops.
 * Nothing else is in scope, which is what makes the emitted module safe to
 * run: it can only reach what this file hands it.
 *
 * The runtime is created per render environment (the filters close over the
 * shop's `formatPrice`, `imageUrl` and link builder), while the compiled
 * module is evaluated once per theme version. See `./theme`.
 */

import type { RenderEnvironment } from '../render/context'
import { MAX_RANGE, isBlank, isEmpty, looseEquals, registeredFilters } from './filters'
import { parseStyle } from './codegen'
import type { TemplateScope } from './drops'

/** The element factory the compiled code calls — `React.createElement`. */
export type TemplateH = (
  type: unknown,
  props: Record<string, unknown> | null,
  ...children: unknown[]
) => unknown

/** A render function the compiled module exposes. */
export type TemplateRender = (scope: TemplateScope, body?: TemplateRender) => unknown

/** What a compiled module returns: its routes, its pages, its sections and its layout. */
export interface ThemeModule {
  /** Route bodies composed with the layout: a whole page. */
  routes: Record<string, TemplateRender>
  /** The route bodies alone, for a shell that owns the layout. */
  bodies: Record<string, TemplateRender>
  /** Theme-authored pages (`templates/pages/<slug>.tpl`), by slug. */
  pages: Record<string, TemplateRender>
  sections: Record<string, TemplateRender>
  layout: TemplateRender | null
}

/** A compiled module as an ES module factory: source-free activation for hosts. */
export type ThemeModuleFactory = (runtime: TemplateRuntime) => ThemeModule

/**
 * The host-owned pieces a theme may call with `{% slot %}`. Each is drawn by
 * the storefront, never by the theme: the buy box needs the cart, reviews
 * need the session, an article's body is the seller's own sections, and the
 * order-tracking form can look an order up. See docs/TEMPLATE_ENGINE.md,
 * "Interactivity: islands, not hydration".
 */
export const TEMPLATE_SLOTS = [
  'productPurchase',
  'productReviews',
  'articleBody',
  'pageBody',
  'orderTracking',
  'cartTrigger',
  'cartDrawer',
] as const

export type TemplateSlotName = (typeof TEMPLATE_SLOTS)[number]

export interface TemplateRuntime {
  h: TemplateH
  /** React's `Fragment`, so multi-root units render without a wrapper element. */
  Fragment: unknown
  filters: Record<string, (value: unknown, ...args: unknown[]) => unknown>
  text: (value: unknown) => string
  style: (css: string) => Record<string, string>
  truthy: (value: unknown) => boolean
  and: (a: unknown, b: unknown) => unknown
  or: (a: unknown, b: unknown) => unknown
  eq: (a: unknown, b: unknown) => boolean
  lt: (a: unknown, b: unknown) => boolean
  gt: (a: unknown, b: unknown) => boolean
  lte: (a: unknown, b: unknown) => boolean
  gte: (a: unknown, b: unknown) => boolean
  contains: (container: unknown, value: unknown) => boolean
  get: (value: unknown, key: string) => unknown
  iterate: (value: unknown, limit: unknown, offset: unknown, reversed: boolean) => unknown[]
  range: (from: unknown, to: unknown) => number[]
  forloop: (index: number, length: number) => Record<string, unknown>
  isBlank: (value: unknown) => boolean
  isEmpty: (value: unknown) => boolean
  /** A host slot by name, or `null` when the host passed none. */
  slot: (name: string, args: Record<string, unknown>) => unknown
}

/** The most items one `{% for %}` may walk, however long the list is. */
export const MAX_LOOP_ITEMS = 500

/** The fragment a bare `createTemplateRuntime` uses when the host does not pass one. */
export const TEMPLATE_FRAGMENT = Symbol('pesanle.template.fragment')

/**
 * Builds the runtime for one render environment. The compiled module is
 * evaluated against this, and the module's own render functions take only
 * the scope.
 */
export function createTemplateRuntime(
  h: TemplateH,
  env: RenderEnvironment,
  fragment: unknown = TEMPLATE_FRAGMENT,
): TemplateRuntime {
  const filters: TemplateRuntime['filters'] = {}
  for (const [name, definition] of registeredFilters()) {
    filters[name] = (value, ...args) => definition.apply(value, args, { env })
  }

  const styleCache = new Map<string, Record<string, string>>()
  const style = (css: string): Record<string, string> => {
    const cached = styleCache.get(css)
    if (cached) return cached
    const parsed = parseStyle(css)
    styleCache.set(css, parsed)
    return parsed
  }

  return {
    h,
    Fragment: fragment,
    filters,
    text: (value) => (value === null || value === undefined ? '' : String(value)),
    style,
    truthy: liquidTruthy,
    and: (a, b) => (liquidTruthy(a) ? b : a),
    or: (a, b) => (liquidTruthy(a) ? a : b),
    eq: looseEquals,
    lt: (a, b) => compare(a, b) < 0,
    gt: (a, b) => compare(a, b) > 0,
    lte: (a, b) => compare(a, b) <= 0,
    gte: (a, b) => compare(a, b) >= 0,
    contains: (container, value) => {
      if (typeof container === 'string') return container.includes(String(value ?? ''))
      if (Array.isArray(container)) return container.some((item) => looseEquals(item, value))
      return false
    },
    get: (value, key) => {
      if (value === null || value === undefined) return null
      if (Array.isArray(value)) {
        if (key === 'size' || key === 'length') return value.length
        if (key === 'first') return value[0] ?? null
        if (key === 'last') return value[value.length - 1] ?? null
        return null
      }
      if (typeof value === 'string' && (key === 'size' || key === 'length')) return value.length
      if (typeof value === 'object') {
        const field = (value as Record<string, unknown>)[key]
        if (field !== undefined) return field
      }
      return null
    },
    iterate: (value, limit, offset, reversed) => {
      if (!Array.isArray(value)) return []
      const start = toIndex(offset, 0)
      const size =
        limit === null || limit === undefined ? value.length : toIndex(limit, value.length)
      const slice = value.slice(start, start + Math.min(Math.max(size, 0), MAX_LOOP_ITEMS))
      return reversed ? slice.reverse() : slice
    },
    range: (from, to) => {
      const start = Math.trunc(toNumber(from))
      const end = Math.trunc(toNumber(to))
      if (!Number.isFinite(start) || !Number.isFinite(end)) return []
      const length = Math.abs(end - start) + 1
      if (length > MAX_RANGE) {
        throw new Error(`A range may hold at most ${MAX_RANGE} items; got ${length}.`)
      }
      const out: number[] = []
      const step = end >= start ? 1 : -1
      for (let i = 0, value = start; i < length; i++, value += step) out.push(value)
      return out
    },
    forloop: (index, length) => ({
      index: index + 1,
      index0: index,
      first: index === 0,
      last: index === length - 1,
      length,
      rindex: length - index,
      rindex0: length - index - 1,
    }),
    isBlank,
    isEmpty,
    slot: (name, args) => {
      const slots = env.slots as Record<string, unknown> | undefined
      const value = slots?.[name]
      if (value === undefined || value === null) return null
      // A slot may be a node or a function of its settings: the order-tracking
      // form takes the labels a section would have given it.
      if (typeof value === 'function') {
        return (value as (settings: unknown) => unknown)(args.settings ?? args)
      }
      return value
    },
  }
}

/**
 * The module factory behind a compiled source: `new Function` runs once, so a
 * host can cache the factory by version and skip re-parsing on every request.
 */
export function themeModuleFactory(source: string): ThemeModuleFactory {
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    return new Function('__rt', source) as ThemeModuleFactory
  } catch (cause) {
    throw new Error('The compiled theme module is not valid JavaScript.', { cause })
  }
}

/**
 * Evaluates a compiled module's source against a runtime.
 *
 * This is the trust boundary: the source was generated by `./codegen` from a
 * checked AST and never contains a byte a template wrote. It runs on the
 * server, once per theme version — the artifact is never fetched into a
 * shopper's browser as a URL the page can be tricked into importing. See
 * docs/TEMPLATE_ENGINE.md, "Security".
 */
export function evaluateThemeModule(source: string, runtime: TemplateRuntime): ThemeModule {
  return themeModuleFactory(source)(runtime)
}

/* -------------------------------------------------------------------------- */

function liquidTruthy(value: unknown): boolean {
  return value !== null && value !== undefined && value !== false
}

function compare(a: unknown, b: unknown): number {
  if (a === null || a === undefined || b === null || b === undefined) return Number.NaN
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function toIndex(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === '') return fallback
  const number = toNumber(value)
  return Math.max(0, Math.trunc(number))
}
