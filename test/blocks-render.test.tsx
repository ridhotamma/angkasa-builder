import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'

import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

import { createSection, DEFAULT_THEME_SETTINGS, type SectionInstance } from '../src/index'
import { sampleStorefrontData, SectionsRenderer, type RenderEnvironment } from '../src/render/index'

const TREE = [
  {
    id: 'title',
    type: 'heading',
    settings: { text: 'Made by hand', level: 'h2', size: 'lg', align: 'center', width: 'narrow' },
  },
  {
    id: 'body',
    type: 'text',
    settings: { body: 'First line\n\nSecond line', size: 'md', align: 'left', width: 'medium' },
  },
  {
    id: 'cta',
    type: 'button',
    settings: {
      label: 'Shop now',
      link: { kind: 'url', href: 'https://example.com/shop' },
      size: 'lg',
      width: 'full',
      align: 'center',
      variant: 'outline',
      tone: 'accent',
    },
  },
  {
    id: 'plain',
    type: 'button',
    settings: { label: 'No link', link: { kind: 'none' }, variant: 'solid', tone: 'dark' },
  },
  {
    id: 'cols',
    type: 'columns',
    settings: {
      layout: 'leftWide',
      gap: 'lg',
      align: 'center',
      left: [{ id: 'left', type: 'heading', settings: { text: 'Left side' } }],
      right: [{ id: 'right', type: 'text', settings: { body: 'Right side' } }],
    },
  },
  { id: 'gap', type: 'spacer', settings: { size: 'xl' } },
]

function section(): SectionInstance {
  return createSection('blocks', { blocks: TREE, gap: 'lg' })
}

function env(overrides: Partial<RenderEnvironment> = {}): RenderEnvironment {
  return {
    data: sampleStorefrontData('Blocks Shop'),
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

describe('blocks section, on the storefront', () => {
  const html = render(<SectionsRenderer sections={[section()]} env={env()} />)

  test('draws every block as plain, final markup', () => {
    for (const text of [
      'Made by hand',
      'First line',
      'Second line',
      'Shop now',
      'No link',
      'Left side',
      'Right side',
    ]) {
      expect(html).toContain(text)
    }
  })

  test('a linked button is an anchor and a linkless one a button', () => {
    expect(html).toContain('href="https://example.com/shop"')
    expect(html).toContain('<button')
  })

  test('carries no editor affordances', () => {
    expect(html).not.toContain('data-block-id')
    expect(html).not.toContain('data-block-label')
    // Chakra's own reset mentions `[contenteditable]`; the editor's field is
    // the `plaintext-only` one.
    expect(/contenteditable="plaintext-only"/i.test(html)).toBe(false)
  })
})

describe('blocks section, in the editor preview', () => {
  const html = render(
    <SectionsRenderer
      sections={[section()]}
      env={env({
        mode: 'preview',
        editing: {
          onEditText: () => undefined,
          onEditBlockText: () => undefined,
          onSelectBlock: () => undefined,
          selectedBlockId: 'body',
        },
      })}
    />,
  )

  test('every block is clickable and named', () => {
    for (const id of ['title', 'body', 'cta', 'cols', 'left', 'right', 'gap']) {
      expect(html).toContain(`data-block-id="${id}"`)
    }
    expect(html).toContain('data-block-label')
    expect(html).toContain('>Text<')
  })

  test('only the selected text block becomes editable', () => {
    const editable = html.match(/contenteditable="plaintext-only"/gi) ?? []
    expect(editable).toHaveLength(1)
    // The editable field is the selected paragraph, not the heading.
    expect(html).toContain('First line')
  })
})

describe('blocks section, empty', () => {
  test('previews explain themselves and the storefront stays empty', () => {
    const empty = createSection('blocks', { blocks: [] })
    const live = render(<SectionsRenderer sections={[empty]} env={env()} />)
    expect(live).not.toContain('data-block-id')

    const preview = render(
      <SectionsRenderer
        sections={[empty]}
        env={env({ mode: 'preview', editing: { onEditText: () => undefined } })}
      />,
    )
    expect(preview).toContain('Add items in the section settings.')
  })
})
