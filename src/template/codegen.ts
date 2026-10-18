/**
 * The code generator: an AST in, a JavaScript render function out.
 *
 * The emitted module is plain ES2020 with no imports and no file lookups: it
 * receives a runtime (`__rt`) and returns render functions that call
 * `__rt.h` — `React.createElement` in production — with static markup hoisted
 * to module constants. That last part is the win an interpreter cannot have:
 * a header, a footer or a section's chrome is built once when the theme is
 * activated and reused on every request.
 *
 * Nothing here trusts the AST. Everything that could be unsafe was refused at
 * parse time, everything that could be wrong was caught by the checker, and
 * the only calls the emitted code can make are to the runtime's own helpers,
 * the registered filters and the theme's own snippets.
 */

import type {
  AttributeNode,
  AttributeValuePart,
  BinaryExpression,
  ElementNode,
  Expression,
  TemplateNode,
} from './ast'

/** Where hoisted constants go: one list, shared by every unit in a module. */
export interface HoistCollector {
  lines: string[]
  count: number
}

export function createHoistCollector(): HoistCollector {
  return { lines: [], count: 0 }
}

export interface CodegenOptions {
  /** Snippet argument names visible to this unit. */
  args?: readonly string[]
  /** Whether this unit is the layout shell (`content_for_layout`). */
  isLayout?: boolean
  /** The generated function name per snippet, so `{% render %}` can call it. */
  snippetFunctions: ReadonlyMap<string, string>
}

export interface GeneratedUnit {
  /** Statements of the function body, ending in a `return`. */
  body: string
}

/** Generates one unit's function body. */
export function generateUnit(
  nodes: readonly TemplateNode[],
  options: CodegenOptions,
  hoists: HoistCollector,
): GeneratedUnit {
  return new UnitCodegen(options, hoists).generate(nodes)
}

class UnitCodegen {
  private readonly lines: string[] = []
  private depth = 0
  private counter = 0
  private readonly locals = new Map<string, string>()
  private readonly args: ReadonlySet<string>

  constructor(
    private readonly options: CodegenOptions,
    private readonly hoists: HoistCollector,
  ) {
    this.args = new Set(options.args ?? [])
  }

  generate(nodes: readonly TemplateNode[]): GeneratedUnit {
    const values = this.emitValueList(nodes, true)
    if ('exprs' in values) {
      if (values.exprs.length === 1) this.line(`return ${values.exprs[0]}`)
      else if (values.exprs.length === 0) this.line('return null')
      else this.line(`return __h(__rt.Fragment, null, ${values.exprs.join(', ')})`)
    } else {
      this.line(`return __h(__rt.Fragment, null, ...${values.array})`)
    }
    return { body: this.lines.join('\n') }
  }

  /* ---------------------------------------------------------------------- */
  /* Values                                                                 */
  /* ---------------------------------------------------------------------- */

  /**
   * Compiles a run of nodes to a list of values. When the run contains a
   * conditional or a loop the values are collected in an array variable the
   * caller spreads; otherwise they are plain expressions.
   */
  private emitValueList(
    nodes: readonly TemplateNode[],
    hoist: boolean,
  ): { exprs: string[] } | { array: string } {
    if (!nodes.some(isStatement)) {
      return { exprs: nodes.map((node) => this.emitValue(node, hoist)) }
    }
    const array = this.local('__out')
    this.line(`var ${array} = []`)
    for (const node of nodes) this.emitInto(node, array)
    return { array }
  }

  private emitValue(node: TemplateNode, hoist: boolean): string {
    switch (node.kind) {
      case 'text':
        return JSON.stringify(node.value)
      case 'output':
        // Text coercion, not just the value: a template prints `true` and
        // `false` the way Liquid does, and a bare number or boolean never
        // reaches React as an invalid child. The layout body is the one
        // exception — it is an element tree, not text.
        if (
          this.options.isLayout &&
          node.expression.kind === 'variable' &&
          node.expression.name === 'content_for_layout'
        ) {
          return '__body(__scope)'
        }
        return `__rt.text(${this.emitExpression(node.expression)})`
      case 'element':
        return this.emitElement(node, hoist)
      case 'render': {
        const fn = this.options.snippetFunctions.get(node.snippet)
        if (!fn) return 'null'
        const args = node.args
          .map((argument) => `${argument.name}: ${this.emitExpression(argument.value)}`)
          .join(', ')
        return `${fn}(__scope, { ${args} })`
      }
      case 'slot': {
        const args = node.args
          .map((argument) => `${argument.name}: ${this.emitExpression(argument.value)}`)
          .join(', ')
        return `__rt.slot(${JSON.stringify(node.name)}, { ${args} })`
      }
      default:
        // Statements are compiled by `emitInto`; `emitValue` never sees one.
        return 'null'
    }
  }

