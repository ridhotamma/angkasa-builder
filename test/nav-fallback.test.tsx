/**
 * Navigation fallbacks for shops with no configured menus.
 *
 * A fresh shop has no main/footer menu rows yet. The phone drawer must not
 * open blank — it falls back to the catalogue — while the desktop bar stays
 * clean and the footer lists every category and collection. A configured
 * menu always wins over the fallback.
 */

import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'

import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

import { DEFAULT_THEME_SETTINGS, sanitizeLayout } from '../src/index'
import {
  RenderProvider,
  StoreFooter,
  StoreHeader,
  type ChromeShop,
  type RenderEnvironment,
} from '../src/render/index'

const shop: ChromeShop = { name: 'Toko Baru', logoUrl: null, description: '', email: null }

function env(): RenderEnvironment {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { shop: { name: 'Toko Baru' } } as any,
    settings: DEFAULT_THEME_SETTINGS,
    mode: 'live',
    imageUrl: () => null,
    formatPrice: (amount, currency) => `${amount} ${currency}`,
    now: new Date('2026-03-10T00:00:00.000Z'),
  }
}

function render(node: ReactNode, locale = 'en'): string {
  return renderToString(
    <ChakraProvider value={system}>
      <I18nProvider locale={locale} resources={{}}>
        <RenderProvider value={env()}>{node}</RenderProvider>
      </I18nProvider>
    </ChakraProvider>,
  )
}

const CATS = [
  { id: '1', name: 'Kaos', slug: 'kaos' },
  { id: '2', name: 'Topi', slug: 'topi' },
]
const COLS = [{ id: 'c1', name: 'New Arrival', slug: 'new-arrival' }]

function headerHtml(opts: {
  menu?: Parameters<typeof StoreHeader>[0]['menu']
  categories?: { id: string; name: string; slug: string }[]
  collections?: { id: string; name: string; slug: string }[]
  header?: Record<string, unknown>
}) {
  // The drawer lazy-mounts its sheet, so render it open: that is the state
  // the "blank sheet" complaint is about.
  return render(
    <StoreHeader
      header={{ layout: 'classic', sticky: true, showSearch: true, ...opts.header }}
      shop={shop}
      menu={opts.menu ?? []}
      categories={opts.categories ?? []}
      collections={opts.collections ?? []}
      drawerDefaultOpen
      searchField={<span>FIELD</span>}
      searchButton={<span>ICON</span>}
      cart={<span>CART</span>}
      account={<span>ACCOUNT</span>}
      drawerAccount={<span>ACCOUNT ROW</span>}
    />,
  )
}

function footerHtml(opts: {
  menu?: Parameters<typeof StoreFooter>[0]['menu']
  categories?: { id: string; name: string; slug: string }[]
  collections?: { id: string; name: string; slug: string }[]
  pages?: { title: string; slug: string }[]
  footer?: Record<string, unknown>
  /** Supplied only by the tests that are about the order-tracking link. */
  trackOrder?: string
}) {
  return render(
    <StoreFooter
      footer={{ showPages: true, showContact: false, showSocials: false, ...opts.footer }}
      shop={shop}
      menu={opts.menu ?? []}
      categories={opts.categories ?? []}
      collections={opts.collections ?? []}
      pages={opts.pages ?? []}
      labels={{
        information: 'Information',
        followUs: 'Follow us',
        links: 'Links',
        trackOrder: opts.trackOrder,
      }}
      bottom="Powered"
    />,
  )
}

function desktopOf(html: string) {
  return html.slice(html.indexOf('data-desktop-bar'))
}

