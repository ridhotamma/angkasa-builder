/**
 * What a theme and a page actually store.
 *
 * A theme is its settings, its header and footer (`layout`), and one ordered
 * list of sections per page type it designs — the home page and the product
 * page. `templates` is a map so collection and search templates can be more
 * keys later.
 *
 * Both are stored as JSON strings (`contentJson`, `draftJson`,
 * `publishedJson`) and every path in or out goes through `sanitize*` below:
 * the server before it writes, the renderer before it draws. Nothing reads a
 * stored layout raw.
 */

import {
  collectFieldValues,
  defaultValues,
  isRecord,
  mapFieldValues,
  newId,
  sanitizeValues,
  type FieldValues,
  type JsonValue,
} from './fields'
import { sanitizeLayout, type ThemeLayout } from './layout'
import { SECTION_STYLE_FIELDS } from './section-style'
import {
  isSectionAllowed,
  isSectionType,
  sectionSchema,
  type SectionScope,
  type SectionType,
} from './sections'
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
  /** Colour scheme, spacing, width, devices and dates — see `./section-style`. */
  style: FieldValues
}

export const TEMPLATE_KEYS = ['home', 'product'] as const
export type TemplateKey = (typeof TEMPLATE_KEYS)[number]

export const TEMPLATE_SCOPES: Record<TemplateKey, SectionScope> = {
  home: 'home',
  product: 'product',
}

export interface ThemeContent {
  version: number
  settings: ThemeSettings
  layout: ThemeLayout
  templates: Record<TemplateKey, SectionInstance[]>
}

export interface PageContent {
  version: number
  sections: SectionInstance[]
}

export function createSection(
  type: SectionType,
  settings: FieldValues | Record<string, unknown> = {},
  style: Record<string, unknown> = {},
): SectionInstance {
  const schema = sectionSchema(type)!
  return {
    id: newId(),
    type,
    hidden: false,
    settings: { ...defaultValues(schema.fields), ...sanitizeValues(schema.fields, settings) },
    style: sanitizeValues(SECTION_STYLE_FIELDS, { ...schema.defaultStyle, ...style }),
  }
}

/* Editing a list of sections — shared by the editor's list and its preview toolbar. */

/** `sections` with the one `id` moved `by` places; unchanged when it would leave the list. */
export function moveSection(sections: SectionInstance[], id: string, by: number): SectionInstance[] {
  const from = sections.findIndex((section) => section.id === id)
  const to = from + by
  if (from < 0 || to < 0 || to >= sections.length) return sections
  const next = [...sections]
  const [section] = next.splice(from, 1)
  next.splice(to, 0, section!)
  return next
}

/** Whether another copy of section `id` fits: room on the page, and under its type's cap. */
export function canDuplicateSection(sections: readonly SectionInstance[], id: string): boolean {
  const section = sections.find((other) => other.id === id)
  if (!section || sections.length >= MAX_SECTIONS) return false
  const max = sectionSchema(section.type)?.max
  return max === undefined || sections.filter((other) => other.type === section.type).length < max
}

/** `sections` with a copy of `id` right after it, and the copy — or `null` when it does not fit. */
export function duplicateSection(
  sections: SectionInstance[],
  id: string,
): { sections: SectionInstance[]; copy: SectionInstance } | null {
  if (!canDuplicateSection(sections, id)) return null
  const index = sections.findIndex((section) => section.id === id)
  const copy = { ...structuredClone(sections[index]!), id: newId() }
  const next = [...sections]
  next.splice(index + 1, 0, copy)
  return { sections: next, copy }
}

/**
 * A stored list of sections, cleaned.
 *
 * Unknown section types are dropped rather than rejected: a layout saved by a
 * newer release, read by an older one mid-deploy, should lose one block rather
 * than the whole page. So is a section the scope cannot hold — the product's
 * buy box on the home page — and any beyond a type's `max`.
 */
export function sanitizeSections(value: unknown, scope: SectionScope = 'home'): SectionInstance[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const counts = new Map<string, number>()
  const out: SectionInstance[] = []

  for (const raw of value) {
    if (out.length >= MAX_SECTIONS) break
    if (!isRecord(raw) || !isSectionType(raw.type)) continue

    const schema = sectionSchema(raw.type)!
    if (!isSectionAllowed(schema, scope)) continue
    const count = counts.get(schema.type) ?? 0
    if (schema.max !== undefined && count >= schema.max) continue
    counts.set(schema.type, count + 1)

    let id = typeof raw.id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(raw.id) ? raw.id : newId()
    if (seen.has(id)) id = newId()
    seen.add(id)

    out.push({
      id,
      type: raw.type,
      hidden: raw.hidden === true,
      settings: sanitizeValues(schema.fields, raw.settings),
      style: sanitizeValues(SECTION_STYLE_FIELDS, raw.style),
    })
  }

  return out
}

/** The product page every theme starts with — and the one a theme without its own gets. */
export function defaultProductTemplate(): SectionInstance[] {
  return [
    createSection('product-info'),
    createSection('product-reviews'),
    createSection('related-products'),
  ]
}

