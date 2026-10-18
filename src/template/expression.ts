/**
 * The expression grammar: a whitelist, never arbitrary code.
 *
 * ```
 * expression  := filter ( '|' filter-name (':' argument (',' argument)*)? )*
 * filter      := or
 * or          := and ('or' and)*
 * and         := not ('and' not)*
 * not         := 'not' not | comparison
 * comparison  := postfix (('=='|'!='|'<'|'>'|'<='|'>='|'contains') postfix)?
 * postfix     := primary ('.' name | '[' expression ']')*
 * primary     := number | string | 'true' | 'false' | 'nil' | 'null'
 *              | 'blank' | 'empty' | name | '(' expression ('..' expression)? ')'
 * ```
 *
 * There is no arithmetic, no assignment, no call syntax and no way to reach
 * anything the drops did not hand the scope. That is what makes a template a
 * closure over data instead of a program — and what lets the compiler type
 * every read before it emits a single line of JavaScript.
 *
 * See docs/TEMPLATE_ENGINE.md.
 */

import type { BinaryOperator, Expression } from './ast'
import { BINARY_OPERATORS } from './ast'
import type { Diagnostic, SourcePosition } from './diagnostics'
import { error } from './diagnostics'

interface Token {
  type: 'number' | 'string' | 'identifier' | 'operator' | 'punctuation' | 'eof'
  value: string
  number?: number
  start: number
  end: number
}

const TWO_CHAR_OPERATORS = ['==', '!=', '<=', '>=', '..'] as const

const SINGLE_CHAR = {
  '(': 'punctuation',
  ')': 'punctuation',
  '[': 'punctuation',
  ']': 'punctuation',
  '.': 'punctuation',
  ',': 'punctuation',
  ':': 'punctuation',
  '|': 'punctuation',
  '<': 'operator',
  '>': 'operator',
} as const

const KEYWORD_LITERALS: Record<string, string | number | boolean | null> = {
  true: true,
  false: false,
  nil: null,
  null: null,
}

/**
 * Parses `source` as one expression. `base` is where the expression starts in
 * the file, so every diagnostic points at the real place.
 */
export function parseExpression(
  source: string,
  base: SourcePosition,
  file: string | undefined,
  diagnostics: Diagnostic[],
): Expression {
  return new ExpressionParser(source, base, file, diagnostics).parse()
}

class ExpressionParser {
  private readonly tokens: Token[]
  private index = 0

  constructor(
    private readonly source: string,
    private readonly base: SourcePosition,
    private readonly file: string | undefined,
    private readonly diagnostics: Diagnostic[],
  ) {
    this.tokens = tokenize(source, base, file, diagnostics)
  }

  parse(): Expression {
    const expression = this.parseFilter()
    const token = this.peek()
    if (token.type !== 'eof') {
      this.report(`Unexpected "${token.value}".`, token)
      this.advance()
      return this.errorExpression(token, `Unexpected "${token.value}".`)
    }
    return expression
  }

  private parseFilter(): Expression {
    let value = this.parseOr()
    while (this.matchPunctuation('|')) {
      const nameToken = this.expectIdentifier('a filter name')
      const args: Expression[] = []
      if (this.matchPunctuation(':')) {
        do {
          args.push(this.parseOr())
        } while (this.matchPunctuation(','))
      }
      const name = nameToken.type === 'identifier' ? nameToken.value : ''
      value = {
        kind: 'filter',
        value,
        name,
        args,
        loc: this.location(value, nameToken),
      }
    }
    return value
  }

  private parseOr(): Expression {
    let left = this.parseAnd()
    while (this.matchKeyword('or')) {
      const right = this.parseAnd()
      left = { kind: 'binary', operator: 'or', left, right, loc: this.location(left, right) }
    }
    return left
  }

  private parseAnd(): Expression {
    let left = this.parseNot()
    while (this.matchKeyword('and')) {
      const right = this.parseNot()
      left = { kind: 'binary', operator: 'and', left, right, loc: this.location(left, right) }
    }
    return left
  }

  private parseNot(): Expression {
    const token = this.peek()
    if (this.matchKeyword('not')) {
      const operand = this.parseNot()
      return { kind: 'unary', operator: 'not', operand, loc: this.location(token, operand) }
    }
    return this.parseComparison()
  }

