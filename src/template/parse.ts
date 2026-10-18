/**
 * Parses a `.tpl` file into the tree in `./ast`.
 *
 * One pass over the source. Liquid-shaped directives (`{{ … }}`, `{% … %}`)
 * are recognised first, HTML second, and everything else is text. The parser
 * is deliberately strict where strictness pays: an unclosed element, a
 * mismatched close tag, an unknown directive and a disallowed element
 * (`script`, `style`, `iframe`, …) are all publish-time diagnostics, because
 * the alternative is markup that looks fine until a shopper loads the page.
 *
 * Parsing never throws on bad input. It records what it could not understand,
 * skips it and keeps going, so one mistake in a theme reports as one
 * diagnostic instead of hiding every later one.
 */

import type {
  AttributeNode,
  AttributeValuePart,
  Expression,
  ForNode,
  IfBranch,
  IfNode,
  ParsedTemplate,
  RenderArgument,
  SlotNode,
  TemplateNode,
} from './ast'
import type { Diagnostic, SourceLocation, SourcePosition } from './diagnostics'
import { createPositioner, error } from './diagnostics'
import { parseExpression } from './expression'

/** How deep markup and directives may nest before the compiler refuses. */
export const MAX_TEMPLATE_DEPTH = 64

/** HTML void elements: no children, no close tag. */
const VOID_ELEMENTS = new Set([
  'area',
  'br',
  'col',
  'hr',
  'img',
  'input',
  'param',
  'source',
  'track',
  'wbr',
])

/**
 * Elements a template may not contain. `script` and `style` are the
 * platform's, never a theme's; the rest either belong to the document shell
 * the host owns or are an isolation problem of their own. Dropped with their
 * contents, like the rich-text sanitiser does.
 */
const DISALLOWED_ELEMENTS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'applet',
  'base',
  'link',
  'meta',
  'html',
  'head',
  'body',
  'title',
  'noscript',
  'template',
  'frame',
  'frameset',
])

/** URL-valued attributes, checked for script-bearing schemes at compile time. */
const URL_ATTRIBUTES = new Set(['href', 'src', 'action', 'formaction', 'poster'])

export interface ParsedTemplateFile extends ParsedTemplate {
  diagnostics: Diagnostic[]
}

export interface ParseTemplateOptions {
  /** The theme-relative path, for diagnostics. */
  file?: string
}

/** Parses one template file. Never throws on bad input — see the file comment. */
export function parseTemplate(
  source: string,
  options: ParseTemplateOptions = {},
): ParsedTemplateFile {
  return new TemplateParser(source, options.file).parse()
}

class TemplateParser {
  private readonly position: (offset: number) => SourcePosition
  private index = 0
  private depth = 0
  /** Set by a `-}}`/`-%}` close; trims the next text node's leading whitespace. */
  private stripNextText = false
  private schema: string | null = null

  constructor(
    private readonly source: string,
    private readonly file: string | undefined,
    private readonly diagnostics: Diagnostic[] = [],
  ) {
    this.position = createPositioner(source)
  }

  parse(): ParsedTemplateFile {
    const { nodes } = this.parseNodes([], null)
    return { file: this.file ?? '', nodes, schema: this.schema, diagnostics: this.diagnostics }
  }

  /* ---------------------------------------------------------------------- */
  /* Nodes                                                                  */
  /* ---------------------------------------------------------------------- */

  private parseNodes(
    liquidClosers: readonly string[],
    closeTag: string | null,
  ): { nodes: TemplateNode[]; closedTag: string | null; liquidClosed: string | null } {
    const nodes: TemplateNode[] = []
    for (;;) {
      if (this.index >= this.source.length) {
        return { nodes, closedTag: null, liquidClosed: null }
      }
      const rest = this.source.slice(this.index, this.index + 2)

      if (rest === '{{') {
        this.parseOutput(nodes)
        continue
      }
      if (rest === '{%') {
        const closed = this.parseTag(nodes, liquidClosers)
        if (closed) return { nodes, closedTag: null, liquidClosed: closed }
        continue
      }
      if (this.source.startsWith('<!--', this.index)) {
        this.skipComment()
        continue
      }
      if (rest === '</') {
        const name = this.peekCloseTagName()
        if (name === null) {
          this.parseText(nodes)
          continue
        }
        if (closeTag !== null && name === closeTag) {
          this.consumeCloseTag()
          return { nodes, closedTag: name, liquidClosed: null }
        }
        const start = this.index
        this.consumeCloseTag()
        this.report(
          'mismatched-element',
          closeTag
            ? `</${name}> does not close <${closeTag}>.`
            : `Unexpected closing tag </${name}>.`,
          this.location(start, this.index),
        )
        continue
      }
      if (this.source[this.index] === '<' && isTagNameStart(this.source[this.index + 1] ?? '')) {
        this.parseElement(nodes)
        continue
      }
      this.parseText(nodes)
    }
  }

