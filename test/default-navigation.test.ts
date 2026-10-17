/**
 * The platform default navigation: the footer a shop is seeded with when it
 * switches to custom, built from its own catalogue, and the switch that decides
 * whether the storefront draws anything at all.
 */

import { describe, expect, test } from 'bun:test'

import { defaultFooterMenu, readLocalizedText, resolveShopMenus } from '../src/index'
import type { FooterPage } from '../src/index'
import type { CatalogNavEntry } from '../src/index'

const CATEGORIES: CatalogNavEntry[] = [
  { id: 'c1', name: 'Kue', slug: 'kue' },
  { id: 'c2', name: 'Roti', slug: 'roti' },
]
const COLLECTIONS: CatalogNavEntry[] = [{ id: 'k1', name: 'Lebaran', slug: 'lebaran' }]
const PAGES: FooterPage[] = [{ title: { id: 'Tentang', en: 'About' }, slug: 'tentang' }]

function build(overrides: Partial<Parameters<typeof defaultFooterMenu>[0]> = {}) {
  return defaultFooterMenu({
    categories: CATEGORIES,
    collections: COLLECTIONS,
    pages: PAGES,
    ...overrides,
  })
}

const label = (item: { label: Parameters<typeof readLocalizedText>[0] }, locale = 'en') =>
  readLocalizedText(item.label, locale)

describe('defaultFooterMenu', () => {
  test('a column per catalogue kind that exists, then Information', () => {
    const en = build()
    expect(en.map((item) => label(item))).toEqual(['Categories', 'Collections', 'Information'])
    // Column headings point nowhere; their children carry the links.
    expect(en[0]?.link).toEqual({ kind: 'none' })
    expect(en[0]?.children.map((child) => label(child))).toEqual(['Kue', 'Roti'])
    expect(en[0]?.children[0]?.link).toEqual({ kind: 'category', slug: 'kue' })
    expect(en[1]?.children[0]?.link).toEqual({ kind: 'collection', slug: 'lebaran' })
  })

  test('Information carries the shop’s pages and order tracking', () => {
    const info = build()[2]!
    expect(label(info, 'id')).toBe('Informasi')
    expect(info.children.map((child) => label(child))).toEqual(['About', 'Track order'])
    expect(info.children.map((child) => label(child, 'id'))).toEqual(['Tentang', 'Lacak pesanan'])
    expect(info.children[0]?.link).toEqual({ kind: 'page', slug: 'tentang' })
    expect(info.children[1]?.link).toEqual({ kind: 'orderTracking' })
  })

  test('column headings follow the reader’s language, not one language', () => {
    // What the seeded footer exists for: a bilingual menu, unlike a link whose
    // label is a single string.
    expect(label(build()[0]!, 'id')).toBe('Kategori')
    expect(label(build()[2]!, 'en')).toBe('Information')
  })

  test('a kind with no entries is left out; Information stays', () => {
    const items = build({ categories: [], collections: [], pages: [] })
    expect(items.map((item) => label(item))).toEqual(['Information'])
  })

  test('every item id is unique, so nothing is dropped on save', () => {
    const ids = build().flatMap((item) => [item.id, ...item.children.map((c) => c.id)])
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('resolveShopMenus', () => {
  const stored = {
    footer: JSON.stringify([{ id: 'a', label: 'Shop', link: { kind: 'none' } }]),
  }

  test('on custom, the shop’s own stored rows are drawn', () => {
    expect(resolveShopMenus(true, stored).footer.map((item) => label(item))).toEqual(['Shop'])
  })

  test('off custom, nothing is drawn — header and footer stay clean', () => {
    expect(resolveShopMenus(false, stored)).toEqual({ main: [], footer: [] })
  })
})
