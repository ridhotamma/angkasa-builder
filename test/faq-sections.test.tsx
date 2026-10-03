import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'

import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

import { createSection, DEFAULT_THEME_SETTINGS, type SectionInstance } from '../src/index'
import { sampleStorefrontData, SectionsRenderer, type RenderEnvironment } from '../src/render/index'

function env(overrides: Partial<RenderEnvironment> = {}): RenderEnvironment {
  return {
    data: sampleStorefrontData('FAQ Shop'),
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

function faq(settings: Record<string, unknown> = {}): SectionInstance {
  return createSection('faq', {
    heading: 'Frequently asked questions',
    items: [
      { question: 'How long is delivery?', answer: 'Two to four working days.' },
      { question: 'Can I return an item?', answer: 'Yes, within fourteen days.' },
    ],
    ...settings,
  })
}

describe('the faq section', () => {
  test('renders an enclosed accordion with the chevron by default', () => {
    const html = page([faq()])
    expect(html).toContain('Frequently asked questions')
    expect(html).toContain('How long is delivery?')
    expect(html).toContain('data-scope="accordion"')
    // Enclosed boxes the list; the default chevron has no plus glyph.
    expect(html).toContain('border-width:1px')
    expect(html).not.toContain('M12 5v14')
  })

  test('the borders can be dividers or none', () => {
    const outline = page([faq({ variant: 'outline' })])
    expect(outline).toContain('border-bottom-width:1px')
    expect(outline).not.toContain('border-width:1px')

    const plain = page([faq({ variant: 'plain' })])
    expect(plain).not.toContain('border-bottom-width:1px')
    expect(plain).not.toContain('border-width:1px')
  })

  test('the size reaches the accordion spacing scale', () => {
    expect(page([faq({ size: 'sm' })])).toContain('--accordion-padding-x:var(--chakra-spacing-3)')
    expect(page([faq({ size: 'md' })])).toContain('--accordion-padding-x:var(--chakra-spacing-4)')
  })

  test('the plus icon becomes a minus while open', () => {
    const html = page([faq({ icon: 'plus' })])
    // Both glyphs ship; the indicator's `data-state` swaps them with CSS.
    expect(html).toContain('M12 5v14') // plus
    expect(html).toContain('M5 12h14') // minus
    expect(html).toContain('[data-state="open"]')
  })

  test('an empty FAQ explains itself in the preview', () => {
    const html = page([createSection('faq', { items: [] })], env({ mode: 'preview' }))
    expect(html).toContain('Add items in the section settings.')
  })
})
