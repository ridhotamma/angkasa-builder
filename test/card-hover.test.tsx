/**
 * The theme's card hover effects — outline, zoom, lift, shadow, 3D tilt, shine
 * sweep — the same set on every card: product, category, testimonial, person,
 * press, video testimonial, article and store.
 */

import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import { renderToString } from 'react-dom/server'

import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

import {
  createSection,
  DEFAULT_THEME_SETTINGS,
  sanitizeThemeSettings,
  type SectionType,
  type ThemeSettings,
} from '../src/index'
import { sampleStorefrontData, SectionsRenderer, type RenderEnvironment } from '../src/render/index'

function render(
  type: SectionType,
  section: Record<string, unknown>,
  theme: Partial<ThemeSettings> = {},
  imageUrl: () => string | null = () => null,
): string {
  const env: RenderEnvironment = {
    data: sampleStorefrontData('Kopi Kita'),
    settings: { ...DEFAULT_THEME_SETTINGS, ...theme },
    mode: 'live',
    imageUrl,
    formatPrice: (amount, currency) => `${amount} ${currency}`,
  }
  return renderToString(
    <ChakraProvider value={system}>
      <I18nProvider locale="en" resources={{}}>
        <SectionsRenderer sections={[createSection(type, section)]} env={env} />
      </I18nProvider>
    </ChakraProvider>,
  )
}

// The ring is an overlay pseudo-element on the card root, transparent at
// rest and brand-coloured on hover. An `outline` on the card itself paints
// under its children, which is what this replaced.
const OUTLINE = /:hover::after\{[^}]*border-color:var\(--chakra-colors-brand-solid\)/
const OUTLINE_BASE = /::after\{[^}]*border:2px solid transparent/
const ZOOM = /:hover img\{[^}]*transform:scale\(1\.05\)/
const LIFT = /:hover\{[^}]*transform:translateY\(-4px\)/
const SHINE_BASE = /::before\{[^}]*translateX\(-130%\)/
const SHINE_HOVER = /:hover::before\{[^}]*translateX\(130%\)/

describe('card hover', () => {
  test('defaults to the outline and zoom every card had before', () => {
    expect(DEFAULT_THEME_SETTINGS.cardHover).toEqual(['outline', 'zoom'])
    // A theme saved before the setting existed reads the same.
    expect(sanitizeThemeSettings({}).cardHover).toEqual(['outline', 'zoom'])
    const html = render('latest-products', {})
    expect(html).toMatch(OUTLINE)
    expect(html).toMatch(OUTLINE_BASE)
    expect(html).toMatch(ZOOM)
    expect(html).not.toMatch(LIFT)
  })

  test('drops unknown effects and keeps them in order', () => {
    expect(
      sanitizeThemeSettings({ cardHover: ['shadow', 'wiggle', 'lift', 'lift'] }).cardHover,
    ).toEqual(['lift', 'shadow'])
    expect(sanitizeThemeSettings({ cardHover: [] }).cardHover).toEqual([])
  })

  test('every card wears the same chosen effects', () => {
    // Product, category, bento, columns, people, quotes, press, video quotes
    // and stores: one setting, one result — no card opts out.
    const cases: ReadonlyArray<[SectionType, Record<string, unknown>]> = [
      ['latest-products', {}],
      ['latest-products', { layout: 'bento' }],
      ['category-rail', {}],
      ['category-rail', { layout: 'bento' }],
      ['cards', { card: 'text', items: [{ title: 'A', text: 'B' }] }],
      ['cards', { card: 'person', items: [{ name: 'A', role: 'B' }] }],
      ['quotes', { variant: 'quotes', items: [{ quote: 'Q', author: 'A' }] }],
      ['quotes', { variant: 'press', items: [{ source: 'S', quote: 'Q' }] }],
      ['quotes', { variant: 'video', items: [{ name: 'A', quote: 'Q' }] }],
      ['store-locations', { items: [{ name: 'Store', address: 'Jl. Contoh 1' }] }],
      ['scroll-rail', { items: [{ title: 'A', text: 'B' }] }],
      ['stacked-cards', { items: [{ title: 'A', text: 'B' }] }],
    ]
    for (const [type, section] of cases) {
      const html = render(type, section, { cardHover: ['lift', 'shadow'] })
      expect(html, `${type} ${JSON.stringify(section)}`).toMatch(LIFT)
      expect(html).toContain('box-shadow:var(--chakra-shadows-lg)')
      expect(html).not.toMatch(OUTLINE)
      expect(html).not.toMatch(ZOOM)
    }
  })

  test('gallery tiles are theme cards too', () => {
    const url = () => 'https://img/x.jpg'
    for (const layout of ['grid', 'masonry', 'social']) {
      const html = render(
        'gallery',
        { layout, items: [{ image: 'a', caption: 'A' }] },
        { cardHover: ['lift'] },
        url,
      )
      expect(html, layout).toMatch(LIFT)
    }
  })

  test('the shine sweep is a one-way overlay that runs on hover', () => {
    const html = render('latest-products', {}, { cardHover: ['shine'] })
    // Rest: to the left, and with no transition — so leaving the card snaps the
    // light back to its start rather than dragging it back across.
    expect(html).toMatch(SHINE_BASE)
    expect(html).toMatch(/::before\{[^}]*translateX\(-130%\)[^}]*transition:none/)
    // Hover: the sweep, with the transition that drives it.
    expect(html).toMatch(SHINE_HOVER)
    expect(html).toMatch(/:hover::before\{[^}]*transition:transform 650ms/)
    // Reduced motion drops it, like the other moving effects.
    expect(html).toMatch(/::before\{display:none/)
  })

  test('tilt stands the CSS lift and its transform transition down', () => {
    // The tilt transforms the card itself (GSAP); the CSS lift would fight it,
    // so it and its `transform` transition stand down — the shadow still moves.
    const tilted = render('latest-products', {}, { cardHover: ['lift', 'tilt'] })
    expect(tilted).not.toMatch(LIFT)
    expect(tilted).not.toContain('transform 250ms ease, box-shadow')
    // Without tilt, the lift is back.
    const lifted = render('latest-products', {}, { cardHover: ['lift'] })
    expect(lifted).toMatch(LIFT)
  })

  test('none at all leaves the cards still', () => {
    const html = render('latest-products', {}, { cardHover: [] })
    expect(html).not.toMatch(OUTLINE)
    expect(html).not.toMatch(OUTLINE_BASE)
    expect(html).not.toMatch(ZOOM)
  })

  test('a bold card grows its hard shadow instead of adding a soft one', () => {
    const html = render('latest-products', {}, { cardStyle: 'hard', cardHover: ['shadow'] })
    expect(html).toContain('box-shadow:6px 6px 0 var(--chakra-colors-fg)')
  })
})
