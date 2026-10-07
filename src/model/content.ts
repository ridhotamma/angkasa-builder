/**
 * What a theme and a page actually store.
 *
 * A theme is its settings, its header and footer (`layout`), and one ordered
 * list of sections per page type it designs — the home page, the product page
 * and the article page. `templates` is a map so collection and search
 * templates can be more keys later.
 *
 * Both are stored as JSON strings (`contentJson`, `draftJson`,
 * `publishedJson`) and every path in or out goes through `sanitize*` below:
 * the server before it writes, the renderer before it draws. Nothing reads a
 * stored layout raw.
 */

import { isStockPhoto } from '@repo/appwrite-config'

import { findBlock, updateBlockSettings } from './blocks'
import {
  collectFieldValues,
  defaultValues,
  isMediaFileId,
  isRecord,
  mapFieldValues,
  newId,
  sanitizeValues,
  type Field,
  type FieldValues,
  type JsonValue,
} from './fields'
import { sanitizeElements } from './element-style'
import { sanitizeLayout, type ThemeLayout } from './layout'
import { SECTION_STYLE_FIELDS } from './section-style'
import {
  isSectionAllowed,
  isSectionType,
  sectionSchema,
  type SectionScope,
  type SectionType,
} from './sections'
import { isLookKey } from './looks'
import { DEFAULT_THEME_SETTINGS, sanitizeThemeSettings, type ThemeSettings } from './settings'

/** Bumped when the stored shape changes in a way a reader must know about. */
export const CONTENT_VERSION = 1

/** Enough for a long landing page; a hundred sections is a mistake, not a design. */
export const MAX_SECTIONS = 40

/** A template suggests at most a few starting looks; more is a catalogue, not a suggestion. */
export const MAX_RECOMMENDED_LOOKS = 6

/**
 * A template's suggested starting looks, as LOOKS keys. Unknown keys are
 * dropped rather than rejected, like unknown sections: a layout saved by a
 * newer release, read by an older one mid-deploy, keeps what it recognises.
 */
export function sanitizeRecommendedLooks(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const key of value) {
    if (out.length >= MAX_RECOMMENDED_LOOKS) break
    if (!isLookKey(key) || seen.has(key)) continue
    seen.add(key)
    out.push(key)
  }
  return out
}

/** The ceiling the schema's string columns are sized for. */
export const MAX_CONTENT_BYTES = 200_000

/**
 * The field kinds a linked copy may set for itself: content, never structure.
 * A copy can say its own words, show its own photo, point its own link — it
 * cannot rearrange the component, resize it or change what it is.
 */
export const OVERRIDABLE_KINDS = ['text', 'textarea', 'richtext', 'image', 'link'] as const

export function isOverridableField(field: Field): boolean {
  return (OVERRIDABLE_KINDS as readonly string[]).includes(field.kind)
}

/** The fields of a section or block schema a linked copy may override. */
export function overridableFields(fields: readonly Field[]): Field[] {
  return fields.filter(isOverridableField)
}

/**
 * A linked copy's per-instance values, sparse: a key present means "this copy
 * says something else", an absent key inherits the original. Only overridable
 * kinds are kept; everything else is dropped by the sanitiser.
 */
export interface SectionOverrides {
  /** Top-level fields, by key. */
  fields?: FieldValues
  /** Block fields, by block id then field key. */
  blocks?: Record<string, FieldValues>
}

export interface SectionInstance {
  id: string
  type: SectionType
  hidden: boolean
  settings: FieldValues
  /** Colour scheme, spacing, width, devices and dates — see `./section-style`. */
  style: FieldValues
  /**
   * Per-element overrides, keyed by the element's own id — a button the
   * seller clicked in the preview and restyled. Absent until one is set, so
   * a layout that never touched one reads exactly as before. See
   * `./element-style`.
   */
  elements?: Record<string, FieldValues>
  /**
   * The section this one is a linked copy of — a reusable component. The copy
   * draws the original's type, settings, style and element overrides, and
   * keeps only its own id and hidden flag; editing the original updates every
   * copy. Absent on an ordinary section, so an unlinked layout reads exactly
   * as before.
   */
  linkedTo?: string
  /**
   * What this copy says differently from its original — a title, a photo, a
   * link. Absent until one is set, and only on a linked copy.
   */
  overrides?: SectionOverrides
}

