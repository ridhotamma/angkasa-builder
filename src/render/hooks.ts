/**
 * Browser-facing hooks the sections share.
 *
 * Every one of them reads the window through the render environment rather
 * than the global, because the editor's preview is an iframe: a media query
 * or a scroll position read from the editor's own window describes the
 * dashboard, not the phone-sized page being previewed.
 */

import { useChakraContext, useMediaQuery } from '@chakra-ui/react'
import { useEffect, useRef, useState, type RefObject } from 'react'

import { useRenderEnvironment } from './context'

/** Chakra's hook wants the global window's type; an iframe's window is the same shape. */
type WindowGetter = (() => Window & typeof globalThis) | undefined

type Breakpoint = 'sm' | 'md' | 'lg' | 'xl'
const BREAKPOINT_ORDER: readonly Breakpoint[] = ['sm', 'md', 'lg', 'xl']

type Responsive<T> = { base: T } & Partial<Record<Breakpoint, T>>

/**
 * A value per breakpoint, like Chakra's `useBreakpointValue`, but measured
 * in the preview's window. Starts at `base` on the server and on the first
 * client render, so hydration matches.
 */
export function useResponsive<T>(values: Responsive<T>): T {
  const { getWindow } = useRenderEnvironment()
  // The system's own breakpoints, so this agrees with every responsive style prop.
  const system = useChakraContext()
  const minimum = (key: Breakpoint) =>
    system.breakpoints.values.find((breakpoint) => breakpoint.name === key)?.min ?? '0px'
  const keys = BREAKPOINT_ORDER.filter((key) => values[key] !== undefined)
  const matches = useMediaQuery(
    keys.map((key) => `(min-width: ${minimum(key)})`),
    { getWindow: getWindow as WindowGetter, ssr: true, fallback: keys.map(() => false) },
  )
  let value = values.base
  keys.forEach((key, index) => {
    if (matches[index]) value = values[key] as T
  })
  return value
}

export function usePrefersReducedMotion(): boolean {
  const { getWindow } = useRenderEnvironment()
  const [reduced] = useMediaQuery(['(prefers-reduced-motion: reduce)'], {
    getWindow: getWindow as WindowGetter,
    ssr: true,
    fallback: [false],
  })
  return reduced ?? false
}

/** `false` on the server and on the first client render; `true` once the page is live. */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted
}

/**
 * Whether `ref` is on screen, observed in the element's own window — so it
 * works inside the editor's iframe. `once` stops watching after the first
 * time it shows up.
 */
export function useInView<T extends Element>(
  options: { once?: boolean; rootMargin?: string; threshold?: number } = {},
): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)
  const { once = false, rootMargin = '0px', threshold = 0 } = options

  useEffect(() => {
    const element = ref.current
    const view = element?.ownerDocument.defaultView
    if (!element || !view || !('IntersectionObserver' in view)) {
      setInView(true)
      return
    }
    const observer = new view.IntersectionObserver(
      ([entry]) => {
        if (!entry) return
        setInView(entry.isIntersecting)
        if (entry.isIntersecting && once) observer.disconnect()
      },
      { rootMargin, threshold },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [once, rootMargin, threshold])

  return [ref, inView]
}

/**
 * The current time, ticking every `intervalMs` once the page is live. On the
 * server and at hydration it is the environment's `now`, so a countdown's
 * first paint matches the HTML it hydrates.
 */
export function useNow(intervalMs: number): Date {
  const { now } = useRenderEnvironment()
  const [time, setTime] = useState(() => now ?? new Date())
  useEffect(() => {
    setTime(new Date())
    const timer = setInterval(() => setTime(new Date()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return time
}
