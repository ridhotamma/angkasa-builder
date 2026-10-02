/**
 * What every section is drawn inside: its style, applied.
 *
 * A section renderer draws only its content. The frame around it gives it the
 * colour scheme it picked (by overriding the semantic tokens on a band, so
 * cards and buttons inside follow), its spacing, how wide it runs, which
 * devices it shows on, and — when the theme asks for motion — how it enters as
 * the page scrolls.
 *
 * Extended with premium visuals (docs/PREMIUM-VISUALS.md):
 * - Surface textures (gradients and pattern overlays)
 * - Section shape dividers (top/bottom SVG transitions)
 * - Per-section motion overrides
 */

import { Box, Container, type BoxProps } from '@chakra-ui/react'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

import {
  isWithinSchedule,
  readSectionStyle,
  type ResolvedSectionStyle,
  type SectionHeadline,
  type SectionMotion,
  type SectionSpacing,
  type SectionWidth,
} from '../model/section-style'
import {
  resolveScheme,
  schemeCssVars,
  type AnimationStyle,
  type SchemeKey,
} from '../model/settings'
import { useRenderEnvironment } from './context'
import { PANEL_PX, PATTERNS, SectionDivider, surfacePaint } from './dividers'
import { FullBleed, HeadlineContext } from './primitives'
import type { FieldValues } from '../model/fields'

const PADDING: Record<Exclude<SectionSpacing, 'auto'>, BoxProps['py']> = {
  none: '0',
  sm: { base: '6', md: '8' },
  md: { base: '10', md: '14' },
  lg: { base: '14', md: '20' },
  xl: { base: '20', md: '28' },
}

/**
 * "Automatic" spacing: none on the page's own background, where the gap
 * between sections already separates them, and a comfortable band inside a
 * scheme — a coloured band with its text touching the edge looks broken.
 */
function padding(spacing: SectionSpacing, banded: boolean): BoxProps['py'] {
  if (spacing === 'auto') return banded ? PADDING.md : PADDING.none
  return PADDING[spacing]
}

/**
 * The scheme's variables. Soft and dark bands are designed against a light
 * page, so in dark mode they step aside and the section keeps the dark
 * surfaces; brand and accent bands stay in both modes.
 */
export function schemeCss(key: SchemeKey, vars: Record<string, string>): BoxProps['css'] {
  if (key === 'brand' || key === 'accent') return vars
  return { 'html:not(.dark) &': vars }
}

export function useSectionStyle(style: FieldValues): ResolvedSectionStyle {
  return readSectionStyle(style)
}

/**
 * How the frame placed the section, for a renderer whose look depends on it:
 * a banner edge to edge loses its rounded corners, one inside a coloured band
 * needs no background of its own.
 */
const SectionLayoutContext = createContext<{
  width: SectionWidth
  banded: boolean
  headline: SectionHeadline
}>({
  width: 'contained',
  banded: false,
  headline: 'none',
})

export function useSectionLayout() {
  return useContext(SectionLayoutContext)
}

/** Whether the storefront draws the section at all, judged at the environment's `now`. */
export function isSectionScheduledIn(style: FieldValues, now: Date): boolean {
  return isWithinSchedule(readSectionStyle(style), now)
}

/**
 * How the section enters: its own motion when set, otherwise the theme's.
 * `slide-up` reads as the theme's subtle entrance — the frame only knows the
 * theme's two.
 */
function resolveAnimation(theme: AnimationStyle, motion: SectionMotion): AnimationStyle {
  if (motion === 'none') return 'none'
  if (motion === 'expressive') return 'expressive'
  if (motion === 'subtle' || motion === 'slide-up') return 'subtle'
  return theme
}

