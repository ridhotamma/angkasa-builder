import { describe, expect, test } from 'bun:test'

import {
  BLOCK_TYPES,
  blockSchema,
  duplicateBlock,
  findBlock,
  insertBlock,
  moveBlock,
  removeBlock,
  updateBlockSettings,
} from '../src/model/blocks'
import { buttonAppearance, contentLayout, readToken, selfLayout } from '../src/model/element-style'
import {
  createBlock,
  isFieldShown,
  MAX_BLOCKS_PER_SECTION,
  readBlocks,
  sanitizeValues,
} from '../src/model/fields'
import { createSection, DEFAULT_THEME_SETTINGS, sectionSchema } from '../src/index'

const MAX_BLOCKS = MAX_BLOCKS_PER_SECTION

function blocksField() {
  const schema = sectionSchema('blocks')
  if (!schema) throw new Error('the blocks section is not registered')
  const field = schema.fields.find((candidate) => candidate.key === 'blocks')
  if (!field || field.kind !== 'blocks') throw new Error('the blocks field is missing')
  return { schema, field }
}

/** A tree `depth` blocks tall: each level is a grid around the next. */
function nest(depth: number, id: string): Record<string, unknown> {
  if (depth <= 1) return { id, type: 'richtext', settings: { body: `${id} leaf` } }
  return {
    id,
    type: 'grid',
    settings: {
      columns: '2',
      widths: 'equal',
      gap: 'md',
      align: 'start',
      blocks: [nest(depth - 1, `${id}-inner`)],
    },
  }
}

/** Every block anywhere in a sanitised section's settings. */
function countBlocks(values: Record<string, unknown>): number {
  let total = 0
  const visit = (settings: Record<string, unknown>) => {
    for (const key of ['blocks', 'left', 'right']) {
      const list = settings[key]
      if (!Array.isArray(list)) continue
      for (const block of list as Array<{ settings?: Record<string, unknown> }>) {
        total += 1
        visit(block.settings ?? {})
      }
    }
  }
  visit(values)
  return total
}

describe('blocks section schema', () => {
  test('is registered with a layout category and starter blocks', () => {
    const schema = sectionSchema('blocks')
    expect(schema).not.toBeNull()
    expect(schema!.category).toBe('layout')
    const section = createSection('blocks')
    const blocks = readBlocks(section.settings, 'blocks')
    expect(blocks.map((block) => block.type)).toEqual(['heading', 'richtext', 'button'])
  })

  test('every block type has a schema with fields', () => {
    // Custom blocks register after the built-ins, so the built-ins keep their
    // picker order and the tail is whatever the app added.
    expect(BLOCK_TYPES.map((block) => block.type).slice(0, 9)).toEqual([
      'heading',
      'richtext',
      'button',
      'image',
      'spacer',
      'column',
      'row',
      'grid',
      'slider',
    ])
    for (const block of BLOCK_TYPES) {
      expect(blockSchema(block.type)).toBe(block)
    }
  })

  test('the merged-away types are no longer offered', () => {
    // The picker has one block for each of those jobs now, and a stored block
    // of a removed type is dropped rather than converged.
    expect(blockSchema('text')).toBeNull()
    expect(blockSchema('divider')).toBeNull()
    expect(blockSchema('columns')).toBeNull()
  })

  test('a spacer only asks for its line’s thickness and colour with the line on', () => {
    const spacer = blockSchema('spacer')!
    for (const key of ['thickness', 'tone']) {
      const field = spacer.fields.find((candidate) => candidate.key === key)!
      expect(isFieldShown(field, { line: true }), key).toBe(true)
      expect(isFieldShown(field, { line: false }), key).toBe(false)
    }
  })
})

