import { describe, expect, test } from 'bun:test'

import {
  BLOCK_TYPES,
  blockSchema,
  duplicateBlock,
  findBlock,
  moveBlock,
  removeBlock,
  updateBlockSettings,
} from '../src/model/blocks'
import { buttonAppearance, contentLayout, readToken, selfLayout } from '../src/model/element-style'
import { MAX_BLOCKS_PER_SECTION, readBlocks, sanitizeValues } from '../src/model/fields'
import { createSection, DEFAULT_THEME_SETTINGS, sectionSchema } from '../src/index'

const MAX_BLOCKS = MAX_BLOCKS_PER_SECTION

function blocksField() {
  const schema = sectionSchema('blocks')
  if (!schema) throw new Error('the blocks section is not registered')
  const field = schema.fields.find((candidate) => candidate.key === 'blocks')
  if (!field || field.kind !== 'blocks') throw new Error('the blocks field is missing')
  return { schema, field }
}

/** A tree `depth` blocks tall: each level is a two-column row around the next. */
function nest(depth: number, id: string): Record<string, unknown> {
  if (depth <= 1) return { id, type: 'text', settings: { body: `${id} leaf` } }
  return {
    id,
    type: 'columns',
    settings: {
      layout: 'equal',
      gap: 'md',
      align: 'start',
      left: [nest(depth - 1, `${id}-inner`)],
      right: [],
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
    expect(blocks.map((block) => block.type)).toEqual(['heading', 'text', 'button'])
  })

  test('every block type has a schema with fields', () => {
    // Custom blocks register after the built-ins, so the built-ins keep their
    // picker order and the tail is whatever the app added.
    expect(BLOCK_TYPES.map((block) => block.type).slice(0, 9)).toEqual([
      'heading',
      'text',
      'button',
      'image',
      'spacer',
      'column',
      'columns',
      'row',
      'grid',
    ])
    for (const block of BLOCK_TYPES) {
      expect(blockSchema(block.type)).toBe(block)
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

  test('unknown block types and unknown settings are dropped', () => {
    const values = sanitizeValues([field], {
      blocks: [
        { id: 'ok', type: 'spacer', settings: { size: 'lg', sneaky: 'nope' } },
        { id: 'bad', type: 'iframe', settings: {} },
      ],
    })
    const blocks = readBlocks(values, 'blocks')
    expect(blocks.map((block) => block.id)).toEqual(['ok'])
    expect(blocks[0]!.settings).toEqual({ size: 'lg' })
  })

  test('the total block count stays inside the storage budget', () => {
    const wide = Array.from({ length: 60 }, (_, index) => ({
      id: `col-${index}`,
      type: 'columns',
      settings: {
        layout: 'equal',
        gap: 'md',
        align: 'start',
        left: Array.from({ length: 20 }, (_, child) => ({
          id: `col-${index}-${child}`,
          type: 'text',
          settings: { body: 'x' },
        })),
        right: [],
      },
    }))
    const values = sanitizeValues([field], { blocks: wide })
    expect(countBlocks(values)).toBeLessThanOrEqual(MAX_BLOCKS)
  })

  test('each field still honours its own maximum', () => {
    const values = sanitizeValues([field], {
      blocks: Array.from({ length: 80 }, (_, index) => ({
        id: `b-${index}`,
        type: 'text',
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
        id: 'cols',
        type: 'columns',
        settings: {
          left: [{ id: 'b', type: 'text', settings: { body: 'B' } }],
          right: [{ id: 'c', type: 'text', settings: { body: 'C' } }],
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
    expect(found?.block.type).toBe('text')
    expect(found?.index).toBe(0)
    expect(found?.count).toBe(1)
    expect(found?.field.key).toBe('right')
  })

  test('updates a nested block in place', () => {
    const { field } = blocksField()
    const next = updateBlockSettings([field], sampleValues(), 'b', { body: 'Updated' })
    expect(next).not.toBeNull()
    const found = findBlock([field], next!, 'b')
    expect(found?.block.settings.body).toBe('Updated')
  })

  test('moves a block among its siblings and stops at the ends', () => {
    const { field } = blocksField()
    const values = sampleValues()
    const moved = moveBlock([field], values, 'd', -1)
    const order = (candidate: typeof values) =>
      (candidate.blocks as Array<{ id: string }>).map((block) => block.id)
    expect(order(moved!)).toEqual(['a', 'd', 'cols'])
    expect(order(moveBlock([field], values, 'a', -1)!)).toEqual(['a', 'cols', 'd'])
    expect(order(moveBlock([field], values, 'd', 1)!)).toEqual(['a', 'cols', 'd'])
  })

  test('duplicates a block beside itself with a fresh id', () => {
    const { field } = blocksField()
    const result = duplicateBlock([field], sampleValues(), 'a')
    expect(result).not.toBeNull()
    expect(result!.copy.id).not.toBe('a')
    const blocks = readBlocks(result!.values, 'blocks')
    expect(blocks.map((block) => block.id)).toEqual(['a', result!.copy.id, 'cols', 'd'])
  })

  test('duplicating a layout block gives its children fresh ids too', () => {
    const { field } = blocksField()
    const values = sampleValues()
    const result = duplicateBlock([field], values, 'cols')!
    const copyLeft = readBlocks(result.copy.settings, 'left')
    const copyRight = readBlocks(result.copy.settings, 'right')
    expect(copyLeft[0]!.id).not.toBe('b')
    expect(copyRight[0]!.id).not.toBe('c')
    expect(findBlock([field], result.values, copyLeft[0]!.id)).not.toBeNull()
    expect(findBlock([field], result.values, 'b')?.block.settings.body).toBe('B')
  })

  test('ids are unique across branches, not just within one list', () => {
    const { field } = blocksField()
    const values = sanitizeValues([field], {
      blocks: [
        {
          id: 'row',
          type: 'columns',
          settings: {
            left: [{ id: 'same', type: 'text', settings: { body: 'L' } }],
            right: [{ id: 'same', type: 'text', settings: { body: 'R' } }],
          },
        },
      ],
    })
    const row = findBlock([field], values, 'row')!
    const left = readBlocks(row.block.settings, 'left')[0]!
    const right = readBlocks(row.block.settings, 'right')[0]!
    expect(left.id).not.toBe(right.id)
  })

  test('removes a block, nested ones included', () => {
    const { field } = blocksField()
    const next = removeBlock([field], sampleValues(), 'c')
    expect(findBlock([field], next!, 'c')).toBeNull()
    const columns = findBlock([field], next!, 'cols')
    expect(readBlocks(columns!.block.settings, 'right')).toHaveLength(0)
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
