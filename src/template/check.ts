/**
 * The checker: every expression, resolved before a single byte is published.
 *
 * This is where a theme's mistakes cost nothing. An unknown filter, a typo'd
 * drop property, a missing snippet, a loop over something that is not a list
 * — each is a diagnostic with a location, not a blank spot on a live page.
 *
 * The checker also reports two things the runtime does not need but the
 * platform does: which root drops a unit reads (so the loader can fetch them
 * in one batch) and which snippets it renders (so the theme's module can
 * include exactly those).
 */

import type { Expression, TemplateNode } from './ast'
import {
  dropAny,
  dropBoolean,
  dropList,
  dropNil,
  dropNumber,
  dropString,
  dropNames,
  STOREFRONT_DROP_SCHEMA,
  type DropType,
} from './drops'
import type { Diagnostic } from './diagnostics'
import { error, suggestion } from './diagnostics'
import { filterNames, registeredFilter } from './filters'

export interface SnippetInfo {
  /** Every argument name the snippet is ever rendered with. */
  args: readonly string[]
}

export interface CheckTemplateOptions {
  file?: string
  /** The root drop schema; defaults to the storefront's. */
  scope?: DropType
  /** `section.settings` narrowed by the compiled `{% schema %}`. */
  sectionSettings?: DropType
  /** Argument names visible inside a snippet unit. */
  snippetArgs?: readonly string[]
  /** Snippet lookup, for `{% render %}` existence checks. */
  resolveSnippet?: (name: string) => SnippetInfo | null
  /** Whether this unit is the layout shell. */
  isLayout?: boolean
}

export interface CheckResult {
  diagnostics: Diagnostic[]
  /** Root drop names the unit reads, in first-use order. */
  uses: string[]
  /** Snippet names the unit renders, in first-use order. */
  renders: string[]
}

/** The type of the `forloop` object inside a `{% for %}`. */
const FORLOOP_TYPE = dropRecord({
  index: dropNumber,
  index0: dropNumber,
  first: dropBoolean,
  last: dropBoolean,
  length: dropNumber,
  rindex: dropNumber,
  rindex0: dropNumber,
})

function dropRecord(fields: Record<string, DropType>): DropType {
  return { kind: 'record', fields }
}

/** Checks one unit — a route template, a section or a snippet. */
export function checkTemplate(
  nodes: readonly TemplateNode[],
  options: CheckTemplateOptions = {},
): CheckResult {
  return new Checker(options).check(nodes)
}

class Checker {
  private readonly diagnostics: Diagnostic[] = []
  private readonly uses: string[] = []
  private readonly renders: string[] = []
  private readonly locals = new Map<string, DropType>()
  private readonly scope: DropType
  private readonly snippetArgs: ReadonlySet<string>

  constructor(private readonly options: CheckTemplateOptions) {
    this.snippetArgs = new Set(options.snippetArgs ?? [])
    const base = options.scope ?? STOREFRONT_DROP_SCHEMA
    this.scope =
      options.sectionSettings && base.kind === 'record'
        ? dropRecord({
            ...base.fields,
            section: dropRecord({
              id: dropString,
              settings: options.sectionSettings,
              style: dropAny,
            }),
          })
        : base
  }

  check(nodes: readonly TemplateNode[]): CheckResult {
    this.checkNodes(nodes)
    return { diagnostics: this.diagnostics, uses: this.uses, renders: this.renders }
  }

  /* ---------------------------------------------------------------------- */

  private checkNodes(nodes: readonly TemplateNode[]): void {
    for (const node of nodes) this.checkNode(node)
  }

  private checkNode(node: TemplateNode): void {
    switch (node.kind) {
      case 'text':
        return
      case 'output':
        this.checkExpression(node.expression)
        return
      case 'element':
        for (const attribute of node.attributes) {
          if (attribute.value === true) continue
          for (const part of attribute.value) {
            if (part.expression) this.checkExpression(part.expression)
          }
        }
        this.checkNodes(node.children)
        return
      case 'if':
        for (const branch of node.branches) {
          this.checkExpression(branch.condition)
          this.checkNodes(branch.children)
        }
        if (node.elseChildren) this.checkNodes(node.elseChildren)
        return
      case 'for': {
        const iterable = this.checkExpression(node.iterable)
        if (node.limit) this.checkExpression(node.limit)
        if (node.offset) this.checkExpression(node.offset)
        if (iterable.kind !== 'list' && iterable.kind !== 'any') {
          this.diagnostics.push(
            error(
              'not-a-list',
              `A for loop needs a list; this is ${describe(iterable)}.`,
              this.options.file,
              node.iterable.loc,
            ),
          )
        }
        const previous = new Map(this.locals)
        this.locals.set(node.variable, iterable.kind === 'list' ? iterable.of : dropAny)
        this.locals.set('forloop', FORLOOP_TYPE)
        this.checkNodes(node.children)
        if (node.elseChildren) this.checkNodes(node.elseChildren)
        this.locals.clear()
        for (const [name, type] of previous) this.locals.set(name, type)
        return
      }
      case 'render': {
        if (!this.renders.includes(node.snippet)) this.renders.push(node.snippet)
        const info = this.options.resolveSnippet?.(node.snippet) ?? null
        if (this.options.resolveSnippet && !info) {
          this.diagnostics.push(
            error(
              'unknown-snippet',
              `No snippet named "${node.snippet}" in the theme.`,
              this.options.file,
              node.loc,
            ),
          )
        }
        for (const argument of node.args) this.checkExpression(argument.value)
        return
      }
    }
  }