  /** Pushes one node's values into `array`, statement nodes included. */
  private emitInto(node: TemplateNode, array: string): void {
    switch (node.kind) {
      case 'if':
        this.emitIf(node, array)
        return
      case 'for':
        this.emitFor(node, array)
        return
      default:
        this.line(`${array}.push(${this.emitValue(node, true)})`)
        return
    }
  }

  private emitChildrenInto(nodes: readonly TemplateNode[], array: string): void {
    const values = this.emitValueList(nodes, true)
    if ('exprs' in values) for (const expr of values.exprs) this.line(`${array}.push(${expr})`)
    else this.line(`${array}.push(...${values.array})`)
  }

  private emitIf(node: Extract<TemplateNode, { kind: 'if' }>, array: string): void {
    node.branches.forEach((branch, index) => {
      const condition = this.emitExpression(branch.condition)
      this.line(`${index === 0 ? 'if' : 'else if'} (__rt.truthy(${condition})) {`)
      this.depth++
      this.emitChildrenInto(branch.children, array)
      this.depth--
      this.line('}')
    })
    if (node.elseChildren) {
      this.line('else {')
      this.depth++
      this.emitChildrenInto(node.elseChildren, array)
      this.depth--
      this.line('}')
    }
  }

  private emitFor(node: Extract<TemplateNode, { kind: 'for' }>, array: string): void {
    const list = this.local('__list')
    const index = this.local('__i')
    const item = this.local(`__item_${node.variable}`)
    const forloop = this.local('__forloop')
    const limit = node.limit ? this.emitExpression(node.limit) : 'null'
    const offset = node.offset ? this.emitExpression(node.offset) : 'null'
    this.line(
      `var ${list} = __rt.iterate(${this.emitExpression(node.iterable)}, ${limit}, ${offset}, ${node.reversed})`,
    )
    this.line(`if (${list}.length === 0) {`)
    this.depth++
    if (node.elseChildren) this.emitChildrenInto(node.elseChildren, array)
    this.depth--
    this.line('} else {')
    this.depth++
    this.line(`for (var ${index} = 0; ${index} < ${list}.length; ${index}++) {`)
    this.depth++
    this.line(`var ${item} = ${list}[${index}]`)
    this.line(`var ${forloop} = __rt.forloop(${index}, ${list}.length)`)
    const previousItem = this.locals.get(node.variable)
    const previousLoop = this.locals.get('forloop')
    this.locals.set(node.variable, item)
    this.locals.set('forloop', forloop)
    this.emitChildrenInto(node.children, array)
    restore(this.locals, node.variable, previousItem)
    restore(this.locals, 'forloop', previousLoop)
    this.depth--
    this.line('}')
    this.depth--
    this.line('}')
  }

  /* ---------------------------------------------------------------------- */
  /* Elements                                                               */
  /* ---------------------------------------------------------------------- */

  /**
   * `hoist` is true when the element sits in a dynamic context: a fully
   * static subtree becomes one module constant and every later render reuses
   * the same React element. Inside an already-static subtree children are
   * inlined, so only the outermost static node is hoisted.
   */
  private emitElement(node: ElementNode, hoist: boolean): string {
    if (isStaticNode(node)) {
      const expression = this.buildElement(node)
      if (!hoist) return expression
      const name = `__s${this.hoists.count++}`
      this.hoists.lines.push(`var ${name} = ${expression}`)
      return name
    }
    const children = this.emitValueList(node.children, true)
    const props = node.attributes.length ? this.emitProps(node.attributes) : 'null'
    const childArgs =
      'exprs' in children
        ? children.exprs.map((expr) => `, ${expr}`).join('')
        : `, ...${children.array}`
    return `__h(${JSON.stringify(node.tag)}, ${props}${childArgs})`
  }

