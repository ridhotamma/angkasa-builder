/**
 * The storefront header's mobile search: one layout on every page.
 *
 * A phone used to get the field row on solid headers but only the icon on a
 * see-through one, so the home page (transparent over its banner) and every
 * other page showed different bars. The field row is the layout now, whatever
 * the header state; the icon stays only for a host that supplies no field.
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
  field = true,
}: {
  transparent: boolean
  field?: boolean
}): string {
  return render(
    <StoreHeader
      header={{ layout: 'centered', showSearch: true, sticky: true }}
      shop={shop}
      menu={[]}
      searchField={field ? <span>FIELD</span> : undefined}
      searchButton={<span>ICON</span>}
      actions={<span>ACTIONS</span>}
      transparent={transparent}
    />,
  )
}

describe('the mobile header search', () => {
  test('a solid header carries the field row', () => {
    expect(headerHtml({ transparent: false })).toContain('FIELD')
  })

  test('a see-through header carries the same field row', () => {
    expect(headerHtml({ transparent: true })).toContain('FIELD')
  })

  test('a host that supplies only a button keeps the icon', () => {
    const html = headerHtml({ transparent: false, field: false })
    expect(html).not.toContain('FIELD')
    expect(html).toContain('ICON')
  })
})
