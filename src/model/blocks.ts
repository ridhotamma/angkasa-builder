/**
 * The block library: the pieces a Blocks section is made of.
 *
 * Everything is a block — a heading, a paragraph, a button, an image, a
 * vertical column, a two-column row, a spacer — and every block draws its
 * size, width, alignment and spacing from the shared scale in
 * `./element-style`. Columns hold blocks, so the tree nests; storage bounds
 * that nesting (`MAX_BLOCK_DEPTH`, `MAX_BLOCKS_PER_SECTION` in `./fields`).
 *
 * The helpers here walk and edit a stored tree, shared by the editor's panel
 * and the canvas selection so both always speak about the same block.
 */

import { BLOCK_STYLE_FIELDS } from './block-style'
import type { BlockSchema, BlockValue, BlocksField, Field, FieldValues, JsonValue } from './fields'
import { isRecord, newId } from './fields'
import {
  alignmentField,
  buttonHoverField,
  buttonPaddingField,
  buttonSizeField,
  buttonToneField,
  buttonVariantField,
  contentWidthField,
  headingSizeField,
  selfWidthField,
  spaceField,
  textSizeField,
} from './element-style'
import type { Localized } from './localized'
import type { SectionSchema } from './sections'

/* -------------------------------------------------------------------------- */
/* Block schemas                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Every block type, in picker order. Columns and rows reference this list for
 * their children, so the array is populated in place: the self-reference is
 * live by the time anything reads it.
 */
export const BLOCK_TYPES: BlockSchema[] = []

const nested = (
  key: string,
  label: Localized,
  max: number,
  defaultBlocks?: readonly string[],
): BlocksField => ({
  kind: 'blocks',
  key,
  label,
  max,
  blocks: BLOCK_TYPES,
  styleFields: BLOCK_STYLE_FIELDS,
  ...(defaultBlocks && { defaultBlocks }),
})

const heading: BlockSchema = {
  type: 'heading',
  name: { en: 'Heading', id: 'Judul' },
  description: {
    en: 'A title. Its level says what it means, its size how loud it is.',
    id: 'Sebuah judul. Tingkatnya menentukan makna, ukurannya seberapa menonjol.',
  },
  fields: [
    {
      kind: 'text',
      key: 'text',
      label: { en: 'Heading', id: 'Judul' },
      max: 160,
      default: 'A clear, confident heading',
    },
    {
      kind: 'select',
      key: 'level',
      label: { en: 'Heading level', id: 'Tingkat judul' },
      options: [
        { value: 'h1', label: { en: 'Main title', id: 'Judul utama' } },
        { value: 'h2', label: { en: 'Section title', id: 'Judul bagian' } },
        { value: 'h3', label: { en: 'Subtitle', id: 'Subjudul' } },
      ],
      default: 'h2',
    },
    headingSizeField(),
    alignmentField(),
    contentWidthField(),
  ],
}

const text: BlockSchema = {
  type: 'text',
  name: { en: 'Text', id: 'Teks' },
  description: {
    en: 'A paragraph. Blank lines make new paragraphs.',
    id: 'Sebuah paragraf. Baris kosong memisahkan paragraf.',
  },
  fields: [
    {
      kind: 'textarea',
      key: 'body',
      label: { en: 'Text', id: 'Teks' },
      max: 2000,
      rows: 5,
      default: '',
    },
    textSizeField(),
    alignmentField(),
    contentWidthField(),
  ],
}

const button: BlockSchema = {
  type: 'button',
  name: { en: 'Button', id: 'Tombol' },
  description: {
    en: 'A call to action, in the brand, accent, dark or light tone.',
    id: 'Ajakan bertindak dengan warna brand, aksen, gelap, atau terang.',
  },
  fields: [
    {
      kind: 'text',
      key: 'label',
      label: { en: 'Label', id: 'Label' },
      max: 60,
      default: 'Shop now',
    },
    { kind: 'link', key: 'link', label: { en: 'Link', id: 'Tautan' } },
    buttonSizeField(),
    buttonPaddingField(),
    selfWidthField(),
    alignmentField(),
    buttonVariantField(),
    buttonToneField(),
    buttonHoverField(),
  ],
}

