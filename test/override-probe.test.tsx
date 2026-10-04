import { expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import { renderToString } from 'react-dom/server'
import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'
import { createSection, DEFAULT_THEME_SETTINGS } from '@repo/page-builder'
import { sampleStorefrontData, SectionsRenderer, type RenderEnvironment } from '@repo/page-builder/render'

function env(mode: 'live' | 'preview'): RenderEnvironment {
  return {
    data: sampleStorefrontData('Text Shop'),
    settings: DEFAULT_THEME_SETTINGS,
    mode,
    imageUrl: (id) => (id ? `https://img/${id}` : null),
    formatPrice: (amount, currency) => `${amount} ${currency}`,
    now: new Date('2026-03-10T00:00:00.000Z'),
    ...(mode === 'preview' ? { editing: { onEditText: () => undefined, onSelectElement: () => undefined } } : {}),
  }
}

test('editorial body white', () => {
  const section = createSection('editorial-statement', {
    heading: 'Quietly considered',
    eyebrow: 'The Studio',
    body: 'Toko Ridho is built on a short list.',
    image: 'file123',
    overlay: 'none',
  })
  const withOverride = { ...section, elements: { 'text.body': { color: 'white' } } }
  for (const mode of ['live', 'preview'] as const) {
    const html = renderToString(
      <ChakraProvider value={system}>
        <I18nProvider locale="en" resources={{}}>
          <SectionsRenderer sections={[withOverride]} env={env(mode)} />
        </I18nProvider>
      </ChakraProvider>,
    )
    console.log('====', mode, '====')
    const idx = html.indexOf('Toko Ridho is built')
    console.log(html.slice(Math.max(0, idx - 1500), idx + 300))
  }
})