export const TEMPLATE_KEYS = ['home', 'product', 'article'] as const
export type TemplateKey = (typeof TEMPLATE_KEYS)[number]

export const TEMPLATE_SCOPES: Record<TemplateKey, SectionScope> = {
  home: 'home',
  product: 'product',
  article: 'article',
}

export interface ThemeContent {
  version: number
  settings: ThemeSettings
  layout: ThemeLayout
  templates: Record<TemplateKey, SectionInstance[]>
  /**
   * Template metadata, not shop data: the looks a template suggests a new
   * shop starts from. An installed shop theme inherits its template's
   * suggestions; applying a look never touches them.
   */
  recommendedLooks: string[]
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
export function moveSection(
  sections: SectionInstance[],
  id: string,
  by: number,
): SectionInstance[] {
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

    const elements = sanitizeElements(raw.elements)
    const linkedTo =
      typeof raw.linkedTo === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(raw.linkedTo)
        ? raw.linkedTo
        : undefined
    const overrides = sanitizeOverrideShape(raw.overrides)
    out.push({
      id,
      type: raw.type,
      hidden: raw.hidden === true,
      settings: sanitizeValues(schema.fields, raw.settings),
      style: sanitizeValues(SECTION_STYLE_FIELDS, raw.style),
      ...(Object.keys(elements).length > 0 && { elements }),
      ...(linkedTo && { linkedTo }),
      ...(overrides && { overrides }),
    })
  }

  // A link that points at nothing — a deleted original, a self-link, a chain
  // that loops — is cleared rather than kept: the section stays as an
  // ordinary copy instead of rendering something that is not there. A copy's
  // overrides are then checked against the original's schema, so an override
  // of a field that no longer exists falls away with it.
  const byId = new Map(out.map((section) => [section.id, section]))
  return out.map((section) => {
    if (!section.linkedTo) return section.overrides ? withoutLink(section) : section
    const master = linkedMasterOf(section.linkedTo, byId)
    if (!master) return withoutLink(section)
    const overrides = sanitizeInstanceOverrides(section.overrides, master)
    const { overrides: _cleared, ...rest } = section
    return overrides ? { ...rest, overrides } : rest
  })
}

/** The raw shape of a copy's overrides: unknown keys and non-JSON values dropped. */
function sanitizeOverrideShape(value: unknown): SectionOverrides | undefined {
  if (!isRecord(value)) return undefined
  const out: SectionOverrides = {}
  if (isRecord(value.fields)) {
    const fields = cleanOverrideKeys(value.fields)
    if (fields) out.fields = fields
  }
  if (isRecord(value.blocks)) {
    const blocks: Record<string, FieldValues> = {}
    for (const [blockId, entry] of Object.entries(value.blocks)) {
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(blockId) || !isRecord(entry)) continue
      const fields = cleanOverrideKeys(entry)
      if (fields) blocks[blockId] = fields
    }
    if (Object.keys(blocks).length > 0) out.blocks = blocks
  }
  return Object.keys(out).length > 0 ? out : undefined
}

const OVERRIDE_KEY = /^[A-Za-z0-9_.-]{1,80}$/

