import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'

import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

import {
  createSection,
  DEFAULT_THEME_SETTINGS,
  effectCss,
  isFieldShown,
  readSectionStyle,
  resolveEntrance,
  SECTION_STYLE_FIELDS,
  type SectionInstance,
} from '../src/index'
import {
  sampleStorefrontData,
  SectionsRenderer,
  STICKY_BELOW_HEADER,
  Tilt,
  type RenderEnvironment,
} from '../src/render/index'
import { dividerContainerStyle, surfacePaint } from '../src/render/dividers'
import { railHeight, railSpeed, scrollRoomHeight } from '../src/render/motion-sections'

function env(overrides: Partial<RenderEnvironment> = {}): RenderEnvironment {
  return {
    data: sampleStorefrontData('Motion Shop'),
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
      <I18nProvider locale="en" resources={{}}>
        {node}
      </I18nProvider>
    </ChakraProvider>,
  )
}

function page(sections: SectionInstance[], environment = env()): string {
  return render(<SectionsRenderer sections={sections} env={environment} />)
}

describe('motion style options', () => {
  test('headline and stagger resolve, unknown values fall back safely', () => {
    const style = readSectionStyle({ headline: 'rise', stagger: true })
    expect(style.headline).toBe('rise')
    expect(style.stagger).toBe(true)

    const fallback = readSectionStyle({ headline: 'explode', stagger: 'yes' })
    expect(fallback.headline).toBe('none')
    expect(fallback.stagger).toBe(false)

    expect(readSectionStyle({}).headline).toBe('none')
    expect(readSectionStyle({}).stagger).toBe(false)
  })

  test('stagger marks the frame even when the theme has no motion', () => {
    const html = page(
      [createSection('rich-text', { heading: 'Hello', body: 'World' }, { stagger: true })],
      env({ settings: { ...DEFAULT_THEME_SETTINGS, animation: 'none' } }),
    )
    expect(html).toContain('data-stagger="true"')
    expect(html).toContain('Hello')
  })
})

describe('pinned-scroll section', () => {
  test('renders every panel heading for readers and no-JS', () => {
    const html = page([
      createSection('pinned-scroll', {
        heading: 'How it works',
        panels: [
          { heading: 'First', body: '', image: '', buttonLabel: '', tone: 'page' },
          { heading: 'Second', body: '', image: '', buttonLabel: '', tone: 'dark' },
        ],
      }),
    ])
    expect(html).toContain('How it works')
    expect(html).toContain('First')
    expect(html).toContain('Second')
  })

  test('pins the stage before the scroll track, so sticky has room to travel', () => {
    const html = page([
      createSection('pinned-scroll', {
        heading: '',
        panels: [{ heading: 'Only', body: '', image: '', buttonLabel: '', tone: 'page' }],
      }),
    ])
    const stage = html.indexOf('data-pinned="stage"')
    const track = html.indexOf('data-pinned="track"')
    expect(stage).toBeGreaterThan(-1)
    expect(track).toBeGreaterThan(stage)
  })
})

