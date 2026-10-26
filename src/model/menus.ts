/**
 * Navigation menus: the links in the storefront's header and footer.
 *
 * Two menus per shop, by handle. The main menu is the header's: a top-level
 * item with children opens a dropdown, and children with children of their
 * own turn it into a mega menu of columns. The footer menu's top-level items
 * are column headings.
 *
 * Stored in the `menus` collection as `itemsJson`, separately from themes, so
 * switching themes keeps the shop's navigation — the same choice Shopify
 * makes. Every link is the builder's `Link` union, so a menu entry can point
 * only where a button can.
 */

import { z } from 'zod'

import { isRecord, newId } from './fields'
import { sanitizeLink, type Link } from './links'
import {
  hasLocalizedText,
  isLocalizedText,
  localize,
  STOREFRONT_LOCALES,
  type Localized,
  type LocalizedText,
  type StorefrontLocale,
} from './localized'

export const MENU_HANDLES = ['main', 'footer'] as const
export type MenuHandle = (typeof MENU_HANDLES)[number]

export interface MenuItem {
  id: string
  /**
   * One label, or one per storefront locale — a menu entry is translated the
   * same way a section's copy is (see `LocalizedText`). A plain string is the
   * shop's own language, and readers fall back to it.
   */
  label: LocalizedText
  link: Link
  children: MenuItem[]
}

/** Three levels: top, column, link. Deeper than that is not navigation. */
export const MAX_MENU_DEPTH = 3
export const MAX_MENU_ITEMS_PER_LEVEL = 12
/** Across the whole menu, so a mega menu cannot grow without bound. */
export const MAX_MENU_ITEMS = 150
export const MAX_MENU_LABEL = 60

export const MENU_NAMES: Record<MenuHandle, Localized> = {
  main: { en: 'Main menu', id: 'Menu utama' },
  footer: { en: 'Footer menu', id: 'Menu footer' },
}

export const MENU_DESCRIPTIONS: Record<MenuHandle, Localized> = {
  main: {
    en: 'The links in the header. Add links under a link for a dropdown, and one more level for a mega menu with columns.',
    id: 'Tautan di header. Tambahkan tautan di bawah tautan untuk menu tarik-turun, dan satu tingkat lagi untuk mega menu berkolom.',
  },
  footer: {
    en: 'The links in the footer. Each top-level link is a column heading; the links under it are the column.',
    id: 'Tautan di footer. Setiap tautan tingkat atas menjadi judul kolom; tautan di bawahnya menjadi isi kolom.',
  },
}

/**
 * A menu as a form value, for the admin's menu editor. The sanitiser below
 * quietly drops a link with no label; the form says so on the field instead,
 * before the seller loses the link on save. Depth and counts are enforced by
 * the editor (it offers no way past them) and by the sanitiser on the server.
 */
/**
 * A link's label, normalised for storage: one string, or one per storefront
 * locale, each trimmed to the limit. The widening section text uses
 * (`sanitizeTextField`), kept here because a menu label lives outside a section.
 */
function sanitizeLabel(value: unknown): LocalizedText {
  const fit = (text: string) => text.trim().slice(0, MAX_MENU_LABEL)
  if (isLocalizedText(value)) {
    const out: Partial<Record<StorefrontLocale, string>> = {}
    for (const locale of STOREFRONT_LOCALES) {
      const entry = (value as Record<string, unknown>)[locale]
      if (typeof entry === 'string') out[locale] = fit(entry)
    }
    return out
  }
  return typeof value === 'string' ? fit(value) : ''
}

const menuItemSchema: z.ZodType<MenuItem, MenuItem> = z.lazy(() =>
  z.object({
    id: z.string(),
    // A label is given when any language carries text — the same test the
    // sanitiser drops an empty link by.
    label: z.custom<LocalizedText>((value) => hasLocalizedText(sanitizeLabel(value)), {
      message: 'Give the link a label.',
    }),
    link: z.custom<Link>((value) => isRecord(value) && typeof value.kind === 'string'),
    children: z.array(menuItemSchema).max(MAX_MENU_ITEMS_PER_LEVEL),
  }),
)

export const menuFormSchema = z.object({
  items: z.array(menuItemSchema).max(MAX_MENU_ITEMS_PER_LEVEL),
})

export type MenuFormValues = z.infer<typeof menuFormSchema>

