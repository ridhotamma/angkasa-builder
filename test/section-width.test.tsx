import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'

import { LocaleProvider } from '../src/locale'
import { system } from '../src/ui'

import {
  createSection,
  DEFAULT_THEME_SETTINGS,
  readSectionStyle,
  type SectionInstance,
} from '../src/index'
import {
  RenderProvider,
  sampleStorefrontData,
  SectionsRenderer,
  StoreFooter,
  StoreHeader,
  type RenderEnvironment,
} from '../src/render/index'

/** The Chakra `Container maxW="6xl"` the banner copy lines up with. */
const PAGE_COLUMN = 'max-width:var(--chakra-sizes-6xl)'

function env(): RenderEnvironment {
  return {
    data: sampleStorefrontData('Aligned Shop'),
    settings: DEFAULT_THEME_SETTINGS,
    mode: 'live',
    imageUrl: () => null,
    formatPrice: (amount, currency) => `${amount} ${currency}`,
    now: new Date('2026-03-10T00:00:00.000Z'),
  }
}

function banner(style: Record<string, unknown>, settings: Record<string, unknown> = {}) {
  return createSection(
    'banner',
    {
      media: 'image',
      heading: 'Judul banner',
      subheading: 'Subjudul banner',
      buttonLabel: 'Belanja',
      ...settings,
    },
    style,
  )
}

function render(node: ReactNode): string {
  return renderToString(
    <ChakraProvider value={system}>
      <LocaleProvider locale="en">
        {node}
      </LocaleProvider>
    </ChakraProvider>,
  )
}

function htmlOf(section: SectionInstance): string {
  return render(<SectionsRenderer sections={[section]} env={env()} />)
}

describe('banner content follows the page column', () => {
  test('an edge-to-edge banner keeps its copy in the page column', () => {
    const html = htmlOf(banner({ width: 'edge' }))
    expect(html).toContain(PAGE_COLUMN)
    expect(html).toContain('Judul banner')
  })

  test('a centered edge banner still centers inside that column', () => {
    const html = htmlOf(banner({ width: 'edge' }, { align: 'center' }))
    expect(html).toContain(PAGE_COLUMN)
    expect(html).toContain('text-align:center')
  })

  test('a page-width banner keeps its own panel padding instead', () => {
    const html = htmlOf(banner({ width: 'contained' }))
    expect(html).not.toContain(PAGE_COLUMN)
    expect(html).toContain('Judul banner')
  })

  test('a full-width background frame supplies the column itself', () => {
    const html = htmlOf(banner({ width: 'full', colorScheme: 'inverse' }))
    expect(html).toContain(PAGE_COLUMN)
    expect(html).toContain('Judul banner')
  })

  test('the video and parallax banners share the alignment', () => {
    const parallax = createSection(
      'banner',
      { media: 'parallax', heading: 'Paralaks', image: '' },
      { width: 'edge' },
    )
    expect(htmlOf(parallax)).toContain(PAGE_COLUMN)
  })
})

describe('full-bleed sections keep their words in the page column', () => {
  test('split-screen aligns its copy while the photo still bleeds', () => {
    const html = htmlOf(
      createSection('statement', { layout: 'split', heading: 'Dua kolom', image: '' }),
    )
    expect(html).toContain(PAGE_COLUMN)
    expect(html).toContain('Dua kolom')
    // The photo half still runs to the viewport edge.
    expect(html).toContain('50cqw')
  })

  test('an editorial statement aligns its copy', () => {
    const html = htmlOf(
      createSection(
        'statement',
        { layout: 'full', heading: 'Pernyataan', image: '' },
        { width: 'edge' },
      ),
    )
    expect(html).toContain(PAGE_COLUMN)
    expect(html).toContain('Pernyataan')
  })

  test('a looping video aligns its copy when edge to edge', () => {
    const html = htmlOf(
      createSection(
        'banner',
        {
          media: 'video',
          heading: 'Video',
          video: { source: 'upload', id: 'clip' },
        },
        { width: 'edge' },
      ),
    )
    expect(html).toContain(PAGE_COLUMN)
    expect(html).toContain('Video')
  })

  test('an edge gallery keeps its heading in the column', () => {
    const wall = createSection(
      'gallery',
      { layout: 'social', heading: 'Komunitas', items: [{ image: 'x' }] },
      { width: 'edge' },
    )
    expect(htmlOf(wall)).toContain(PAGE_COLUMN)
  })

  test('a contained section adds no second column', () => {
    const html = htmlOf(
      createSection(
        'statement',
        { layout: 'full', heading: 'Biasa', image: '' },
        { width: 'contained' },
      ),
    )
    expect(html).not.toContain(PAGE_COLUMN)
  })
})

