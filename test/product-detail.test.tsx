/**
 * The product detail page's two-column split.
 *
 * The mosaic layout wants the width: five photos in one column are
 * thumbnails at an even split, so it takes two thirds. The details column
 * that leaves is narrow, and the buy actions stack there, one per line, the
 * primary first — a row of two clips "Add to cart". Every other photo layout
 * keeps an even split and puts the two actions in a row.
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

/** The class of the box the two stand-in actions sit in. */
function actionsClass(html: string): string {
  // The nearest div before the first action is the box itself; Chakra's `Flex`
  // wears no `chakra-*` name, so it is found by position.
  const before = html.slice(0, html.indexOf('>Buy now<'))
  const divs = [...before.matchAll(/<div class="([^"]+)"/g)]
  const last = divs[divs.length - 1]?.[1] ?? ''
  return last.split(' ').find((name) => name.startsWith('css-')) ?? ''
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

  test('the mosaic stacks the buy actions one per line, the primary first', () => {
    const html = page()
    // The primary comes first, and the two share one column box.
    expect(html.indexOf('>Buy now<')).toBeGreaterThan(0)
    expect(html.indexOf('>Buy now<')).toBeLessThan(html.indexOf('>Add to cart<'))

    const cls = actionsClass(html)
    expect(cls).toBeTruthy()
    const rule = html.match(new RegExp(`\\.${cls}\\{[^}]*\\}`))?.[0] ?? ''
    expect(rule).toContain('flex-direction:column')
    // No width has the pair in a row here.
    expect(html).not.toMatch(new RegExp(`\\.${cls}\\{[^}]*flex-direction:row`))
  })

  test('a wide details column puts the buy actions in a row', () => {
    const html = page('thumbnails')
    const cls = actionsClass(html)
    expect(cls).toBeTruthy()
    // Stacked on a phone, in a row from the first breakpoint that has the room.
    expect(html).toMatch(new RegExp(`\\.${cls}\\{[^}]*flex-direction:column`))
    expect(html).toMatch(new RegExp(`\\.${cls}\\{[^}]*flex-direction:row`))
  })

  test('the buy box stand-in draws the storefront’s own rows, in its order', () => {
    // The picker's stock line and size axis, the rule, then the quantity and
    // the two actions — the storefront's box, row for row, so the canvas is
    // what the seller is laying the page out over. The note is the editor's.
    const text = page('thumbnails')
      .replace(/<style[\s\S]*?<\/style>/g, '')
      .replace(/<[^>]+>/g, '|')
    let at = -1
    for (const row of [
      '4 in stock',
      'Size',
      '— M',
      'S',
      'M',
      'L',
      'XL',
      'Quantity',
      'Buy now',
      'Add to cart',
      'appear here on the storefront',
    ]) {
      const found = text.indexOf(row, at + 1)
      expect(found, row).toBeGreaterThan(at)
      at = found
    }
  })
})
