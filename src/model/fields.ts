/**
 * A section's settings, described as data.
 *
 * One description serves three readers: the editor renders a control per
 * field, the server sanitises a saved layout against it, and the renderer
 * reads values that are guaranteed to have the declared shape. Keeping those
 * three in one list is what makes adding a section a single-file change.
 *
 * Sanitising is lenient per field — an out-of-range number becomes its
 * default, an unknown key is dropped — so a layout saved by an older release
 * still renders, and a hand-crafted payload can only ever produce a valid one.
 */

import { sanitizeLink, NO_LINK, type Link } from './links'
import { EMPTY_RICH_DOC, sanitizeRichDoc, type RichDoc } from './rich-text'
import type { Localized } from './localized'

interface BaseField {
  key: string
  label: Localized
  help?: Localized
  /**
   * Show the control only while a sibling field holds one of these values —
   * e.g. a marquee's direction only under the running-cards layout. Editor
   * only: the value is still stored and sanitised, so switching back restores
   * what the seller had chosen.
   */
  showWhen?: { key: string; is: readonly string[] }
}

/** Whether a field's control belongs on screen, given its siblings' values. */
export function isFieldShown(field: { showWhen?: BaseField['showWhen'] }, values: FieldValues) {
  if (!field.showWhen) return true
  const raw = values[field.showWhen.key]
  // A switch reads as `'true'` / `'false'`, so a field can follow one too.
  const current = typeof raw === 'boolean' ? String(raw) : raw
  return typeof current === 'string' && field.showWhen.is.includes(current)
}

export interface TextField extends BaseField {
  kind: 'text'
  max: number
  default: string
  placeholder?: Localized
}

export interface TextareaField extends BaseField {
  kind: 'textarea'
  max: number
  default: string
  rows?: number
  placeholder?: Localized
}

/**
 * Formatted text, stored as a document tree (see `./rich-text`). `max` counts
 * characters of text, not of the stored JSON. `default` is plain text, and so
 * is any value saved before the field could be formatted.
 */
export interface RichTextField extends BaseField {
  kind: 'richtext'
  max: number
  default: string
}

export interface NumberField extends BaseField {
  kind: 'number'
  min: number
  max: number
  step?: number
  default: number
}

export interface SelectField extends BaseField {
  kind: 'select'
  options: ReadonlyArray<{ value: string; label: Localized }>
  default: string
}

export interface BooleanField extends BaseField {
  kind: 'boolean'
  default: boolean
}

/** An opaque colour as `#rrggbb` — the only shape a stored colour may take. */
export interface ColorField extends BaseField {
  kind: 'color'
  default: string
}

/** A media file id in the shop's own bucket — never a URL. */
export interface ImageField extends BaseField {
  kind: 'image'
}

/** A reference to one of the shop's collections or categories, by id. */
export interface ReferenceField extends BaseField {
  kind: 'collection' | 'category'
  /** Shown when nothing is picked, e.g. "first collection". */
  emptyLabel?: Localized
}

export interface LinkField extends BaseField {
  kind: 'link'
}

/**
 * A video: an upload in the shop's video bucket, or a YouTube or Vimeo video
 * by its id. Never a URL — the embed and file URLs are built by the renderer,
 * so a stored value cannot point a `<video>` or `<iframe>` anywhere else.
 */
export interface VideoField extends BaseField {
  kind: 'video'
  /** Background videos need a file the page controls; embeds cannot loop silently. */
  uploadOnly?: boolean
}

/** One of the shop's products, by id. */
export interface ProductField extends BaseField {
  kind: 'product'
}

/** A moment in time, stored as an ISO string; empty for "not set". */
export interface DateTimeField extends BaseField {
  kind: 'datetime'
}

/** A grid of short text cells with a header row — a comparison or size table. */
export interface TableField extends BaseField {
  kind: 'table'
  maxColumns: number
  maxRows: number
}

/**
 * A spot on an image, as percentages from its top-left corner. `imageKey`
 * names the image field on the *parent* the spot is placed on, so a hotspot
 * list item can be positioned by clicking the section's image.
 */
export interface PointField extends BaseField {
  kind: 'point'
  imageKey: string
}

export type ItemField =
  | TextField
  | TextareaField
  | RichTextField
  | NumberField
  | SelectField
  | BooleanField
  | ColorField
  | ImageField
  | LinkField
  | VideoField
  | ProductField
  | DateTimeField
  | TableField
  | PointField
  | ReferenceField

export interface ListField extends BaseField {
  kind: 'list'
  itemLabel: Localized
  /** Which item field names an item in the editor's collapsed row. */
  titleKey: string
  max: number
  fields: readonly ItemField[]
}