  private checkExpression(expression: Expression): DropType {
    switch (expression.kind) {
      case 'literal':
        if (typeof expression.value === 'string') return dropString
        if (typeof expression.value === 'number') return dropNumber
        if (typeof expression.value === 'boolean') return dropBoolean
        return dropNil
      case 'blank':
      case 'empty':
        return dropAny
      case 'error':
        return dropAny
      case 'variable':
        return this.checkVariable(expression.name, expression)
      case 'property':
        return this.checkProperty(expression)
      case 'index':
        return this.checkIndex(expression)
      case 'filter':
        return this.checkFilter(expression)
      case 'unary':
        this.checkExpression(expression.operand)
        return dropBoolean
      case 'binary':
        this.checkExpression(expression.left)
        this.checkExpression(expression.right)
        return expression.operator === 'and' || expression.operator === 'or' ? dropAny : dropBoolean
      case 'range':
        this.checkExpression(expression.from)
        this.checkExpression(expression.to)
        return dropList(dropNumber)
    }
  }

  private checkVariable(name: string, expression: { loc: Expression['loc'] }): DropType {
    if (this.locals.has(name)) return this.locals.get(name)!
    if (name === 'content_for_layout') {
      if (this.options.isLayout) return dropAny
      this.diagnostics.push(
        error(
          'content-for-layout-outside-layout',
          '`content_for_layout` is only available in layout/theme.tpl.',
          this.options.file,
          expression.loc,
        ),
      )
      return dropAny
    }
    if (this.snippetArgs.has(name)) {
      // A snippet argument shadows a global drop of the same name; when the
      // names match a real drop, its shape still applies, which is what makes
      // `{% render "price", product: product %}` type-check inside the snippet.
      // It is not a use of the global: the caller supplies the value.
      return this.scopeField(name, false) ?? dropAny
    }
    const field = this.scopeField(name, true)
    if (field) return field
    const candidates = [...this.locals.keys(), ...this.snippetArgs, ...dropNames(this.scope)]
    this.diagnostics.push(
      error(
        'unknown-variable',
        `Unknown name "${name}".${suggestion(name, candidates)}`,
        this.options.file,
        expression.loc,
      ),
    )
    return dropAny
  }

  private scopeField(name: string, recordUse: boolean): DropType | null {
    if (this.scope.kind !== 'record') return null
    const field = this.scope.fields[name]
    if (!field) return null
    if (recordUse && !this.uses.includes(name)) this.uses.push(name)
    return field
  }

  private checkProperty(expression: Extract<Expression, { kind: 'property' }>): DropType {
    const object = this.checkExpression(expression.object)
    const { name } = expression
    if (object.kind === 'record') {
      const field = object.fields[name]
      if (field) return field
      this.diagnostics.push(
        error(
          'unknown-property',
          `"${name}" is not a property here.${suggestion(name, Object.keys(object.fields))}`,
          this.options.file,
          expression.loc,
        ),
      )
      return dropAny
    }
    if (object.kind === 'list') {
      if (name === 'size' || name === 'length') return dropNumber
      if (name === 'first' || name === 'last') return object.of
      this.diagnostics.push(
        error(
          'unknown-property',
          `A list has "size", "first" and "last"; not "${name}".`,
          this.options.file,
          expression.loc,
        ),
      )
      return dropAny
    }
    if (object.kind === 'any' || object.kind === 'nil') return dropAny
    this.diagnostics.push(
      error(
        'unknown-property',
        `A ${describe(object)} has no properties; cannot read "${name}".`,
        this.options.file,
        expression.loc,
      ),
    )
    return dropAny
  }

  private checkIndex(expression: Extract<Expression, { kind: 'index' }>): DropType {
    const object = this.checkExpression(expression.object)
    const index = this.checkExpression(expression.index)
    if (object.kind === 'list') return object.of
    if (
      object.kind === 'record' &&
      index.kind === 'string' &&
      expression.index.kind === 'literal'
    ) {
      const key = String(expression.index.value)
      const field = object.fields[key]
      if (field) return field
      this.diagnostics.push(
        error(
          'unknown-property',
          `"${key}" is not a property here.${suggestion(key, Object.keys(object.fields))}`,
          this.options.file,
          expression.loc,
        ),
      )
      return dropAny
    }
    if (object.kind === 'string') return dropString
    return dropAny
  }

  private checkFilter(expression: Extract<Expression, { kind: 'filter' }>): DropType {
    this.checkExpression(expression.value)
    for (const arg of expression.args) this.checkExpression(arg)
    const definition = registeredFilter(expression.name)
    if (!definition) {
      this.diagnostics.push(
        error(
          'unknown-filter',
          `Unknown filter "${expression.name}".${suggestion(expression.name, filterNames())}`,
          this.options.file,
          expression.loc,
        ),
      )
      return dropAny
    }
    if (
      expression.args.length < definition.minArgs ||
      expression.args.length > definition.maxArgs
    ) {
      const expected =
        definition.minArgs === definition.maxArgs
          ? `${definition.minArgs}`
          : `${definition.minArgs}–${definition.maxArgs}`
      this.diagnostics.push(
        error(
          'filter-arity',
          `"${expression.name}" takes ${expected} argument${expected === '1' ? '' : 's'}; got ${expression.args.length}.`,
          this.options.file,
          expression.loc,
        ),
      )
    }
    return definition.returns ?? dropAny
  }
}

function describe(type: DropType): string {
  switch (type.kind) {
    case 'string':
      return 'string'
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'nil':
      return 'nil'
    case 'list':
      return 'list'
    case 'record':
      return 'record'
    case 'any':
      return 'value'
  }
}
