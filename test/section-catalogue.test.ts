import { describe, expect, test } from 'bun:test'

import {
  createSection,
  isSectionAllowed,
  isSectionOffered,
  offeredPresets,
  sanitizeSections,
  sectionSchema,
  type SectionScope,
} from '../src/index'

/** Sections kept in the library but withdrawn from the "Add section" picker. */
const HIDDEN = ['announcement-bar', 'newsletter', 'spin-360', 'pinned-scroll'] as const

/** The consolidated types, one per family. */
const CONSOLIDATED = ['banner', 'product-list', 'gallery', 'quotes', 'cards', 'statement', 'story']

/** The old type names a consolidated type replaces — offered nowhere now. */
const ALIASES = [
  'hero',
  'video-hero',
  'parallax-banner',
  'background-video',
  'featured-collection',
  'collection-shelves',
  'latest-products',
  'collection-tabs',
  'image-gallery',
  'masonry-gallery',
  'social-wall',
  'testimonials',
  'video-testimonials',
  'multicolumn',
  'team',
  'icon-features',
  'image-with-text',
  'split-screen',
  'editorial-statement',
  'scrolling-story',
  'timeline',
] as const

const SCOPES: readonly SectionScope[] = ['home', 'page', 'product', 'article', 'catalog']

describe('the section catalogue', () => {
  test('hidden sections are not offered in the picker, on any page', () => {
    for (const type of HIDDEN) {
      const schema = sectionSchema(type)!
      expect(schema.hidden, type).toBe(true)
      for (const scope of SCOPES) {
        expect(isSectionOffered(schema, scope), `${type}@${scope}`).toBe(false)
      }
    }
  })

  test('a hidden section still exists, sanitises and saves where it was allowed', () => {
    for (const type of HIDDEN) {
      const schema = sectionSchema(type)!
      expect(isSectionAllowed(schema, 'home'), type).toBe(true)
      expect(createSection(type).type).toBe(type)
    }

    const kept = sanitizeSections([
      { id: 'a', type: 'announcement-bar', settings: {} },
      { id: 'b', type: 'newsletter', settings: {} },
      { id: 'c', type: 'spin-360', settings: {} },
      { id: 'd', type: 'pinned-scroll', settings: {} },
    ])
    expect(kept.map((section) => section.type)).toEqual([
      'announcement-bar',
      'newsletter',
      'spin-360',
      'pinned-scroll',
    ])
  })

  test('the offer filter is the allowed set minus the hidden and the consolidated aliases', () => {
    // The consolidated type is what the seller sees…
    expect(isSectionOffered(sectionSchema('banner')!, 'home')).toBe(true)
    // …not the old members it replaced.
    expect(isSectionOffered(sectionSchema('hero')!, 'home')).toBe(false)
    expect(isSectionOffered(sectionSchema('featured-collection')!, 'home')).toBe(false)
    // A product-page-only section is not offered on the home page.
    expect(isSectionOffered(sectionSchema('product-info')!, 'home')).toBe(false)
    // The Blocks composer stays available everywhere it was.
    expect(isSectionOffered(sectionSchema('blocks')!, 'page')).toBe(true)
  })

  test('every consolidated type is registered with an icon, a category and fields', () => {
    for (const type of CONSOLIDATED) {
      const schema = sectionSchema(type)
      expect(schema, type).not.toBeNull()
      expect(schema!.icon.length, type).toBeGreaterThan(0)
      expect(schema!.category.length, type).toBeGreaterThan(0)
      expect(schema!.fields.length, type).toBeGreaterThan(0)
    }
  })

  test('an old family member converges on its consolidated type, keeping its settings', () => {
    const [list] = sanitizeSections([
      { id: 'a', type: 'latest-products', settings: { heading: 'Fresh', limit: 6 } },
    ])
    expect(list!.type).toBe('product-list')
    expect(list!.settings).toMatchObject({ source: 'latest', heading: 'Fresh', limit: 6 })

    const [banner] = sanitizeSections([
      { id: 'b', type: 'video-hero', settings: { heading: 'Watch' } },
    ])
    expect(banner!.type).toBe('banner')
    expect(banner!.settings).toMatchObject({ media: 'video', heading: 'Watch' })

    // Every alias converges too — none is left unhandled.
    const migrated = sanitizeSections(
      ALIASES.map((type, index) => ({ id: `s${index}`, type, settings: {} })),
    )
    const stillAliases = migrated.filter((section) =>
      (ALIASES as readonly string[]).includes(section.type),
    )
    expect(stillAliases).toEqual([])
  })

  test('a hidden preset is not offered but the plain presets are', () => {
    const hero = sectionSchema('hero')!
    expect(offeredPresets(hero).map((preset) => preset.key)).toEqual(['centered-full'])
    expect(hero.presets?.find((preset) => preset.key === 'split-buttons')?.hidden).toBe(true)
  })
})
