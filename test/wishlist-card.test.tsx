import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import { renderToString } from 'react-dom/server'
import type { ReactNode } from 'react'

import { LocaleProvider } from '../src/locale'
import { system } from '../src/ui'

import { createSection, DEFAULT_THEME_SETTINGS } from '../src/index'
import { sampleStorefrontData, SectionsRenderer, type RenderEnvironment } from '../src/render/index'

const IMAGE = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"/>'

function env(overrides: Partial<RenderEnvironment> = {}): RenderEnvironment {
  return {
    data: sampleStorefrontData('Wishlist shop'),
    settings: DEFAULT_THEME_SETTINGS,
    mode: 'live',
    imageUrl: () => IMAGE,
    formatPrice: (amount, currency) => `${amount} ${currency}`,
    ...overrides,
  }
}

function render(node: ReactNode): string {
  return renderToString(
    <ChakraProvider value={system}>
      <LocaleProvider locale="en">
        {node}
      </LocaleProvider>
    </ChakraProvider>,
  )
}

const SECTION = createSection('product-list', { source: 'latest', heading: 'New in', limit: 2 })
const FEATURED = createSection('featured-product', { productId: 'sample-0' })

describe('wishlist heart on product cards', () => {
  test('a host without a wishlist draws no heart', () => {
    const html = render(<SectionsRenderer sections={[SECTION]} env={env()} />)
    expect(html).not.toContain('data-wishlist-toggle')
  })

  test('a saved product draws a pressed heart, an unsaved one a plain heart', () => {
    const html = render(
      <SectionsRenderer
        sections={[SECTION]}
        env={env({ wishlist: { ids: new Set(['sample-6']), onToggle: () => undefined } })}
      />,
    )
    expect(html).toContain('data-wishlist-toggle')
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('aria-label="Saved to wishlist"')
    expect(html).toContain('aria-pressed="false"')
    expect(html).toContain('aria-label="Save to wishlist"')
  })

  test('the featured product draws the same heart', () => {
    const html = render(
      <SectionsRenderer
        sections={[FEATURED]}
        env={env({ wishlist: { ids: new Set(['sample-0']), onToggle: () => undefined } })}
      />,
    )
    expect(html).toContain('data-wishlist-toggle')
    expect(html).toContain('aria-pressed="true"')
  })
})
