/**
 * The phone's bottom tab bar and the bold look.
 *
 * A header set to `mobileNav: 'tabs'` keeps the menu button and search in the
 * phone's top bar and moves the cart and account down into `StoreTabBar`,
 * whose own tabs are home, the catalogue, the cart and the account. The bold
 * card and button styles are Quick Checkout's hard frame, read through the
 * storefront's ink.
 */

import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { LuShoppingBag } from 'react-icons/lu'

import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

import { DEFAULT_THEME_SETTINGS, sanitizeThemeSettings, type ThemeSettings } from '../src/index'
import { sanitizeLayout } from '../src/model/layout'
import type { MenuItem } from '../src/model/menus'
import {
  BOLD_INK,
  buttonLook,
  cardFrame,
  RenderProvider,
  sampleStorefrontData,
  StoreHeader,
  StoreTab,
  StoreTabBar,
  TABBAR_HEIGHT_VAR,
  type ChromeShop,
  type RenderEnvironment,
} from '../src/render/index'

const shop: ChromeShop = { name: 'Toko Tamma', logoUrl: null, description: '', email: null }

const MENU: MenuItem[] = [{ id: 'a', label: 'Men', link: { kind: 'home' }, children: [] }]

function render(node: ReactNode, settings: ThemeSettings = DEFAULT_THEME_SETTINGS): string {
  const env: RenderEnvironment = {
    data: sampleStorefrontData('Toko Tamma'),
    settings,
    mode: 'live',
    imageUrl: () => null,
    formatPrice: (amount, currency) => `${amount} ${currency}`,
    now: new Date('2026-03-10T00:00:00.000Z'),
  }
  return renderToString(
    <ChakraProvider value={system}>
      <I18nProvider locale="en" resources={{}}>
        <RenderProvider value={env}>{node}</RenderProvider>
      </I18nProvider>
    </ChakraProvider>,
  )
}

function tabBar(header: Record<string, unknown>, settings?: ThemeSettings): string {
  return render(
    <StoreTabBar
      header={header}
      homeActive
      cart={<span>CART TAB</span>}
      account={<span>ACCOUNT TAB</span>}
    />,
    settings,
  )
}

describe('the tab bar', () => {
  test('draws nothing while the header keeps the menu button', () => {
    expect(tabBar({})).not.toContain('data-tabbar')
    expect(tabBar({ mobileNav: 'menu' })).not.toContain('data-tabbar')
  })

  test('draws home, the catalog and the host’s tabs, in that order', () => {
    const html = tabBar({ mobileNav: 'tabs' })
    const order = ['Home', 'Catalog', 'CART TAB', 'ACCOUNT TAB'].map((label) => html.indexOf(label))
    expect(order.every((at) => at > -1)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(html).toContain('aria-current="page"')
  })

  test('the catalog tab points at the catalogue, and the menu is not a tab', () => {
    const html = tabBar({ mobileNav: 'tabs' })
    expect(html).toContain('href="/products"')
    // The whole menu lives in the header's hamburger drawer now.
    expect(html).not.toContain('aria-label="Menu"')
  })

  test('takes room in the page and publishes its height', () => {
    const html = tabBar({ mobileNav: 'tabs' })
    expect(html).toContain('data-tabbar-spacer')
    expect(html).toContain(`${TABBAR_HEIGHT_VAR}:calc(4rem`)
  })

  test('the tab layout keeps the menu and search in the phone bar', () => {
    const html = render(
      <StoreHeader
        header={{ layout: 'classic', showSearch: true, mobileNav: 'tabs' }}
        shop={shop}
        menu={MENU}
        searchButton={<span>ICON</span>}
        cart={<span>CART</span>}
      />,
    )
    const mobile = html.slice(html.indexOf('data-mobile-bar'), html.indexOf('data-desktop-bar'))
    expect(mobile).toContain('Toko Tamma')
    expect(mobile).toContain('aria-label="Menu"')
    expect(mobile).toContain('ICON')
    // The cart stays a tab below; the top bar does not repeat it.
    expect(mobile).not.toContain('CART')
  })

  test('a tab shows its count, capped at 99+', () => {
    const html = render(<StoreTab icon={LuShoppingBag} label="Cart" badge={120} />)
    expect(html).toContain('99+')
    expect(render(<StoreTab icon={LuShoppingBag} label="Cart" badge={0} />)).not.toContain('99+')
  })

  test('the layout keeps the choice and falls back to the menu button', () => {
    expect(sanitizeLayout({ header: { mobileNav: 'tabs' } }).header.mobileNav).toBe('tabs')
    expect(sanitizeLayout({ header: { mobileNav: 'drawer' } }).header.mobileNav).toBe('menu')
    expect(sanitizeLayout({}).header.mobileNav).toBe('menu')
  })
})

describe('the bold look', () => {
  test('is a card and button style a theme can save', () => {
    const saved = sanitizeThemeSettings({ buttonStyle: 'hard', cardStyle: 'hard' })
    expect(saved.buttonStyle).toBe('hard')
    expect(saved.cardStyle).toBe('hard')
  })

  test('frames cards and buttons in the scheme’s ink', () => {
    expect(cardFrame('hard')).toMatchObject({
      borderWidth: '2px',
      borderColor: BOLD_INK,
      boxShadow: `4px 4px 0 ${BOLD_INK}`,
    })
    const look = buttonLook('hard')
    expect(look.variant).toBe('solid')
    expect(look.boxShadow).toBe(`3px 3px 0 ${BOLD_INK}`)
    expect(look._active).toEqual({ transform: 'translate(3px, 3px)', boxShadow: 'none' })
    // The other styles carry no frame of their own.
    expect(buttonLook('solid')).toEqual({ variant: 'solid', rounded: 'l2' })
  })

  test('the active tab becomes a chip on its own shadow', () => {
    const bold = { ...DEFAULT_THEME_SETTINGS, cardStyle: 'hard' as const }
    const html = tabBar({ mobileNav: 'tabs' }, bold)
    expect(html).toContain('2px 2px 0 var(--chakra-colors-fg)')
  })
})
