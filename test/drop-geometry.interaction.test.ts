/**
 * What the drop measures as a section's content, against a real DOM.
 *
 * The room around the drop band is measured from what the eye can see, and
 * the page's ends hang on this being right: DOM boxes alone cannot answer it,
 * because every wrapper's box includes its own padding. So the measurement
 * reads ink — text, photos, controls — and any box that is actually painted.
 * The two shapes that carry no text of their own (a slider's dots, a
 * section's background image) are exactly what used to be missed.
 */

import { describe, expect, test } from 'bun:test'

import './happy-dom-setup'

import {
  chromeBounds,
  gapBand,
  gapInsets,
  sectionBounds,
  type SectionBounds,
} from '../src/editor/drop-geometry'

function stub(element: Element, top: number, bottom: number, left = 0, width = 1200): void {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      top,
      bottom,
      left,
      right: left + width,
      width,
      height: bottom - top,
      x: left,
      y: top,
      toJSON: () => ({}),
    }),
  })
}

function stubStyle(element: Element, css: string): void {
  ;(element as HTMLElement).style.cssText = css
}

describe('the drop geometry over a real DOM', () => {
  test('a section’s content is its ink, not its padding', () => {
    document.body.innerHTML = `
      <div data-section-id="s1">
        <div class="pad"></div>
        <img alt="" />
        <div class="plain"></div>
        <button aria-label="Slide 1"></button>
      </div>
    `
    const section = document.querySelector('[data-section-id="s1"]')!
    const [pad, image, plain, dot] = Array.from(section.children) as HTMLElement[]
    stub(section, 0, 400)
    stub(pad!, 0, 400)
    stub(image!, 40, 200)
    stub(plain!, 220, 300)
    stub(dot!, 320, 330)

    const [bounds] = sectionBounds(document, ['s1'])
    // The photo is the first thing seen; the dot is the last — past the plain
    // box, which is only a wrapper and contributes nothing.
    expect(bounds!.contentTop).toBe(40)
    expect(bounds!.contentBottom).toBe(330)
  })

  test('a painted box counts even with nothing in it', () => {
    document.body.innerHTML = `
      <div data-section-id="s1">
        <div class="art"></div>
        <button aria-label="Slide 1"></button>
      </div>
    `
    const section = document.querySelector('[data-section-id="s1"]')!
    const [art, dot] = Array.from(section.children) as HTMLElement[]
    stub(section, 0, 600)
    stub(art!, 80, 420)
    stub(dot!, 440, 450)
    stubStyle(art!, 'background-image: url(/hero.jpg); background-size: cover;')

    const [bounds] = sectionBounds(document, ['s1'])
    // The background image is the section's visible top — not the section's
    // own box top with its padding, and not whatever text came first.
    expect(bounds!.contentTop).toBe(80)
    expect(bounds!.contentBottom).toBe(450)
  })

  test('the page ends measure against the header and the footer', () => {
    document.body.innerHTML = `
      <header class="store"></header>
      <div data-section-id="s1"><header class="catalog">Best sellers</header></div>
      <footer class="store"></footer>
    `
    const [header, section, footer] = Array.from(document.body.children) as HTMLElement[]
    stub(header!, 0, 72)
    stub(section!, 100, 400, 0, 1200)
    stub(footer!, 900, 1000, 0, 1200)
    // The section's own heading area must not be mistaken for the page header.
    stub(section!.firstElementChild!, 100, 140, 0, 1200)

    const chrome = chromeBounds(document)
    expect(chrome).toEqual({ headerBottom: 72, footerTop: 900 })

    const [bounds] = sectionBounds(document, ['s1'])
    const above = gapInsets(null, bounds!, chrome, bounds!.top)
    const below = gapInsets(bounds!, null, chrome, bounds!.bottom)
    // Page start: the room above runs from the header's edge. Page end: from
    // the section's bottom to the footer's edge.
    expect(above).toEqual({ above: 28, below: 0 })
    expect(below).toEqual({ above: 0, below: 500 })

    // Composed, the band's own gaps come out equal at both ends: half the
    // room on each side of it, whichever side the room came from.
    const bandAt = (
      insets: { above: number; below: number },
      boundary: number,
      up: number,
      down: number,
    ) => {
      const band = gapBand(insets.above, insets.below, up, down)
      const top = boundary + band.top
      const gapAbove = top - (boundary - insets.above - up)
      const gapBelow = boundary + insets.below + down - (top + band.height)
      expect(gapAbove, `above at ${boundary}`).toBeCloseTo(gapBelow)
      return gapAbove
    }
    expect(bandAt(above, bounds!.top, 0, 96)).toBeCloseTo(14)
    expect(bandAt(below, bounds!.bottom, 96, 0)).toBeCloseTo(250)
  })
})
