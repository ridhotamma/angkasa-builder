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
