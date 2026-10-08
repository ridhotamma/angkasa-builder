/**
 * The catalogue page's sections, drawn with a listing: the header and its
 * category filter, the product grid with its responsive columns, and every
 * pagination style.
 */

import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'

import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

import { createSection, DEFAULT_THEME_SETTINGS } from '../src/index'
import {
  RenderProvider,
  sampleStorefrontData,
  SectionsRenderer,
  type RenderEnvironment,
  type StorefrontListingData,
} from '../src/render/index'
import { pageItems } from '../src/render/catalog-page'

function listing(overrides: Partial<StorefrontListingData> = {}): StorefrontListingData {
  return {
    title: 'Kaos',
    description: 'Semua kaos di toko ini.',
    total: 30,
    page: 1,
    pages: 2,
    products: sampleStorefrontData('Toko').latest.slice(0, 3),
    categories: [
      { id: 'c1', name: 'Kaos', slug: 'kaos' },
      { id: 'c2', name: 'Jaket', slug: 'jaket' },
    ],
    current: null,
    ...overrides,
  }
}

function env(data: Partial<StorefrontListingData> = {}): RenderEnvironment {
  return {
    data: { ...sampleStorefrontData('Toko'), listing: listing(data) },
    settings: DEFAULT_THEME_SETTINGS,
    mode: 'live',
    imageUrl: () => null,
    formatPrice: (amount, currency) => `${amount} ${currency}`,
    pageHref: (page) => (page <= 1 ? '/products' : `/products?page=${page}`),
    now: new Date('2026-03-10T00:00:00.000Z'),
  }
}

function render(node: ReactNode, data: Partial<StorefrontListingData> = {}): string {
  return renderToString(
    <ChakraProvider value={system}>
      <I18nProvider locale="en" resources={{}}>
        <RenderProvider value={env(data)}>{node}</RenderProvider>
      </I18nProvider>
    </ChakraProvider>,
  )
}

function catalog(settings: Record<string, unknown> = {}): string {
  return render(
    <SectionsRenderer
      sections={[createSection('catalog-header'), createSection('catalog-products', settings)]}
      env={env()}
    />,
  )
}

describe('the editor preview', () => {
  test('falls back to the sample listing when the host has none', () => {
    const html = renderToString(
      <ChakraProvider value={system}>
        <I18nProvider locale="en" resources={{}}>
          <SectionsRenderer
            sections={[createSection('catalog-header'), createSection('catalog-products')]}
            env={{ ...env(), mode: 'preview', data: sampleStorefrontData('Toko') }}
          />
        </I18nProvider>
      </ChakraProvider>,
    )
    expect(html).toContain('All products')
    expect(html).toContain('Signature tote')
  })
})

describe('the catalogue header', () => {
  test('draws the title, the description, the count and the category chips', () => {
    const html = catalog()
    expect(html).toContain('Kaos')
    expect(html).toContain('Semua kaos di toko ini.')
    expect(html).toContain('30 products')
    expect(html).toContain('All')
    expect(html).toContain('Jaket')
    expect(html).toContain('href="/products?category=jaket"')
  })

  test('marks the chip of the category being shown', () => {
    const html = render(
      <SectionsRenderer
        sections={[createSection('catalog-header'), createSection('catalog-products')]}
        env={env({
          current: { kind: 'category', name: 'Kaos', slug: 'kaos' },
        })}
      />,
    )
    expect(html).toContain('aria-current="page"')
    expect(html).toContain('href="/products?category=kaos"')
  })

  test('the dropdown style is a select over the same categories', () => {
    const html = render(
      <SectionsRenderer
        sections={[
          createSection('catalog-header', { filterStyle: 'select' }),
          createSection('catalog-products'),
        ]}
        env={env()}
      />,
    )
    expect(html).toContain('<select')
    expect(html).toContain('Jaket')
  })

  test('a sticky filter emits the sticky position', () => {
    const html = render(
      <SectionsRenderer
        sections={[
          createSection('catalog-header', { filterSticky: 'always' }),
          createSection('catalog-products'),
        ]}
        env={env()}
      />,
    )
    expect(html).toContain('position:sticky')
  })

  test('a static filter does not', () => {
    const html = catalog()
    expect(html).not.toContain('position:sticky')
  })
})

describe('the catalogue grid', () => {
  test('draws the listing products in a responsive grid', () => {
    const html = catalog({ columns: '5', tabletColumns: '3', mobileColumns: '1' })
    expect(html).toContain('data-product-layout="catalog"')
    // The sample listing's first card is on the page.
    expect(html).toContain('Signature tote')
    // Three breakpoints, from the three column settings.
    expect(html).toContain('grid-template-columns:repeat(1, minmax(0, 1fr))')
    expect(html).toContain('repeat(3, minmax(0, 1fr))')
    expect(html).toContain('repeat(5, minmax(0, 1fr))')
  })

  test('an empty listing says so', () => {
    const html = render(
      <SectionsRenderer
        sections={[createSection('catalog-products')]}
        env={env({ products: [] })}
      />,
    )
    expect(html).toContain('No products to show yet.')
  })
})

describe('the catalogue pagination', () => {
  const pagination = (style: string) =>
    render(
      <SectionsRenderer
        sections={[
          createSection('catalog-products', { pagination: style, paginationAlign: 'start' }),
        ]}
        env={env()}
      />,
    )

  test('numbers link to the other pages and mark the current one', () => {
    const html = pagination('numbers')
    expect(html).toContain('href="/products?page=2"')
    expect(html).toContain('aria-current="page"')
  })

  test('simple shows previous and next with the page count', () => {
    const html = pagination('simple')
    expect(html).toContain('Page 1 of 2')
    expect(html).toContain('Next page')
  })

  test('compact shows the page count alone', () => {
    const html = pagination('compact')
    expect(html).toContain('Page 1 of 2')
  })

  test('none draws no pager at all', () => {
    expect(pagination('none')).not.toContain('Page 1 of 2')
  })

  test('a single page never draws one', () => {
    const html = render(
      <SectionsRenderer sections={[createSection('catalog-products')]} env={env({ pages: 1 })} />,
    )
    expect(html).not.toContain('Page 1 of 1')
  })

  test('pageItems lists the ends and the current neighbours', () => {
    expect(pageItems(1, 1)).toEqual([1])
    expect(pageItems(1, 3)).toEqual([1, 2, 3])
    expect(pageItems(4, 10)).toEqual([1, 'gap', 3, 4, 5, 'gap', 10])
    expect(pageItems(10, 10)).toEqual([1, 'gap', 9, 10])
  })
})
