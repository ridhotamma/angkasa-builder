/**
 * Publish-time diagnostics for the template compiler.
 *
 * A compiled theme fails at publish, never at request time. Everything the
 * compiler is unsure about — an unclosed tag, an unknown filter, a typo'd
 * drop property, a snippet that does not exist — is one of these records,
 * with a file and a position a developer can jump to. The caller decides what
 * an error means: `compileTheme` keeps compiling and returns the list, so a
 * theme with one mistake still reports every mistake.
 */

/** Where in a file something sits. Lines and columns are 1-based. */
export interface SourcePosition {
  line: number
  column: number
  /** Byte offset into the file, for slicing. */
  offset: number
}

export interface SourceLocation {
  start: SourcePosition
  /** Exclusive. */
  end: SourcePosition
}

/**
 * The machine-readable reasons a compile can complain. Kept as a closed union
 * so a caller can filter, count or gate on a specific failure without
 * string-matching a message.
 */
export const DIAGNOSTIC_CODES = [
  // Lexing and parsing
  'unterminated-tag',
  'unknown-tag',
  'unexpected-tag',
  'unclosed-tag',
  'unclosed-element',
  'mismatched-element',
  'disallowed-element',
  'disallowed-attribute',
  'unsafe-url',
  'invalid-expression',
  'invalid-attribute',
  // Expressions
  'unknown-variable',
  'unknown-property',
  'unknown-filter',
  'filter-arity',
  'not-a-list',
  'content-for-layout-outside-layout',
  // Theme resolution
  'unknown-snippet',
  'unknown-slot',
  'missing-route-template',
  'invalid-section-file',
  'invalid-schema',
  // Limits
  'file-too-large',
  'too-many-files',
  'theme-too-large',
  'too-many-includes',
] as const

export type DiagnosticCode = (typeof DIAGNOSTIC_CODES)[number]

export interface Diagnostic {
  severity: 'error' | 'warning'
  code: DiagnosticCode
  message: string
  /** The theme file the problem is in, when there is one. */
  file?: string
  loc?: SourceLocation
}

export function error(
  code: DiagnosticCode,
  message: string,
  file?: string,
  loc?: SourceLocation,
): Diagnostic {
  return { severity: 'error', code, message, file, loc }
}

export function warning(
  code: DiagnosticCode,
  message: string,
  file?: string,
  loc?: SourceLocation,
): Diagnostic {
  return { severity: 'warning', code, message, file, loc }
}

export function hasErrors(diagnostics: readonly Diagnostic[]): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === 'error')
}

/** `file:line:column — message`, the shape an editor can parse. */
export function formatDiagnostic(diagnostic: Diagnostic): string {
  const where = diagnostic.file
    ? `${diagnostic.file}${diagnostic.loc ? `:${diagnostic.loc.start.line}:${diagnostic.loc.start.column}` : ''}`
    : undefined
  const tag = diagnostic.severity === 'error' ? 'error' : 'warning'
  return `${where ? `${where} ` : ''}${tag} ${diagnostic.code}: ${diagnostic.message}`
}

/**
 * The closest candidate to `name`, or `null` when nothing is close enough to
 * be worth suggesting. Used for the "did you mean …?" half of an unknown
 * property or filter message — the difference between a compile error a
 * developer fixes in ten seconds and one they grep for.
 */
export function closestName(name: string, candidates: Iterable<string>): string | null {
  const lower = name.toLowerCase()
  let best: string | null = null
  let bestScore = Number.POSITIVE_INFINITY
  for (const candidate of candidates) {
    const score = editDistance(lower, candidate.toLowerCase())
    if (score < bestScore) {
      bestScore = score
      best = candidate
    }
  }
  // One edit per four characters of the name, at least one: a two-letter typo
  // in an eight-letter name is still worth suggesting, a total miss is not.
  const threshold = Math.max(1, Math.floor(name.length / 4))
  return best !== null && bestScore <= threshold ? best : null
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0
  // Optimal string alignment: insertions, deletions, substitutions and a
  // single adjacent transposition, which is what a swapped pair of letters
  // (`nmae` for `name`) actually costs.
  const rows: number[][] = []
  for (let i = 0; i <= a.length; i++) rows.push([i, ...Array<number>(b.length).fill(0)])
  for (let j = 0; j <= b.length; j++) rows[0]![j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      rows[i]![j] = Math.min(
        rows[i - 1]![j]! + 1,
        rows[i]![j - 1]! + 1,
        rows[i - 1]![j - 1]! + cost,
      )
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        rows[i]![j] = Math.min(rows[i]![j]!, rows[i - 2]![j - 2]! + 1)
      }
    }
  }
  return rows[a.length]![b.length]!
}

/** `Did you mean "heading"?` — or nothing when no candidate is close. */
export function suggestion(name: string, candidates: Iterable<string>): string {
  const close = closestName(name, candidates)
  return close ? ` Did you mean "${close}"?` : ''
}

/**
 * An offset → position lookup for one source string, with the line starts
 * precomputed. A parse asks for a position per token, so this must not walk
 * the string from the top each time.
 */
export function createPositioner(source: string): (offset: number) => SourcePosition {
  const lineStarts = [0]
  for (let i = 0; i < source.length; i++) {
    if (source.charCodeAt(i) === 10) lineStarts.push(i + 1)
  }
  return (offset) => {
    const clamped = Math.max(0, Math.min(offset, source.length))
    let low = 0
    let high = lineStarts.length - 1
    while (low < high) {
      const mid = (low + high + 1) >> 1
      if (lineStarts[mid]! <= clamped) low = mid
      else high = mid - 1
    }
    return { line: low + 1, column: clamped - lineStarts[low]! + 1, offset: clamped }
  }
}
