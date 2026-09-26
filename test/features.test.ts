import { describe, expect, test } from 'bun:test'

import {
  createSection,
  DEFAULT_THEME_SETTINGS,
  imageFileIds,
  isWithinSchedule,
  parseVideoUrl,
  productIds,
  readSectionStyle,
  remapThemeImages,
  resolveScheme,
  sanitizeLayout,
  sanitizeMenuItems,
  sanitizePageContent,
  sanitizeSections,
  sanitizeSizeGuideTable,
  sanitizeTable,
  sanitizeThemeContent,
  sanitizeThemeSettings,
  sanitizeVideo,
  schemeContrastIssues,
  schemeCssVars,
  scheduleState,
  THEME_PRESETS,
  videoFileIds,
} from '../src/index'

describe('videos', () => {
  test('keeps only the id of a YouTube or Vimeo address', () => {
    expect(parseVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10')).toEqual({
      source: 'youtube',
      id: 'dQw4w9WgXcQ',
    })
    expect(parseVideoUrl('https://youtu.be/dQw4w9WgXcQ')).toEqual({ source: 'youtube', id: 'dQw4w9WgXcQ' })
    expect(parseVideoUrl('https://youtube.com/shorts/dQw4w9WgXcQ')).toEqual({
      source: 'youtube',
      id: 'dQw4w9WgXcQ',
    })
    expect(parseVideoUrl('https://vimeo.com/channels/staffpicks/123456789')).toEqual({
      source: 'vimeo',
      id: '123456789',
    })
  })

  test('refuses other hosts and malformed ids', () => {
    expect(parseVideoUrl('https://evil.example/watch?v=dQw4w9WgXcQ')).toBeNull()
    expect(parseVideoUrl('javascript:alert(1)')).toBeNull()
    expect(sanitizeVideo({ source: 'youtube', id: '"><script>' })).toBeNull()
    expect(sanitizeVideo({ source: 'upload', id: 'abc123' })).toEqual({ source: 'upload', id: 'abc123' })
  })

  test('a background video field accepts uploads only', () => {
    const [hero] = sanitizeSections([
      { id: 'v', type: 'video-hero', settings: { video: { source: 'youtube', id: 'dQw4w9WgXcQ' } } },
    ])
    expect(hero!.settings.video).toBeNull()
  })
})

describe('tables', () => {
  test('squares a ragged grid to the header and caps its size', () => {
    const table = sanitizeTable({ columns: ['A', 'B'], rows: [['1'], ['1', '2', '3'], 'nope'] }, 5, 10)
    expect(table).toEqual({ columns: ['A', 'B'], rows: [['1', ''], ['1', '2']] })
    const guide = sanitizeSizeGuideTable({ columns: Array(50).fill('x'), rows: Array(99).fill(['a']) })
    expect(guide.columns).toHaveLength(10)
    expect(guide.rows).toHaveLength(30)
  })
})

describe('blocks', () => {
  test('a new product page gets its default blocks, in order', () => {
    const info = createSection('product-info')
    const types = (info.settings.blocks as Array<{ type: string }>).map((block) => block.type)
    expect(types).toEqual(['title', 'rating', 'price', 'purchase', 'size-guide', 'badges', 'description'])
  })

  test('drops unknown block types and blocks beyond their limit', () => {
    const [info] = sanitizeSections(
      [
        {
          id: 'p',
          type: 'product-info',
          settings: {
            blocks: [
              { id: 'a', type: 'title', settings: {} },
              { id: 'b', type: 'title', settings: {} },
              { id: 'c', type: 'iframe', settings: { src: 'x' } },
              { id: 'd', type: 'collapsible', settings: { heading: 'Care', open: 'yes' } },
            ],
          },
        },
      ],
      'product',
    )
    const blocks = info!.settings.blocks as Array<{ type: string; settings: Record<string, unknown> }>
    expect(blocks.map((block) => block.type)).toEqual(['title', 'collapsible'])
    expect(blocks[1]!.settings.open).toBe(false)
  })
})

describe('scopes', () => {
  test('the product page cannot land on the home page, and vice versa', () => {
    expect(sanitizeSections([{ id: 'a', type: 'product-info', settings: {} }], 'home')).toHaveLength(0)
    expect(sanitizeSections([{ id: 'b', type: 'banner-slider', settings: {} }], 'product')).toHaveLength(0)
    expect(sanitizePageContent({ sections: [{ id: 'c', type: 'product-reviews' }] }).sections).toHaveLength(0)
  })

  test('a theme without a product page gets the default one', () => {
    const content = sanitizeThemeContent({ templates: { home: [] } })
    expect(content.templates.product.map((section) => section.type)).toEqual([
      'product-info',
      'product-reviews',
      'related-products',
    ])
  })

  test('a product page that lost its buy box gets it back', () => {
    const content = sanitizeThemeContent({
      templates: { product: [{ id: 'r', type: 'related-products', settings: {} }] },
    })
    expect(content.templates.product[0]!.type).toBe('product-info')
  })
})

