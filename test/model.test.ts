import { describe, expect, test } from 'bun:test'

import {
  contrastIssues,
  createSection,
  DEFAULT_THEME_SETTINGS,
  imageFileIds,
  parseThemeContent,
  remapImageFileIds,
  sanitizeLink,
  sanitizeSections,
  sanitizeThemeContent,
  sanitizeThemeSettings,
  serializeContent,
  ContentTooLargeError,
  storefrontHref,
  THEME_PRESETS,
  themeCssVars,
} from '../src/index'

describe('links', () => {
  test('refuses script and data URLs', () => {
    expect(sanitizeLink({ kind: 'url', href: 'javascript:alert(1)' })).toEqual({ kind: 'none' })
    expect(sanitizeLink({ kind: 'url', href: 'data:text/html,<script>' })).toEqual({ kind: 'none' })
    expect(sanitizeLink({ kind: 'url', href: 'https://example.com/a' })).toEqual({
      kind: 'url',
      href: 'https://example.com/a',
    })
  })

  test('refuses malformed slugs and unknown kinds', () => {
    expect(sanitizeLink({ kind: 'page', slug: '../admin' })).toEqual({ kind: 'none' })
    expect(sanitizeLink({ kind: 'ftp', href: 'x' })).toEqual({ kind: 'none' })
    expect(sanitizeLink('https://example.com')).toEqual({ kind: 'none' })
  })

  test('builds storefront routes', () => {
    expect(storefrontHref({ kind: 'collection', slug: 'sale' })).toBe('/k/sale')
    expect(storefrontHref({ kind: 'search', query: 'kaos polos' })).toBe('/search?q=kaos%20polos')
    expect(storefrontHref({ kind: 'none' })).toBeNull()
  })
})

describe('sections', () => {
  test('drops unknown types and undeclared keys, defaults bad values', () => {
    const sections = sanitizeSections([
      { id: 'a', type: 'nope', settings: {} },
      {
        id: 'b',
        type: 'latest-products',
        settings: { limit: 9999, heading: 42, style: 'color:red', columns: '3' },
      },
    ])
    expect(sections).toHaveLength(1)
    expect(sections[0]!.settings).toEqual({ heading: 'New arrivals', limit: 12, columns: '3' })
    expect(sections[0]!.settings).not.toHaveProperty('style')
  })

  test('re-ids duplicate section ids', () => {
    const sections = sanitizeSections([
      { id: 'same', type: 'rich-text', settings: {} },
      { id: 'same', type: 'rich-text', settings: {} },
    ])
    expect(new Set(sections.map((s) => s.id)).size).toBe(2)
  })

  test('sanitises list items, including their links', () => {
    const [faq] = sanitizeSections([
      {
        id: 'f',
        type: 'image-gallery',
        settings: {
          items: [{ image: 'file_1', link: { kind: 'url', href: 'javascript:x' }, extra: 1 }],
        },
      },
    ])
    const items = faq!.settings.items as Array<Record<string, unknown>>
    expect(items[0]!.link).toEqual({ kind: 'none' })
    expect(items[0]).not.toHaveProperty('extra')
    expect(typeof items[0]!.id).toBe('string')
  })

  test('image ids are found and remapped, unmapped ones cleared', () => {
    const sections = [
      createSection('hero', { image: 'old_a' }),
      createSection('image-gallery', { items: [{ image: 'old_b' }, { image: 'gone' }] }),
    ]
    expect(imageFileIds(sections).sort()).toEqual(['gone', 'old_a', 'old_b'])

    const remapped = remapImageFileIds(
      sections,
      new Map([
        ['old_a', 'new_a'],
        ['old_b', 'new_b'],
      ]),
    )
    expect(remapped[0]!.settings.image).toBe('new_a')
    const items = remapped[1]!.settings.items as Array<Record<string, unknown>>
    expect(items.map((item) => item.image)).toEqual(['new_b', ''])
  })
})

describe('theme content', () => {
  test('a corrupt or empty document reads as a valid empty theme', () => {
    expect(parseThemeContent('{not json').templates.home).toEqual([])
    expect(parseThemeContent(null).settings).toEqual(DEFAULT_THEME_SETTINGS)
  })

  test('bad settings fall back field by field', () => {
    const settings = sanitizeThemeSettings({
      colors: { brand: 'red', background: '#FFFFFF', text: '#000000', accent: '#123456' },
      fonts: { heading: 'Comic Sans', body: 'Inter' },
      radius: 'huge',
    })
    expect(settings.colors.brand).toBe(DEFAULT_THEME_SETTINGS.colors.brand)
    expect(settings.colors.background).toBe('#ffffff')
    expect(settings.fonts).toEqual({ heading: 'Poppins', body: 'Inter' })
    expect(settings.radius).toBe('md')
  })

  test('every preset survives its own sanitiser unchanged', () => {
    for (const preset of THEME_PRESETS) {
      const content = preset.content()
      expect(sanitizeThemeContent(content)).toEqual(content)
    }
  })

  test('refuses content past the column size', () => {
    const huge = sanitizeThemeContent({
      templates: {
        home: Array.from({ length: 40 }, () => ({
          type: 'rich-text',
          settings: { body: 'x'.repeat(2000), heading: 'y'.repeat(120) },
        })),
      },
    })
    expect(() => serializeContent(huge)).not.toThrow()
    const faq = {
      templates: {
        home: Array.from({ length: 40 }, () => ({
          type: 'faq',
          settings: {
            items: Array.from({ length: 30 }, () => ({
              question: 'q'.repeat(200),
              answer: 'a'.repeat(2000),
            })),
          },
        })),
      },
    }
    expect(() => serializeContent(sanitizeThemeContent(faq))).toThrow(ContentTooLargeError)
  })
})

describe('colour', () => {
  test('flags unreadable text', () => {
    const settings = {
      ...DEFAULT_THEME_SETTINGS,
      colors: { ...DEFAULT_THEME_SETTINGS.colors, text: '#f5f5f5' },
    }
    expect(contrastIssues(settings)).toContain('text')
    expect(contrastIssues(DEFAULT_THEME_SETTINGS)).not.toContain('text')
  })

  test('overrides semantic tokens, not only the ramp', () => {
    const vars = themeCssVars({
      ...DEFAULT_THEME_SETTINGS,
      colors: { ...DEFAULT_THEME_SETTINGS.colors, brand: '#0055ff' },
    })
    expect(vars['--chakra-colors-brand-500']).toBe('#0055ff')
    expect(vars['--chakra-colors-brand-solid']).toBe('#0055ff')
    expect(vars['--chakra-colors-brand-contrast']).toBe('#ffffff')
  })
})
