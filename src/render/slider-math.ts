/**
 * The slider's arithmetic, with no React in it: shared by the React `Slider`
 * and the framework-free runtime, so both put the track in the same place.
 */

/** The room between slides, when the caller has no spacing of its own. */
export const DEFAULT_GAP = '12px'

/** How long the track takes to glide one step, and its easing. */
export const SLIDE_MS = 420
export const SLIDE_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'

/**
 * A flick keeps travelling after the finger lifts. The projection turns the
 * release speed into the distance the track coasts, and the glide is longer
 * and softer than an arrow press so several slides can pass in one gesture.
 */
export const FLING_PROJECTION_MS = 160
export const FLING_EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'
/** The fastest flick we honour, in pixels per millisecond. */
const MAX_FLING_PX_PER_MS = 3
/** Below this gesture duration the speed is event noise, not a flick. */
const MIN_FLING_MS = 16
/** Only the last stretch of the gesture decides its speed. */
export const FLING_SAMPLE_MS = 100

/**
 * How far a finger must travel before a swipe counts as a page when the
 * track cannot be measured — a snapshot, a test DOM. A measured track snaps
 * by distance instead, so a flick can cross several slides at once.
 */
export const SLIDE_SWIPE_PX = 40

/** Autoplay's beat, unless the caller sets its own. */
export const AUTOPLAY_MS = 5000

/** How long a wrap's glide is given before its jump back is taken anyway. */
export const WRAP_FALLBACK_MS = 700

/** The browser clock behind a touch gesture, in milliseconds. */
export function gestureTime(): number {
  return globalThis.performance?.now?.() ?? Date.now()
}

/**
 * The release speed of a touch gesture, in pixels per millisecond. Only the
 * final stretch counts, so a finger that stops before lifting does not fling;
 * a gesture too short to time is a tap, not a flick.
 */
export function releaseVelocity(samples: Array<{ x: number; time: number }>): number {
  if (samples.length < 2) return 0
  const last = samples[samples.length - 1]!
  const recent = samples.filter((sample) => sample.time >= last.time - FLING_SAMPLE_MS)
  const first = recent[0] ?? samples[0]!
  const elapsed = last.time - first.time
  if (elapsed < MIN_FLING_MS) return 0
  const speed = (last.x - first.x) / elapsed
  return Math.max(-MAX_FLING_PX_PER_MS, Math.min(MAX_FLING_PX_PER_MS, speed))
}

/** How long a flick of `steps` slides at `velocity` glides for. */
export function flingGlideMs(steps: number, velocity: number): number {
  return Math.min(900, SLIDE_MS + Math.max(0, Math.abs(steps) - 1) * 80 + Math.abs(velocity) * 120)
}

/** One slide's width, with the gaps between the slides taken off. */
export function sliderBasis(perPage: number, gap = DEFAULT_GAP): string {
  // Whole or fractional, the gaps counted are one short of the view — and
  // rounded to two places, so 1.2 does not print as 0.19999999999999996.
  const gaps = Math.round((perPage - 1) * 100) / 100
  return `(100% - ${gap} * ${gaps}) / ${perPage}`
}

/** One step along the track: a slide plus the gap that follows it. */
export function sliderStep(perPage: number, gap = DEFAULT_GAP): string {
  return `calc(${sliderBasis(perPage, gap)} + ${gap})`
}

/**
 * The track's transform at a position, with a finger's drag added on.
 *
 * At rest it is exactly the position's own, so the CSS in the page and the
 * first paint agree; a drag only ever adds a pixel offset, which settles back
 * to a position on release.
 */
export function sliderTransform(
  at: number,
  perPage: number,
  dragPx = 0,
  gap = DEFAULT_GAP,
  vertical = false,
): string {
  const axis = vertical ? 'Y' : 'X'
  if (at === 0 && dragPx === 0) return `translate${axis}(0)`
  return `translate${axis}(calc(${-at} * ${sliderStep(perPage, gap)} + ${dragPx}px))`
}

/** Where a slider can rest, for a view of `perPage` slides out of `count`. */
export interface SliderGeometry {
  /** `perPage`, clamped to at least one and at most the slides there are. */
  perPage: number
  /** A looped view that shows every slide still turns, one slide a step. */
  rotating: boolean
  /** The last resting position the track's shift is clamped to. */
  last: number
  /** The last position a step lands on — `last`, rounded up to a whole slide. */
  end: number
  /** There is more than one resting position. */
  paged: boolean
  /** The loop wraps by doubling the slides at each end. */
  wraps: boolean
  /** How many slides the doubles repeat at each end. */
  doubles: number
}

export function sliderGeometry(
  count: number,
  perPage: number,
  { loop, wrap }: { loop: boolean; wrap: boolean },
): SliderGeometry {
  const clamped = Math.max(1, Math.min(perPage, Math.max(1, count)))
  const rotating = loop && count > 1 && clamped >= count && wrap
  const last = rotating ? count - 1 : Math.max(0, count - clamped)
  const end = Math.ceil(last)
  const paged = last > 0
  const wraps = rotating || (loop && paged && wrap && Number.isInteger(clamped))
  return { perPage: clamped, rotating, last, end, paged, wraps, doubles: wraps ? clamped : 0 }
}
