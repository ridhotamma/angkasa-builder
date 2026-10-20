/**
 * The product detail page's two-column split.
 *
 * The photo column shows the product's first photo and nothing else: there is
 * no thumbnail strip, photo grid, stack or mosaic. The details column keeps
 * the buy box's own rows, in the storefront's order.
 */

import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import { renderToString } from 'react-dom/server'

import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

import { createSection, DEFAULT_THEME_SETTINGS, sectionSchema } from '../src/index'
import {
  RenderProvider,
  sampleStorefrontData,
  SectionsRenderer,
  type RenderEnvironment,
  type StorefrontProductDetail,
} from '../src/render/index'

/** A product with enough photos that a gallery would have something to list. */
function product(images: number): StorefrontProductDetail {
  return {
    id: 'product-1',
    name: 'Topi Bucket',
    slug: 'topi-bucket',
    price: 70_000,
    compareAtPrice: null,
    images: Array.from({ length: images }, (_, index) => ({
      url: `https://example.com/photo-${index}.jpg`,
      thumbUrl: `https://example.com/thumb-${index}.jpg`,
    })),
    description: 'Bucket hat katun, melindungi dari matahari.',
    rating: 4.8,
    ratingCount: 126,
    available: 4,
    category: { name: 'Apparel', slug: 'apparel' },
    sizeGuide: null,
    related: [],
  }
}

function env(withProduct?: StorefrontProductDetail): RenderEnvironment {
  const data = sampleStorefrontData('Product Shop')
  return {
    data: withProduct ? { ...data, product: withProduct } : data,
    settings: { ...DEFAULT_THEME_SETTINGS, splash: { ...DEFAULT_THEME_SETTINGS.splash } },
    // Preview mode supplies the stand-in product and the buy-button stand-in,
    // which is what the editor shows for this section.
    mode: 'preview',
    imageUrl: () => null,
    formatPrice: (amount, currency) => `${amount} ${currency}`,
    now: new Date('2026-03-10T00:00:00.000Z'),
  }
}

function page(
  settings: Record<string, unknown> = {},
  withProduct?: StorefrontProductDetail,
): string {
  return renderToString(
    <ChakraProvider value={system}>
      <I18nProvider locale="en" resources={{}}>
        <RenderProvider value={env(withProduct)}>
          <SectionsRenderer
            sections={[createSection('product-info', { stickyInfo: true, ...settings })]}
            env={env(withProduct)}
          />
        </RenderProvider>
      </I18nProvider>
    </ChakraProvider>,
  )
}

describe('the product detail page', () => {
  test('there is no photo-layout choice any more', () => {
    const fields = sectionSchema('product-info')!.fields
    expect(fields.some((field) => field.key === 'gallery')).toBe(false)
  })

  test('only the first product photo is drawn', () => {
    const html = page({}, product(5))
    expect(html).toContain('https://example.com/photo-0.jpg')
    expect(html).not.toContain('https://example.com/photo-1.jpg')
    expect(html).not.toContain('https://example.com/thumb-1.jpg')
  })

  test('the thumbnail strip and fullscreen viewer are gone', () => {
    const html = page({}, product(5))
    expect(html).not.toContain('View all photos')
    expect(html).not.toContain('data-slider-band')
  })

  test('the hover zoom is a theme’s choice, off unless it asks', () => {
    // The setting is offered, and starts off. The pointer test in
    // `product-gallery.interaction` is where the photo itself grows.
    const field = sectionSchema('product-info')!.fields.find(
      (candidate) => candidate.key === 'zoom',
    )
    expect(field?.kind === 'boolean' && field.default).toBe(false)
  })

  test('the buy box stand-in draws the storefront’s own rows, in its order', () => {
    // The picker's stock line and size axis, the rule, then the quantity and
    // the two actions — the storefront's box, row for row, so the canvas is
    // what the seller is laying the page out over. The note is the editor's.
    const html = page({}, product(1))
    const text = html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, '|')
    let at = -1
    for (const row of [
      '4 in stock',
      'Size',
      '— M',
      'S',
      'M',
      'L',
      'XL',
      'Quantity',
      'Buy now',
      'Add to cart',
      'appear here on the storefront',
    ]) {
      const found = text.indexOf(row, at + 1)
      expect(found, row).toBeGreaterThan(at)
      at = found
    }
    // The outline action wears the very bag the storefront's own wears; the
    // primary has no icon there, and neither has one here.
    expect(html).toMatch(/<button[^>]*>(?:<style[\s\S]*?<\/style>)*<svg[\s\S]*?<\/svg>Add to cart/)
  })
})
