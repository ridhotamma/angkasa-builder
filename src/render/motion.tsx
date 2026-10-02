/**
 * Scroll- and pointer-driven motion primitives, built on GSAP.
 *
 * Every primitive follows the `Reveal` contract in `frame.tsx`: the
 * server-rendered HTML always shows the final state, and only content that is
 * below the fold when the page comes alive waits to animate. GSAP is loaded
 * lazily through `motion/engine`, effects are scoped to the element's own
 * document (the preview iframe's, in the editor), and a shopper who asks
 * their device for less motion gets none of it. Pointer effects additionally
 * stand down on touch screens.
 */

import { Box, Flex, type BoxProps } from '@chakra-ui/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { revealRootMargin, useMotionEffect } from './motion/engine'

/**
 * Whether the shopper asked their device for less motion. Server-safe:
 * `false` until an effect reads the media query.
 */
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
 * Words rising into place behind a mask, staggered word by word by a GSAP
 * timeline. The mask is a touch taller than the line so descenders are never
 * clipped, and the words are in the HTML whether or not the tween ever runs.
 */
export function SplitText({ text, ...props }: { text: string } & BoxProps) {
  const ref = useRef<HTMLDivElement>(null)

  useMotionEffect(
    ref,
    ({ gsap }) => {
      const element = ref.current
      const view = element?.ownerDocument.defaultView
      if (!element || !view) return
      // A window with no height yet (an iframe still being sized) has no fold.
      if (view.innerHeight === 0) return
      if (element.getBoundingClientRect().top < view.innerHeight * 0.9) return

      const words = element.querySelectorAll<HTMLElement>('[data-split-word]')
      if (words.length === 0) return
      gsap.set(words, { yPercent: 110 })
      const timeline = gsap.timeline({ paused: true }).to(words, {
        yPercent: 0,
        duration: 0.7,
        ease: 'power3.out',
        stagger: 0.04,
      })
      const observer = new view.IntersectionObserver(
        ([entry]) => {
          if (!entry?.isIntersecting) return
          timeline.play()
          observer.disconnect()
        },
        { rootMargin: revealRootMargin(view, element), threshold: 0.2 },
      )
      observer.observe(element)
      return () => observer.disconnect()
    },
    [],
  )

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
            <Box as="span" display="inline-block" data-split-word="">
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
 * leave, its position tweened by `gsap.quickTo`. Pointers only: touch
 * screens and reduced motion get the child as-is.
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

  useMotionEffect(
    ref,
    ({ gsap }) => {
      const element = ref.current
      const view = element?.ownerDocument.defaultView
      if (!element || !view) return
      if (view.matchMedia('(pointer: coarse)').matches) return

      const xTo = gsap.quickTo(element, 'x', { duration: 0.5, ease: 'power3.out' })
      const yTo = gsap.quickTo(element, 'y', { duration: 0.5, ease: 'power3.out' })
      const onMove = (event: PointerEvent) => {
        const rect = element.getBoundingClientRect()
        xTo((event.clientX - (rect.left + rect.width / 2)) * strength)
        yTo((event.clientY - (rect.top + rect.height / 2)) * strength)
      }
      const onLeave = () => {
        xTo(0)
        yTo(0)
      }
      element.addEventListener('pointermove', onMove)
      element.addEventListener('pointerleave', onLeave)
      return () => {
        element.removeEventListener('pointermove', onMove)
        element.removeEventListener('pointerleave', onLeave)
      }
    },
    [strength],
  )

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

  useMotionEffect(
    ref,
    ({ gsap }) => {
      const element = ref.current
      const view = element?.ownerDocument.defaultView
      if (!element || !view) return
      if (view.matchMedia('(pointer: coarse)').matches) return

      gsap.set(element, { transformPerspective: 900, transformStyle: 'preserve-3d' })
      const rotateX = gsap.quickTo(element, 'rotationX', { duration: 0.45, ease: 'power3.out' })
      const rotateY = gsap.quickTo(element, 'rotationY', { duration: 0.45, ease: 'power3.out' })
      const onMove = (event: PointerEvent) => {
        const rect = element.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) return
        const px = (event.clientX - rect.left) / rect.width - 0.5
        const py = (event.clientY - rect.top) / rect.height - 0.5
        rotateY(px * max * 2)
        rotateX(-py * max * 2)
      }
      const onLeave = () => {
        rotateX(0)
        rotateY(0)
      }
      element.addEventListener('pointermove', onMove)
      element.addEventListener('pointerleave', onLeave)
      return () => {
        element.removeEventListener('pointermove', onMove)
        element.removeEventListener('pointerleave', onLeave)
      }
    },
    [max],
  )

  return (
    <Box ref={ref} willChange="transform" {...props}>
      {children}
    </Box>
  )
}