const image: BlockSchema = {
  type: 'image',
  name: { en: 'Image', id: 'Gambar' },
  fields: [
    { kind: 'image', key: 'image', label: { en: 'Image', id: 'Gambar' } },
    {
      kind: 'text',
      key: 'alt',
      label: { en: 'Alt text', id: 'Teks alternatif' },
      max: 160,
      default: '',
    },
    {
      kind: 'select',
      key: 'ratio',
      label: { en: 'Aspect ratio', id: 'Rasio' },
      options: [
        { value: 'auto', label: { en: 'Natural', id: 'Asli' } },
        { value: 'square', label: { en: 'Square', id: 'Persegi' } },
        { value: '4/3', label: { en: 'Landscape 4:3', id: 'Lanskap 4:3' } },
        { value: '16/9', label: { en: 'Wide 16:9', id: 'Lebar 16:9' } },
        { value: '3/4', label: { en: 'Portrait 3:4', id: 'Potret 3:4' } },
      ],
      default: '4/3',
    },
    {
      kind: 'select',
      key: 'rounded',
      label: { en: 'Corners', id: 'Sudut' },
      options: [
        { value: 'none', label: { en: 'Square', id: 'Siku' } },
        { value: 'sm', label: { en: 'Small', id: 'Kecil' } },
        { value: 'md', label: { en: 'Medium', id: 'Sedang' } },
        { value: 'lg', label: { en: 'Large', id: 'Besar' } },
        { value: 'full', label: { en: 'Round', id: 'Bulat' } },
      ],
      default: 'md',
    },
    contentWidthField(),
    alignmentField(),
  ],
}

const spacer: BlockSchema = {
  type: 'spacer',
  name: { en: 'Spacer', id: 'Penyela' },
  description: {
    en: 'A deliberate gap on the spacing scale.',
    id: 'Jeda dengan skala jarak yang sama.',
  },
  fields: [spaceField('size', { en: 'Height', id: 'Tinggi' }, 'md')],
}

const column: BlockSchema = {
  type: 'column',
  name: { en: 'Column', id: 'Kolom' },
  description: {
    en: 'A vertical group of blocks with its own spacing.',
    id: 'Kelompok blok vertikal dengan jaraknya sendiri.',
  },
  fields: [
    nested('blocks', { en: 'Blocks', id: 'Blok' }, 30),
    spaceField('gap', { en: 'Spacing', id: 'Jarak' }, 'md'),
    spaceField('padding', { en: 'Vertical padding', id: 'Jarak dalam' }, 'none'),
    contentWidthField(),
    alignmentField(),
  ],
}

const columns: BlockSchema = {
  type: 'columns',
  name: { en: 'Two columns', id: 'Dua kolom' },
  description: {
    en: 'Two columns side by side, stacking on phones.',
    id: 'Dua kolom berdampingan, menumpuk di ponsel.',
  },
  fields: [
    {
      kind: 'select',
      key: 'layout',
      label: { en: 'Layout', id: 'Tata letak' },
      options: [
        { value: 'equal', label: { en: 'Equal halves', id: 'Dua bagian sama' } },
        { value: 'leftWide', label: { en: 'Wider left', id: 'Kiri lebih lebar' } },
        { value: 'rightWide', label: { en: 'Wider right', id: 'Kanan lebih lebar' } },
      ],
      default: 'equal',
    },
    spaceField('gap', { en: 'Gap', id: 'Jarak' }, 'lg'),
    {
      kind: 'select',
      key: 'align',
      label: { en: 'Vertical alignment', id: 'Perataan vertikal' },
      options: [
        { value: 'start', label: { en: 'Top', id: 'Atas' } },
        { value: 'center', label: { en: 'Middle', id: 'Tengah' } },
        { value: 'end', label: { en: 'Bottom', id: 'Bawah' } },
      ],
      default: 'start',
    },
    nested('left', { en: 'Left column', id: 'Kolom kiri' }, 20),
    nested('right', { en: 'Right column', id: 'Kolom kanan' }, 20),
  ],
}

