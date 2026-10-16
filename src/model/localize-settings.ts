/**
 * Resolving a section's translatable copy for one locale, at render time.
 *
 * A seller's text field stores one string or one string per locale (`see
 * `localized.ts`); a renderer only ever wants the string. `readLocalizedText`
 * does that per value, and this walks a section's schema to do it for the whole
 * settings object — top-level fields and the copy inside each list item.
 *
 * The walk is schema-guided on purpose: resolving every string-shaped value
 * generically would misread a list item, whose `id` (and any `en`/`id` key) is
 * data, not a translation. Only fields the schema calls copy are resolved.
 *
 * Dependency-free and side-effect-free, so server renders and the editor's
 * preview resolve identically.
 */

import { isRecord, type Field, type FieldValues, type JsonValue } from './fields'
import {
  isLocalizedText,
  readLocalizedEntryOf,
  readLocalizedText,
  STOREFRONT_LOCALES,
} from './localized'
import { sectionSchema, type SectionType } from './sections'

/** The field kinds that carry the seller's own copy, and can be translated. */
function isCopyField(field: Field): boolean {
  return field.kind === 'text' || field.kind === 'textarea'
}

/** Whether a value is a rich-text document, for the doc-typed resolution below. */
function isDoc(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && value.type === 'doc'
}

/** One field's value, resolved to a string where it is translatable copy. */
function resolveField(
  field: Field,
  value: JsonValue | undefined,
  locale: string,
  fallback: string,
): JsonValue | undefined {
  if (isCopyField(field)) {
    return isLocalizedText(value) ? readLocalizedText(value, locale, fallback) : value
  }
  // A rich body is one document, or one per locale: pick the reader's, falling
  // back like the text. A plain document is returned unchanged.
  if (field.kind === 'richtext') {
    const doc = readLocalizedEntryOf(
      value as Record<string, unknown> | undefined,
      locale,
      isDoc,
      fallback,
    )
    return doc !== undefined && doc !== value ? (doc as JsonValue) : value
  }
  if (field.kind !== 'list' || !Array.isArray(value)) return value

  let changed = false
  const items = value.map((item) => {
    if (!isRecord(item)) return item
    let itemChanged = false
    const copy = { ...item }
    for (const sub of field.fields) {
      if (!isCopyField(sub)) continue
      const raw = item[sub.key]
      if (!isLocalizedText(raw)) continue
      copy[sub.key] = readLocalizedText(raw, locale, fallback)
      itemChanged = true
    }
    if (!itemChanged) return item
    changed = true
    return copy
  })
  return changed ? items : value
}

/**
 * A section's settings with every translatable value resolved for `locale`.
 *
 * Returns the very same object when nothing was translated, so a section that
 * speaks one language re-renders exactly as it did before this existed.
 */
export function resolveLocalizedSettings(
  type: SectionType,
  settings: FieldValues,
  locale: string,
  fallback: string = STOREFRONT_LOCALES[0],
): FieldValues {
  const schema = sectionSchema(type)
  if (!schema) return settings

  let changed = false
  const out: FieldValues = { ...settings }
  for (const field of schema.fields) {
    const current = settings[field.key]
    const resolved = resolveField(field, current, locale, fallback)
    if (resolved !== current) {
      out[field.key] = resolved as JsonValue
      changed = true
    }
  }
  return changed ? out : settings
}
