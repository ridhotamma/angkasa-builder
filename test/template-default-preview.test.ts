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
  test('compiles cleanly, draws every themeable route and leaves no syntax behind', () => {
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
      'account',
      'accountOrders',
      'accountAddresses',
      'accountRewards',
      'accountWishlist',
    ] as const) {
      expect(theme.manifest.routes[route]).toBeDefined()
      // A directive that lands in an attribute value renders literally — the
      // bug the catalog's chips once shipped. Nothing unrendered may survive.
      const { html } = renderTheme(defaultThemeFiles(), { route })
      expect(html).not.toContain('{%')
      expect(html).not.toContain('{{')
      expect(html).not.toContain('%}')
      expect(html).not.toContain('}}')
    }
    // Every host slot the default templates call is a registered one.
    expect(theme.manifest.snippets).toEqual(['account-nav', 'product-card'])
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

describe('the default account pages', () => {
  const customer = {
    ready: true,
    name: 'Sari',
    email: 'sari@example.com',
    phone: '+628123',
  }

  test('the profile page draws the customer, the nav and its three leaves', () => {
    const { html } = renderTheme(defaultThemeFiles(), {
      route: 'account',
      scope: { customer },
      env: {
        slots: {
          accountProfile: createElement('span', { className: 'profile-form' }, 'profile-form'),
          accountPassword: createElement('span', { className: 'password-card' }, 'password-card'),
          accountSignOut: createElement('span', { className: 'sign-out' }, 'sign-out'),
        },
      },
    })

    expect(html).toContain('Hello, Sari')
    expect(html).toContain('profile-form')
    expect(html).toContain('password-card')
    expect(html).toContain('sign-out')
    // The nav marks the profile tab, and only it.
    expect(html).toContain('d-account-tab--active')
    expect((html.match(/d-account-tab--active/g) ?? []).length).toBe(1)
    expect(html).toContain('href="/account/orders"')
  })

  test('the orders page draws the history and its labels', () => {
    const order = {
      order_number: 'INV-1',
      url: '/orders/INV-1?t=tok',
      status: 'shipped',
      status_label: 'Dikirim',
      payment_label: 'Menunggu pembayaran',
      payment_method: 'Transfer BCA',
      review_pending: true,
      review_label: 'Write a review',
      placed_at: '2026-10-01T09:00:00.000Z',
      placed_at_label: '1 Okt 2026, 16.00',
      item_count: 2,
      item_count_label: '2 item',
      total: 178_000,
      expires_at: null,
    }
    const { html } = renderTheme(defaultThemeFiles(), {
      route: 'accountOrders',
      scope: { customer: { ...customer, orders: [order], orders_truncated: false } },
    })

    expect(html).toContain('INV-1')
    expect(html).toContain('/orders/INV-1?t=tok')
    expect(html).toContain('Dikirim')
    expect(html).toContain('Menunggu pembayaran')
    expect(html).toContain('Write a review')
    expect(html).toContain('IDR 178000')
    expect(html).toContain('d-account-tab--active')
  })

  test('an empty history draws the empty state', () => {
    const { html } = renderTheme(defaultThemeFiles(), {
      route: 'accountOrders',
      scope: { customer: { ...customer, orders: [], orders_truncated: false } },
    })
    expect(html).toContain('No orders yet')
    expect(html).not.toContain('d-order"')
  })

  test('the rewards page draws the balance and calls the claim and copy slots', () => {
    const reward = {
      id: 'r-1',
      kind: 'voucher',
      name: 'Diskon Rp20.000',
      description: null,
      points_cost: 500,
      claimable: true,
      status_label: '2 claims left',
    }
    const claim = {
      id: 'c-1',
      reward_name: 'Diskon Rp20.000',
      code: 'LOVE-1234',
      points: 500,
      redeemed_at_label: '5 Okt 2026',
      used: false,
    }
    const { html } = renderTheme(defaultThemeFiles(), {
      route: 'accountRewards',
      scope: {
        customer: {
          ...customer,
          rewards: {
            balance: 1200,
            lifetime_points: 4200,
            currency: 'IDR',
            tier: { name: 'Silver', color: 'gray', earn_multiplier: 110 },
            next_tier: { name: 'Gold', points_to_next: 800, progress_percent: 40 },
            at_top_tier: false,
            rewards: [reward],
            claims: [claim],
          },
        },
      },
      env: {
        slots: {
          rewardClaim: (args) => createElement('button', null, `claim:${args.reward.id}`),
          rewardCopy: (args) => createElement('button', null, `copy:${args.claim.code}`),
        },
      },
    })

    expect(html).toContain('1200')
    expect(html).toContain('Silver')
    expect(html).toContain('Gold')
    expect(html).toContain('Diskon Rp20.000')
    expect(html).toContain('2 claims left')
    expect(html).toContain('claim:r-1')
    expect(html).toContain('LOVE-1234')
    expect(html).toContain('copy:LOVE-1234')
  })

  test('the wishlist draws cards and calls the heart per product', () => {
    const { html } = renderTheme(defaultThemeFiles(), {
      route: 'accountWishlist',
      scope: {
        customer: {
          ...customer,
          wishlist: {
            currency: 'IDR',
            products: [
              {
                id: 'p-1',
                name: 'Kaos Katun Combed',
                slug: 'kaos-katun-combed',
                price: 89_000,
                compare_at_price: 109_000,
                on_sale: true,
                image_url: 'https://cdn.test/kaos.jpg',
                url: '/p/kaos-katun-combed',
              },
            ],
          },
        },
      },
      env: {
        slots: {
          wishlistToggle: (args) => createElement('button', null, `heart:${args.product.id}`),
        },
      },
    })

    expect(html).toContain('Kaos Katun Combed')
    expect(html).toContain('/p/kaos-katun-combed')
    expect(html).toContain('heart:p-1')
    expect(html).toContain('IDR 89000')
  })

  test('an empty wishlist draws the empty state', () => {
    const { html } = renderTheme(defaultThemeFiles(), {
      route: 'accountWishlist',
      scope: { customer: { ...customer, wishlist: { currency: 'IDR', products: [] } } },
    })
    expect(html).toContain('Nothing saved yet')
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
