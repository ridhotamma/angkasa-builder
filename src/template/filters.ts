/**
 * Filters: the only calls a template expression may make.
 *
 * A filter is a named, registered function with a declared arity, so the
 * compiler can refuse an unknown name or a wrong argument count at publish
 * time. The registry is open (`defineFilter`) but never reachable from a
 * template: a theme can only call what this file — or an app embedding the
 * builder — has registered.
 *
 * Storefront filters (`money`, `link_url`, `image_url`) close over the
 * render environment, which is how a template turns a stored value into the
 * shop's own URL or currency without knowing any route shapes itself.
 */

import { isSafeHref, storefrontHref, type Link } from '../model/links'
import type { RenderEnvironment } from '../render/context'
import { dropAny, dropList, dropNumber, dropString, type DropType } from './drops'

export interface FilterContext {
  env: RenderEnvironment
}

export interface FilterDefinition {
  name: string
  description: string
  minArgs: number
  maxArgs: number
  /** What the filter returns, for chained checks. Defaults to `any`. */
  returns?: DropType
  apply: (value: unknown, args: readonly unknown[], context: FilterContext) => unknown
}

/** The largest image a theme may ask for; anything larger is clamped. */
export const MAX_IMAGE_SIZE = 4096
/** A `(1..n)` range may not build more than this many items. */
export const MAX_RANGE = 1000

const registry = new Map<string, FilterDefinition>()

/**
 * Registers `definition`, replacing any filter of the same name. Built-ins
 * are registered the same way, so an app may override one deliberately.
 */
export function defineFilter(definition: FilterDefinition): FilterDefinition {
  registry.set(definition.name, definition)
  return definition
}

export function registeredFilter(name: string): FilterDefinition | null {
  return registry.get(name) ?? null
}

export function registeredFilters(): ReadonlyMap<string, FilterDefinition> {
  return registry
}

export function filterNames(): string[] {
  return [...registry.keys()]
}

/* -------------------------------------------------------------------------- */
/* Coercion                                                                   */
/* -------------------------------------------------------------------------- */

