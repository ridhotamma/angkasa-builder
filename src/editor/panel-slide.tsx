/**
 * The sidebar's horizontal slide.
 *
 * The panel is a stack of screens — the list, the add palette, a section's
 * settings, a block's settings. When the stack moves, the screen being left
 * slides out and the new one follows it in: forward from the right, back from
 * the left.
 *
 * The screen that leaves is moved into the outgoing layer as its detached DOM
 * node, not drawn again by React. A remount would reset the accordions and
 * inputs it still shows for a quarter of a second; the node React just
 * unmounted still has exactly what was on screen. It is kept outside React and
 * dropped as soon as the slide ends.
 *
 * Web Animations, like the list's reorder FLIP, and no slide at all under
 * reduced motion. Without `Element.animate` (an old browser, a test DOM) the
 * new screen simply appears.
 */

import { useLayoutEffect, useRef, type ReactNode } from 'react'

/** Long enough to read as a slide, short enough to stay out of the way. */
const SLIDE_MS = 260
/** A decelerating curve: quick off the mark, soft on arrival. */
const SLIDE_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'

function prefersReducedMotion(doc: Document): boolean {
  try {
    return doc.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? false
  } catch {
    return false
  }
}

export function PanelSlide({
  view,
  depth,
  children,
}: {
  /** Changes when the panel moves to another screen. */
  view: string
  /** How deep the screen sits; a fall in depth is a move back. */
  depth: number
  children: ReactNode
}) {
  const incoming = useRef<HTMLDivElement>(null)
  const outgoing = useRef<HTMLDivElement>(null)
  // The last committed screen, with the node React drew for it.
  const last = useRef<{ view: string; depth: number; node: HTMLElement | null }>({
    view,
    depth,
    node: null,
  })
  // Which slide owns the outgoing layer; a newer slide must not clear it.
  const generation = useRef(0)

  useLayoutEffect(() => {
    const node = incoming.current
    const layer = outgoing.current
    const previous = last.current
    last.current = { view, depth, node }
    if (!node || !layer) return

    // First render, or a re-render that stayed on the same screen: there is
    // nothing to slide.
    const from = previous.node
    if (previous.view === view || !from) return

    const reduced = prefersReducedMotion(node.ownerDocument)
    if (reduced || typeof node.animate !== 'function' || typeof layer.animate !== 'function') {
      layer.replaceChildren()
      return
    }

    // The screen behind the outgoing one, if a slide is interrupted, is no
    // longer on screen: drop it before the new incoming takes its place.
    layer.replaceChildren(from)
    layer.setAttribute('inert', '')

    // Same depth is a lateral move between two sections: treat it as forward.
    const offset = depth < previous.depth ? -100 : 100
    const options = { duration: SLIDE_MS, easing: SLIDE_EASE }
    const coming = node.animate(
      [{ transform: `translate3d(${offset}%, 0, 0)` }, { transform: 'translate3d(0, 0, 0)' }],
      options,
    )
    const going = layer.animate(
      [{ transform: 'translate3d(0, 0, 0)' }, { transform: `translate3d(${-offset}%, 0, 0)` }],
      options,
    )

    const mine = ++generation.current
    const clear = () => {
      if (generation.current === mine) layer.replaceChildren()
    }
    Promise.all([coming.finished.catch(() => null), going.finished.catch(() => null)]).then(
      clear,
      clear,
    )

    return () => {
      coming.cancel()
      going.cancel()
    }
  }, [view, depth])

  return (
    <div style={{ position: 'relative', minWidth: 0, overflowX: 'clip' }}>
      {/* Keyed: a new screen is a new node, and the old one becomes the
          outgoing layer's frozen copy. */}
      <div key={view} ref={incoming} style={{ minWidth: 0 }}>
        {children}
      </div>
      {/* Outside the flow: it sits above the incoming screen and is clipped by
          the wrapper. Empty between slides, so it never paints. */}
      <div
        ref={outgoing}
        data-panel-outgoing=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          insetInline: 0,
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
    </div>
  )
}
