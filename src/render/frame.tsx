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
import { createContext, useContext, useRef, type ReactNode } from 'react'

import { ImageWithFallback } from '@repo/theme'

import {
  isWithinSchedule,
  readSectionStyle,
  resolveEntrance,
  type EntrancePreset,
  type ResolvedSectionStyle,
  type SectionHeadline,
  type SectionSpacing,
  type SectionWidth,
} from '../model/section-style'
import { resolveScheme, schemeCssVars, type SchemeKey } from '../model/settings'
import { useRenderEnvironment } from './context'
import { PANEL_PX, PATTERNS, SectionDivider, surfacePaint } from './dividers'
import { BackgroundVideo } from './media'
import { revealRootMargin, useMotionEffect } from './motion/engine'
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

export function SectionFrame({
  style: stored,
  children,
}: {
  style: FieldValues
  children: ReactNode
}) {
  const { settings, imageUrl } = useRenderEnvironment()
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

  const entrance = resolveEntrance(settings.animation, style)

  // A photo background may also be a video's poster.
  const poster =
    paint.media?.imageId != null && paint.media.imageId !== ''
      ? imageUrl(paint.media.imageId, { width: 1920, height: 1080 })
      : null

  const surface: BoxProps = {
    position: style.sticky ? 'sticky' : 'relative',
    ...(style.sticky && { top: '0', zIndex: 1 }),
    ...(style.scheme && vars && { css: schemeCss(style.scheme, vars), color: 'fg' }),
    ...(paint.bg && { bg: paint.bg }),
    ...(paint.backgroundImage && { backgroundImage: paint.backgroundImage }),
    ...(style.textShadow && {
      css: {
        ...(style.scheme && vars ? (schemeCss(style.scheme, vars) as object) : {}),
        textShadow: '0 1px 14px rgba(0, 0, 0, 0.45)',
      },
      color: style.scheme ? 'fg' : undefined,
    }),
    pt: padding(style.paddingTop, banded),
    pb: padding(style.paddingBottom, banded),
  }

  const pattern = paint.pattern
  const shade =
    paint.overlay === 'light'
      ? 'blackAlpha.300'
      : paint.overlay === 'dark'
        ? 'blackAlpha.600'
        : paint.overlay === 'strong'
          ? 'blackAlpha.700'
          : null

  const content = (
    <SectionLayoutContext.Provider value={{ width: style.width, banded, headline: style.headline }}>
      <HeadlineContext.Provider value={style.headline}>
        {/* The photo or video layer, under the shade, the pattern and the words. */}
        {paint.media && (paint.media.video || poster) && (
          <Box position="absolute" inset={0} overflow="hidden" zIndex={0} pointerEvents="none">
            {paint.media.video ? (
              <BackgroundVideo video={paint.media.video} poster={poster} />
            ) : (
              <ImageWithFallback
                src={poster ?? undefined}
                alt=""
                w="full"
                h="full"
                objectFit="cover"
                loading="lazy"
              />
            )}
          </Box>
        )}
        {paint.media && shade && (
          <Box position="absolute" inset={0} pointerEvents="none" zIndex={0} bg={shade} />
        )}
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
        <Reveal entrance={entrance} stagger={style.stagger}>
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

/**
 * Fades — and, when the entrance says so, lifts, zooms, blurs, settles — a
 * section as it scrolls into view, tweened by GSAP.
 *
 * Nothing is ever hidden in the server-rendered HTML: a section starts
 * visible, and only one that is *below the fold* when the page comes alive is
 * tucked away to be revealed. So the first screen never flashes, a page
 * without JavaScript shows everything, and a shopper who asks the system for
 * less motion gets none.
 */
function Reveal({
  entrance,
  stagger = false,
  children,
}: {
  entrance: EntrancePreset | null
  stagger?: boolean
  children: ReactNode
}) {
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
    <Box ref={ref} data-stagger={stagger || undefined} position="relative" zIndex={1}>
      {children}
    </Box>
  )
}