export function SectionFrame({
  style: stored,
  children,
}: {
  style: FieldValues
  children: ReactNode
}) {
  const { settings } = useRenderEnvironment()
  const style = readSectionStyle(stored)
  const banded = style.scheme !== null || style.backgroundType !== 'default'
  const scheme = style.scheme ? resolveScheme(settings, style.scheme) : null
  const vars = scheme ? schemeCssVars(scheme) : null
  // The section's paint, mirrored by its dividers so they can never mismatch
  // it — scheme, gradient, pattern or plain page alike.
  const paint = surfacePaint(style)

  const display = {
    ...(style.visibility === 'mobile' && { hideFrom: 'md' }),
    ...(style.visibility === 'desktop' && { hideBelow: 'md' }),
  } as const

  const animation = resolveAnimation(settings.animation, style.motion)
  // Staggering implies an entrance: a section that opted out of motion still
  // needs the reveal wrapper for its blocks to cascade through.
  const reveal = style.stagger && animation === 'none' ? 'subtle' : animation

  const surface: BoxProps = {
    position: 'relative',
    ...(style.scheme && vars && { css: schemeCss(style.scheme, vars), color: 'fg' }),
    ...(paint.bg && { bg: paint.bg }),
    ...(paint.backgroundImage && { backgroundImage: paint.backgroundImage }),
    pt: padding(style.paddingTop, banded),
    pb: padding(style.paddingBottom, banded),
  }

  const pattern = paint.pattern

  const content = (
    <SectionLayoutContext.Provider
      value={{ width: style.width, banded, headline: style.headline }}
    >
      <HeadlineContext.Provider value={style.headline}>
        {pattern !== 'none' && (
          <Box
            position="absolute"
            inset={0}
            pointerEvents="none"
            zIndex={0}
            css={PATTERNS[pattern]}
          />
        )}
        {style.dividerTop !== 'none' && (
          <SectionDivider
            shape={style.dividerTop}
            position="top"
            paint={paint}
            contained={style.width === 'contained'}
          />
        )}
        <Reveal animation={reveal} stagger={style.stagger}>
          {children}
        </Reveal>
        {style.dividerBottom !== 'none' && (
          <SectionDivider
            shape={style.dividerBottom}
            position="bottom"
            paint={paint}
            contained={style.width === 'contained'}
          />
        )}
      </HeadlineContext.Provider>
    </SectionLayoutContext.Provider>
  )

  if (style.width === 'edge') {
    return (
      <FullBleed {...display} {...surface}>
        {content}
      </FullBleed>
    )
  }

  if (style.width === 'full') {
    return (
      <FullBleed {...display} {...surface}>
        {/* The page's own column, inside a band that runs edge to edge. The
            padding matches the storefront shell's, so a band's content lines
            up with the sections around it. */}
        <Container maxW="6xl" px={{ base: '4', md: '6' }} position="relative">
          {content}
        </Container>
      </FullBleed>
    )
  }

  // Page width: a band is a rounded panel in the column, padded on all sides.
  return (
    <Box {...display} {...surface} {...(banded && { rounded: 'l3', px: PANEL_PX })}>
      {content}
    </Box>
  )
}

/* -------------------------------------------------------------------------- */
/* Scroll reveal                                                              */
/* -------------------------------------------------------------------------- */

const HIDDEN: Record<Exclude<AnimationStyle, 'none'>, BoxProps['css']> = {
  subtle: { opacity: 0, transform: 'translateY(16px)' },
  expressive: {
    opacity: 0,
    transform: 'translateY(48px) scale(0.98)',
    '& img': { transform: 'scale(1.06)' },
  },
}

const DURATION: Record<Exclude<AnimationStyle, 'none'>, string> = {
  subtle: '600ms',
  expressive: '900ms',
}

/**
 * Fades — and, when expressive, lifts and settles — a section as it scrolls
 * into view.
 *
 * Nothing is ever hidden in the server-rendered HTML: a section starts
 * visible, and only one that is *below the fold* when the page comes alive is
 * tucked away to be revealed. So the first screen never flashes, a page
 * without JavaScript shows everything, and a shopper who asks the system for
 * less motion gets none.
 */
/**
 * Per-child entrance delays for a staggered section, up to ten blocks — more
 * than that enter with the last delay. Only ever behind `no-preference`, so
 * reduced motion never cascades.
 */
function staggerDelays(): Record<string, { animationDelay: string }> {
  return Object.fromEntries(
    Array.from({ length: 10 }, (_, index) => [
      `&[data-reveal="shown"][data-stagger="true"] > *:nth-child(${index + 1})`,
      { animationDelay: `${index * 70}ms` },
    ]),
  )
}

function Reveal({
  animation,
  stagger = false,
  children,
}: {
  animation: AnimationStyle
  stagger?: boolean
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'static' | 'waiting' | 'shown'>('static')

  useEffect(() => {
    const element = ref.current
    const view = element?.ownerDocument.defaultView
    if (animation === 'none' || !element || !view || !('IntersectionObserver' in view)) return
    if (view.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // A window with no height yet (an iframe still being sized) has no fold
    // to be below; everything would be tucked away and never come back.
    if (view.innerHeight === 0) return

    const top = element.getBoundingClientRect().top
    if (top < view.innerHeight * 0.9) return // already on screen: leave it be

    setState('waiting')
    const observer = new view.IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        setState('shown')
        observer.disconnect()
      },
      { rootMargin: '0px 0px -10% 0px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [animation])

  if (animation === 'none') return <>{children}</>

  const easing = 'cubic-bezier(0.22, 1, 0.36, 1)'
  const duration = DURATION[animation]

  return (
    <Box
      ref={ref}
      data-reveal={state}
      data-stagger={stagger || undefined}
      position="relative"
      zIndex={1}
      css={{
        transition: `opacity ${duration} ${easing}, transform ${duration} ${easing}`,
        '& img': { transition: `transform 1400ms ${easing}` },
        '&[data-reveal="waiting"]': HIDDEN[animation],
        '@media (prefers-reduced-motion: no-preference)': {
          '&[data-reveal="shown"][data-stagger="true"] > *': {
            animationName: 'pb-section-rise',
            animationDuration: '600ms',
            animationTimingFunction: easing,
            animationFillMode: 'both',
          },
          ...staggerDelays(),
        },
        '@keyframes pb-section-rise': {
          from: { opacity: 0, transform: 'translateY(18px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
      }}
    >
      {children}
    </Box>
  )
}