describe('block sanitising', () => {
  const { field } = blocksField()

  test('a nested tree round-trips with its ids and settings', () => {
    const tree = [nest(4, 'top')]
    const values = sanitizeValues([field], { blocks: tree })
    const blocks = readBlocks(values, 'blocks')
    expect(blocks).toHaveLength(1)
    expect(findBlock([field], values, 'top-inner-inner-inner')).not.toBeNull()
  })

  test('nesting deeper than the limit drops the extra level', () => {
    const values = sanitizeValues([field], { blocks: [nest(6, 'deep')] })
    expect(findBlock([field], values, 'deep-inner-inner-inner')).not.toBeNull()
    expect(findBlock([field], values, 'deep-inner-inner-inner-inner')).toBeNull()
  })

  test('unknown block types are dropped and unknown settings cleaned', () => {
    const values = sanitizeValues([field], {
      blocks: [
        { id: 'ok', type: 'spacer', settings: { size: 'lg', sneaky: 'nope' } },
        { id: 'bad', type: 'iframe', settings: {} },
      ],
    })
    const blocks = readBlocks(values, 'blocks')
    expect(blocks.map((block) => block.id)).toEqual(['ok'])
    expect(blocks[0]!.settings).toMatchObject({ size: 'lg' })
    expect(blocks[0]!.settings).not.toHaveProperty('sneaky')
  })
  test('the total block count stays inside the storage budget', () => {
    const wide = Array.from({ length: 60 }, (_, index) => ({
      id: `col-${index}`,
      type: 'grid',
      settings: {
        columns: '2',
        widths: 'equal',
        gap: 'md',
        align: 'start',
        blocks: Array.from({ length: 20 }, (_, child) => ({
          id: `col-${index}-${child}`,
          type: 'richtext',
          settings: { body: 'x' },
        })),
      },
    }))
    const values = sanitizeValues([field], { blocks: wide })
    expect(countBlocks(values)).toBeLessThanOrEqual(MAX_BLOCKS)
  })

  test('each field still honours its own maximum', () => {
    const values = sanitizeValues([field], {
      blocks: Array.from({ length: 80 }, (_, index) => ({
        id: `b-${index}`,
        type: 'richtext',
        settings: { body: 'x' },
      })),
    })
    expect(readBlocks(values, 'blocks')).toHaveLength(60)
  })
})

function sampleValues() {
  const { field } = blocksField()
  return sanitizeValues([field], {
    blocks: [
      { id: 'a', type: 'heading', settings: { text: 'A' } },
      {
        id: 'two',
        type: 'grid',
        settings: {
          columns: '2',
          widths: 'equal',
          blocks: [
            { id: 'b', type: 'heading', settings: { text: 'B' } },
            { id: 'c', type: 'heading', settings: { text: 'C' } },
          ],
        },
      },
      { id: 'd', type: 'spacer', settings: { size: 'lg' } },
    ],
  })
}

describe('block tree helpers', () => {
  test('finds a nested block with its position', () => {
    const { field } = blocksField()
    const found = findBlock([field], sampleValues(), 'c')
    expect(found?.block.type).toBe('heading')
    expect(found?.index).toBe(1)
    expect(found?.count).toBe(2)
    expect(found?.field.key).toBe('blocks')
  })

  test('updates a nested block in place', () => {
    const { field } = blocksField()
    const next = updateBlockSettings([field], sampleValues(), 'b', { text: 'Updated' })
    expect(next).not.toBeNull()
    const found = findBlock([field], next!, 'b')
    expect(found?.block.settings.text).toBe('Updated')
  })

  test('moves a block among its siblings and stops at the ends', () => {
    const { field } = blocksField()
    const values = sampleValues()
    const moved = moveBlock([field], values, 'd', -1)
    const order = (candidate: typeof values) =>
      (candidate.blocks as Array<{ id: string }>).map((block) => block.id)
    expect(order(moved!)).toEqual(['a', 'd', 'two'])
    expect(order(moveBlock([field], values, 'a', -1)!)).toEqual(['a', 'two', 'd'])
    expect(order(moveBlock([field], values, 'd', 1)!)).toEqual(['a', 'two', 'd'])
  })

  test('duplicates a block beside itself with a fresh id', () => {
    const { field } = blocksField()
    const result = duplicateBlock([field], sampleValues(), 'a')
    expect(result).not.toBeNull()
    expect(result!.copy.id).not.toBe('a')
    const blocks = readBlocks(result!.values, 'blocks')
    expect(blocks.map((block) => block.id)).toEqual(['a', result!.copy.id, 'two', 'd'])
  })

  test('duplicating a layout block gives its children fresh ids too', () => {
    const { field } = blocksField()
    const values = sampleValues()
    const result = duplicateBlock([field], values, 'two')!
    const copyChildren = readBlocks(result.copy.settings, 'blocks')
    expect(copyChildren[0]!.id).not.toBe('b')
    expect(copyChildren[1]!.id).not.toBe('c')
    expect(findBlock([field], result.values, copyChildren[0]!.id)).not.toBeNull()
    expect(findBlock([field], result.values, 'b')?.block.settings.text).toBe('B')
  })

  test('ids are unique across branches, not just within one list', () => {
    const { field } = blocksField()
    const values = sanitizeValues([field], {
      blocks: [
        {
          id: 'row',
          type: 'grid',
          settings: {
            columns: '2',
            blocks: [
              { id: 'same', type: 'heading', settings: { text: 'L' } },
              { id: 'same', type: 'heading', settings: { text: 'R' } },
            ],
          },
        },
      ],
    })
    const row = findBlock([field], values, 'row')!
    const children = readBlocks(row.block.settings, 'blocks')
    expect(children[0]!.id).not.toBe(children[1]!.id)
  })

  test('removes a block, nested ones included', () => {
    const { field } = blocksField()
    const next = removeBlock([field], sampleValues(), 'c')
    expect(findBlock([field], next!, 'c')).toBeNull()
    const two = findBlock([field], next!, 'two')
    expect(readBlocks(two!.block.settings, 'blocks')).toHaveLength(1)
  })
})

