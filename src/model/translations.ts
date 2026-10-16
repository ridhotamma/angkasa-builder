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
import { CONTENT_VERSION, type SectionInstance, type PageContent } from './content'
import {
  readLocalizedEntry,
  readLocalizedText,
  readStoredEntry,
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

function asText(value: unknown): LocalizedText | undefined {
  return value as LocalizedText | undefined
}

/**
 * One translatable field, with the current text in every storefront locale.
 * This is the whole set the manager shows — the reference language and the
 * others side by side — so nothing has to decide up front which locale is
 * "source": the value is simply read per locale.
 */
export interface TranslationField extends TranslationPath {
  section: Localized
  field: Localized
  values: Partial<Record<StorefrontLocale, string>>
  /**
   * The locales this field has an entry *of its own* for. A plain string is the
   * value for every locale but is stored for none, so it appears in no list —
   * which is what lets the manager count what is actually translated and the AI
   * button fill exactly the locales still missing.
   */
  translated: StorefrontLocale[]
}

type Visit = (entry: {
  path: TranslationPath
  section: Localized
  field: Localized
  value: unknown
}) => void

/** Walk a layout's translatable fields — the one traversal both collectors use. */
function walkTranslationFields(sections: readonly SectionInstance[], visit: Visit): void {
  for (const section of sections) {
    const schema = sectionSchema(section.type)
    if (!schema) continue
    for (const field of schema.fields) {
      if (isCopyField(field.kind)) {
        visit({
          path: { sectionId: section.id, key: field.key },
          section: schema.name,
          field: field.label,
          value: section.settings[field.key],
        })
      } else if (field.kind === 'list') {
        const items = section.settings[field.key]
        if (!Array.isArray(items)) continue
        for (const item of items) {
          if (!isRecord(item) || typeof item.id !== 'string') continue
          for (const sub of field.fields) {
            if (!isCopyField(sub.kind)) continue
            visit({
              path: {
                sectionId: section.id,
                listKey: field.key,
                itemId: item.id,
                key: sub.key,
              },
              section: schema.name,
              field: sub.label,
              value: item[sub.key] as JsonValue | undefined,
            })
          }
        }
      }
    }
  }
}

/** Every translatable field with its text read in each locale. */
export function collectTranslationFields(sections: readonly SectionInstance[]): TranslationField[] {
  const fields: TranslationField[] = []
  walkTranslationFields(sections, ({ path, section, field, value }) => {
    const raw = asText(value)
    const values: Partial<Record<StorefrontLocale, string>> = {}
    const translated: StorefrontLocale[] = []
    for (const locale of STOREFRONT_LOCALES) {
      const text = readLocalizedEntry(raw, locale)
      if (text) values[locale] = text
      if (readStoredEntry(raw, locale).trim()) translated.push(locale)
    }
    fields.push({ ...path, section, field, values, translated })
  })
  return fields
}

/**
 * Every translatable string, in document order, for one target locale.
 * `fallback` is the locale the source text is read from.
 */
export function collectTranslationEntries(
  sections: readonly SectionInstance[],
  locale: StorefrontLocale,
  fallback: StorefrontLocale = STOREFRONT_LOCALES[0],
): TranslationEntry[] {
  const entries: TranslationEntry[] = []
  walkTranslationFields(sections, ({ path, section, field, value }) => {
    entries.push({
      ...path,
      section,
      field,
      source: readLocalizedText(asText(value), fallback, fallback),
      target: readLocalizedEntry(asText(value), locale),
    })
  })
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

/**
 * The same write, over a bare section list — the editor holds the sections, not
 * the surrounding content, and this keeps one implementation underneath both.
 */
export function applyTranslationToSections(
  sections: readonly SectionInstance[],
  path: TranslationPath,
  locale: StorefrontLocale,
  text: string,
  fallback: StorefrontLocale = STOREFRONT_LOCALES[0],
): SectionInstance[] {
  const content: PageContent = { version: CONTENT_VERSION, sections: [...sections] }
  return applyTranslationEntry(content, path, locale, text, fallback).sections
}
