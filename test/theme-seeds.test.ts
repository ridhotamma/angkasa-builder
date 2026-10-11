import { describe, expect, test } from 'bun:test'

import {
  contrastIssues,
  findThemeSeed,
  isLookKey,
  isSectionOffered,
  readBlocks,
  sanitizeThemeContent,
  schemeContrastIssues,
  sectionSchema,
  serializeContent,
  THEME_SEEDS,
} from '../src/index'

const EXPECTED = [
  'brutalist',
  'minimalist',
  'bold',
  'modern',
  'editorial',
  'elegant',
  'marketplace',
  'preloved',
  'retro',
  'organic',
  'tech',
  'playful',
]

describe('platform theme seeds', () => {
  test('cover the requested styles, with unique slugs and shelf order', () => {
    const slugs = THEME_SEEDS.map((seed) => seed.slug)
    expect(slugs).toEqual(EXPECTED)
    expect(new Set(slugs).size).toBe(slugs.length)

    const orders = THEME_SEEDS.map((seed) => seed.sortOrder)
    expect(new Set(orders).size).toBe(orders.length)

    for (const seed of THEME_SEEDS) {
      expect(seed.slug, seed.slug).toMatch(/^[a-z0-9-]+$/)
      expect(seed.name.length, seed.slug).toBeGreaterThan(0)
      expect(seed.description.en.length, seed.slug).toBeGreaterThan(0)
      expect(seed.description.id.length, seed.slug).toBeGreaterThan(0)
    }

    expect(findThemeSeed('preloved')?.name).toBe('Preloved')
    expect(findThemeSeed('amazon')).toBeNull()
  })

  test('every seed is already sanitised, and a second pass changes nothing', () => {
    for (const seed of THEME_SEEDS) {
      const content = seed.content()
      expect(sanitizeThemeContent(content), seed.slug).toEqual(content)
    }
  })

  test('every seed passes the contrast guard rails', () => {
    for (const seed of THEME_SEEDS) {
      const { settings } = seed.content()
      expect(contrastIssues(settings), seed.slug).toEqual([])
      expect(schemeContrastIssues(settings), seed.slug).toEqual([])
    }
  })

  test('home templates only use sections the home page offers', () => {
    for (const seed of THEME_SEEDS) {
      const content = seed.content()
      for (const instance of content.templates.home) {
        const schema = sectionSchema(instance.type)
        expect(schema, `${seed.slug}:${instance.type}`).not.toBeNull()
        expect(isSectionOffered(schema!, 'home'), `${seed.slug}:${instance.type}`).toBe(true)
      }
    }
  })

  test('every home starts from primitive block sections', () => {
    for (const seed of THEME_SEEDS) {
      const content = seed.content()
      const composed = content.templates.home.filter((section) => section.type === 'blocks')
      expect(composed.length, seed.slug).toBeGreaterThanOrEqual(3)
      for (const section of composed) {
        expect(readBlocks(section.settings, 'blocks').length, seed.slug).toBeGreaterThan(0)
      }
    }
  })

  test('every home page is substantial and product/article stay complete', () => {
    for (const seed of THEME_SEEDS) {
      const content = seed.content()
      expect(content.templates.home.length, seed.slug).toBeGreaterThanOrEqual(7)
      expect(
        content.templates.product.some((section) => section.type === 'product-info'),
        seed.slug,
      ).toBe(true)
      expect(
        content.templates.article.some((section) => section.type === 'article-header'),
        seed.slug,
      ).toBe(true)
      expect(
        content.templates.article.some((section) => section.type === 'article-content'),
        seed.slug,
      ).toBe(true)
    }
  })

  test('recommended looks survive sanitising and name real looks', () => {
    for (const seed of THEME_SEEDS) {
      const content = seed.content()
      expect(content.recommendedLooks.length, seed.slug).toBe(seed.recommendedLooks.length)
      for (const key of content.recommendedLooks) expect(isLookKey(key), key).toBe(true)
    }
  })

  test('every seed fits the storage column', () => {
    for (const seed of THEME_SEEDS) {
      expect(() => serializeContent(seed.content()), seed.slug).not.toThrow()
    }
  })

  test('the marketplace and preloved looks carry their own colours and type', () => {
    const marketplace = findThemeSeed('marketplace')!.content()
    expect(marketplace.settings.colors).toEqual({
      brand: '#ff9900',
      background: '#ffffff',
      text: '#0f1111',
      accent: '#146eb4',
    })
    expect(marketplace.settings.fonts.heading).toBe('Inter')
    expect(marketplace.settings.radius).toBe('sm')

    const preloved = findThemeSeed('preloved')!.content()
    expect(preloved.settings.colors.brand).toBe('#eb2120')
    expect(preloved.settings.fonts.heading).toBe('Manrope')
    expect(preloved.settings.radius).toBe('lg')
  })

  test('a brutalist theme makes the loud choices it promises', () => {
    const brutalist = findThemeSeed('brutalist')!.content()
    expect(brutalist.settings.colors).toEqual({
      brand: '#111111',
      background: '#f4f3ee',
      text: '#111111',
      accent: '#ffd60a',
    })
    expect(brutalist.settings.radius).toBe('none')
    expect(brutalist.settings.fonts.heading).toBe('Space Grotesk')
    expect(brutalist.settings.animation).toBe('none')
    expect(brutalist.layout.header.layout).toBe('classic')
  })

  test('content() is cached, so seeding twice is free', () => {
    const seed = THEME_SEEDS[0]!
    expect(seed.content()).toBe(seed.content())
  })
})