function text(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function numeric(value: unknown): number {
  if (typeof value === 'number') return value
  const parsed = Number(text(value))
  return Number.isFinite(parsed) ? parsed : 0
}

function items(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') return value.split('')
  return []
}

/* -------------------------------------------------------------------------- */
/* Built-ins                                                                  */
/* -------------------------------------------------------------------------- */

const STRING_FILTERS: Array<[string, string, (value: unknown) => unknown]> = [
  ['upcase', 'Uppercase.', (value) => text(value).toUpperCase()],
  ['downcase', 'Lowercase.', (value) => text(value).toLowerCase()],
  [
    'capitalize',
    'First letter uppercase, the rest lowercase.',
    (value) => {
      const lower = text(value).toLowerCase()
      return lower ? lower[0]!.toUpperCase() + lower.slice(1) : lower
    },
  ],
  ['strip', 'Trim whitespace from both ends.', (value) => text(value).trim()],
  ['strip_newlines', 'Remove line breaks.', (value) => text(value).replace(/[\r\n]+/g, '')],
  [
    'handleize',
    'A URL-safe slug: lowercase words joined by hyphens.',
    (value) =>
      text(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, ''),
  ],
  ['url_encode', 'Percent-encode for a URL.', (value) => encodeURIComponent(text(value))],
  ['json', 'The value as JSON.', (value) => JSON.stringify(value ?? null)],
]

for (const [name, description, apply] of STRING_FILTERS) {
  defineFilter({ name, description, minArgs: 0, maxArgs: 0, returns: dropString, apply })
}

defineFilter({
  name: 'default',
  description: 'The fallback when the value is blank (nil, false, empty or whitespace).',
  minArgs: 1,
  maxArgs: 1,
  returns: dropAny,
  apply: (value, args) => (isBlank(value) ? args[0] : value),
})

defineFilter({
  name: 'truncate',
  description: 'Cut a string to N characters, ellipsis included.',
  minArgs: 1,
  maxArgs: 2,
  returns: dropString,
  apply: (value, args) => {
    const length = Math.max(0, Math.floor(numeric(args[0])))
    const ellipsis = args[1] === undefined ? '…' : text(args[1])
    const source = text(value)
    if (source.length <= length) return source
    return source.slice(0, Math.max(0, length - ellipsis.length)) + ellipsis
  },
})

defineFilter({
  name: 'replace',
  description: 'Replace every occurrence of a substring.',
  minArgs: 2,
  maxArgs: 2,
  returns: dropString,
  apply: (value, args) => text(value).split(text(args[0])).join(text(args[1])),
})

defineFilter({
  name: 'append',
  description: 'Add text to the end.',
  minArgs: 1,
  maxArgs: 1,
  returns: dropString,
  apply: (value, args) => text(value) + text(args[0]),
})

defineFilter({
  name: 'prepend',
  description: 'Add text to the start.',
  minArgs: 1,
  maxArgs: 1,
  returns: dropString,
  apply: (value, args) => text(args[0]) + text(value),
})

defineFilter({
  name: 'split',
  description: 'Split a string into a list.',
  minArgs: 1,
  maxArgs: 1,
  returns: dropList(dropString),
  apply: (value, args) => text(value).split(text(args[0])),
})

defineFilter({
  name: 'join',
  description: 'Join a list into a string.',
  minArgs: 0,
  maxArgs: 1,
  returns: dropString,
  apply: (value, args) =>
    items(value)
      .map(text)
      .join(args[0] === undefined ? ' ' : text(args[0])),
})

defineFilter({
  name: 'size',
  description: 'The length of a string or list.',
  minArgs: 0,
  maxArgs: 0,
  returns: dropNumber,
  apply: (value) => (Array.isArray(value) || typeof value === 'string' ? value.length : 0),
})

defineFilter({
  name: 'first',
  description: 'The first item of a list.',
  minArgs: 0,
  maxArgs: 0,
  returns: dropAny,
  apply: (value) => items(value)[0] ?? null,
})

defineFilter({
  name: 'last',
  description: 'The last item of a list.',
  minArgs: 0,
  maxArgs: 0,
  returns: dropAny,
  apply: (value) => {
    const list = items(value)
    return list.length ? list[list.length - 1] : null
  },
})

defineFilter({
  name: 'slice',
  description: 'A run of items from a list or string; a negative start counts from the end.',
  minArgs: 1,
  maxArgs: 2,
  returns: dropList(dropAny),
  apply: (value, args) => {
    const list = items(value)
    const start = Math.trunc(numeric(args[0]))
    const from = start < 0 ? Math.max(0, list.length + start) : Math.min(start, list.length)
    const length =
      args[1] === undefined ? list.length - from : Math.max(0, Math.trunc(numeric(args[1])))
    const sliced = list.slice(from, from + length)
    return typeof value === 'string' ? sliced.join('') : sliced
  },
})

defineFilter({
  name: 'reverse',
  description: 'Reverse a list or string.',
  minArgs: 0,
  maxArgs: 0,
  returns: dropList(dropAny),
  apply: (value) =>
    typeof value === 'string' ? items(value).reverse().join('') : items(value).slice().reverse(),
})

defineFilter({
  name: 'uniq',
  description: 'Drop duplicate items.',
  minArgs: 0,
  maxArgs: 0,
  returns: dropList(dropAny),
  apply: (value) => {
    const seen = new Set<unknown>()
    const out: unknown[] = []
    for (const item of items(value)) {
      if (seen.has(item)) continue
      seen.add(item)
      out.push(item)
    }
    return out
  },
})

defineFilter({
  name: 'compact',
  description: 'Drop nil and empty items.',
  minArgs: 0,
  maxArgs: 0,
  returns: dropList(dropAny),
  apply: (value) => items(value).filter((item) => !isBlank(item)),
})

defineFilter({
  name: 'map',
  description: 'Read one property from every item in a list.',
  minArgs: 1,
  maxArgs: 1,
  returns: dropList(dropAny),
  apply: (value, args) => items(value).map((item) => readKey(item, text(args[0]))),
})

defineFilter({
  name: 'where',
  description: 'Keep the items whose property equals a value.',
  minArgs: 1,
  maxArgs: 2,
  returns: dropList(dropAny),
  apply: (value, args) => {
    const key = text(args[0])
    const expected = args[1]
    return items(value).filter((item) =>
      args.length === 1 ? !isBlank(readKey(item, key)) : looseEquals(readKey(item, key), expected),
    )
  },
})

defineFilter({
  name: 'sort',
  description: 'Sort a list, optionally by one property.',
  minArgs: 0,
  maxArgs: 1,
  returns: dropList(dropAny),
  apply: (value, args) => {
    const key = args[0] === undefined ? null : text(args[0])
    return items(value)
      .slice()
      .sort((a, b) =>
        compare(key === null ? a : readKey(a, key), key === null ? b : readKey(b, key)),
      )
  },
})

defineFilter({
  name: 'sum',
  description: 'Add the numbers in a list, or one property of every item.',
  minArgs: 0,
  maxArgs: 1,
  returns: dropNumber,
  apply: (value, args) => {
    const key = args[0] === undefined ? null : text(args[0])
    let total = 0
    for (const item of items(value)) total += numeric(key === null ? item : readKey(item, key))
    return total
  },
})

defineFilter({
  name: 'date',
  description: 'Format an ISO date with strftime-style tokens (%Y %m %d %H %M %S %B %b %A %a).',
  minArgs: 1,
  maxArgs: 1,
  returns: dropString,
  apply: (value, args) => formatDate(value, text(args[0])),
})

const ARITHMETIC: Array<[string, (a: number, b: number) => number]> = [
  ['plus', (a, b) => a + b],
  ['minus', (a, b) => a - b],
  ['times', (a, b) => a * b],
  ['modulo', (a, b) => (b === 0 ? 0 : a % b)],
  ['divided_by', (a, b) => (b === 0 ? 0 : a / b)],
]

for (const [name, operate] of ARITHMETIC) {
  defineFilter({
    name,
    description: `Arithmetic: ${name}.`,
    minArgs: 1,
    maxArgs: 1,
    returns: dropNumber,
    apply: (value, args) => operate(numeric(value), numeric(args[0])),
  })
}

defineFilter({
  name: 'abs',
  description: 'Absolute value.',
  minArgs: 0,
  maxArgs: 0,
  returns: dropNumber,
  apply: (value) => Math.abs(numeric(value)),
})

defineFilter({
  name: 'round',
  description: 'Round to N decimals.',
  minArgs: 0,
  maxArgs: 1,
  returns: dropNumber,
  apply: (value, args) => {
    const digits =
      args[0] === undefined ? 0 : Math.max(0, Math.min(6, Math.trunc(numeric(args[0]))))
    const factor = 10 ** digits
    return Math.round(numeric(value) * factor) / factor
  },
})

defineFilter({
  name: 'floor',
  description: 'Round down.',
  minArgs: 0,
  maxArgs: 0,
  returns: dropNumber,
  apply: (value) => Math.floor(numeric(value)),
})

defineFilter({
  name: 'ceil',
  description: 'Round up.',
  minArgs: 0,
  maxArgs: 0,
  returns: dropNumber,
  apply: (value) => Math.ceil(numeric(value)),
})

/* -------------------------------------------------------------------------- */
/* Storefront filters                                                         */
/* -------------------------------------------------------------------------- */

defineFilter({
  name: 'money',
  description: "The shop's currency format for an amount in minor units.",
  minArgs: 0,
  maxArgs: 1,
  returns: dropString,
  apply: (value, args, context) =>
    context.env.formatPrice(
      numeric(value),
      args[0] === undefined ? context.env.data.shop.currency : text(args[0]),
    ),
})

defineFilter({
  name: 'link_url',
  description: 'A stored link (or path) as a storefront URL.',
  minArgs: 0,
  maxArgs: 0,
  returns: dropString,
  apply: (value, _args, context) => {
    if (value === null || value === undefined) return null
    const href = context.env.href ?? storefrontHref
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (!trimmed) return null
      if (/^[/#]/.test(trimmed)) return trimmed
      if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed
      return null
    }
    if (typeof value === 'object' && typeof (value as Link).kind === 'string') {
      const link = value as Link
      // A stored link is sanitised on write; this is the second check the
      // storefront always makes, so a value from an older release or a
      // hand-crafted payload still cannot become a `javascript:` href.
      if (link.kind === 'url' && !isSafeHref(link.href)) return null
      return href(link)
    }
    return null
  },
})

defineFilter({
  name: 'image_url',
  description: 'A media file id as an image URL at roughly a size.',
  minArgs: 0,
  maxArgs: 2,
  returns: dropString,
  apply: (value, args, context) => {
    const id = text(value)
    if (!id) return null
    if (/^https?:\/\//i.test(id)) return id
    const width = clampSize(args[0], 800)
    const height = clampSize(args[1], width)
    return context.env.imageUrl(id, { width, height }) ?? null
  },
})

defineFilter({
  name: 'page_url',
  description: 'The URL of another page of the listing being shown (the catalogue pager).',
  minArgs: 0,
  maxArgs: 0,
  returns: dropString,
  apply: (value, _args, context) => {
    const page = Math.max(1, Math.trunc(numeric(value)))
    return context.env.pageHref?.(page) ?? `?page=${page}`
  },
})

defineFilter({
  name: 'video_url',
  description: "An uploaded video's file id as a streamable URL.",
  minArgs: 0,
  maxArgs: 0,
  returns: dropString,
  apply: (value, _args, context) => {
    const id = text(value)
    if (!id) return null
    if (/^https?:\/\//i.test(id)) return id
    return context.env.videoUrl?.(id) ?? null
  },
})

/* -------------------------------------------------------------------------- */
/* Shared semantics                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Liquid's `blank`: nil, false, an empty or whitespace string, an empty list.
 * Deliberately not JavaScript truthiness — `0` and `"0"` are not blank.
 */
export function isBlank(value: unknown): boolean {
  if (value === null || value === undefined || value === false) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  return false
}

export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.length === 0
  if (Array.isArray(value)) return value.length === 0
  return false
}

/** Equality as the language means it: nil unifies, types do not coerce. */
export function looseEquals(a: unknown, b: unknown): boolean {
  const aNil = a === null || a === undefined
  const bNil = b === null || b === undefined
  if (aNil || bNil) return aNil && bNil
  return a === b
}

function readKey(value: unknown, key: string): unknown {
  if (value === null || value === undefined) return null
  if (typeof value !== 'object') return null
  return (value as Record<string, unknown>)[key] ?? null
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return text(a).localeCompare(text(b))
}

function clampSize(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback
  const size = Math.trunc(numeric(value))
  if (!Number.isFinite(size) || size <= 0) return fallback
  return Math.min(MAX_IMAGE_SIZE, Math.max(16, size))
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * A small, deterministic strftime. Dates are formatted in UTC so a server
 * render and a snapshot capture always agree; a host that wants the
 * shopper's timezone formats the value itself.
 */
export function formatDate(value: unknown, format: string): string {
  const date =
    value instanceof Date
      ? value
      : new Date(typeof value === 'string' || typeof value === 'number' ? value : '')
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number, length = 2) => String(n).padStart(length, '0')
  const tokens: Record<string, string> = {
    '%Y': String(date.getUTCFullYear()),
    '%y': pad(date.getUTCFullYear() % 100),
    '%m': pad(date.getUTCMonth() + 1),
    '%-m': String(date.getUTCMonth() + 1),
    '%d': pad(date.getUTCDate()),
    '%-d': String(date.getUTCDate()),
    '%H': pad(date.getUTCHours()),
    '%M': pad(date.getUTCMinutes()),
    '%S': pad(date.getUTCSeconds()),
    '%B': MONTHS[date.getUTCMonth()]!,
    '%b': MONTHS[date.getUTCMonth()]!.slice(0, 3),
    '%A': WEEKDAYS[date.getUTCDay()]!,
    '%a': WEEKDAYS[date.getUTCDay()]!.slice(0, 3),
    '%%': '%',
  }
  return format.replace(/%[YymdHMSBAb%]|%-[md]/g, (token) => tokens[token] ?? token)
}
