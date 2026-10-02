/**
 * Scroll-driven motion primitives.
 *
 * Every primitive follows the `Reveal` contract in `frame.tsx`: the
 * server-rendered HTML always shows the final state, and only content that is
 * below the fold when the page comes alive waits to animate — via an
 * `IntersectionObserver` on the element's own document (the preview iframe's,
 * in the editor). No JavaScript, no observer, or `prefers-reduced-motion`
 * shows everything statically.
 */

import { Box, Text, type BoxProps, type TextProps } from '@chakra-ui/react'
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useLocale } from '@repo/i18n'

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

function formatCount(value: number, decimals: number, tag: string): string {
  return new Intl.NumberFormat(tag, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/**
 * A number counting up to `value` on entry. The final value is in the HTML —
 * snapshots, readers and no-JS shoppers see it — and only a below-fold,
 * motion-ok entry animates from zero.
 */
export function CountUp({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  duration = 1400,
  ...props
}: {
  value: number
  decimals?: number
  prefix?: string
  suffix?: string
  /** How long the count runs, in milliseconds. */
  duration?: number
} & TextProps) {
  const { locale } = useLocale()
  const ref = useRef<HTMLParagraphElement>(null)
  const state = useEnterState(ref)
  const [display, setDisplay] = useState(value)

  useEffect(() => {
    if (state !== 'shown') return
    const view = ownerView(ref.current)
    if (!view) return
    let frame = 0
    const start = view.performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      // Ease-out expo: fast out of the gate, settling on the number.
      setDisplay(t === 1 ? value : value * (1 - Math.pow(2, -10 * t)))
      if (t < 1) frame = view.requestAnimationFrame(tick)
    }
    frame = view.requestAnimationFrame(tick)
    return () => view.cancelAnimationFrame(frame)
  }, [state, value, duration])

  const tag = locale === 'id' ? 'id-ID' : 'en-US'
  return (
    <Text ref={ref} as="span" fontVariantNumeric="tabular-nums" {...props}>
      {prefix}
      {formatCount(state === 'waiting' ? 0 : display, decimals, tag)}
      {suffix}
    </Text>
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
