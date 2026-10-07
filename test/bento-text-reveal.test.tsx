/**
 * Bento tiles that keep their photos clear and bring the name and price in on
 * hover: the product lists' and the category rail's `bentoText: 'hover'`.
 */

import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import { renderToString } from 'react-dom/server'

import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

import {
  createSection,
  DEFAULT_THEME_SETTINGS,
  sectionSchema,
  type SectionType,
} from '../src/index'
import { sampleStorefrontData, SectionsRenderer, type RenderEnvironment } from '../src/render/index'

const BENTO_SECTIONS: SectionType[] = [
  'featured-collection',
  'collection-shelves',
  'latest-products',
  'collection-tabs',
  'related-products',
  'category-rail',
]

function render(type: SectionType, settings: Record<string, unknown>): string {
  const env: RenderEnvironment = {
    data: sampleStorefrontData('Kopi Kita'),
    settings: DEFAULT_THEME_SETTINGS,
    mode: 'live',
    imageUrl: () => null,
    formatPrice: (amount, currency) => `${amount} ${currency}`,
  }
  return renderToString(
    <ChakraProvider value={system}>
      <I18nProvider locale="en" resources={{}}>
        <SectionsRenderer sections={[createSection(type, settings)]} env={env} />
      </I18nProvider>
    </ChakraProvider>,
  )
}

describe('bento text on hover', () => {
  test('every bento section offers it, shown only for the bento layout', () => {
    for (const type of BENTO_SECTIONS) {
      const field = sectionSchema(type)!.fields.find((f) => f.key === 'bentoText')
      expect(field, type).toBeDefined()
      expect(field?.kind === 'select' && field.default, type).toBe('always')
      expect(field?.showWhen, type).toEqual({ key: 'layout', is: ['bento'] })
    }
  })

  test('product tiles keep their text visible by default', () => {
    const html = render('latest-products', { layout: 'bento' })
    expect(html).not.toContain('data-text-reveal')
  })

  test('on hover, product tiles hide the text and bring it in, name before price', () => {
    const html = render('latest-products', { layout: 'bento', bentoText: 'hover' })
    expect(html).toContain('data-text-reveal')
    expect(html).toContain('transition-delay:70ms')
    expect(html).toContain('transition-delay:140ms')
    // Screens without hover always show the text.
    expect(html).toContain('@media (hover: none)')
  })

  test('category tiles reveal their names the same way', () => {
    expect(render('category-rail', { layout: 'bento' })).not.toContain('data-text-reveal')
    const html = render('category-rail', { layout: 'bento', bentoText: 'hover' })
    expect(html).toContain('data-text-reveal')
    expect(html).toContain('transition-delay:70ms')
  })
})