describe('navigation fallback for a shop with no menus', () => {
  test('brand-new shop: drawer has no catalog links, desktop stays clean, footer has no fallback', () => {
    const layout = sanitizeLayout(null)
    const h = headerHtml({ header: layout.header })
    const f = footerHtml({ footer: layout.footer })
    expect(h).not.toContain('/c/')
    expect(h).not.toContain('/k/')
    expect(desktopOf(h)).not.toContain('data-desktop-menu')
    expect(f).not.toContain('/c/')
    expect(f).not.toContain('/k/')
    // The hamburger itself still renders (account rows live in the sheet).
    expect(h).toContain('Menu')
  })

  test('categories only: drawer lists every category, desktop stays clean, footer lists them', () => {
    const h = headerHtml({ categories: CATS })
    const f = footerHtml({ categories: CATS })
    expect(h).toContain('Kaos')
    expect(h).toContain('Topi')
    expect(h).toContain('/c/kaos')
    expect(h).toContain('/c/topi')
    expect(desktopOf(h)).not.toContain('Kaos')
    expect(f).toContain('/c/kaos')
    expect(f).toContain('Categories')
  })

  test('both kinds: drawer and footer group them into collapsible Categories/Collections', () => {
    const h = headerHtml({ categories: CATS, collections: COLS })
    const f = footerHtml({ categories: CATS, collections: COLS })
    expect(h).toContain('Categories')
    expect(h).toContain('Collections')
    expect(h).toContain('/c/kaos')
    expect(h).toContain('/k/new-arrival')
    expect(desktopOf(h)).not.toContain('New Arrival')
    expect(f).toContain('/c/topi')
    expect(f).toContain('/k/new-arrival')
  })

  test('collections only: drawer lists them flat, footer has a Collections column', () => {
    const h = headerHtml({ collections: COLS })
    const f = footerHtml({ collections: COLS })
    expect(h).toContain('New Arrival')
    expect(h).not.toContain('Categories')
    expect(f).toContain('Collections')
    expect(f).toContain('/k/new-arrival')
  })

  test('customized theme (centered + tab bar, pages off): fallback stays in drawer, desktop stays clean', () => {
    const layout = sanitizeLayout({
      header: { layout: 'centered', mobileNav: 'tabs' },
      footer: { showPages: false },
    })
    const h = headerHtml({ header: layout.header, categories: CATS, collections: COLS })
    const f = footerHtml({
      footer: layout.footer,
      categories: CATS,
      collections: COLS,
      pages: [{ title: 'About', slug: 'about' }],
    })
    expect(h).toContain('Kaos')
    expect(h).toContain('/k/new-arrival')
    expect(desktopOf(h)).not.toContain('Kaos')
    expect(f).not.toContain('About')
    expect(f).toContain('/c/kaos')
  })

  test('configured menus win over the catalogue', () => {
    const main = [{ id: 'm1', label: 'Sale', link: { kind: 'catalog' as const }, children: [] }]
    const foot = [
      {
        id: 'f1',
        label: 'Shop',
        link: { kind: 'none' as const },
        children: [{ id: 'f1a', label: 'Sale', link: { kind: 'catalog' as const }, children: [] }],
      },
    ]
    const h = headerHtml({ menu: main, categories: CATS, collections: COLS })
    const f = footerHtml({ menu: foot, categories: CATS, collections: COLS })
    expect(h).toContain('Sale')
    expect(h).not.toContain('Categories')
    expect(f).toContain('Shop')
    expect(f).not.toContain('/c/kaos')
  })

  test('footer pages coexist with the catalog fallback', () => {
    const f = footerHtml({
      categories: CATS,
      collections: COLS,
      pages: [{ title: 'About', slug: 'about' }],
    })
    expect(f).toContain('About')
    expect(f).toContain('/c/kaos')
  })

  test('starter plan (no published theme, default layout): fallback still applies', () => {
    // getStorefrontThemeChrome returns sanitizeLayout(null) with no published
    // theme — exactly what a starter-plan shop without theme access resolves
    // to — and the fallback never reads theme settings.
    const layout = sanitizeLayout(null)
    const h = headerHtml({ header: layout.header, categories: CATS })
    expect(h).toContain('Kaos')
    expect(desktopOf(h)).not.toContain('Kaos')
  })

  test('group labels follow the shopper locale', () => {
    const h = render(
      <StoreHeader
        header={{ layout: 'classic', sticky: true, showSearch: true }}
        shop={shop}
        menu={[]}
        categories={CATS}
        collections={COLS}
        drawerDefaultOpen
        searchButton={<span>ICON</span>}
        cart={<span>CART</span>}
        account={<span>ACCOUNT</span>}
      />,
      'id',
    )
    expect(h).toContain('Kategori')
    expect(h).toContain('Koleksi')
  })

  describe('the built-in order-tracking link', () => {
    test('a fresh shop leads to the tracking page without configuring anything', () => {
      // No footer menu: the shop's own tracking page is drawn beside its pages.
      const f = footerHtml({
        footer: { showOrderTracking: true },
        pages: [{ title: 'Privacy', slug: 'kebijakan-privasi' }],
        trackOrder: 'Track order',
      })
      expect(f).toContain('/track-order')
      expect(f).toContain('Track order')
    })

    test('shown even when there are no pages to list', () => {
      const f = footerHtml({ footer: { showOrderTracking: true }, trackOrder: 'Track order' })
      expect(f).toContain('/track-order')
    })

    test('off when the seller turns it off, and no host label means no link', () => {
      const off = footerHtml({ footer: { showOrderTracking: false }, trackOrder: 'Track order' })
      expect(off).not.toContain('/track-order')
      const unlabelled = footerHtml({ footer: { showOrderTracking: true } })
      expect(unlabelled).not.toContain('/track-order')
    })

    test('a configured footer menu wins, as it does for the pages', () => {
      const foot = [{ id: 'f1', label: 'Shop', link: { kind: 'none' as const }, children: [] }]
      const f = footerHtml({ menu: foot, footer: { showOrderTracking: true }, trackOrder: 'Lacak' })
      expect(f).not.toContain('/track-order')
    })
  })
})
