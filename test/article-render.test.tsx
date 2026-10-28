import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'

import { LocaleProvider } from '../src/locale'
import { system } from '../src/ui'

import {
  createSection,
  DEFAULT_THEME_SETTINGS,
  defaultArticleTemplate,
  type SectionInstance,
} from '../src/index'
import {
  formatArticleDate,
  sampleStorefrontData,
  SectionsRenderer,
  type RenderEnvironment,
  type StorefrontArticleDetail,
} from '../src/render/index'

const article: StorefrontArticleDetail = {
  id: 'a1',
  title: 'How to brew our beans',
  slug: 'brew-our-beans',
  blogHandle: 'recipes',
  summary: 'A guide.',
  coverUrl: 'https://example.com/cover.jpg',
  // 20:00 UTC is already the next day in Jakarta.
  publishedAt: '2026-03-01T20:00:00.000Z',
  authorName: 'Sari',
  tags: ['kopi', 'resep'],
  readingMinutes: 4,
  blog: { handle: 'recipes', title: 'Recipes' },
  previous: { title: 'An older article', slug: 'older' },
  next: null,
  related: [
    {
      id: 'a2',
      title: 'Cold brew at home',
      slug: 'cold-brew',
      blogHandle: 'recipes',
      summary: null,
      coverUrl: null,
      publishedAt: '2026-02-01T12:00:00.000Z',
      authorName: null,
      tags: ['kopi'],
    },
  ],
}

function env(overrides: Partial<RenderEnvironment> = {}): RenderEnvironment {
  return {
    data: { ...sampleStorefrontData('Kopi Kita'), article },
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
      <LocaleProvider locale="en">
        {node}
      </LocaleProvider>
    </ChakraProvider>,
  )
}

/** The template with the body drawn into its slot, as the storefront does it. */
function articlePage(template: SectionInstance[], environment = env()): string {
  const body = [createSection('rich-text', { heading: '', body: 'Grind the beans fresh.' })]
  const slots = { articleBody: <SectionsRenderer sections={body} env={environment} /> }
  return render(<SectionsRenderer sections={template} env={{ ...environment, slots }} />)
}

describe('article page', () => {
  test('draws the header, the body in its slot, and the frame around it', () => {
    const html = articlePage(defaultArticleTemplate())
    for (const text of [
      'How to brew our beans',
      'Recipes',
      'Sari',
      '4 min read',
      '#kopi',
      'Grind the beans fresh.',
      'Share this article',
      'An older article',
      'Cold brew at home',
    ]) {
      expect(html).toContain(text)
    }
    // Header, then body, then what follows it.
    expect(html.indexOf('How to brew our beans')).toBeLessThan(html.indexOf('Grind the beans'))
    expect(html.indexOf('Grind the beans')).toBeLessThan(html.indexOf('Cold brew at home'))
    // Links are the storefront's own shapes.
    expect(html).toContain('href="/blogs/recipes/older"')
    expect(html).toContain('href="/blogs/recipes?tag=kopi"')
  })

  test('the date is the Jakarta day, whatever the server clock', () => {
    expect(formatArticleDate(article.publishedAt, 'en')).toBe('2 March 2026')
    expect(articlePage(defaultArticleTemplate())).toContain('2 March 2026')
  })

  test('the theme can move the date above the title', () => {
    const template = defaultArticleTemplate().map((section) =>
      section.type === 'article-header'
        ? { ...section, settings: { ...section.settings, metaPosition: 'above' } }
        : section,
    )
    const html = articlePage(template)
    expect(html.indexOf('2 March 2026')).toBeLessThan(html.indexOf('How to brew our beans'))
  })

  test('a storefront article without a cover draws no empty cover', () => {
    const html = articlePage(
      defaultArticleTemplate(),
      env({
        data: { ...sampleStorefrontData(), article: { ...article, coverUrl: null } },
      }),
    )
    expect(html).not.toContain('cover.jpg')
    expect(html).toContain('How to brew our beans')
  })

  test('the theme editor, with no article and no body, draws the sample and a stand-in', () => {
    const html = render(
      <SectionsRenderer
        sections={defaultArticleTemplate()}
        env={env({ mode: 'preview', data: sampleStorefrontData('Kopi Kita') })}
      />,
    )
    expect(html).toContain('Behind the scenes of our new collection')
    expect(html).toContain('written in the article editor')
  })

  test('on the storefront, with no article, the frame draws nothing rather than failing', () => {
    const html = render(
      <SectionsRenderer
        sections={defaultArticleTemplate()}
        env={env({ data: sampleStorefrontData('Kopi Kita') })}
      />,
    )
    expect(html).not.toContain('Behind the scenes')
  })
})