/** One kind of block a `blocks` field can hold. */
export interface BlockSchema {
  type: string
  name: Localized
  /** At most this many of this block in one field; unlimited when omitted. */
  max?: number
  fields: readonly (ItemField | ListField)[]
}

/**
 * An ordered list of typed blocks — Shopify's blocks inside a section. Unlike
 * a `list`, every item picks its own type, and each type has its own fields.
 * Stored as `{ id, type, settings }`; an unknown type is dropped on read.
 */
export interface BlocksField extends BaseField {
  kind: 'blocks'
  max: number
  blocks: readonly BlockSchema[]
  /** What a freshly added section starts with, by block type. */
  defaultBlocks?: readonly string[]
}

export type Field = ItemField | ListField | BlocksField

/** Anything a stored setting can be: plain JSON, so it survives storage and the wire. */
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export type FieldValues = { [key: string]: JsonValue }

const ID = /^[A-Za-z0-9_-]{1,64}$/
const HEX_COLOR = /^#[0-9a-f]{6}$/i

function text(value: unknown, max: number, fallback: string): string {
  return typeof value === 'string' ? value.slice(0, max) : fallback
}

/* -------------------------------------------------------------------------- */
/* Videos                                                                     */
/* -------------------------------------------------------------------------- */

export const VIDEO_SOURCES = ['upload', 'youtube', 'vimeo'] as const
export type VideoSource = (typeof VIDEO_SOURCES)[number]

export interface VideoRef {
  source: VideoSource
  /** A file id for an upload; the platform's own video id for an embed. */
  id: string
}

/** The id shapes each source uses. A YouTube id is 11 URL-safe characters, Vimeo's is digits. */
const VIDEO_ID: Record<VideoSource, RegExp> = {
  upload: ID,
  youtube: /^[A-Za-z0-9_-]{11}$/,
  vimeo: /^\d{1,12}$/,
}

export function sanitizeVideo(value: unknown, uploadOnly = false): VideoRef | null {
  if (!isRecord(value)) return null
  const source = value.source
  const id = value.id
  if (typeof source !== 'string' || typeof id !== 'string') return null
  if (!(VIDEO_SOURCES as readonly string[]).includes(source)) return null
  if (uploadOnly && source !== 'upload') return null
  return VIDEO_ID[source as VideoSource].test(id) ? { source: source as VideoSource, id } : null
}

/**
 * A pasted YouTube or Vimeo address, as a video reference — or `null` when it
 * is neither. Only the id is kept; the address itself is thrown away.
 */
export function parseVideoUrl(input: string): VideoRef | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  const host = url.hostname.replace(/^(www|m)\./, '')
  const path = url.pathname.split('/').filter(Boolean)

  let youtube: string | null = null
  if (host === 'youtu.be') youtube = path[0] ?? null
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    youtube =
      url.searchParams.get('v') ??
      (['embed', 'shorts', 'live', 'v'].includes(path[0] ?? '') ? (path[1] ?? null) : null)
  }
  if (youtube) return sanitizeVideo({ source: 'youtube', id: youtube })

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = [...path].reverse().find((part) => /^\d+$/.test(part))
    return id ? sanitizeVideo({ source: 'vimeo', id }) : null
  }
  return null
}

/* -------------------------------------------------------------------------- */
/* Tables                                                                     */
/* -------------------------------------------------------------------------- */

export interface TableValue {
  /** The header row. */
  columns: string[]
  /** Body rows, each exactly as wide as `columns`. */
  rows: string[][]
}

export const MAX_TABLE_CELL = 80

export const EMPTY_TABLE: TableValue = { columns: ['', ''], rows: [['', '']] }

/**
 * A stored table, cleaned: at least one column, cells trimmed to size, and
 * every row padded or cut to the header's width so a renderer never meets a
 * ragged grid.
 */
export function sanitizeTable(value: unknown, maxColumns: number, maxRows: number): TableValue {
  const cell = (raw: unknown) => (typeof raw === 'string' ? raw.slice(0, MAX_TABLE_CELL) : '')
  const source = isRecord(value) ? value : {}
  const columns = (Array.isArray(source.columns) ? source.columns : [])
    .slice(0, maxColumns)
    .map(cell)
  if (columns.length === 0) return structuredClone(EMPTY_TABLE)
  const rows = (Array.isArray(source.rows) ? source.rows : [])
    .slice(0, maxRows)
    .filter(Array.isArray)
    .map((row) => columns.map((_, index) => cell((row as unknown[])[index])))
  return { columns, rows }
}

/* -------------------------------------------------------------------------- */
/* Points                                                                     */
/* -------------------------------------------------------------------------- */

