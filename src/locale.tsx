/**
 * The language the builder speaks: the words it adds around the seller's own
 * ("Shop now", "Days", the editor's labels) and which translation of the
 * seller's text it shows.
 *
 * A host wraps the React parts in `LocaleProvider`; without one, English.
 * The HTML renderer takes `locale` as an option and wraps for you.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react'

import { STOREFRONT_LOCALES, type StorefrontLocale } from './model/localized'

/** The languages the builder ships words for. */
export const LOCALES = STOREFRONT_LOCALES
export type Locale = StorefrontLocale
export const DEFAULT_LOCALE: Locale = 'en'

/** BCP 47 tags for `Intl`, by locale. */
export const LOCALE_TAGS: Record<Locale, string> = { en: 'en-GB', id: 'id-ID' }

export interface LocaleContextValue {
  locale: Locale
  /** The locale's BCP 47 tag, for `Intl` formatters. */
  tag: string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo(() => ({ locale, tag: LOCALE_TAGS[locale] ?? locale }), [locale])
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

/** The current language; English outside a `LocaleProvider`. */
export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext) ?? { locale: DEFAULT_LOCALE, tag: LOCALE_TAGS[DEFAULT_LOCALE] }
}
