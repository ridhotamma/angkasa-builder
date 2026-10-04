import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'

import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

import { createSection, DEFAULT_THEME_SETTINGS, type SectionInstance } from '../src/index'
import {
  drawnSections,
  pageEdges,
  sampleStorefrontData,
  SectionsRenderer,
  type RenderEnvironment,
} from '../src/render/index'

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

  test('a sticky column keeps its default offset on the storefront', () => {
    const sticky = createSection('blocks', {
      blocks: [
        {
          id: 'cols',
          type: 'columns',
          settings: {
            layout: 'equal',
            align: 'start',
            left: [
              {
                id: 'left',
                type: 'column',
                settings: {
                  blocks: [{ id: 'h', type: 'heading', settings: { text: 'Sticky side' } }],
                },
                style: { position: 'sticky' },
              },
            ],
            right: [{ id: 'r', type: 'text', settings: { body: 'Right side' } }],
          },
        },
      ],
    })
    const out = render(<SectionsRenderer sections={[sticky]} env={env()} />)
    // Sticky without an offset would scroll away like any other block.
    expect(out).toMatch(/position:sticky;top:0/)
    expect(out).toContain('Sticky side')
  })

  test('a button can use a custom colour', () => {
    const custom = createSection('blocks', {
      blocks: [
        {
          id: 'b',
          type: 'button',
          settings: {
            label: 'Custom',
            link: { kind: 'none' },
            tone: 'custom',
            toneColor: '#112233',
            toneTextColor: '#ffd60a',
          },
        },
      ],
    })
    const out = render(<SectionsRenderer sections={[custom]} env={env()} />)
    expect(out).toMatch(/background:\s*#112233/)
    expect(out).toMatch(/color:\s*#ffd60a/)
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

  test('block lists are marked as drop targets for the palette', () => {
    expect(html).toContain('data-block-list')
    expect(html).toContain('data-parent-id="cols"')
    expect(html).toContain('data-field-key="left"')
    // The top-level list names the section, not a block.
    expect(html).toContain('data-parent-id=""')
  })

  test('only the selected text block becomes editable', () => {
    const editable = html.match(/contenteditable="plaintext-only"/gi) ?? []
    expect(editable).toHaveLength(1)
    // The editable field is the selected paragraph, not the heading.
    expect(html).toContain('First line')
  })

  test('a columns side is a stretched stack, so a sticky column can travel', () => {
    const at = html.indexOf('data-field-key="left"')
    const element = html.slice(html.lastIndexOf('<', at), html.indexOf('>', at))
    const cls =
      element
        .match(/class="([^"]+)"/)?.[1]
        ?.split(/\s+/)
        .pop() ?? ''
    const rule = html.match(new RegExp(`\\.${cls}\\{([^}]*)\\}`))?.[1] ?? ''
    // The chosen alignment packs the side inside a full-height stack; a
    // content-height grid item would leave a sticky column no room to stick.
    expect(rule).toContain('flex-direction:column')
    expect(rule).toContain('justify-content:center')
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

describe('linked sections', () => {
  test('a linked copy draws the original’s content under its own id', () => {
    const master = createSection('rich-text', { heading: 'Original', body: 'Shared body' })
    const copy = { ...master, id: 'copy-1', linkedTo: master.id }
    const html = render(<SectionsRenderer sections={[master, copy]} env={env()} />)
    expect((html.match(/Shared body/g) ?? []).length).toBe(2)
  })

  test('drawnSections resolves links and pageEdges reads the original', () => {
    const master = createSection('rich-text', { heading: 'Original' }, { width: 'edge' })
    const copy = { ...master, id: 'copy-1', linkedTo: master.id }
    const drawn = drawnSections([copy], 'live', new Date())
    expect(drawn[0]!.style.width).toBe('edge')
    expect(pageEdges(drawn).flushTop).toBe(true)
    expect(pageEdges(drawn).bannerFirst).toBe(true)
  })

  test('a copy’s overrides render over the original’s content', () => {
    const master = createSection('rich-text', { heading: 'Original', body: 'Shared body' })
    const copy = {
      ...master,
      id: 'copy-2',
      linkedTo: master.id,
      overrides: { fields: { heading: 'My own' } },
    }
    const html = render(<SectionsRenderer sections={[master, copy]} env={env()} />)
    expect(html).toContain('Original')
    expect(html).toContain('My own')
    expect((html.match(/Shared body/g) ?? []).length).toBe(2)
  })
})

describe('the photo card block', () => {
  function card() {
    return createSection('blocks', {
      blocks: [
        {
          id: 'card',
          type: 'media-card',
          settings: {
            image: 'file-photo_1',
            alt: 'Es kopi susu',
            overlay: 'gradient',
            contentPosition: 'middle',
            height: 'lg',
            padding: 'lg',
            gap: 'sm',
            rounded: 'lg',
            blocks: [
              {
                id: 'h',
                type: 'heading',
                settings: {
                  text: 'Minuman Soda',
                  level: 'h3',
                  size: 'lg',
                  align: 'center',
                  width: 'full',
                },
              },
              {
                id: 't',
                type: 'text',
                settings: { body: 'Fizzy favourites', align: 'center', width: 'full' },
              },
            ],
          },
        },
      ],
    })
  }

  test('draws the photo as a full cover layer under the words', () => {
    const html = render(
      <SectionsRenderer
        sections={[card()]}
        env={env({ imageUrl: () => 'https://cdn.example/photo.jpg' })}
      />,
    )
    expect(html).toContain('https://cdn.example/photo.jpg')
    expect(html).toMatch(/object-fit:\s*cover/)
    expect(html).toContain('Minuman Soda')
    expect(html).toContain('Fizzy favourites')
    // The words sit on a shade and read light without being restyled.
    expect(html).toContain('--chakra-colors-fg:white')
    expect(html).toMatch(/color:\s*var\(--chakra-colors-fg\)/)
    expect(html).toMatch(/linear-gradient/)
  })

  test('an empty card shows a placeholder in the preview and nothing live', () => {
    const empty = createSection('blocks', {
      blocks: [{ id: 'mc', type: 'media-card', settings: {} }],
    })
    const live = render(<SectionsRenderer sections={[empty]} env={env()} />)
    expect(live).not.toContain('Upload your image')

    const preview = render(
      <SectionsRenderer
        sections={[empty]}
        env={env({ mode: 'preview', editing: { onEditText: () => undefined } })}
      />,
    )
    expect(preview).toContain('Upload your image')
  })
})
