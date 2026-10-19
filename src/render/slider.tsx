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
 * rows size themselves. The dots match the banner's wherever they go — the
 * active one a pill — and sit over the band's own bottom edge when the slides
 * are pictures, or in a row under it when they are content.
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
import { Children, useEffect, useRef, useState, type ElementType, type ReactNode } from 'react'
import {
  LuChevronDown,
  LuChevronLeft,
  LuChevronRight,
  LuChevronUp,
  LuPause,
  LuPlay,
} from 'react-icons/lu'

import { useRenderText } from './copy'

/** Round arrows laid over a slider's edges; phones swipe instead. */
export const OVERLAY_ARROW = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  zIndex: '1',
  rounded: 'full',
  size: { base: 'sm', md: 'md' },
  variant: 'subtle',
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

/** The room between slides, when the caller has no spacing of its own. */
const DEFAULT_GAP = '12px'

/** How long the track takes to glide one step, and its easing. */
const SLIDE_SHIFT = '420ms cubic-bezier(0.32, 0.72, 0, 1)'

/** How far a finger must travel before the swipe counts as a page. */
const SLIDE_SWIPE_PX = 40

/** Autoplay's beat, unless the caller sets its own. */
const AUTOPLAY_MS = 5000

/** One slide's width, with the gaps between the slides taken off. */
export function sliderBasis(perPage: number, gap = DEFAULT_GAP): string {
  return `(100% - ${gap} * ${perPage - 1}) / ${perPage}`
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

export interface SliderProps {
  /** The slides themselves, one element each — the slider sizes and moves them. */
  children: ReactNode
  /** How many of them there are; the slider needs the count, not the nodes. */
  count: number
  /** How many stand in the view at once (already resolved for the breakpoint). */
  perPage: number
  loop?: boolean
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
  /** Where the arrows sit, as a spacing token of their own edge. */
  arrowInset?: string
  /** The band's own shape, for photo bands. Cards size themselves instead. */
  ratio?: number
  /** A margin around the band, so a slide can peek at the edges. */
  peek?: string
  /** The slide to open on. */
  start?: number
  /** The editor's selection: the slide to hold in view, autoplay held with it. */
  active?: number
  /** The element the band wears (`section`, say). */
  as?: ElementType
  /** Extra props for the root, the band, the track and each slide's wrapper. */
  rootProps?: SliderSlotProps
  bandProps?: SliderSlotProps
  trackProps?: SliderSlotProps
  slideProps?: SliderSlotProps
}

export function Slider({
  children,
  count,
  perPage,
  loop = false,
  autoplay = false,
  autoplayMs = AUTOPLAY_MS,
  autoplayToggle = false,
  orientation = 'horizontal',
  dots = 'none',
  indicator = 'dots',
  arrows = true,
  arrowInset = '3',
  ratio,
  peek,
  start = 0,
  active,
  as,
  rootProps,
  bandProps,
  trackProps,
  slideProps,
}: SliderProps) {
  const text = useRenderText()
  const vertical = orientation === 'vertical'
  const gap = DEFAULT_GAP
  const perPageClamped = Math.max(1, Math.min(perPage, Math.max(1, count)))
  const last = Math.max(0, count - perPageClamped)
  const paged = last > 0
  const [index, setIndex] = useState(Math.max(0, Math.min(start, last)))
  const [paused, setPaused] = useState(false)
  const [playing, setPlaying] = useState(autoplay)
  const [dragPx, setDragPx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const at = Math.min(index, last)
  const basis = sliderBasis(perPageClamped, gap)
  const shift = sliderTransform(at, perPageClamped, dragPx, gap, vertical)
  /** The finger being followed, and where it started. */
  const dragFrom = useRef<{ pointerId: number; x: number } | null>(null)
  /** The editor's selection holds the track still while it is set. */
  const hold = active !== undefined && active >= 0

  const step = (delta: number) => {
    const to = at + delta
    if (to < 0) {
      setIndex(loop ? last : 0)
      return
    }
    setIndex(to > last ? (loop ? 0 : last) : to)
  }

  const endDrag = () => {
    dragFrom.current = null
    setDragging(false)
    setDragPx(0)
  }

  // The editor's selection: hold the slide it names in view while it is set.
  useEffect(() => {
    if (active === undefined || active < 0) return
    setIndex(Math.min(active, last))
  }, [active, last])

  // Autoplay advances on its own; the pointer resting on the band holds it,
  // and without a loop the last slide simply stays put. A held selection (the
  // editor) holds it too, so the seller is never reading a slide that moves.
  useEffect(() => {
    if (!playing || !paged || paused || dragging || hold) return
    const timer = globalThis.setInterval(() => {
      setIndex((current) => {
        const from = Math.min(current, last)
        if (from < last) return from + 1
        return loop ? 0 : from
      })
    }, autoplayMs)
    return () => globalThis.clearInterval(timer)
  }, [playing, paged, paused, dragging, hold, last, loop, autoplayMs])

  const toggle = autoplayToggle && paged
  const slides = Children.toArray(children)
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
        dragFrom.current = {
          pointerId: event.pointerId,
          x: vertical ? event.clientY : event.clientX,
        }
        setDragging(true)
      }}
      onPointerMove={(event) => {
        const from = dragFrom.current
        if (!from || from.pointerId !== event.pointerId) return
        setDragPx((vertical ? event.clientY : event.clientX) - from.x)
      }}
      onPointerUp={(event) => {
        const from = dragFrom.current
        if (!from || from.pointerId !== event.pointerId) return
        const moved = (vertical ? event.clientY : event.clientX) - from.x
        endDrag()
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
          off, so it tracks the finger exactly. */}
      <Flex
        data-slider-track=""
        direction={vertical ? 'column' : 'row'}
        w="full"
        h="full"
        flexShrink="0"
        gap={gap}
        transition={dragging ? 'none' : `transform ${SLIDE_SHIFT}`}
        style={{ transform: shift }}
        {...trackProps}
      >
        {slides.map((child, position) => (
          <Box key={position} flex={`0 0 calc(${basis})`} minW="0" minH="0" {...slideProps}>
            {child}
          </Box>
        ))}
      </Flex>

      {paged && arrows && (
        <>
          <IconButton
            {...OVERLAY_ARROW}
            {...(vertical
              ? { top: '2', left: '50%', transform: 'translateX(-50%)' }
              : { left: arrowInset })}
            aria-label={text('previousSlide')}
            disabled={hold || (!loop && at === 0)}
            onClick={() => step(-1)}
          >
            {vertical ? <LuChevronUp /> : <LuChevronLeft />}
          </IconButton>
          <IconButton
            {...OVERLAY_ARROW}
            {...(vertical
              ? { top: 'auto', bottom: '2', left: '50%', transform: 'translateX(-50%)' }
              : { right: arrowInset })}
            aria-label={text('nextSlide')}
            disabled={hold || (!loop && at >= last)}
            onClick={() => step(1)}
          >
            {vertical ? <LuChevronDown /> : <LuChevronRight />}
          </IconButton>
        </>
      )}

      {paged && dots === 'inside' && (
        <SliderDots count={last + 1} at={at} onSelect={setIndex} overBand />
      )}
    </Box>
  )

  const under = paged && (dots === 'below' || indicator === 'count' || toggle) && (
    <Flex direction={vertical ? 'column' : 'row'} align="center" justify="center" gap="3">
      {toggle && (
        // Anything that moves on its own for more than five seconds needs a
        // way to stop it (WCAG 2.2.2).
        <IconButton
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
          {at + 1} / {last + 1}
        </Text>
      )}
      {dots === 'below' && <SliderDots count={last + 1} at={at} onSelect={setIndex} />}
    </Flex>
  )

  return ratio === undefined ? (
    <Stack as={as} gap="3" {...rootProps}>
      {band}
      {under}
    </Stack>
  ) : (
    <AspectRatio as={as} ratio={ratio} {...rootProps}>
      {band}
    </AspectRatio>
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
  const idle = overBand ? 'white/55' : 'fg/20'
  const hover = overBand ? 'white/80' : 'fg/40'
  const current = overBand ? 'white' : 'fg'
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
