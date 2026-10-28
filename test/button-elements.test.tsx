import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'

import { LocaleProvider } from '../src/locale'
import { system } from '../src/ui'

import {
  createSection,
  DEFAULT_THEME_SETTINGS,
  duplicateSection,
  sanitizeSections,
  type SectionInstance,
} from '../src/index'
import {
  BUTTON_ELEMENT_DEFAULTS,
  buttonAppearance,
  readButtonElement,
  sanitizeElements,
} from '../src/model/element-style'
import { buttonHoverCss } from '../src/render/primitives'
import { sampleStorefrontData, SectionsRenderer, type RenderEnvironment } from '../src/render/index'

function env(overrides: Partial<RenderEnvironment> = {}): RenderEnvironment {
  return {
    data: sampleStorefrontData('Button Shop'),
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
      <LocaleProvider locale="en">
        {node}
      </LocaleProvider>
    </ChakraProvider>,
  )
}

function accentButton(): SectionInstance {
  return {
    ...createSection('statement', {
      layout: 'contained',
      heading: 'Restyle me',
      body: '',
      buttonLabel: 'Shop now',
      buttonLink: { kind: 'none' },
    }),
    elements: {
      button: {
        variant: 'solid',
        tone: 'accent',
        size: 'xl',
        padding: 'lg',
        width: 'full',
        align: 'center',
        hover: 'fill-up',
      },
    },
  }
}

describe('element overrides, as stored', () => {
  test('cleaned, keyed and sparse', () => {
    const elements = sanitizeElements({
      button: { variant: 'outline', tone: 'accent', size: 'huge', extra: 'x' },
      'panel.a.button': { size: 'xl' },
      'bad key!': { tone: 'accent' },
      untouched: { variant: 'default' },
    })
    expect(Object.keys(elements).sort()).toEqual(['button', 'panel.a.button'])
    expect(elements.button).toEqual({
      label: '',
      variant: 'outline',
      tone: 'accent',
      size: 'default',
      padding: 'default',
      width: 'default',
      align: 'default',
      hover: 'default',
    })
    expect(elements['panel.a.button']!.size).toBe('xl')
    expect(sanitizeElements(null)).toEqual({})
  })

  test('read back over the defaults', () => {
    expect(readButtonElement(undefined)).toEqual(BUTTON_ELEMENT_DEFAULTS)
    expect(readButtonElement({ size: 'xl' })).toEqual({ ...BUTTON_ELEMENT_DEFAULTS, size: 'xl' })
    expect(readButtonElement({ hover: 'fill-up' })).toEqual({
      ...BUTTON_ELEMENT_DEFAULTS,
      hover: 'fill-up',
    })
    expect(readButtonElement({ hover: 'wobble' })).toEqual(BUTTON_ELEMENT_DEFAULTS)
    expect(readButtonElement({ label: 'Beli sekarang' })).toEqual({
      ...BUTTON_ELEMENT_DEFAULTS,
      label: 'Beli sekarang',
    })
  })

  test('sections keep them through sanitising and copying', () => {
    const [section] = sanitizeSections([
      {
        id: 'a',
        type: 'statement',
        settings: { layout: 'contained', heading: 'Hi' },
        elements: { button: { tone: 'accent' }, empty: { variant: 'default' } },
      },
    ])
    expect(section!.elements?.button?.tone).toBe('accent')
    // An entry left at its defaults is not stored at all.
    expect(section!.elements?.empty).toBeUndefined()
    const copy = duplicateSection([section!], 'a')!
    expect(copy.copy.elements?.button?.tone).toBe('accent')
  })
})

describe('an overridden button', () => {
  test('draws with its own colours and hover on the storefront', () => {
    const html = render(<SectionsRenderer sections={[accentButton()]} env={env()} />)
    expect(html).toContain('Shop now')
    // The style rule, not the theme's token declaration of the same colour.
    expect(html).toContain('background:#ff3d8b')
    // The fill wipes up from the bottom, gated on reduced motion.
    expect(html).toContain('scaleY(0)')
    expect(html).toContain('transform-origin:bottom')
    expect(html).toContain('prefers-reduced-motion: no-preference')
    // No editor affordance on a live page.
    expect(html).not.toContain('data-element-id')
  })

  test('draws the panel label override instead of the section text', () => {
    const section: SectionInstance = {
      ...accentButton(),
      elements: { button: { label: 'Beli sekarang' } },
    }
    const html = render(<SectionsRenderer sections={[section]} env={env()} />)
    expect(html).toContain('Beli sekarang')
    expect(html).not.toContain('Shop now')
  })

  test('is selectable in the editor preview', () => {
    const html = render(
      <SectionsRenderer
        sections={[accentButton()]}
        env={env({
          mode: 'preview',
          editing: {
            onEditText: () => undefined,
            onSelectElement: () => undefined,
            selectedElementId: 'button',
          },
        })}
      />,
    )
    expect(html).toContain('data-element-id="button"')
  })

  test('the shine sweeps without recolouring the button', () => {
    const appearance = buttonAppearance('brand', 'solid', DEFAULT_THEME_SETTINGS)
    const mediaOf = (hover: 'shine' | 'fill-up') => {
      const css = buttonHoverCss(hover, appearance) as unknown as Record<string, unknown>
      return css['@media (prefers-reduced-motion: no-preference)'] as Record<string, unknown>
    }
    const shine = mediaOf('shine')
    expect(shine['&::before']).toBeDefined()
    // No hover rule touches the fill or the text: only the light moves.
    expect(shine['&:hover, &:focus-visible']).toBeUndefined()
    expect(JSON.stringify(shine)).not.toContain(appearance.sweepBg)
    // A fill, by contrast, flips the text to stay readable on the wipe.
    const fill = mediaOf('fill-up')
    expect(fill['&:hover, &:focus-visible']).toEqual({ color: appearance.sweepColor })
  })

  test('a section without overrides renders the plain theme button', () => {
    const html = render(
      <SectionsRenderer
        sections={[
          createSection('statement', {
            layout: 'contained',
            heading: 'Plain',
            body: '',
            buttonLabel: 'Shop now',
            buttonLink: { kind: 'none' },
          }),
        ]}
        env={env()}
      />,
    )
    expect(html).not.toContain('data-element-id')
    expect(html).not.toContain('background:#ff3d8b')
  })
})

describe('a custom button tone', () => {
  test('uses the seller fill and derives a readable label', () => {
    const dark = buttonAppearance('custom', 'solid', DEFAULT_THEME_SETTINGS, { fill: '#111111' })
    expect(dark.bg).toBe('#111111')
    expect(dark.color).toBe('#ffffff')

    const explicit = buttonAppearance('custom', 'solid', DEFAULT_THEME_SETTINGS, {
      fill: '#111111',
      text: '#ffd60a',
    })
    expect(explicit.color).toBe('#ffd60a')

    // Nothing set: the brand token keeps the button sensible rather than black.
    const fallback = buttonAppearance('custom', 'solid', DEFAULT_THEME_SETTINGS)
    expect(fallback.bg).toBe('var(--chakra-colors-brand-solid)')
    expect(fallback.color).toBe('var(--chakra-colors-brand-contrast)')
  })

  test('an outline custom button tints its border and label with the fill', () => {
    const outline = buttonAppearance('custom', 'outline', DEFAULT_THEME_SETTINGS, {
      fill: '#112233',
    })
    expect(outline.bg).toBe('transparent')
    expect(outline.color).toBe('#112233')
    expect(outline.borderColor).toBe('#112233')
  })
})
