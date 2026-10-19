import { describe, expect, test } from 'bun:test'

import {
  createSection,
  isSectionAllowed,
  isSectionOffered,
  offeredPresets,
  sanitizeSections,
  SECTION_SCHEMAS,
  sectionSchema,
  type SectionScope,
} from '../src/index'

/** Sections kept in the library but withdrawn from the "Add section" picker. */
const HIDDEN = ['spin-360', 'pinned-scroll'] as const

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

    const kept = sanitizeSections(HIDDEN.map((type, index) => ({ id: `s${index}`, type })))
    expect(kept.map((section) => section.type)).toEqual([...HIDDEN])
  })

  test('the offer filter is the allowed set minus the hidden', () => {
    // A family type is what the seller sees.
    expect(isSectionOffered(sectionSchema('banner')!, 'home')).toBe(true)
    // A product-page-only section is not offered on the home page.
    expect(isSectionOffered(sectionSchema('product-info')!, 'home')).toBe(false)
    // The Blocks composer stays available everywhere it was.
    expect(isSectionOffered(sectionSchema('blocks')!, 'page')).toBe(true)
  })

  test('every section has an icon and a category', () => {
    for (const schema of SECTION_SCHEMAS) {
      expect(schema.icon.length, schema.type).toBeGreaterThan(0)
      expect(schema.category.length, schema.type).toBeGreaterThan(0)
    }
  })

  test('the table preset is offered', () => {
    expect(offeredPresets(sectionSchema('table')!).map((preset) => preset.key)).toEqual([
      'size-chart',
    ])
  })

  test('a type that is not in the catalogue is dropped, not kept', () => {
    const kept = sanitizeSections([{ id: 'a', type: 'hero', settings: {} }])
    expect(kept).toEqual([])
  })

  test('section types are unique', () => {
    const types = SECTION_SCHEMAS.map((schema) => schema.type)
    expect(new Set(types).size).toBe(types.length)
  })
})
