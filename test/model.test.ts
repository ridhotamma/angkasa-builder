import { describe, expect, test } from 'bun:test'
import {
  moveTableColumn,
  moveTableRow,
  removeTableColumn,
  removeTableRow,
} from '../src/editor/table-control'

import {
  applyInstanceEdit,
  clearOverrides,
  contrastIssues,
  contrastRatio,
  darkModeBrandFg,
  themeStylesheet,
  canDuplicateSection,
  createSection,
  detachSection,
  duplicateLinkedSection,
  duplicateSection,
  isLookKey,
  linkedCopyCount,
  linkedMaster,
  MAX_RECOMMENDED_LOOKS,
  MAX_SECTIONS,
  menuFormSchema,
  moveSection,
  parseCoordinates,
  readBlocks,
  removeSection,
  resolveLinkedSections,
  setBlockOverrides,
  setSectionOverrides,
  type MenuItem,
  DEFAULT_THEME_SETTINGS,
  imageFileIds,
  voucherIds,
  parseThemeContent,
  peekRecommendedLooks,
  remapImageFileIds,
  sanitizeLink,
  sanitizeRecommendedLooks,
  sanitizeSections,
  sectionSchema,
  sanitizeThemeContent,
  sanitizeThemeSettings,
  serializeContent,
  ContentTooLargeError,
  storefrontHref,
  THEME_PRESETS,
  findPreset,
  themeCssVars,
  themeDesignedForDark,
  themeModeCssVars,
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

  test('a section link points at its anchor on the same page', () => {
    expect(storefrontHref({ kind: 'section', sectionId: 'hero1' })).toBe('#section-hero1')
    expect(sanitizeLink({ kind: 'section', sectionId: 'hero_1-2' })).toEqual({
      kind: 'section',
      sectionId: 'hero_1-2',
    })
    // Empty, spaced and path-like ids are not section ids.
    expect(sanitizeLink({ kind: 'section', sectionId: '' })).toEqual({ kind: 'none' })
    expect(sanitizeLink({ kind: 'section', sectionId: 'a b' })).toEqual({ kind: 'none' })
    expect(sanitizeLink({ kind: 'section', sectionId: '../top' })).toEqual({ kind: 'none' })
  })
})

