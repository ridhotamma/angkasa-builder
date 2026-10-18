/**
 * The drop layer over the preview iframe.
 *
 * While something is dragged from the add palette, a transparent box covers
 * the preview. The browser's drag events land on this box, and the drop is
 * hit-tested against the **iframe's own DOM** — the one way to drag from the
 * editor's document into the frame. What is found decides where the item
 * lands: between sections, or inside a block list at a precise index.
 *
 * The indicator is the **container**, not a bare line. A section drop opens a
 * gap the width of the section column — half the space taken from the section
 * above, half from the one below — and the gap is drawn where they moved
 * from: a dashed band, tinted, with no other mark, because the space itself
 * says where the section goes. The band is centred on the whitespace the eye
 * can see (the last content above to the first content below), so the room at
 * its top and bottom looks the same whatever the neighbours' padding is. A
 * block drop outlines the list it lands in and keeps the line at the index.
 *
 * The slide is written on the iframe's own elements and taken back when the
 * drag leaves or drops, so nothing lingers to fight the entrance animations.
 * The gap moves those elements, so the hit test reads a geometry cached at
 * the start of the drag: live rects would chase the very sections they moved.
 */

import { Box } from '@chakra-ui/react'
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'

import type { SectionInstance } from '../model/content'
import {
  chromeBounds,
  closestSection,
  gapBand,
  gapInsets,
  gapMotion,
  insertionIndex,
  sectionBounds,
  type PageChrome,
  type SectionBounds,
} from './drop-geometry'

export {
  DROP_GAP_PX,
  chromeBounds,
  gapBand,
  gapInsets,
  gapMotion,
  insertionIndex,
  sectionBounds,
  type PageChrome,
  type SectionBounds,
} from './drop-geometry'

export type DropTarget =
  | { kind: 'sections'; index: number }
  | {
      kind: 'blocks'
      sectionId: string
      parentId: string | null
      fieldKey: string
      index: number
    }

/** A box in iframe coordinates, scaled into the editor's when drawn. */
interface DropRect {
  left: number
  top: number
  width: number
  height: number
}

/** Where the frame sits on screen and how much it is scaled down. */
export interface FrameMapping {
  left: number
  top: number
  scale: number
}

/**
 * An iframe rect as the editor sees it: scaled through the frame, then moved
 * by the frame's own box. Skipping this is what drew the band in raw iframe
 * pixels — a fixed offset away from the sections it was meant to sit on.
 */
export function scaleRect(value: DropRect, frame: FrameMapping): DropRect {
  return {
    left: frame.left + value.left * frame.scale,
    top: frame.top + value.top * frame.scale,
    width: Math.max(value.width * frame.scale, 2),
    height: Math.max(value.height * frame.scale, 2),
  }
}

const GAP_MOTION = 'transform 180ms ease'
/** Long enough for the slide back to finish before the transition is dropped. */
const GAP_RESTORE_MS = 220

interface Hit {
  target: DropTarget
  /** The container the item lands in: the gap band, or the block list. */
  box: DropRect
  /** The exact insertion line — block drops only; a gap is its own line. */
  line: DropRect | null
  /** A section gap wears the band's tint; a list is only outlined. */
  gap: boolean
}

/** Where a point inside the frame falls among the sections it holds. */
function sectionAt(
  doc: Document,
  bounds: readonly SectionBounds[],
  chrome: PageChrome,
  point: { x: number; y: number },
): Hit {
  const at = insertionIndex(bounds, point.y)
  // The band is the width of the section it opens for — the one below, or the
  // last one when the drop is at the end — so it lines up with the column the
  // sections actually use, never a neighbour's.
  const column = bounds[at] ?? bounds[bounds.length - 1]
  const before = at > 0 ? bounds[at - 1]! : null
  const after = at < bounds.length ? bounds[at]! : null
  const boundary = before?.bottom ?? after?.top ?? point.y
  // Those two insets go into the band's position, so the gaps look the same
  // even when the neighbours pad themselves differently.
  const { above, below } = gapInsets(before, after, chrome, boundary)
  const { up, down } = gapMotion(at, bounds.length)
  const band = gapBand(above, below, up, down)
  const box: DropRect = {
    left: column?.left ?? 16,
    top: boundary + band.top,
    width: column?.width ?? Math.max(0, doc.documentElement.clientWidth - 32),
    height: band.height,
  }
  return { target: { kind: 'sections', index: at }, box, line: null, gap: true }
}

