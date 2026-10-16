/**
 * The engine behind the "Manage translation" screen: every piece of a layout's
 * copy, and how to write one of them back.
 *
 * A section's translatable fields are the ones its schema calls copy (`text`,
 * `textarea`) — top-level, and inside each list item. `collectTranslationEntries`
 * lists them with their source and current target text; `applyTranslationEntry`
 * writes one back as a locale map. Both are pure, so the admin renders them and
 * the server could save from them unchanged.
 *
 * Deliberately does not walk `richtext` bodies or free-form blocks yet: those
 * carry structured docs whose per-locale shape is a later step.
 */

import type { JsonValue } from './fields'
import { isRecord } from './fields'
import type { SectionInstance, PageContent } from './content'
import {
  readLocalizedEntry,
  readLocalizedText,
  STOREFRONT_LOCALES,
  withLocalizedEntry,
  type Localized,
  type LocalizedText,
  type StorefrontLocale,
} from './localized'
import { sectionSchema } from './sections'

/** Where one translatable piece of copy lives, so it can be written back. */
export interface TranslationPath {
  sectionId: string
  /** The concrete field key — a list item's own key when `itemId` is set. */
  key: string
  /** The list field the item belongs to, for copy inside a list item. */
  listKey?: string
  itemId?: string
}

/** One row of the translation table. */
export interface TranslationEntry extends TranslationPath {
  /** The section's own name, from its schema. */
  section: Localized
  /** The field's label, from its schema. */
  field: Localized
  /** The default-locale text — what is being translated. */
  source: string
  /** The target locale's text right now, empty until translated. */
  target: string
}

/** The field kinds that carry the seller's own copy, and can be translated. */
function isCopyField(kind: string): boolean {
  return kind === 'text' || kind === 'textarea'
}

function asText(value: JsonValue | undefined): LocalizedText | undefined {
  return value as unknown as LocalizedText | undefined
}

/**
 * Every translatable string in a layout, in document order, for one target
 * locale. `fallback` is the locale the source text is read from.
 */
export function collectTranslationEntries(
  sections: readonly SectionInstance[],
  locale: StorefrontLocale,
  fallback: StorefrontLocale = STOREFRONT_LOCALES[0],
): TranslationEntry[] {
  const entries: TranslationEntry[] = []

  for (const section of sections) {
    const schema = sectionSchema(section.type)
    if (!schema) continue
    for (const field of schema.fields) {
      if (isCopyField(field.kind)) {
        const value = section.settings[field.key]
        entries.push({
          sectionId: section.id,
          key: field.key,
          section: schema.name,
          field: field.label,
          source: readLocalizedText(asText(value), fallback, fallback),
          target: readLocalizedEntry(asText(value), locale),
        })
      } else if (field.kind === 'list') {
        const items = section.settings[field.key]
        if (!Array.isArray(items)) continue
        for (const item of items) {
          if (!isRecord(item) || typeof item.id !== 'string') continue
          for (const sub of field.fields) {
            if (!isCopyField(sub.kind)) continue
            const value = item[sub.key] as JsonValue | undefined
            entries.push({
              sectionId: section.id,
              listKey: field.key,
              itemId: item.id,
              key: sub.key,
              section: schema.name,
              field: sub.label,
              source: readLocalizedText(asText(value), fallback, fallback),
              target: readLocalizedEntry(asText(value), locale),
            })
          }
        }
      }
    }
  }
  return entries
}

/**
 * The layout with one entry's target text written. Returns the same content
 * object when the path matches nothing, so a stale row cannot reshape a page.
 */
export function applyTranslationEntry(
  content: PageContent,
  path: TranslationPath,
  locale: StorefrontLocale,
  text: string,
  fallback: StorefrontLocale = STOREFRONT_LOCALES[0],
): PageContent {
  let changed = false

  const sections = content.sections.map((section) => {
    if (section.id !== path.sectionId) return section
    const schema = sectionSchema(section.type)
    if (!schema) return section

    if (path.listKey === undefined) {
      if (!schema.fields.some((field) => field.key === path.key && isCopyField(field.kind))) {
        return section
      }
      changed = true
      return {
        ...section,
        settings: {
          ...section.settings,
          [path.key]: withLocalizedEntry(
            asText(section.settings[path.key]),
            locale,
            text,
            fallback,
          ),
        },
      }
    }

    const listField = schema.fields.find((field) => field.key === path.listKey)
    const items = section.settings[path.listKey]
    if (!listField || listField.kind !== 'list' || !Array.isArray(items)) return section
    if (!listField.fields.some((field) => field.key === path.key && isCopyField(field.kind))) {
      return section
    }

    const nextItems = items.map((item) => {
      if (!isRecord(item) || item.id !== path.itemId) return item
      changed = true
      return {
        ...item,
        [path.key]: withLocalizedEntry(
          item[path.key] as unknown as LocalizedText,
          locale,
          text,
          fallback,
        ),
      }
    })
    return changed
      ? { ...section, settings: { ...section.settings, [path.listKey]: nextItems } }
      : section
  })

  return changed ? { ...content, sections } : content
}
