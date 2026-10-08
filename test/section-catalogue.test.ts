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

  test('the offer filter is the allowed set minus the hidden', () => {
    expect(isSectionOffered(sectionSchema('hero')!, 'home')).toBe(true)
    // A product-page-only section is not offered on the home page.
    expect(isSectionOffered(sectionSchema('product-info')!, 'home')).toBe(false)
    // The Blocks composer stays available everywhere it was.
    expect(isSectionOffered(sectionSchema('blocks')!, 'page')).toBe(true)
  })

  test('a hidden preset is not offered but the plain section and its other presets are', () => {
    const hero = sectionSchema('hero')!
    expect(offeredPresets(hero).map((preset) => preset.key)).toEqual(['centered-full'])
    expect(hero.presets?.find((preset) => preset.key === 'split-buttons')?.hidden).toBe(true)
    // The section itself is still offered, so it can be built from the plain card.
    expect(isSectionOffered(hero, 'home')).toBe(true)
  })
})
