/**
 * Scroll-driven motion primitives.
 *
 * Every primitive follows the `Reveal` contract in `frame.tsx`: the
 * server-rendered HTML always shows the final state, and only content that is
 * below the fold when the page comes alive waits to animate — via an
 * `IntersectionObserver` on the element's own document (the preview iframe's,
 * in the editor). No JavaScript, no observer, or `prefers-reduced-motion`
 * shows everything statically. Pointer effects additionally stand down on
 * touch screens.
 */

import { Box, Flex, type BoxProps } from '@chakra-ui/react'
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'

export type EnterState = 'static' | 'waiting' | 'shown'

function ownerView(element: HTMLElement | null): Window | null {
  return element?.ownerDocument.defaultView ?? null
}

/** Whether the shopper asked their device for less motion. Server-safe: `false`. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const view = globalThis.window
    if (!view || !('matchMedia' in view)) return
    const query = view.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(query.matches)
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/**
 * Has an element entered: `static` when already on screen, `waiting` while
 * tucked below the fold, `shown` once seen. Primitives render their final
 * state for `static` and animate from `waiting` to `shown`.
 */
export function useEnterState(ref: RefObject<HTMLElement | null>): EnterState {
  const [state, setState] = useState<EnterState>('static')
  useEffect(() => {
    const element = ref.current
    const view = element?.ownerDocument.defaultView
    if (!element || !view || !('IntersectionObserver' in view)) return
    if (view.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // A window with no height yet (an iframe still being sized) has no fold
    // to be below; everything would wait and never be shown.
    if (view.innerHeight === 0) return
    if (element.getBoundingClientRect().top < view.innerHeight * 0.9) return

    setState('waiting')
    const observer = new view.IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        setState('shown')
        observer.disconnect()
      },
      { threshold: 0.2 },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return state
}

const EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'

/**
 * Words rising into place behind a mask, staggered by word. The mask is a
 * touch taller than the line so descenders are never clipped.
 */
export function SplitText({ text, ...props }: { text: string } & BoxProps) {
  const ref = useRef<HTMLDivElement>(null)
  const state = useEnterState(ref)
  const shown = state !== 'waiting'

  return (
    <Box ref={ref} as="span" {...props}>
      {text.split(/(\s+)/).map((word, index) =>
        word === '' || /^\s+$/.test(word) ? (
          <span key={index}>{word}</span>
        ) : (
          <Box
            key={index}
            as="span"
            display="inline-block"
            overflow="hidden"
            verticalAlign="bottom"
            pb="0.09em"
            mb="-0.09em"
          >
            <Box
              as="span"
              display="inline-block"
              transform={shown ? 'translateY(0)' : 'translateY(110%)'}
              transition={shown ? `transform 700ms ${EASING}` : undefined}
              transitionDelay={state === 'shown' ? `${Math.min(index, 24) * 40}ms` : '0ms'}
            >
              {word}
            </Box>
          </Box>
        ),
      )}
    </Box>
  )
}

/**
 * A wrapper that leans its child toward the pointer and springs back on
 * leave. Pointers only: touch screens and reduced motion get the child as-is.
 */
export function Magnetic({
  children,
  strength = 0.35,
  ...props
}: {
  children: ReactNode
  /** How far the child follows, as a share of the pointer's offset. */
  strength?: number
} & BoxProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = ref.current
    const view = ownerView(element)
    if (!element || !view || !('matchMedia' in view)) return
    if (view.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (view.matchMedia('(pointer: coarse)').matches) return

    let x = 0
    let y = 0
    let targetX = 0
    let targetY = 0
    let frame = 0
    let inside = false

    const render = () => {
      x += (targetX - x) * 0.2
      y += (targetY - y) * 0.2
      if (!inside && Math.abs(targetX - x) < 0.1 && Math.abs(targetY - y) < 0.1) {
        element.style.transform = ''
        frame = 0
        return
      }
      element.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`
      frame = view.requestAnimationFrame(render)
    }
    const kick = () => {
      if (!frame) frame = view.requestAnimationFrame(render)
    }
    const onMove = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect()
      targetX = (event.clientX - (rect.left + rect.width / 2)) * strength
      targetY = (event.clientY - (rect.top + rect.height / 2)) * strength
      inside = true
      kick()
    }
    const onLeave = () => {
      targetX = 0
      targetY = 0
      inside = false
      kick()
    }
    element.addEventListener('pointermove', onMove)
    element.addEventListener('pointerleave', onLeave)
    return () => {
      element.removeEventListener('pointermove', onMove)
      element.removeEventListener('pointerleave', onLeave)
      if (frame) view.cancelAnimationFrame(frame)
      element.style.transform = ''
    }
  }, [strength])

  return (
    <Box ref={ref} display="inline-block" willChange="transform" {...props}>
      {children}
    </Box>
  )
}

/**
 * A card leaning toward the pointer in 3D, easing flat on leave. Subtle by
 * default — a few degrees read as tactile, more reads as a toy.
 */
export function Tilt({
  children,
  max = 7,
  ...props
}: {
  children: ReactNode
  /** Maximum lean in degrees, each way. */
  max?: number
} & BoxProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = ref.current
    const view = element?.ownerDocument.defaultView
    if (!element || !view || !('matchMedia' in view)) return
    if (view.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (view.matchMedia('(pointer: coarse)').matches) return

    const onMove = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      const px = (event.clientX - rect.left) / rect.width - 0.5
      const py = (event.clientY - rect.top) / rect.height - 0.5
      element.style.transform = `rotateY(${(px * max * 2).toFixed(2)}deg) rotateX(${(-py * max * 2).toFixed(2)}deg)`
    }
    const onLeave = () => {
      element.style.transform = ''
    }
    element.addEventListener('pointermove', onMove)
    element.addEventListener('pointerleave', onLeave)
    return () => {
      element.removeEventListener('pointermove', onMove)
      element.removeEventListener('pointerleave', onLeave)
      element.style.transform = ''
    }
  }, [max])

  return (
    <Box ref={ref} style={{ perspective: '900px' }} {...props}>
      <Box transition="transform 160ms ease-out" transformStyle="preserve-3d" h="full">
        {children}
      </Box>
    </Box>
  )
}

/**
 * A dot and a trailing ring following the pointer, growing over anything
 * clickable. The native cursor stays — hiding it strands touch-converted and
 * assistive pointers — so this is jewellery, never a replacement. Mounted by
 * the storefront shell, never in the editor.
 */
export function CursorFollower() {
  const [on, setOn] = useState(false)
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const view = globalThis.window
    if (!view || !('matchMedia' in view)) return
    if (view.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (view.matchMedia('(pointer: coarse)').matches) return
    setOn(true)
  }, [])

  useEffect(() => {
    if (!on) return
    const dot = dotRef.current
    const ring = ringRef.current
    const view = dot?.ownerDocument.defaultView
    if (!dot || !ring || !view) return

    let x = -100
    let y = -100
    let dotX = -100
    let dotY = -100
    let ringX = -100
    let ringY = -100
    let hot = false
    let seen = false
    let raf = 0

    const place = (element: HTMLElement, px: number, py: number, scale: number) => {
      element.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) translate(-50%, -50%) scale(${scale})`
    }
    const loop = () => {
      raf = view.requestAnimationFrame(loop)
      dotX += (x - dotX) * 0.4
      dotY += (y - dotY) * 0.4
      ringX += (x - ringX) * 0.16
      ringY += (y - ringY) * 0.16
      place(dot, dotX, dotY, 1)
      place(ring, ringX, ringY, hot ? 1.7 : 1)
    }
    const onMove = (event: PointerEvent) => {
      x = event.clientX
      y = event.clientY
      if (!seen) {
        seen = true
        dot.style.opacity = '1'
        ring.style.opacity = '1'
        raf = view.requestAnimationFrame(loop)
      }
      const target = event.target as HTMLElement | null
      hot = Boolean(target?.closest?.('a, button, [role="button"], input, select, textarea'))
    }
    const onLeave = () => {
      seen = false
      dot.style.opacity = '0'
      ring.style.opacity = '0'
      view.cancelAnimationFrame(raf)
      raf = 0
    }
    view.addEventListener('pointermove', onMove, { passive: true })
    view.document.documentElement.addEventListener('pointerleave', onLeave)
    return () => {
      view.removeEventListener('pointermove', onMove)
      view.document.documentElement.removeEventListener('pointerleave', onLeave)
      view.cancelAnimationFrame(raf)
    }
  }, [on])

  if (!on) return null
  return (
    <Box aria-hidden position="fixed" inset="0" zIndex="tooltip" pointerEvents="none">
      <Box
        ref={dotRef}
        position="absolute"
        top="0"
        left="0"
        boxSize="1.5"
        rounded="full"
        bg="brand.solid"
        opacity="0"
      />
      <Box
        ref={ringRef}
        position="absolute"
        top="0"
        left="0"
        boxSize="7"
        rounded="full"
        borderWidth="1.5px"
        borderColor="brand.solid"
        opacity="0"
        transition="opacity 200ms ease"
      />
    </Box>
  )
}

/**
 * A seamless loop whose pace follows the page's scroll velocity: resting at
 * `speed` pixels per second, quickening as the shopper scrolls, easing back
 * after. Position integrates continuously, so speeding up never jumps —
 * unlike retiming a CSS animation mid-flight.
 *
 * Copies of the row are measured into place (at least two, more on wide
 * screens or after fonts load), and the loop wraps at exactly half the
 * track. Reduced motion, phones aside, gets a static centred row instead —
 * and so does a page without JavaScript.
 */
export function VelocityMarquee({
  speed = 45,
  direction = 'left',
  gap = '2rem',
  children,
  ...props
}: {
  /** Resting pace in pixels per second. */
  speed?: number
  direction?: 'left' | 'right'
  gap?: BoxProps['gap']
  children: ReactNode
} & Omit<BoxProps, 'gap'>) {
  const outerRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [copies, setCopies] = useState(2)
  const copiesRef = useRef(2)
  // Loop state in refs: re-measuring (copies change, resize, fonts) must
  // never reset the position mid-flight.
  const halfRef = useRef(0)
  const posRef = useRef<number | null>(null)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    if (reduced) return
    const outer = outerRef.current
    const track = trackRef.current
    const view = outer?.ownerDocument.defaultView
    if (!outer || !track || !view) return

    // Enough pairs to cover twice the viewport: the loop wraps at half.
    const fill = () => {
      const single = track.scrollWidth / copiesRef.current
      if (!(single > 0)) return
      const need = Math.max(2, Math.ceil((view.innerWidth * 2.2) / single))
      const even = need % 2 === 0 ? need : need + 1
      if (even !== copiesRef.current) {
        copiesRef.current = even
        setCopies(even)
      }
      halfRef.current = track.scrollWidth / 2
    }
    fill()
    view.addEventListener('resize', fill)
    // Web fonts arriving late re-set every width; re-fill once they land.
    const fonts = view.document.fonts
    if (fonts) void fonts.ready.then(fill)

    let raf = 0
    let lastY = view.scrollY
    let lastT = view.performance.now()
    let smooth = 0
    let paused = false
    let visible = true
    if (posRef.current === null) posRef.current = direction === 'left' ? 0 : -halfRef.current

    const loop = (now: number) => {
      raf = 0
      const half = halfRef.current
      if (visible && !paused && half > 0 && posRef.current !== null) {
        const dt = Math.min(100, Math.max(0, now - lastT))
        // Pixels per millisecond, smoothed: a fast flick quickens the loop
        // up to 3.5×, stillness eases it back to its resting pace.
        const instant = Math.abs(view.scrollY - lastY) / Math.max(1, dt)
        smooth += (Math.min(2.5, instant / 4) - smooth) * 0.08
        const pace = speed * (1 + smooth)
        let pos = posRef.current + ((direction === 'left' ? -1 : 1) * pace * dt) / 1000
        if (pos <= -half) pos += half
        if (pos > 0) pos -= half
        posRef.current = pos
        track.style.transform = `translate3d(${pos.toFixed(1)}px, 0, 0)`
      }
      lastY = view.scrollY
      lastT = now
      // Offscreen rows cost nothing: the observer below restarts the loop.
      if (visible) raf = view.requestAnimationFrame(loop)
    }
    const kick = () => {
      if (!raf) raf = view.requestAnimationFrame(loop)
    }

    const observer =
      'IntersectionObserver' in view
        ? new view.IntersectionObserver(([entry]) => {
            visible = Boolean(entry?.isIntersecting)
            kick()
          })
        : null
    observer?.observe(outer)
    const onEnter = () => {
      paused = true
    }
    const onLeave = () => {
      paused = false
      kick()
    }
    outer.addEventListener('pointerenter', onEnter)
    outer.addEventListener('pointerleave', onLeave)
    kick()
    return () => {
      view.removeEventListener('resize', fill)
      observer?.disconnect()
      outer.removeEventListener('pointerenter', onEnter)
      outer.removeEventListener('pointerleave', onLeave)
      if (raf) view.cancelAnimationFrame(raf)
    }
  }, [reduced, speed, direction, copies])

  if (reduced) {
    return (
      <Flex wrap="wrap" justify="center" gap={gap} {...props}>
        {children}
      </Flex>
    )
  }

  return (
    <Box ref={outerRef} overflow="hidden" w="full" minW="0" {...props}>
      <Flex ref={trackRef} w="max-content" gap={gap} willChange="transform">
        {Array.from({ length: copies }).map((_, index) => (
          // One flat row per copy: keys stay unique inside each, and only
          // the first copy reads out to assistive tech.
          <Box key={index} display="contents" aria-hidden={index > 0 || undefined}>
            {children}
          </Box>
        ))}
      </Flex>
    </Box>
  )
}