export interface PointValue {
  /** Percent of the image's width, 0–100. */
  x: number
  /** Percent of the image's height, 0–100. */
  y: number
}

function sanitizePoint(value: unknown): PointValue {
  const coordinate = (raw: unknown) =>
    typeof raw === 'number' && Number.isFinite(raw)
      ? Math.round(Math.min(100, Math.max(0, raw)) * 10) / 10
      : 50
  const source = isRecord(value) ? value : {}
  return { x: coordinate(source.x), y: coordinate(source.y) }
}

/* -------------------------------------------------------------------------- */
/* Blocks                                                                     */
/* -------------------------------------------------------------------------- */

export interface BlockValue {
  id: string
  type: string
  settings: FieldValues
}

function sanitizeBlocks(field: BlocksField, value: unknown): BlockValue[] {
  if (!Array.isArray(value)) {
    return (field.defaultBlocks ?? []).flatMap((type) => {
      const schema = field.blocks.find((block) => block.type === type)
      return schema ? [{ id: newId(), type, settings: defaultValues(schema.fields) }] : []
    })
  }
  const counts = new Map<string, number>()
  const seen = new Set<string>()
  const out: BlockValue[] = []
  for (const raw of value) {
    if (out.length >= field.max) break
    if (!isRecord(raw) || typeof raw.type !== 'string') continue
    const schema = field.blocks.find((block) => block.type === raw.type)
    if (!schema) continue
    const count = counts.get(schema.type) ?? 0
    if (schema.max !== undefined && count >= schema.max) continue
    counts.set(schema.type, count + 1)
    let id = typeof raw.id === 'string' && ID.test(raw.id) ? raw.id : newId()
    if (seen.has(id)) id = newId()
    seen.add(id)
    out.push({ id, type: schema.type, settings: sanitizeValues(schema.fields, raw.settings) })
  }
  return out
}

/** A new block of `type`, with its fields at their defaults. */
export function createBlock(field: BlocksField, type: string): BlockValue | null {
  const schema = field.blocks.find((block) => block.type === type)
  return schema ? { id: newId(), type, settings: defaultValues(schema.fields) } : null
}

/** Whether another block of `type` fits in `blocks`. */
export function canAddBlock(field: BlocksField, blocks: readonly BlockValue[], type: string) {
  if (blocks.length >= field.max) return false
  const schema = field.blocks.find((block) => block.type === type)
  if (!schema) return false
  return schema.max === undefined || blocks.filter((b) => b.type === type).length < schema.max
}

