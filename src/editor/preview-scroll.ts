/** Scrolling the preview to a section, clear of the store's sticky header. */

import { HEADER_ID } from './selection'

/**
 * Room kept above a revealed section, past the header: the outline stands 6px
 * off it, and a selected section's toolbar sits on top of the outline.
 */
const REVEAL_GAP = 48

/**
 * Scroll the preview so section `id` is in view below the header, not under
 * it. `start` brings its top to just under the header (a section picked from
 * the list); `nearest` only nudges it on screen if it went off (a section
 * moved or copied). The header's height is measured the moment it is needed,
 * since `scrollIntoView` knows nothing of it.
 */
export function revealSection(doc: Document, id: string, how: 'start' | 'nearest') {
  const view = doc.defaultView
  const element = doc.querySelector<HTMLElement>(`[data-section-id="${id}"]`)
  if (!view || !element) return
  const rect = element.getBoundingClientRect()
  const covered = stickyHeaderHeight(doc)
  const top = Math.max(0, view.scrollY + rect.top - covered - REVEAL_GAP)
  if (how === 'start') {
    view.scrollTo({ top, behavior: 'smooth' })
    return
  }
  if (rect.top < covered + REVEAL_GAP) view.scrollTo({ top })
  else if (rect.bottom > view.innerHeight) {
    // Bottom on screen, but never at the price of pushing the top under the header.
    view.scrollTo({ top: Math.min(top, view.scrollY + rect.bottom - view.innerHeight + 16) })
  }
}

/**
 * How much of the preview's top the store header covers once the page
 * scrolls: a sticky or fixed one — see-through or not — stays over whatever
 * passes under it, and covers its own height. Measured from the page as
 * drawn, so an announcement strip, a two-row layout or a phone-width menu
 * all count.
 *
 * Only the store header counts: article and section bodies also render
 * `<header>` elements (e.g. `article-header`), deeper in the page, and those
 * must never offset the reveal. The store header is the preview's top-level
 * one — the `[data-section-id]` wrapper when the layout is editable, or a
 * bare `<header>` straight under the preview root in a read-only preview.
 */
function stickyHeaderHeight(doc: Document): number {
  const view = doc.defaultView
  if (!view) return 0
  const root = doc.body.firstElementChild as HTMLElement | null
  const framed =
    root?.querySelector<HTMLElement>(`:scope > [data-section-id="${HEADER_ID}"]`) ??
    doc.querySelector<HTMLElement>(`[data-section-id="${HEADER_ID}"]`)
  const candidates: HTMLElement[] = []
  if (framed) {
    candidates.push(framed)
    const inner = framed.querySelector<HTMLElement>('header')
    if (inner) candidates.push(inner)
  } else if (root) {
    for (const child of root.children) {
      if (child instanceof HTMLElement && child.tagName.toLowerCase() === 'header') {
        candidates.push(child)
      }
    }
    if (candidates.length === 0) {
      const top = root.querySelector<HTMLElement>(':scope > header')
      if (top) candidates.push(top)
    }
  }
  let height = 0
  for (const element of candidates) {
    const { position } = view.getComputedStyle(element)
    if (position === 'sticky' || position === 'fixed') {
      height = Math.max(height, element.getBoundingClientRect().height)
    }
  }
  return height
}
