/**
 * The storefront header's search: one control per screen size.
 *
 * The phone bar carries the icon beside the cart — one bar on every page and
 * in every header state — while the classic layout's desktop keeps the full
 * box in its middle column. The icon is whatever the host slots in; a theme
 * that hides search draws neither.
 */

import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'

import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

import { DEFAULT_THEME_SETTINGS } from '../src/index'
import {
  RenderProvider,
  sampleStorefrontData,
  StoreHeader,
  type ChromeShop,
  type RenderEnvironment,
} from '../src/render/index'

const shop: ChromeShop = { name: 'Toko Tamma', logoUrl: null, description: '', email: null }

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

function headerHtml({
  transparent,
  layout = 'centered',
  showSearch = true,
  mobileNav,
}: {
  transparent: boolean
  layout?: string
  showSearch?: boolean
  mobileNav?: string
}): string {
  return render(
    <StoreHeader
      header={{ layout, showSearch, sticky: true, ...(mobileNav ? { mobileNav } : {}) }}
      shop={shop}
      menu={[]}
      searchField={<span>FIELD</span>}
      searchButton={<span>ICON</span>}
      cart={<span>CART</span>}
      account={<span>ACCOUNT</span>}
      transparent={transparent}
    />,
  )
}

describe('the mobile header search', () => {
  test('the phone bar carries the icon', () => {
    const html = headerHtml({ transparent: false })
    expect(html).toContain('ICON')
    expect(html).not.toContain('FIELD')
  })

  test('a see-through header draws the same bar', () => {
    const html = headerHtml({ transparent: true })
    expect(html).toContain('ICON')
    expect(html).not.toContain('FIELD')
  })

  test('the classic desktop keeps the full field, the phone the icon', () => {
    const html = headerHtml({ transparent: false, layout: 'classic' })
    expect(html).toContain('FIELD')
    expect(html).toContain('ICON')
  })

  test('a theme that hides search draws neither', () => {
    const html = headerHtml({ transparent: false, showSearch: false })
    expect(html).not.toContain('ICON')
    expect(html).not.toContain('FIELD')
  })

  test('the tab layout keeps the icon in the top-right of the phone bar', () => {
    const html = headerHtml({ transparent: false, mobileNav: 'tabs' })
    const mobile = html.slice(html.indexOf('data-mobile-bar'), html.indexOf('data-desktop-bar'))
    expect(mobile).toContain('ICON')
    expect(mobile).not.toContain('FIELD')
  })
})