  /** Builds a static element expression with its children inlined. */
  private buildElement(node: ElementNode): string {
    const children = this.emitValueList(node.children, false)
    const props = node.attributes.length ? this.emitProps(node.attributes) : 'null'
    const childArgs =
      'exprs' in children
        ? children.exprs.map((expr) => `, ${expr}`).join('')
        : `, ...${children.array}`
    return `__h(${JSON.stringify(node.tag)}, ${props}${childArgs})`
  }

  private emitProps(attributes: readonly AttributeNode[]): string {
    const entries: string[] = []
    for (const attribute of attributes) {
      const name = reactPropName(attribute.name)
      if (attribute.value === true) {
        entries.push(`${JSON.stringify(name)}: true`)
        continue
      }
      const staticValue = attribute.value.every((part) => !part.expression)
      if (name === 'style') {
        if (staticValue) {
          entries.push(
            `style: ${JSON.stringify(parseStyle(attribute.value.map(partText).join('')))}`,
          )
        } else {
          entries.push(`style: __rt.style(${this.emitConcat(attribute.value)})`)
        }
        continue
      }
      if (staticValue) {
        entries.push(
          `${JSON.stringify(name)}: ${JSON.stringify(attribute.value.map(partText).join(''))}`,
        )
      } else {
        entries.push(`${JSON.stringify(name)}: ${this.emitConcat(attribute.value)}`)
      }
    }
    return `{ ${entries.join(', ')} }`
  }

  /** A `class="a {{ x }} b"` value as one string expression. */
  private emitConcat(parts: readonly AttributeValuePart[]): string {
    if (parts.length === 1 && parts[0]!.expression)
      return `__rt.text(${this.emitExpression(parts[0]!.expression!)})`
    const pieces = parts.map((part) =>
      part.expression
        ? `__rt.text(${this.emitExpression(part.expression)})`
        : JSON.stringify(part.text ?? ''),
    )
    return pieces.join(' + ')
  }

  /* ---------------------------------------------------------------------- */
  /* Expressions                                                            */
  /* ---------------------------------------------------------------------- */

  private emitExpression(expression: Expression): string {
    switch (expression.kind) {
      case 'literal':
        return JSON.stringify(expression.value)
      case 'blank':
      case 'empty':
        // Only meaningful as a comparison operand; those are special-cased
        // in `emitBinary`. Alone, it is nil.
        return 'null'
      case 'error':
        return 'null'
      case 'variable':
        return this.emitVariable(expression.name)
      case 'property': {
        const object = this.emitExpression(expression.object)
        if (
          expression.name === 'size' ||
          expression.name === 'length' ||
          expression.name === 'first' ||
          expression.name === 'last'
        ) {
          // Lists answer to `size`/`first`/`last` in Liquid; a record may have
          // a field of the same name (a `forloop.length`). The helper reads
          // whichever this value actually is.
          return `__rt.get(${object}, ${JSON.stringify(expression.name)})`
        }
        return `${object}?.${expression.name}`
      }
      case 'index':
        return `${this.emitExpression(expression.object)}?.[${this.emitExpression(expression.index)}]`
      case 'filter': {
        const value = this.emitExpression(expression.value)
        const args = expression.args.map((arg) => this.emitExpression(arg))
        const call = isIdentifier(expression.name)
          ? `__f.${expression.name}`
          : `__f[${JSON.stringify(expression.name)}]`
        return `${call}(${value}${args.map((arg) => `, ${arg}`).join('')})`
      }
      case 'unary':
        return `!__rt.truthy(${this.emitExpression(expression.operand)})`
      case 'binary':
        return this.emitBinary(expression)
      case 'range':
        return `__rt.range(${this.emitExpression(expression.from)}, ${this.emitExpression(expression.to)})`
    }
  }

  private emitVariable(name: string): string {
    const local = this.locals.get(name)
    if (local) return local
    if (this.args.has(name)) return `__args.${name}`
    if (name === 'content_for_layout' && this.options.isLayout) return '__body(__scope)'
    return `__scope.${name}`
  }

