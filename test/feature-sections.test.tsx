import { describe, expect, test } from 'bun:test'
import { Box, ChakraProvider } from '@chakra-ui/react'
import { renderToString } from 'react-dom/server'
import type { ReactNode } from 'react'

import { I18nProvider } from '@repo/i18n'
import { SECTION_TEXT_SHADOW_ENABLED } from '@repo/appwrite-config'
import { system } from '@repo/theme'

import {
  BANNER_SLIDES_PER_VIEW,
  createSection,
  DEFAULT_THEME_SETTINGS,
  parseVideoUrl,
  readSectionStyle,
  richDocFromPlainText,
  sectionAnchorId,
  sectionSchema,
  SLIDES_PER_VIEW_MOBILE,
  type SectionInstance,
} from '../src/index'
import { surfacePaint } from '../src/render/dividers'
import { spinStep } from '../src/render/feature-sections'
import { AmbientVideo } from '../src/render/media'
import { Slider, sliderTransform } from '../src/render/slider'
import { sectionBackground } from '../src/render/section-background'
import {
  embedUrl,
  pageEdges,
  RenderProvider,
  sampleStorefrontData,
  SectionsRenderer,
  type RenderEnvironment,
} from '../src/render/index'

const IMAGE = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"/>'

const TYPES = [
  'banner',
  'gallery',
  'quotes',
  'cards',
  'statement',
  'floating-contact',
  'spin-360',
] as const

