/**
 * The header's mobile bar.
 *
 * A phone gets one bar on every theme: a menu button with the brand beside
 * it, and search and the cart on the right. The account is not in the bar —
 * it rides at the bottom of the slide-in menu.
 */

import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'

import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

import { DEFAULT_THEME_SETTINGS } from '../src/index'
import type { MenuItem } from '../src/model/menus'
import {
  RenderProvider,
  sampleStorefrontData,
  StoreHeader,
  type ChromeShop,
  type RenderEnvironment,
} from '../src/render/index'

const shop: ChromeShop = { name: 'Toko Tamma', logoUrl: null, description: '', email: null }

const MENU: MenuItem[] = [
  { id: 'a', label: 'Men', link: { kind: 'home' }, children: [] },
  {
    id: 'b',
    label: 'Learn',
    link: { kind: 'none' },
    children: [{ id: 'b1', label: 'Guides', link: { kind: 'page', slug: 'guides' }, children: [] }],
  },
]

function env(): RenderEnvironment {
  return {
    data: sampleStorefrontData('Toko Tamma'),
    settings: DEFAULT_THEME_SETTINGS,
    mode: 'live',
    imageUrl: () => null,
    formatPrice: (amount, currency) => `${amount} ${currency}`,
    now: new Date('2026-03-10T00:00:00.000Z'),
  }
}

function render(node: ReactNode): string {
  return renderToString(
    <ChakraProvider value={system}>
      <I18nProvider locale="en" resources={{}}>
        <RenderProvider value={env()}>{node}</RenderProvider>
      </I18nProvider>
    </ChakraProvider>,
  )
}

function header(settings: Record<string, unknown>): string {
  return render(
    <StoreHeader
      header={{ layout: 'classic', sticky: true, showSearch: true, ...settings }}
      shop={shop}
      menu={MENU}
      searchField={<span>FIELD</span>}
      searchButton={<span>ICON</span>}
      cart={<span>CART</span>}
      account={<span>ACCOUNT</span>}
      drawerAccount={<span>ACCOUNT ROW</span>}
    />,
  )
}

describe('the phone bar', () => {
  test('shows the brand beside the menu, then search and the cart', () => {
    const html = header({})
    const mobile = html.slice(html.indexOf('data-mobile-bar'), html.indexOf('data-desktop-bar'))
    expect(mobile).toContain('CART')
    expect(mobile).toContain('ICON')
    expect(mobile).not.toContain('ACCOUNT')
    // The logo rides with the hamburger on the left, before the trailing icons.
    expect(mobile.indexOf('Toko Tamma')).toBeGreaterThan(-1)
    expect(mobile.indexOf('Toko Tamma')).toBeLessThan(mobile.indexOf('CART'))
  })

  test('the desktop bar keeps the cart and the account', () => {
    const html = header({})
    const desktop = html.slice(html.indexOf('data-desktop-bar'))
    expect(desktop).toContain('CART')
    expect(desktop).toContain('ACCOUNT')
  })

  test('the non-classic desktop bars keep the search icon', () => {
    for (const layout of ['centered', 'inline']) {
      const html = header({ layout })
      const desktop = html.slice(html.indexOf('data-desktop-bar'))
      expect(desktop, layout).toContain('ICON')
    }
  })

  test('the classic desktop uses the middle field instead of the icon', () => {
    const html = header({ layout: 'classic' })
    const desktop = html.slice(html.indexOf('data-desktop-bar'))
    expect(desktop).toContain('FIELD')
    expect(desktop).not.toContain('ICON')
  })

  test('a host with only an actions slot keeps it in both bars', () => {
    const html = render(
      <StoreHeader
        header={{ layout: 'classic', sticky: true, showSearch: true }}
        shop={shop}
        menu={MENU}
        actions={<span>ACTIONS</span>}
      />,
    )
    const mobile = html.slice(html.indexOf('data-mobile-bar'), html.indexOf('data-desktop-bar'))
    expect(mobile).toContain('ACTIONS')
    expect(html.slice(html.indexOf('data-desktop-bar'))).toContain('ACTIONS')
  })
})