  private parseText(nodes: TemplateNode[]): void {
    const start = this.index
    let value = ''
    while (this.index < this.source.length) {
      const rest = this.source.slice(this.index, this.index + 2)
      if (rest === '{{' || rest === '{%' || rest === '</') break
      if (this.source.startsWith('<!--', this.index)) break
      const char = this.source[this.index]!
      if (char === '<' && isTagNameStart(this.source[this.index + 1] ?? '')) break
      value += char
      this.index++
    }
    if (this.index === start) {
      // A lone `<` that starts nothing: consume it as text so we always move.
      value = this.source[this.index]!
      this.index++
    }
    if (this.stripNextText) {
      this.stripNextText = false
      value = value.replace(/^\s+/, '')
    }
    if (value) nodes.push({ kind: 'text', value, loc: this.location(start, this.index) })
  }

  private parseOutput(nodes: TemplateNode[]): void {
    const start = this.index
    this.index += 2
    const stripLeft = this.source[this.index] === '-'
    if (stripLeft) this.index++
    const contentStart = this.index
    const close = this.findTagClose('}}')
    const contentEnd = close.contentEnd
    const content = this.source.slice(contentStart, contentEnd).trim()
    const stripRight = close.stripRight
    this.index = close.end
    this.applyStrip(stripLeft, stripRight, nodes)
    const expression = parseExpression(
      content,
      this.position(contentStart),
      this.file,
      this.diagnostics,
    )
    nodes.push({ kind: 'output', expression, loc: this.location(start, this.index) })
  }

  /**
   * Handles one `{% … %}`. Returns the closer's name when the tag closes the
   * current block (`endif`, `endfor`, `else`, `elsif`, …) and `null` when it
   * was consumed as a complete construct.
   */
  private parseTag(nodes: TemplateNode[], liquidClosers: readonly string[]): string | null {
    const start = this.index
    this.index += 2
    const stripLeft = this.source[this.index] === '-'
    if (stripLeft) this.index++
    const contentStart = this.index
    const close = this.findTagClose('%}')
    const content = this.source.slice(contentStart, close.contentEnd).trim()
    const contentPosition = this.position(contentStart)
    this.index = close.end
    this.applyStrip(stripLeft, close.stripRight, nodes)

    const match = /^([a-zA-Z_][\w-]*)([\s\S]*)$/.exec(content)
    if (!match) {
      this.report('unknown-tag', `Empty directive.`, this.location(start, this.index))
      return null
    }
    const name = match[1]!
    const rest = match[2]!.trim()

    if (liquidClosers.includes(name)) {
      this.lastTagLocation = this.location(start, this.index)
      this.lastTagContent = rest
      this.lastTagContentPosition = contentPosition
      return name
    }

    switch (name) {
      case 'if':
      case 'unless':
        nodes.push(this.parseIf(name, rest, contentPosition, start))
        return null
      case 'for':
        nodes.push(this.parseFor(rest, contentPosition, start))
        return null
      case 'render':
      case 'include':
        nodes.push(this.parseRender(rest, contentPosition, start))
        return null
      case 'slot':
        nodes.push(this.parseSlot(rest, contentPosition, start))
        return null
      case 'schema':
        this.parseSchema(start)
        return null
      case 'comment':
        this.skipToEndTag('endcomment', start)
        return null
      default:
        this.report(
          'unknown-tag',
          `Unknown directive "{% ${name} %}". Allowed: if, unless, for, render, include, slot, schema, comment.`,
          this.location(start, this.index),
        )
        return null
    }
  }

