/**
 * What the editor has picked.
 *
 * One state for the whole selection, so the section, its block and its
 * element can never disagree: picking a section drops the block and element
 * of the previous one in the same update. Besides sections, a few fixed
 * things are picked the same way and edited in the same inspector — the
 * theme's header and footer, a frame's details and the theme settings — and
 * each has a pseudo id no section can ever have.
 */

import type { ElementKind } from '../model/element-style'

export const HEADER_ID = 'layout:header'
export const FOOTER_ID = 'layout:footer'
/** The frame's details (`frame.details`), picked like a section. */
export const DETAILS_ID = 'frame:details'
/** The theme's colours, fonts and shape. */
export const THEME_ID = 'theme:settings'

export interface Selection {
  /** A section id or one of the pseudo ids above; `null` is nothing picked. */
  id: string | null
  /** A block inside the picked section. Wins over `element` when both are set. */
  blockId: string | null
  /** A button or text element in the picked section's `elements` map. */
  element: { id: string; kind: ElementKind } | null
}

const PSEUDO_IDS: ReadonlySet<string> = new Set([HEADER_ID, FOOTER_ID, DETAILS_ID, THEME_ID])

/** Whether `id` names a fixed thing rather than a section on the page. */
export function isPseudoId(id: string): boolean {
  return PSEUDO_IDS.has(id)
}

export const NOTHING_SELECTED: Selection = { id: null, blockId: null, element: null }

export function selectId(id: string | null): Selection {
  return { id, blockId: null, element: null }
}
