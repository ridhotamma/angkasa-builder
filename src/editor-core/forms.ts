/**
 * Settings forms as data, both ways.
 *
 * `describeFields` turns a list of field descriptors and the values they
 * hold into plain form fields — labels in the editor's language, the value
 * to show, the choices, whether the field is on screen — that any template
 * engine can draw. `readFormInput` goes back: it reads a browser form
 * submission (`name=value` pairs, as an htmx request posts them) into the
 * values those fields store, sanitised exactly as a saved layout is.
 *
 * Naming: a field's input is named by its key; a list item's field by
 * `list.index.key` (`items.0.title`). Values with structure — a link, a
 * video, a table, a point, a pin, a whole list — post as JSON under the
 * field's own name. A switch posts `true`; to post its "off", put a hidden
 * `false` input of the same name before the checkbox (the last value wins).
 * A field the form did not post keeps its value.
 */

import type { Field, FieldValues, JsonValue } from '../model/fields'
import { isFieldShown, isRecord, sanitizeValues } from '../model/fields'
import {
  isLocalizedText,
  localize,
  readLocalizedEntry,
  withLocalizedEntry,
  type Localized,
  type StorefrontLocale,
} from '../model/localized'

interface FormFieldBase {
  key: string
  /** The input's name in a submission (see the naming rules above). */
  name: string
  label: string
  help?: string
  /** Whether the field belongs on screen given its siblings (`showWhen`). */
  shown: boolean
}

export type FormField = FormFieldBase &
  (
    | {
        kind: 'text' | 'textarea'
        value: string
        max: number
        placeholder?: string
        rows?: number
        translated: boolean
      }
    | { kind: 'richtext'; value: JsonValue; max: number }
    | { kind: 'number'; value: number; min: number; max: number; step?: number }
    | {
        kind: 'select'
        value: string
        options: Array<{ value: string; label: string }>
        segment: boolean
      }
    | { kind: 'boolean'; value: boolean }
    | {
        kind:
          | 'color'
          | 'icon'
          | 'image'
          | 'product'
          | 'collection'
          | 'category'
          | 'voucher'
          | 'datetime'
        value: string
        emptyLabel?: string
      }
    /** Structured values, posted as JSON under `name`. */
    | { kind: 'link' | 'video' | 'table' | 'point' | 'coordinates'; value: JsonValue }
    | {
        kind: 'list'
        value: JsonValue
        itemLabel: string
        max: number
        items: Array<{ id: string; title: string; fields: FormField[] }>
      }
    /** A block tree is edited block by block (see the block commands), never as one input. */
    | {
        kind: 'blocks'
        max: number
        blocks: Array<{ id: string; type: string; label: string }>
        types: Array<{ type: string; label: string }>
      }
  )

export interface FormOptions {
  locale: StorefrontLocale
  /** The settings a list item sits in, for item fields that follow the section's own choices. */
  outer?: FieldValues
  /** Prefix for input names — how list items name their fields. */
  prefix?: string
}

function text(value: Localized | undefined, locale: string): string | undefined {
  return value ? localize(value, locale) : undefined
}

/** The fields of a form, ready to draw. */
export function describeFields(
  fields: readonly Field[],
  values: FieldValues,
  options: FormOptions,
): FormField[] {
  const { locale, outer, prefix = '' } = options
  return fields.map((field): FormField => {
    const base: FormFieldBase = {
      key: field.key,
      name: `${prefix}${field.key}`,
      label: localize(field.label, locale),
      help: text(field.help, locale),
      shown: isFieldShown(field, values, outer),
    }
    const value = values[field.key]
    switch (field.kind) {
      case 'text':
      case 'textarea':
        return {
          ...base,
          kind: field.kind,
          value:
            isLocalizedText(value) || typeof value === 'string'
              ? readLocalizedEntry(value, locale)
              : '',
          translated: isLocalizedText(value),
          max: field.max,
          placeholder: text(field.placeholder, locale),
          rows: field.kind === 'textarea' ? field.rows : undefined,
        }
      case 'richtext':
        return { ...base, kind: 'richtext', value: value ?? '', max: field.max }
      case 'number':
        return {
          ...base,
          kind: 'number',
          value: typeof value === 'number' ? value : field.default,
          min: field.min,
          max: field.max,
          step: field.step,
        }
      case 'select':
        return {
          ...base,
          kind: 'select',
          value: typeof value === 'string' ? value : field.default,
          options: field.options.map((option) => ({
            value: option.value,
            label: localize(option.label, locale),
          })),
          segment: Boolean(field.segment),
        }
      case 'boolean':
        return {
          ...base,
          kind: 'boolean',
          value: typeof value === 'boolean' ? value : field.default,
        }
      case 'collection':
      case 'category':
      case 'voucher':
        return {
          ...base,
          kind: field.kind,
          value: typeof value === 'string' ? value : '',
          emptyLabel: text(field.emptyLabel, locale),
        }
      case 'color':
      case 'icon':
      case 'image':
      case 'product':
      case 'datetime':
        return { ...base, kind: field.kind, value: typeof value === 'string' ? value : '' }
      case 'link':
      case 'video':
      case 'table':
      case 'point':
      case 'coordinates':
        return { ...base, kind: field.kind, value: value ?? null }
      case 'list': {
        const items = Array.isArray(value)
          ? value.filter((item): item is FieldValues => isRecord(item))
          : []
        return {
          ...base,
          kind: 'list',
          value: value ?? [],
          itemLabel: localize(field.itemLabel, locale),
          max: field.max,
          items: items.map((item, index) => {
            const title = item[field.titleKey]
            return {
              id: typeof item.id === 'string' ? item.id : String(index),
              title:
                isLocalizedText(title) || typeof title === 'string'
                  ? readLocalizedEntry(title, locale)
                  : '',
              fields: describeFields(field.fields, item, {
                locale,
                outer: values,
                prefix: `${base.name}.${index}.`,
              }),
            }
          }),
        }
      }
      case 'blocks': {
        const blocks = Array.isArray(value)
          ? value.filter((block): block is FieldValues => isRecord(block))
          : []
        const label = (type: string) => {
          const schema = field.blocks.find((candidate) => candidate.type === type)
          return schema ? localize(schema.name, locale) : type
        }
        return {
          ...base,
          kind: 'blocks',
          max: field.max,
          blocks: blocks.map((block) => {
            const type = String(block.type ?? '')
            const name = typeof block.name === 'string' ? block.name.trim() : ''
            return { id: String(block.id ?? ''), type, label: name || label(type) }
          }),
          types: field.blocks.map((schema) => ({
            type: schema.type,
            label: localize(schema.name, locale),
          })),
        }
      }
    }
  })
}

