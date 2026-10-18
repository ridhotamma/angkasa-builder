/**
 * Where a dropped section lands: the pure geometry of the drop layer.
 *
 * Kept apart from `preview-drop.tsx` (which owns the React overlay) so the
 * numbers can be exercised against a real DOM — in a browser probe and in a
 * `happy-dom` test — with no renderer in the way.
 *
 * Two things decide the answer: the sections' edges (where the boundary is)
 * and what the eye can see on either side of it (the room the band must share
 * out equally). DOM boxes alone cannot answer the second: every wrapper's box
 * includes its own padding. What counts is ink — text, media, controls — and
 * any box that is actually painted.
 */

/** The room a drop opens for itself, in the iframe's own pixels. */
export const DROP_GAP_PX = 96

export interface SectionBounds {
  id: string
  left: number
  top: number
  bottom: number
  width: number
  /** The top of the section's own content — what the eye can see. */
  contentTop: number
  /** The bottom of the section's own content — what the eye can see. */
  contentBottom: number
}

/**
 * The page's own furniture, as the drop sees it: the storefront header above
 * the first section and the footer below the last. Their edges are what the
 * room at the very start and end of the page is measured against — without
 * them a drop at either end would pretend the page stops at the section.
 */
export interface PageChrome {
  headerBottom: number | null
  footerTop: number | null
}

/**
 * Where a point falls among the sections, in the cached layout: above a
 * section's middle inserts before it, below inserts after — so the gap opens
 * exactly where the pointer crossed the halfway line.
 */
export function insertionIndex(bounds: readonly SectionBounds[], y: number): number {
  for (let at = 0; at < bounds.length; at++) {
    const bound = bounds[at]!
    if (y < bound.top + (bound.bottom - bound.top) / 2) return at
    if (y < bound.bottom) return at + 1
  }
  return bounds.length
}

/**
 * How far the sections on each side of the insertion point move, in the
 * iframe's own pixels.
 *
 * The gap opens **equally above and below** — half each way — so the space
 * the drop creates is the same on both sides of the line it lands on. The
 * page ends have no neighbour to give way, so there the whole gap falls on
 * the one side that exists.
 */
export function gapMotion(at: number, count: number): { up: number; down: number } {
  if (count === 0) return { up: 0, down: DROP_GAP_PX }
  if (at <= 0) return { up: 0, down: DROP_GAP_PX }
  if (at >= count) return { up: DROP_GAP_PX, down: 0 }
  const half = DROP_GAP_PX / 2
  return { up: half, down: half }
}

/**
 * Where the band sits relative to the boundary, and how tall it is.
 *
 * `above` and `below` are the whitespace the eye sees between the boundary
 * and the neighbours' own content, `up` and `down` the room the slide opened.
 * The band is centred in that whole space — so the gaps at its top and bottom
 * come out equal — rather than pinned to the boundary, which would leave the
 * two sections' different padding showing as unequal room either side.
 */
export function gapBand(
  above: number,
  below: number,
  up: number,
  down: number,
): { top: number; height: number } {
  const height = up + down
  return { top: (above + below) / 2 - above - up, height }
}

/**
 * The whitespace the eye sees on either side of the boundary.
 *
 * Mid-page both neighbours are sections, so the room is measured from their
 * own content. At the page's ends the neighbour is the storefront's own
 * header or footer, whose edge is the last (or first) thing the eye can see
 * there. A floating header that overlaps the page start gives a negative
 * measurement, which is room the band must not count, so both sides clamp at
 * zero.
 */
export function gapInsets(
  before: SectionBounds | null,
  after: SectionBounds | null,
  chrome: PageChrome,
  boundary: number,
): { above: number; below: number } {
  const ceiling = before ? before.contentBottom : chrome.headerBottom
  const floor = after ? after.contentTop : chrome.footerTop
  return {
    above: ceiling === null ? 0 : Math.max(0, boundary - ceiling),
    below: floor === null ? 0 : Math.max(0, floor - boundary),
  }
}

export function closestSection(doc: Document, id: string): HTMLElement | null {
  // Ids are the editor's own (letters, digits, `-`, `_`), so no escaping needed.
  return doc.querySelector<HTMLElement>(`[data-section-id="${id}"]`)
}