describe('slider arrows follow the section edge', () => {
  /** The banner slider, the first thing that met a full-bleed frame. */
  function band(style: Record<string, unknown>): string {
    return htmlOf(
      createSection(
        'banner-slider',
        { perPage: '2', slides: [{ image: 's1' }, { image: 's2' }] },
        style,
      ),
    )
  }

  test('an edge-to-edge band keeps its arrows inside the viewport', () => {
    const html = band({ width: 'edge' })
    // The usual pair hangs half outside the band; edge to edge there is no
    // page margin to hang in, so the viewport would saw it in half.
    expect(html).toContain('left:var(--chakra-spacing-4)')
    expect(html).toContain('right:var(--chakra-spacing-4)')
    expect(html).not.toMatch(/left:calc\(var\(--chakra-spacing-5\) \* -1\)/)
    expect(html).not.toMatch(/right:calc\(var\(--chakra-spacing-5\) \* -1\)/)
  })

  test('a contained band keeps the straddle it has margin for', () => {
    const html = band({ width: 'contained' })
    expect(html).toContain('left:calc(var(--chakra-spacing-5) * -1)')
    expect(html).toContain('right:calc(var(--chakra-spacing-5) * -1)')
  })

  test('a full-width band keeps it too — the frame gutter holds the pair', () => {
    const html = band({ width: 'full' })
    expect(html).toContain('left:calc(var(--chakra-spacing-5) * -1)')
    expect(html).toContain('right:calc(var(--chakra-spacing-5) * -1)')
  })

  test('every slider in an edge section gets the same inside pair', () => {
    const html = htmlOf(
      createSection(
        'video-reels',
        { items: Array.from({ length: 8 }, (_, index) => ({ poster: `p${index}` })) },
        { width: 'edge' },
      ),
    )
    expect(html).toContain('left:var(--chakra-spacing-4)')
    expect(html).not.toMatch(/left:calc\(var\(--chakra-spacing-5\) \* -1\)/)
  })
})

describe('per-section content width', () => {
  test('defaults to the page column, and an unknown value falls back to it', () => {
    expect(readSectionStyle({}).contentWidth).toBe('6xl')
    expect(readSectionStyle({ contentWidth: 'gigantic' }).contentWidth).toBe('6xl')
  })

  test('a contained section centres a narrower column', () => {
    const html = htmlOf(banner({ contentWidth: 'md' }))
    expect(html).toContain('max-width:var(--chakra-sizes-md)')
    expect(html).toContain('Judul banner')
  })

  test('a full-width band uses the chosen column', () => {
    const html = htmlOf(banner({ width: 'full', contentWidth: 'xl' }))
    expect(html).toContain('max-width:var(--chakra-sizes-xl)')
  })

  test('an edge banner uses the chosen column', () => {
    const html = htmlOf(banner({ width: 'edge', contentWidth: 'md' }))
    expect(html).toContain('max-width:var(--chakra-sizes-md)')
  })

  test('the header and footer honour their own content width', () => {
    const header = render(
      <RenderProvider value={env()}>
        <StoreHeader
          header={{ layout: 'classic', sticky: false, showSearch: false, contentWidth: 'xl' }}
          shop={{ name: 'Toko', logoUrl: null }}
          menu={[]}
          actions={null}
        />
      </RenderProvider>,
    )
    expect(header).toContain('max-width:var(--chakra-sizes-xl)')

    const footer = render(
      <RenderProvider value={env()}>
        <StoreFooter
          footer={{ colorScheme: 'default', contentWidth: 'md' }}
          shop={{ name: 'Toko', logoUrl: null }}
          menu={[]}
          pages={[]}
          labels={{ information: 'Info', followUs: 'Follow', links: 'Links', trackOrder: '' }}
        />
      </RenderProvider>,
    )
    expect(footer).toContain('max-width:var(--chakra-sizes-md)')
  })
})