export function sanitizeMenuItems(value: unknown): MenuItem[] {
  let budget = MAX_MENU_ITEMS
  const seen = new Set<string>()

  function walk(raw: unknown, depth: number): MenuItem[] {
    if (!Array.isArray(raw) || depth > MAX_MENU_DEPTH) return []
    const out: MenuItem[] = []
    for (const entry of raw.slice(0, MAX_MENU_ITEMS_PER_LEVEL)) {
      if (budget <= 0) break
      if (!isRecord(entry)) continue
      const label = sanitizeLabel(entry.label)
      if (!hasLocalizedText(label)) continue
      budget -= 1
      let id =
        typeof entry.id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(entry.id) ? entry.id : newId()
      if (seen.has(id)) id = newId()
      seen.add(id)
      out.push({
        id,
        label,
        link: sanitizeLink(entry.link),
        children: walk(entry.children, depth + 1),
      })
    }
    return out
  }

  return walk(value, 1)
}

export function parseMenuItems(json: string | null | undefined): MenuItem[] {
  if (!json) return []
  try {
    return sanitizeMenuItems(JSON.parse(json))
  } catch {
    return []
  }
}

export function isMenuHandle(value: unknown): value is MenuHandle {
  return typeof value === 'string' && (MENU_HANDLES as readonly string[]).includes(value)
}

/** Whether any top-level item has grandchildren — the header then opens a mega menu. */
export function isMegaMenu(item: MenuItem): boolean {
  return item.children.some((child) => child.children.length > 0)
}

/* -------------------------------------------------------------------------- */
/* Catalogue fallbacks                                                        */
/* -------------------------------------------------------------------------- */

/**
 * One category or collection as navigation needs it: a name and the slug its
 * link points at. The header and footer only read these two, so both the live
 * storefront and the editor preview can map their own rows into it.
 */
export interface CatalogNavEntry {
  id: string
  name: string
  slug: string
}

export interface CatalogNavLabels {
  /** Heading for the categories group, already in the shopper's language. */
  categories: string
  /** Heading for the collections group, already in the shopper's language. */
  collections: string
}

function categoryItem(entry: CatalogNavEntry): MenuItem {
  return {
    id: `fallback-category-${entry.id}`,
    label: entry.name,
    link: { kind: 'category', slug: entry.slug },
    children: [],
  }
}

function collectionItem(entry: CatalogNavEntry): MenuItem {
  return {
    id: `fallback-collection-${entry.id}`,
    label: entry.name,
    link: { kind: 'collection', slug: entry.slug },
    children: [],
  }
}

/** One collapsible group of a kind's entries, or `null` when there are none. */
function catalogGroup(
  kind: 'categories' | 'collections',
  label: LocalizedText,
  entries: readonly CatalogNavEntry[],
): MenuItem | null {
  if (entries.length === 0) return null
  return {
    id: `fallback-${kind}`,
    label,
    link: { kind: 'none' },
    children: entries.map(kind === 'categories' ? categoryItem : collectionItem),
  }
}

/**
 * The phone drawer's menu when the seller configured no main menu.
 *
 * A fresh shop has no navigation rows yet, and an empty drawer reads as a
 * broken shop — so the catalogue stands in:
 *
 * - both categories and collections: two collapsible groups, one per kind;
 * - only categories: every category as its own row;
 * - only collections: every collection as its own row;
 * - neither: nothing, so the drawer keeps its account rows only.
 *
 * Desktop navigation deliberately stays empty: the desktop bar is one clean
 * row, and a full catalogue there is clutter rather than wayfinding.
 */
export function buildMobileFallbackMenu(
  categories: readonly CatalogNavEntry[],
  collections: readonly CatalogNavEntry[],
  labels: CatalogNavLabels,
): MenuItem[] {
  const groups = buildFooterFallbackMenu(categories, collections, labels)
  // Both kinds exist: two collapsible groups, one per kind.
  if (groups.length > 1) return groups
  // One kind only: list its entries flat, with no heading between tap and link.
  return groups.flatMap((group) => group.children)
}

/**
 * The footer's menu when the seller configured none.
 *
 * Every category and collection gets a home: one column per kind that exists,
 * so a fresh shop's footer already leads somewhere. A configured footer menu
 * always wins — this only fills the gap.
 */
export function buildFooterFallbackMenu(
  categories: readonly CatalogNavEntry[],
  collections: readonly CatalogNavEntry[],
  labels: CatalogNavLabels,
): MenuItem[] {
  return [
    catalogGroup('categories', labels.categories, categories),
    catalogGroup('collections', labels.collections, collections),
  ].filter((group): group is MenuItem => group !== null)
}

/* -------------------------------------------------------------------------- */
/* The platform default navigation                                            */
/* -------------------------------------------------------------------------- */

/**
 * The headings the default footer is built from, in both languages.
 *
 * The header has no platform default: a fresh shop's bar stays clean. Only the
 * footer is pre-filled, and it mirrors what the storefront already draws
 * without a configured menu — the catalogue and the shop's information links.
 */
