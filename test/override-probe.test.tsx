import { expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import { renderToString } from 'react-dom/server'
import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'
import { createSection, DEFAULT_THEME_SETTINGS, type SectionInstance } from '@repo/page-builder'
import {
  sampleStorefrontData,
  SectionsRenderer,
  type RenderEnvironment,
} from '@repo/page-builder/render'

function env(): RenderEnvironment {
  return {
    data: sampleStorefrontData('Text Shop'),
    settings: DEFAULT_THEME_SETTINGS,
    mode: 'live',
    imageUrl: (id) => (id ? `https://img/${id}` : null),
    formatPrice: (amount, currency) => `${amount} ${currency}`,
    now: new Date('2026-03-10T00:00:00.000Z'),
  }
}

function render(section: SectionInstance): string {
  return renderToString(
    <ChakraProvider value={system}>
      <I18nProvider locale="en" resources={{}}>
        <SectionsRenderer sections={[section]} env={env()} />
      </I18nProvider>
    </ChakraProvider>,
  )
}

test('the editorial body takes the white copy colour over a photo', () => {
  const section = createSection('editorial-statement', {
    heading: 'Quietly considered',
    eyebrow: 'The Studio',
    body: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Toko Ridho is built on a short list.' }],
        },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'And care' }] },
      ],
    },
    image: 'file123',
    overlay: 'none',
  })
  const html = render(section)
  const at = html.indexOf('Toko Ridho is built on a short list.')
  expect(at).toBeGreaterThan(-1)
  // The body and its headings inherit the white copy instead of the muted
  // page ink a paragraph would otherwise pick.
  const body = html.slice(Math.max(0, at - 2000), at + 200)
  expect(body).toContain('color:inherit')
  expect(body).not.toContain('--chakra-colors-fg-muted')
  const headingAt = html.indexOf('And care')
  expect(html.slice(Math.max(0, headingAt - 600), headingAt)).toContain('color:inherit')
})

test('without a photo the editorial body keeps the muted page ink', () => {
  const section = createSection('editorial-statement', {
    heading: 'Quietly considered',
    eyebrow: 'The Studio',
    body: 'Toko Ridho is built on a short list.',
    image: '',
    overlay: 'none',
  })
  const html = render(section)
  const at = html.indexOf('Toko Ridho is built on a short list.')
  expect(at).toBeGreaterThan(-1)
  expect(html.slice(Math.max(0, at - 2000), at + 200)).toContain('--chakra-colors-fg-muted')
})