/** Where a point inside the frame falls inside one blocks container. */
function blockAt(
  container: HTMLElement,
  point: { x: number; y: number },
  sectionIds: readonly string[],
): Hit | null {
  const sectionId = container.closest<HTMLElement>('[data-section-id]')?.dataset.sectionId
  if (!sectionId || !sectionIds.includes(sectionId)) return null

  const view = container.ownerDocument.defaultView
  // A carousel's track is a grid, which has no flex direction to read, so it
  // names its axis itself.
  const declared = container.dataset.blockAxis
  const axis =
    declared === 'x' || declared === 'y'
      ? declared
      : view?.getComputedStyle(container).flexDirection?.startsWith('row')
        ? 'x'
        : 'y'
  // A slider's slides and a marquee's items wrap each block in a slot of
  // their own (`data-block-slot`); the block is one level further in.
  const children = Array.from(
    container.querySelectorAll<HTMLElement>(
      ':scope > [data-block-id], :scope > [data-block-slot] > [data-block-id]',
    ),
  )

  let index = children.length
  for (let at = 0; at < children.length; at++) {
    const rect = children[at]!.getBoundingClientRect()
    const middle = axis === 'x' ? rect.left + rect.width / 2 : rect.top + rect.height / 2
    if ((axis === 'x' ? point.x : point.y) < middle) {
      index = at
      break
    }
  }

  const box = container.getBoundingClientRect()
  const before = children[index]?.getBoundingClientRect()
  const line: DropRect =
    axis === 'x'
      ? {
          left: before ? before.left : box.right - 4,
          top: box.top + 6,
          width: 2,
          height: Math.max(24, box.height - 12),
        }
      : {
          left: box.left + 6,
          top: before ? before.top : box.bottom - 4,
          width: Math.max(24, box.width - 12),
          height: 2,
        }

  return {
    target: {
      kind: 'blocks',
      sectionId,
      parentId: container.dataset.parentId || null,
      fieldKey: container.dataset.fieldKey || 'blocks',
      index,
    },
    box: { left: box.left, top: box.top, width: box.width, height: box.height },
    line,
    gap: false,
  }
}