function sanitizeField(field: Field, value: unknown): JsonValue {
  switch (field.kind) {
    case 'text':
    case 'textarea':
      return text(value, field.max, field.default)
    case 'richtext':
      return sanitizeRichDoc(value ?? field.default, field.max) as unknown as JsonValue
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return field.default
      if (value < field.min || value > field.max) return field.default
      return field.step && field.step < 1 ? value : Math.round(value)
    }
    case 'select':
      return field.options.some((option) => option.value === value)
        ? (value as string)
        : field.default
    case 'boolean':
      return typeof value === 'boolean' ? value : field.default
    // A colour ends up inside a CSS value, so nothing but a hex code gets through.
    case 'color':
      return typeof value === 'string' && HEX_COLOR.test(value)
        ? value.toLowerCase()
        : field.default
    case 'image':
    case 'collection':
    case 'category':
    case 'product':
      return typeof value === 'string' && ID.test(value) ? value : ''
    case 'link':
      return sanitizeLink(value)
    case 'video':
      return sanitizeVideo(value, field.uploadOnly) as unknown as JsonValue
    case 'datetime': {
      if (typeof value !== 'string' || !value) return ''
      const time = Date.parse(value)
      return Number.isFinite(time) ? new Date(time).toISOString() : ''
    }
    case 'table':
      return sanitizeTable(value, field.maxColumns, field.maxRows) as unknown as JsonValue
    case 'point':
      return sanitizePoint(value) as unknown as JsonValue
    case 'blocks':
      return sanitizeBlocks(field, value) as unknown as JsonValue
    case 'list': {
      if (!Array.isArray(value)) return []
      return value.slice(0, field.max).map((item): FieldValues => ({
        id: isRecord(item) && typeof item.id === 'string' && ID.test(item.id) ? item.id : newId(),
        ...sanitizeValues(field.fields, isRecord(item) ? item : {}),
      }))
    }
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Every declared field, sanitised; every undeclared key, dropped. */
export function sanitizeValues(fields: readonly Field[], values: unknown): FieldValues {
  const source = isRecord(values) ? values : {}
  const out: FieldValues = {}
  for (const field of fields) out[field.key] = sanitizeField(field, source[field.key])
  return out
}

/** The value a freshly added field starts with. */
export function defaultValues(fields: readonly Field[]): FieldValues {
  return sanitizeValues(fields, {})
}

/** A short random id for sections and list items. Not a security token. */
export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

/* Typed readers for renderers, which receive already-sanitised values. */

export function readText(values: FieldValues, key: string): string {
  const value = values[key]
  return typeof value === 'string' ? value : ''
}

export function readRichText(values: FieldValues, key: string): RichDoc {
  const value = values[key]
  return isRecord(value) && value.type === 'doc' ? (value as unknown as RichDoc) : EMPTY_RICH_DOC
}

export function readNumber(values: FieldValues, key: string, fallback: number): number {
  const value = values[key]
  return typeof value === 'number' ? value : fallback
}

export function readBoolean(values: FieldValues, key: string): boolean {
  return values[key] === true
}

export function readLink(values: FieldValues, key: string): Link {
  const value = values[key]
  return isRecord(value) && typeof value.kind === 'string' ? (value as unknown as Link) : NO_LINK
}

export function readList(values: FieldValues, key: string): Array<FieldValues & { id: string }> {
  const value = values[key]
  return Array.isArray(value) ? (value as Array<FieldValues & { id: string }>) : []
}

export function readVideo(values: FieldValues, key: string): VideoRef | null {
  return sanitizeVideo(values[key])
}

export function readTable(values: FieldValues, key: string): TableValue {
  const value = values[key]
  return isRecord(value) && Array.isArray(value.columns)
    ? (value as unknown as TableValue)
    : EMPTY_TABLE
}

export function readPoint(values: FieldValues, key: string): PointValue {
  return sanitizePoint(values[key])
}

export function readBlocks(values: FieldValues, key: string): BlockValue[] {
  const value = values[key]
  return Array.isArray(value) ? (value as unknown as BlockValue[]) : []
}

/** A stored moment, or `null` when unset. */
export function readDate(values: FieldValues, key: string): Date | null {
  const value = values[key]
  if (typeof value !== 'string' || !value) return null
  const time = Date.parse(value)
  return Number.isFinite(time) ? new Date(time) : null
}

/* -------------------------------------------------------------------------- */
/* Walking stored values                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Every place in `values` a field of one of `kinds` holds a value, however
 * deep — inside list items and blocks too. Used to find the media files and
 * products a layout refers to without each caller re-implementing the walk.
 */
export function collectFieldValues(
  fields: readonly Field[],
  values: FieldValues,
  kinds: readonly Field['kind'][],
): JsonValue[] {
  const out: JsonValue[] = []
  for (const field of fields) {
    const value = values[field.key]
    if (value === undefined) continue
    if (kinds.includes(field.kind)) out.push(value)
    if (field.kind === 'list' && Array.isArray(value)) {
      for (const item of value) {
        if (isRecord(item)) out.push(...collectFieldValues(field.fields, item as FieldValues, kinds))
      }
    }
    if (field.kind === 'blocks' && Array.isArray(value)) {
      for (const block of value as unknown as BlockValue[]) {
        const schema = field.blocks.find((candidate) => candidate.type === block?.type)
        if (schema && isRecord(block.settings)) {
          out.push(...collectFieldValues(schema.fields, block.settings, kinds))
        }
      }
    }
  }
  return out
}

/**
 * The same values with every field of `kind` passed through `map`, however
 * deep. The mirror of `collectFieldValues`, for rewriting ids when a layout
 * is copied between shops.
 */
export function mapFieldValues(
  fields: readonly Field[],
  values: FieldValues,
  kind: Field['kind'],
  map: (value: JsonValue) => JsonValue,
): FieldValues {
  const out: FieldValues = { ...values }
  for (const field of fields) {
    const value = out[field.key]
    if (value === undefined) continue
    if (field.kind === kind) out[field.key] = map(value)
    if (field.kind === 'list' && Array.isArray(value)) {
      out[field.key] = value.map((item) =>
        isRecord(item) ? mapFieldValues(field.fields, item as FieldValues, kind, map) : item,
      )
    }
    if (field.kind === 'blocks' && Array.isArray(value)) {
      out[field.key] = (value as unknown as BlockValue[]).map((block) => {
        const schema = field.blocks.find((candidate) => candidate.type === block?.type)
        if (!schema || !isRecord(block.settings)) return block
        return { ...block, settings: mapFieldValues(schema.fields, block.settings, kind, map) }
      }) as unknown as JsonValue
    }
  }
  return out
}
