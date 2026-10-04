import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import { renderToString } from 'react-dom/server'
import type { ReactNode } from 'react'

import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

import {
  createSection,
  DEFAULT_THEME_SETTINGS,
  parseVideoUrl,
  readSectionStyle,
  sectionSchema,
  type SectionInstance,
} from '../src/index'
import { surfacePaint } from '../src/render/dividers'
import { spinStep } from '../src/render/premium-sections'
import {
  embedUrl,
  sampleStorefrontData,
  SectionsRenderer,
  type RenderEnvironment,
} from '../src/render/index'

const IMAGE = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"/>'

const TYPES = [
  'newsletter',
  'background-video',
  'masonry-gallery',
  'video-testimonials',
  'team',
  'press',
  'editorial-statement',
  'split-screen',
  'social-wall',
  'floating-contact',
  'spin-360',
] as const

function env(overrides: Partial<RenderEnvironment> = {}): RenderEnvironment {
  return {
    data: sampleStorefrontData('Premium Shop'),
    settings: { ...DEFAULT_THEME_SETTINGS, splash: { ...DEFAULT_THEME_SETTINGS.splash } },
    mode: 'live',
    imageUrl: () => IMAGE,
    formatPrice: (amount, currency) => `${amount} ${currency}`,
    now: new Date('2026-03-10T00:00:00.000Z'),
    ...overrides,
  }
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

const SECTIONS: SectionInstance[] = [
  createSection('newsletter', { heading: 'Newsletter please', buttonLabel: 'Join' }),
  createSection('background-video', { heading: 'Video band', poster: 'shot' }),
  createSection('masonry-gallery', {
    heading: 'Masonry',
    items: [{ image: 'a', alt: 'Photo one', link: { kind: 'none' } }],
  }),
  createSection('video-testimonials', {
    heading: 'Voices',
    items: [
      {
        name: 'Rina',
        role: 'Baker',
        quote: 'It changed our mornings.',
        video: { source: 'youtube', id: '-BpekQRliGE' },
        poster: '',
      },
    ],
  }),
  createSection('team', {
    heading: 'Our team',
    items: [{ name: 'Ayu', role: 'Founder', photo: 'p', link: { kind: 'none' } }],
  }),
  createSection('press', {
    heading: 'Press',
    items: [
      { source: 'The Journal', quote: 'A quiet phenomenon.', logo: '', link: { kind: 'none' } },
    ],
  }),
  createSection('editorial-statement', { heading: 'Made slowly', image: 'big' }),
  createSection('split-screen', { heading: 'Half and half', image: 'half' }),
  createSection('social-wall', {
    heading: 'Community',
    handle: '@premium',
    items: [{ image: 's', caption: 'Summer drop', link: { kind: 'none' } }],
  }),
  createSection('floating-contact', {
    whatsapp: '08123456789',
    email: 'hi@shop.test',
    showTop: true,
  }),
  createSection('spin-360', {
    heading: 'Turn it',
    frames: [
      { image: 'f1', alt: '' },
      { image: 'f2', alt: '' },
    ],
    caption: 'Drag to spin',
  }),
]

describe('premium section library', () => {
  test('every premium type is registered with an icon and a category', () => {
    for (const type of TYPES) {
      const schema = sectionSchema(type)
      expect(schema, type).not.toBeNull()
      expect(schema!.icon.length, type).toBeGreaterThan(0)
      expect(schema!.category.length, type).toBeGreaterThan(0)
      expect(schema!.fields.length, type).toBeGreaterThan(0)
    }
  })

  test('draws every premium section on the storefront', () => {
    const html = render(<SectionsRenderer sections={SECTIONS} env={env()} />)
    for (const text of [
      'Newsletter please',
      'Video band',
      'Masonry',
      'Photo one',
      'Voices',
      'Rina',
      'It changed our mornings.',
      'Our team',
      'Ayu',
      'Press',
      'A quiet phenomenon.',
      'Made slowly',
      'Half and half',
      'Community',
      '@premium',
      'Summer drop',
      'Turn it',
      'Drag to spin',
    ]) {
      expect(html, text).toContain(text)
    }
    // A YouTube testimonial shows its play button and its own thumbnail,
    // even when the seller picked no poster.
    expect(html).toContain('aria-label="Play testimonial"')
    expect(html).toContain('https://i.ytimg.com/vi/-BpekQRliGE/hqdefault.jpg')
    // The floating cluster links out; it never stores anything.
    expect(html).toContain('wa.me')
    // Every floating button carries its icon, not an empty circle.
    for (const label of ['Back to top', 'Chat on WhatsApp', 'Send an email']) {
      const at = html.indexOf(`aria-label="${label}"`)
      expect(at, label).toBeGreaterThan(-1)
      expect(html.slice(at, at + 900), label).toContain('<svg')
    }
  })
})

describe('360° spin', () => {
  test('a drag the width of the photo turns exactly one full rotation', () => {
    expect(spinStep(300, 300, 36)).toBe(36)
    expect(spinStep(150, 300, 36)).toBe(18)
    expect(spinStep(-150, 300, 36)).toBe(-18)
    expect(spinStep(0, 300, 36)).toBe(0)
    // A handful of frames turns the same distance, not the same frame count.
    expect(spinStep(300, 300, 4)).toBe(4)
    expect(spinStep(0, 0, 4)).toBe(0)
    expect(spinStep(10, 300, 0)).toBe(0)
  })

  test('draws the frame with a drag hint and without a native image drag', () => {
    const section = createSection('spin-360', {
      heading: 'Turn it',
      frames: [
        { image: 'f1', alt: '' },
        { image: 'f2', alt: '' },
      ],
      caption: 'Drag to spin',
    })
    const html = render(<SectionsRenderer sections={[section]} env={env()} />)
    expect(html).toContain('data-spin-360')
    expect(html).toContain('Drag to spin')
    // The browser's own image drag must not steal the pointer gesture.
    expect(html).toContain('draggable="false"')
    expect(html).toContain('touch-action:pan-y')
  })
})

describe('premium backgrounds', () => {
  test('image and video backgrounds resolve to a media layer', () => {
    const image = surfacePaint(
      readSectionStyle({
        backgroundType: 'image',
        backgroundImage: 'file',
        backgroundOverlay: 'dark',
      }),
    )
    expect(image.media).toEqual({ imageId: 'file', video: null })
    expect(image.overlay).toBe('dark')

    const video = surfacePaint(
      readSectionStyle({
        backgroundType: 'video',
        backgroundVideo: { source: 'upload', id: 'clip' },
        backgroundOverlay: 'strong',
      }),
    )
    expect(video.media?.video).toEqual({ source: 'upload', id: 'clip' })
    expect(video.overlay).toBe('strong')
  })

  test('grain and aurora are pattern overlays', () => {
    expect(
      surfacePaint(readSectionStyle({ backgroundType: 'pattern', backgroundPattern: 'grain' }))
        .pattern,
    ).toBe('grain')
    expect(
      surfacePaint(readSectionStyle({ backgroundType: 'pattern', backgroundPattern: 'aurora' }))
        .pattern,
    ).toBe('aurora')
  })

  test('a media background renders its shade and photo layer', () => {
    const section = createSection(
      'rich-text',
      { heading: 'Over a photo', body: '' },
      {
        backgroundType: 'image',
        backgroundImage: 'file',
        backgroundOverlay: 'dark',
        textShadow: true,
      },
    )
    const html = render(<SectionsRenderer sections={[section]} env={env()} />)
    expect(html).toContain('Over a photo')
    expect(html).toContain('text-shadow:0 1px 3px rgba(0, 0, 0, 0.8),0 2px 12px rgba(0, 0, 0, 0.5)')
  })
})

describe('YouTube Shorts', () => {
  test('a Shorts address parses to its id and embeds like any other video', () => {
    const video = parseVideoUrl('https://www.youtube.com/shorts/-BpekQRliGE')
    expect(video).toEqual({ source: 'youtube', id: '-BpekQRliGE' })
    const embed = embedUrl(video!, { autoplay: true, background: false })
    expect(embed).toContain('youtube-nocookie.com/embed/-BpekQRliGE')
    expect(embed).toContain('autoplay=1')
  })
})

describe('section chrome', () => {
  test('a divider has a real height, a mask and a mirrored paint', () => {
    const section = createSection(
      'rich-text',
      { heading: 'Cut', body: '' },
      { colorScheme: 'brand', dividerTop: 'wave', dividerBottom: 'slant' },
    )
    const html = render(<SectionsRenderer sections={[section]} env={env()} />)
    expect(html).toContain('mask-image')
    expect(html).toContain('translateY(-98%)')
    expect(html).toContain('translateY(98%) scaleY(-1)')
    // An empty absolute box measures zero; the divider must carry a height.
    expect(/height:\s*56px/.test(html)).toBe(true)
    expect(/height:\s*96px/.test(html)).toBe(true)
  })

  test('a plain section divider still carves the page colour', () => {
    const section = createSection('rich-text', { heading: 'Cut', body: '' }, { dividerTop: 'wave' })
    const html = render(<SectionsRenderer sections={[section]} env={env()} />)
    expect(html).toContain('mask-image')
    expect(/background(-color)?:var\(--chakra-colors-bg\)/.test(html)).toBe(true)
  })

  test('a banner divider carries the banner photo, not the page colour', () => {
    const section = createSection(
      'hero',
      { heading: 'Photo', image: 'hero-photo' },
      { dividerTop: 'wave', dividerBottom: 'wave' },
    )
    const html = render(<SectionsRenderer sections={[section]} env={env()} />)
    expect(html).toContain('mask-image')
    // The hero's own photo, plus one photo slice per divider: before this,
    // the dividers were page-coloured and only the hero had an image.
    expect((html.match(/<img/g) ?? []).length).toBe(3)
  })

  test('a photo-less hero divider mirrors its own wash', () => {
    const section = createSection('hero', { heading: 'Wash' }, { dividerTop: 'wave' })
    const html = render(<SectionsRenderer sections={[section]} env={env()} />)
    expect(/background(-color)?:var\(--chakra-colors-brand-subtle\)/.test(html)).toBe(true)
  })

  test('a testimonial photo is a plain visible image, never a hidden avatar', () => {
    const section = createSection('testimonials', {
      heading: 'Quotes',
      items: [{ quote: 'Great', author: 'Rina', role: '', avatar: 'file1' }],
    })
    const html = render(<SectionsRenderer sections={[section]} env={env()} />)
    // The env's image URL reaches an <img>, and Chakra's hidden Avatar.Image
    // (which can stay hidden when a cached photo loads before hydration) is gone.
    expect(html).toContain('data:image/svg+xml')
    expect(html).not.toContain('data-part="image"')
  })
})

describe('divider colour', () => {
  test('defaults to the section paint, and reads a chosen band', () => {
    expect(readSectionStyle({ dividerTop: 'wave' }).dividerTone).toBe('auto')
    expect(readSectionStyle({ dividerTone: 'brand' }).dividerTone).toBe('brand')
    expect(readSectionStyle({ dividerTone: 'neon' }).dividerTone).toBe('auto')
  })

  test('a chosen band paints the shape even between same-coloured sections', () => {
    const accent = { ...DEFAULT_THEME_SETTINGS.colors, accent: '#123456' }
    const section = createSection(
      'rich-text',
      { heading: 'Plain', body: '' },
      { dividerTop: 'wave', dividerBottom: 'wave', dividerTone: 'accent' },
    )
    const html = render(
      <SectionsRenderer
        sections={[section]}
        env={env({ settings: { ...DEFAULT_THEME_SETTINGS, colors: accent } })}
      />,
    )
    expect(html).toContain('mask-image')
    expect(html).toContain('#123456')
  })
})

describe('floating contact theming', () => {
  test('the cluster carries the theme variables, so its buttons follow the brand', () => {
    const colors = { ...DEFAULT_THEME_SETTINGS.colors, brand: '#123456' }
    const section = createSection('floating-contact', {
      whatsapp: '08123456789',
      email: '',
      showTop: false,
    })
    const html = render(
      <SectionsRenderer
        sections={[section]}
        env={env({ settings: { ...DEFAULT_THEME_SETTINGS, colors } })}
      />,
    )
    expect(html).toContain('--chakra-colors-brand-solid:#123456')
  })
})
