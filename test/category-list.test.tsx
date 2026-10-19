/**
 * The category rail's list layout: each category's name large, one per row,
 * with its best sellers brought in on hover.
 */

import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import { renderToString } from 'react-dom/server'

import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

import {
  CATEGORY_PREVIEW_PRODUCTS,
  categoryPreviewCount,
  createSection,
  DEFAULT_THEME_SETTINGS,
  sectionSchema,
} from '../src/index'
import {
  sampleStorefrontData,
  SectionsRenderer,
  type RenderEnvironment,
  type StorefrontRenderData,
} from '../src/render/index'

function renderRail(settings: Record<string, unknown>, data?: StorefrontRenderData): string {
  const env: RenderEnvironment = {
    data: data ?? sampleStorefrontData('Kopi Kita'),
    settings: DEFAULT_THEME_SETTINGS,
    mode: 'live',
    imageUrl: () => null,
    formatPrice: (amount, currency) => `${amount} ${currency}`,
  }
  return renderToString(
    <ChakraProvider value={system}>
      <I18nProvider locale="en" resources={{}}>
        <SectionsRenderer sections={[createSection('category-rail', settings)]} env={env} />
      </I18nProvider>
    </ChakraProvider>,
  )
}

describe('category rail list layout', () => {
  test('is offered beside tiles and bento', () => {
    const field = sectionSchema('category-rail')!.fields.find((f) => f.key === 'layout')
    expect(field?.kind === 'select' && field.options.map((option) => option.value)).toEqual([
      'tiles',
      'bento',
      'list',
    ])
  })

  test('writes every category as a row linking to it', () => {
    const html = renderRail({ layout: 'list' })
    expect(html.match(/data-category-row/g)?.length).toBe(6)
    expect(html).toContain('href="/c/apparel"')
    expect(html).toContain('Accessories')
  })

  test('previews each category’s best sellers, each linking to its product', () => {
    const html = renderRail({ layout: 'list' })
    expect(html.match(/data-category-preview/g)?.length).toBe(6 * CATEGORY_PREVIEW_PRODUCTS)
    expect(html).toMatch(/href="\/p\/[^"]+"/)
    // Staggered: each photo arrives a step after the one before it.
    expect(html).toContain('transition-delay:60ms')
    expect(html).toContain('transition-delay:180ms')
  })

  test('comes in three sizes, medium unless the seller picks one', () => {
    const field = sectionSchema('category-rail')!.fields.find((f) => f.key === 'listSize')
    expect(field?.kind === 'select' && field.default).toBe('md')
    // Each size writes its names at a different top font size. Matched as a
    // use (`var(…)`): the global stylesheet defines every token regardless.
    const uses = (html: string, token: string) => html.includes(`var(--chakra-font-sizes-${token})`)
    expect(uses(renderRail({ layout: 'list', listSize: 'lg' }), '5xl')).toBe(true)
    expect(uses(renderRail({ layout: 'list' }), '5xl')).toBe(false)
    expect(uses(renderRail({ layout: 'list' }), '3xl')).toBe(true)
    expect(uses(renderRail({ layout: 'list', listSize: 'sm' }), '3xl')).toBe(false)
  })

  test('a category with no products is just its name', () => {
    const data = sampleStorefrontData('Kopi Kita')
    data.categories = data.categories.map(({ products: _products, ...category }) => category)
    const html = renderRail({ layout: 'list' }, data)
    expect(html).not.toContain('data-category-preview')
    expect(html.match(/data-category-row/g)?.length).toBe(6)
  })
})

describe('categoryPreviewCount', () => {
  test('reads nothing unless a category rail is drawn as a list', () => {
    expect(categoryPreviewCount([createSection('category-rail', { layout: 'tiles' })])).toBe(0)
    expect(categoryPreviewCount([createSection('product-list', { source: 'latest' })])).toBe(0)
  })

  test('takes the largest list limit on the page', () => {
    expect(
      categoryPreviewCount([
        createSection('category-rail', { layout: 'list', limit: 6 }),
        createSection('category-rail', { layout: 'list', limit: 10 }),
        createSection('category-rail', { layout: 'bento', limit: 24 }),
      ]),
    ).toBe(10)
  })
})