function env(overrides: Partial<RenderEnvironment> = {}): RenderEnvironment {
  return {
    data: sampleStorefrontData('Feature Shop'),
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
  createSection('banner', { media: 'video', heading: 'Video band', poster: 'shot' }),
  createSection('gallery', {
    layout: 'masonry',
    heading: 'Masonry',
    items: [{ image: 'a', alt: 'Photo one', link: { kind: 'none' } }],
  }),
  createSection('quotes', {
    variant: 'video',
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
  createSection('cards', {
    card: 'person',
    heading: 'Our team',
    items: [{ name: 'Ayu', role: 'Founder', photo: 'p', link: { kind: 'none' } }],
  }),
  createSection('statement', { layout: 'full', heading: 'Made slowly', image: 'big' }),
  createSection('statement', { layout: 'split', heading: 'Half and half', image: 'half' }),
  createSection('gallery', {
    layout: 'social',
    heading: 'Community',
    handle: '@ourstore',
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

describe('feature section library', () => {
  test('every feature type is registered with an icon and a category', () => {
    for (const type of TYPES) {
      const schema = sectionSchema(type)
      expect(schema, type).not.toBeNull()
      expect(schema!.icon.length, type).toBeGreaterThan(0)
      expect(schema!.category.length, type).toBeGreaterThan(0)
      expect(schema!.fields.length, type).toBeGreaterThan(0)
    }
  })

  test('draws every feature section on the storefront', () => {
    const html = render(<SectionsRenderer sections={SECTIONS} env={env()} />)
    for (const text of [
      'Video band',
      'Masonry',
      'Photo one',
      'Voices',
      'Rina',
      'It changed our mornings.',
      'Our team',
      'Ayu',
      'Made slowly',
      'Half and half',
      'Community',
      '@ourstore',
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
      },
    )
    const html = render(<SectionsRenderer sections={[section]} env={env()} />)
    expect(html).toContain('Over a photo')
  })

  test('a background photo takes its size and position from the style', () => {
    // A stored row: the surface picker does not offer a photo background yet,
    // so the style is written directly — the renderer honours it either way,
    // and the day the picker offers one its two controls are already here.
    const base = createSection('rich-text', { heading: 'Over a photo', body: '' })
    const section = {
      ...base,
      style: {
        ...base.style,
        backgroundType: 'image',
        backgroundImage: 'file',
        backgroundSize: 'contain',
        backgroundPosition: 'right top',
      },
    }
    const html = render(<SectionsRenderer sections={[section]} env={env()} />)
    expect(html).toContain('object-fit:contain')
    expect(html).toContain('object-position:right top')
  })

  test.skipIf(!SECTION_TEXT_SHADOW_ENABLED)('a text shadow lifts the copy over a photo', () => {
    const section = createSection(
      'rich-text',
      { heading: 'Over a photo', body: '' },
      { backgroundType: 'image', backgroundImage: 'file', textShadow: true },
    )
    const html = render(<SectionsRenderer sections={[section]} env={env()} />)
    expect(html).toContain('text-shadow:0 1px 3px rgba(0, 0, 0, 0.8),0 2px 12px rgba(0, 0, 0, 0.5)')
  })

  test.skipIf(SECTION_TEXT_SHADOW_ENABLED)(
    'a stored text shadow is ignored while switched off',
    () => {
      const section = createSection(
        'rich-text',
        { heading: 'Over a photo', body: '' },
        { backgroundType: 'image', backgroundImage: 'file', textShadow: true },
      )
      const html = render(<SectionsRenderer sections={[section]} env={env()} />)
      expect(html).not.toContain('text-shadow:0 1px 3px')
    },
  )
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
      'banner',
      { media: 'image', heading: 'Photo', image: 'hero-photo' },
      { dividerTop: 'wave', dividerBottom: 'wave' },
    )
    const html = render(<SectionsRenderer sections={[section]} env={env()} />)
    expect(html).toContain('mask-image')
    // The hero's own photo, plus one photo slice per divider: before this,
    // the dividers were page-coloured and only the hero had an image.
    expect((html.match(/<img/g) ?? []).length).toBe(3)
  })

  test('a photo-less hero divider mirrors its own wash', () => {
    const section = createSection(
      'banner',
      { media: 'image', heading: 'Wash' },
      { dividerTop: 'wave' },
    )
    const html = render(<SectionsRenderer sections={[section]} env={env()} />)
    expect(/background(-color)?:var\(--chakra-colors-brand-subtle\)/.test(html)).toBe(true)
  })

  test('a hero photo takes its size and position, and its dividers follow', () => {
    const section = createSection(
      'banner',
      { media: 'image', heading: 'Photo', image: 'hero-photo', fit: 'contain', position: 'top' },
      { dividerTop: 'wave' },
    )
    const html = render(<SectionsRenderer sections={[section]} env={env()} />)
    // Identical styles collapse into one emotion rule, which the hero's photo
    // and the divider's slice both wear — so the rule is asserted once, and
    // the elements that must share it are counted.
    expect(html).toContain('object-fit:contain')
    expect(html).toContain('object-position:top')
    expect(html).not.toContain('object-fit:cover')
    expect((html.match(/<img/g) ?? []).length).toBe(2)
  })

  test('a video banner poster crops by its own size and position', () => {
    const section = createSection('banner', {
      media: 'video',
      poster: 'poster',
      fit: 'contain',
      position: 'left',
    })
    const html = render(<SectionsRenderer sections={[section]} env={env()} />)
    expect(html).toContain('object-fit:contain')
    expect(html).toContain('object-position:left')
  })

  test('an ambient video draws no play, pause or volume chrome over it', () => {
    const html = render(
      <RenderProvider
        value={env({
          videoUrl: () => 'https://example.com/clip.mp4',
          mode: 'live',
        })}
      >
        <AmbientVideo fileId="clip" poster={null} />
      </RenderProvider>,
    )
    expect(html).toContain('<video')
    // Silent, looped decoration — never a native control bar.
    expect(html).not.toContain('controls')
    // And no custom play/pause or mute buttons either.
    expect(html).not.toContain('aria-label="Pause"')
    expect(html).not.toContain('aria-label="Play"')
    expect(html).not.toContain('aria-label="Mute"')
    expect(html).not.toContain('aria-label="Unmute"')
  })

  test('a looping video banner draws its rich body', () => {
    const section = createSection('banner', {
      media: 'video',
      poster: 'poster',
      heading: 'Inside the workshop',
      body: richDocFromPlainText('A minute from first sketch to final stitch.'),
    })
    const html = render(<SectionsRenderer sections={[section]} env={env()} />)
    expect(html).toContain('A minute from first sketch to final stitch.')
  })

  test('a banner slide crops its own photo', () => {
    const section = createSection('banner-slider', {
      slides: [{ image: 's1', fit: 'contain', position: 'bottom' }],
    })
    const html = render(<SectionsRenderer sections={[section]} env={env()} />)
    expect(html).toContain('object-fit:contain')
    expect(html).toContain('object-position:bottom')
  })

  test('the slider offers whole and fractional slides per view, on both screens', () => {
    const fields = sectionSchema('banner-slider')!.fields
    const values = (key: string) => {
      const field = fields.find((candidate) => candidate.key === key)
      return field?.kind === 'select' ? field.options.map((option) => option.value) : []
    }
    // The banner tops out at three across, on both screens.
    expect(values('perPage')).toEqual([...BANNER_SLIDES_PER_VIEW])
    expect(values('perPageMobile')).toEqual([...SLIDES_PER_VIEW_MOBILE])
    expect(BANNER_SLIDES_PER_VIEW).not.toContain('4')
    // A fraction is a real choice on both screens, not just an option label.
    const section = createSection('banner-slider', { perPage: '2.5', perPageMobile: '1.5' })
    expect(section.settings.perPage).toBe('2.5')
    expect(section.settings.perPageMobile).toBe('1.5')
  })

  test('the slider band holds one height however many slides show', () => {
    const slider = (perPage: string) =>
      render(
        <SectionsRenderer
          sections={[
            createSection('banner-slider', {
              perPage,
              ratio: '2/1',
              slides: [{ image: 's1' }, { image: 's2' }, { image: 's3' }],
            }),
          ]}
          env={env()}
        />,
      )
    for (const perPage of ['1', '1.5', '2', '2.5', '3']) {
      const html = slider(perPage)
      // One band, shaped once: the height is drawn as the band's own padding,
      // and the per-view choice only changes the slides inside it — never the
      // height the page around it sees. Padding is what makes the shape stick
      // where a plain `aspect-ratio` would let the photos stretch the band.
      const bands = html.match(/padding-bottom:50%/g) ?? []
      expect(bands.length, `perPage ${perPage}`).toBe(1)
      expect(html, `perPage ${perPage}`).not.toMatch(/aspect-ratio:\d/)
      // The final slider is what the server sends — never a placeholder that
      // a slow connection later swaps out.
      expect(html, `perPage ${perPage}`).toContain('data-slider-track')
      expect(html, `perPage ${perPage}`).toContain('data-slider-slide')
      expect(html, `perPage ${perPage}`).not.toContain('aria-busy')
    }
  })

  test('the band can wear a wider shape', () => {
    const shape = sectionSchema('banner-slider')!.fields.find((field) => field.key === 'ratio')
    expect(shape?.kind === 'select' && shape.options.map((option) => option.value)).toEqual([
      '16/9',
      '2/1',
      '21/9',
      '3/1',
      '1/1',
    ])

    const band = (ratio: string) =>
      render(
        <SectionsRenderer
          sections={[
            createSection('banner-slider', {
              ratio,
              slides: [{ image: 's1' }, { image: 's2' }],
            }),
          ]}
          env={env()}
        />,
      )
    // Ultra wide: the same width, a shorter band. The band's height is its
    // own padding — the one form of ratio a taller photo cannot stretch.
    expect(band('21/9')).toMatch(/padding-bottom:42\.85/)
    // Panoramic: shorter still.
    expect(band('3/1')).toMatch(/padding-bottom:33\.33/)
  })

  test('the slider track shifts instead of scrolling', () => {
    const slides = ['a', 'b', 'c'].map((id) => <Box key={id} bg="bg.subtle" h="full" />)
    const track = (perPage: number) =>
      render(
        <RenderProvider value={env()}>
          <Slider count={3} perPage={perPage} ratio={2} loop dots="inside">
            {slides}
          </Slider>
        </RenderProvider>,
      )
    // Nothing inside the band is a scroll container: it cannot be wheeled,
    // dragged or scrolled, and no scrollbar can appear inside it.
    const one = track(1)
    expect(one).not.toMatch(/overflow-(x|y)?:?(auto|scroll)/)
    // A loop doubles the track by a page at each end, so the first slide sits
    // one page in — the step past an end has somewhere to glide to.
    expect(one).toContain(sliderTransform(1, 1))
    // One page of doubles: one slide before the first, one after the last.
    expect((one.match(/inert=""/g) ?? []).length).toBe(2)
    // A finger still slides it: horizontal touches are ours, vertical pans
    // stay with the page.
    expect(one).toContain('touch-action:pan-y')
    // One slide per view: a step is the slide's own width plus the gap.
    expect(one).toContain('flex:0 0 calc((100% - 12px * 0) / 1)')
    // A dot per resting position — the last page still shows a full view.
    expect((one.match(/aria-label="Slide [0-9]"/g) ?? []).length).toBe(3)
    expect(one).toContain('aria-label="Previous slide"')
    expect(one).toContain('aria-label="Next slide"')
    // Two per view: two positions, and each slide is half the band.
    const two = track(2)
    expect(two).toContain('flex:0 0 calc((100% - 12px * 1) / 2)')
    expect((two.match(/aria-label="Slide [0-9]"/g) ?? []).length).toBe(2)
    // Two doubles at each end, and the track one page into them.
    expect((two.match(/inert=""/g) ?? []).length).toBe(4)
    expect(two).toContain(sliderTransform(2, 2))
    // A step carries the gap with it — a slide plus one gap — and a finger's
    // drag rides on top of the position until it settles.
    expect(sliderTransform(0, 1)).toBe('translateX(0)')
    expect(sliderTransform(1, 1)).toBe(
      'translateX(calc(-1 * calc((100% - 12px * 0) / 1 + 12px) + 0px))',
    )
    expect(sliderTransform(1, 2)).toBe(
      'translateX(calc(-1 * calc((100% - 12px * 1) / 2 + 12px) + 0px))',
    )
    expect(sliderTransform(2, 2)).toBe(
      'translateX(calc(-2 * calc((100% - 12px * 1) / 2 + 12px) + 0px))',
    )
    // Mid-drag: the position plus the finger's own offset.
    expect(sliderTransform(1, 1, -60)).toBe(
      'translateX(calc(-1 * calc((100% - 12px * 0) / 1 + 12px) + -60px))',
    )
  })

  test('the dots ride in the band, with the active one a pill', () => {
    const html = render(
      <RenderProvider value={env()}>
        <Slider count={3} perPage={1} ratio={2} loop dots="inside">
          <Box bg="bg.subtle" h="full" />
          <Box bg="bg.subtle" h="full" />
          <Box bg="bg.subtle" h="full" />
        </Slider>
      </RenderProvider>,
    )
    // Inside the band, centred on its bottom edge — not a row below it.
    expect(html).toContain('bottom:var(--chakra-spacing-3)')
    expect(html).toContain('inset-inline:0')
    expect(html).toContain('justify-content:center')
    // The resting page is a wider pill; the others keep the smaller width
    // (one rule, shared by every inactive dot).
    expect(html).toContain('width:var(--chakra-sizes-6)')
    expect(html).toContain('width:var(--chakra-sizes-2\\.5)')
  })

  test('only the banner wears dots; the other sliders page by their arrows', () => {
    const reels = render(
      <SectionsRenderer
        sections={[
          createSection('video-reels', {
            items: Array.from({ length: 8 }, (_, index) => ({ poster: `p${index}` })),
          }),
        ]}
        env={env()}
      />,
    )
    // No dots at the foot of the row. The pair of arrows is the whole
    // indicator the shopper gets, the way the product row's slider works.
    expect(reels).not.toContain('aria-label="Slide')
    expect(reels).toContain('aria-label="Previous slide"')
    expect(reels).toContain('aria-label="Next slide"')
    // And the pair straddles the band's edge — half over the slides, half
    // over the page margin — instead of sitting inside the last slide.
    expect(reels).toMatch(/left:calc\(var\(--chakra-spacing-5\) \* -1\)/)
    expect(reels).toMatch(/right:calc\(var\(--chakra-spacing-5\) \* -1\)/)
  })

  test('a single-slide slider is the same band', () => {
    const html = render(
      <SectionsRenderer
        sections={[
          createSection('banner-slider', {
            ratio: '2/1',
            slides: [{ image: 's1', alt: 'One' }],
          }),
        ]}
        env={env()}
      />,
    )
    // The band decides the height, not the photo: one padded box, no ratio
    // left for the image to stretch.
    expect((html.match(/padding-bottom:50%/g) ?? []).length).toBe(1)
    expect(html).not.toMatch(/aspect-ratio:\d/)
    expect(html).toContain('object-fit:cover')
    // A lone banner is still a picture, not a carousel: no track to page, and
    // no indicator to page with.
    expect(html).not.toContain('data-slider-track')
    expect(html).not.toContain('aria-label="Slide 1"')
    expect(html).not.toContain('aria-label="Next slide"')
  })

  test('the consolidated banner offers and applies image size and position', () => {
    const keys = sectionSchema('banner')!.fields.map((field) => field.key)
    expect(keys).toContain('fit')
    expect(keys).toContain('position')

    const section = createSection('banner', {
      media: 'image',
      image: 'photo',
      fit: 'contain',
      position: 'top',
    })
    const html = render(<SectionsRenderer sections={[section]} env={env()} />)
    expect(html).toContain('object-fit:contain')
    expect(html).toContain('object-position:top')
  })

  test('the consolidated statement crops its photo, contained layout included', () => {
    const section = createSection('statement', {
      layout: 'contained',
      image: 'photo',
      fit: 'contain',
      position: 'bottom',
    })
    const html = render(<SectionsRenderer sections={[section]} env={env()} />)
    expect(html).toContain('object-fit:contain')
    expect(html).toContain('object-position:bottom')
  })

  test('a consolidated banner hands its crop to the divider mirror', () => {
    const section = createSection('banner', {
      media: 'image',
      image: 'photo',
      fit: 'contain',
      position: 'top',
    })
    expect(sectionBackground(section)).toMatchObject({ fit: 'contain', position: 'top' })
  })

  test('Text position puts the banner copy where it says', () => {
    const at = (contentPosition: string) => {
      const section = createSection('banner', {
        heading: 'Hi',
        image: 'photo',
        contentPosition,
      })
      return render(<SectionsRenderer sections={[section]} env={env()} />)
    }
    const ruleOf = (html: string) => {
      const tag = /<div[^>]*data-banner-copy[^>]*>/.exec(html)?.[0] ?? ''
      const cls = /class="([^"]+)"/.exec(tag)?.[1]?.split(' ')[0]
      return cls
        ? (new RegExp(`\\.${cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\{[^}]*\\}`).exec(
            html,
          )?.[0] ?? '')
        : ''
    }
    // The copy's own row is where the choice lands: top, middle, bottom.
    // Chakra writes the logical values (`start`/`end`), not `flex-start`.
    expect(ruleOf(at('top'))).toContain('align-items:start')
    expect(ruleOf(at('middle'))).toContain('align-items:center')
    expect(ruleOf(at('bottom'))).toContain('align-items:end')
  })

  test('every photo carries its own size and position: gallery, people, quotes, media cards', () => {
    const cropped = (html: string, label: string) => {
      expect(html, label).toContain('object-fit:contain')
      expect(html, label).toContain('object-position:top')
    }

    for (const layout of ['grid', 'masonry', 'social']) {
      cropped(
        render(
          <SectionsRenderer
            sections={[
              createSection('gallery', {
                layout,
                items: [{ image: 'p1', caption: 'C', alt: 'A', fit: 'contain', position: 'top' }],
              }),
            ]}
            env={env()}
          />,
        ),
        `gallery ${layout}`,
      )
    }

    cropped(
      render(
        <SectionsRenderer
          sections={[
            createSection('cards', {
              card: 'person',
              items: [{ photo: 'p1', name: 'A', fit: 'contain', position: 'top' }],
            }),
          ]}
          env={env()}
        />,
      ),
      'people',
    )

    cropped(
      render(
        <SectionsRenderer
          sections={[
            createSection('quotes', {
              variant: 'quotes',
              items: [{ quote: 'Q', author: 'A', avatar: 'p1', fit: 'contain', position: 'top' }],
            }),
          ]}
          env={env()}
        />,
      ),
      'quotes',
    )

    cropped(
      render(
        <SectionsRenderer
          sections={[
            createSection('story', {
              style: 'chapters',
              items: [{ image: 'p1', heading: 'H', body: '', fit: 'contain', position: 'top' }],
            }),
          ]}
          env={env()}
        />,
      ),
      'story',
    )

    cropped(
      render(
        <SectionsRenderer
          sections={[
            createSection('blocks', {
              blocks: [
                {
                  id: 'mc',
                  type: 'media-card',
                  settings: { image: 'p1', fit: 'contain', position: 'top' },
                },
              ],
            }),
          ]}
          env={env()}
        />,
      ),
      'media card',
    )
  })

  test('a testimonial photo is a plain visible image, never a hidden avatar', () => {
    const section = createSection('quotes', {
      variant: 'quotes',
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

describe('a floating section takes no space in the page', () => {
  const contact = (style: Record<string, unknown> = {}) =>
    createSection(
      'floating-contact',
      { whatsapp: '08123456789', email: 'hi@shop.test', showTop: true },
      style,
    )

  /** The opening tag of the element carrying a section's anchor id. */
  function wrapperTag(html: string, sectionId: string): string {
    const at = html.indexOf(`id="${sectionAnchorId(sectionId)}"`)
    expect(at, sectionId).toBeGreaterThan(-1)
    const start = html.lastIndexOf('<', at)
    return html.slice(start, html.indexOf('>', at) + 1)
  }

  function classNames(tag: string): string[] {
    const match = tag.match(/class="([^"]*)"/)
    return match?.[1] ? match[1].split(/\s+/).filter(Boolean) : []
  }

  /** Every declaration block for a class, so its responsive rules are seen too. */
  function classRules(html: string, className: string): string {
    const out: string[] = []
    const needle = `.${className}{`
    let at = html.indexOf(needle)
    while (at >= 0) {
      const start = at + needle.length
      out.push(html.slice(start, html.indexOf('}', start)))
      at = html.indexOf(needle, start)
    }
    return out.join(' ')
  }

  function stylesOf(html: string, tag: string): string {
    return classNames(tag)
      .map((className) => classRules(html, className))
      .join(' ')
  }

  test('the page edges look past it to the sections that paint space', () => {
    const band = createSection('rich-text', { heading: 'Band' }, { width: 'edge' })
    const edges = { flushTop: true, flushBottom: true, bannerFirst: true }
    expect(pageEdges([contact(), band])).toEqual(edges)
    expect(pageEdges([band, contact()])).toEqual(edges)
  })

  test('the sections around it keep exactly one gap', () => {
    const first = createSection('rich-text', { heading: 'First' }, { width: 'edge' })
    const second = createSection('rich-text', { heading: 'Second' }, { width: 'edge' })
    const withFloat = render(<SectionsRenderer sections={[first, contact(), second]} env={env()} />)
    const without = render(<SectionsRenderer sections={[first, second]} env={env()} />)
    // Full-bleed bands touch across a floating section instead of opening a
    // page gap before and after it: each wrapper is drawn as without it.
    expect(wrapperTag(withFloat, first.id)).toBe(wrapperTag(without, first.id))
    expect(wrapperTag(withFloat, second.id)).toBe(wrapperTag(without, second.id))
    expect(stylesOf(withFloat, wrapperTag(withFloat, second.id))).toContain('margin-top:0')
  })

  test('its frame takes no padding and paints no divider, whatever the style asks', () => {
    const dressed = contact({
      colorScheme: 'subtle',
      dividerTop: 'wave',
      dividerBottom: 'wave',
      paddingTop: 'lg',
      paddingBottom: 'lg',
    })
    const html = render(<SectionsRenderer sections={[dressed]} env={env()} />)
    const wrapperAt = html.indexOf(`id="${sectionAnchorId(dressed.id)}"`)
    const frameAt = html.indexOf('<div', html.indexOf('>', wrapperAt) + 1)
    const frameTag = html.slice(frameAt, html.indexOf('>', frameAt) + 1)
    const rules = stylesOf(html, frameTag)
    expect(rules).toContain('padding-top:0')
    expect(rules).toContain('padding-bottom:0')
    expect(rules).not.toContain('padding-top:var')
    expect(rules).not.toContain('padding-bottom:var')
    expect(html).not.toContain('mask-image')
  })
})