function cleanOverrideKeys(value: Record<string, unknown>): FieldValues | undefined {
  const out: FieldValues = {}
  for (const [key, entry] of Object.entries(value)) {
    if (!OVERRIDE_KEY.test(key) || entry === undefined) continue
    out[key] = entry as JsonValue
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/** A copy's overrides against the original's schema: overridable fields only, sanitised. */
function sanitizeInstanceOverrides(
  raw: SectionOverrides | undefined,
  master: SectionInstance,
): SectionOverrides | undefined {
  if (!raw) return undefined
  const schema = sectionSchema(master.type)
  if (!schema) return undefined
  const out: SectionOverrides = {}
  if (raw.fields) {
    const fields = cleanOverrideValues(schema.fields, raw.fields)
    if (fields) out.fields = fields
  }
  if (raw.blocks) {
    const blocks: Record<string, FieldValues> = {}
    for (const [blockId, values] of Object.entries(raw.blocks)) {
      const found = findBlock(schema.fields, master.settings, blockId)
      if (!found) continue
      const clean = cleanOverrideValues(found.schema.fields, values)
      if (clean) blocks[blockId] = clean
    }
    if (Object.keys(blocks).length > 0) out.blocks = blocks
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/** The overridable values present in `values`, each sanitised by its own field. */
function cleanOverrideValues(
  fields: readonly Field[],
  values: FieldValues,
): FieldValues | undefined {
  const out: FieldValues = {}
  for (const field of fields) {
    if (!isOverridableField(field) || !(field.key in values)) continue
    out[field.key] = sanitizeValues([field], values)[field.key]!
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/* -------------------------------------------------------------------------- */
/* Linked sections                                                            */
/* -------------------------------------------------------------------------- */

/** The original behind `linkedTo`, following any chain; `null` when it breaks. */
function linkedMasterOf(
  linkedTo: string,
  byId: ReadonlyMap<string, SectionInstance>,
): SectionInstance | null {
  let current = byId.get(linkedTo)
  const seen = new Set<string>()
  while (current) {
    if (seen.has(current.id)) return null
    seen.add(current.id)
    if (!current.linkedTo) return current
    current = byId.get(current.linkedTo)
  }
  return null
}

/** `section` without its link or overrides, for detaching and clearing a broken one. */
function withoutLink(section: SectionInstance): SectionInstance {
  const { linkedTo: _cleared, overrides: _dropped, ...rest } = section
  return rest
}

/** The original a linked copy draws from, or `null` for an ordinary section. */
export function linkedMaster(
  section: SectionInstance,
  sections: readonly SectionInstance[],
): SectionInstance | null {
  if (!section.linkedTo) return null
  return linkedMasterOf(section.linkedTo, new Map(sections.map((other) => [other.id, other])))
}

/**
 * A section list with every linked copy resolved to its original's type,
 * settings, style and element overrides, with the copy's own content
 * overrides layered on top. The copy keeps its own id, hidden flag, link and
 * overrides, so the editor can still select, detach and reset it; an ordinary
 * section is returned untouched.
 */
export function resolveLinkedSections(sections: readonly SectionInstance[]): SectionInstance[] {
  const byId = new Map(sections.map((section) => [section.id, section]))
  return sections.map((section) => {
    if (!section.linkedTo) return section
    const master = linkedMasterOf(section.linkedTo, byId)
    if (!master) return section
    return {
      ...structuredClone(master),
      id: section.id,
      hidden: section.hidden,
      linkedTo: section.linkedTo,
      settings: mergeOverrides(master, section.overrides),
      ...(section.overrides && { overrides: structuredClone(section.overrides) }),
    }
  })
}

/** The original's settings with a copy's overrides layered on top. */
function mergeOverrides(
  master: SectionInstance,
  overrides: SectionOverrides | undefined,
): FieldValues {
  if (!overrides) return { ...master.settings }
  let settings: FieldValues = { ...master.settings }
  if (overrides.fields) settings = { ...settings, ...overrides.fields }
  if (overrides.blocks) {
    const schema = sectionSchema(master.type)
    if (schema) {
      for (const [blockId, values] of Object.entries(overrides.blocks)) {
        const found = findBlock(schema.fields, settings, blockId)
        if (!found) continue
        const next = updateBlockSettings(schema.fields, settings, blockId, {
          ...found.block.settings,
          ...values,
        })
        if (next) settings = next
      }
    }
  }
  return settings
}

/** How many sections in the list are copies of `id`. */
export function linkedCopyCount(sections: readonly SectionInstance[], id: string): number {
  return sections.filter((section) => section.linkedTo === id).length
}

/**
 * `sections` with a linked copy of `id` beside it — the copy draws from the
 * same original, whether `id` is itself a copy or an original. `null` when
 * another copy does not fit.
 */
export function duplicateLinkedSection(
  sections: SectionInstance[],
  id: string,
): { sections: SectionInstance[]; copy: SectionInstance } | null {
  if (!canDuplicateSection(sections, id)) return null
  const index = sections.findIndex((section) => section.id === id)
  const source = sections[index]!
  const copy: SectionInstance = {
    ...structuredClone(source),
    id: newId(),
    linkedTo: source.linkedTo ?? source.id,
  }
  const next = [...sections]
  next.splice(index + 1, 0, copy)
  return { sections: next, copy }
}

/**
 * `sections` with the linked copy `id` detached: the original's content is
 * copied in and the link is dropped, so it can be edited on its own.
 */
export function detachSection(sections: SectionInstance[], id: string): SectionInstance[] {
  const index = sections.findIndex((section) => section.id === id)
  const section = sections[index]
  if (!section?.linkedTo) return sections
  const master = linkedMaster(section, sections)
  if (!master) return sections
  const next = [...sections]
  next[index] = {
    ...structuredClone(master),
    id: section.id,
    hidden: section.hidden,
    settings: mergeOverrides(master, section.overrides),
  }
  return next
}

/**
 * `sections` with `id` removed. Every linked copy of it is detached first —
 * deleting an original should not silently empty its copies.
 */
export function removeSection(sections: SectionInstance[], id: string): SectionInstance[] {
  return sections
    .map((section) => {
      if (section.linkedTo !== id) return section
      const master = linkedMaster(section, sections)
      if (!master) return withoutLink(section)
      return {
        ...structuredClone(master),
        id: section.id,
        hidden: section.hidden,
        settings: mergeOverrides(master, section.overrides),
      }
    })
    .filter((section) => section.id !== id)
}

/* -------------------------------------------------------------------------- */
/* Per-instance overrides                                                     */
/* -------------------------------------------------------------------------- */

/** A single override to drop: a top-level field, a block's field, or a whole block. */
export type OverrideTarget = { field: string } | { blockId: string; field?: string }

/** `sections` with `instanceId`'s overrides replaced; empty maps are dropped. */
function replaceOverrides(
  sections: SectionInstance[],
  instanceId: string,
  overrides: SectionOverrides,
): SectionInstance[] {
  const clean: SectionOverrides = {}
  if (overrides.fields && Object.keys(overrides.fields).length > 0) clean.fields = overrides.fields
  if (overrides.blocks) {
    const blocks: Record<string, FieldValues> = {}
    for (const [blockId, values] of Object.entries(overrides.blocks)) {
      if (Object.keys(values).length > 0) blocks[blockId] = values
    }
    if (Object.keys(blocks).length > 0) clean.blocks = blocks
  }
  return sections.map((section) => {
    if (section.id !== instanceId) return section
    const { overrides: _current, ...rest } = section
    return Object.keys(clean).length > 0 ? { ...rest, overrides: clean } : rest
  })
}

/** The copy and the original it edits through, or `null` for an ordinary section. */
function copyAndMaster(
  sections: readonly SectionInstance[],
  instanceId: string,
): { instance: SectionInstance; master: SectionInstance } | null {
  const instance = sections.find((section) => section.id === instanceId)
  const master = instance?.linkedTo ? linkedMaster(instance, sections) : null
  return instance && master ? { instance, master } : null
}

/**
 * A copy's top-level content, edited in the panel: every overridable field
 * whose value differs from the original becomes an override, and one set back
 * to the original's value stops being an override.
 */
export function setSectionOverrides(
  sections: SectionInstance[],
  instanceId: string,
  values: FieldValues,
): SectionInstance[] {
  const pair = copyAndMaster(sections, instanceId)
  if (!pair) return sections
  const schema = sectionSchema(pair.master.type)
  if (!schema) return sections
  const fields: FieldValues = { ...(pair.instance.overrides?.fields ?? {}) }
  for (const field of overridableFields(schema.fields)) {
    if (!(field.key in values)) continue
    const value = sanitizeValues([field], values)[field.key]!
    if (JSON.stringify(value) === JSON.stringify(pair.master.settings[field.key])) {
      delete fields[field.key]
    } else {
      fields[field.key] = value
    }
  }
  return replaceOverrides(sections, instanceId, { ...pair.instance.overrides, fields })
}

/**
 * A copy's block content, edited in the panel or typed on the canvas: the
 * overridable values become the copy's own, and anything structural (a
 * layout, a list, a tone) updates the original so every copy follows.
 */
export function setBlockOverrides(
  sections: SectionInstance[],
  instanceId: string,
  blockId: string,
  values: FieldValues,
): SectionInstance[] {
  const pair = copyAndMaster(sections, instanceId)
  if (!pair) return sections
  const schema = sectionSchema(pair.master.type)
  if (!schema) return sections
  const resolved = mergeOverrides(pair.master, pair.instance.overrides)
  const found = findBlock(schema.fields, resolved, blockId)
  const original = findBlock(schema.fields, pair.master.settings, blockId)
  if (!found) return sections

  const blockOverrides: FieldValues = { ...(pair.instance.overrides?.blocks?.[blockId] ?? {}) }
  const masterChanges: FieldValues = {}
  for (const field of found.schema.fields) {
    if (!(field.key in values)) continue
    const value = sanitizeValues([field], values)[field.key]!
    if (isOverridableField(field)) {
      if (JSON.stringify(value) === JSON.stringify(original?.block.settings[field.key])) {
        delete blockOverrides[field.key]
      } else {
        blockOverrides[field.key] = value
      }
    } else {
      masterChanges[field.key] = value
    }
  }

  let next = sections
  if (Object.keys(masterChanges).length > 0) {
    const settings = updateBlockSettings(schema.fields, pair.master.settings, blockId, {
      ...found.block.settings,
      ...masterChanges,
    })
    if (settings) {
      next = next.map((section) =>
        section.id === pair.master.id ? { ...section, settings } : section,
      )
    }
  }
  return replaceOverrides(next, instanceId, {
    ...pair.instance.overrides,
    blocks: { ...(pair.instance.overrides?.blocks ?? {}), [blockId]: blockOverrides },
  })
}

/** `sections` with one override dropped, or all of them when no target is given. */
export function clearOverrides(
  sections: SectionInstance[],
  instanceId: string,
  target?: OverrideTarget,
): SectionInstance[] {
  const pair = copyAndMaster(sections, instanceId)
  if (!pair?.instance.overrides) return sections
  if (!target) return replaceOverrides(sections, instanceId, {})
  const overrides: SectionOverrides = structuredClone(pair.instance.overrides)
  if ('blockId' in target) {
    if (!target.field) {
      delete overrides.blocks?.[target.blockId]
    } else {
      const block = overrides.blocks?.[target.blockId]
      if (block) {
        delete block[target.field]
        if (Object.keys(block).length === 0) delete overrides.blocks![target.blockId]
      }
    }
  } else {
    delete overrides.fields?.[target.field]
  }
  return replaceOverrides(sections, instanceId, overrides)
}

/**
 * A linked copy edited as a whole section — by the AI, or by a host that
 * rebuilt it. The overridable values the edit changed stay on the copy; every
 * structural change, and the style and element overrides, update the original
 * so all copies follow.
 */
export function applyInstanceEdit(
  sections: SectionInstance[],
  instanceId: string,
  edited: SectionInstance,
): SectionInstance[] {
  const pair = copyAndMaster(sections, instanceId)
  if (!pair) return sections
  const schema = sectionSchema(pair.master.type)
  if (!schema) return sections
  const resolved = mergeOverrides(pair.master, pair.instance.overrides)

  const masterSettings: FieldValues = { ...pair.master.settings }
  const fields: FieldValues = { ...(pair.instance.overrides?.fields ?? {}) }
  for (const field of schema.fields) {
    const next = edited.settings[field.key]
    if (next === undefined) continue
    if (JSON.stringify(next) === JSON.stringify(resolved[field.key])) continue
    if (isOverridableField(field)) {
      if (JSON.stringify(next) === JSON.stringify(pair.master.settings[field.key])) {
        delete fields[field.key]
      } else {
        fields[field.key] = next
      }
    } else {
      masterSettings[field.key] = next
    }
  }

  const style: FieldValues = { ...pair.master.style }
  for (const [key, value] of Object.entries(edited.style)) {
    if (JSON.stringify(value) !== JSON.stringify(pair.master.style[key])) style[key] = value
  }

  const elements = edited.elements
    ? { ...(pair.master.elements ?? {}), ...edited.elements }
    : pair.master.elements

  const next = sections.map((section) =>
    section.id === pair.master.id
      ? { ...section, settings: masterSettings, style, ...(elements && { elements }) }
      : section,
  )
  return replaceOverrides(next, instanceId, { ...pair.instance.overrides, fields })
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

/** The article page every theme starts with — and the one a theme without its own gets. */
export function defaultArticleTemplate(): SectionInstance[] {
  return [
    createSection('article-header'),
    createSection('article-content'),
    createSection('article-share'),
    createSection('article-pagination'),
    createSection('related-articles'),
  ]
}

/**
 * The article page template, cleaned. Its header and its content slot are
 * required, like the product page's buy box: a theme saved before article
 * templates existed gets the default page, and one missing either section by
 * hand gets it back — the header at the top, the content right after it.
 */
export function sanitizeArticleTemplate(value: unknown): SectionInstance[] {
  if (!Array.isArray(value) || value.length === 0) return defaultArticleTemplate()
  let sections = sanitizeSections(value, 'article')
  const has = (type: SectionType) => sections.some((section) => section.type === type)
  if (!has('article-header')) sections = [createSection('article-header'), ...sections]
  if (!has('article-content')) {
    const at = sections.findIndex((section) => section.type === 'article-header') + 1
    sections = [...sections.slice(0, at), createSection('article-content'), ...sections.slice(at)]
  }
  if (sections.length <= MAX_SECTIONS) return sections
  // Over the cap after the repair: drop from the end, never a required section.
  const required = new Set<string>(['article-header', 'article-content'])
  const optional = sections.filter((section) => !required.has(section.type))
  const keep = new Set(optional.slice(0, MAX_SECTIONS - 2).map((section) => section.id))
  return sections.filter((section) => required.has(section.type) || keep.has(section.id))
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
      article: sanitizeArticleTemplate(templates.article),
    },
    recommendedLooks: sanitizeRecommendedLooks(source.recommendedLooks),
  }
}

/**
 * A stored theme's recommended looks without the cost of a full sanitize —
 * for list screens that draw the summary, not the layout.
 */
export function peekRecommendedLooks(json: string | null | undefined): string[] {
  if (!json) return []
  try {
    const value: unknown = JSON.parse(json)
    return sanitizeRecommendedLooks(isRecord(value) ? value.recommendedLooks : [])
  } catch {
    return []
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
  templates: { home: [], product: [], article: [] },
  recommendedLooks: [],
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
    // A hotlinked stock photo is not a file in the shop's bucket, so it has
    // nothing to copy and must not be read as an id.
    if (isMediaFileId(value)) ids.add(value)
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

/** Every voucher a layout picks by id, so the storefront can read them alongside the page. */
export function voucherIds(sections: readonly SectionInstance[]): string[] {
  const ids = new Set<string>()
  for (const value of sectionValues(sections, ['voucher'])) {
    if (typeof value === 'string' && value) ids.add(value)
  }
  return [...ids]
}

/** How many best sellers a category row previews in the category rail's list layout. */
export const CATEGORY_PREVIEW_PRODUCTS = 4

/**
 * How many categories need their best sellers read beside the page: the
 * largest `limit` among category rails drawn as a list, or 0 when none is —
 * so a page without one reads nothing extra.
 */
export function categoryPreviewCount(sections: readonly SectionInstance[]): number {
  let count = 0
  for (const section of sections) {
    if (section.type !== 'category-rail' || section.settings.layout !== 'list') continue
    const limit = section.settings.limit
    count = Math.max(count, typeof limit === 'number' ? limit : 12)
  }
  return count
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
  const swapImage = (id: JsonValue): JsonValue => {
    if (typeof id !== 'string' || !id) return id
    const copy = images.get(id)
    if (copy) return copy
    // A stock photo is not a bucket file: it survives a copy untouched.
    return isStockPhoto(id) ? id : ''
  }
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
      article: remapSections(content.templates.article, images, videoMap),
    },
  }
}
