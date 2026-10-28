import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'

import { LocaleProvider } from '../src/locale'
import { system } from '../src/ui'

import { DEFAULT_THEME_SETTINGS, THEME_SEEDS } from '../src/index'
import { sampleStorefrontData, SectionsRenderer, type RenderEnvironment } from '../src/render/index'

function env(settings: RenderEnvironment['settings']): RenderEnvironment {
  return {
    data: sampleStorefrontData('Seed Shop'),
    settings,
    mode: 'live',
    imageUrl: () => null,
    formatPrice: (amount, currency) => `${amount} ${currency}`,
    now: new Date('2026-03-10T00:00:00.000Z'),
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

describe('platform theme seeds, rendered', () => {
  test('every home page draws end to end on a live storefront', () => {
    for (const seed of THEME_SEEDS) {
      const content = seed.content()
      expect(content.settings).not.toEqual(DEFAULT_THEME_SETTINGS)
      const html = render(
        <SectionsRenderer sections={content.templates.home} env={env(content.settings)} />,
      )
      expect(html.length, seed.slug).toBeGreaterThan(5_000)
      // No section editor affordances leak onto a live page.
      expect(html, seed.slug).not.toContain('data-section-id')
      expect(html, seed.slug).not.toContain('data-element-id')
    }
  })

  test('product and article templates draw with their required sections', () => {
    for (const seed of THEME_SEEDS) {
      const content = seed.content()
      const environment = env(content.settings)
      const product = render(
        <SectionsRenderer sections={content.templates.product} env={environment} />,
      )
      const article = render(
        <SectionsRenderer sections={content.templates.article} env={environment} />,
      )
      expect(product.length, seed.slug).toBeGreaterThan(1_000)
      expect(article.length, seed.slug).toBeGreaterThan(500)
    }
  })
})
