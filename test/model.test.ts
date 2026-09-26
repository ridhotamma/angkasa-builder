import { describe, expect, test } from 'bun:test'
import {
  moveTableColumn,
  moveTableRow,
  removeTableColumn,
  removeTableRow,
} from '../src/editor/table-control'

import {
  contrastIssues,
  contrastRatio,
  darkModeBrandFg,
  themeStylesheet,
  canDuplicateSection,
  createSection,
  duplicateSection,
  MAX_SECTIONS,
  menuFormSchema,
  moveSection,
  type MenuItem,
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

  test('an FAQ saved before it had layout settings stays centred and narrow', () => {
    const [faq] = sanitizeSections([
      { id: 'f', type: 'faq', settings: { heading: 'FAQ', items: [] } },
    ])
    expect(faq!.settings.align).toBe('center')
    expect(faq!.settings.width).toBe('narrow')
  })

  test('a colour setting accepts only a hex code, since it lands inside CSS', () => {
    const [intro] = sanitizeSections([
      {
        id: 'i',
        type: 'shop-intro',
        settings: { patternColor: 'red; background: url(x)', patternBackground: '#ABCDEF' },
      },
    ])
    expect(intro!.settings.patternColor).toBe('#444cf7')
    expect(intro!.settings.patternBackground).toBe('#abcdef')
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

  test('keeps brand text readable in dark mode for a near-black brand colour', () => {
    const fg = darkModeBrandFg('#1f2937')
    expect(fg).not.toBe('#1f2937')
    expect(contrastRatio(fg, '#140c0c')).toBeGreaterThanOrEqual(4.5)
    expect(darkModeBrandFg('#ff9900')).toBe('#ff9900')
  })

  test('scopes light surfaces to light mode in the document stylesheet', () => {
    const css = themeStylesheet(DEFAULT_THEME_SETTINGS)
    expect(css).toMatch(/^:root\{[^}]*--chakra-colors-brand-solid:/)
    expect(css).toMatch(/html:not\(\.dark\)\{[^}]*--chakra-colors-bg:#fffefb/)
    expect(css).not.toMatch(/:root\{[^}]*--chakra-colors-bg:/)
    expect(css).toContain('html.dark{--chakra-colors-brand-fg:')
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

describe('editing a section list', () => {
  const page = () => [createSection('timeline'), createSection('faq'), createSection('lookbook')]

  test('moves a section one place, and not off either end', () => {
    const sections = page()
    const [a, b, c] = sections.map((section) => section.id) as [string, string, string]
    expect(moveSection(sections, a, 1).map((section) => section.id)).toEqual([b, a, c])
    expect(moveSection(sections, c, -1).map((section) => section.id)).toEqual([a, c, b])
    expect(moveSection(sections, a, -1)).toBe(sections)
    expect(moveSection(sections, c, 1)).toBe(sections)
  })

  test('duplicates right after the original, as a separate copy', () => {
    const sections = page()
    const result = duplicateSection(sections, sections[0]!.id)!
    expect(result.sections).toHaveLength(4)
    expect(result.sections[1]).toBe(result.copy)
    expect(result.copy.id).not.toBe(sections[0]!.id)
    expect(result.copy.settings).toEqual(sections[0]!.settings)
    expect(result.copy.settings).not.toBe(sections[0]!.settings)
  })

  test('will not copy a one-per-page section, or past the page limit', () => {
    const reviews = [createSection('product-reviews')]
    expect(canDuplicateSection(reviews, reviews[0]!.id)).toBe(false)
    expect(duplicateSection(reviews, reviews[0]!.id)).toBeNull()

    const full = Array.from({ length: MAX_SECTIONS }, () => createSection('faq'))
    expect(canDuplicateSection(full, full[0]!.id)).toBe(false)
  })
})

describe('menu form', () => {
  const link = (label: string, children: MenuItem[] = []): MenuItem => ({
    id: label || 'blank',
    label,
    link: { kind: 'none' },
    children,
  })

  test('accepts labelled links, nested', () => {
    expect(menuFormSchema.safeParse({ items: [link('Shop', [link('Shirts')])] }).success).toBe(true)
  })

  test('flags a link with no label at its own path, instead of dropping it', () => {
    const result = menuFormSchema.safeParse({ items: [link('Shop', [link('Shirts'), link('  ')])] })
    expect(result.success).toBe(false)
    expect(result.error!.issues.map((issue) => issue.path)).toEqual([
      ['items', 0, 'children', 1, 'label'],
    ])
  })
})

describe('table edits', () => {
  const table = { columns: ['Size', 'Chest', 'Waist'], rows: [['S', '88', '72'], ['M', '96', '80']] }

  test('moves a column with its cells, and not past either edge', () => {
    expect(moveTableColumn(table, 0, 1)).toEqual({
      columns: ['Chest', 'Size', 'Waist'],
      rows: [['88', 'S', '72'], ['96', 'M', '80']],
    })
    expect(moveTableColumn(table, 2, 1)).toBe(table)
  })

  test('moves a body row, never the header', () => {
    expect(moveTableRow(table, 1, -1).rows).toEqual([['M', '96', '80'], ['S', '88', '72']])
    expect(moveTableRow(table, -1, 1)).toBe(table)
    expect(moveTableRow(table, 0, -1)).toBe(table)
  })

  test('deletes a column with its cells, but never the last one', () => {
    expect(removeTableColumn(table, 1)).toEqual({ columns: ['Size', 'Waist'], rows: [['S', '72'], ['M', '80']] })
    const single = { columns: ['Size'], rows: [['S']] }
    expect(removeTableColumn(single, 0)).toBe(single)
  })

  test('deletes a body row, never the header', () => {
    expect(removeTableRow(table, 0).rows).toEqual([['M', '96', '80']])
    expect(removeTableRow(table, -1)).toBe(table)
  })
})
