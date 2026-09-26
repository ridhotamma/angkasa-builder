/**
 * What every section is drawn inside: its style, applied.
 *
 * A section renderer draws only its content. The frame around it gives it the
 * colour scheme it picked (by overriding the semantic tokens on a band, so
 * cards and buttons inside follow), its spacing, how wide it runs, which
 * devices it shows on, and — when the theme asks for motion — how it enters as
 * the page scrolls. Keeping all of that here is what lets a new section get
 * every style option for free.
 */

import { Box, Container, type BoxProps } from '@chakra-ui/react'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

import {
  isWithinSchedule,
  readSectionStyle,
  type ResolvedSectionStyle,
  type SectionSpacing,
  type SectionWidth,
} from '../model/section-style'
import { resolveScheme, schemeCssVars, type AnimationStyle, type SchemeKey } from '../model/settings'
import { useRenderEnvironment } from './context'
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
 * page, so in dark mode — where the page is already dark — they step aside
 * and the section keeps the dark surfaces; brand and accent bands are the
 * brand's own statement and stay in both modes.
 */
function schemeCss(key: SchemeKey, vars: Record<string, string>): BoxProps['css'] {
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

export function SectionFrame({
  style: stored,
  children,
}: {
  style: FieldValues
  children: ReactNode
}) {
  const { settings } = useRenderEnvironment()
  const style = readSectionStyle(stored)
  const banded = style.scheme !== null
  const vars = style.scheme ? schemeCssVars(resolveScheme(settings, style.scheme)) : null

  const display = {
    ...(style.visibility === 'mobile' && { hideFrom: 'md' }),
    ...(style.visibility === 'desktop' && { hideBelow: 'md' }),
  } as const

  const surface: BoxProps = {
    ...(style.scheme && vars && { css: schemeCss(style.scheme, vars), bg: 'bg', color: 'fg' }),
    pt: padding(style.paddingTop, banded),
    pb: padding(style.paddingBottom, banded),
  }

  const content = (
    <SectionLayoutContext.Provider value={{ width: style.width, banded }}>
      <Reveal animation={settings.animation}>{children}</Reveal>
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
        <Container maxW="6xl" px={{ base: '4', md: '6' }}>
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
