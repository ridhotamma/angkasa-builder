/**
 * The theme's card hover effects: any of a brand outline, an image zoom, a
 * lift and a shadow on product and category cards.
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
): string {
  const env: RenderEnvironment = {
    data: sampleStorefrontData('Kopi Kita'),
    settings: { ...DEFAULT_THEME_SETTINGS, ...theme },
    mode: 'live',
    imageUrl: () => null,
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

  test('applies the chosen effects to product and category cards alike', () => {
    for (const [type, section] of [
      ['latest-products', {}],
      ['latest-products', { layout: 'bento' }],
      ['category-rail', {}],
      ['category-rail', { layout: 'bento' }],
    ] as const) {
      const html = render(type, section, { cardHover: ['lift', 'shadow'] })
      expect(html, `${type} ${JSON.stringify(section)}`).toMatch(LIFT)
      expect(html).toContain('box-shadow:var(--chakra-shadows-lg)')
      expect(html).not.toMatch(OUTLINE)
      expect(html).not.toMatch(OUTLINE_BASE)
      expect(html).not.toMatch(ZOOM)
    }
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
