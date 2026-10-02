/**
 * The GSAP motion engine.
 *
 * Every animated element in a page-builder section goes through here. GSAP is
 * imported lazily at runtime — a page with motion off, a server render, a
 * snapshot capture and a visitor without JavaScript never load it — and each
 * effect is created inside a `gsap.context` scoped to its own element, so
 * unmounting (or the editor swapping devices) reverts every tween and
 * ScrollTrigger the effect made.
 *
 * ScrollTrigger is scoped to the element's *own* document: the storefront's
 * window, or the editor preview's iframe. Passing that document's
 * `documentElement` as the scroller is enough for GSAP to measure it, but a
 * frame's window fires its scroll event on the document rather than the
 * root element, so the engine bridges scroll and resize back to
 * `ScrollTrigger.update()` / `refresh()`. Nothing here runs under
 * `prefers-reduced-motion: reduce`.
 */

import { useEffect, useLayoutEffect, useRef, type DependencyList, type RefObject } from 'react'

export type Gsap = typeof import('gsap').gsap
export type ScrollTriggerPlugin = typeof import('gsap/ScrollTrigger').default
export type GsapContext = ReturnType<Gsap['context']>

/** What a motion setup receives: the loaded library, ready to use. */
export interface MotionTools {
  gsap: Gsap
  ScrollTrigger: ScrollTriggerPlugin
}

/** Creates animations; the engine reverts them on unmount. May return a cleanup. */
export type MotionSetup = (motion: MotionTools) => void | (() => void)

let pending: Promise<MotionTools> | null = null

/**
 * GSAP, once per page. The imports are dynamic so bundlers code-split the
 * library and server rendering never touches it.
 */
export function loadMotion(): Promise<MotionTools> {
  pending ??= (async () => {
    const [{ gsap }, { default: ScrollTrigger }] = await Promise.all([
      import('gsap'),
      import('gsap/ScrollTrigger'),
    ])
    gsap.registerPlugin(ScrollTrigger)
    return { gsap, ScrollTrigger }
  })()
  return pending
}

let refreshTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Re-measure every ScrollTrigger, debounced. Called when a document's
 * resources land and when the editor redraws sections, so a trigger's
 * start/end never strands where they were before an image or an edit.
 */
export function requestMotionRefresh(delay = 120): void {
  if (!pending) return
  if (refreshTimer !== null) clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => {
    refreshTimer = null
    void pending?.then(({ ScrollTrigger }) => ScrollTrigger.refresh())
  }, delay)
}

/** Frames whose scroll and resize events are bridged back to ScrollTrigger. */
const bridged = new WeakSet<Window>()

function bridgeWindow(ScrollTrigger: ScrollTriggerPlugin, view: Window): void {
  // The top window is ScrollTrigger's natural scroller: it listens already.
  if (view === globalThis.window || bridged.has(view)) return
  bridged.add(view)
  const doc = view.document
  const update = () => ScrollTrigger.update()
  const refresh = () => requestMotionRefresh()
  view.addEventListener('scroll', update, { passive: true })
  view.addEventListener('resize', refresh)
  // Resource load events (images, fonts) do not bubble, so this listens in
  // the capture phase at the document — enough to re-measure once a late
  // image has taken its space.
  doc.addEventListener('load', refresh, true)
  void doc.fonts?.ready.then(refresh).catch(() => undefined)
}

/**
 * The root margin a below-fold reveal waits behind: the usual bottom tenth
 * gives the entrance room to breathe, but the page's final section may only
 * ever appear inside that last tenth — waiting there would strand it — so
 * such an element gets no margin at all.
 */
export function revealRootMargin(view: Window, element: HTMLElement, fraction = 0.1): string {
  const margin = view.innerHeight * fraction
  const scroller = element.ownerDocument.scrollingElement
  const maxScroll = Math.max(0, (scroller?.scrollHeight ?? 0) - view.innerHeight)
  const top = element.getBoundingClientRect().top + view.scrollY
  if (top > maxScroll + view.innerHeight - margin) return '0px'
  return `0px 0px -${Math.round(margin)}px 0px`
}

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/**
 * Runs `setup` once the element is live and motion is welcome, inside a
 * context scoped to the element. Does nothing on the server, when the
 * shopper prefers reduced motion, or when GSAP cannot be loaded — the page
 * simply renders its final state, which is what it starts with.
 *
 * `setup` may return a cleanup for listeners and observers GSAP cannot know
 * about; it runs when the context reverts.
 */
export function useMotionEffect(
  scope: RefObject<HTMLElement | null>,
  setup: MotionSetup,
  deps: DependencyList,
): void {
  const setupRef = useRef(setup)
  setupRef.current = setup

  useIsomorphicLayoutEffect(() => {
    const element = scope.current
    const view = element?.ownerDocument.defaultView
    if (!element || !view) return
    if (view.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let cancelled = false
    let context: GsapContext | null = null
    void loadMotion()
      .then((motion) => {
        if (cancelled) return
        const target = scope.current
        if (!target) return
        bridgeWindow(motion.ScrollTrigger, view)
        context = motion.gsap.context(() => setupRef.current(motion), target)
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
      context?.revert()
    }
    // The caller owns the dependency list, like any effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