const row: BlockSchema = {
  type: 'row',
  name: { en: 'Row', id: 'Baris' },
  description: {
    en: 'Blocks side by side, wrapping and stacking on phones.',
    id: 'Blok berdampingan, membungkus dan menumpuk di ponsel.',
  },
  fields: [
    nested('blocks', { en: 'Blocks', id: 'Blok' }, 30),
    spaceField('gap', { en: 'Gap', id: 'Jarak' }, 'md'),
    {
      kind: 'select',
      key: 'align',
      label: { en: 'Vertical alignment', id: 'Perataan vertikal' },
      options: [
        { value: 'start', label: { en: 'Top', id: 'Atas' } },
        { value: 'center', label: { en: 'Middle', id: 'Tengah' } },
        { value: 'end', label: { en: 'Bottom', id: 'Bawah' } },
        { value: 'stretch', label: { en: 'Stretch', id: 'Penuh' } },
      ],
      default: 'stretch',
    },
    {
      kind: 'select',
      key: 'justify',
      label: { en: 'Horizontal placement', id: 'Penempatan mendatar' },
      options: [
        { value: 'start', label: { en: 'Start', id: 'Awal' } },
        { value: 'center', label: { en: 'Centre', id: 'Tengah' } },
        { value: 'end', label: { en: 'End', id: 'Akhir' } },
        { value: 'between', label: { en: 'Space between', id: 'Renggang di antara' } },
        { value: 'around', label: { en: 'Space around', id: 'Renggang sekeliling' } },
        { value: 'evenly', label: { en: 'Space evenly', id: 'Renggang merata' } },
      ],
      default: 'start',
    },
    {
      kind: 'boolean',
      key: 'wrap',
      label: { en: 'Wrap onto the next line', id: 'Bungkus ke baris berikutnya' },
      default: true,
    },
    {
      kind: 'boolean',
      key: 'stackOnMobile',
      label: { en: 'Stack on phones', id: 'Menumpuk di ponsel' },
      default: true,
    },
    spaceField('padding', { en: 'Padding', id: 'Jarak dalam' }, 'none'),
  ],
}

const grid: BlockSchema = {
  type: 'grid',
  name: { en: 'Grid', id: 'Kisi' },
  description: {
    en: 'Blocks in a grid of equal columns, collapsing on phones.',
    id: 'Blok dalam kisi kolom sama lebar, menciut di ponsel.',
  },
  fields: [
    nested('blocks', { en: 'Blocks', id: 'Blok' }, 30),
    {
      kind: 'select',
      key: 'columns',
      label: { en: 'Columns on desktop', id: 'Kolom di desktop' },
      options: [1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: { en: String(n), id: String(n) } })),
      default: '2',
    },
    spaceField('gap', { en: 'Gap', id: 'Jarak' }, 'md'),
    {
      kind: 'select',
      key: 'align',
      label: { en: 'Vertical alignment', id: 'Perataan vertikal' },
      options: [
        { value: 'start', label: { en: 'Top', id: 'Atas' } },
        { value: 'center', label: { en: 'Middle', id: 'Tengah' } },
        { value: 'end', label: { en: 'Bottom', id: 'Bawah' } },
        { value: 'stretch', label: { en: 'Stretch', id: 'Penuh' } },
      ],
      default: 'stretch',
    },
    {
      kind: 'boolean',
      key: 'stackOnMobile',
      label: { en: 'One column on phones', id: 'Satu kolom di ponsel' },
      default: true,
    },
    spaceField('padding', { en: 'Padding', id: 'Jarak dalam' }, 'none'),
  ],
}

BLOCK_TYPES.push(heading, text, button, image, spacer, column, columns, row, grid)

export function blockSchema(type: string): BlockSchema | null {
  return BLOCK_TYPES.find((block) => block.type === type) ?? null
}