/**
 * The product page template, cleaned. The buy box is required: a theme saved
 * before product templates existed — or one whose buy box was removed by hand
 * — gets the default page, or its buy box back at the top.
 */
export function sanitizeProductTemplate(value: unknown): SectionInstance[] {
  if (!Array.isArray(value) || value.length === 0) return defaultProductTemplate()
  const sections = sanitizeSections(value, 'product')
  if (sections.some((section) => section.type === 'product-info')) return sections
  return [createSection('product-info'), ...sections].slice(0, MAX_SECTIONS)
}

export function sanitizeThemeContent(value: unknown): ThemeContent {
  const source = isRecord(value) ? value : {}
  const templates = isRecord(source.templates) ? source.templates : {}
  return {
    version: CONTENT_VERSION,
    settings: sanitizeThemeSettings(source.settings),
    layout: sanitizeLayout(source.layout),
    templates: {
      home: sanitizeSections(templates.home, 'home'),
      product: sanitizeProductTemplate(templates.product),
    },
  }
}

export function sanitizePageContent(value: unknown): PageContent {
  const source = isRecord(value) ? value : {}
  return { version: CONTENT_VERSION, sections: sanitizeSections(source.sections, 'page') }
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
  layout: sanitizeLayout(null),
  templates: { home: [], product: [] },
}

/* -------------------------------------------------------------------------- */
/* What a layout refers to                                                    */
/* -------------------------------------------------------------------------- */

function sectionValues(
  sections: readonly SectionInstance[],
  kinds: Parameters<typeof collectFieldValues>[2],
): JsonValue[] {
  return sections.flatMap((section) => {
    const schema = sectionSchema(section.type)
    return schema ? collectFieldValues(schema.fields, section.settings, kinds) : []
  })
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
  for (const value of sectionValues(sections, ['image'])) {
    if (typeof value === 'string' && value) ids.add(value)
  }
  return [...ids]
}

/** Every uploaded video's file id — they live in their own bucket, so they are copied apart. */
export function videoFileIds(sections: readonly SectionInstance[]): string[] {
  const ids = new Set<string>()
  for (const value of sectionValues(sections, ['video'])) {
    if (isRecord(value) && value.source === 'upload' && typeof value.id === 'string') {
      ids.add(value.id)
    }
  }
  return [...ids]
}

/**
 * Every product a layout picks by id — featured products, hotspots, video
 * tags — so the storefront can read exactly those alongside the page.
 */
export function productIds(sections: readonly SectionInstance[]): string[] {
  const ids = new Set<string>()
  for (const value of sectionValues(sections, ['product'])) {
    if (typeof value === 'string' && value) ids.add(value)
  }
  return [...ids]
}

/** Only the sections the storefront would draw: hidden ones read nothing. */
export function visibleSections(sections: readonly SectionInstance[]): SectionInstance[] {
  return sections.filter((section) => !section.hidden)
}

function remapSections(
  sections: readonly SectionInstance[],
  images: ReadonlyMap<string, string>,
  videos: ReadonlyMap<string, string>,
): SectionInstance[] {
  const swapImage = (id: JsonValue): JsonValue =>
    typeof id === 'string' && id ? (images.get(id) ?? '') : id
  const swapVideo = (value: JsonValue): JsonValue => {
    if (!isRecord(value) || value.source !== 'upload' || typeof value.id !== 'string') return value
    const copy = videos.get(value.id)
    return copy ? { source: 'upload', id: copy } : null
  }

  return sections.map((section) => {
    const schema = sectionSchema(section.type)
    if (!schema) return section
    const withImages = mapFieldValues(schema.fields, section.settings, 'image', swapImage)
    return { ...section, settings: mapFieldValues(schema.fields, withImages, 'video', swapVideo) }
  })
}

/** The same layout with its image ids swapped through `map`; unmapped ids are cleared. */
export function remapImageFileIds(
  sections: readonly SectionInstance[],
  map: ReadonlyMap<string, string>,
): SectionInstance[] {
  return remapSections(sections, map, new Map(videoFileIds(sections).map((id) => [id, id])))
}

/** Every section list a theme holds, for walking its images. */
export function themeSections(content: ThemeContent): SectionInstance[] {
  return Object.values(content.templates).flat()
}

/**
 * A theme with its images — and, when given, its uploaded videos — swapped
 * for copies. Without `videos`, uploaded videos keep their ids.
 */
export function remapThemeImages(
  content: ThemeContent,
  images: ReadonlyMap<string, string>,
  videos?: ReadonlyMap<string, string>,
): ThemeContent {
  const keepVideos = new Map(videoFileIds(themeSections(content)).map((id) => [id, id]))
  const videoMap = videos ?? keepVideos
  return {
    ...content,
    templates: {
      home: remapSections(content.templates.home, images, videoMap),
      product: remapSections(content.templates.product, images, videoMap),
    },
  }
}
