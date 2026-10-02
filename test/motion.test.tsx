import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'

import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

import {
  createSection,
  DEFAULT_THEME_SETTINGS,
  readSectionStyle,
  type SectionInstance,
} from '../src/index'
import {
  sampleStorefrontData,
  SectionsRenderer,
  type RenderEnvironment,
} from '../src/render/index'

function env(overrides: Partial<RenderEnvironment> = {}): RenderEnvironment {
  return {
    data: sampleStorefrontData('Motion Shop'),
    settings: DEFAULT_THEME_SETTINGS,
    mode: 'live',
    imageUrl: () => null,
    formatPrice: (amount, currency) => `${amount} ${currency}`,
    now: new Date('2026-03-10T00:00:00.000Z'),
    ...overrides,
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

function page(sections: SectionInstance[], environment = env()): string {
  return render(<SectionsRenderer sections={sections} env={environment} />)
}

describe('motion style options', () => {
  test('headline and stagger resolve, unknown values fall back safely', () => {
    const style = readSectionStyle({ headline: 'rise', stagger: true })
    expect(style.headline).toBe('rise')
    expect(style.stagger).toBe(true)

    const fallback = readSectionStyle({ headline: 'explode', stagger: 'yes' })
    expect(fallback.headline).toBe('none')
    expect(fallback.stagger).toBe(false)

    expect(readSectionStyle({}).headline).toBe('none')
    expect(readSectionStyle({}).stagger).toBe(false)
  })

  test('stagger marks the frame even when the theme has no motion', () => {
    const html = page(
      [createSection('rich-text', { heading: 'Hello', body: 'World' }, { stagger: true })],
      env({ settings: { ...DEFAULT_THEME_SETTINGS, animation: 'none' } }),
    )
    expect(html).toContain('data-stagger="true"')
    expect(html).toContain('Hello')
  })
})

describe('stats section', () => {
  test('renders final values with prefix, suffix and grouping', () => {
    const html = page([
      createSection('stats', {
        heading: 'By the numbers',
        columns: '3',
        items: [
          { label: 'Happy customers', value: 50000, decimals: 0, prefix: '', suffix: '+' },
          { label: 'Average rating', value: 4.9, decimals: 1, prefix: '', suffix: '/5' },
        ],
      }),
    ])
    expect(html).toContain('By the numbers')
    expect(html).toContain('Happy customers')
    expect(html).toContain('50,000')
    expect(html).toContain('+')
    expect(html).toContain('4.9')
  })
})

describe('pinned-scroll section', () => {
  test('renders every panel heading for readers and no-JS', () => {
    const html = page([
      createSection('pinned-scroll', {
        heading: 'How it works',
        panels: [
          { heading: 'First', body: '', image: '', buttonLabel: '', tone: 'page' },
          { heading: 'Second', body: '', image: '', buttonLabel: '', tone: 'dark' },
        ],
      }),
    ])
    expect(html).toContain('How it works')
    expect(html).toContain('First')
    expect(html).toContain('Second')
  })
})

describe('scroll-rail section', () => {
  test('renders every card title and text as a native strip', () => {
    const html = page([
      createSection('scroll-rail', {
        heading: 'The collection',
        items: [
          { title: 'Card one', text: 'First card', image: '' },
          { title: 'Card two', text: 'Second card', image: '' },
        ],
      }),
    ])
    expect(html).toContain('The collection')
    expect(html).toContain('Card one')
    expect(html).toContain('Second card')
  })
})

describe('split headings', () => {
  test('a rising heading keeps every word in the HTML, masked per word', () => {
    const html = page(
      [createSection('rich-text', { heading: 'Crafted in small batches', body: '' }, { headline: 'rise' })],
    )
    // Words render in their own mask spans, so the sentence is not one
    // contiguous string — but no word may be lost for readers or no-JS.
    for (const word of ['Crafted', 'in', 'small', 'batches']) {
      expect(html).toContain(word)
    }
  })

  test('a static heading stays one plain string', () => {
    const html = page([createSection('rich-text', { heading: 'Crafted in small batches', body: '' })])
    expect(html).toContain('Crafted in small batches')
  })
})
