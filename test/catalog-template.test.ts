/**
 * The catalogue page template: one theme entry serving `/products`, a
 * category and a collection, with its header and product grid required.
 */

import { describe, expect, test } from 'bun:test'

import {
  createSection,
  defaultCatalogTemplate,
  sanitizeCatalogTemplate,
  sanitizeThemeContent,
} from '../src/index'

const types = (sections: { type: string }[]) => sections.map((section) => section.type)

describe('the catalogue template', () => {
  test('a theme saved before catalogue templates existed gets the default page', () => {
    const content = sanitizeThemeContent({})
    expect(types(content.templates.catalog)).toEqual(['catalog-header', 'catalog-products'])
  })

  test('an empty template reads as the default', () => {
    expect(types(sanitizeCatalogTemplate([]))).toEqual(['catalog-header', 'catalog-products'])
    expect(types(sanitizeCatalogTemplate(undefined))).toEqual(types(defaultCatalogTemplate()))
  })

  test('a missing header comes back at the top, a missing grid right after it', () => {
    const noHeader = sanitizeCatalogTemplate([
      createSection('rich-text', { heading: 'Sale' }),
      createSection('catalog-products'),
    ])
    expect(types(noHeader)).toEqual(['catalog-header', 'rich-text', 'catalog-products'])

    const noGrid = sanitizeCatalogTemplate([
      createSection('catalog-header'),
      createSection('rich-text', { heading: 'Sale' }),
    ])
    expect(types(noGrid)).toEqual(['catalog-header', 'catalog-products', 'rich-text'])
  })

  test('the product page cannot land on the catalogue, and the grid is catalogue-only', () => {
    const sections = sanitizeCatalogTemplate([
      createSection('product-info'),
      createSection('catalog-header'),
      createSection('catalog-products'),
      createSection('related-products'),
    ])
    expect(types(sections)).toEqual(['catalog-header', 'catalog-products'])
  })

  test('general sections are allowed above and below the grid', () => {
    const sections = sanitizeCatalogTemplate([
      createSection('hero', { heading: 'Sale' }),
      createSection('catalog-header'),
      createSection('catalog-products'),
      createSection('rich-text', { heading: 'About' }),
    ])
    // `hero` converges on the consolidated `banner`; the order is untouched.
    expect(types(sections)).toEqual(['banner', 'catalog-header', 'catalog-products', 'rich-text'])
  })

  test('a saved template survives a write and a read unchanged', () => {
    const saved = sanitizeThemeContent({
      templates: {
        catalog: [
          createSection('catalog-header', { filterStyle: 'underline', filterSticky: 'mobile' }),
          createSection('catalog-products', {
            columns: '5',
            tabletColumns: '4',
            mobileColumns: '1',
            pagination: 'compact',
          }),
        ],
      },
    })
    const again = sanitizeThemeContent(JSON.parse(JSON.stringify(saved)))
    expect(again.templates.catalog).toEqual(saved.templates.catalog)
  })
})