// `as const` keeps the section's type a literal, so the library's union of
// section types does not widen to `string` where this schema is registered.
export const blocksSectionSchema = {
  type: 'blocks',
  name: { en: 'Blocks', id: 'Blok' },
  description: {
    en: 'Headings, text, buttons, images and columns on one consistent scale. Click a block in the preview to style it.',
    id: 'Judul, teks, tombol, gambar, dan kolom dengan skala yang konsisten. Klik blok di pratinjau untuk mengaturnya.',
  },
  category: 'layout',
  icon: 'blocks',
  fields: [
    {
      kind: 'blocks',
      key: 'blocks',
      label: { en: 'Content', id: 'Konten' },
      max: 60,
      blocks: BLOCK_TYPES,
      defaultBlocks: ['heading', 'text', 'button'],
      styleFields: BLOCK_STYLE_FIELDS,
    },
    spaceField('gap', { en: 'Spacing between blocks', id: 'Jarak antar blok' }, 'md'),
  ],
} as const satisfies SectionSchema

/* -------------------------------------------------------------------------- */
/* Walking a stored tree                                                      */
/* -------------------------------------------------------------------------- */

export interface FoundBlock {
  block: BlockValue
  schema: BlockSchema
  /** The blocks field the block sits in. */
  field: BlocksField
  /** Where the block sits among its siblings. */
  index: number
  /** How many siblings the containing field holds. */
  count: number
}

function blockIn(field: BlocksField, raw: unknown, id: string): FoundBlock | null {
  if (!Array.isArray(raw)) return null
  const blocks = raw as unknown as BlockValue[]
  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index]!
    if (block.id !== id) continue
    const schema = field.blocks.find((candidate) => candidate.type === block.type)
    return schema ? { block, schema, field, index, count: blocks.length } : null
  }
  for (const block of blocks) {
    const schema = field.blocks.find((candidate) => candidate.type === block.type)
    if (!schema || !isRecord(block.settings)) continue
    const nested = findBlock(schema.fields, block.settings as FieldValues, id)
    if (nested) return nested
  }
  return null
}

/** The block with `id`, wherever it sits — a column's child included. */
export function findBlock(
  fields: readonly Field[],
  values: FieldValues,
  id: string,
): FoundBlock | null {
  for (const field of fields) {
    const raw = values[field.key]
    if (field.kind === 'blocks') {
      const found = blockIn(field, raw, id)
      if (found) return found
    }
    if (field.kind === 'list' && Array.isArray(raw)) {
      for (const item of raw as unknown as FieldValues[]) {
        const found = findBlock(field.fields, item, id)
        if (found) return found
      }
    }
  }
  return null
}

/**
 * `values` with the list holding block `id` rewritten. The callback receives
 * the sibling list, the block's index, its schema and the field it sits in.
 * Returns `null` when no such block exists.
 */
export function updateBlocksIn(
  fields: readonly Field[],
  values: FieldValues,
  id: string,
  change: (
    blocks: BlockValue[],
    index: number,
    schema: BlockSchema,
    field: BlocksField,
  ) => BlockValue[],
): FieldValues | null {
  for (const field of fields) {
    const raw = values[field.key]
    if (field.kind === 'blocks' && Array.isArray(raw)) {
      const blocks = raw as unknown as BlockValue[]
      const index = blocks.findIndex((block) => block.id === id)
      if (index >= 0) {
        const schema = field.blocks.find((candidate) => candidate.type === blocks[index]!.type)
        if (!schema) continue
        return {
          ...values,
          [field.key]: change(blocks, index, schema, field) as unknown as JsonValue,
        }
      }
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i]!
        const schema = field.blocks.find((candidate) => candidate.type === block.type)
        if (!schema || !isRecord(block.settings)) continue
        const nested = updateBlocksIn(schema.fields, block.settings as FieldValues, id, change)
        if (nested) {
          const next = [...blocks]
          next[i] = { ...block, settings: nested }
          return { ...values, [field.key]: next as unknown as JsonValue }
        }
      }
    }
    if (field.kind === 'list' && Array.isArray(raw)) {
      const items = raw as unknown as FieldValues[]
      for (let i = 0; i < items.length; i++) {
        const nested = updateBlocksIn(field.fields, items[i]!, id, change)
        if (nested) {
          const next = [...items]
          next[i] = nested
          return { ...values, [field.key]: next as unknown as JsonValue }
        }
      }
    }
  }
  return null
}

