/**
 * The slider everywhere: one flex row shifted by `translateX` (or `translateY`)
 * — deliberately **not** a scroll container. Nothing inside a band can be
 * wheeled, dragged or scrolled, no scrollbar can appear, and the resting
 * position is this component's own state rather than wherever a scroll
 * happened to land. A finger drags the track and it settles on release; the
 * mouse moves the slider only by its arrows, so a mouse drag belongs to the
 * page — and, in the editor, to dragging blocks.
 *
 * The band is shaped by the caller: a photo band passes `ratio` (drawn by
 * `AspectRatio`, the one form of ratio a photo cannot stretch), while card
 * rows size themselves. The edge arrows straddle the band's own edge — half
 * over the slides, half over the page margin around them — and the dots, where
 * a caller asks for them, match the banner's: the active one a pill, over the
 * band's bottom edge when the slides are pictures, or in a row under it when
 * they are content.
 *
 * A ratio band is positioned and clipped by `AspectRatio`; its overlays sit
 * beside it in a frame of the same box rather than inside it, where an arrow
 * straddling the edge would be cut in half — which is what the banner
 * slider's pair looked like. A card row keeps its overlays inside the band.
 *
 * A loop wraps by doubling: one page's worth of slides is repeated before the
 * first and after the last, so a step past either end glides into the double
 * instead of rewinding across the whole run — and the jump back onto the real
 * slide is invisible, because the double is the same picture. The doubles are
 * `inert` (no tab stop, nothing read out). The editor canvas leaves them out
 * by default, since its drop layer and outlines count and measure slides; a
 * caller whose slides are not editable blocks can opt back in with
 * `wrapInEditor`.
 */

import {
  AspectRatio,
  Box,
  Flex,
  HStack,
  IconButton,
  Stack,
  Text,
  type BoxProps,
} from '@chakra-ui/react'
import {
  Children,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ElementType,
  type ReactNode,
} from 'react'
import {
  LuChevronDown,
  LuChevronLeft,
  LuChevronRight,
  LuChevronUp,
  LuPause,
  LuPlay,
} from 'react-icons/lu'

import { useRenderEnvironment } from './context'
import { useRenderText } from './copy'

/** Round arrows laid over a slider's edges; phones swipe instead. */
export const OVERLAY_ARROW = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  zIndex: '1',
  rounded: 'full',
  size: { base: 'sm', md: 'md' },
  // The same button the rest of the shop wears — the wishlist heart and the
  // gallery's share trigger — so every floating control reads as one family.
  variant: 'surface',
  bg: 'bg/85',
  shadow: 'md',
  _hover: { bg: 'bg' },
  hideBelow: 'md',
} as const

/**
 * Props for the slider's own boxes: the Chakra styles plus the `data-*` hooks
 * the editor and the tests hang off them.
 */
export type SliderSlotProps = Omit<BoxProps, 'direction'> & Record<`data-${string}`, unknown>

/**
 * The arrow buttons take anything an `IconButton` does — a viewer, say,
 * repaints them as the shop's ink glass.
 */
export type SliderArrowProps = Omit<ComponentProps<typeof IconButton>, 'children'> &
  Record<`data-${string}`, unknown>

/** The room between slides, when the caller has no spacing of its own. */
const DEFAULT_GAP = '12px'

/** How long the track takes to glide one step, and its easing. */
const SLIDE_MS = 420
const SLIDE_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'

/**
 * A flick keeps travelling after the finger lifts. The projection turns the
 * release speed into the distance the track coasts, and the glide is longer
 * and softer than an arrow press so several slides can pass in one gesture.
 */
const FLING_PROJECTION_MS = 160
const FLING_EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'
/** The fastest flick we honour, in pixels per millisecond. */
const MAX_FLING_PX_PER_MS = 3
/** Below this gesture duration the speed is event noise, not a flick. */
const MIN_FLING_MS = 16
/** Only the last stretch of the gesture decides its speed. */
const FLING_SAMPLE_MS = 100