  private emitBinary(expression: BinaryExpression): string {
    const { operator } = expression
    const left = expression.left
    const right = expression.right

    if (operator === '==' || operator === '!=') {
      const negate = operator === '!=' ? '!' : ''
      if (right.kind === 'blank') return `${negate}__rt.isBlank(${this.emitExpression(left)})`
      if (right.kind === 'empty') return `${negate}__rt.isEmpty(${this.emitExpression(left)})`
      if (left.kind === 'blank') return `${negate}__rt.isBlank(${this.emitExpression(right)})`
      if (left.kind === 'empty') return `${negate}__rt.isEmpty(${this.emitExpression(right)})`
      return `${negate}__rt.eq(${this.emitExpression(left)}, ${this.emitExpression(right)})`
    }

    const a = this.emitExpression(left)
    const b = this.emitExpression(right)
    switch (operator) {
      case 'and':
        return `__rt.and(${a}, ${b})`
      case 'or':
        return `__rt.or(${a}, ${b})`
      case '<':
        return `__rt.lt(${a}, ${b})`
      case '>':
        return `__rt.gt(${a}, ${b})`
      case '<=':
        return `__rt.lte(${a}, ${b})`
      case '>=':
        return `__rt.gte(${a}, ${b})`
      case 'contains':
        return `__rt.contains(${a}, ${b})`
      default:
        // Unreachable: the union is exhausted above. Kept so the function has
        // a return on every path for the compiler.
        return 'null'
    }
  }

  /* ---------------------------------------------------------------------- */

  private local(hint: string): string {
    return `${hint}_${this.counter++}`
  }

  private line(text: string): void {
    this.lines.push(`${'  '.repeat(this.depth)}${text}`)
  }
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function isStatement(node: TemplateNode): boolean {
  return node.kind === 'if' || node.kind === 'for'
}

const staticCache = new WeakMap<TemplateNode, boolean>()

/**
 * Whether a subtree is fixed for the theme version: no output, no directive,
 * no dynamic attribute. Static subtrees are hoisted — built once at
 * activation, reused on every render.
 */
export function isStaticNode(node: TemplateNode): boolean {
  const cached = staticCache.get(node)
  if (cached !== undefined) return cached
  let result: boolean
  switch (node.kind) {
    case 'text':
      result = true
      break
    case 'element':
      result =
        node.attributes.every(
          (attribute) =>
            attribute.value === true || attribute.value.every((part) => !part.expression),
        ) && node.children.every(isStaticNode)
      break
    default:
      result = false
      break
  }
  staticCache.set(node, result)
  return result
}

/** HTML attribute name → the React prop that means the same thing. */
const REACT_PROP_NAMES: Record<string, string> = {
  class: 'className',
  for: 'htmlFor',
  tabindex: 'tabIndex',
  readonly: 'readOnly',
  maxlength: 'maxLength',
  minlength: 'minLength',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  crossorigin: 'crossOrigin',
  srcset: 'srcSet',
  datetime: 'dateTime',
  enctype: 'encType',
  accesskey: 'accessKey',
  contenteditable: 'contentEditable',
  spellcheck: 'spellCheck',
  autocomplete: 'autoComplete',
  autofocus: 'autoFocus',
  inputmode: 'inputMode',
  novalidate: 'noValidate',
  formnovalidate: 'formNoValidate',
}

function reactPropName(name: string): string {
  const lower = name.toLowerCase()
  if (lower.startsWith('data-') || lower.startsWith('aria-')) return name
  return REACT_PROP_NAMES[lower] ?? name
}

function partText(part: AttributeValuePart): string {
  return part.text ?? ''
}

/**
 * A `style="color: red; font-size: 12px"` value as the object React wants.
 * Custom properties (`--brand`) are kept as written; every other key is
 * camel-cased. A malformed declaration is dropped rather than emitted.
 */
export function parseStyle(css: string): Record<string, string> {
  const style: Record<string, string> = {}
  for (const declaration of css.split(';')) {
    const colon = declaration.indexOf(':')
    if (colon === -1) continue
    const property = declaration.slice(0, colon).trim()
    const value = declaration.slice(colon + 1).trim()
    if (!property || !value) continue
    if (property.startsWith('--')) {
      style[property] = value
      continue
    }
    const key = property.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
    style[key] = value
  }
  return style
}

function isIdentifier(value: string): boolean {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(value)
}

function restore(map: Map<string, string>, key: string, previous: string | undefined): void {
  if (previous === undefined) map.delete(key)
  else map.set(key, previous)
}