/** The block's own settings replaced. */
export function updateBlockSettings(
  fields: readonly Field[],
  values: FieldValues,
  id: string,
  settings: FieldValues,
): FieldValues | null {
  return updateBlocksIn(fields, values, id, (blocks, index) => {
    const next = [...blocks]
    next[index] = { ...blocks[index]!, settings }
    return next
  })
}

/**
 * The block's style overrides replaced — set to `undefined` to clear every
 * override, leaving the block exactly as its section draws it.
 */
export function updateBlockStyle(
  fields: readonly Field[],
  values: FieldValues,
  id: string,
  style: FieldValues | undefined,
): FieldValues | null {
  return updateBlocksIn(fields, values, id, (blocks, index) => {
    const next = [...blocks]
    const { style: _cleared, ...block } = next[index]!
    next[index] = style && Object.keys(style).length > 0 ? { ...block, style } : block
    return next
  })
}

/** The block removed, leaving its siblings; an empty field renders its empty state. */
export function removeBlock(
  fields: readonly Field[],
  values: FieldValues,
  id: string,
): FieldValues | null {
  return updateBlocksIn(fields, values, id, (blocks) => blocks.filter((block) => block.id !== id))
}

/** The block moved `by` places among its siblings; unchanged at the ends. */
export function moveBlock(
  fields: readonly Field[],
  values: FieldValues,
  id: string,
  by: number,
): FieldValues | null {
  return updateBlocksIn(fields, values, id, (blocks, index) => {
    const to = index + by
    if (to < 0 || to >= blocks.length) return blocks
    const next = [...blocks]
    const [block] = next.splice(index, 1)
    next.splice(to, 0, block!)
    return next
  })
}

/**
 * A deep copy of a block with fresh ids throughout — a duplicated column must
 * not share its children's ids with the original, or selecting one child
 * would edit the other.
 */
function cloneBlock(block: BlockValue, schema: BlockSchema): BlockValue {
  return {
    id: newId(),
    type: block.type,
    settings: cloneSettings(schema.fields, block.settings),
    ...(block.style && { style: { ...block.style } }),
  }
}

function cloneSettings(fields: readonly Field[], settings: FieldValues): FieldValues {
  const out = { ...settings }
  for (const field of fields) {
    const raw = out[field.key]
    if (field.kind === 'blocks' && Array.isArray(raw)) {
      out[field.key] = (raw as unknown as BlockValue[]).map((child) => {
        const schema = field.blocks.find((candidate) => candidate.type === child.type)
        return schema ? cloneBlock(child, schema) : child
      }) as unknown as JsonValue
    }
    if (field.kind === 'list' && Array.isArray(raw)) {
      out[field.key] = (raw as unknown as FieldValues[]).map((item) => ({
        ...cloneSettings(field.fields, item),
        id: newId(),
      })) as unknown as JsonValue
    }
  }
  return out
}

/** A copy of the block, right after it — `null` when the field is full. */
export function duplicateBlock(
  fields: readonly Field[],
  values: FieldValues,
  id: string,
): { values: FieldValues; copy: BlockValue } | null {
  const created: { copy: BlockValue | null } = { copy: null }
  const next = updateBlocksIn(fields, values, id, (blocks, index, schema, field) => {
    if (blocks.length >= field.max) return blocks
    const copy = cloneBlock(blocks[index]!, schema)
    created.copy = copy
    const out = [...blocks]
    out.splice(index + 1, 0, copy)
    return out
  })
  if (!next || !created.copy) return null
  return { values: next, copy: created.copy }
}
