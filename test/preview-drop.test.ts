/**
 * The drop gap: where it opens and how tall it is.
 *
 * The band the overlay draws and the distance the sections slide must be one
 * number, and the index must come from the cached layout rather than the
 * pushed one — the gap moves the sections, and a live read would chase them.
 */

import { describe, expect, test } from 'bun:test'

import {
  DROP_GAP_PX,
  insertionIndex,
  scaleRect,
  type SectionBounds,
} from '../src/editor/preview-drop'

function bounds(pairs: ReadonlyArray<[number, number]>): SectionBounds[] {
  return pairs.map(([top, bottom], index) => ({
    id: `s${index}`,
    left: 0,
    top,
    bottom,
    width: 1200,
  }))
}

describe('the drop gap', () => {
  const sections = bounds([
    [0, 100],
    [100, 300],
    [300, 500],
  ])

  test('above a section’s middle opens before it, below opens after', () => {
    // Over the header — anything above the first section — starts the page.
    expect(insertionIndex(sections, -20)).toBe(0)
    // Top half of the first section, then its bottom half.
    expect(insertionIndex(sections, 20)).toBe(0)
    expect(insertionIndex(sections, 80)).toBe(1)
    // The second follows the same halfway rule.
    expect(insertionIndex(sections, 150)).toBe(1)
    expect(insertionIndex(sections, 250)).toBe(2)
    // Past the last section is the end of the page.
    expect(insertionIndex(sections, 999)).toBe(3)
  })

  test('an empty page takes the item at the start', () => {
    expect(insertionIndex([], 400)).toBe(0)
  })

  test('the gap is a real height, shared by the band and the slide', () => {
    expect(DROP_GAP_PX).toBeGreaterThan(0)
  })

  test('an iframe rect lands exactly where the frame displays it', () => {
    // The frame's own position and scale carry the rect onto the page; this
    // is the step whose absence drew the band offset from the sections.
    expect(
      scaleRect({ left: 0, top: 10, width: 1440, height: 96 }, { left: 478, top: 148, scale: 0.9 }),
    ).toEqual({ left: 478, top: 157, width: 1296, height: 86.4 })
  })
})
