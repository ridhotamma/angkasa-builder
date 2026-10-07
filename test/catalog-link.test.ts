import { describe, expect, test } from 'bun:test'

import { sanitizeLink, storefrontHref } from '../src/model/links'

describe('the catalogue link', () => {
  test('points at /products, opened on a category when one is chosen', () => {
    expect(storefrontHref({ kind: 'catalog' })).toBe('/products')
    expect(storefrontHref({ kind: 'catalog', category: 'minuman-soda' })).toBe(
      '/products?category=minuman-soda',
    )
  })

  test('a bad category is the unfiltered catalogue, not a broken link', () => {
    expect(sanitizeLink({ kind: 'catalog', category: 'Not A Slug!' })).toEqual({ kind: 'catalog' })
    expect(sanitizeLink({ kind: 'catalog', category: 'soda' })).toEqual({
      kind: 'catalog',
      category: 'soda',
    })
  })
})