/**
 * A dot and a trailing ring following the pointer, growing over anything
 * clickable — `gsap.quickTo` gives the dot its snap and the ring its lag.
 * The native cursor stays — hiding it strands touch-converted and assistive
 * pointers — so this is jewellery, never a replacement. Mounted by the
 * storefront shell, never in the editor.
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

  useMotionEffect(
    dotRef,
    ({ gsap }) => {
      const dot = dotRef.current
      const ring = ringRef.current
      const view = dot?.ownerDocument.defaultView
      if (!dot || !ring || !view) return

      gsap.set([dot, ring], { xPercent: -50, yPercent: -50, x: -100, y: -100, opacity: 0 })
      const dotX = gsap.quickTo(dot, 'x', { duration: 0.18, ease: 'power2.out' })
      const dotY = gsap.quickTo(dot, 'y', { duration: 0.18, ease: 'power2.out' })
      const ringX = gsap.quickTo(ring, 'x', { duration: 0.5, ease: 'power2.out' })
      const ringY = gsap.quickTo(ring, 'y', { duration: 0.5, ease: 'power2.out' })

      let shown = false
      let hot = false
      const onMove = (event: PointerEvent) => {
        if (!shown) {
          shown = true
          gsap.to([dot, ring], { opacity: 1, duration: 0.3, overwrite: true })
        }
        dotX(event.clientX)
        dotY(event.clientY)
        ringX(event.clientX)
        ringY(event.clientY)
        const nextHot = Boolean(
          (event.target as HTMLElement | null)?.closest?.(
            'a, button, [role="button"], input, select, textarea',
          ),
        )
        if (nextHot !== hot) {
          hot = nextHot
          gsap.to(ring, {
            scale: hot ? 1.7 : 1,
            duration: 0.3,
            ease: 'power2.out',
            overwrite: true,
          })
        }
      }
      const onLeave = () => {
        shown = false
        gsap.to([dot, ring], { opacity: 0, duration: 0.2, overwrite: true })
      }
      view.addEventListener('pointermove', onMove, { passive: true })
      view.document.documentElement.addEventListener('pointerleave', onLeave)
      return () => {
        view.removeEventListener('pointermove', onMove)
        view.document.documentElement.removeEventListener('pointerleave', onLeave)
      }
    },
    [on],
  )

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
      />
    </Box>
  )
}

/**
 * A seamless loop whose pace follows the page's scroll velocity: resting at
 * `speed` pixels per second, quickening as the shopper scrolls, easing back
 * after — GSAP's tween is retimed, never restarted, so speeding up never
 * jumps. Copies of the row are measured into place (at least two, more on
 * wide screens or after fonts load), and the loop wraps at exactly half the
 * track.
 *
 * Reduced motion, phones aside, gets a static centred row instead — and so
 * does a page without JavaScript.
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
  const reduced = usePrefersReducedMotion()

  useMotionEffect(
    outerRef,
    ({ gsap }) => {
      const outer = outerRef.current
      const track = trackRef.current
      const view = outer?.ownerDocument.defaultView
      if (!outer || !track || !view) return

      const tween =
        direction === 'right'
          ? gsap.fromTo(
              track,
              { xPercent: -50 },
              { xPercent: 0, duration: 10, ease: 'none', repeat: -1 },
            )
          : gsap.to(track, { xPercent: -50, duration: 10, ease: 'none', repeat: -1 })

      // Enough pairs to cover twice the viewport: the loop wraps at half.
      const measure = () => {
        const count = Math.max(1, track.children.length)
        const single = track.scrollWidth / count
        if (!(single > 0)) return
        const need = Math.max(2, Math.ceil((view.innerWidth * 2.2) / single))
        const even = need % 2 === 0 ? need : need + 1
        if (even !== count) setCopies(even)
        tween.duration(track.scrollWidth / 2 / Math.max(1, speed))
      }
      measure()

      // A late image or webfont re-sets every width; re-fill once it lands.
      const resize = new view.ResizeObserver(measure)
      resize.observe(track)
      view.addEventListener('resize', measure)
      void view.document.fonts?.ready.then(measure).catch(() => undefined)

      // Pixels per millisecond of scrolling, smoothed into a pace boost: a
      // fast flick quickens the loop, stillness eases it back to rest.
      let boost = 0
      let lastY = view.scrollY
      let lastT = view.performance.now()
      const onScroll = () => {
        const now = view.performance.now()
        const instant = Math.abs(view.scrollY - lastY) / Math.max(16, now - lastT)
        lastY = view.scrollY
        lastT = now
        boost = Math.max(boost, Math.min(2.5, instant / 4))
      }
      const tick = (_time: number, deltaTime: number) => {
        boost *= Math.exp(-deltaTime / 220)
        tween.timeScale(1 + boost)
      }
      view.addEventListener('scroll', onScroll, { passive: true })
      gsap.ticker.add(tick)

      // Offscreen rows cost nothing, and a hovered row holds still to read.
      let visible = true
      let hovered = false
      const rest = () => tween.paused(!visible || hovered)
      const intersection =
        'IntersectionObserver' in view
          ? new view.IntersectionObserver(([entry]) => {
              visible = Boolean(entry?.isIntersecting)
              rest()
            })
          : null
      intersection?.observe(outer)
      const onEnter = () => {
        hovered = true
        rest()
      }
      const onLeave = () => {
        hovered = false
        rest()
      }
      outer.addEventListener('pointerenter', onEnter)
      outer.addEventListener('pointerleave', onLeave)

      return () => {
        resize.disconnect()
        view.removeEventListener('resize', measure)
        view.removeEventListener('scroll', onScroll)
        gsap.ticker.remove(tick)
        intersection?.disconnect()
        outer.removeEventListener('pointerenter', onEnter)
        outer.removeEventListener('pointerleave', onLeave)
      }
    },
    [reduced, speed, direction],
  )

  if (reduced) {
    return (
      <Flex wrap="wrap" justify="center" gap={gap} {...props}>
        {children}
      </Flex>
    )
  }

  return (
    <Box ref={outerRef} overflow="hidden" w="full" minW="0" {...props}>
      <Flex ref={trackRef} data-marquee="track" w="max-content" gap={gap} willChange="transform">
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
