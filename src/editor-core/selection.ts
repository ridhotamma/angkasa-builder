/**
 * What the seller has picked, as one plain value.
 *
 * A section (or the header, footer or frame details, by their reserved ids),
 * optionally a block inside it, or a button / text element in its element
 * map. A block selection wins when both a block and an element are set.
 */

import type { ElementKind } from '../model/element-style'

/** The header, footer and the frame's details are picked like sections, by these ids. */
export const HEADER_ID = 'layout:header'
export const FOOTER_ID = 'layout:footer'
export const DETAILS_ID = 'frame:details'

export interface EditorSelection {
  sectionId: string | null
  blockId: string | null
  elementId: string | null
  /** Which panel the element opens; meaningful only while `elementId` is set. */
  elementKind: ElementKind
}

export const NO_SELECTION: EditorSelection = Object.freeze({
  sectionId: null,
  blockId: null,
  elementId: null,
  elementKind: 'button',
}) as EditorSelection

/** A section picked; any block or element of the previous one is dropped. */
export function sectionSelection(sectionId: string): EditorSelection {
  return { ...NO_SELECTION, sectionId }
}

/** The same selection, or `next` — kept by identity when nothing changed. */
export function sameSelection(current: EditorSelection, next: EditorSelection): EditorSelection {
  return current.sectionId === next.sectionId &&
    current.blockId === next.blockId &&
    current.elementId === next.elementId &&
    current.elementKind === next.elementKind
    ? current
    : next
}
