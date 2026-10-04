import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'

import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

import {
  blockSchema,
  createSection,
  DEFAULT_THEME_SETTINGS,
  isSectionOffered,
  readBlocks,
  sanitizeValues,
  sectionSchema,
} from '../src/index'
import { sampleStorefrontData, SectionsRenderer, type RenderEnvironment } from '../src/render/index'

const PRIMITIVES = ['richtext', 'icon', 'divider', 'video', 'badge'] as const

function blocksField() {
  const schema = sectionSchema('blocks')
  if (!schema) throw new Error('the blocks section is not registered')
  const field = schema.fields.find((candidate) => candidate.key === 'blocks')
  if (!field || field.kind !== 'blocks') throw new Error('the blocks field is missing')
  return field
}

const TREE = [
  {
    id: 'rt',
    type: 'richtext',
    settings: { body: 'Teks berformat panjang.', align: 'left', width: 'full' },
  },
  { id: 'ic', type: 'icon', settings: { icon: 'truck', size: 'lg', tone: 'brand', align: 'left' } },
  {
    id: 'dv',
    type: 'divider',
    settings: {
      spacing: 'md',
      thickness: 'thin',
      tone: 'border',
      width: 'narrow',
      align: 'center',
    },
  },
  {
    id: 'bd',
    type: 'badge',
    settings: { text: 'Baru', tone: 'subtle', size: 'sm', align: 'left' },
  },
  {
    id: 'vd',
    type: 'video',
    settings: {
      video: { source: 'youtube', id: '-BpekQRliGE' },
      ratio: '16/9',
      autoplay: false,
      width: 'full',
      align: 'left',
    },
  },
]

function section() {
  return createSection('blocks', { blocks: TREE })
}