  private parseComparison(): Expression {
    const left = this.parsePostfix()
    const token = this.peek()
    const operator = this.binaryOperator(token)
    if (!operator) return left
    this.advance()
    const right = this.parsePostfix()
    return { kind: 'binary', operator, left, right, loc: this.location(left, right) }
  }

  private binaryOperator(token: Token): BinaryOperator | null {
    if (token.type === 'operator') {
      const candidate = token.value as BinaryOperator
      return BINARY_OPERATORS.includes(candidate) && candidate !== 'and' && candidate !== 'or'
        ? candidate
        : null
    }
    if (token.type === 'identifier' && token.value === 'contains') return 'contains'
    return null
  }

  private parsePostfix(): Expression {
    let object = this.parsePrimary()
    for (;;) {
      if (this.matchPunctuation('.')) {
        const nameToken = this.expectIdentifier('a property name')
        const name = nameToken.type === 'identifier' ? nameToken.value : ''
        object = { kind: 'property', object, name, loc: this.location(object, nameToken) }
        continue
      }
      if (this.matchPunctuation('[')) {
        const index = this.parseFilter()
        const close = this.peek()
        if (!this.matchPunctuation(']')) this.report('Expected "]".', close)
        object = { kind: 'index', object, index, loc: this.location(object, close) }
        continue
      }
      return object
    }
  }

  private parsePrimary(): Expression {
    const token = this.advance()
    switch (token.type) {
      case 'number':
        return { kind: 'literal', value: token.number!, loc: this.location(token, token) }
      case 'string':
        return { kind: 'literal', value: token.value, loc: this.location(token, token) }
      case 'identifier': {
        if (token.value in KEYWORD_LITERALS) {
          return {
            kind: 'literal',
            value: KEYWORD_LITERALS[token.value]!,
            loc: this.location(token, token),
          }
        }
        if (token.value === 'blank') return { kind: 'blank', loc: this.location(token, token) }
        if (token.value === 'empty') return { kind: 'empty', loc: this.location(token, token) }
        return { kind: 'variable', name: token.value, loc: this.location(token, token) }
      }
      case 'punctuation':
        if (token.value === '(') {
          const from = this.parseFilter()
          if (this.matchOperator('..')) {
            const to = this.parseFilter()
            const close = this.peek()
            if (!this.matchPunctuation(')')) this.report('Expected ")".', close)
            return { kind: 'range', from, to, loc: this.location(token, close) }
          }
          const close = this.peek()
          if (!this.matchPunctuation(')')) this.report('Expected ")".', close)
          return from
        }
        break
      case 'eof':
        this.report('Expected an expression.', token)
        return this.errorExpression(token, 'Expected an expression.')
      default:
        break
    }
    this.report(`Unexpected "${token.value}".`, token)
    return this.errorExpression(token, `Unexpected "${token.value}".`)
  }

  /* ---------------------------------------------------------------------- */

  private peek(): Token {
    return this.tokens[this.index]!
  }

  private advance(): Token {
    const token = this.tokens[this.index]!
    if (token.type !== 'eof') this.index++
    return token
  }

  private matchKeyword(keyword: string): boolean {
    const token = this.peek()
    if (token.type !== 'identifier' || token.value !== keyword) return false
    this.advance()
    return true
  }

  private matchOperator(operator: string): boolean {
    const token = this.peek()
    if (token.type !== 'operator' || token.value !== operator) return false
    this.advance()
    return true
  }

  private matchPunctuation(punctuation: string): boolean {
    const token = this.peek()
    if (token.type !== 'punctuation' || token.value !== punctuation) return false
    this.advance()
    return true
  }

  private expectIdentifier(what: string): Token {
    const token = this.peek()
    if (token.type === 'identifier') {
      this.advance()
      return token
    }
    this.report(`Expected ${what}.`, token)
    // A stand-in token: the parser continues, and the diagnostic above is
    // what the developer acts on.
    return { type: 'identifier', value: '', start: token.start, end: token.end }
  }

  private location(
    from: { loc: { start: SourcePosition } } | Token,
    to: Token | { loc: { end: SourcePosition } },
  ): {
    start: SourcePosition
    end: SourcePosition
  } {
    const start = 'loc' in from ? from.loc.start : this.position(from.start)
    const end = 'loc' in to ? to.loc.end : this.position(to.end)
    return { start, end }
  }

