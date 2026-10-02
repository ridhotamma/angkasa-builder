import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'

import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

import {
  createSection,
  DEFAULT_THEME_SETTINGS,
  duplicateSection,
  sanitizeSections,
  type SectionInstance,
} from '../src/index'
import {
  BUTTON_ELEMENT_DEFAULTS,
  readButtonElement,
  sanitizeElements,
} from '../src/model/element-style'
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
      <I18nProvider locale="en" resources={{}}>
        {node}
      </I18nProvider>
    </ChakraProvider>,
  )
}

function accentButton(): SectionInstance {
  return {
    ...createSection('image-with-text', {
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
  })

  test('sections keep them through sanitising and copying', () => {
    const [section] = sanitizeSections([
      {
        id: 'a',
        type: 'image-with-text',
        settings: { heading: 'Hi' },
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

  test('a section without overrides renders the plain theme button', () => {
    const html = render(
      <SectionsRenderer
        sections={[
          createSection('image-with-text', {
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
