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
  type BackgroundGradient,
  type BackgroundPattern,
  type ResolvedSectionStyle,
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
import { SectionDivider } from './dividers'
import { FullBleed } from './primitives'
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
const SectionLayoutContext = createContext<{ width: SectionWidth; banded: boolean }>({
  width: 'contained',
  banded: false,
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

/** A new gradient is one entry here; the type in `model/section-style` keeps it total. */
const GRADIENTS: Record<BackgroundGradient, string> = {
  'subtle-warm': 'linear-gradient(180deg, transparent 0%, rgba(251, 146, 60, 0.08) 100%)',
  'subtle-cool': 'linear-gradient(180deg, transparent 0%, rgba(59, 130, 246, 0.08) 100%)',
  sunset: 'linear-gradient(135deg, rgba(234, 88, 12, 0.12) 0%, rgba(219, 39, 119, 0.1) 100%)',
  ocean: 'linear-gradient(135deg, rgba(14, 165, 233, 0.12) 0%, rgba(20, 184, 166, 0.1) 100%)',
  'radial-glow': 'radial-gradient(circle at 50% 50%, rgba(234, 88, 12, 0.1) 0%, transparent 70%)',
  mesh: 'radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.12) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(244, 63, 94, 0.12) 0px, transparent 50%)',
}

/** Patterns draw in the section's own text colour at a low opacity. */
const PATTERNS: Record<Exclude<BackgroundPattern, 'none'>, BoxProps['css']> = {
  dots: {
    backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)',
    backgroundSize: '16px 16px',
    opacity: 0.12,
  },
  grid: {
    backgroundImage:
      'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
    backgroundSize: '24px 24px',
    opacity: 0.07,
  },
  stripes: {
    backgroundImage:
      'repeating-linear-gradient(45deg, transparent, transparent 10px, currentColor 10px, currentColor 11px)',
    opacity: 0.06,
  },
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
  // A divider is filled with the section's own background, so it carves the
  // transition out of the neighbouring section. Without a scheme that is the
  // page background, the divider's default.
  const dividerColor = scheme?.background

  const display = {
    ...(style.visibility === 'mobile' && { hideFrom: 'md' }),
    ...(style.visibility === 'desktop' && { hideBelow: 'md' }),
  } as const

  const animation = resolveAnimation(settings.animation, style.motion)

  const surface: BoxProps = {
    position: 'relative',
    ...(style.scheme && vars && { css: schemeCss(style.scheme, vars), bg: 'bg', color: 'fg' }),
    ...(style.backgroundType === 'gradient' && {
      backgroundImage: GRADIENTS[style.backgroundGradient],
    }),
    pt: padding(style.paddingTop, banded),
    pb: padding(style.paddingBottom, banded),
  }

  const pattern = style.backgroundPattern

  const content = (
    <SectionLayoutContext.Provider value={{ width: style.width, banded }}>
      {style.backgroundType === 'pattern' && pattern !== 'none' && (
        <Box
          position="absolute"
          inset={0}
          pointerEvents="none"
          zIndex={0}
          css={PATTERNS[pattern]}
        />
      )}
      {style.dividerTop !== 'none' && (
        <SectionDivider shape={style.dividerTop} position="top" color={dividerColor} />
      )}
      <Reveal animation={animation}>{children}</Reveal>
      {style.dividerBottom !== 'none' && (
        <SectionDivider shape={style.dividerBottom} position="bottom" color={dividerColor} />
      )}
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
    <Box
      {...display}
      {...surface}
      {...(banded && { rounded: 'l3', px: { base: '5', md: '10' } })}
    >
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
function Reveal({ animation, children }: { animation: AnimationStyle; children: ReactNode }) {
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
      position="relative"
      zIndex={1}
      css={{
        transition: `opacity ${duration} ${easing}, transform ${duration} ${easing}`,
        '& img': { transition: `transform 1400ms ${easing}` },
        '&[data-reveal="waiting"]': HIDDEN[animation],
      }}
    >
      {children}
    </Box>
  )
}