export function DropOverlay({
  doc,
  active,
  blocks,
  sections,
  onDrop,
}: {
  doc: Document | null
  /** Whether a palette drag is in flight. */
  active: boolean
  /** Whether the drag carries blocks (drop inside a list) or a whole section. */
  blocks: boolean
  sections: readonly SectionInstance[]
  onDrop: (target: DropTarget) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const docRef = useRef<Document | null>(null)
  docRef.current = doc
  const boundsRef = useRef<SectionBounds[] | null>(null)
  const chromeRef = useRef<PageChrome | null>(null)
  const gapAtRef = useRef<number | null>(null)
  /** Every section this drag has styled, so the gap can be taken back exactly. */
  const touchedRef = useRef<Set<string>>(new Set())
  const [marker, setMarker] = useState<{
    box: DropRect
    line: DropRect | null
    gap: boolean
  } | null>(null)

  const sectionIds = useMemo(() => sections.map((section) => section.id), [sections])

  /** Let the sections slide back and stop transitioning. */
  const closeGap = useCallback(() => {
    const target = docRef.current
    gapAtRef.current = null
    boundsRef.current = null
    chromeRef.current = null
    const touched = touchedRef.current
    touchedRef.current = new Set()
    if (!target) return
    for (const id of touched) {
      const element = closestSection(target, id)
      if (!element || !element.style.transform) continue
      element.style.transform = ''
      globalThis.setTimeout(() => {
        element.style.transition = ''
      }, GAP_RESTORE_MS)
    }
  }, [])

  // The drag can end outside the overlay (a drop on the palette, Escape): the
  // gap must close even then.
  useEffect(() => {
    if (!active) return
    return () => closeGap()
  }, [active, closeGap])

  if (!active) return null

  /** Open the gap at `at`, sliding the sections on both sides apart. */
  const openGap = (target: Document, bounds: readonly SectionBounds[], at: number) => {
    if (gapAtRef.current === at) return
    gapAtRef.current = at
    const { up, down } = gapMotion(at, bounds.length)
    for (let index = 0; index < bounds.length; index++) {
      const element = closestSection(target, bounds[index]!.id)
      if (!element) continue
      touchedRef.current.add(bounds[index]!.id)
      // Above the line moves up, below moves down — half the gap each, so the
      // space the drop opens is the same on both sides. A zero move is written
      // as "no transform", so a section returning to its place animates back
      // rather than jumping.
      const amount = index < at ? -up : down
      element.style.transition = GAP_MOTION
      element.style.transform = amount === 0 ? '' : `translateY(${amount}px)`
    }
  }

  /** The hit, in editor coordinates: iframe rects scaled through the frame. */
  const hit = (event: DragEvent): Hit | null => {
    const frame = (doc?.defaultView?.frameElement ?? null) as HTMLIFrameElement | null
    if (!doc || !frame) return null
    const rect = frame.getBoundingClientRect()
    const scale = frame.clientWidth > 0 ? rect.width / frame.clientWidth : 1
    const x = (event.clientX - rect.left) / scale
    const y = (event.clientY - rect.top) / scale
    if (x < 0 || y < 0 || x > frame.clientWidth || y > frame.clientHeight) return null
    const mapping: FrameMapping = { left: rect.left, top: rect.top, scale }

    if (blocks) {
      const element = doc.elementFromPoint(x, y)
      const container = element?.closest?.('[data-block-list]') as HTMLElement | null
      const found = container ? blockAt(container, { x, y }, sectionIds) : null
      if (found) {
        return {
          ...found,
          box: scaleRect(found.box, mapping),
          line: found.line ? scaleRect(found.line, mapping) : null,
        }
      }
    }

    const bounds = boundsRef.current ?? (boundsRef.current = sectionBounds(doc, sectionIds))
    const chrome = chromeRef.current ?? (chromeRef.current = chromeBounds(doc))
    const found = sectionAt(doc, bounds, chrome, { x, y })
    return {
      ...found,
      box: scaleRect(found.box, mapping),
      line: found.line ? scaleRect(found.line, mapping) : null,
    }
  }

  const offset = ref.current?.getBoundingClientRect() ?? { left: 0, top: 0 }
  const at = (value: DropRect): DropRect => ({
    left: value.left - offset.left,
    top: value.top - offset.top,
    width: Math.max(value.width, 2),
    height: Math.max(value.height, 2),
  })

  return (
    <Box
      ref={ref}
      position="absolute"
      inset="0"
      zIndex="20"
      cursor="copy"
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
        const found = hit(event)
        if (!found) {
          setMarker(null)
          closeGap()
          return
        }
        if (found.target.kind === 'sections' && doc) {
          openGap(doc, boundsRef.current!, found.target.index)
        } else {
          closeGap()
        }
        setMarker({ box: found.box, line: found.line, gap: found.gap })
      }}
      onDragLeave={() => {
        setMarker(null)
        closeGap()
      }}
      onDrop={(event) => {
        event.preventDefault()
        const found = hit(event)
        setMarker(null)
        closeGap()
        if (found) onDrop(found.target)
      }}
    >
      {marker && (
        <>
          {/* The container: a dashed slot for a section gap, an outline for
              the list a block lands in. It is the only mark a section drop
              needs — the space itself says where the section goes. */}
          <Box
            position="absolute"
            pointerEvents="none"
            rounded="lg"
            borderWidth="1.5px"
            borderStyle="dashed"
            borderColor="brand.solid"
            bg={marker.gap ? 'brand.subtle' : undefined}
            opacity={marker.gap ? 0.7 : 1}
            style={at(marker.box)}
          />
          {/* A block lands at an index inside a list that keeps its own
              spacing: there the line is still the precise mark. */}
          {marker.line && (
            <Box
              position="absolute"
              pointerEvents="none"
              bg="brand.solid"
              rounded="full"
              shadow="sm"
              style={at(marker.line)}
            />
          )}
        </>
      )}
    </Box>
  )
}