describe('scroll-rail section', () => {
  test('renders every card title and text as a native strip', () => {
    const html = page([
      createSection('scroll-rail', {
        heading: 'The collection',
        items: [
          { title: 'Card one', text: 'First card', image: '' },
          { title: 'Card two', text: 'Second card', image: '' },
        ],
      }),
    ])
    expect(html).toContain('The collection')
    expect(html).toContain('Card one')
    expect(html).toContain('Second card')
  })

  test('drives whatever the seller composed from blocks, not only cards', () => {
    const html = page([
      createSection('scroll-rail', {
        heading: 'Any layout',
        content: 'blocks',
        blocks: [
          { type: 'heading', settings: { text: 'Stop one', level: 'h3' } },
          {
            type: 'column',
            settings: {
              blocks: [{ type: 'text', settings: { body: 'A column stop' } }],
            },
          },
          { type: 'image', settings: { alt: 'A photo stop' } },
        ],
        // Old cards ride along in storage but do not show in blocks mode.
        items: [{ title: 'Legacy card', text: '', image: '' }],
      }),
    ])
    expect(html).toContain('Any layout')
    expect(html).toContain('data-rail="track"')
    expect(html).toContain('Stop one')
    expect(html).toContain('A column stop')
    expect(html).not.toContain('Legacy card')
  })

  test('cards mode still draws the fixed cards, blocks and all kept in storage', () => {
    const html = page([
      createSection('scroll-rail', {
        heading: 'The collection',
        content: 'cards',
        items: [{ title: 'Default card', text: 'First card', image: '' }],
        blocks: [{ type: 'heading', settings: { text: 'Hidden block stop' } }],
      }),
    ])
    expect(html).toContain('Default card')
    expect(html).not.toContain('Hidden block stop')
  })

  test('a slower speed asks for a longer pin, and unknown values fall back', () => {
    expect(railSpeed({ speed: 'slow' })).toBeGreaterThan(railSpeed({ speed: 'normal' }))
    expect(railSpeed({ speed: 'normal' })).toBeGreaterThan(railSpeed({ speed: 'fast' }))
    expect(railSpeed({})).toBe(railSpeed({ speed: 'normal' }))
    expect(railSpeed({ speed: 'warp' })).toBe(railSpeed({ speed: 'normal' }))
  })

  test('the stage height follows the setting, falling back to full screen', () => {
    expect(railHeight({ height: 'md' })).toEqual({ css: '70svh', fraction: 0.7 })
    expect(railHeight({ height: 'lg' })).toEqual({ css: '85svh', fraction: 0.85 })
    expect(railHeight({})).toEqual({ css: '100svh', fraction: 1 })
    expect(railHeight({ height: 'giant' })).toEqual({ css: '100svh', fraction: 1 })
  })

  test('the cards/blocks switch picks which editor shows', () => {
    const blocks = { showWhen: { key: 'content', is: ['blocks'] } }
    const cards = { showWhen: { key: 'content', is: ['cards'] } }
    expect(isFieldShown(blocks, { content: 'blocks' })).toBe(true)
    expect(isFieldShown(blocks, { content: 'cards' })).toBe(false)
    expect(isFieldShown(cards, { content: 'cards' })).toBe(true)
    expect(isFieldShown(cards, { content: 'blocks' })).toBe(false)
    // String conditions elsewhere keep working as before.
    expect(isFieldShown({ showWhen: { key: 'layout', is: ['bento'] } }, { layout: 'bento' })).toBe(
      true,
    )
  })
})

describe('stacked-cards section', () => {
  test('renders every card with its step number', () => {
    const html = page([
      createSection('stacked-cards', {
        heading: 'Why us',
        items: [
          { title: 'First card', text: 'One', image: '' },
          { title: 'Second card', text: 'Two', image: '' },
        ],
      }),
    ])
    expect(html).toContain('Why us')
    expect(html).toContain('First card')
    expect(html).toContain('Second card')
    expect(html).toContain('01')
    expect(html).toContain('02')
  })

  test('a flat theme still paints an opaque card, so the pile hides its cards', () => {
    const html = page(
      [
        createSection('stacked-cards', {
          heading: 'Why us',
          items: [
            { title: 'First card', text: 'One', image: '' },
            { title: 'Second card', text: 'Two', image: '' },
          ],
        }),
      ],
      env({ settings: { ...DEFAULT_THEME_SETTINGS, cardStyle: 'flat' } }),
    )
    // Transparent cards would show every card's text through the next; the
    // surface is forced opaque and given an edge for the peeking strips.
    expect(html).toContain('--chakra-colors-bg-panel')
    expect(html).toContain('background:var(--chakra-colors-bg-panel)')
    expect(html).toContain('border-width:1px')
  })

  test('stacks whatever the seller composed from blocks, not only cards', () => {
    const html = page([
      createSection('stacked-cards', {
        heading: 'Any card',
        content: 'blocks',
        blocks: [
          { type: 'heading', settings: { text: 'Block card one' } },
          {
            type: 'column',
            settings: { blocks: [{ type: 'text', settings: { body: 'Block card two' } }] },
          },
        ],
        // Old cards ride along in storage but do not show in blocks mode.
        items: [{ title: 'Legacy card', text: '', image: '' }],
      }),
    ])
    expect(html).toContain('Any card')
    expect(html).toContain('Block card one')
    expect(html).toContain('Block card two')
    expect(html).not.toContain('Legacy card')
    expect(html.match(/data-stack-card/g) ?? []).toHaveLength(2)
  })

  test('every card sticks on the shared header line, a spacing step lower each', () => {
    // The same calculation as the store map, the product info and the story
    // picture — anchored to the header's real on-screen height — with each
    // card in the pile riding the theme's own spacing scale.
    const blocks = page([
      createSection('stacked-cards', {
        heading: 'Piled blocks',
        content: 'blocks',
        blocks: [
          { type: 'heading', settings: { text: 'Card one' } },
          { type: 'heading', settings: { text: 'Card two' } },
        ],
      }),
    ])
    expect(blocks).toContain(`top:calc(${STICKY_BELOW_HEADER})`)
    expect(blocks).toContain(`top:calc(${STICKY_BELOW_HEADER} + 1 * var(--chakra-spacing-7))`)

    const cards = page([
      createSection('stacked-cards', {
        heading: 'Piled cards',
        items: [
          { title: 'Card one', text: '', image: '' },
          { title: 'Card two', text: '', image: '' },
        ],
      }),
    ])
    expect(cards).toContain(`top:calc(${STICKY_BELOW_HEADER})`)
    expect(cards).toContain(`top:calc(${STICKY_BELOW_HEADER} + 1 * var(--chakra-spacing-7))`)
  })

  test('the sticky line leaves room for a floating header', () => {
    // A see-through header takes no room in the flow (`--store-header-height`
    // is zero), but it is fixed and turns solid over the page — so anything
    // sticking below it must key off its real height instead.
    expect(STICKY_BELOW_HEADER).toContain('--store-header-offset')
    expect(STICKY_BELOW_HEADER).not.toContain('--store-header-height')
  })
})