describe('inserting a dragged block', () => {
  const { field } = blocksField()
  const raw = (id: string) => ({ id, type: 'heading', settings: {} })

  test('inserts at a top-level index', () => {
    const values = sanitizeValues([field], { blocks: [raw('a'), raw('b')] })
    const block = createBlock(field, 'spacer')!
    const next = insertBlock([field], values, { parentId: null, fieldKey: 'blocks' }, 1, block)!
    expect(readBlocks(next, 'blocks').map((candidate) => candidate.id)).toEqual([
      'a',
      block.id,
      'b',
    ])
  })

  test('inserts into a nested container, addressed by its id', () => {
    const values = sampleValues()
    const block = createBlock(field, 'spacer')!
    const next = insertBlock([field], values, { parentId: 'two', fieldKey: 'blocks' }, 0, block)!
    const two = findBlock([field], next, 'two')!
    expect(readBlocks(two.block.settings, 'blocks').map((candidate) => candidate.id)).toEqual([
      block.id,
      'b',
      'c',
    ])
  })

  test('a stale container or a full field changes nothing', () => {
    const values = sampleValues()
    const block = createBlock(field, 'spacer')!
    expect(
      insertBlock([field], values, { parentId: 'missing', fieldKey: 'blocks' }, 0, block),
    ).toBeNull()
    const full = sanitizeValues([field], {
      blocks: Array.from({ length: 60 }, (_, index) => raw(`b-${index}`)),
    })
    expect(insertBlock([field], full, { parentId: null, fieldKey: 'blocks' }, 0, block)).toBeNull()
  })
})

describe('the shared element scale', () => {
  test('content layout caps the measure and places it by alignment', () => {
    expect(contentLayout('full', 'left')).toMatchObject({ textAlign: 'left' })
    expect(contentLayout('narrow', 'center')).toMatchObject({ maxW: '2xl', mx: 'auto' })
    expect(contentLayout('medium', 'right')).toMatchObject({ maxW: '3xl', ml: 'auto' })
  })

  test('self layout stretches or fits, and justifies by alignment', () => {
    expect(selfLayout('full', 'center')).toEqual({ w: 'full', justify: 'center' })
    expect(selfLayout('auto', 'right')).toEqual({ justify: 'flex-end' })
  })

  test('button tones resolve to theme variables and readable contrast', () => {
    const brand = buttonAppearance('brand', 'solid', DEFAULT_THEME_SETTINGS)
    expect(brand.bg).toBe('var(--chakra-colors-brand-solid)')
    expect(brand.color).toBe('var(--chakra-colors-brand-contrast)')

    const accent = buttonAppearance('accent', 'solid', DEFAULT_THEME_SETTINGS)
    expect(accent.bg).toBe(DEFAULT_THEME_SETTINGS.colors.accent)

    const dark = buttonAppearance('dark', 'solid', DEFAULT_THEME_SETTINGS)
    expect(dark.bg).toMatch(/^#([0-9a-f]{6})$/i)

    const outline = buttonAppearance('brand', 'outline', DEFAULT_THEME_SETTINGS)
    expect(outline.bg).toBe('transparent')
    expect(outline.borderWidth).toBe('1px')
    expect(outline.hoverBg).toContain('color-mix')

    const ghost = buttonAppearance('accent', 'ghost', DEFAULT_THEME_SETTINGS)
    expect(ghost.borderColor).toBeUndefined()
    expect(ghost.color).toBe(DEFAULT_THEME_SETTINGS.colors.accent)
  })

  test('a stored token falls back when it is missing or unknown', () => {
    expect(readToken({ size: 'lg' }, 'size', ['sm', 'lg'], 'sm')).toBe('lg')
    expect(readToken({ size: 'huge' }, 'size', ['sm', 'lg'], 'sm')).toBe('sm')
    expect(readToken({}, 'size', ['sm', 'lg'], 'sm')).toBe('sm')
  })
})

describe('button block settings', () => {
  test('the button schema offers size, width, variant and tone', () => {
    const button = blockSchema('button')!
    const keys = button.fields.map((field) => field.key)
    for (const key of [
      'label',
      'link',
      'size',
      'padding',
      'width',
      'align',
      'variant',
      'tone',
      'hover',
    ]) {
      expect(keys).toContain(key)
    }
  })
})