  private parseIf(
    name: 'if' | 'unless',
    rest: string,
    contentPosition: SourcePosition,
    start: number,
  ): IfNode {
    const condition = this.expressionOf(rest, contentPosition)
    const branches: IfBranch[] = [
      {
        loc: this.location(start, this.index),
        condition:
          name === 'unless'
            ? { kind: 'unary', operator: 'not', operand: condition, loc: condition.loc }
            : condition,
        children: [],
      },
    ]
    let elseChildren: TemplateNode[] | null = null
    let inElse = false
    const endTag = name === 'if' ? 'endif' : 'endunless'

    for (;;) {
      const { nodes, liquidClosed } = this.parseNodes(
        name === 'if' ? ['elsif', 'else', endTag] : ['else', endTag],
        null,
      )
      if (inElse) elseChildren!.push(...nodes)
      else branches[branches.length - 1]!.children.push(...nodes)

      if (liquidClosed === endTag || liquidClosed === null) {
        // `null` means EOF: report the missing close and keep what we parsed.
        if (liquidClosed === null) {
          this.report('unclosed-tag', `Missing {% ${endTag} %}.`, this.location(start, this.index))
        }
        break
      }
      if (liquidClosed === 'elsif') {
        if (inElse) {
          this.report(
            'unexpected-tag',
            '{% elsif %} cannot follow {% else %}.',
            this.lastTagLocation,
          )
        }
        branches.push({
          loc: this.lastTagLocation,
          condition: this.expressionOf(this.lastTagContent, this.lastTagContentPosition),
          children: [],
        })
        continue
      }
      // `else`: everything after this point belongs to the else body.
      inElse = true
      elseChildren = []
    }

    return {
      kind: 'if',
      branches,
      elseChildren,
      loc: this.location(start, this.index),
    }
  }

  private parseFor(rest: string, contentPosition: SourcePosition, start: number): ForNode {
    const header = splitForHeader(rest)
    const variableMatch = /^([a-zA-Z_]\w*)\s+in\s+([\s\S]+)$/.exec(header.expression)
    if (!variableMatch) {
      this.report(
        'invalid-expression',
        'A for loop reads "{% for item in list %}".',
        this.location(start, this.index),
      )
    }
    const variable = variableMatch?.[1] ?? 'item'
    const iterableSource = variableMatch?.[2] ?? 'empty'
    const iterableOffset = header.expression.indexOf(iterableSource)
    const iterable = this.expressionOf(
      iterableSource,
      offsetPosition(contentPosition, header.expression, iterableOffset),
    )
    const limit = header.limit ? this.expressionOf(header.limit, contentPosition) : null
    const offset = header.offset ? this.expressionOf(header.offset, contentPosition) : null

    const body = this.parseNodes(['else', 'endfor'], null)
    let children = body.nodes
    let elseChildren: TemplateNode[] | null = null
    if (body.liquidClosed === 'else') {
      const alternate = this.parseNodes(['endfor'], null)
      elseChildren = alternate.nodes
      if (alternate.liquidClosed === null) {
        this.report('unclosed-tag', 'Missing {% endfor %}.', this.location(start, this.index))
      }
    } else if (body.liquidClosed === null) {
      this.report('unclosed-tag', 'Missing {% endfor %}.', this.location(start, this.index))
    }

    return {
      kind: 'for',
      variable,
      iterable,
      limit,
      offset,
      reversed: header.reversed,
      children,
      elseChildren,
      loc: this.location(start, this.index),
    }
  }

