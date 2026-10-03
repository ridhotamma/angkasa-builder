/**
 * The drop layer over the preview iframe.
 *
 * While something is dragged from the add palette, a transparent box covers
 * the preview. The browser's drag events land on this box, and the drop is
 * hit-tested against the **iframe's own DOM** with `elementFromPoint` — the
 * one way to drag from the editor's document into the frame. What is found
 * decides where the item lands: between sections, or inside a block list at a
 * precise index, with a line drawn where it will go.
 */

import { Box } from '@chakra-ui/react'
import { useMemo, useRef, useState, type DragEvent } from 'react'

import type { SectionInstance } from '../model/content'

export type DropTarget =
  | { kind: 'sections'; index: number }
  | {
      kind: 'blocks'
      sectionId: string
      parentId: string | null
      fieldKey: string
      index: number
    }

interface Marker {
  left: number
  top: number
  width: number
  height: number
}

interface Hit {
  target: DropTarget
  /** In viewport coordinates, already scaled out of the iframe. */
  marker: Marker
}

function closestSection(doc: Document, id: string): HTMLElement | null {
  // Ids are the editor's own (letters, digits, `-`, `_`), so no escaping needed.
  return doc.querySelector<HTMLElement>(`[data-section-id="${id}"]`)
}

/** Where a point inside the frame falls among the sections it holds. */
function sectionAt(
  doc: Document,
  point: { x: number; y: number },
  sectionIds: readonly string[],
): Hit | null {
  const element = doc.elementFromPoint(point.x, point.y)
  const hit = element?.closest?.('[data-section-id]') as HTMLElement | null

  const first = sectionIds[0] ? closestSection(doc, sectionIds[0]) : null
  if (!hit) {
    // Above the first section (the header, or the page's top padding): start.
    const top = first?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY
    return point.y < top
      ? {
          target: { kind: 'sections', index: 0 },
          marker: { left: 0, top: point.y, width: 0, height: 2 },
        }
      : null
  }

  const id = hit.dataset.sectionId ?? ''
  const index = sectionIds.indexOf(id)
  const rect = hit.getBoundingClientRect()
  const after = point.y > rect.top + rect.height / 2
  // The header and footer are not in the list: dropping on one adds at the
  // nearest end.
  const at = index < 0 ? (point.y < rect.top + rect.height / 2 ? 0 : sectionIds.length) : after ? index + 1 : index
  return {
    target: { kind: 'sections', index: at },
    marker: { left: rect.left, top: after ? rect.bottom : rect.top, width: rect.width, height: 2 },
  }
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
  const axis = view?.getComputedStyle(container).flexDirection?.startsWith('row') ? 'x' : 'y'
  const children = Array.from(
    container.querySelectorAll<HTMLElement>(':scope > [data-block-id]'),
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
  const marker: Marker =
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
    marker,
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
  const [marker, setMarker] = useState<Marker | null>(null)
  const sectionIds = useMemo(() => sections.map((section) => section.id), [sections])

  if (!active) return null

  const hit = (event: DragEvent): Hit | null => {
    const frame = (doc?.defaultView?.frameElement ?? null) as HTMLIFrameElement | null
    if (!doc || !frame) return null
    const rect = frame.getBoundingClientRect()
    const scale = frame.clientWidth > 0 ? rect.width / frame.clientWidth : 1
    const x = (event.clientX - rect.left) / scale
    const y = (event.clientY - rect.top) / scale
    if (x < 0 || y < 0 || x > frame.clientWidth || y > frame.clientHeight) return null

    const element = doc.elementFromPoint(x, y)
    const container = blocks
      ? (element?.closest?.('[data-block-list]') as HTMLElement | null)
      : null
    const found =
      (container ? blockAt(container, { x, y }, sectionIds) : null) ??
      sectionAt(doc, { x, y }, sectionIds)
    if (!found) return null
    return {
      target: found.target,
      marker: {
        left: rect.left + found.marker.left * scale,
        top: rect.top + found.marker.top * scale,
        width: Math.max(found.marker.width * scale, 2),
        height: Math.max(found.marker.height * scale, 2),
      },
    }
  }

  const offset = ref.current?.getBoundingClientRect() ?? { left: 0, top: 0 }

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
        setMarker(found?.marker ?? null)
      }}
      onDragLeave={() => setMarker(null)}
      onDrop={(event) => {
        event.preventDefault()
        const found = hit(event)
        setMarker(null)
        if (found) onDrop(found.target)
      }}
    >
      {marker && (
        <Box
          position="absolute"
          pointerEvents="none"
          bg="brand.solid"
          rounded="full"
          shadow="sm"
          style={{
            left: marker.left - offset.left,
            top: marker.top - offset.top,
            width: marker.width,
            height: marker.height,
          }}
        />
      )}
    </Box>
  )
}