describe('scrolling-story section', () => {
  test('the picture sticks on the same header line as every other panel', () => {
    const html = page([
      createSection('scrolling-story', {
        heading: 'How it is made',
        steps: [{ image: '', heading: 'It starts with a sketch', body: '' }],
      }),
    ])
    expect(html).toContain('How it is made')
    expect(html).toContain('It starts with a sketch')
    expect(html).toContain(`top:${STICKY_BELOW_HEADER}`)
  })
})

describe('scrolling-text extras', () => {
  test('mixes image chips and product chips into the row', () => {
    const html = page([
      createSection('scrolling-text', {
        items: [
          { text: 'Free shipping', image: '', productId: '' },
          { text: '', image: '', productId: 'sample-0' },
        ],
      }),
    ])
    expect(html).toContain('Free shipping')
    // The sample catalogue's first product, resolved by id.
    expect(html).toContain('Signature tote')
  })
})

describe('effect stylesheet', () => {
  test('page transitions only ship with motion on', () => {
    expect(effectCss(DEFAULT_THEME_SETTINGS)).toBe('')
    const expressive = effectCss({ ...DEFAULT_THEME_SETTINGS, animation: 'expressive' })
    expect(expressive).toContain('@view-transition')
    expect(expressive).toContain('prefers-reduced-motion')
  })

  test('column CTAs draw no hover underline', () => {
    const html = page([
      createSection('multicolumn', {
        items: [
          {
            title: 'Tailoring',
            text: 'Made to measure',
            linkLabel: 'Shop tailoring',
            link: { kind: 'url', href: 'https://example.com/tailoring' },
          },
        ],
      }),
    ])
    expect(html).toContain('Shop tailoring')
    expect(html).not.toContain('data-sweep')
  })
})

describe('pointer primitives', () => {
  test('tilt renders statically without JavaScript', () => {
    const tilted = render(
      <Tilt>
        <span>Card</span>
      </Tilt>,
    )
    expect(tilted).toContain('Card')
    expect(tilted).not.toContain('rotateY')
  })
})

describe('style setting hierarchy', () => {
  test('gradient and pattern children only show under their surface', () => {
    const shown = (key: string, style: Record<string, string>) => {
      const field = SECTION_STYLE_FIELDS.find((candidate) => candidate.key === key)
      if (!field) throw new Error(`missing style field ${key}`)
      return isFieldShown(field, style)
    }
    // Solid/scheme: neither child does anything, so neither shows.
    expect(shown('backgroundGradient', { backgroundType: 'default' })).toBe(false)
    expect(shown('backgroundPattern', { backgroundType: 'default' })).toBe(false)
    // Each child shows only under its own surface.
    expect(shown('backgroundGradient', { backgroundType: 'gradient' })).toBe(true)
    expect(shown('backgroundPattern', { backgroundType: 'gradient' })).toBe(false)
    expect(shown('backgroundGradient', { backgroundType: 'pattern' })).toBe(false)
    expect(shown('backgroundPattern', { backgroundType: 'pattern' })).toBe(true)
  })
})

describe('surface paint', () => {
  test('mirrors the section background whatever kind it is', () => {
    // A scheme band: token background for the divider to wear.
    expect(surfacePaint(readSectionStyle({ colorScheme: 'brand' })).bg).toBe('bg')
    // No scheme: transparent, the page shows through.
    expect(surfacePaint(readSectionStyle({}))).toMatchObject({
      bg: undefined,
      backgroundImage: undefined,
      pattern: 'none',
      media: null,
    })
    // A gradient wash rides along as a background image.
    const gradient = surfacePaint(
      readSectionStyle({ backgroundType: 'gradient', backgroundGradient: 'sunset' }),
    )
    expect(gradient.bg).toBeUndefined()
    expect(gradient.backgroundImage).toContain('linear-gradient')
    // A pattern rides along as an overlay, never as the fill.
    const pattern = surfacePaint(
      readSectionStyle({ backgroundType: 'pattern', backgroundPattern: 'dots' }),
    )
    expect(pattern.pattern).toBe('dots')
    expect(pattern.backgroundImage).toBeUndefined()
  })
})

