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
    type: 'richtext',
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
    type: 'grid',
    settings: {
      columns: '2',
      widths: 'leftWide',
      gap: 'lg',
      align: 'center',
      blocks: [
        { id: 'left', type: 'heading', settings: { text: 'Left side' } },
        { id: 'right', type: 'richtext', settings: { body: 'Right side' } },
      ],
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
          type: 'grid',
          settings: {
            columns: '2',
            align: 'start',
            blocks: [
              {
                id: 'left',
                type: 'column',
                settings: {
                  blocks: [{ id: 'h', type: 'heading', settings: { text: 'Sticky side' } }],
                },
                style: { position: 'sticky' },
              },
              { id: 'r', type: 'richtext', settings: { body: 'Right side' } },
            ],
          },
        },
      ],
    })
    const out = render(<SectionsRenderer sections={[sticky]} env={env()} />)
    // Sticky without an offset would scroll away like any other block.
    expect(out).toMatch(/position:sticky;top:0/)
    expect(out).toContain('Sticky side')
  })

  test('a column carries its width and alignment into its blocks', () => {
    const column = createSection('blocks', {
      blocks: [
        {
          id: 'col',
          type: 'column',
          settings: {
            width: 'narrow',
            align: 'center',
            blocks: [
              { id: 'h', type: 'heading', settings: { text: 'Centred by the column' } },
              { id: 'right', type: 'heading', settings: { text: 'Own alignment', align: 'right' } },
            ],
          },
        },
      ],
    })
    const out = render(<SectionsRenderer sections={[column]} env={env()} />)
    expect(out).toContain('max-width:var(--chakra-sizes-2xl)')
    expect(out).toContain('margin-inline:auto')
    // The column's centre reaches a child that kept the default left, while a
    // child that chose its own alignment still wins.
    expect((out.match(/text-align:center/g) ?? []).length).toBeGreaterThanOrEqual(2)
    expect(out).toContain('text-align:right')

    // In the editor the outline is the block's box, so it has to shrink too.
    const preview = render(
      <SectionsRenderer
        sections={[column]}
        env={env({
          mode: 'preview',
          editing: { onSelectBlock: () => undefined, selectedBlockId: 'col' },
        })}
      />,
    )
    expect((preview.match(/max-width:var\(--chakra-sizes-2xl\)/g) ?? []).length).toBeGreaterThan(1)
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
          selectedBlockId: 'title',
        },
      })}
    />,
  )

  test('every block is clickable and named', () => {
    for (const id of ['title', 'body', 'cta', 'cols', 'left', 'right', 'gap']) {
      expect(html).toContain(`data-block-id="${id}"`)
    }
    expect(html).toContain('data-block-label')
    expect(html).toContain('>Rich text<')
  })

  test('block lists are marked as drop targets for the palette', () => {
    expect(html).toContain('data-block-list')
    expect(html).toContain('data-parent-id="cols"')
    expect(html).toContain('data-field-key="blocks"')
    // The top-level list names the section, not a block.
    expect(html).toContain('data-parent-id=""')
  })

  test('only the selected block becomes editable', () => {
    const editable = html.match(/contenteditable="plaintext-only"/gi) ?? []
    expect(editable).toHaveLength(1)
    // The editable field is the selected heading, not another block.
    expect(html).toContain('Made by hand')
  })

  test('a seller’s own block name labels the canvas, never the storefront', () => {
    const named = createSection('blocks', {
      blocks: [
        {
          id: 'named',
          type: 'grid',
          name: 'Highlighted cards',
          settings: {
            columns: '2',
            blocks: [{ id: 'inside', type: 'heading', settings: { text: 'Inside' } }],
          },
        },
      ],
    })
    const preview = render(
      <SectionsRenderer
        sections={[named]}
        env={env({ mode: 'preview', editing: { onSelectBlock: () => undefined } })}
      />,
    )
    expect(preview).toContain('Highlighted cards')
    const live = render(<SectionsRenderer sections={[named]} env={env()} />)
    expect(live).not.toContain('Highlighted cards')
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
                type: 'richtext',
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

describe('block text overrides', () => {
  test('a hover text colour reaches the rich text, not only the heading', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'lorem ipsum' }] }],
    }
    const html = render(
      <SectionsRenderer
        sections={[
          createSection('blocks', {
            blocks: [
              {
                id: 'r',
                type: 'richtext',
                settings: { body: doc },
                style: { hoverColor: 'custom', hoverColorCustom: '#ff0000' },
              },
            ],
          }),
        ]}
        env={env()}
      />,
    )
    // The hover colour is mirrored into the property the rich text reads, so the
    // words change too — not only the heading.
    expect(html).toMatch(/--pb-ink:\s*#ff0000/)
    expect(html).toContain('var(--pb-ink')
  })

  test("a block's Text colour override reaches a nested rich text", () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'lorem ipsum' }] }],
    }
    const html = render(
      <SectionsRenderer
        sections={[
          createSection('blocks', {
            blocks: [
              {
                id: 'g',
                type: 'grid',
                style: { color: 'custom', textColorCustom: '#ffffff' },
                settings: {
                  columns: '1',
                  blocks: [{ id: 'r', type: 'richtext', settings: { body: doc } }],
                },
              },
            ],
          }),
        ]}
        env={env()}
      />,
    )
    // The Grid's colour becomes `--pb-ink`, which the nested rich text reads —
    // a heading would inherit it directly, but a rich-text paragraph names its
    // own muted ink, so it needs the property.
    expect(html).toMatch(/--pb-ink:\s*#ffffff/)
    expect(html).toContain('var(--pb-ink')
  })
})
