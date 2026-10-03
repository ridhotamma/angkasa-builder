import { describe, expect, test } from 'bun:test'

import {
  BLOCK_STYLE_FIELDS,
  blockSchema,
  blockStyleCss,
  createSection,
  defineBlock,
  duplicateBlock,
  findBlock,
  readBlocks,
  registeredBlock,
  sanitizeValues,
  sectionSchema,
  updateBlockStyle,
} from '../src/index'
import type { BlockValue } from '../src/index'

function blocksField() {
  const schema = sectionSchema('blocks')
  if (!schema) throw new Error('the blocks section is not registered')
  const field = schema.fields.find((candidate) => candidate.key === 'blocks')
  if (!field || field.kind !== 'blocks') throw new Error('the blocks field is missing')
  return field
}

function stored(block: Record<string, unknown>) {
  const field = blocksField()
  const values = sanitizeValues([field], { blocks: [block] })
  return { field, values, block: readBlocks(values, 'blocks')[0] }
}

describe('the block style allowlist', () => {
  test('offers the requested properties', () => {
    const keys = BLOCK_STYLE_FIELDS.map((field) => field.key)
    for (const key of [
      'position',
      'zIndex',
      'backgroundSize',
      'backgroundPosition',
      'backgroundRepeat',
      'backgroundAttachment',
      'inset',
      'borderRadius',
      'opacity',
      'transform',
    ]) {
      expect(keys).toContain(key)
    }
  })

  test('the blocks field carries the allowlist so every block can override', () => {
    expect(blocksField().styleFields).toBe(BLOCK_STYLE_FIELDS)
  })
})

describe('sanitising a block style', () => {
  test('keeps allowlisted tokens and drops unknown keys and defaults', () => {
    const { block } = stored({
      id: 'a',
      type: 'heading',
      settings: { text: 'A' },
      style: {
        position: 'absolute',
        zIndex: '10',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        opacity: 100,
        rawCss: 'url(https://evil.example/x.png)',
        className: 'x',
      },
    })
    expect(block!.style).toEqual({
      position: 'absolute',
      zIndex: '10',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    })
  })

  test('drops token values outside the allowlist', () => {
    const { block } = stored({
      id: 'a',
      type: 'text',
      settings: { body: 'x' },
      style: { position: 'explode', backgroundSize: 'cover' },
    })
    expect(block!.style).toEqual({ backgroundSize: 'cover' })
  })

  test('a style set entirely to defaults is not stored at all', () => {
    const { block } = stored({
      id: 'a',
      type: 'spacer',
      settings: {},
      style: { position: 'default', opacity: 100, backgroundColor: '' },
    })
    expect(block!.style).toBeUndefined()
  })
})

describe('resolving a block style to CSS', () => {
  test('tokens become plain CSS, unknown values are ignored', () => {
    const css = blockStyleCss({
      position: 'absolute',
      zIndex: '30',
      inset: '2',
      top: '4',
      backgroundSize: 'cover',
      backgroundPosition: 'bottom-right',
      borderRadius: 'lg',
      opacity: 50,
      transform: 'scale-105',
      pointerEvents: 'none',
    })
    expect(css).toMatchObject({
      position: 'absolute',
      zIndex: 30,
      top: '1rem',
      right: '0.5rem',
      bottom: '0.5rem',
      left: '0.5rem',
      backgroundSize: 'cover',
      backgroundPosition: 'bottom right',
      borderRadius: '0.5rem',
      opacity: 0.5,
      transform: 'scale(1.05)',
      pointerEvents: 'none',
    })
  })

  test('a style with nothing set resolves to the shared empty object', () => {
    expect(blockStyleCss(undefined)).toEqual({})
    expect(blockStyleCss({ position: 'default', opacity: 100 })).toEqual({})
  })
})

describe('editing a block style', () => {
  const field = blocksField()

  test('sets and clears overrides in place', () => {
    const values = sanitizeValues([field], {
      blocks: [
        { id: 'a', type: 'text', settings: { body: 'A' } },
        { id: 'b', type: 'text', settings: { body: 'B' } },
      ],
    })
    const styled = updateBlockStyle([field], values, 'a', { zIndex: '20' })!
    expect(findBlock([field], styled, 'a')?.block.style).toEqual({ zIndex: '20' })
    expect(findBlock([field], styled, 'b')?.block.style).toBeUndefined()

    const cleared = updateBlockStyle([field], styled, 'a', undefined)!
    expect(findBlock([field], cleared, 'a')?.block.style).toBeUndefined()
    expect('style' in (findBlock([field], cleared, 'a')!.block as BlockValue)).toBe(false)
  })

  test('duplicating a block copies its overrides', () => {
    const { field: target, values } = stored({
      id: 'a',
      type: 'text',
      settings: { body: 'A' },
      style: { zIndex: '20' },
    })
    const result = duplicateBlock([target], values, 'a')!
    expect(result.copy.style).toEqual({ zIndex: '20' })
  })
})

describe('custom blocks', () => {
  test('a registered block joins the library and sanitises its fields', () => {
    const callout = defineBlock({
      type: 'test-callout',
      name: { en: 'Callout', id: 'Sorotan' },
      fields: [
        { kind: 'text', key: 'text', label: { en: 'Text', id: 'Teks' }, max: 80, default: '' },
      ],
    })
    expect(registeredBlock('test-callout')).toBe(callout)
    expect(blockSchema('test-callout')).toBe(callout)

    const values = sanitizeValues([blocksField()], {
      blocks: [
        {
          id: 'c',
          type: 'test-callout',
          settings: { text: 'Hi', unknown: 'dropped' },
        },
      ],
    })
    const block = readBlocks(values, 'blocks')[0]
    expect(block?.type).toBe('test-callout')
    expect(block?.settings).toEqual({ text: 'Hi' })
  })

  test('replace-in-place keeps a type single and the picker order stable', () => {
    const first = defineBlock({
      type: 'test-replaced',
      name: { en: 'One', id: 'Satu' },
      fields: [],
    })
    const second = defineBlock({
      type: 'test-replaced',
      name: { en: 'Two', id: 'Dua' },
      fields: [],
    })
    expect(second).not.toBe(first)
    expect(registeredBlock('test-replaced')).toBe(second)
    expect(sectionSchema('blocks')).not.toBeNull()
  })
})

describe('layout blocks', () => {
  test('row and grid hold nested blocks and sanitise like any other', () => {
    const schema = blockSchema('row')
    expect(schema).not.toBeNull()
    expect(blockSchema('grid')).not.toBeNull()

    const field = blocksField()
    const values = sanitizeValues([field], {
      blocks: [
        {
          id: 'r',
          type: 'row',
          settings: {
            gap: 'lg',
            align: 'center',
            justify: 'between',
            wrap: true,
            stackOnMobile: true,
            blocks: [{ id: 'r-child', type: 'text', settings: { body: 'Beside' } }],
          },
        },
        {
          id: 'g',
          type: 'grid',
          settings: {
            columns: '3',
            blocks: [{ id: 'g-child', type: 'heading', settings: { text: 'In grid' } }],
          },
        },
      ],
    })
    expect(readBlocks(values, 'blocks').map((block) => block.type)).toEqual(['row', 'grid'])
    expect(findBlock([field], values, 'r-child')?.block.type).toBe('text')
    expect(findBlock([field], values, 'g-child')?.block.type).toBe('heading')
    expect(createSection('blocks', { blocks: [] })).toBeTruthy()
  })
})
