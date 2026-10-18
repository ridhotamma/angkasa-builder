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
  gapBand,
  gapInsets,
  gapMotion,
  insertionIndex,
  scaleRect,
  type PageChrome,
  type SectionBounds,
} from '../src/editor/preview-drop'

/** A page with no header or footer at all. */
const NO_CHROME: PageChrome = { headerBottom: null, footerTop: null }

function bounds(pairs: ReadonlyArray<[number, number]>): SectionBounds[] {
  return pairs.map(([top, bottom], index) => ({
    id: `s${index}`,
    left: 0,
    top,
    bottom,
    width: 1200,
    contentTop: top,
    contentBottom: bottom,
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

  test('the space opens equally either side, and fully at the ends', () => {
    // Between two sections: half up, half down — equal room above and below.
    expect(gapMotion(1, 3)).toEqual({ up: DROP_GAP_PX / 2, down: DROP_GAP_PX / 2 })
    expect(gapMotion(2, 3)).toEqual({ up: DROP_GAP_PX / 2, down: DROP_GAP_PX / 2 })
    // At the page start there is nothing above to give way; at the end,
    // nothing below — the whole gap falls on the side that exists.
    expect(gapMotion(0, 3)).toEqual({ up: 0, down: DROP_GAP_PX })
    expect(gapMotion(3, 3)).toEqual({ up: DROP_GAP_PX, down: 0 })
    expect(gapMotion(0, 0)).toEqual({ up: 0, down: DROP_GAP_PX })
  })

  test('the band is centred on the room the eye can see', () => {
    // Room above the band as the eye measures it: from the last content of the
    // section above (its padding sits above the boundary) to the band's top.
    // Room below: from the band's bottom to the first content of the section
    // below. Both must come out the same, whatever the two sections pad.
    const room = (above: number, below: number) => {
      const { top, height } = gapBand(above, below, DROP_GAP_PX / 2, DROP_GAP_PX / 2)
      return {
        above: top - (-above - DROP_GAP_PX / 2),
        below: below + DROP_GAP_PX / 2 - (top + height),
      }
    }
    for (const [above, below] of [
      [0, 0],
      [16, 85],
      [80, 80],
      [120, 24],
    ] as const) {
      const sides = room(above, below)
      expect(sides.above, `above ${above}/${below}`).toBeCloseTo((above + below) / 2)
      expect(sides.below, `below ${above}/${below}`).toBeCloseTo((above + below) / 2)
    }
    // No padding anywhere: the band still fills exactly the space that opened.
    expect(gapBand(0, 0, DROP_GAP_PX / 2, DROP_GAP_PX / 2)).toEqual({
      top: -DROP_GAP_PX / 2,
      height: DROP_GAP_PX,
    })
    // A page start (nothing above) and a page end (nothing below) settle the
    // band half-way into the one neighbour's padding.
    expect(gapBand(0, 60, 0, DROP_GAP_PX)).toEqual({ top: 30, height: DROP_GAP_PX })
    expect(gapBand(60, 0, DROP_GAP_PX, 0)).toEqual({
      top: -DROP_GAP_PX - 30,
      height: DROP_GAP_PX,
    })
  })

  test('mid-page the room comes from the neighbours’ own content', () => {
    // The section above pads 48px below its content, the one below pads 84px
    // above its own — the difference the band has to soak up.
    const above: SectionBounds = {
      id: 'a',
      left: 0,
      top: 0,
      bottom: 400,
      width: 1200,
      contentTop: 0,
      contentBottom: 352,
    }
    const below: SectionBounds = {
      id: 'b',
      left: 0,
      top: 400,
      bottom: 800,
      width: 1200,
      contentTop: 484,
      contentBottom: 800,
    }
    expect(gapInsets(above, below, NO_CHROME, 400)).toEqual({ above: 48, below: 84 })
  })

  test('at the page ends the room comes from the header and footer', () => {
    const sections = bounds([
      [200, 400],
      [400, 700],
    ])
    const chrome: PageChrome = { headerBottom: 160, footerTop: 760 }
    // Page start: the last thing the eye sees above is the header's edge, not
    // the first section's own top.
    expect(gapInsets(null, sections[0]!, chrome, 200)).toEqual({ above: 40, below: 0 })
    // Page end: the first thing below is the footer's edge, not the page end.
    expect(gapInsets(sections[1]!, null, chrome, 700)).toEqual({ above: 0, below: 60 })
    // A page without a header or footer keeps the old answer rather than
    // measuring against nothing.
    expect(gapInsets(null, sections[0]!, NO_CHROME, 200)).toEqual({ above: 0, below: 0 })
    expect(gapInsets(sections[1]!, null, NO_CHROME, 700)).toEqual({ above: 0, below: 0 })
  })

  test('a header floating over the page never gives the band negative room', () => {
    // The transparent-header case: its edge sits below the first section's
    // top, where the band has no room to measure — only clamp.
    const sections = bounds([[200, 400]])
    expect(gapInsets(null, sections[0]!, { headerBottom: 260, footerTop: null }, 200).above).toBe(0)
  })

  test('an iframe rect lands exactly where the frame displays it', () => {
    // The frame's own position and scale carry the rect onto the page; this
    // is the step whose absence drew the band offset from the sections.
    expect(
      scaleRect({ left: 0, top: 10, width: 1440, height: 96 }, { left: 478, top: 148, scale: 0.9 }),
    ).toEqual({ left: 478, top: 157, width: 1296, height: 86.4 })
  })
})