/** A submission: what `FormData`, `URLSearchParams` or a parsed body hold. */
export type FormInput =
  URLSearchParams | FormData | Record<string, string | readonly string[] | undefined>

/** The last value posted under `name`, or `undefined` when it was not posted. */
function posted(input: FormInput, name: string): string | undefined {
  if (
    input instanceof URLSearchParams ||
    (typeof FormData !== 'undefined' && input instanceof FormData)
  ) {
    const all = (input as URLSearchParams).getAll(name)
    const last = all[all.length - 1]
    return typeof last === 'string' ? last : undefined
  }
  const raw = (input as Record<string, string | readonly string[] | undefined>)[name]
  if (raw === undefined) return undefined
  return typeof raw === 'string' ? raw : raw[raw.length - 1]
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

/** One posted string as the raw value a field's sanitiser expects. */
function parseField(
  field: Field,
  raw: string,
  current: JsonValue | undefined,
  locale: StorefrontLocale,
): unknown {
  switch (field.kind) {
    case 'text':
    case 'textarea':
      // A translated field stays a locale map: this language's entry changes.
      return isLocalizedText(current) ? withLocalizedEntry(current, locale, raw) : raw
    case 'richtext': {
      const trimmed = raw.trim()
      return trimmed.startsWith('{') ? (parseJson(trimmed) ?? raw) : raw
    }
    case 'number':
      return raw.trim() === '' ? undefined : Number(raw)
    case 'boolean':
      return raw === 'true' || raw === 'on' || raw === '1'
    case 'link':
    case 'video':
    case 'table':
    case 'point':
    case 'list':
      return parseJson(raw)
    case 'coordinates':
      return raw.trim() === '' || raw === 'null' ? null : parseJson(raw)
    default:
      return raw
  }
}

/**
 * `values` with a submission applied: every posted field parsed and
 * sanitised; everything not posted (and every key these fields do not
 * declare) kept as it was. List items may be posted field by field
 * (`items.0.title`) or as a whole list in JSON (`items`).
 */
export function readFormInput(
  fields: readonly Field[],
  values: FieldValues,
  input: FormInput,
  options: { locale: StorefrontLocale; prefix?: string },
): FieldValues {
  const { locale, prefix = '' } = options
  const raw: Record<string, unknown> = { ...values }
  for (const field of fields) {
    if (field.kind === 'blocks') continue
    const name = `${prefix}${field.key}`
    const value = posted(input, name)
    if (value !== undefined) {
      const parsed = parseField(field, value, values[field.key], locale)
      if (parsed !== undefined) raw[field.key] = parsed
      continue
    }
    if (field.kind === 'list' && Array.isArray(values[field.key])) {
      const items = values[field.key] as JsonValue[]
      raw[field.key] = items.map((item, index) =>
        isRecord(item)
          ? readFormInput(field.fields, item as FieldValues, input, {
              locale,
              prefix: `${name}.${index}.`,
            })
          : item,
      )
    }
  }
  // Sanitised as a save is; undeclared keys (another tab's style, say) kept.
  return { ...values, ...sanitizeValues(fields, raw) }
}