export const FOOTER_DEFAULT_LABELS = {
  categories: { en: 'Categories', id: 'Kategori' },
  collections: { en: 'Collections', id: 'Koleksi' },
  information: { en: 'Information', id: 'Informasi' },
  trackOrder: { en: 'Track order', id: 'Lacak pesanan' },
} satisfies Record<string, Localized>

export type FooterDefaultLabels = { [K in keyof typeof FOOTER_DEFAULT_LABELS]: string }

/** The default footer's headings, resolved for one locale. */
export function footerDefaultLabels(locale: string): FooterDefaultLabels {
  return {
    categories: localize(FOOTER_DEFAULT_LABELS.categories, locale),
    collections: localize(FOOTER_DEFAULT_LABELS.collections, locale),
    information: localize(FOOTER_DEFAULT_LABELS.information, locale),
    trackOrder: localize(FOOTER_DEFAULT_LABELS.trackOrder, locale),
  }
}

/** One page the default footer links: its title and storefront slug. */
export interface FooterPage {
  /** A per-locale map when the page has a translated title, a plain string otherwise. */
  title: LocalizedText
  slug: string
}

/**
 * The footer menu a shop starts with when it switches to custom navigation,
 * built from its own catalogue so "customise" begins on what it already shows.
 *
 * One column per kind that exists — categories, then collections — and an
 * Information column of the shop's pages and order tracking, the same content
 * the storefront's own fallback footer draws. Column headings are per-locale
 * (`FOOTER_DEFAULT_LABELS`), so the seeded menu follows the shopper's language
 * like the rest of the storefront.
 *
 * The header is deliberately not seeded: it stays empty until the seller adds
 * links, so switching a shop to custom never puts a bar on its storefront.
 */
export function defaultFooterMenu(input: {
  categories: readonly CatalogNavEntry[]
  collections: readonly CatalogNavEntry[]
  pages: readonly FooterPage[]
}): MenuItem[] {
  const groups = [
    catalogGroup(
      'categories',
      FOOTER_DEFAULT_LABELS.categories,
      input.categories.slice(0, MAX_MENU_ITEMS_PER_LEVEL),
    ),
    catalogGroup(
      'collections',
      FOOTER_DEFAULT_LABELS.collections,
      input.collections.slice(0, MAX_MENU_ITEMS_PER_LEVEL),
    ),
  ].filter((group): group is MenuItem => group !== null)

  // One slot is kept for order tracking, so the column never exceeds a level.
  const information: MenuItem = {
    id: 'information',
    label: FOOTER_DEFAULT_LABELS.information,
    link: { kind: 'none' },
    children: [
      ...input.pages.slice(0, MAX_MENU_ITEMS_PER_LEVEL - 1).map((page): MenuItem => ({
        id: `page-${page.slug}`,
        label: page.title,
        link: { kind: 'page', slug: page.slug },
        children: [],
      })),
      {
        id: 'track-order',
        label: FOOTER_DEFAULT_LABELS.trackOrder,
        link: { kind: 'orderTracking' },
        children: [],
      },
    ],
  }

  return [...groups, information]
}

/** The shop's stored menu rows, by handle, as they read off the `menus` table. */
export interface StoredMenus {
  main?: string | null
  footer?: string | null
}

/**
 * The two menus a shop actually draws, from its override switch and its rows.
 *
 * A shop that has not switched to custom draws nothing — its header is as clean
 * as a shop that never configured navigation — so switching back to the default
 * never re-shows rows the seller has moved on from. The default footer is not a
 * live menu: it is the starting point the dashboard seeds when a seller first
 * switches (`defaultFooterMenu`).
 *
 * The one place that decision is made, so the dashboard's editor and the live
 * storefront can never disagree about which the shop is on.
 */
export function resolveShopMenus(
  custom: boolean,
  stored: StoredMenus,
): { main: MenuItem[]; footer: MenuItem[] } {
  if (!custom) return { main: [], footer: [] }
  return { main: parseMenuItems(stored.main), footer: parseMenuItems(stored.footer) }
}

/** What the storefront's header and footer draw from: the menus, and what they may link to. */
export interface StorefrontMenus {
  main: MenuItem[]
  footer: MenuItem[]
  categories: Array<{ id: string; name: string; slug: string }>
  collections: Array<{ id: string; name: string; slug: string }>
}

/** No menus at all — before a shop is known, or when they could not be read. */
export const EMPTY_STOREFRONT_MENUS: StorefrontMenus = {
  main: [],
  footer: [],
  categories: [],
  collections: [],
}
