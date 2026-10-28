/**
 * Blocks the seller saved to reuse: a styled button, a heading with its
 * spacing, a whole column of them. Saved from a block's panel, offered back
 * in the add palette's Blocks mode and the command palette.
 *
 * Kept in this browser, like the section clipboard: a saved block is a
 * shortcut for the person building, not part of the shop. Every read is
 * validated, so a hand-edited or stale entry is dropped rather than inserted.
 */

import { useCallback, useEffect, useState } from 'react'

import { blockSchema, cloneBlock } from '../model/blocks'
import { MAX_BLOCK_NAME, newId, type BlockValue } from '../model/fields'
import type { PaletteBlock } from './add-palette'

export interface SavedBlock {
  id: string
  name: string
  block: BlockValue
}

const SAVED_BLOCKS_KEY = 'angkasa-builder.saved-blocks'
/** Enough for a seller's own kit of parts; the oldest drop off past it. */
export const MAX_SAVED_BLOCKS = 24
/** Fired on this window when the list changes, so every open palette follows. */
const CHANGED_EVENT = 'angkasa-builder:saved-blocks'

function isSaved(value: unknown): value is SavedBlock {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Partial<SavedBlock>
  return (
    typeof entry.id === 'string' &&
    typeof entry.name === 'string' &&
    typeof entry.block === 'object' &&
    entry.block !== null &&
    typeof entry.block.type === 'string' &&
    // Only a block the generic blocks renderer can draw: a preset section's
    // own block (a card, a quote) would mean nothing anywhere else.
    blockSchema(entry.block.type) !== null
  )
}

export function readSavedBlocks(): SavedBlock[] {
  try {
    const raw = globalThis.localStorage?.getItem(SAVED_BLOCKS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isSaved).slice(0, MAX_SAVED_BLOCKS) : []
  } catch {
    // Unreadable or refused storage: nothing saved, as far as the editor knows.
    return []
  }
}

function writeSavedBlocks(list: readonly SavedBlock[]): boolean {
  try {
    globalThis.localStorage?.setItem(SAVED_BLOCKS_KEY, JSON.stringify(list))
    globalThis.dispatchEvent?.(new Event(CHANGED_EVENT))
    return true
  } catch {
    // Storage full or refused: the block just is not saved.
    return false
  }
}

/** Whether a block can be saved: one the generic blocks renderer draws. */
export function canSaveBlock(block: BlockValue): boolean {
  return blockSchema(block.type) !== null
}

/** Saves a copy of `block` first in the list; `false` when storage refused it. */
export function saveBlock(name: string, block: BlockValue): boolean {
  const schema = blockSchema(block.type)
  if (!schema) return false
  const entry: SavedBlock = {
    id: newId(),
    name: name.trim().slice(0, MAX_BLOCK_NAME) || block.type,
    block: cloneBlock(block, schema),
  }
  return writeSavedBlocks([entry, ...readSavedBlocks()].slice(0, MAX_SAVED_BLOCKS))
}

export function removeSavedBlock(id: string): void {
  writeSavedBlocks(readSavedBlocks().filter((entry) => entry.id !== id))
}

/**
 * The saved block as the palette inserts it, with fresh ids throughout: the
 * same saved block added twice must not give two blocks one id.
 */
export function paletteBlockOf(saved: SavedBlock): PaletteBlock {
  const schema = blockSchema(saved.block.type)
  const block = schema ? cloneBlock(saved.block, schema) : saved.block
  return {
    type: block.type,
    settings: block.settings,
    ...(block.style && { style: block.style }),
    // The block's own name, or the one it was saved under, so the layer list
    // shows "Promo button" rather than another "Button".
    name: block.name || saved.name,
  }
}

/** The saved list, kept current across palettes and other tabs. */
export function useSavedBlocks(): SavedBlock[] {
  const [list, setList] = useState<SavedBlock[]>([])
  const refresh = useCallback(() => setList(readSavedBlocks()), [])
  useEffect(() => {
    // After mount: storage cannot be read on the server.
    refresh()
    const onStorage = (event: StorageEvent) => {
      if (event.key === SAVED_BLOCKS_KEY) refresh()
    }
    globalThis.addEventListener?.(CHANGED_EVENT, refresh)
    globalThis.addEventListener?.('storage', onStorage)
    return () => {
      globalThis.removeEventListener?.(CHANGED_EVENT, refresh)
      globalThis.removeEventListener?.('storage', onStorage)
    }
  }, [refresh])
  return list
}