describe('motion entrances', () => {
  test('the theme applies until a section overrides it', () => {
    expect(resolveEntrance('none', readSectionStyle({}))).toBeNull()
    expect(resolveEntrance('subtle', readSectionStyle({}))?.key).toContain('subtle')
    expect(resolveEntrance('subtle', readSectionStyle({ motion: 'none' }))).toBeNull()
    expect(resolveEntrance('subtle', readSectionStyle({ motion: 'expressive' }))?.key).toContain(
      'expressive',
    )
  })

  test('tuning scales distance, duration and delay', () => {
    const base = resolveEntrance('none', readSectionStyle({ motion: 'slide-up' }))
    const tuned = resolveEntrance(
      'none',
      readSectionStyle({
        motion: 'slide-up',
        motionDistance: 'long',
        motionDuration: 'slow',
        motionDelay: 'medium',
      }),
    )
    expect(base?.y).toBe(48)
    expect(base?.duration).toBeCloseTo(0.7, 5)
    expect(base?.delay).toBe(0)
    expect(tuned!.y).toBeGreaterThan(base!.y)
    expect(tuned!.duration).toBeGreaterThan(base!.duration)
    expect(tuned!.delay).toBeGreaterThan(0)
  })

  test('staggering gives a section an entrance even with the theme off', () => {
    const entrance = resolveEntrance('none', readSectionStyle({ stagger: true }))
    expect(entrance?.stagger ?? 0).toBeGreaterThan(0)
  })

  test('unknown tuning values fall back safely', () => {
    const style = readSectionStyle({
      motionDuration: 'warp',
      motionDistance: 'far',
      motionDelay: 'later',
    })
    expect(style.motionDuration).toBe('normal')
    expect(style.motionDistance).toBe('medium')
    expect(style.motionDelay).toBe('none')
  })
})

describe('block motion', () => {
  test('a block entrance and parallax render their own wrappers', () => {
    const section = createSection('blocks', {
      blocks: [
        { id: 'plain', type: 'text', settings: { body: 'Plain block' } },
        {
          id: 'move',
          type: 'heading',
          settings: { text: 'Moving block' },
          style: { motion: 'slide-up' },
        },
        {
          id: 'drift',
          type: 'heading',
          settings: { text: 'Drifting block' },
          style: { parallax: 'strong' },
        },
      ],
    })
    const html = page([section])
    expect(html).toContain('data-block-motion="slide-up:normal:medium:none:plain"')
    // Only the block that asked for one carries each wrapper.
    expect(html.match(/data-block-motion=/g) ?? []).toHaveLength(1)
    expect(html.match(/data-parallax=""/g) ?? []).toHaveLength(1)
    expect(html).toContain('Plain block')
    expect(html).toContain('Moving block')
    expect(html).toContain('Drifting block')
  })
})

describe('pinned scroll length', () => {
  test('maps the setting to viewport heights, defaulting to comfortable', () => {
    expect(scrollRoomHeight('compact')).toBe('60svh')
    expect(scrollRoomHeight('comfortable')).toBe('80svh')
    expect(scrollRoomHeight('roomy')).toBe('110svh')
    expect(scrollRoomHeight('')).toBe('80svh')
    expect(scrollRoomHeight('warp-speed')).toBe('80svh')
  })
})

describe('section dividers', () => {
  test('top rises unflipped, bottom flips vertically into the next section', () => {
    // Paths are authored filled-below-a-shaped-top-edge: the top divider
    // wears them as drawn, the bottom one mirrored so its straight edge
    // stays flush with its own section.
    expect(dividerContainerStyle('top')).toMatchObject({ top: 0 })
    expect(String(dividerContainerStyle('top').transform)).not.toContain('scaleY')
    expect(dividerContainerStyle('bottom')).toMatchObject({ bottom: 0 })
    expect(String(dividerContainerStyle('bottom').transform)).toContain('scaleY(-1)')
  })
})

describe('split headings', () => {
  test('a rising heading keeps every word in the HTML, masked per word', () => {
    const html = page([
      createSection(
        'rich-text',
        { heading: 'Crafted in small batches', body: '' },
        { headline: 'rise' },
      ),
    ])
    // Words render in their own mask spans, so the sentence is not one
    // contiguous string — but no word may be lost for readers or no-JS.
    for (const word of ['Crafted', 'in', 'small', 'batches']) {
      expect(html).toContain(word)
    }
  })

  test('a static heading stays one plain string', () => {
    const html = page([
      createSection('rich-text', { heading: 'Crafted in small batches', body: '' }),
    ])
    expect(html).toContain('Crafted in small batches')
  })
})