/**
 * How far a finger must travel before a swipe counts as a page when the
 * track cannot be measured — a snapshot, a test DOM. A measured track snaps
 * by distance instead, so a flick can cross several slides at once.
 */
const SLIDE_SWIPE_PX = 40

/** Autoplay's beat, unless the caller sets its own. */
const AUTOPLAY_MS = 5000

/**
 * How far the edge arrows sit from the band's own edge: a negative spacing,
 * so the button floats half over the slides and half over the page around
 * them — the pair the product row wears, now every slider's.
 */
const ARROW_EDGE_INSET = '-5'

/** The browser clock behind a touch gesture, in milliseconds. */
function gestureTime(): number {
  return globalThis.performance?.now?.() ?? Date.now()
}

/**
 * The release speed of a touch gesture, in pixels per millisecond. Only the
 * final stretch counts, so a finger that stops before lifting does not fling;
 * a gesture too short to time is a tap, not a flick.
 */
function releaseVelocity(samples: Array<{ x: number; time: number }>): number {
  if (samples.length < 2) return 0
  const last = samples[samples.length - 1]!
  const recent = samples.filter((sample) => sample.time >= last.time - FLING_SAMPLE_MS)
  const first = recent[0] ?? samples[0]!
  const elapsed = last.time - first.time
  if (elapsed < MIN_FLING_MS) return 0
  const speed = (last.x - first.x) / elapsed
  return Math.max(-MAX_FLING_PX_PER_MS, Math.min(MAX_FLING_PX_PER_MS, speed))
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

/** How long a wrap's glide is given before its jump back is taken anyway. */
const WRAP_FALLBACK_MS = 700

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

export interface SliderProps {
  /** The slides themselves, one element each — the slider sizes and moves them. */
  children: ReactNode
  /** How many of them there are; the slider needs the count, not the nodes. */
  count: number
  /**
   * How many stand in the view at once, already resolved for the breakpoint.
   * A fraction leaves the next slide peeking — 2.5 is half of the third — and
   * the track still settles on whole slides, the last one right-aligned.
   */
  perPage: number
  loop?: boolean
  /**
   * Keep the loop's doubles on the editor's canvas too. Off for slides that
   * are editable blocks — the drop layer and outlines count them — on for
   * slides that are plain pictures, like the banner's.
   */
  wrapInEditor?: boolean
  autoplay?: boolean
  /** Autoplay's beat in milliseconds. */
  autoplayMs?: number
  /** The pause/play button autoplay needs when it runs on its own (WCAG 2.2.2). */
  autoplayToggle?: boolean
  orientation?: 'horizontal' | 'vertical'
  /** Where the dots sit: over the band's bottom edge, or in a row under it. */
  dots?: 'inside' | 'below' | 'none'
  /** `count` swaps the dots for a `2 / 5` progress text. */
  indicator?: 'dots' | 'count'
  /** Overlay arrows; the caller turns them off when the block has none. */
  arrows?: boolean
  /**
   * Where the arrows sit: over the band's side edges, or together at the
   * bottom centre — the pair a fullscreen photo viewer wears.
   */
  arrowPlacement?: 'edges' | 'bottom'
  /**
   * Where the arrows sit, as a spacing token of their own edge. The default
   * is negative: the button straddles the edge, half over the slides and half
   * over the page margin around them.
   */
  arrowInset?: string
  /**
   * The band's own shape, for photo bands. A number pins the band to that
   * ratio; `'auto'` leaves the height to the slides themselves (a banner
   * slider follows its images). Cards size themselves instead.
   */
  ratio?: number | 'auto'
  /** A margin around the band, so a slide can peek at the edges. */
  peek?: string
  /** The room between slides. Defaults to `DEFAULT_GAP`. */
  gap?: string
  /** The slide to open on. */
  start?: number
  /** Told whenever the resting slide changes (a viewer's backdrop follows it). */
  onIndexChange?: (index: number) => void
  /** The editor's selection: the slide to hold in view, autoplay held with it. */
  active?: number
  /** The element the band wears (`section`, say). */
  as?: ElementType
  /** Extra props for the root, the band, the track, each slide and the arrows. */
  rootProps?: SliderSlotProps
  bandProps?: SliderSlotProps
  trackProps?: SliderSlotProps
  slideProps?: SliderSlotProps
  arrowProps?: SliderArrowProps
}

export function Slider({
  children,
  count,
  perPage,
  loop = false,
  wrapInEditor = false,
  autoplay = false,
  autoplayMs = AUTOPLAY_MS,
  autoplayToggle = false,
  orientation = 'horizontal',
  dots = 'none',
  indicator = 'dots',
  arrows = true,
  arrowPlacement = 'edges',
  arrowInset = ARROW_EDGE_INSET,
  ratio,
  peek,
  gap: gapProp = DEFAULT_GAP,
  start = 0,
  onIndexChange,
  active,
  as,
  rootProps,
  bandProps,
  trackProps,
  slideProps,
  arrowProps,
}: SliderProps) {
  const text = useRenderText()
  const { editing } = useRenderEnvironment()
  const vertical = orientation === 'vertical'
  const gap = gapProp
  const perPageClamped = Math.max(1, Math.min(perPage, Math.max(1, count)))
  /**
   * A looped slider whose slides all fit still moves: each step cycles the set
   * by one slide, so three visible banners rotate 1-2-3 → 2-3-1. Without this
   * a full view had no resting position but the first, and the arrows and dots
   * disappeared — the banner looked frozen at "Slides on desktop: 3".
   */
  const rotating =
    loop && count > 1 && perPageClamped >= count && (wrapInEditor || !editing)
  const last = rotating ? count - 1 : Math.max(0, count - perPageClamped)
  // A fractional view still settles on whole slides: the last position is the
  // last slide, its edge flush with the band's. A row of 2.5-a-view steps
  // 1, 2, … and ends right-aligned rather than half-cut.
  const end = Math.ceil(last)
  const paged = last > 0
  /**
   * Whether the wrap doubles the track. A rotating full view always wraps;
   * otherwise the loop wraps only for a whole-page view and never on the
   * editor's own canvas — a wrap repeats whole pages, while a fractional one
   * simply ends on its last slide.
   */
  const wraps =
    rotating ||
    (loop && paged && (wrapInEditor || !editing) && Number.isInteger(perPageClamped))
  /** How many slides the doubles repeat at each end: one page's worth. */
  const doubles = wraps ? perPageClamped : 0
  const [index, setIndex] = useState(Math.max(0, Math.min(start, end)))
  const [paused, setPaused] = useState(false)
  const [playing, setPlaying] = useState(autoplay)
  const [dragPx, setDragPx] = useState(0)
  const [dragging, setDragging] = useState(false)
  /** The transition off for the one frame a wrap's jump back takes. */
  const [snapping, setSnapping] = useState(false)
  /** A flick's own glide, or `null` for the normal arrow/dot step. */
  const [glide, setGlide] = useState<{ ms: number; ease: string } | null>(null)
  /** Steps asked for while a wrap was still gliding; taken once it lands. */
  const wanted = useRef(0)
  /** A wrap is gliding onto a double, or taking its jump back. */
  const wrapping = index < 0 || index >= count
  const busy = wrapping || snapping
  /**
   * The resting slide — or, mid-wrap, the one the wrap is landing on. A
   * fractional view's last position may sit between slides, so the shift
   * below clamps to `last` there and the row ends flush.
   */
  const at = wrapping ? (index < 0 ? end : 0) : Math.min(index, end)
  const basis = sliderBasis(perPageClamped, gap)
  // The doubles ride ahead of the slides, so the first real slide sits one
  // page into the track — and the last position pulls the track's end up
  // against the band's whenever the view is fractional.
  const rest = wrapping ? index : Math.min(index, last)
  const shift = sliderTransform(rest + doubles, perPageClamped, dragPx, gap, vertical)
  /** The finger being followed, where it started, and how fast it moved. */
  const dragFrom = useRef<{
    pointerId: number
    x: number
    samples: Array<{ x: number; time: number }>
  } | null>(null)
  /** The editor's selection holds the track still while it is set. */
  const hold = active !== undefined && active >= 0

  /**
   * Where one step past a resting position lands: on a double, or the end.
   * A flick passes its own glide length so several slides coast past instead
   * of one abrupt step.
   */
  const goTo = (to: number, glideMs?: number) => {
    setGlide(glideMs ? { ms: glideMs, ease: FLING_EASE } : null)
    if (to < 0) setIndex(wraps ? -doubles : loop ? end : 0)
    else setIndex(to > end ? (wraps ? count : loop ? 0 : end) : to)
  }

  const step = (delta: number) => {
    // Retargeting a wrap mid-glide would animate the long way round, back
    // across the run. The step waits for the jump back instead.
    if (busy) {
      wanted.current += delta
      return
    }
    goTo(index + delta)
  }

  /** A dot names a resting position; while a wrap glides, it waits with it. */
  const select = (position: number) => {
    if (busy) {
      wanted.current = position - at
      return
    }
    setIndex(position)
  }

  /** The glide onto a double has finished: the jump back, off-screen. */
  const settle = () => {
    if (!wrapping) return
    setSnapping(true)
    setIndex(at)
  }

  const endDrag = () => {
    dragFrom.current = null
    setDragging(false)
    setDragPx(0)
    setGlide(null)
  }

  /**
   * One step along the track in pixels — a slide plus the gap after it, as
   * the browser laid it out — or 0 when there is nothing to measure (a
   * snapshot, a test DOM). A drag then lands on the position nearest the
   * finger, not the one next door; 0 falls back to one page a swipe.
   */
  const stepWidth = (bandElement: Element) => {
    const first = bandElement.querySelector<HTMLElement>('[data-slider-slide]')
    const rect = first?.getBoundingClientRect()
    if (!rect) return 0
    const size = vertical ? rect.height : rect.width
    return size > 0 ? size + Number.parseFloat(gap) : 0
  }

  // The editor's selection: hold the slide it names in view while it is set.
  useEffect(() => {
    if (active === undefined || active < 0) return
    setIndex(Math.min(active, end))
  }, [active, end])

  // A resize can move the last resting position under the state, and a wrap
  // may be mid-glide when it does: land on the nearest slide, off the doubles.
  useEffect(() => {
    setIndex((current) => {
      if (current < 0) return end
      if (current >= count) return 0
      return Math.min(current, end)
    })
  }, [count, end])

  // Whoever needs to know where the track rests — a viewer's backdrop, say.
  useEffect(() => {
    onIndexChange?.(at)
  }, [at, onIndexChange])

  // The wrap landed on a double: the same pixels as the real slide, so the
  // jump back is invisible. It still needs its own frame with the transition
  // off — one for the browser to read the jumped-to position, then one to put
  // the glide back — and a step asked for mid-flight leaves from there.
  useEffect(() => {
    if (!snapping) return
    let after: number | undefined
    const landed = globalThis.requestAnimationFrame(() => {
      setSnapping(false)
      if (wanted.current === 0) return
      after = globalThis.requestAnimationFrame(() => {
        const delta = wanted.current
        wanted.current = 0
        goTo(index + delta)
      })
    })
    return () => {
      globalThis.cancelAnimationFrame(landed)
      if (after !== undefined) globalThis.cancelAnimationFrame(after)
    }
    // The frame reads the `index` and `goTo` of the render that set `snapping`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapping])

  // The jump back rides on the glide ending. Should that event never come —
  // the track inside a section hidden on this device, say — the wrap settles
  // on its own a beat later, so a step is never swallowed with no way back.
  useEffect(() => {
    if (!wrapping) return
    const timer = globalThis.setTimeout(settle, WRAP_FALLBACK_MS)
    return () => globalThis.clearTimeout(timer)
    // `settle` reads the render that started the wrap, which is this one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrapping])

  // Autoplay advances on its own; the pointer resting on the band holds it,
  // and without a loop the last slide simply stays put. A held selection (the
  // editor) holds it too, so the seller is never reading a slide that moves.
  useEffect(() => {
    if (!playing || !paged || paused || dragging || hold) return
    const timer = globalThis.setInterval(() => {
      setIndex((current) => {
        const resting = current < 0 ? end : current >= count ? 0 : Math.min(current, end)
        // A wrap still gliding lands on the next slide by itself.
        if (resting !== current) return current
        if (resting < end) return resting + 1
        return wraps ? count : loop ? 0 : resting
      })
    }, autoplayMs)
    return () => globalThis.clearInterval(timer)
  }, [playing, paged, paused, dragging, hold, end, loop, wraps, count, autoplayMs])

  const toggle = autoplayToggle && paged
  const slides = Children.toArray(children)
  /**
   * The track's slides, with the wrap's doubles: the page before the first is
   * repeated ahead of it and the first page after the last, as the very same
   * elements — so the picture the jump back leaves is the picture it lands on.
   * A rotating full view's tail starts on the last slide, so stepping back
   * from the first lands on the whole set rotated by one, too.
   */
  const tail = rotating
    ? Array.from({ length: doubles }, (_, position) => slides[(count - 1 + position) % count])
    : slides.slice(-doubles)
  const lanes = wraps
    ? [
        ...tail.map((child, position) => ({
          child,
          key: `tail-${position}`,
          double: true,
        })),
        ...slides.map((child, position) => ({ child, key: `slide-${position}`, double: false })),
        ...slides.slice(0, doubles).map((child, position) => ({
          child,
          key: `head-${position}`,
          double: true,
        })),
      ]
    : slides.map((child, position) => ({ child, key: `slide-${position}`, double: false }))

  /**
   * The controls drawn over the band. They live inside the band on a plain
   * slider; a ratio band keeps them beside it, because `AspectRatio` clips
   * everything inside the band it shapes.
   */
  const overlays = (
    <>
      {paged && arrows && arrowPlacement === 'bottom' && (
        <HStack
          position="absolute"
          insetX="0"
          // A little above the very edge, where a thumb (and the eye) expects
          // the pair to sit.
          bottom="6"
          zIndex="1"
          justifyContent="center"
          gap="3"
        >
          <IconButton
            {...OVERLAY_ARROW}
            data-slider-control=""
            position="static"
            transform="none"
            {...arrowProps}
            aria-label={text('previousSlide')}
            disabled={hold || (!loop && at === 0)}
            onClick={() => step(-1)}
          >
            <LuChevronLeft />
          </IconButton>
          <IconButton
            {...OVERLAY_ARROW}
            data-slider-control=""
            position="static"
            transform="none"
            {...arrowProps}
            aria-label={text('nextSlide')}
            disabled={hold || (!loop && at >= end)}
            onClick={() => step(1)}
          >
            <LuChevronRight />
          </IconButton>
        </HStack>
      )}
      {paged && arrows && arrowPlacement === 'edges' && (
        <>
          <IconButton
            {...OVERLAY_ARROW}
            data-slider-control=""
            {...(vertical
              ? { top: '2', left: '50%', transform: 'translateX(-50%)' }
              : { left: arrowInset })}
            {...arrowProps}
            aria-label={text('previousSlide')}
            disabled={hold || (!loop && at === 0)}
            onClick={() => step(-1)}
          >
            {vertical ? <LuChevronUp /> : <LuChevronLeft />}
          </IconButton>
          <IconButton
            {...OVERLAY_ARROW}
            data-slider-control=""
            {...(vertical
              ? { top: 'auto', bottom: '2', left: '50%', transform: 'translateX(-50%)' }
              : { right: arrowInset })}
            {...arrowProps}
            aria-label={text('nextSlide')}
            disabled={hold || (!loop && at >= end)}
            onClick={() => step(1)}
          >
            {vertical ? <LuChevronDown /> : <LuChevronRight />}
          </IconButton>
        </>
      )}
      {paged && dots === 'inside' && (
        <SliderDots count={end + 1} at={at} onSelect={select} overBand />
      )}
    </>
  )

  const band = (
    <Box
      data-slider-band=""
      // A finger slides the track, so the browser must leave the sideways
      // touches to us and keep the page's own scrolling for itself.
      touchAction={vertical ? 'pan-x' : 'pan-y'}
      overflow="hidden"
      {...(peek ? (vertical ? { py: peek } : { px: peek }) : {})}
      onPointerDown={(event) => {
        if (event.pointerType === 'mouse' || !paged) return
        const point = vertical ? event.clientY : event.clientX
        dragFrom.current = {
          pointerId: event.pointerId,
          x: point,
          samples: [{ x: point, time: gestureTime() }],
        }
        setGlide(null)
        setDragging(true)
      }}
      onPointerMove={(event) => {
        const from = dragFrom.current
        if (!from || from.pointerId !== event.pointerId) return
        const point = vertical ? event.clientY : event.clientX
        setDragPx(point - from.x)
        from.samples.push({ x: point, time: gestureTime() })
        // Keep the tail of the gesture: a finger that stops before lifting
        // should not still fling on stale speed from a second ago.
        const last = from.samples[from.samples.length - 1]!
        from.samples = from.samples.filter(
          (sample) => sample.time >= last.time - FLING_SAMPLE_MS,
        )
      }}
      onPointerUp={(event) => {
        const from = dragFrom.current
        if (!from || from.pointerId !== event.pointerId) return
        const point = vertical ? event.clientY : event.clientX
        const moved = point - from.x
        // The speed at release carries the track on, so a flick glides several
        // slides instead of stopping dead on the nearest one. A drag that stops
        // before lifting has no speed and settles by distance alone.
        const velocity = releaseVelocity([...from.samples, { x: point, time: gestureTime() }])
        endDrag()
        // A finger can cross several slides in one gesture: land on the
        // position nearest where it let go — `round` keeps a drag that stops
        // between two slides snapping to the nearer one, and a whole flick
        // reaches the card the finger travelled over, not just the next.
        const width = stepWidth(event.currentTarget)
        if (width > 0) {
          const projected = moved + velocity * FLING_PROJECTION_MS
          const steps = Math.round(-projected / width)
          if (steps !== 0) {
            const glideMs = Math.min(
              900,
              SLIDE_MS + Math.max(0, Math.abs(steps) - 1) * 80 + Math.abs(velocity) * 120,
            )
            goTo(at + steps, glideMs)
          }
          return
        }
        if (moved <= -SLIDE_SWIPE_PX) step(1)
        else if (moved >= SLIDE_SWIPE_PX) step(-1)
      }}
      onPointerCancel={endDrag}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') setPaused(true)
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') setPaused(false)
      }}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      {...bandProps}
    >
      {/* The track: as wide as the band, its slides running past the edge,
          clipped — never scrolled. While a finger drags it the transition is
          off, so it tracks the finger exactly — and so is the frame a wrap
          jumps back on, where the pixels do not move. */}
      <Flex
        data-slider-track=""
        direction={vertical ? 'column' : 'row'}
        w="full"
        h="full"
        flexShrink="0"
        gap={gap}
        transition={
          dragging || snapping
            ? 'none'
            : `transform ${glide?.ms ?? SLIDE_MS}ms ${glide?.ease ?? SLIDE_EASE}`
        }
        style={{ transform: shift }}
        onTransitionEnd={(event) => {
          if (event.target !== event.currentTarget) return
          // A child's own transition (a hover, say) ends here too; the track's
          // is the transform. Not every DOM hands the property over, though.
          if (event.propertyName && event.propertyName !== 'transform') return
          setGlide(null)
          settle()
        }}
        {...trackProps}
      >
        {lanes.map((lane) => (
          <Box
            key={lane.key}
            data-slider-slide=""
            flex={`0 0 calc(${basis})`}
            minW="0"
            minH="0"
            {...slideProps}
            // A double is the same slide again: no tab stop, nothing read out.
            {...(lane.double ? { inert: true, 'aria-hidden': true } : {})}
          >
            {lane.child}
          </Box>
        ))}
      </Flex>
      {ratio === undefined && overlays}
    </Box>
  )

  const under = paged && (dots === 'below' || indicator === 'count' || toggle) && (
    <Flex direction={vertical ? 'column' : 'row'} align="center" justify="center" gap="3">
      {toggle && (
        // Anything that moves on its own for more than five seconds needs a
        // way to stop it (WCAG 2.2.2).
        <IconButton
          data-slider-control=""
          size="2xs"
          variant="ghost"
          rounded="full"
          color="fg.muted"
          aria-label={playing ? text('pauseSlides') : text('playSlides')}
          onClick={() => setPlaying((value) => !value)}
        >
          {playing ? <LuPause /> : <LuPlay />}
        </IconButton>
      )}
      {indicator === 'count' && (
        <Text fontSize="sm" color="fg.muted" fontVariantNumeric="tabular-nums">
          {at + 1} / {end + 1}
        </Text>
      )}
      {dots === 'below' && <SliderDots count={end + 1} at={at} onSelect={select} />}
    </Flex>
  )

  // A photo band clips its slides, so the overlays sit beside it in a frame of
  // the band's own box — inside, an arrow straddling the edge would be cut in
  // half. A numeric ratio also pins the band's shape in `AspectRatio`; `auto`
  // leaves the height to the slides, so the banner follows its images.
  if (ratio !== undefined) {
    return (
      <Stack as={as} gap="3" {...rootProps}>
        <Box position="relative" data-slider-frame="">
          {typeof ratio === 'number' ? (
            <AspectRatio ratio={ratio}>{band}</AspectRatio>
          ) : (
            band
          )}
          {overlays}
        </Box>
        {under}
      </Stack>
    )
  }

  return (
    <Stack as={as} gap="3" {...rootProps}>
      {band}
      {under}
    </Stack>
  )
}

/**
 * One dot per position the track can rest at. The active one stretches into a
 * pill, so the current page reads at a glance. Over a photo the dots are
 * white with a shadow — any picture, light or dark — while under a card row
 * they wear the page's own ink, which is what stays visible on it.
 */
function SliderDots({
  count,
  at,
  onSelect,
  overBand = false,
}: {
  count: number
  at: number
  onSelect: (position: number) => void
  overBand?: boolean
}) {
  const text = useRenderText()
  // Over a photo the dots are the shop's canvas (its own warm white) with a
  // shadow; under a card row they wear the page's ink. Either way it is a
  // theme colour, never a literal one.
  const idle = overBand ? 'canvas/60' : 'fg/20'
  const hover = overBand ? 'canvas/85' : 'fg/40'
  const current = overBand ? 'canvas' : 'fg'
  return (
    <HStack
      {...(overBand ? { position: 'absolute', insetX: '0', bottom: '3', zIndex: '1' } : {})}
      justifyContent="center"
      gap="2"
    >
      {Array.from({ length: count }, (_, position) => (
        <Box
          key={position}
          as="button"
          data-slider-control=""
          w={position === at ? '6' : '2.5'}
          h="2.5"
          p="0"
          rounded="full"
          cursor="pointer"
          transition="width 220ms cubic-bezier(0.32, 0.72, 0, 1), background-color 200ms"
          bg={position === at ? current : idle}
          shadow={overBand ? 'sm' : undefined}
          _hover={{ bg: position === at ? current : hover }}
          aria-label={text('slideNumber', { n: position + 1 })}
          aria-current={position === at ? 'true' : undefined}
          onClick={() => onSelect(position)}
        />
      ))}
    </HStack>
  )
}
