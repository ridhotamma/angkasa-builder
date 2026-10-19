/**
 * The product detail page's two-column split.
 *
 * The mosaic layout wants the width: five photos in one column are
 * thumbnails at an even split, so it takes two thirds. The details column
 * that leaves is narrow, which is why the buy actions stack full width, one
 * per line, the primary first — a row of two clips "Add to cart" there.
 */

import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import { renderToString } from 'react-dom/server'

import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

import { createSection, DEFAULT_THEME_SETTINGS } from '../src/index'
import {
  RenderProvider,
  sampleStorefrontData,
  SectionsRenderer,
  type RenderEnvironment,
} from '../src/render/index'

function env(): RenderEnvironment {
  return {
    data: sampleStorefrontData('Product Shop'),
    settings: { ...DEFAULT_THEME_SETTINGS, splash: { ...DEFAULT_THEME_SETTINGS.splash } },
    // Preview mode supplies the stand-in product and the buy-button stand-in,
    // which is what the editor shows for this section.
    mode: 'preview',
    imageUrl: () => null,
    formatPrice: (amount, currency) => `${amount} ${currency}`,
    now: new Date('2026-03-10T00:00:00.000Z'),
  }
}

function page(gallery = 'mosaic'): string {
  return renderToString(
    <ChakraProvider value={system}>
      <I18nProvider locale="en" resources={{}}>
        <RenderProvider value={env()}>
          <SectionsRenderer
            sections={[createSection('product-info', { gallery, stickyInfo: true })]}
            env={env()}
          />
        </RenderProvider>
      </I18nProvider>
    </ChakraProvider>,
  )
}

describe('the product detail page', () => {
  test('the mosaic takes two thirds of the row', () => {
    const html = page()
    expect(html).toContain('minmax(0, 2fr) minmax(0, 1fr)')
    expect(html).not.toContain('minmax(0, 3fr) minmax(0, 2fr)')
  })

  test('another photo layout keeps the even split', () => {
    expect(page('thumbnails')).not.toContain('minmax(0, 2fr)')
  })

  test('the buy actions stack one per line, the primary first', () => {
    const html = page()
    // The primary comes first, and the two share one column stack.
    expect(html.indexOf('>Buy now<')).toBeGreaterThan(0)
    expect(html.indexOf('>Buy now<')).toBeLessThan(html.indexOf('>Add to cart<'))

    const stack = html.match(
      /<div class="chakra-stack (css-[\w-]+)">(?:<style[\s\S]*?<\/style>)*<button[^>]*>Buy now</,
    )
    expect(stack?.[1]).toBeTruthy()
    const cls = stack![1]!
    const rule = html.match(new RegExp(`\\.${cls}\\{[^}]*\\}`))?.[0] ?? ''
    expect(rule).toContain('flex-direction:column')
    // The old row layout is gone entirely, media query included.
    expect(html).not.toMatch(new RegExp(`\\.${cls}\\{[^}]*flex-direction:row`))
  })
})