function env(overrides: Partial<RenderEnvironment> = {}): RenderEnvironment {
  return {
    data: sampleStorefrontData('Primitive Shop'),
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

describe('the expanded primitive library', () => {
  test('every primitive is a registered block with fields', () => {
    for (const type of PRIMITIVES) {
      const schema = blockSchema(type)
      expect(schema, type).not.toBeNull()
      expect(schema!.fields.length, type).toBeGreaterThan(0)
    }
  })

  test('a tree of the new primitives sanitises and round-trips', () => {
    const fields = sectionSchema('blocks')!.fields
    const values = section().settings
    expect(readBlocks(values, 'blocks').map((block) => block.type)).toEqual([
      'richtext',
      'icon',
      'divider',
      'badge',
      'video',
    ])
    // Already sanitised: a second pass changes nothing.
    expect(sanitizeValues(fields, values)).toEqual(values)
  })

  test('unknown settings on a primitive are dropped', () => {
    const field = blocksField()
    const values = sanitizeValues([field], {
      blocks: [{ id: 'bd', type: 'badge', settings: { text: 'Hi', tone: 'neon', raw: 'x' } }],
    })
    const badge = readBlocks(values, 'blocks')[0]!
    expect(badge.settings).toEqual({ text: 'Hi', tone: 'brand', size: 'md', align: 'left' })
  })
})

describe('the ready-made primitive layouts', () => {
  const schema = sectionSchema('blocks')!
  const presets = schema.presets ?? []

  test('every preset builds a non-empty, already-sanitised tree', () => {
    const fields = sectionSchema('blocks')!.fields
    expect(presets.map((preset) => preset.key)).toEqual([
      'hero-split',
      'feature-grid',
      'pricing-3',
      'faq-list',
      'cta-band',
      'stats-row',
      'statement',
      'image-text',
      'cards-three',
      'photo-cards',
      'reviews-three',
    ])
    for (const preset of presets) {
      const built = createSection('blocks', preset.settings as never, preset.style as never)
      const blocks = readBlocks(built.settings, 'blocks')
      expect(blocks.length, preset.key).toBeGreaterThan(0)
      expect(sanitizeValues(fields, built.settings), preset.key).toEqual(built.settings)
    }
  })

  test('the call-to-action preset wears the brand band', () => {
    const preset = presets.find((candidate) => candidate.key === 'cta-band')!
    const built = createSection('blocks', preset.settings as never, preset.style as never)
    expect(built.style.colorScheme).toBe('brand')
  })

  test('a preset gives every block a fresh id, so two copies never collide', () => {
    const preset = presets[0]!
    const first = readBlocks(
      createSection('blocks', preset.settings as never, preset.style as never).settings,
      'blocks',
    )
    const second = readBlocks(
      createSection('blocks', preset.settings as never, preset.style as never).settings,
      'blocks',
    )
    const ids = [...first, ...second].map((block) => block.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('the Custom section', () => {
  test('is a thin alias of the Blocks section, offered on every page', () => {
    const schema = sectionSchema('custom')
    expect(schema).not.toBeNull()
    expect(isSectionOffered(schema!, 'home')).toBe(true)
    expect(isSectionOffered(schema!, 'page')).toBe(true)
    // Same fields, by identity: one composer, not a second engine.
    expect(schema!.fields).toBe(sectionSchema('blocks')!.fields)
  })

  test('builds and renders a primitive tree', () => {
    const built = createSection('custom', {
      blocks: [{ id: 'h', type: 'heading', settings: { text: 'Kanvas kustom' } }],
    })
    expect(readBlocks(built.settings, 'blocks')[0]!.type).toBe('heading')
    const html = render(<SectionsRenderer sections={[built]} env={env()} />)
    expect(html).toContain('Kanvas kustom')
  })
})

describe('the new primitives, rendered', () => {
  const html = render(<SectionsRenderer sections={[section()]} env={env()} />)

  test('rich text, badge, icon, divider and video all draw', () => {
    expect(html).toContain('Teks berformat panjang.')
    expect(html).toContain('Baru')
    expect(html).toContain('<svg')
    expect(html).toContain('max-width:var(--chakra-sizes-2xl)')
    expect(html).toContain('embed/-BpekQRliGE')
  })

  test('a full-bleed block escapes the page column', () => {
    const section = createSection('custom', {
      blocks: [
        {
          id: 'hero',
          type: 'heading',
          settings: { text: 'Lebar penuh' },
          style: { bleed: 'full' },
        },
      ],
    })
    const html = render(<SectionsRenderer sections={[section]} env={env()} />)
    expect(html).toContain('width:100cqw')
    expect(html).toMatch(/margin-inline:calc\(50% - 50cqw\)/)
    expect(html).toContain('max-width:none')
  })

  test('a full-width band keeps its content in the page column', () => {
    const section = createSection('custom', {
      blocks: [
        { id: 'hero', type: 'heading', settings: { text: 'Pita' }, style: { bleed: 'band' } },
      ],
    })
    const html = render(<SectionsRenderer sections={[section]} env={env()} />)
    expect(html).toContain('width:100cqw')
    // The inner Container is the page column, aligned with the header.
    expect(html).toContain('max-width:var(--chakra-sizes-6xl)')
  })

  test('a text override beats the block’s own size setting', () => {
    const styled = createSection('blocks', {
      blocks: [
        {
          id: 't',
          type: 'text',
          settings: { body: 'Gaya menang', size: 'sm' },
          style: { fontSize: '3xl', color: 'custom', textColorCustom: '#112233' },
        },
      ],
    })
    const styledHtml = render(<SectionsRenderer sections={[styled]} env={env()} />)
    expect(styledHtml).toContain('font-size:var(--chakra-font-sizes-3xl)')
    expect(styledHtml).toContain('color:#112233')
    expect(styledHtml).not.toContain('font-size:var(--chakra-font-sizes-sm)')
  })

  test('a video block with nothing picked draws nothing on the storefront', () => {
    const empty = createSection('blocks', { blocks: [{ id: 'vd', type: 'video', settings: {} }] })
    const emptyHtml = render(<SectionsRenderer sections={[empty]} env={env()} />)
    // Chakra's reset mentions `iframe`; no `<iframe>` element should exist.
    expect(emptyHtml).not.toContain('<iframe')
  })

  test('an empty block shows a placeholder in the preview, and nothing live', () => {
    const empty = createSection('blocks', {
      blocks: [
        { id: 'txt', type: 'text', settings: { body: '' } },
        { id: 'img', type: 'image', settings: {} },
        { id: 'btn', type: 'button', settings: { label: '' } },
        { id: 'rich', type: 'richtext', settings: { body: '' } },
        { id: 'vid', type: 'video', settings: {} },
        { id: 'bdg', type: 'badge', settings: { text: '' } },
        { id: 'col', type: 'column', settings: { blocks: [] } },
      ],
    })

    const live = render(<SectionsRenderer sections={[empty]} env={env()} />)
    for (const note of ['Upload your image', 'Write your text', 'Drag a block here']) {
      expect(live, note).not.toContain(note)
    }

    const preview = render(
      <SectionsRenderer
        sections={[empty]}
        env={env({ mode: 'preview', editing: { onEditText: () => undefined } })}
      />,
    )
    for (const note of [
      'Upload your image',
      'Write your text',
      'Set a button label',
      'Pick a video',
      'Write a badge label',
      'Drag a block here',
    ]) {
      expect(preview, note).toContain(note)
    }
  })

  test('every preset renders on the storefront', () => {
    for (const preset of sectionSchema('blocks')!.presets ?? []) {
      const built = createSection('blocks', preset.settings as never, preset.style as never)
      const presetHtml = render(<SectionsRenderer sections={[built]} env={env()} />)
      expect(presetHtml.length, preset.key).toBeGreaterThan(500)
    }
  })
})
