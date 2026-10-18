import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'

import {
  buildTemplateTheme,
  compileTheme,
  defaultThemeFiles,
  parseTemplateThemeBuild,
  signThemePreview,
  verifyThemePreview,
} from '../src/template'

import { renderTheme } from './template-harness'

describe('the platform default theme', () => {
  test('compiles cleanly and draws every themeable route', () => {
    const theme = compileTheme(defaultThemeFiles())
    expect(theme.diagnostics.map((diagnostic) => diagnostic.message)).toEqual([])
    for (const route of [
      'home',
      'product',
      'catalog',
      'search',
      'page',
      'article',
      'blog',
      'orderTracking',
      'cart',
    ] as const) {
      expect(theme.manifest.routes[route]).toBeDefined()
    }
    // Every host slot the default templates call is a registered one.
    expect(theme.manifest.snippets).toEqual(['product-card'])
  })

  test('packs into a build a theme row can hold', () => {
    const files = defaultThemeFiles()
    const build = buildTemplateTheme(compileTheme(files), files, { name: 'Pesanle default' })
    expect(parseTemplateThemeBuild(JSON.stringify(build))?.version).toBe(build.version)
    expect(JSON.stringify(build).length).toBeLessThan(190_000)
  })
})

describe('the default cart page', () => {
  const cart = {
    ready: true,
    empty: false,
    item_count: 2,
    subtotal: 938_000,
    currency: 'IDR',
    items: [
      {
        product_id: 'p-1',
        variant_id: null,
        name: 'Gown Malam',
        variant_name: 'M',
        slug: 'gown-malam',
        url: '/p/gown-malam',
        image_url: 'https://cdn.test/gown.jpg',
        price: 589_000,
        line_total: 589_000,
        quantity: 1,
        max_stock: 5,
        previous_price: null,
        requested_quantity: 1,
      },
      {
        product_id: 'p-2',
        variant_id: 'v-1',
        name: 'Ransel Harian',
        variant_name: null,
        slug: 'ransel-harian',
        url: '/p/ransel-harian',
        image_url: null,
        price: 349_000,
        line_total: 349_000,
        quantity: 1,
        max_stock: 3,
        previous_price: null,
        requested_quantity: 1,
      },
    ],
    unavailable: [],
  }

  test('draws the lines, calls the controls slot per line and places the checkout', () => {
    const { html } = renderTheme(defaultThemeFiles(), {
      route: 'cart',
      scope: { cart },
      env: {
        slots: {
          cartLineControls: (args) =>
            createElement('span', { className: 'controls' }, `controls:${args.line.product_id}`),
          cartUnavailable: createElement('div', { className: 'unavailable' }, 'gone'),
          cartCheckout: createElement('form', { className: 'checkout' }, 'checkout'),
        },
      },
    })

    expect(html).toContain('Your cart')
    expect(html).toContain('2 items')
    expect(html).toContain('Gown Malam')
    expect(html).toContain('IDR 589000')
    // The interactive leaves are the host's, one call per line plus the two
    // page-level slots.
    expect(html).toContain('controls:p-1')
    expect(html).toContain('controls:p-2')
    expect(html).toContain('gone')
    expect(html).toContain('checkout')
  })

  test('an empty cart draws the empty state and no lines', () => {
    const { html } = renderTheme(defaultThemeFiles(), {
      route: 'cart',
      scope: { cart: { ...cart, empty: true, item_count: 0, items: [] } },
    })

    expect(html).toContain('Your cart is empty')
    expect(html).toContain('Start shopping')
    expect(html).not.toContain('d-cart-line')
  })
})

describe('theme preview links', () => {
  const secret = 'test-secret'
  const version = '0123456789abcdef'

  test('a signed value verifies for its shop and version only', async () => {
    const value = await signThemePreview(secret, 'my-shop', version)
    expect(value.startsWith(`${version}.`)).toBe(true)

    expect(await verifyThemePreview(secret, 'my-shop', value)).toBe(version)
    expect(await verifyThemePreview(secret, 'other-shop', value)).toBeNull()
    expect(await verifyThemePreview('other-secret', 'my-shop', value)).toBeNull()
    expect(
      await verifyThemePreview(secret, 'my-shop', `${'f'.repeat(16)}.${value.split('.')[1]}`),
    ).toBeNull()
  })

  test('malformed values are simply not a preview', async () => {
    expect(await verifyThemePreview(secret, 'my-shop', null)).toBeNull()
    expect(await verifyThemePreview(secret, 'my-shop', '')).toBeNull()
    expect(await verifyThemePreview(secret, 'my-shop', 'nope')).toBeNull()
    expect(await verifyThemePreview(secret, 'my-shop', `${version}.short`)).toBeNull()
    expect(
      await verifyThemePreview(secret, 'my-shop', `not-a-version.${'a'.repeat(43)}`),
    ).toBeNull()
  })
})
