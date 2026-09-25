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
  const current = values[field.showWhen.key]
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

export type ItemField =
  TextField | TextareaField | NumberField | SelectField | BooleanField | ImageField | LinkField

export interface ListField extends BaseField {
  kind: 'list'
  itemLabel: Localized
  /** Which item field names an item in the editor's collapsed row. */
  titleKey: string
  max: number
  fields: readonly ItemField[]
}

export type Field = ItemField | ReferenceField | ListField

/** Anything a stored setting can be: plain JSON, so it survives storage and the wire. */
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export type FieldValues = { [key: string]: JsonValue }

const ID = /^[A-Za-z0-9_-]{1,64}$/

function text(value: unknown, max: number, fallback: string): string {
  return typeof value === 'string' ? value.slice(0, max) : fallback
}

function sanitizeField(field: Field, value: unknown): JsonValue {
  switch (field.kind) {
    case 'text':
    case 'textarea':
      return text(value, field.max, field.default)
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
    case 'image':
    case 'collection':
    case 'category':
      return typeof value === 'string' && ID.test(value) ? value : ''
    case 'link':
      return sanitizeLink(value)
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
