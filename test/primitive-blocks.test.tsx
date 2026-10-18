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

const PRIMITIVES = [
  'richtext',
  'icon',
  'spacer',
  'video',
  'badge',
  'rating',
  'collapsible',
] as const

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
    id: 'sp',
    type: 'spacer',
    settings: {
      size: 'md',
      line: true,
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
      'spacer',
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

describe('the ready-made layouts', () => {
  test('the composed block layouts were removed; the primitives are the escape hatch', () => {
    expect(sectionSchema('blocks')!.presets ?? []).toEqual([])
  })
})

describe('the Custom section', () => {
  test('is withdrawn, and the Blocks composer covers it', () => {
    const custom = sectionSchema('custom')
    expect(custom).not.toBeNull()
    // Same fields, by identity: one composer, not a second engine.
    expect(custom!.fields).toBe(sectionSchema('blocks')!.fields)
    // Withdrawn from the picker; a stored `custom` section converges on `blocks`.
    expect(isSectionOffered(custom!, 'home')).toBe(false)
    expect(isSectionOffered(sectionSchema('blocks')!, 'home')).toBe(true)
  })

  test('builds and renders a primitive tree', () => {
    const built = createSection('blocks', {
      blocks: [{ id: 'h', type: 'heading', settings: { text: 'Kanvas kustom' } }],
    })
    expect(readBlocks(built.settings, 'blocks')[0]!.type).toBe('heading')
    const html = render(<SectionsRenderer sections={[built]} env={env()} />)
    expect(html).toContain('Kanvas kustom')
  })
})

describe('the new primitives, rendered', () => {
  const html = render(<SectionsRenderer sections={[section()]} env={env()} />)

  test('rich text, badge, icon, spacer and video all draw', () => {
    expect(html).toContain('Teks berformat panjang.')
    expect(html).toContain('Baru')
    expect(html).toContain('<svg')
    expect(html).toContain('max-width:var(--chakra-sizes-2xl)')
    expect(html).toContain('embed/-BpekQRliGE')
  })

  test('a full-bleed block escapes the page column', () => {
    const section = createSection('blocks', {
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
    const section = createSection('blocks', {
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
          type: 'richtext',
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
        { id: 'txt', type: 'richtext', settings: { body: '' } },
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

  test('an image block crops by its own size and position', () => {
    const section = createSection('blocks', {
      blocks: [
        {
          id: 'img',
          type: 'image',
          settings: { image: 'photo', ratio: '4/3', fit: 'contain', position: 'top' },
        },
      ],
    })
    const html = render(
      <SectionsRenderer
        sections={[section]}
        env={env({ imageUrl: () => 'https://cdn.test/photo.jpg' })}
      />,
    )
    expect(html).toContain('object-fit:contain')
    expect(html).toContain('object-position:top')
  })
})

describe('the rating and collapsible primitives', () => {
  test('a rating block draws its stars, score, count and caption', () => {
    const built = createSection('blocks', {
      blocks: [
        {
          id: 'rate',
          type: 'rating',
          settings: {
            score: 4.8,
            count: 126,
            label: 'From verified buyers',
            size: 'lg',
            tone: 'yellow',
            showScore: true,
            align: 'center',
            width: 'full',
          },
        },
      ],
    })
    const html = render(<SectionsRenderer sections={[built]} env={env()} />)
    expect(html).toContain('aria-label="4.8/5"')
    expect(html).toContain('var(--chakra-colors-yellow-solid)')
    expect(html).toContain('4.8')
    expect(html).toContain('126 reviews')
    expect(html).toContain('From verified buyers')
  })

  test('a zero review count leaves the count out', () => {
    const built = createSection('blocks', {
      blocks: [{ id: 'rate', type: 'rating', settings: { score: 5, count: 0 } }],
    })
    const html = render(<SectionsRenderer sections={[built]} env={env()} />)
    expect(html).toContain('5.0')
    expect(html).not.toContain('reviews')
  })

  test('a collapsible folds its answer and can start open', () => {
    const built = createSection('blocks', {
      blocks: [
        {
          id: 'q1',
          type: 'collapsible',
          settings: {
            heading: 'Berapa lama pengirimannya?',
            body: 'Diproses 1×24 jam, tiba 1–4 hari tergantung kota.',
            open: true,
          },
        },
      ],
    })
    const html = render(<SectionsRenderer sections={[built]} env={env()} />)
    expect(html).toContain('Berapa lama pengirimannya?')
    expect(html).toContain('Diproses 1×24 jam')
    expect(html).toContain('data-state="open"')
  })

  test('an empty collapsible shows its placeholder in the preview, and nothing live', () => {
    const built = createSection('blocks', {
      blocks: [{ id: 'q', type: 'collapsible', settings: {} }],
    })
    const live = render(<SectionsRenderer sections={[built]} env={env()} />)
    expect(live).not.toContain('Write a question')

    const preview = render(
      <SectionsRenderer
        sections={[built]}
        env={env({ mode: 'preview', editing: { onEditText: () => undefined } })}
      />,
    )
    expect(preview).toContain('Write a question and its answer')
  })
})
