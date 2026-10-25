/**
 * The layout presets: each must land as the tree it describes. A typo in a
 * type or a key would be dropped silently by the sanitiser, and the seller
 * would get half a layout.
 */

import { describe, expect, test } from 'bun:test'

import { BLOCK_PRESETS, type PresetBlock } from '../src/model/block-presets'
import { createSection } from '../src/model/content'
import { readBlocks, type BlockValue } from '../src/model/fields'

function shape(blocks: readonly (PresetBlock | BlockValue)[]): unknown[] {
  return blocks.map((block) => {
    const children = (block.settings as { blocks?: PresetBlock[] } | undefined)?.blocks
    return children ? [block.type, shape(children)] : block.type
  })
}

describe('block presets', () => {
  test('have unique keys', () => {
    const keys = BLOCK_PRESETS.map((preset) => preset.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  for (const preset of BLOCK_PRESETS) {
    test(`${preset.key} keeps every block and photo through the sanitiser`, () => {
      const section = createSection('blocks', { blocks: preset.blocks as never })
      const stored = readBlocks(section.settings, 'blocks')
      expect(shape(stored)).toEqual(shape(preset.blocks))

      const photos = (blocks: readonly (PresetBlock | BlockValue)[]): unknown[] =>
        blocks.flatMap((block) => [
          ...(block.type === 'image' ? [block.settings?.image] : []),
          ...photos(((block.settings as { blocks?: PresetBlock[] })?.blocks ?? []) as PresetBlock[]),
        ])
      expect(photos(stored)).toEqual(photos(preset.blocks))
      expect(photos(stored).every((photo) => typeof photo === 'string' && photo.length > 0)).toBe(
        true,
      )
    })
  }
})
