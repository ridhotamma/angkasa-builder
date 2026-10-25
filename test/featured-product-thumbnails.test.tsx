/**
 * The featured product's photo strip.
 *
 * A product with more than one photo draws its gallery as thumbnails under
 * the cover. The seller can switch that strip off and keep just the main
 * photo; a section that never chose (and so carries the default) still shows
 * it.
 */

import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import { renderToString } from 'react-dom/server'

import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

import { createSection, DEFAULT_THEME_SETTINGS } from '../src/index'
import {
  sampleStorefrontData,
  SectionsRenderer,
  type RenderEnvironment,
  type StorefrontRenderData,
} from '../src/render/index'

const base = sampleStorefrontData('Photo shop')
const product = {
  ...base.latest[0]!,
  name: 'Signature tote',
  imageUrl: 'photo-1',
  imageUrls: ['photo-1', 'photo-2', 'photo-3'],
}
const data: StorefrontRenderData = { ...base, products: [product] }

function env(): RenderEnvironment {
  return {
    data,
    settings: DEFAULT_THEME_SETTINGS,
    mode: 'live',
    imageUrl: () => null,
    formatPrice: (amount, currency) => `${amount} ${currency}`,
  }
}

function render(settings: Record<string, unknown>): string {
  const section = createSection('featured-product', {
    productId: product.id,
    ...settings,
  })
  return renderToString(
    <ChakraProvider value={system}>
      <I18nProvider locale="en" resources={{}}>
        <SectionsRenderer sections={[section]} env={env()} />
      </I18nProvider>
    </ChakraProvider>,
  )
}

describe('featured product thumbnails', () => {
  test('the strip is on unless the section says otherwise', () => {
    const html = render({})
    expect(html).toContain('aria-label="Signature tote 2"')
    expect(html).toContain('aria-label="Signature tote 3"')
  })

  test('turning it off keeps the main photo and drops the strip', () => {
    const html = render({ showThumbnails: false })
    expect(html).not.toContain('aria-label="Signature tote 2"')
    expect(html).not.toContain('aria-label="Signature tote 3"')
    // The cover is still there.
    expect(html).toContain('alt="Signature tote"')
  })
})
