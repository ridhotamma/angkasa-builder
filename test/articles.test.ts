import { describe, expect, test } from 'bun:test'

import {
  articleNeighbours,
  articleReadingMinutes,
  articleSummary,
  createSection,
  CONTENT_VERSION,
  defaultArticleTemplate,
  normalizeArticleTags,
  relatedArticles,
  sanitizeArticleTemplate,
  sanitizeLink,
  sanitizePageContent,
  sanitizeThemeContent,
  storefrontHref,
  type PageContent,
} from '../src/index'

const types = (sections: Array<{ type: string }>) => sections.map((section) => section.type)

function body(...texts: string[]): PageContent {
  return {
    version: CONTENT_VERSION,
    sections: texts.map((text) => createSection('rich-text', { heading: 'Heading', body: text })),
  }
}

describe('article template', () => {
  test('a theme saved before article templates gets the default page', () => {
    const content = sanitizeThemeContent({ templates: { home: [] } })
    expect(types(content.templates.article)).toEqual(types(defaultArticleTemplate()))
  })

  test('a missing header or content slot is put back, header first', () => {
    const repaired = sanitizeArticleTemplate([
      { id: 'r', type: 'related-articles', settings: {} },
      { id: 'n', type: 'rich-text', settings: {} },
    ])
    expect(types(repaired)).toEqual([
      'article-header',
      'article-content',
      'related-articles',
      'rich-text',
    ])
  })

  test('keeps where the seller put the header and the content', () => {
    const repaired = sanitizeArticleTemplate([
      { id: 'b', type: 'banner', settings: { media: 'image' } },
      { id: 'c', type: 'article-content', settings: {} },
      { id: 'h', type: 'article-header', settings: {} },
    ])
    // The banner stays where it was; the order is untouched.
    expect(types(repaired)).toEqual(['banner', 'article-content', 'article-header'])
  })

  test('the product buy box cannot sit in an article template', () => {
    const repaired = sanitizeArticleTemplate([
      { id: 'h', type: 'article-header', settings: {} },
      { id: 'c', type: 'article-content', settings: {} },
      { id: 'p', type: 'product-info', settings: {} },
    ])
    expect(types(repaired)).toEqual(['article-header', 'article-content'])
  })

  test("an article's body cannot grow its own header or content slot", () => {
    const content = sanitizePageContent({
      sections: [
        { id: 'h', type: 'article-header', settings: {} },
        { id: 'c', type: 'article-content', settings: {} },
        { id: 't', type: 'rich-text', settings: {} },
      ],
    })
    expect(types(content.sections)).toEqual(['rich-text'])
  })
})

describe('blog and article links', () => {
  test('build nested storefront routes', () => {
    expect(storefrontHref({ kind: 'blog', blogHandle: 'news' })).toBe('/blogs/news')
    expect(storefrontHref({ kind: 'blog', blogHandle: 'news', tag: 'kopi susu' })).toBe(
      '/blogs/news?tag=kopi%20susu',
    )
    expect(storefrontHref({ kind: 'article', blogHandle: 'recipes', slug: 'es-kopi' })).toBe(
      '/blogs/recipes/es-kopi',
    )
  })

  test('an empty tag is no tag, not a broken link', () => {
    expect(storefrontHref(sanitizeLink({ kind: 'blog', blogHandle: 'news', tag: '' }))).toBe(
      '/blogs/news',
    )
  })

  test('refuse malformed handles and slugs', () => {
    expect(sanitizeLink({ kind: 'blog', blogHandle: '../admin' })).toEqual({ kind: 'none' })
    expect(sanitizeLink({ kind: 'article', blogHandle: 'news', slug: 'a/b' })).toEqual({
      kind: 'none',
    })
  })
})

describe('article summary and reading time', () => {
  test("the seller's excerpt wins", () => {
    expect(articleSummary('  Our own words.  ', body('Body text.'))).toBe('Our own words.')
  })

  test('without one, the opening of the body, cut at a word', () => {
    const long = 'word '.repeat(80)
    const summary = articleSummary(null, body(long))!
    expect(summary.length).toBeLessThanOrEqual(161)
    expect(summary.endsWith('word…')).toBe(true)
  })

  test('headings and hidden sections are not the summary', () => {
    const content = body('Visible text.')
    content.sections.unshift({ ...createSection('rich-text', { body: 'Hidden.' }), hidden: true })
    expect(articleSummary(null, content)).toBe('Visible text.')
  })

  test('nothing to say is null', () => {
    expect(articleSummary('', body())).toBeNull()
  })

  test('reading time is at least a minute and grows with the words', () => {
    expect(articleReadingMinutes(body())).toBe(1)
    expect(articleReadingMinutes(body('word '.repeat(401)))).toBe(3)
  })
})

describe('neighbours and related articles', () => {
  const at = (day: number, id: string, tags: string[] = []) => ({
    id,
    tags,
    publishedAt: new Date(Date.UTC(2026, 0, day, 12)).toISOString(),
  })
  const current = at(10, 'c', ['kopi', 'resep'])
  const others = [
    at(5, 'old', ['kopi']),
    at(9, 'prev'),
    at(11, 'next', ['kopi', 'resep']),
    at(20, 'new'),
    current,
  ]

  test('previous is just older, next is just newer', () => {
    const { previous, next } = articleNeighbours(current, others)
    expect(previous?.id).toBe('prev')
    expect(next?.id).toBe('next')
  })

  test('the newest article has no next', () => {
    expect(articleNeighbours(at(20, 'new'), others).next).toBeNull()
  })

  test('the same moment still has an order, by id', () => {
    const twin = { ...current, id: 'd' }
    expect(articleNeighbours(twin, [...others, twin]).previous?.id).toBe('c')
  })

  test('related: most shared tags first, then newest, never itself', () => {
    const ids = relatedArticles(current, others, 3).map((article) => article.id)
    expect(ids).toEqual(['next', 'old', 'new'])
  })
})

describe('related articles across blogs', () => {
  const article = (id: string, blogId: string, day: number, tags: string[] = []) => ({
    id,
    blogId,
    tags,
    publishedAt: new Date(Date.UTC(2026, 0, day, 12)).toISOString(),
  })

  test('shared tags first from any blog, then the same blog, then the newest', () => {
    const current = article('c', 'recipes', 10, ['kopi'])
    const others = [
      article('news-new', 'news', 30),
      article('recipes-old', 'recipes', 1),
      article('news-kopi', 'news', 2, ['kopi']),
    ]
    expect(relatedArticles(current, others, 3).map((a) => a.id)).toEqual([
      'news-kopi',
      'recipes-old',
      'news-new',
    ])
  })

  test('a blog with one article still gets articles from the other blogs', () => {
    const current = article('only', 'recipes', 10)
    const others = [article('n1', 'news', 5), article('n2', 'news', 8)]
    expect(relatedArticles(current, others, 3).map((a) => a.id)).toEqual(['n2', 'n1'])
  })
})

describe('article tags', () => {
  test('are trimmed, lowercased, deduplicated and capped', () => {
    const tags = normalizeArticleTags([' Kopi ', 'kopi', 'RESEP', 42, '', ...'abcdefghijkl'])
    expect(tags.slice(0, 2)).toEqual(['kopi', 'resep'])
    expect(tags).toHaveLength(10)
  })

  test('are cut to 30 characters', () => {
    expect(normalizeArticleTags(['x'.repeat(40)])[0]).toHaveLength(30)
  })
})
