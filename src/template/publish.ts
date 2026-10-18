/**
 * Publishing a compiled theme: the payload a shop's theme row stores.
 *
 * The CLI compiles a theme folder, wraps the artifact in one JSON value and
 * writes it to the shop's theme row — `draftJson` on push, `publishedJson` on
 * publish. Everything the storefront needs to draw the theme is in there: the
 * compiled module, the manifest, the source files (for `pull` and rollback)
 * and the last compile's diagnostics.
 *
 * Reading is defensive: a build is a row that may have been edited by hand or
 * written by an older release, so `parseTemplateThemeBuild` refuses anything
 * that is not a well-formed, bounded build rather than handing the compiler's
 * output a half-parsed manifest.
 *
 * Size: a theme row's JSON column is 200 KB. A theme that compiles past
 * `MAX_TEMPLATE_BUILD_BYTES` is refused at push, with the fix named — the
 * artifact bucket is the next step for larger themes.
 */

import type { Diagnostic } from './diagnostics'
import { error } from './diagnostics'
import type { CompiledTheme, ThemeFiles, ThemeManifest } from './theme'

/** The marker that tells a template build from a structured `ThemeContent`. */
export const TEMPLATE_BUILD_KIND = 'template'

/** The most a theme row's JSON column accepts, with room for the envelope. */
export const MAX_TEMPLATE_BUILD_BYTES = 190_000

/** The theme files one build may carry back out, for `pull`. */
export const MAX_TEMPLATE_BUILD_FILES = 200

export interface TemplateThemeBuild {
  kind: typeof TEMPLATE_BUILD_KIND
  /** The compiled module's content hash — the version everything is keyed by. */
  version: string
  compiledAt: string
  /** The theme's display name, as the CLI pushed it. */
  name: string
  /** Every source file, by theme-relative path. */
  files: Record<string, string>
  manifest: ThemeManifest
  /** The generated module. Server-side only — see the security notes. */
  source: string
  /** Warnings from the last compile; an error never reaches a push. */
  diagnostics: Diagnostic[]
}

/**
 * Wraps a compiled theme in the payload a theme row stores.
 *
 * Throws — rather than truncating — when the build is larger than a theme row
 * accepts: a theme that silently lost its last templates would be worse than
 * one that was refused.
 */
export function buildTemplateTheme(
  theme: CompiledTheme,
  files: ThemeFiles,
  options: { name: string; now?: Date } = { name: 'Theme' },
): TemplateThemeBuild {
  const build: TemplateThemeBuild = {
    kind: TEMPLATE_BUILD_KIND,
    version: theme.version,
    compiledAt: (options.now ?? new Date()).toISOString(),
    name: options.name,
    files: { ...files },
    manifest: theme.manifest,
    source: theme.source,
    diagnostics: theme.diagnostics.filter((diagnostic) => diagnostic.severity === 'warning'),
  }
  const bytes = buildTemplateThemeJson(build).length
  if (bytes > MAX_TEMPLATE_BUILD_BYTES) {
    throw new Error(
      `The compiled theme is ${bytes} bytes; a theme row holds ${MAX_TEMPLATE_BUILD_BYTES}. ` +
        'Split the theme, or wait for the artifact bucket (see docs/TEMPLATE_ENGINE.md).',
    )
  }
  return build
}

/** The stored form of a build. */
export function buildTemplateThemeJson(build: TemplateThemeBuild): string {
  return JSON.stringify(build)
}

/**
 * Reads a theme row's JSON as a template build, or `null` when it is not one.
 *
 * Bounded on purpose: every string is checked for size and every collection
 * for count, so a hand-edited row cannot make a request compile or evaluate
 * something absurd.
 */
export function parseTemplateThemeBuild(value: unknown): TemplateThemeBuild | null {
  let parsed: unknown = value
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value)
    } catch {
      return null
    }
  }
  if (!isRecord(parsed)) return null
  if (parsed.kind !== TEMPLATE_BUILD_KIND) return null
  if (typeof parsed.version !== 'string' || !/^[0-9a-f]{16}$/.test(parsed.version)) return null
  if (typeof parsed.source !== 'string' || parsed.source.length === 0) return null
  if (parsed.source.length > MAX_TEMPLATE_BUILD_BYTES) return null
  if (typeof parsed.compiledAt !== 'string') return null
  if (typeof parsed.name !== 'string' || parsed.name.length > 128) return null

  const files: Record<string, string> = {}
  if (!isRecord(parsed.files)) return null
  const entries = Object.entries(parsed.files)
  if (entries.length > MAX_TEMPLATE_BUILD_FILES) return null
  let fileBytes = 0
  for (const [path, contents] of entries) {
    if (typeof contents !== 'string') return null
    if (!path || path.length > 200 || path.includes('..')) return null
    fileBytes += contents.length
    if (fileBytes > MAX_TEMPLATE_BUILD_BYTES) return null
    files[path] = contents
  }

  const manifest = parsed.manifest
  if (!isRecord(manifest)) return null
  if (!isRecord(manifest.routes) || !isRecord(manifest.sections)) return null
  if (typeof manifest.version !== 'string' || manifest.version !== parsed.version) return null

  const diagnostics: Diagnostic[] = []
  if (Array.isArray(parsed.diagnostics)) {
    for (const item of parsed.diagnostics.slice(0, 100)) {
      if (!isRecord(item)) continue
      diagnostics.push({
        severity: item.severity === 'error' ? 'error' : 'warning',
        code: typeof item.code === 'string' ? (item.code as Diagnostic['code']) : 'invalid-schema',
        message: typeof item.message === 'string' ? item.message.slice(0, 500) : '',
      })
    }
  }

  return {
    kind: TEMPLATE_BUILD_KIND,
    version: parsed.version,
    compiledAt: parsed.compiledAt,
    name: parsed.name,
    files,
    manifest: manifest as unknown as ThemeManifest,
    source: parsed.source,
    diagnostics,
  }
}

/** Whether a stored JSON value is a template build rather than a structured theme. */
export function isTemplateThemeJson(value: unknown): boolean {
  return parseTemplateThemeBuild(value) !== null
}

/**
 * A push's own compile errors, as diagnostics, so the CLI can print them the
 * way the storefront prints its own.
 */
export function buildErrors(theme: CompiledTheme): Diagnostic[] {
  return theme.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')
}

/** One compile error, as a line a CLI can print. */
export function describeBuildError(file: string | undefined, message: string): Diagnostic {
  return error('invalid-schema', message, file)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
