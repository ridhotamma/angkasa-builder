/**
 * The testimonials list arrangement: one quote per row, full width, the
 * customer stacked beneath the quote — distinct from the grid of cards. The
 * `quotes` section ("Kutipan dan ulasan") offers the four arrangements; the
 * plain `testimonials` section offers three but draws through the same
 * renderer, so it honours a list too.
 */

import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'

import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

import {
  createSection,
  DEFAULT_THEME_SETTINGS,
  sectionSchema,
  type SectionInstance,
} from '../src/index'
import { sampleStorefrontData, SectionsRenderer, type RenderEnvironment } from '../src/render/index'

const ITEMS = [
  { quote: 'Fast delivery and the packaging was neat.', author: 'Sari', role: 'Jakarta' },
  { quote: 'The quality is better than I expected.', author: 'Budi', role: 'Bandung' },
  { quote: 'Will order again for sure.', author: 'Rina', role: 'Surabaya' },
]

function env(): RenderEnvironment {
  return {
    data: sampleStorefrontData('Kopi Kita'),
    settings: DEFAULT_THEME_SETTINGS,
    mode: 'live',
    imageUrl: () => null,
    formatPrice: (amount, currency) => `${amount} ${currency}`,
  }
}

function render(node: ReactNode): string {
  return renderToString(
    <ChakraProvider value={system}>
      <I18nProvider locale="en" resources={{}}>
        {node}
      </I18nProvider>
    </ChakraProvider>,
  )
}

function page(sections: SectionInstance[]): string {
  return render(<SectionsRenderer sections={sections} env={env()} />)
}

function quotes(settings: Record<string, unknown> = {}): SectionInstance {
  return createSection('quotes', { variant: 'quotes', items: ITEMS, ...settings })
}

describe('the testimonials list layout', () => {
  test('is offered beside grid, running cards and slider', () => {
    const field = sectionSchema('quotes')!.fields.find((f) => f.key === 'layout')
    expect(field?.kind === 'select' && field.options.map((option) => option.value)).toEqual([
      'grid',
      'marquee',
      'carousel',
      'list',
    ])
  })

  test('writes one full-width row per quote, with its author', () => {
    const html = page([quotes({ layout: 'list' })])
    expect(html.match(/data-testimonial-row/g)?.length).toBe(ITEMS.length)
    expect(html).toContain('Fast delivery and the packaging was neat.')
    expect(html).toContain('Sari')
    expect(html).toContain('Jakarta')
  })

  test('stacks the customer beneath the quote, not beside it', () => {
    const html = page([quotes({ layout: 'list' })])
    const row = /<li[^>]*data-testimonial-row[^>]*>/.exec(html)?.[0] ?? ''
    const cls = /class="([^"]+)"/.exec(row)?.[1]?.split(' ')[0]
    const rule = cls
      ? new RegExp(`\\.${cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\{[^}]*\\}`).exec(html)?.[0]
      : ''
    // The row is a column, left-aligned: quote first, byline under it.
    expect(rule).toContain('flex-direction:column')
    expect(rule).toContain('align-items:flex-start')
    expect(rule).not.toContain('justify-content:space-between')
    const quoteAt = html.indexOf('Fast delivery and the packaging was neat.')
    const authorAt = html.indexOf('Sari')
    expect(quoteAt).toBeGreaterThan(-1)
    expect(authorAt).toBeGreaterThan(quoteAt)
  })

  test('the grid keeps its cards, not the list rows', () => {
    const html = page([quotes({ layout: 'grid' })])
    expect(html).not.toContain('data-testimonial-row')
    expect(html).toContain('Fast delivery and the packaging was neat.')
  })

  test('the slider pages by its arrows and wears no dots', () => {
    const html = page([quotes({ layout: 'carousel' })])
    // No dots at the foot of the cards: the banner is the one slider that
    // wears them, so a carousel moves by its arrows and a finger.
    expect(html).not.toContain('aria-label="Slide')
    expect(html).toContain('aria-label="Previous slide"')
    expect(html).toContain('aria-label="Next slide"')
  })
})
