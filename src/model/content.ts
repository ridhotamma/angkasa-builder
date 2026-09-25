/**
 * What a theme and a page actually store.
 *
 * A theme is its settings plus one ordered list of sections per page type it
 * designs. Today that is only `home`; product and collection templates are a
 * later phase and will be more keys on `templates`, which is why it is a map
 * rather than a single list.
 *
 * Both are stored as JSON strings (`contentJson`, `draftJson`,
 * `publishedJson`) and every path in or out goes through `sanitize*` below:
 * the server before it writes, the renderer before it draws. Nothing reads a
 * stored layout raw.
 */

import {
  defaultValues,
  isRecord,
  newId,
  sanitizeValues,
  type FieldValues,
  type JsonValue,
} from './fields'
import { isSectionType, sectionSchema, type SectionType } from './sections'
import { DEFAULT_THEME_SETTINGS, sanitizeThemeSettings, type ThemeSettings } from './settings'

/** Bumped when the stored shape changes in a way a reader must know about. */
export const CONTENT_VERSION = 1

/** Enough for a long landing page; a hundred sections is a mistake, not a design. */
export const MAX_SECTIONS = 40

/** The ceiling the schema's string columns are sized for. */
export const MAX_CONTENT_BYTES = 200_000

export interface SectionInstance {
  id: string
  type: SectionType
  hidden: boolean
  settings: FieldValues
}

export const TEMPLATE_KEYS = ['home'] as const
export type TemplateKey = (typeof TEMPLATE_KEYS)[number]

export interface ThemeContent {
  version: number
  settings: ThemeSettings
  templates: Record<TemplateKey, SectionInstance[]>
}

export interface PageContent {
  version: number
  sections: SectionInstance[]
}

export function createSection(type: SectionType, settings: FieldValues = {}): SectionInstance {
  const schema = sectionSchema(type)!
  return {
    id: newId(),
    type,
    hidden: false,
    settings: { ...defaultValues(schema.fields), ...sanitizeValues(schema.fields, settings) },
  }
}

/**
 * A stored list of sections, cleaned.
 *
 * Unknown section types are dropped rather than rejected: a layout saved by a
 * newer release, read by an older one mid-deploy, should lose one block rather
 * than the whole page.
 */
export function sanitizeSections(value: unknown): SectionInstance[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const out: SectionInstance[] = []

  for (const raw of value) {
    if (out.length >= MAX_SECTIONS) break
    if (!isRecord(raw) || !isSectionType(raw.type)) continue

    const schema = sectionSchema(raw.type)!
    let id = typeof raw.id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(raw.id) ? raw.id : newId()
    if (seen.has(id)) id = newId()
    seen.add(id)

    out.push({
      id,
      type: raw.type,
      hidden: raw.hidden === true,
      settings: sanitizeValues(schema.fields, raw.settings),
    })
  }

  return out
}

export function sanitizeThemeContent(value: unknown): ThemeContent {
  const source = isRecord(value) ? value : {}
  const templates = isRecord(source.templates) ? source.templates : {}
  return {
    version: CONTENT_VERSION,
    settings: sanitizeThemeSettings(source.settings),
    templates: { home: sanitizeSections(templates.home) },
  }
}

export function sanitizePageContent(value: unknown): PageContent {
  const source = isRecord(value) ? value : {}
  return { version: CONTENT_VERSION, sections: sanitizeSections(source.sections) }
}

/** Parse a stored JSON string; a corrupt one reads as empty rather than throwing. */
function parseJson(json: string | null | undefined): unknown {
  if (!json) return null
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function parseThemeContent(json: string | null | undefined): ThemeContent {
  return sanitizeThemeContent(parseJson(json))
}

export function parsePageContent(json: string | null | undefined): PageContent {
  return sanitizePageContent(parseJson(json))
}

export class ContentTooLargeError extends Error {
  override name = 'ContentTooLargeError'
  constructor() {
    super('This layout is too large to save. Remove a few sections or list items and try again.')
  }
}

/** Serialise for storage, refusing anything the column cannot hold. */
export function serializeContent(content: ThemeContent | PageContent): string {
  const json = JSON.stringify(content)
  if (new TextEncoder().encode(json).length > MAX_CONTENT_BYTES) throw new ContentTooLargeError()
  return json
}

export const EMPTY_THEME_CONTENT: ThemeContent = {
  version: CONTENT_VERSION,
  settings: DEFAULT_THEME_SETTINGS,
  templates: { home: [] },
}

/**
 * Every media file id a layout refers to.
 *
 * Used when a theme crosses a boundary — saved as an owner template, or
 * installed into a shop — so its images can be copied rather than shared.
 * See "Images in owner templates" in docs/PAGE-BUILDER.md.
 */
export function imageFileIds(sections: readonly SectionInstance[]): string[] {
  const ids = new Set<string>()
  for (const section of sections) {
    const schema = sectionSchema(section.type)
    if (!schema) continue
    for (const field of schema.fields) {
      if (field.kind === 'image') {
        const id = section.settings[field.key]
        if (typeof id === 'string' && id) ids.add(id)
      }
      if (field.kind === 'list') {
        const items = section.settings[field.key]
        if (!Array.isArray(items)) continue
        for (const item of items) {
          for (const itemField of field.fields) {
            if (itemField.kind !== 'image' || !isRecord(item)) continue
            const id = item[itemField.key]
            if (typeof id === 'string' && id) ids.add(id)
          }
        }
      }
    }
  }
  return [...ids]
}

/** The same layout with its image ids swapped through `map`; unmapped ids are cleared. */
export function remapImageFileIds(
  sections: readonly SectionInstance[],
  map: ReadonlyMap<string, string>,
): SectionInstance[] {
  const swap = (id: JsonValue | undefined): JsonValue =>
    typeof id === 'string' && id ? (map.get(id) ?? '') : (id ?? '')

  return sections.map((section) => {
    const schema = sectionSchema(section.type)
    if (!schema) return section
    const settings = { ...section.settings }
    for (const field of schema.fields) {
      if (field.kind === 'image') settings[field.key] = swap(settings[field.key])
      const list = settings[field.key]
      if (field.kind === 'list' && Array.isArray(list)) {
        settings[field.key] = list.map((item) => {
          if (!isRecord(item)) return item
          const next: FieldValues = { ...item }
          for (const itemField of field.fields) {
            if (itemField.kind === 'image') next[itemField.key] = swap(next[itemField.key])
          }
          return next
        })
      }
    }
    return { ...section, settings }
  })
}

/** Every section list a theme holds, for walking its images. */
export function themeSections(content: ThemeContent): SectionInstance[] {
  return Object.values(content.templates).flat()
}

export function remapThemeImages(
  content: ThemeContent,
  map: ReadonlyMap<string, string>,
): ThemeContent {
  return {
    ...content,
    templates: { home: remapImageFileIds(content.templates.home, map) },
  }
}
