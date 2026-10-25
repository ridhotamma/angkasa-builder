/**
 * Saved blocks: what "Save as block" keeps, and what the palette gets back.
 * Runs on happy-dom for its `localStorage`.
 */

import './happy-dom-setup'

import { beforeEach, describe, expect, test } from 'bun:test'

import { createSection } from '../src/model/content'
import { readBlocks, type BlockValue } from '../src/model/fields'
import {
  MAX_SAVED_BLOCKS,
  paletteBlockOf,
  readSavedBlocks,
  removeSavedBlock,
  saveBlock,
} from '../src/editor/saved-blocks'

const KEY = 'pesanle.page-builder.saved-blocks'

function aColumnWithChildren(): BlockValue {
  const section = createSection('blocks', {
    blocks: [{ type: 'column', settings: { blocks: [{ type: 'heading' }, { type: 'button' }] } }],
  } as never)
  return readBlocks(section.settings, 'blocks')[0]!
}

/** Every block id in a tree, nested children included. */
function ids(block: { id?: string; settings?: Record<string, unknown> }): string[] {
  const children = Array.isArray(block.settings?.blocks)
    ? (block.settings.blocks as BlockValue[]).flatMap(ids)
    : []
  return [...(block.id ? [block.id] : []), ...children]
}

describe('saved blocks', () => {
  beforeEach(() => localStorage.clear())

  test('keep a block with its children, newest first', () => {
    const column = aColumnWithChildren()
    expect(saveBlock('First', column)).toBe(true)
    expect(saveBlock('Second', column)).toBe(true)
    const saved = readSavedBlocks()
    expect(saved.map((entry) => entry.name)).toEqual(['Second', 'First'])
    expect(saved[0]!.block.type).toBe('column')
    expect(ids(saved[0]!.block)).toHaveLength(3)
  })

  test('come back with fresh ids every time they are added', () => {
    saveBlock('Column', aColumnWithChildren())
    const [entry] = readSavedBlocks()
    const first = paletteBlockOf(entry!)
    const second = paletteBlockOf(entry!)
    const childIds = (block: typeof first) =>
      (block.settings?.blocks as BlockValue[]).map((child) => child.id)
    expect(childIds(first)).not.toEqual(childIds(second))
    expect(childIds(first)).not.toEqual(
      (entry!.block.settings.blocks as unknown as BlockValue[]).map((child) => child.id),
    )
  })

  test('drop entries that are not a drawable block', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        { id: 'a', name: 'Bad type', block: { id: 'x', type: 'no-such-block', settings: {} } },
        { id: 'b', name: 'Not a block' },
        'junk',
      ]),
    )
    expect(readSavedBlocks()).toEqual([])
  })

  test('are capped, and can be removed', () => {
    const column = aColumnWithChildren()
    for (let i = 0; i < MAX_SAVED_BLOCKS + 3; i++) saveBlock(`B${i}`, column)
    const saved = readSavedBlocks()
    expect(saved).toHaveLength(MAX_SAVED_BLOCKS)
    removeSavedBlock(saved[0]!.id)
    expect(readSavedBlocks()).toHaveLength(MAX_SAVED_BLOCKS - 1)
  })
})

describe('a saved block added back', () => {
  beforeEach(() => localStorage.clear())

  test('is named after what it was saved as', () => {
    saveBlock('Promo button', aColumnWithChildren())
    expect(paletteBlockOf(readSavedBlocks()[0]!).name).toBe('Promo button')
  })
})
