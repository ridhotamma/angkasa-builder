import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import { renderToString } from 'react-dom/server'
import type { ReactNode } from 'react'

import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

import {
  createSection,
  DEFAULT_THEME_SETTINGS,
  readSectionStyle,
  sectionSchema,
  type SectionInstance,
} from '../src/index'
import { surfacePaint } from '../src/render/dividers'
import { sampleStorefrontData, SectionsRenderer, type RenderEnvironment } from '../src/render/index'

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
    items: [{ name: 'Rina', role: 'Baker', quote: 'It changed our mornings.', video: '' }],
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
  createSection('floating-contact', { whatsapp: '08123456789', email: '', showTop: true }),
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
    // The floating cluster links out; it never stores anything.
    expect(html).toContain('wa.me')
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
    expect(html).toContain('text-shadow')
  })
})
