/**
 * Which sections a page draws, and how its first and last meet the page
 * edges — pure, so servers can ask it too: the storefront's renderer
 * (`../render/renderer`, which re-exports these) and the headless API, which
 * answers a page's live sections the way the storefront would draw them.
 */

import { resolveLinkedSections, type SectionInstance } from './content'
import { readSectionStyle, scheduleState } from './section-style'
import { isFloatingSection } from './sections'

/**
 * Which sections the storefront draws right now. A hidden section never, and
 * a scheduled one only between its dates — judged at the environment's `now`,
 * which the storefront sets from the request so server and browser agree.
 * The editor draws everything that is not hidden, with a badge on sections
 * that are outside their dates.
 */
export function liveSections(sections: readonly SectionInstance[], now: Date): SectionInstance[] {
  return sections.filter((section) => {
    if (section.hidden) return false
    const state = scheduleState(readSectionStyle(section.style), now)
    return state === 'always' || state === 'live'
  })
}

/**
 * The sections a renderer in `mode` draws: live ones on the storefront,
 * everything not hidden in the editor. Linked copies are resolved to their
 * originals first, so a copy draws — and is measured — as what it shows.
 */
export function drawnSections(
  sections: readonly SectionInstance[],
  mode: 'live' | 'preview',
  now: Date,
): SectionInstance[] {
  const resolved = resolveLinkedSections(sections)
  return mode === 'live'
    ? liveSections(resolved, now)
    : resolved.filter((section) => !section.hidden)
}

/** A section that runs past the page column — edge to edge, or on a full-width band. */
export function isFullBleed(section: SectionInstance): boolean {
  return readSectionStyle(section.style).width !== 'contained'
}

/**
 * Whether the page's own padding above and below the sections should go.
 *
 * The page column is padded top and bottom; a section that runs edge to edge
 * inside it would open (or close) with a strip of page background across it —
 * a banner that does not reach the header. The host drops that padding when
 * the first (or last) drawn section is full-bleed. Pass the sections the host
 * will draw, from `drawnSections`.
 */
export interface PageEdges {
  /** Drop the page's padding above the sections. */
  flushTop: boolean
  /** Drop it below them, and the footer's gap. */
  flushBottom: boolean
  /** The page opens with an edge-to-edge section a see-through header can float over. */
  bannerFirst: boolean
}

export const NO_PAGE_EDGES: PageEdges = { flushTop: false, flushBottom: false, bannerFirst: false }

export function pageEdges(drawn: readonly SectionInstance[]): PageEdges {
  // Floating sections paint outside the flow, so the painted first and last
  // are the first and last of the sections that actually take space.
  const resolved = resolveLinkedSections(drawn).filter(
    (section) => !isFloatingSection(section.type),
  )
  const first = resolved[0]
  const last = resolved[resolved.length - 1]
  return {
    flushTop: first !== undefined && isFullBleed(first),
    flushBottom: last !== undefined && isFullBleed(last),
    bannerFirst: first !== undefined && readSectionStyle(first.style).width === 'edge',
  }
}
