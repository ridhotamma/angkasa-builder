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
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'

import type { EntrancePreset } from '../model/section-style'
import { loadMotion, revealRootMargin, useMotionEffect } from './motion/engine'

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
 * A card leaning toward the pointer in 3D, easing flat on leave. Returns a ref
 * to attach to the card element itself — never a wrapper — so the tilt can
 * never change the card's box in the layout. A no-op when disabled, under
 * reduced motion, or on a touch pointer (there is nothing to lean toward).
 */
export function useTilt(enabled: boolean, max = 7): RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = ref.current
    const view = element?.ownerDocument.defaultView
    if (!enabled || !element || !view) return
    if (view.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (view.matchMedia('(pointer: coarse)').matches) return

    let cancelled = false
    let revert: (() => void) | undefined
    void loadMotion()
      .then(({ gsap }) => {
        const target = ref.current
        if (cancelled || !target) return
        const context = gsap.context(() => {
          // Perspective only, never `preserve-3d`: a shared 3D space lifts the
          // card's own picture and badges onto separate planes, which fights its
          // `overflow: hidden` clipping and rounding. The lean reads the same.
          gsap.set(target, { transformPerspective: 900 })
          const rotateX = gsap.quickTo(target, 'rotationX', { duration: 0.45, ease: 'power3.out' })
          const rotateY = gsap.quickTo(target, 'rotationY', { duration: 0.45, ease: 'power3.out' })
          const onMove = (event: PointerEvent) => {
            const rect = target.getBoundingClientRect()
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
          target.addEventListener('pointermove', onMove)
          target.addEventListener('pointerleave', onLeave)
          return () => {
            target.removeEventListener('pointermove', onMove)
            target.removeEventListener('pointerleave', onLeave)
          }
        }, target)
        revert = () => context.revert()
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
      revert?.()
    }
  }, [enabled, max])

  return ref
}

/**
 * Fades — and, when the entrance says so, lifts, zooms, blurs, settles — an
 * element as it scrolls into view, tweened by GSAP. Shared by sections and
 * blocks: a section reveals as one band, a block steps out on its own.
 *
 * Nothing is ever hidden in the server-rendered HTML: an element starts
 * visible, and only one that is *below the fold* when the page comes alive is
 * tucked away to be revealed. So the first screen never flashes, a page
 * without JavaScript shows everything, and a shopper who asks the system for
 * less motion gets none.
 */
export function ScrollReveal({
  entrance,
  stagger = false,
  children,
  ...props
}: {
  entrance: EntrancePreset | null
  /** Cascade an element's children instead of animating it as one. */
  stagger?: boolean
  children: ReactNode
} & BoxProps) {
  const ref = useRef<HTMLDivElement>(null)

  useMotionEffect(
    ref,
    ({ gsap }) => {
      const element = ref.current
      const view = element?.ownerDocument.defaultView
      if (!entrance || !element || !view) return
      // A window with no height yet (an iframe still being sized) has no fold
      // to be below; everything would be tucked away and never come back.
      if (view.innerHeight === 0) return
      if (element.getBoundingClientRect().top < view.innerHeight * 0.9) return

      const targets = stagger ? Array.from(element.children) : [element]
      if (targets.length === 0) return

      gsap.set(targets, {
        opacity: entrance.opacity,
        y: entrance.y,
        scale: entrance.scale,
        ...(entrance.blur > 0 && { filter: `blur(${entrance.blur}px)` }),
      })
      const images = entrance.imageScale !== 1 ? element.querySelectorAll('img') : []
      if (images.length > 0) gsap.set(images, { scale: entrance.imageScale })

      const timeline = gsap.timeline({ paused: true })
      timeline.to(
        targets,
        {
          opacity: 1,
          y: 0,
          scale: 1,
          ...(entrance.blur > 0 && { filter: 'blur(0px)' }),
          duration: entrance.duration,
          ease: entrance.ease,
          stagger: entrance.stagger,
        },
        entrance.delay,
      )
      if (images.length > 0) {
        timeline.to(
          images,
          { scale: 1, duration: Math.max(entrance.duration, 1.2), ease: 'power2.out' },
          entrance.delay,
        )
      }

      element.dataset.reveal = 'waiting'
      const observer = new view.IntersectionObserver(
        ([entry]) => {
          if (!entry?.isIntersecting) return
          element.dataset.reveal = 'shown'
          timeline.play()
          observer.disconnect()
        },
        { rootMargin: revealRootMargin(view, element) },
      )
      observer.observe(element)
      return () => observer.disconnect()
    },
    [entrance?.key, stagger],
  )

  if (!entrance) return <>{children}</>

  return (
    <Box ref={ref} data-stagger={stagger || undefined} position="relative" zIndex={1} {...props}>
      {children}
    </Box>
  )
}

/**
 * A block drifting against the page as it scrolls — the parallax a freeform
 * tool offers, as one token. Travel is vertical only, so layout and
 * horizontal overflow are untouched; reduced motion and no JavaScript show
 * the block in its natural place.
 */
export function Parallax({
  amount,
  children,
  ...props
}: {
  /** Pixels travelled each way across the viewport. */
  amount: number
  children: ReactNode
} & BoxProps) {
  const ref = useRef<HTMLDivElement>(null)

  useMotionEffect(
    ref,
    ({ gsap }) => {
      const element = ref.current
      const view = element?.ownerDocument.defaultView
      if (!element || !view || amount === 0 || view.innerHeight === 0) return
      gsap.fromTo(
        element,
        { y: amount },
        {
          y: -amount,
          ease: 'none',
          scrollTrigger: {
            trigger: element,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        },
      )
    },
    [amount],
  )

  return (
    <Box ref={ref} data-parallax="" willChange="transform" {...props}>
      {children}
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
