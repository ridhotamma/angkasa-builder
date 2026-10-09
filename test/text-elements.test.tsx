import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'

import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

import {
  createSection,
  DEFAULT_THEME_SETTINGS,
  sanitizeSections,
  type SectionInstance,
} from '../src/index'
import {
  readTextElement,
  sanitizeElements,
  TEXT_ELEMENT_DEFAULTS,
  textElementKey,
  textElementStyle,
} from '../src/model/element-style'
import { sampleStorefrontData, SectionsRenderer, type RenderEnvironment } from '../src/render/index'

function env(overrides: Partial<RenderEnvironment> = {}): RenderEnvironment {
  return {
    data: sampleStorefrontData('Text Shop'),
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

const OVERRIDDEN: NonNullable<SectionInstance['elements']> = {
  'text.heading': {
    size: '5xl',
    color: 'custom',
    customColor: '#ff0000',
    weight: 'bold',
    lineHeight: 'tight',
  },
  'text.eyebrow': { transform: 'none', letterSpacing: 'normal' },
}

function editorial(elements?: SectionInstance['elements']): SectionInstance {
  const section = createSection('editorial-statement', {
    heading: 'Made slowly',
    eyebrow: 'Our promise',
    body: 'A note about how we work.',
    image: '',
    overlay: 'none',
  })
  return elements ? { ...section, elements } : section
}

describe('text element overrides, as stored', () => {
  test('a namespaced text key sanitises against the text fields, not the button ones', () => {
    const elements = sanitizeElements({
      'text.heading': { size: '5xl', color: 'brand-solid', lineHeight: 'tight', sneaky: 'x' },
      'text.untouched': { size: 'default', customColor: '' },
      button: { tone: 'accent' },
      'bad key!': { size: 'xl' },
    })
    expect(Object.keys(elements).sort()).toEqual(['button', 'text.heading'])
    expect(elements['text.heading']).toMatchObject({
      size: '5xl',
      color: 'brand-solid',
      lineHeight: 'tight',
      customColor: '',
    })
  })

  test('an unknown token is dropped and an untouched entry is not stored', () => {
    expect(sanitizeElements({ 'text.a': { size: 'gigantic' } })).toEqual({})
    expect(sanitizeElements(null)).toEqual({})
  })

  test('reads back over the defaults, with custom colour validation', () => {
    expect(readTextElement(undefined)).toEqual(TEXT_ELEMENT_DEFAULTS)
    expect(readTextElement({ size: '2xl', color: 'custom', customColor: '#FF0000' })).toEqual({
      ...TEXT_ELEMENT_DEFAULTS,
      size: '2xl',
      color: 'custom',
      customColor: '#ff0000',
    })
    expect(readTextElement({ color: 'custom', customColor: 'red' }).customColor).toBe('')
    expect(readTextElement({ size: 'gigantic' }).size).toBe('default')
  })

  test('resolves to style props and leaves defaults off', () => {
    expect(textElementStyle(TEXT_ELEMENT_DEFAULTS)).toEqual({})
    expect(
      textElementStyle(
        readTextElement({
          size: '2xl',
          color: 'fg-muted',
          weight: 'bold',
          lineHeight: 'relaxed',
          letterSpacing: 'wide',
          transform: 'uppercase',
          style: 'italic',
          decoration: 'underline',
          align: 'center',
        }),
      ),
    ).toEqual({
      fontSize: 'var(--chakra-font-sizes-2xl)',
      color: 'var(--chakra-colors-fg-muted)',
      fontWeight: '700',
      lineHeight: '1.7',
      letterSpacing: '0.025em',
      textTransform: 'uppercase',
      fontStyle: 'italic',
      textDecoration: 'underline',
      textAlign: 'center',
    })
  })

  test('text and button overrides coexist on one section', () => {
    const [section] = sanitizeSections([
      {
        id: 'a',
        type: 'editorial-statement',
        settings: { heading: 'Hi', eyebrow: 'Eyebrow', body: '' },
        elements: { 'text.heading': { size: '5xl' }, button: { tone: 'accent' } },
      },
    ])
    expect(section!.elements?.['text.heading']?.size).toBe('5xl')
    expect(section!.elements?.button?.tone).toBe('accent')
    expect(textElementKey('heading')).toBe('text.heading')
  })
})

describe('section-level text everywhere', () => {
  function imageText(elements?: SectionInstance['elements']): SectionInstance {
    const section = createSection('image-with-text', {
      heading: 'Judul bisa diatur',
      body: 'Paragraf isi yang bisa diatur.',
      buttonLabel: '',
      buttonLink: { kind: 'none' },
    })
    return elements ? { ...section, elements } : section
  }

  test('a heading override draws on the storefront', () => {
    const html = render(
      <SectionsRenderer
        sections={[
          imageText({ 'text.heading': { size: '2xl', color: 'custom', customColor: '#ff0000' } }),
        ]}
        env={env()}
      />,
    )
    expect(html).toContain('font-size:var(--chakra-font-sizes-2xl)')
    expect(html).toContain('color:#ff0000')
    expect(html).not.toContain('data-element-id')
  })

  test('a rich body override draws on the storefront', () => {
    const html = render(
      <SectionsRenderer
        sections={[
          imageText({
            'text.body': { color: 'custom', customColor: '#00aa00', lineHeight: 'relaxed' },
          }),
        ]}
        env={env()}
      />,
    )
    expect(html).toContain('color:#00aa00')
    expect(html).toContain('line-height:1.7')
  })

  test('heading and body are pickable in the preview, editable once picked', () => {
    const editing = { onEditText: () => undefined, onSelectElement: () => undefined }
    const idle = render(
      <SectionsRenderer sections={[imageText()]} env={env({ mode: 'preview', editing })} />,
    )
    expect(idle).toContain('data-element-id="text.heading"')
    expect(idle).toContain('data-element-id="text.body"')
    // Nothing types until the seller picks it.
    expect(idle.match(/contenteditable="plaintext-only"/gi) ?? []).toHaveLength(0)

    const picked = render(
      <SectionsRenderer
        sections={[imageText()]}
        env={env({ mode: 'preview', editing: { ...editing, selectedElementId: 'text.heading' } })}
      />,
    )
    expect(picked.match(/contenteditable="plaintext-only"/gi) ?? []).toHaveLength(1)
  })
})

describe('an overridden text element', () => {
  test('draws with its own font on the storefront, without editor affordances', () => {
    const html = render(<SectionsRenderer sections={[editorial(OVERRIDDEN)]} env={env()} />)
    expect(html).toContain('Made slowly')
    expect(html).toContain('font-size:var(--chakra-font-sizes-5xl)')
    expect(html).toContain('color:#ff0000')
    expect(html).toContain('font-weight:700')
    expect(html).toContain('line-height:1.1')
    // The heading keeps the theme's heading face, like `Heading` would.
    expect(html).toContain('font-family:var(--chakra-fonts-heading)')
    expect(html).not.toContain('data-element-id')
  })

  test('is selectable in the editor preview, and the selected one types in place', () => {
    const html = render(
      <SectionsRenderer
        sections={[editorial(OVERRIDDEN)]}
        env={env({
          mode: 'preview',
          editing: {
            onEditText: () => undefined,
            onSelectElement: () => undefined,
            selectedElementId: 'text.heading',
          },
        })}
      />,
    )
    for (const id of ['text.eyebrow', 'text.heading', 'text.body', 'button']) {
      expect(html).toContain(`data-element-id="${id}"`)
    }
    // Only the selected heading is editable; the panel follows the typing.
    const editable = html.match(/contenteditable="plaintext-only"/gi) ?? []
    expect(editable).toHaveLength(1)
    expect(html).toContain('Made slowly')
    // The overrides still apply inside the editor.
    expect(html).toContain('color:#ff0000')
  })

  test('a section without overrides draws the theme text', () => {
    const html = render(<SectionsRenderer sections={[editorial()]} env={env()} />)
    expect(html).toContain('Made slowly')
    expect(html).not.toContain('font-weight:700')
    expect(html).not.toContain('data-element-id')
  })
})