  private parseRender(rest: string, contentPosition: SourcePosition, start: number): TemplateNode {
    const match = /^(['"])([^'"]+)\1([\s\S]*)$/.exec(rest)
    if (!match) {
      this.report(
        'invalid-expression',
        'A render reads {% render "snippet-name" %}.',
        this.location(start, this.index),
      )
      return {
        kind: 'render',
        snippet: '',
        args: [],
        loc: this.location(start, this.index),
      }
    }
    const snippet = match[2]!
    const args = this.parseNamedArguments(match[3]!, contentPosition, start)
    return { kind: 'render', snippet, args, loc: this.location(start, this.index) }
  }

  /** `{% slot 'productPurchase' %}`, or `{% slot 'orderTracking', settings: section.settings %}`. */
  private parseSlot(rest: string, contentPosition: SourcePosition, start: number): SlotNode {
    const match = /^(['"])([^'"]+)\1([\s\S]*)$/.exec(rest)
    if (!match) {
      this.report(
        'invalid-expression',
        'A slot reads {% slot "productPurchase" %}.',
        this.location(start, this.index),
      )
      return { kind: 'slot', name: '', args: [], loc: this.location(start, this.index) }
    }
    return {
      kind: 'slot',
      name: match[2]!,
      args: this.parseNamedArguments(match[3]!, contentPosition, start),
      loc: this.location(start, this.index),
    }
  }

  /** The `name: value` pairs a render or slot may carry, after the leading comma. */
  private parseNamedArguments(
    rawArgs: string,
    contentPosition: SourcePosition,
    start: number,
  ): RenderArgument[] {
    const argsSource = rawArgs.trim().replace(/^,\s*/, '')
    const args: RenderArgument[] = []
    if (!argsSource) return args
    for (const part of splitTopLevel(argsSource, ',')) {
      const argument = /^([a-zA-Z_]\w*)\s*:\s*([\s\S]+)$/.exec(part)
      if (!argument) {
        this.report(
          'invalid-expression',
          `Arguments read "name: value"; got "${part}".`,
          this.location(start, this.index),
        )
        continue
      }
      const valueOffset = argsSource.indexOf(argument[2]!)
      args.push({
        name: argument[1]!,
        value: this.expressionOf(
          argument[2]!,
          offsetPosition(contentPosition, argsSource, valueOffset),
        ),
      })
    }
    return args
  }

  private parseSchema(start: number): void {
    const end = this.source.indexOf('{%', this.index)
    if (end === -1) {
      this.report('unclosed-tag', 'Missing {% endschema %}.', this.location(start, this.index))
      return
    }
    const close = this.source.indexOf('%}', end)
    const name = this.source.slice(end + 2, close === -1 ? undefined : close).trim()
    if (close === -1 || !/^-?\s*endschema\s*-?$/.test(name)) {
      this.report('unclosed-tag', 'Missing {% endschema %}.', this.location(start, this.index))
      return
    }
    this.schema = this.source.slice(this.index, end)
    this.index = close + 2
  }

  private skipToEndTag(name: string, start: number): void {
    const pattern = new RegExp(`\\{%-?\\s*${name}\\s*-?%\\}`)
    const match = pattern.exec(this.source.slice(this.index))
    if (!match) {
      this.report('unclosed-tag', `Missing {% ${name} %}.`, this.location(start, this.index))
      this.index = this.source.length
      return
    }
    this.index += match.index + match[0].length
  }

  private skipComment(): void {
    const end = this.source.indexOf('-->', this.index + 4)
    this.index = end === -1 ? this.source.length : end + 3
  }

  /* ---------------------------------------------------------------------- */
  /* Elements                                                               */
  /* ---------------------------------------------------------------------- */

  private parseElement(nodes: TemplateNode[]): void {
    const start = this.index
    this.depth++
    if (this.depth > MAX_TEMPLATE_DEPTH) {
      this.report(
        'unclosed-element',
        `Markup nests deeper than ${MAX_TEMPLATE_DEPTH} levels.`,
        this.location(start, start + 1),
      )
      this.depth--
      this.index++
      return
    }

    this.index++ // `<`
    const name = this.readTagName()
    const lower = name.toLowerCase()
    const attributes = this.parseAttributes()

    if (DISALLOWED_ELEMENTS.has(lower)) {
      this.report(
        'disallowed-element',
        `<${name}> is not allowed in a template; its contents are dropped.`,
        this.location(start, this.index),
      )
      this.skipElementContent(lower)
      this.depth--
      return
    }

    const selfClosing = this.source[this.index - 2] === '/'
    if (selfClosing || VOID_ELEMENTS.has(lower)) {
      nodes.push({
        kind: 'element',
        tag: name,
        attributes,
        children: [],
        loc: this.location(start, this.index),
      })
      this.depth--
      return
    }

    const { nodes: children, closedTag } = this.parseNodes([], lower)
    if (closedTag === null) {
      this.report(
        'unclosed-element',
        `<${name}> is never closed.`,
        this.location(start, this.index),
      )
    }
    nodes.push({
      kind: 'element',
      tag: name,
      attributes,
      children,
      loc: this.location(start, this.index),
    })
    this.depth--
  }

  /**
   * Reads attributes up to and including the tag's closing `>` (or `/>`).
   * Unsafe or unknown-shape attributes are dropped with a diagnostic rather
   * than kept and hoped about.
   */
  private parseAttributes(): AttributeNode[] {
    const attributes: AttributeNode[] = []
    for (;;) {
      this.skipWhitespace()
      if (this.index >= this.source.length) return attributes
      const char = this.source[this.index]!
      if (char === '>') {
        this.index++
        return attributes
      }
      if (char === '/' && this.source[this.index + 1] === '>') {
        this.index += 2
        return attributes
      }
      const nameStart = this.index
      const name = this.readAttributeName()
      if (!name) {
        // Not an attribute (e.g. a stray `=`); consume one character and go on.
        this.report(
          'invalid-attribute',
          `Unexpected "${char}" in a tag.`,
          this.location(nameStart, nameStart + 1),
        )
        this.index++
        continue
      }
      this.skipWhitespace()
      if (this.source[this.index] !== '=') {
        attributes.push({ name, value: true })
        continue
      }
      this.index++ // `=`
      this.skipWhitespace()
      const value = this.readAttributeValue()
      if (value === null) {
        attributes.push({ name, value: true })
        continue
      }
      if (!this.checkAttribute(name, value, nameStart)) continue
      attributes.push({ name, value })
    }
  }

  private readAttributeValue(): AttributeValuePart[] | null {
    const char = this.source[this.index]
    if (char === '"' || char === "'") {
      const quote = char
      const start = ++this.index
      let raw = ''
      while (this.index < this.source.length) {
        const next = this.source[this.index]!
        if (next === quote) break
        // An attribute value may contain `{{ … }}`; the quote scan must not
        // stop inside one.
        if (next === '{' && this.source[this.index + 1] === '{') {
          const close = this.source.indexOf('}}', this.index + 2)
          if (close !== -1) {
            raw += this.source.slice(this.index, close + 2)
            this.index = close + 2
            continue
          }
        }
        raw += next
        this.index++
      }
      if (this.source[this.index] !== quote) {
        this.report(
          'invalid-attribute',
          'Unterminated attribute value.',
          this.location(start - 1, this.index),
        )
      } else {
        this.index++
      }
      return parseAttributeParts(raw, this.position(start), this.file, this.diagnostics)
    }
    const start = this.index
    while (this.index < this.source.length && !/[\s/>]/.test(this.source[this.index]!)) this.index++
    if (this.index === start) return null
    const raw = this.source.slice(start, this.index)
    return parseAttributeParts(raw, this.position(start), this.file, this.diagnostics)
  }

  private checkAttribute(name: string, value: AttributeValuePart[], start: number): boolean {
    const lower = name.toLowerCase()
    if (lower.startsWith('on')) {
      this.report(
        'disallowed-attribute',
        `"${name}" is not allowed: templates emit no event handlers.`,
        this.location(start, this.index),
      )
      return false
    }
    if (lower === 'srcdoc') {
      this.report(
        'disallowed-attribute',
        '"srcdoc" is not allowed in a template.',
        this.location(start, this.index),
      )
      return false
    }
    if (URL_ATTRIBUTES.has(lower)) {
      const literal = value.map((part) => part.text ?? '').join('')
      const scheme = /^\s*([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(literal)?.[1]?.toLowerCase()
      const allowedData = lower === 'src' && /^\s*data:image\//i.test(literal)
      if (
        scheme &&
        scheme !== 'http' &&
        scheme !== 'https' &&
        scheme !== 'mailto' &&
        scheme !== 'tel'
      ) {
        if (!allowedData) {
          this.report(
            'unsafe-url',
            `"${literal.slice(0, 40)}" is not an allowed ${name}.`,
            this.location(start, this.index),
          )
          return false
        }
      }
    }
    return true
  }

  /** Drops `<script>…</script>` and friends whole, contents included. */
  private skipElementContent(lower: string): void {
    const pattern = new RegExp(`</${escapeRegExp(lower)}\\s*>`, 'i')
    const match = pattern.exec(this.source.slice(this.index))
    this.index = match ? this.index + match.index + match[0].length : this.source.length
  }

  /* ---------------------------------------------------------------------- */
  /* Small helpers                                                          */
  /* ---------------------------------------------------------------------- */

  private expressionOf(source: string, position: SourcePosition): Expression {
    return parseExpression(source.trim(), position, this.file, this.diagnostics)
  }

  private readTagName(): string {
    const start = this.index
    while (this.index < this.source.length && isTagNamePart(this.source[this.index]!)) this.index++
    return this.source.slice(start, this.index)
  }

  private readAttributeName(): string {
    const start = this.index
    while (this.index < this.source.length && !/[\s=/>]/.test(this.source[this.index]!))
      this.index++
    const name = this.source.slice(start, this.index)
    return /^[a-zA-Z_:][-a-zA-Z0-9_:.]*$/.test(name) ? name : ''
  }

  private peekCloseTagName(): string | null {
    const match = /^<\/\s*([a-zA-Z][\w-]*)/.exec(this.source.slice(this.index))
    return match ? match[1]!.toLowerCase() : null
  }

  private consumeCloseTag(): void {
    const close = this.source.indexOf('>', this.index)
    this.index = close === -1 ? this.source.length : close + 1
  }

  private skipWhitespace(): void {
    while (this.index < this.source.length && /\s/.test(this.source[this.index]!)) this.index++
  }

  /**
   * Finds the closing delimiter for the construct starting at `this.index`,
   * honouring `-` strip markers. A delimiter inside a quoted string in the
   * tag body (`{% if x == '}}' %}`) is skipped.
   */
  private findTagClose(delimiter: string): {
    contentEnd: number
    end: number
    stripRight: boolean
  } {
    let i = this.index
    let quote: string | null = null
    while (i < this.source.length) {
      const char = this.source[i]!
      if (quote) {
        if (char === '\\') i += 2
        else {
          if (char === quote) quote = null
          i++
        }
        continue
      }
      if (char === "'" || char === '"') {
        quote = char
        i++
        continue
      }
      if (char === delimiter[0] && this.source[i + 1] === delimiter[1]) {
        const stripRight = this.source[i - 1] === '-'
        return {
          contentEnd: stripRight ? i - 1 : i,
          end: i + 2,
          stripRight,
        }
      }
      i++
    }
    this.report(
      'unterminated-tag',
      `Missing "${delimiter}".`,
      this.location(this.index - 2, this.source.length),
    )
    return { contentEnd: this.source.length, end: this.source.length, stripRight: false }
  }

  private applyStrip(stripLeft: boolean, stripRight: boolean, nodes: TemplateNode[]): void {
    if (stripLeft) {
      const previous = nodes[nodes.length - 1]
      if (previous?.kind === 'text') {
        previous.value = previous.value.replace(/\s+$/, '')
        if (!previous.value) nodes.pop()
      }
    }
    if (stripRight) this.stripNextText = true
  }

  /** Set by `parseTag` so `parseIf` can point at the branch tag it just read. */
  private lastTagLocation: SourceLocation = {
    start: { line: 1, column: 1, offset: 0 },
    end: { line: 1, column: 1, offset: 0 },
  }
  private lastTagContent = ''
  private lastTagContentPosition: SourcePosition = { line: 1, column: 1, offset: 0 }

  private location(start: number, end: number): SourceLocation {
    return { start: this.position(start), end: this.position(end) }
  }

  private report(code: Diagnostic['code'], message: string, loc?: SourceLocation): void {
    this.diagnostics.push(error(code, message, this.file, loc))
  }
}

/* -------------------------------------------------------------------------- */
/* Header and attribute parsing                                               */
/* -------------------------------------------------------------------------- */

/**
 * Splits a `for` header into its iterable and its options.
 *
 * `limit:`, `offset:` and `reversed` are reserved in this position, which is
 * what lets the iterable itself be a filtered expression
 * (`{% for p in products | where: "on_sale", true %}`) without a grammar that
 * has to guess where the expression ends. Options may appear in any order.
 */
export function splitForHeader(rest: string): {
  expression: string
  limit: string | null
  offset: string | null
  reversed: boolean
} {
  const options = findForOptions(rest)
  if (!options.length) return { expression: rest, limit: null, offset: null, reversed: false }

  const expression = rest.slice(0, options[0]!.start).trim()
  let limit: string | null = null
  let offset: string | null = null
  let reversed = false
  for (let i = 0; i < options.length; i++) {
    const option = options[i]!
    const next = options[i + 1]
    const value = rest
      .slice(option.end, next ? next.start : rest.length)
      .replace(/^\s*:\s*/, '')
      .trim()
    if (option.name === 'reversed') reversed = true
    else if (option.name === 'limit') limit = value
    else offset = value
  }
  return { expression, limit, offset, reversed }
}

interface ForOption {
  name: 'limit' | 'offset' | 'reversed'
  /** Where the keyword starts. */
  start: number
  /** Where the keyword (and its colon, when it has one) ends. */
  end: number
}

function findForOptions(rest: string): ForOption[] {
  const options: ForOption[] = []
  let depth = 0
  let quote: string | null = null
  for (let i = 0; i < rest.length; i++) {
    const char = rest[i]!
    if (quote) {
      if (char === '\\') i++
      else if (char === quote) quote = null
      continue
    }
    if (char === "'" || char === '"') {
      quote = char
      continue
    }
    if (char === '(' || char === '[') depth++
    else if (char === ')' || char === ']') depth--
    else if (depth === 0 && (char === 'l' || char === 'o' || char === 'r')) {
      for (const name of ['limit', 'offset', 'reversed'] as const) {
        if (!rest.startsWith(name, i)) continue
        const before = i === 0 ? ' ' : rest[i - 1]!
        if (!/\s/.test(before)) continue
        const afterKeyword = i + name.length
        const after = rest.slice(afterKeyword)
        const colon = /^\s*:/.exec(after)
        if (name === 'reversed') {
          if (/^\s*$|^\s+/.test(after)) {
            options.push({ name, start: i, end: afterKeyword })
            i = afterKeyword - 1
          }
        } else if (colon) {
          options.push({ name, start: i, end: afterKeyword + colon[0].length })
          i = afterKeyword + colon[0].length - 1
        }
        break
      }
    }
  }
  return options
}

/** Splits on `separator` at the top level, outside quotes, parens and brackets. */
export function splitTopLevel(source: string, separator: string): string[] {
  const parts: string[] = []
  let current = ''
  let depth = 0
  let quote: string | null = null
  for (let i = 0; i < source.length; i++) {
    const char = source[i]!
    if (quote) {
      current += char
      if (char === '\\') {
        current += source[i + 1] ?? ''
        i++
      } else if (char === quote) quote = null
      continue
    }
    if (char === "'" || char === '"') {
      quote = char
      current += char
      continue
    }
    if (char === '(' || char === '[') depth++
    if (char === ')' || char === ']') depth--
    if (char === separator && depth === 0) {
      parts.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

/**
 * One attribute value as parts: literal text and the expressions a `{{ … }}`
 * inside it contributes. `class="hero {{ modifier }}"` becomes three parts.
 */
function parseAttributeParts(
  raw: string,
  base: SourcePosition,
  file: string | undefined,
  diagnostics: Diagnostic[],
): AttributeValuePart[] {
  const parts: AttributeValuePart[] = []
  let text = ''
  let i = 0
  while (i < raw.length) {
    if (raw[i] === '{' && raw[i + 1] === '{') {
      const close = raw.indexOf('}}', i + 2)
      if (close === -1) {
        text += raw.slice(i)
        break
      }
      if (text) {
        parts.push({ text })
        text = ''
      }
      const content = raw.slice(i + 2, close).trim()
      parts.push({
        expression: parseExpression(content, offsetPosition(base, raw, i + 2), file, diagnostics),
      })
      i = close + 2
      continue
    }
    text += raw[i]
    i++
  }
  if (text) parts.push({ text })
  return parts.length ? parts : [{ text: '' }]
}

/** The position of `offset` in `slice` when `slice` starts at `base`. */
function offsetPosition(base: SourcePosition, slice: string, offset: number): SourcePosition {
  let line = base.line
  let column = base.column
  for (let i = 0; i < offset && i < slice.length; i++) {
    if (slice[i] === '\n') {
      line++
      column = 1
    } else {
      column++
    }
  }
  return { line, column, offset: base.offset + Math.min(offset, slice.length) }
}

function isTagNameStart(char: string): boolean {
  return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z')
}

function isTagNamePart(char: string): boolean {
  return isTagNameStart(char) || (char >= '0' && char <= '9') || char === '-' || char === ':'
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