  private position(offset: number): SourcePosition {
    return positionAt(this.source, offset, this.base)
  }

  private report(message: string, token: Token): void {
    this.diagnostics.push(
      error('invalid-expression', message, this.file, {
        start: this.position(token.start),
        end: this.position(token.end),
      }),
    )
  }

  private errorExpression(token: Token, message: string): Expression {
    return {
      kind: 'error',
      message,
      loc: { start: this.position(token.start), end: this.position(token.end) },
    }
  }
}

/**
 * The position `offset` characters into `source`, given where the source
 * starts in its file. Walks newlines rather than caching a line index: an
 * expression is a handful of characters and a compile is not a hot path.
 */
export function positionAt(source: string, offset: number, base: SourcePosition): SourcePosition {
  let line = base.line
  let column = base.column
  for (let i = 0; i < offset; i++) {
    if (source.charCodeAt(i) === 10) {
      line++
      column = 1
    } else {
      column++
    }
  }
  return { line, column, offset: base.offset + offset }
}

function tokenize(
  source: string,
  base: SourcePosition,
  file: string | undefined,
  diagnostics: Diagnostic[],
): Token[] {
  const tokens: Token[] = []
  let i = 0
  const position = (offset: number) => positionAt(source, offset, base)
  const push = (token: Token) => tokens.push(token)
  const fail = (message: string, start: number, end: number) => {
    diagnostics.push(
      error('invalid-expression', message, file, { start: position(start), end: position(end) }),
    )
  }

  while (i < source.length) {
    const char = source[i]!
    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      i++
      continue
    }
    const start = i

    // Two-character operators first, so `==` never lexes as two `=`.
    const pair = source.slice(i, i + 2)
    if ((TWO_CHAR_OPERATORS as readonly string[]).includes(pair)) {
      push({ type: 'operator', value: pair, start, end: i + 2 })
      i += 2
      continue
    }
    // `=` alone is the common typo for `==`; report it as one.
    if (char === '=') {
      fail('Use "==" to compare.', start, i + 1)
      push({ type: 'operator', value: '=', start, end: i + 1 })
      i++
      continue
    }
    if (char in SINGLE_CHAR) {
      const type = SINGLE_CHAR[char as keyof typeof SINGLE_CHAR]
      push({ type, value: char, start, end: i + 1 })
      i++
      continue
    }
    if (char === "'" || char === '"') {
      const quote = char
      i++
      let value = ''
      let closed = false
      while (i < source.length) {
        const next = source[i]!
        if (next === '\\' && i + 1 < source.length) {
          const escaped = source[i + 1]!
          value +=
            escaped === 'n' ? '\n' : escaped === 't' ? '\t' : escaped === 'r' ? '\r' : escaped
          i += 2
          continue
        }
        if (next === quote) {
          closed = true
          i++
          break
        }
        value += next
        i++
      }
      if (!closed) fail('Unterminated string.', start, i)
      push({ type: 'string', value, start, end: i })
      continue
    }
    if (isDigit(char) || (char === '-' && isDigit(source[i + 1] ?? ''))) {
      i++
      while (i < source.length && isDigit(source[i]!)) i++
      if (source[i] === '.' && isDigit(source[i + 1] ?? '')) {
        i++
        while (i < source.length && isDigit(source[i]!)) i++
      }
      const raw = source.slice(start, i)
      const number = Number(raw)
      if (!Number.isFinite(number)) fail(`Invalid number "${raw}".`, start, i)
      push({ type: 'number', value: raw, number, start, end: i })
      continue
    }
    if (isIdentifierStart(char)) {
      i++
      while (i < source.length && isIdentifierPart(source[i]!)) i++
      push({ type: 'identifier', value: source.slice(start, i), start, end: i })
      continue
    }

    fail(`Unexpected character "${char}".`, start, i + 1)
    i++
  }
  push({ type: 'eof', value: '', start: source.length, end: source.length })
  return tokens
}

function isDigit(char: string): boolean {
  return char >= '0' && char <= '9'
}

function isIdentifierStart(char: string): boolean {
  return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || char === '_'
}

function isIdentifierPart(char: string): boolean {
  return isIdentifierStart(char) || isDigit(char)
}
