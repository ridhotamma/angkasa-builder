import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'

import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

import { createSection, DEFAULT_THEME_SETTINGS, type SectionInstance } from '../src/index'
import { sampleStorefrontData, SectionsRenderer, type RenderEnvironment } from '../src/render/index'

/** The Chakra `Container maxW="6xl"` the banner copy lines up with. */
const PAGE_COLUMN = 'max-width:var(--chakra-sizes-6xl)'

function env(): RenderEnvironment {
  return {
    data: sampleStorefrontData('Aligned Shop'),
    settings: DEFAULT_THEME_SETTINGS,
    mode: 'live',
    imageUrl: () => null,
    formatPrice: (amount, currency) => `${amount} ${currency}`,
    now: new Date('2026-03-10T00:00:00.000Z'),
  }
}

function hero(style: Record<string, unknown>, settings: Record<string, unknown> = {}) {
  return createSection(
    'hero',
    {
      heading: 'Judul banner',
      subheading: 'Subjudul banner',
      buttonLabel: 'Belanja',
      ...settings,
    },
    style,
  )
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

function htmlOf(section: SectionInstance): string {
  return render(<SectionsRenderer sections={[section]} env={env()} />)
}

describe('banner content follows the page column', () => {
  test('an edge-to-edge banner keeps its copy in the page column', () => {
    const html = htmlOf(hero({ width: 'edge' }))
    expect(html).toContain(PAGE_COLUMN)
    expect(html).toContain('Judul banner')
  })

  test('a centered edge banner still centers inside that column', () => {
    const html = htmlOf(hero({ width: 'edge' }, { align: 'center' }))
    expect(html).toContain(PAGE_COLUMN)
    expect(html).toContain('text-align:center')
  })

  test('a page-width banner keeps its own panel padding instead', () => {
    const html = htmlOf(hero({}))
    expect(html).not.toContain(PAGE_COLUMN)
    expect(html).toContain('Judul banner')
  })

  test('a full-width background frame supplies the column itself', () => {
    const html = htmlOf(hero({ width: 'full', colorScheme: 'inverse' }))
    expect(html).toContain(PAGE_COLUMN)
    expect(html).toContain('Judul banner')
  })

  test('the video and parallax banners share the alignment', () => {
    const parallax = createSection(
      'parallax-banner',
      { heading: 'Paralaks', image: '' },
      { width: 'edge' },
    )
    expect(htmlOf(parallax)).toContain(PAGE_COLUMN)
  })
})
