/**
 * FLIP for section reordering.
 *
 * The editor is fully controlled: a reorder is a new `sections` array, and by
 * the time React has committed it the browser has already laid the old order
 * out. To make the swap read as a slide — in the section list and in the
 * preview — each element is measured before and after the commit and animated
 * from its old offset to its new one with the Web Animations API, which works
 * inside the preview iframe as well as in the editor's own document.
 *
 * Positions are stored **document-relative**, not viewport-relative: the list
 * and the preview both scroll, and a stored viewport rect would go stale the
 * moment somebody scrolled between the last commit and the reorder.
 *
 * The caller keeps the returned positions for the next call: `previous` is
 * where each element was at the last commit, so only an element that actually
 * moved is animated.
 */

/** A document-relative position, scroll-proof. */
export interface FlipPoint {
  left: number
  top: number
}

export type SectionRects = Map<string, FlipPoint>

export interface FlipOptions {
  /** The attribute the elements carry, e.g. `data-section-id`. */
  attribute: string
  /** `false` only records the new positions — used when nothing reordered. */
  animate?: boolean
  duration?: number
}

function measure(element: HTMLElement): FlipPoint {
  const rect = element.getBoundingClientRect()
  const view = element.ownerDocument.defaultView
  return { left: rect.left + (view?.scrollX ?? 0), top: rect.top + (view?.scrollY ?? 0) }
}

function prefersReducedMotion(doc: Document | null): boolean {
  try {
    return doc?.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? false
  } catch {
    return false
  }
}

function ownerDocumentOf(root: ParentNode): Document | null {
  const node = root as Node
  return node.ownerDocument ?? (node as unknown as Document) ?? null
}

/**
 * Measure every `ids` element under `root` and slide it from its previous
 * position. Returns the positions just measured, for the next call.
 */
export function flipElements(
  root: ParentNode | null,
  ids: readonly string[],
  previous: SectionRects,
  { attribute, animate = true, duration = 240 }: FlipOptions,
): SectionRects {
  const next: SectionRects = new Map()
  if (!root) return next

  const doc = ownerDocumentOf(root)
  const reduced = prefersReducedMotion(doc)

  for (const id of ids) {
    const element = root.querySelector<HTMLElement>(`[${attribute}="${id}"]`)
    if (!element) continue

    // A previous FLIP may still be settling. Its stored point is where the
    // element will land — its layout has not moved, only its transform — so a
    // quiet update keeps that instead of measuring a mid-animation offset.
    const running =
      typeof element.getAnimations === 'function' && element.getAnimations().length > 0
    if (!animate && running) {
      const kept = previous.get(id)
      if (kept) next.set(id, kept)
      continue
    }
    // Reordering over a settling one: snap it to its end before measuring, so
    // the new animation starts from the real layout.
    if (running) {
      for (const animation of element.getAnimations()) animation.cancel()
    }

    const after = measure(element)
    next.set(id, after)

    if (!animate || reduced || typeof element.animate !== 'function') continue
    const before = previous.get(id)
    if (!before) continue

    const dx = before.left - after.left
    const dy = before.top - after.top
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue

    element.animate(
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
      { duration, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
    )
  }

  return next
}

/** Whether the order of `ids` changed for any element that was already there. */
export function orderMoved(
  ids: readonly string[],
  previousIndexes: ReadonlyMap<string, number>,
): boolean {
  return ids.some((id, index) => {
    const before = previousIndexes.get(id)
    return before !== undefined && before !== index
  })
}
