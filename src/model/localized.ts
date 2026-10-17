/**
 * Copy that ships inside the package, in both languages the platform speaks.
 *
 * Section names, field labels and preset copy are defined next to the code
 * that uses them rather than in each app's catalogue: the admin and developer
 * apps both render the same editor, and a label kept in two catalogues is a
 * label that drifts. The shape is the same `{ en, id }` pair the plan copy
 * uses, so adding a locale is one more key here.
 *
 * Deliberately not typed against `@repo/i18n`'s `Locale`: this module is
 * imported by servers and Node scripts, and `@repo/i18n` pulls in React.
 */

export interface Localized {
  en: string
  id: string
}

export function localize(text: Localized, locale: string): string {
  return text[locale as keyof Localized] || text.en
}

/* -------------------------------------------------------------------------- */
/* Seller-authored copy                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The locales a storefront speaks, in fallback order — the shop's own language
 * first, English last. Adding one is one more entry here plus its catalogue in
 * `@repo/i18n`, the same shape the package's own copy uses above.
 */
export const STOREFRONT_LOCALES = ['id', 'en'] as const
export type StorefrontLocale = (typeof STOREFRONT_LOCALES)[number]

/**
 * A seller's text field: a single string while a shop speaks one language, or
 * one string per locale once it has been translated.
 *
 * Storing both in the very place the string used to live — a section's settings
 * JSON, a page's body — is what lets the storefront render per visitor without
 * a new column anywhere: the value widens, the storage does not.
 */
export type LocalizedText = string | Partial<Record<StorefrontLocale, string>>

/** Whether a stored value is a per-locale map (as opposed to one plain string). */
export function isLocalizedText(
  value: unknown,
): value is Partial<Record<StorefrontLocale, string>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  return STOREFRONT_LOCALES.some(
    (locale) => typeof (value as Record<string, unknown>)[locale] === 'string',
  )
}

/**
 * The text to show a reader in `locale`: that locale's entry, else the shop's
 * fallback language, else English, else the empty string.
 *
 * A plain string is returned unchanged, so every value written before
 * translations existed renders exactly as it does today.
 */
export function readLocalizedText(
  value: LocalizedText | null | undefined,
  locale: string,
  fallback: string = STOREFRONT_LOCALES[0],
): string {
  if (typeof value === 'string') return value
  if (!value) return ''
  for (const key of [locale, fallback, 'en']) {
    const text = value[key as StorefrontLocale]
    if (typeof text === 'string' && text.length > 0) return text
  }
  return ''
}

/**
 * Whether a value carries any text at all: a plain string with content, or at
 * least one locale's entry. What a form asks to call a label "given" once
 * languages are in play, where the value may be either shape.
 */
export function hasLocalizedText(value: LocalizedText | null | undefined): boolean {
  if (typeof value === 'string') return value.trim().length > 0
  if (!value) return false
  return STOREFRONT_LOCALES.some((locale) => (value[locale] ?? '').trim().length > 0)
}

/**
 * One locale's stored entry, with no fallback — what the translation editor
 * shows under that locale's tab. A plain string reads as the value for every
 * locale, since it is the only copy there is.
 */
export function readLocalizedEntry(
  value: LocalizedText | null | undefined,
  locale: StorefrontLocale,
): string {
  if (typeof value === 'string') return value
  return value?.[locale] ?? ''
}

/**
 * The entry actually *stored* for `locale`, or `''` — the one difference from
 * `readLocalizedEntry` being a plain string, which is the value for every
 * locale but is stored for none.
 *
 * The translation manager counts a locale as translated only when it has an
 * entry of its own: a plain string reads the same in every column, so without
 * this an entirely untranslated field would look finished. A locale still
 * missing its entry is exactly what the AI button fills.
 */
export function readStoredEntry(
  value: LocalizedText | null | undefined,
  locale: StorefrontLocale,
): string {
  if (!value || typeof value === 'string') return ''
  return value[locale] ?? ''
}

/**
 * The value with one locale's text set — what the translation editor writes on
 * every keystroke.
 *
 * A plain string becomes a map on the first edit, seeded with itself under the
 * default locale, so the original copy is not lost when a second language is
 * added. Writing the default locale's own entry back collapses nothing: the map
 * persists, and a later reader still falls back exactly as before.
 */
export function withLocalizedEntry(
  value: LocalizedText | null | undefined,
  locale: StorefrontLocale,
  text: string,
  defaultLocale: StorefrontLocale = STOREFRONT_LOCALES[0],
): Partial<Record<StorefrontLocale, string>> {
  const base = typeof value === 'string' ? { [defaultLocale]: value } : { ...(value ?? {}) }
  return { ...base, [locale]: text }
}

/* -------------------------------------------------------------------------- */
/* Values that are not text (a rich document, say)                            */
/* -------------------------------------------------------------------------- */

/**
 * The doc-typed twins of the three helpers above: the same contract, for a
 * value that is a structured object rather than a string. A rich-text field
 * holds one `RichDoc`, or one per locale once translated.
 */

/** Whether a value is a per-locale map whose entries pass `isEntry`. */
export function isLocalizedValue<T>(
  value: unknown,
  isEntry: (entry: unknown) => entry is T,
): value is Partial<Record<StorefrontLocale, T>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  return STOREFRONT_LOCALES.some((locale) => isEntry((value as Record<string, unknown>)[locale]))
}

/** The entry for one locale, with the reader → shop → English fallback chain. */
export function readLocalizedEntryOf<T>(
  value: T | Partial<Record<StorefrontLocale, T>> | null | undefined,
  locale: string,
  isEntry: (entry: unknown) => entry is T,
  fallback: string = STOREFRONT_LOCALES[0],
): T | undefined {
  if (value == null) return undefined
  if (isEntry(value)) return value
  for (const key of [locale, fallback, 'en']) {
    const entry = (value as Record<string, unknown>)[key]
    if (isEntry(entry)) return entry
  }
  return undefined
}

/** The value with one locale's entry set — the twin of `withLocalizedEntry`. */
export function withLocalizedEntryOf<T>(
  value: unknown,
  locale: StorefrontLocale,
  entry: T,
  isEntry: (entry: unknown) => entry is T,
  defaultLocale: StorefrontLocale = STOREFRONT_LOCALES[0],
): Partial<Record<StorefrontLocale, T>> {
  const base = isLocalizedValue(value, isEntry)
    ? { ...value }
    : isEntry(value)
      ? { [defaultLocale]: value }
      : {}
  return { ...base, [locale]: entry }
}

/** How much of a set of entries carries a target translation, 0–1. */
export function translationProgress(entries: readonly { target: string }[]): number {
  if (entries.length === 0) return 1
  const done = entries.filter((entry) => entry.target.trim().length > 0).length
  return done / entries.length
}