describe('section style', () => {
  test('a section saved before styles existed reads as it always looked', () => {
    const [section] = sanitizeSections([{ id: 'x', type: 'rich-text', settings: {} }])
    expect(readSectionStyle(section!.style)).toMatchObject({
      scheme: null,
      width: 'contained',
      paddingTop: 'auto',
      visibility: 'all',
      showFrom: null,
      showUntil: null,
    })
  })

  test('schedules include their start and exclude their end', () => {
    const style = readSectionStyle({
      showFrom: '2026-11-11T00:00:00.000Z',
      showUntil: '2026-11-12T00:00:00.000Z',
    })
    expect(isWithinSchedule(style, new Date('2026-11-10T23:59:59Z'))).toBe(false)
    expect(isWithinSchedule(style, new Date('2026-11-11T00:00:00Z'))).toBe(true)
    expect(isWithinSchedule(style, new Date('2026-11-12T00:00:00Z'))).toBe(false)
    expect(scheduleState(style, new Date('2026-11-01T00:00:00Z'))).toBe('scheduled')
  })

  test('a garbage date is no date', () => {
    const [section] = sanitizeSections([
      { id: 'x', type: 'rich-text', style: { showFrom: 'next tuesday-ish', colorScheme: 'neon' } },
    ])
    expect(section!.style.showFrom).toBe('')
    expect(section!.style.colorScheme).toBe('default')
  })
})

describe('colour schemes', () => {
  test('automatic schemes are readable', () => {
    for (const preset of THEME_PRESETS) {
      const settings = preset.content().settings
      expect(schemeContrastIssues(settings)).toEqual([])
      for (const key of ['subtle', 'inverse', 'brand', 'accent'] as const) {
        const scheme = resolveScheme(settings, key)
        expect(scheme.background).toMatch(/^#[0-9a-f]{6}$/)
      }
    }
  })

  test("a seller's unreadable scheme is reported, and only a full, hex scheme is kept", () => {
    const settings = sanitizeThemeSettings({
      schemes: {
        brand: { background: '#ffffff', text: '#fefefe', button: '#000000' },
        accent: { background: 'red', text: '#000000', button: '#000000' },
      },
    })
    expect(settings.schemes.accent).toBeUndefined()
    expect(schemeContrastIssues(settings)).toEqual(['brand'])
  })

  test('scheme variables are only ever hex colours', () => {
    const vars = schemeCssVars(resolveScheme(DEFAULT_THEME_SETTINGS, 'inverse'))
    for (const value of Object.values(vars)) expect(value).toMatch(/^#[0-9a-f]{6}$/)
  })

  test('animation defaults to none for a theme that never chose', () => {
    expect(sanitizeThemeSettings({}).animation).toBe('none')
    expect(sanitizeThemeSettings({ animation: 'spin' }).animation).toBe('none')
  })
})

describe('what a layout refers to', () => {
  const sections = sanitizeSections([
    { id: 'a', type: 'featured-product', settings: { productId: 'prod1' } },
    {
      id: 'b',
      type: 'lookbook',
      settings: { image: 'img1', hotspots: [{ id: 'h', productId: 'prod2', position: { x: 10, y: 20 } }] },
    },
    {
      id: 'c',
      type: 'video-reels',
      settings: { items: [{ id: 'r', video: { source: 'upload', id: 'vid1' }, poster: 'img2', productId: 'prod1' }] },
    },
  ])

  test('finds products, images and uploaded videos however deep', () => {
    expect(productIds(sections).sort()).toEqual(['prod1', 'prod2'])
    expect(imageFileIds(sections).sort()).toEqual(['img1', 'img2'])
    expect(videoFileIds(sections)).toEqual(['vid1'])
  })

  test('copies swap images and videos, and clear what was not copied', () => {
    const theme = sanitizeThemeContent({ templates: { home: sections } })
    const copied = remapThemeImages(theme, new Map([['img1', 'copy1']]), new Map([['vid1', 'vcopy']]))
    expect(imageFileIds(copied.templates.home).sort()).toEqual(['copy1'])
    expect(videoFileIds(copied.templates.home)).toEqual(['vcopy'])
  })
})

describe('menus', () => {
  test('keeps three levels, drops empty labels, and sanitises links', () => {
    const items = sanitizeMenuItems([
      {
        label: 'Women',
        link: { kind: 'url', href: 'javascript:alert(1)' },
        children: [{ label: 'Tops', children: [{ label: 'Tees', children: [{ label: 'Too deep' }] }] }],
      },
      { label: '   ' },
    ])
    expect(items).toHaveLength(1)
    expect(items[0]!.link).toEqual({ kind: 'none' })
    expect(items[0]!.children[0]!.children[0]!.children).toEqual([])
  })

  test('caps the whole menu', () => {
    const wide = Array.from({ length: 12 }, (_, i) => ({
      label: `L${i}`,
      children: Array.from({ length: 12 }, (_, j) => ({
        label: `C${j}`,
        children: Array.from({ length: 12 }, (_, k) => ({ label: `G${k}` })),
      })),
    }))
    const count = (list: ReturnType<typeof sanitizeMenuItems>): number =>
      list.reduce((sum, item) => sum + 1 + count(item.children), 0)
    expect(count(sanitizeMenuItems(wide))).toBeLessThanOrEqual(150)
  })
})

describe('layout', () => {
  test('header and footer default to the look the storefront had', () => {
    const layout = sanitizeLayout(null)
    expect(layout.header).toMatchObject({ layout: 'classic', sticky: true, transparentOnHome: false })
    expect(layout.footer).toMatchObject({ colorScheme: 'subtle', showPages: true })
  })
})

describe('presets', () => {
  test('every preset survives its own sanitiser unchanged in shape', () => {
    for (const preset of THEME_PRESETS) {
      const content = preset.content()
      const again = sanitizeThemeContent(JSON.parse(JSON.stringify(content)))
      expect(again.templates.home.map((s) => s.type)).toEqual(content.templates.home.map((s) => s.type))
      expect(again.templates.product.map((s) => s.type)).toEqual(
        content.templates.product.map((s) => s.type),
      )
      expect(again.layout).toEqual(content.layout)
    }
  })
})