/** Elements the eye sees as ink even when they hold no text. */
const INK_TAGS = new Set([
  'img',
  'video',
  'canvas',
  'iframe',
  'svg',
  'picture',
  'button',
  'input',
  'select',
  'textarea',
  'hr',
])

/** A fully transparent background, however a browser spells it. */
const CLEAR = /^rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)$/

function painted(element: Element): boolean {
  const view = element.ownerDocument.defaultView
  if (!view) return false
  const style = view.getComputedStyle(element)
  if (style.backgroundImage && style.backgroundImage !== 'none') return true
  if (
    style.backgroundColor &&
    style.backgroundColor !== 'transparent' &&
    !CLEAR.test(style.backgroundColor)
  ) {
    return true
  }
  return [
    style.borderTopWidth,
    style.borderRightWidth,
    style.borderBottomWidth,
    style.borderLeftWidth,
  ].some((width) => Boolean(width) && !width.startsWith('0'))
}

/**
 * The box the eye reads as a section's content.
 *
 * Text ranges give the ink of the words themselves; media and controls have
 * ink of their own (the slider's dots are buttons, not text); and a box that
 * is painted — a background colour or image, a border — is visible even when
 * it holds nothing. Anything else is a wrapper whose box is mostly padding,
 * which is exactly what must not be measured.
 */
function contentBox(element: HTMLElement): { top: number; bottom: number } {
  const rect = element.getBoundingClientRect()
  let top = rect.bottom
  let bottom = rect.top
  let seen = false
  const doc = element.ownerDocument
  const range = doc.createRange()
  const walker = doc.createTreeWalker(element, NodeFilter.SHOW_ALL)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (!node.textContent?.trim()) continue
      range.selectNodeContents(node)
      const box = range.getBoundingClientRect()
      if (box.width === 0 && box.height === 0) continue
      seen = true
      top = Math.min(top, box.top)
      bottom = Math.max(bottom, box.bottom)
      continue
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue
    const el = node as Element
    const box = el.getBoundingClientRect()
    if (box.width === 0 && box.height === 0) continue
    // Only a box reaching past what is already known can change the answer —
    // which keeps the computed-style reads to the few that could matter.
    if (!INK_TAGS.has(el.tagName.toLowerCase())) {
      if (box.top >= top && box.bottom <= bottom) continue
      if (!painted(el)) continue
    }
    seen = true
    top = Math.min(top, box.top)
    bottom = Math.max(bottom, box.bottom)
  }
  if (!seen) return { top: rect.top, bottom: rect.bottom }
  // A decoration may overflow the section; the section still ends where it ends.
  return {
    top: Math.max(rect.top, Math.min(top, rect.bottom)),
    bottom: Math.min(rect.bottom, Math.max(bottom, rect.top)),
  }
}

/**
 * The sections' geometry, read once per drag.
 *
 * The gap transform moves the sections themselves, and
 * `getBoundingClientRect` includes transforms — a live read after the first
 * push would measure the gap, not the layout, and the marker would flicker
 * between two answers forever.
 */
export function sectionBounds(doc: Document, ids: readonly string[]): SectionBounds[] {
  const out: SectionBounds[] = []
  for (const id of ids) {
    const element = closestSection(doc, id)
    if (!element) continue
    const rect = element.getBoundingClientRect()
    const content = contentBox(element)
    out.push({
      id,
      left: rect.left,
      top: rect.top,
      bottom: rect.bottom,
      width: rect.width,
      contentTop: content.top,
      contentBottom: content.bottom,
    })
  }
  return out
}

/**
 * The header and footer edges, read once per drag like the section bounds.
 *
 * The page header and footer live outside the sections, so `closestSection`
 * never finds them; a `<header>` inside a section (a catalogue's own heading
 * area, say) is not the page's furniture and must not be mistaken for it.
 */
export function chromeBounds(doc: Document): PageChrome {
  const outside = (tag: string) => {
    for (const element of doc.querySelectorAll<HTMLElement>(tag)) {
      if (!element.closest('[data-section-id]')) return element
    }
    return null
  }
  const header = outside('header')
  const footer = outside('footer')
  const headerRect = header?.getBoundingClientRect()
  const footerRect = footer?.getBoundingClientRect()
  return {
    headerBottom: headerRect && headerRect.height > 0 ? headerRect.bottom : null,
    footerTop: footerRect && footerRect.height > 0 ? footerRect.top : null,
  }
}
