import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import { renderToString } from 'react-dom/server'
import type { ReactNode } from 'react'

import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

import { createSection, DEFAULT_THEME_SETTINGS, sectionSchema } from '../src/index'
import { sampleStorefrontData, SectionsRenderer, type RenderEnvironment } from '../src/render/index'
import { BENTO_COLUMNS, bentoPhoneColumns, bentoShape, gridColumns } from '../src/render/primitives'

const IMAGE = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"/>'

/** Every section a catalogue draws its products through. */
const PRODUCT_LISTS = ['product-list', 'related-products'] as const

function env(overrides: Partial<RenderEnvironment> = {}): RenderEnvironment {
  return {
    data: sampleStorefrontData('Layout shop'),
    settings: DEFAULT_THEME_SETTINGS,
    mode: 'live',
    imageUrl: () => IMAGE,
    formatPrice: (amount, currency) => `${amount} ${currency}`,
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

function renderLatest(settings: Record<string, unknown>): string {
  return render(
    <SectionsRenderer sections={[createSection('product-list', settings)]} env={env()} />,
  )
}

describe('product card hover image', () => {
  /** The catalogue's first card with a different second photo. */
  function withHover(overrides: Record<string, unknown> = {}): RenderEnvironment['data'] {
    const data = sampleStorefrontData('Hover shop')
    data.latest = data.latest.map((product, index) =>
      index === 0
        ? {
            ...product,
            imageUrl: 'https://images.test/primary.jpg',
            secondaryImageUrl: 'https://images.test/secondary.jpg',
            ...overrides,
          }
        : product,
    )
    return data
  }

  function card(layout = 'grid'): string {
    return render(
      <SectionsRenderer
        sections={[createSection('product-list', { source: 'latest', layout, limit: 2 })]}
        env={env({ data: withHover() })}
      />,
    )
  }

  test('the second photo stacks behind the first for the card hover', () => {
    const html = card()
    expect(html).toContain('https://images.test/primary.jpg')
    expect(html).toContain('https://images.test/secondary.jpg')
    expect(html).toContain('data-product-secondary=""')
    // The card is the hover group the hidden photo waits for.
    expect(html).toMatch(/class="[^"]*\bgroup\b[^"]*"/)
  })

  test('the bento tile wears the same hover photo', () => {
    const html = card('bento')
    expect(html).toContain('https://images.test/secondary.jpg')
    expect(html).toContain('data-product-secondary=""')
  })

  test('a card without a second photo draws no hover layer', () => {
    const data = sampleStorefrontData('Hover shop')
    const html = render(
      <SectionsRenderer
        sections={[createSection('product-list', { source: 'latest', limit: 1 })]}
        env={env({ data })}
      />,
    )
    expect(html).not.toContain('data-product-secondary')
  })

  test('legacy card data with imageUrls uses its second photo too', () => {
    const data = withHover({ secondaryImageUrl: undefined })
    data.latest[0] = {
      ...data.latest[0]!,
      imageUrls: ['https://images.test/primary.jpg', 'https://images.test/secondary.jpg'],
    }
    const html = render(
      <SectionsRenderer
        sections={[createSection('product-list', { source: 'latest', limit: 1 })]}
        env={env({ data })}
      />,
    )
    expect(html).toContain('https://images.test/secondary.jpg')
  })

  test('a repeated primary photo never becomes a hover layer', () => {
    const data = withHover({ secondaryImageUrl: 'https://images.test/primary.jpg' })
    const html = render(
      <SectionsRenderer
        sections={[createSection('product-list', { source: 'latest', limit: 1 })]}
        env={env({ data })}
      />,
    )
    expect(html).not.toContain('data-product-secondary')
  })

  test('the theme can keep the primary photo still', () => {
    const data = withHover()
    const html = render(
      <SectionsRenderer
        sections={[createSection('product-list', { source: 'latest', limit: 1 })]}
        env={env({
          data,
          settings: { ...DEFAULT_THEME_SETTINGS, productImageHover: false },
        })}
      />,
    )
    expect(html).toContain('https://images.test/primary.jpg')
    expect(html).not.toContain('https://images.test/secondary.jpg')
    expect(html).not.toContain('data-product-secondary')
  })
})

describe('product list layouts', () => {
  test('every product-list section offers the three layouts, grid by default', () => {
    for (const type of PRODUCT_LISTS) {
      const schema = sectionSchema(type)!
      const field = schema.fields.find((candidate) => candidate.key === 'layout')
      expect(field?.kind, type).toBe('select')
      if (field?.kind !== 'select') continue
      expect(
        field.options.map((option) => option.value),
        type,
      ).toEqual(['grid', 'slider', 'bento'])
      expect(field.default, type).toBe('grid')
    }
  })

  test('an unknown layout falls back to the grid', () => {
    const section = createSection('product-list', { source: 'latest', layout: 'carousel-ish' })
    expect(section.settings.layout).toBe('grid')
  })

  test('the default draws the grid', () => {
    const html = renderLatest({ heading: 'New in', limit: 4 })
    expect(html).toContain('data-product-layout="grid"')
    expect(html).not.toContain('data-product-layout="slider"')
    expect(html).not.toContain('data-product-layout="bento"')
  })

  test('the slider draws the shared track with arrows over its edges', () => {
    const html = renderLatest({ heading: 'New in', limit: 8, layout: 'slider' })
    expect(html).toContain('data-product-layout="slider"')
    // The row is shifted by a transform — never a scroll container — and the
    // arrows ride it. No dots at the foot: the banner is the one slider that
    // wears them.
    expect(html).toContain('data-slider-track=""')
    // No loop and no wrap: the row opens on its first card, with no doubles
    // of the last one riding ahead of it.
    expect(html).toContain('transform:translateX(0)')
    expect(html).not.toContain('inert=""')
    expect(html).toContain('aria-label="Previous slide"')
    expect(html).toContain('aria-label="Next slide"')
    expect(html).not.toContain('aria-label="Slide 2"')
    expect(html).not.toContain('data-product-layout="grid"')
  })

  test('a slider short enough for one page draws no arrows', () => {
    const html = renderLatest({ heading: 'New in', limit: 2, layout: 'slider' })
    expect(html).toContain('data-product-layout="slider"')
    expect(html).not.toContain('aria-label="Previous slide"')
    expect(html).not.toContain('aria-label="Slide 2"')
  })

  test('a fractional slides-per-view leaves the next card peeking', () => {
    // The consolidated type, whose schema carries the slider's own per-view:
    // the phone is set to one and a half cards, the third half in view.
    const html = render(
      <SectionsRenderer
        sections={[
          createSection('product-list', {
            source: 'latest',
            layout: 'slider',
            perPageMobile: '1.5',
            limit: 8,
          }),
        ]}
        env={env()}
      />,
    )
    expect(html).toContain('flex:0 0 calc((100% - 12px * 0.5) / 1.5)')
  })

  test('the arrows straddle the row edges, half over the page margin', () => {
    const html = renderLatest({ heading: 'New in', limit: 8, layout: 'slider' })
    // Half of the 40px arrow, so its centre sits on the first/last card's edge.
    expect(html).toMatch(/left:calc\(var\(--chakra-spacing-5\) \* -1\)/)
    expect(html).toMatch(/right:calc\(var\(--chakra-spacing-5\) \* -1\)/)
  })

  test('every card fills its slide, so no card shrinks to its own text', () => {
    const html = renderLatest({ heading: 'New in', limit: 8, layout: 'slider' })
    // The carousel item is a flex box; without a width the card sizes to its
    // title, so a short one draws a narrower card than its neighbours.
    const cardClass = /class="[^"]*chakra-card__root ([^"]+)"/.exec(html)?.[1]?.split(' ')[0]
    expect(typeof cardClass).toBe('string')
    expect(html).toMatch(new RegExp(`\\.${cardClass}\\{[^}]*width:var\\(--chakra-sizes-full\\)`))
  })

  test('the bento draws mixed tiles', () => {
    const html = renderLatest({ heading: 'New in', limit: 8, layout: 'bento' })
    expect(html).toContain('data-product-layout="bento"')
    expect(html).not.toContain('data-slider-track')
  })

  test('the phone column choice reaches the grid', () => {
    const one = renderLatest({ heading: 'New in', limit: 4, layout: 'grid', mobileColumns: '1' })
    expect(one).toMatch(/grid-template-columns:repeat\(1,/)
    const two = renderLatest({ heading: 'New in', limit: 4, layout: 'grid', mobileColumns: '2' })
    expect(two).toMatch(/grid-template-columns:repeat\(2,/)
    expect(two).not.toMatch(/grid-template-columns:repeat\(1, minmax\(0, 1fr\)\);/)
  })
})

describe('gridColumns', () => {
  test('the phone choice sets the base count', () => {
    expect(gridColumns('4', '1')).toEqual({ base: 1, md: 3, lg: 4 })
    expect(gridColumns('4', '2')).toEqual({ base: 2, md: 3, lg: 4 })
    // A host that does not know the setting keeps the old phone default.
    expect(gridColumns('4')).toEqual({ base: 2, md: 3, lg: 4 })
  })
})

describe('bento shapes', () => {
  test('repeats a big/small/small/wide group', () => {
    expect([0, 1, 2, 3].map((index) => bentoShape(index, 8))).toEqual([
      'big',
      'small',
      'small',
      'wide',
    ])
    expect(BENTO_COLUMNS.big).toBe(2)
    expect(BENTO_COLUMNS.full).toBe(4)
  })

  test('a short last group fills the row instead of leaving holes', () => {
    expect(bentoShape(0, 1)).toBe('full')
    expect(bentoShape(0, 2)).toBe('wide')
    expect(bentoShape(1, 2)).toBe('wide')
  })

  test('phones put two tiles in a full row', () => {
    expect(bentoPhoneColumns(0, 4)).toBe(2)
    expect(bentoPhoneColumns(1, 4)).toBe(1)
  })
})