describe('coordinates', () => {
  test('reads the pair Google Maps copies, however it is wrapped', () => {
    expect(parseCoordinates('-6.244, 106.799')).toEqual({ latitude: -6.244, longitude: 106.799 })
    expect(parseCoordinates(' (-6.244, 106.799) ')).toEqual({
      latitude: -6.244,
      longitude: 106.799,
    })
    expect(parseCoordinates('-6.244;106.799')).toEqual({ latitude: -6.244, longitude: 106.799 })
  })

  test('refuses anything that is not an on-Earth pair', () => {
    expect(parseCoordinates('-6.244')).toBeNull()
    expect(parseCoordinates('-6.244, 106.799, 12')).toBeNull()
    expect(parseCoordinates('91, 106.799')).toBeNull()
    expect(parseCoordinates('0, 0')).toBeNull()
    expect(parseCoordinates('Jl. Dago No. 8')).toBeNull()
  })

  test('a stored pin is the pair as numbers, and an empty pin is null', () => {
    const [section] = sanitizeSections([
      {
        id: 's',
        type: 'store-locations',
        settings: {
          items: [
            { name: 'A', coordinates: '-6.2, 106.8' },
            { name: 'B', coordinates: 'not a place' },
          ],
        },
      },
    ])
    const items = section!.settings.items as Array<Record<string, unknown>>
    expect(items[0]!.coordinates).toEqual({ latitude: -6.2, longitude: 106.8 })
    expect(items[1]!.coordinates).toBeNull()
  })

  test('the old latitude and longitude fields fold into the pair', () => {
    const [section] = sanitizeSections([
      {
        id: 's',
        type: 'store-locations',
        settings: { items: [{ name: 'A', latitude: '-6.2', longitude: '106.8' }] },
      },
    ])
    const items = section!.settings.items as Array<Record<string, unknown>>
    expect(items[0]!.coordinates).toEqual({ latitude: -6.2, longitude: 106.8 })
    expect(items[0]).not.toHaveProperty('latitude')
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
    // `latest-products` converges on the consolidated `product-list` with its
    // `source` set; a 9999 limit and a 42 heading fall back to the merged type's
    // defaults, and the unknown `style` key is dropped as before.
    expect(sections[0]!.type).toBe('product-list')
    expect(sections[0]!.settings).toEqual({
      source: 'latest',
      collectionId: '',
      heading: '',
      layout: 'grid',
      bentoText: 'always',
      limit: 8,
      columns: '3',
      mobileColumns: '2',
      showAll: true,
      tabs: [],
    })
    expect(sections[0]!.settings).not.toHaveProperty('style')
  })

  test('every columns setting also offers the phone choice', () => {
    const types = [
      'featured-collection',
      'collection-shelves',
      'latest-products',
      'image-gallery',
      'collection-tabs',
      'multicolumn',
      'icon-features',
      'store-locations',
      'related-products',
      'masonry-gallery',
      'video-testimonials',
      'team',
      'social-wall',
    ]
    for (const type of types) {
      const schema = sectionSchema(type)
      expect(schema, type).not.toBeNull()
      expect(
        schema!.fields.some((field) => field.key === 'columns'),
        type,
      ).toBe(true)
      const mobile = schema!.fields.find((field) => field.key === 'mobileColumns')
      expect(mobile?.kind, type).toBe('select')
      if (mobile?.kind === 'select') {
        expect(
          mobile.options.map((option) => option.value),
          type,
        ).toEqual(['1', '2'])
      }
    }
  })

  test('text sections stack on phones, product lists keep two', () => {
    expect(createSection('icon-features', {}).settings.mobileColumns).toBe('1')
    expect(createSection('multicolumn', {}).settings.mobileColumns).toBe('1')
    expect(createSection('featured-collection', {}).settings.mobileColumns).toBe('2')
    expect(createSection('image-gallery', {}).settings.mobileColumns).toBe('2')
  })

  test('an FAQ saved before it had look settings stays centred and narrow', () => {
    const [faq] = sanitizeSections([
      { id: 'f', type: 'faq', settings: { heading: 'FAQ', items: [] } },
    ])
    expect(faq!.settings.align).toBe('center')
    expect(faq!.settings.width).toBe('narrow')
    // The look settings arrived later; an old FAQ keeps the look it always had.
    expect(faq!.settings.variant).toBe('enclosed')
    expect(faq!.settings.size).toBe('md')
    expect(faq!.settings.icon).toBe('chevron')
  })

  test('FAQ look settings outside their lists fall back to the defaults', () => {
    const [faq] = sanitizeSections([
      {
        id: 'f',
        type: 'faq',
        settings: { variant: 'stripes', size: 'huge', icon: 'arrow', items: [] },
      },
    ])
    expect(faq!.settings.variant).toBe('enclosed')
    expect(faq!.settings.size).toBe('md')
    expect(faq!.settings.icon).toBe('chevron')
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

  test('voucher ids are found in promo-codes section', () => {
    const sections = [
      createSection('promo-codes', {
        items: [
          { voucherId: 'v_1', code: '' },
          { voucherId: 'v_2', code: 'OVERRIDE' },
        ],
      }),
    ]
    expect(voucherIds(sections).sort()).toEqual(['v_1', 'v_2'])
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
      typeScale: 'enormous',
      density: 'packed',
    })
    expect(settings.colors.brand).toBe(DEFAULT_THEME_SETTINGS.colors.brand)
    expect(settings.colors.background).toBe('#ffffff')
    expect(settings.fonts).toEqual({ heading: 'Poppins', body: 'Inter' })
    expect(settings.radius).toBe('md')
    expect(settings.typeScale).toBe('default')
    expect(settings.density).toBe('cozy')
  })

  test('the built-in library is empty — templates are designed from scratch', () => {
    expect(THEME_PRESETS).toEqual([])
    expect(findPreset('classic')).toBeNull()
  })

  test('recommended looks keep known keys, deduplicated and capped', () => {
    expect(sanitizeRecommendedLooks(['warm-organic', 'nope', 'warm-organic'])).toEqual([
      'warm-organic',
    ])
    expect(sanitizeRecommendedLooks('warm-organic')).toEqual([])
    expect(sanitizeRecommendedLooks(undefined)).toEqual([])
    const many = [
      'minimal',
      'warm-organic',
      'editorial-fashion',
      'neo-brutalist',
      'luxury-boutique',
      'bold-maximal',
      'retro-vintage',
      'tech-futuristic',
    ]
    expect(sanitizeRecommendedLooks(many)).toHaveLength(MAX_RECOMMENDED_LOOKS)
    expect(isLookKey('warm-organic')).toBe(true)
    expect(isLookKey('nope')).toBe(false)
    expect(isLookKey(null)).toBe(false)
  })

  test('a theme carries its template’s suggestions; peeking never throws', () => {
    const content = sanitizeThemeContent({ recommendedLooks: ['luxury-boutique', 'nope'] })
    expect(content.recommendedLooks).toEqual(['luxury-boutique'])
    expect(peekRecommendedLooks(serializeContent(content))).toEqual(['luxury-boutique'])
    expect(peekRecommendedLooks('{not json')).toEqual([])
    expect(peekRecommendedLooks(null)).toEqual([])
    expect(peekRecommendedLooks('{"recommendedLooks":"luxury-boutique"}')).toEqual([])
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

  test('a dark theme paints its page in dark mode and a swapped cream page in light', () => {
    const dark = {
      ...DEFAULT_THEME_SETTINGS,
      colors: {
        ...DEFAULT_THEME_SETTINGS.colors,
        brand: '#c9a24d',
        background: '#141210',
        text: '#f2ead9',
      },
    }
    const css = themeStylesheet(dark)
    // The theme as designed is the dark mode; light mode swaps page and ink.
    expect(css).toMatch(/html\.dark\{[^}]*--chakra-colors-bg:#141210/)
    expect(css).toMatch(/html\.dark\{[^}]*--chakra-colors-fg:#f2ead9/)
    expect(css).toMatch(/html:not\(\.dark\)\{[^}]*--chakra-colors-bg:#f2ead9/)
    expect(css).toMatch(/html:not\(\.dark\)\{[^}]*--chakra-colors-fg:#141210/)
  })

  test('a scope can paint one mode at a time, like the preview beside its chrome', () => {
    expect(themeDesignedForDark(DEFAULT_THEME_SETTINGS)).toBe(false)

    // A light theme in light mode paints its designed surfaces.
    expect(themeModeCssVars(DEFAULT_THEME_SETTINGS, 'light')['--chakra-colors-bg']).toBe('#fffefb')
    // The same theme in dark mode sets no surfaces — Chakra's own dark tokens
    // apply — and only moves its brand ink.
    const lightInDark = themeModeCssVars(DEFAULT_THEME_SETTINGS, 'dark')
    expect(lightInDark['--chakra-colors-bg']).toBeUndefined()
    expect(lightInDark['--chakra-colors-brand-solid']).toBe(DEFAULT_THEME_SETTINGS.colors.brand)

    // A dark theme is the mirror image: dark mode as drawn, light mode swapped.
    const dark = {
      ...DEFAULT_THEME_SETTINGS,
      colors: {
        ...DEFAULT_THEME_SETTINGS.colors,
        background: '#141210',
        text: '#f2ead9',
      },
    }
    expect(themeDesignedForDark(dark)).toBe(true)
    const darkInDark = themeModeCssVars(dark, 'dark')
    expect(darkInDark['--chakra-colors-bg']).toBe('#141210')
    expect(darkInDark['--chakra-colors-fg']).toBe('#f2ead9')
    const darkInLight = themeModeCssVars(dark, 'light')
    expect(darkInLight['--chakra-colors-bg']).toBe('#f2ead9')
    expect(darkInLight['--chakra-colors-fg']).toBe('#141210')
  })

  test('the neutral palette follows the theme, not Chakra’s baked-in gray', () => {
    const vars = themeCssVars(DEFAULT_THEME_SETTINGS)
    // Ghost icon buttons read `gray.fg` and hover `gray.subtle`; on a dark
    // theme the baked-in pair is invisible ink and a near-white pill.
    expect(vars['--chakra-colors-gray-fg']).toBe('var(--chakra-colors-fg)')
    expect(vars['--chakra-colors-gray-subtle']).toBe('var(--chakra-colors-bg-muted)')
    expect(vars['--chakra-colors-gray-solid']).toBe('var(--chakra-colors-fg)')
  })

  test('panels step off the page so a card is visible without its border', () => {
    const vars = themeCssVars(DEFAULT_THEME_SETTINGS)
    expect(vars['--chakra-colors-bg-panel']).not.toBe(DEFAULT_THEME_SETTINGS.colors.background)
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

  test('the status palettes follow the shop’s own colours', () => {
    const vars = themeCssVars({
      ...DEFAULT_THEME_SETTINGS,
      colors: { ...DEFAULT_THEME_SETTINGS.colors, brand: '#0055ff', accent: '#ff0055' },
    })
    // Success wears the brand, danger the accent — badges, alerts and the
    // order stepper stop sitting in the platform's green/red.
    expect(vars['--chakra-colors-success-500']).toBe('#0055ff')
    expect(vars['--chakra-colors-success-solid']).toBe('#0055ff')
    expect(vars['--chakra-colors-success-contrast']).toBe('#ffffff')
    expect(vars['--chakra-colors-danger-500']).toBe('#ff0055')
    expect(vars['--chakra-colors-danger-solid']).toBe('#ff0055')
    // Chakra's stock green/red move with them: a `status`-only Alert paints
    // through those ramps, not through `success`/`danger`.
    expect(vars['--chakra-colors-green-500']).toBe('#0055ff')
    expect(vars['--chakra-colors-red-500']).toBe('#ff0055')
    expect(vars['--chakra-colors-green-subtle']).toBe(vars['--chakra-colors-success-subtle'])
    // Warning keeps the platform's amber: it is the third meaning, and neither
    // shop colour can stand in for it without colliding with success/danger.
    expect(vars['--chakra-colors-warning-500']).toBeUndefined()
    expect(vars['--chakra-colors-orange-500']).toBeUndefined()
  })

  test('type scale and density move every font size and spacing token', () => {
    // The middle of each scale emits nothing: the storefront as it always was.
    const base = themeCssVars(DEFAULT_THEME_SETTINGS)
    expect(base['--chakra-font-sizes-md']).toBeUndefined()
    expect(base['--chakra-spacing-4']).toBeUndefined()

    const scaled = themeCssVars({
      ...DEFAULT_THEME_SETTINGS,
      typeScale: 'large',
      density: 'airy',
    })
    expect(scaled['--chakra-font-sizes-md']).toBe('1.125rem')
    expect(scaled['--chakra-font-sizes-3xl']).toBe('2.1094rem')
    expect(scaled['--chakra-spacing-4']).toBe('1.18rem')
    expect(scaled['--chakra-spacing-6']).toBe('1.77rem')
    // A fractional token keeps Chakra's escaped dot in the variable name.
    expect(scaled['--chakra-spacing-0\\.5']).toBe('0.1475rem')
  })

  test('page width moves every container token, and leaves them alone by default', () => {
    // The default emits nothing: the storefront as it always was.
    expect(themeCssVars(DEFAULT_THEME_SETTINGS)['--chakra-sizes-6xl']).toBeUndefined()

    const narrow = themeCssVars({ ...DEFAULT_THEME_SETTINGS, pageWidth: 'narrow' })
    expect(narrow['--chakra-sizes-6xl']).toBe('61.2rem')
    expect(narrow['--chakra-sizes-3xl']).toBe('40.8rem')

    const wide = themeCssVars({ ...DEFAULT_THEME_SETTINGS, pageWidth: 'wide' })
    expect(wide['--chakra-sizes-6xl']).toBe('86.4rem')

    // An unknown value from another release reads as the default.
    const unknown = sanitizeThemeSettings({ pageWidth: 'gigantic' })
    expect(themeCssVars(unknown)['--chakra-sizes-6xl']).toBeUndefined()
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

describe('linked sections', () => {
  test('a copy draws its original and keeps its own id and hidden flag', () => {
    const master = createSection('faq', { heading: 'Tanya' })
    const copy = { ...master, id: 'copy-1', hidden: true, linkedTo: master.id }
    const [, , resolved] = resolveLinkedSections([master, createSection('faq'), copy])
    expect(resolved!.id).toBe('copy-1')
    expect(resolved!.hidden).toBe(true)
    expect(resolved!.linkedTo).toBe(master.id)
    expect(resolved!.settings.heading).toBe('Tanya')
    expect(resolved!.settings).not.toBe(master.settings)
  })

  test('sanitising keeps a real link and clears a broken one', () => {
    const master = createSection('faq', { heading: 'Asli' })
    const linked = sanitizeSections([
      { ...master, id: 'm' },
      { ...master, id: 'copy', linkedTo: 'm' },
      { ...master, id: 'dangling', linkedTo: 'missing' },
      { ...master, id: 'self', linkedTo: 'self' },
    ])
    expect(linked.find((section) => section.id === 'copy')?.linkedTo).toBe('m')
    expect(linked.find((section) => section.id === 'dangling')?.linkedTo).toBeUndefined()
    expect(linked.find((section) => section.id === 'self')?.linkedTo).toBeUndefined()
  })

  test('a loop between two copies is cleared', () => {
    const master = createSection('faq', {})
    const sections = sanitizeSections([
      { ...master, id: 'a', linkedTo: 'b' },
      { ...master, id: 'b', linkedTo: 'a' },
    ])
    expect(sections.every((section) => section.linkedTo === undefined)).toBe(true)
  })

  test('duplicating as linked points at the same original, even from a copy', () => {
    const master = createSection('faq', { heading: 'Asli' })
    const first = duplicateLinkedSection([master], master.id)!
    expect(first.copy.linkedTo).toBe(master.id)
    const second = duplicateLinkedSection(first.sections, first.copy.id)!
    expect(second.copy.linkedTo).toBe(master.id)
    expect(linkedCopyCount(second.sections, master.id)).toBe(2)
  })

  test('detaching copies the original in and drops the link', () => {
    const master = createSection('faq', { heading: 'Asli' })
    const linked = { ...master, id: 'copy', linkedTo: master.id }
    const next = detachSection([master, linked], 'copy')
    const detached = next.find((section) => section.id === 'copy')!
    expect(detached.linkedTo).toBeUndefined()
    expect(detached.settings.heading).toBe('Asli')
    // And the original is untouched.
    expect(next.find((section) => section.id === master.id)).toBe(master)
  })

  test('removing an original detaches its copies instead of emptying them', () => {
    const master = createSection('faq', { heading: 'Asli' })
    const linked = { ...master, id: 'copy', linkedTo: master.id }
    const next = removeSection([master, linked], master.id)
    expect(next.map((section) => section.id)).toEqual(['copy'])
    expect(next[0]!.linkedTo).toBeUndefined()
    expect(next[0]!.settings.heading).toBe('Asli')
  })

  test('a chain resolves through to the final original', () => {
    const master = createSection('faq', { heading: 'Ujung' })
    const middle = { ...master, id: 'mid', linkedTo: master.id }
    const end = { ...master, id: 'end', linkedTo: 'mid' }
    expect(linkedMaster(end, [master, middle, end])?.id).toBe(master.id)
    const resolved = resolveLinkedSections([master, middle, end])
    expect(resolved[2]!.settings.heading).toBe('Ujung')
  })
})

describe('per-instance overrides', () => {
  test('a copy draws its own words over the original’s', () => {
    const master = createSection('rich-text', { heading: 'Asli', body: 'Badan' })
    const copy = {
      ...master,
      id: 'copy',
      linkedTo: master.id,
      overrides: { fields: { heading: 'Sendiri' } },
    }
    const [, resolved] = resolveLinkedSections([master, copy])
    expect(resolved!.settings.heading).toBe('Sendiri')
    expect(resolved!.settings.body).toEqual(master.settings.body)
  })

  test('sanitising keeps overridable overrides and drops the rest', () => {
    const master = createSection('rich-text', { heading: 'Asli', body: 'Badan' })
    const clean = sanitizeSections([
      { ...master, id: 'm' },
      {
        ...master,
        id: 'copy',
        linkedTo: 'm',
        overrides: { fields: { heading: 'Sendiri', width: 'narrow', sneaky: 'x' } },
      },
    ])[1]!
    expect(clean.overrides?.fields).toEqual({ heading: 'Sendiri' })
  })

  test('setting a value back to the original drops the override', () => {
    const master = createSection('rich-text', { heading: 'Asli', body: 'Badan' })
    const copy = {
      ...master,
      id: 'copy',
      linkedTo: master.id,
      overrides: { fields: { heading: 'Sendiri' } },
    }
    const sections = setSectionOverrides([master, copy], 'copy', {
      heading: 'Asli',
      body: 'Badan',
    })
    expect(sections[1]!.overrides).toBeUndefined()
  })

  test('a block override layers over the original and resets cleanly', () => {
    const master = createSection('custom', {
      blocks: [{ id: 'h', type: 'heading', settings: { text: 'Asli' } }],
    })
    const copy = { ...master, id: 'copy', linkedTo: master.id }
    const withOverride = setBlockOverrides([master, copy], 'copy', 'h', { text: 'Sendiri' })
    expect(withOverride[1]!.overrides?.blocks?.h).toEqual({ text: 'Sendiri' })

    const [, resolved] = resolveLinkedSections(withOverride)
    expect(readBlocks(resolved!.settings, 'blocks')[0]!.settings.text).toBe('Sendiri')

    const reset = clearOverrides(withOverride, 'copy', { blockId: 'h' })
    expect(reset[1]!.overrides).toBeUndefined()
  })

  test('a structural block change updates the original instead', () => {
    const master = createSection('custom', {
      blocks: [{ id: 'h', type: 'heading', settings: { text: 'Asli', align: 'left' } }],
    })
    const copy = { ...master, id: 'copy', linkedTo: master.id }
    const sections = setBlockOverrides([master, copy], 'copy', 'h', { align: 'center' })
    expect(readBlocks(sections[0]!.settings, 'blocks')[0]!.settings.align).toBe('center')
    expect(sections[1]!.overrides).toBeUndefined()
  })

  test('applyInstanceEdit splits content to the copy and structure to the original', () => {
    const master = createSection('rich-text', { heading: 'Asli', body: 'Badan' })
    const copy = { ...master, id: 'copy', linkedTo: master.id }
    const resolved = resolveLinkedSections([master, copy]).find((section) => section.id === 'copy')!
    const edited = {
      ...resolved,
      settings: { ...resolved.settings, heading: 'Sendiri', width: 'narrow' },
    }
    const sections = applyInstanceEdit([master, copy], 'copy', edited)
    expect(sections[1]!.overrides?.fields).toEqual({ heading: 'Sendiri' })
    expect(sections[0]!.settings.width).toBe('narrow')
  })

  test('detaching keeps the copy’s own words', () => {
    const master = createSection('rich-text', { heading: 'Asli', body: 'Badan' })
    const copy = {
      ...master,
      id: 'copy',
      linkedTo: master.id,
      overrides: { fields: { heading: 'Sendiri' } },
    }
    const detached = detachSection([master, copy], 'copy')[1]!
    expect(detached.linkedTo).toBeUndefined()
    expect(detached.settings.heading).toBe('Sendiri')
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
  const table = {
    columns: ['Size', 'Chest', 'Waist'],
    rows: [
      ['S', '88', '72'],
      ['M', '96', '80'],
    ],
  }

  test('moves a column with its cells, and not past either edge', () => {
    expect(moveTableColumn(table, 0, 1)).toEqual({
      columns: ['Chest', 'Size', 'Waist'],
      rows: [
        ['88', 'S', '72'],
        ['96', 'M', '80'],
      ],
    })
    expect(moveTableColumn(table, 2, 1)).toBe(table)
  })

  test('moves a body row, never the header', () => {
    expect(moveTableRow(table, 1, -1).rows).toEqual([
      ['M', '96', '80'],
      ['S', '88', '72'],
    ])
    expect(moveTableRow(table, -1, 1)).toBe(table)
    expect(moveTableRow(table, 0, -1)).toBe(table)
  })

  test('deletes a column with its cells, but never the last one', () => {
    expect(removeTableColumn(table, 1)).toEqual({
      columns: ['Size', 'Waist'],
      rows: [
        ['S', '72'],
        ['M', '80'],
      ],
    })
    const single = { columns: ['Size'], rows: [['S']] }
    expect(removeTableColumn(single, 0)).toBe(single)
  })

  test('deletes a body row, never the header', () => {
    expect(removeTableRow(table, 0).rows).toEqual([['M', '96', '80']])
    expect(removeTableRow(table, -1)).toBe(table)
  })
})
