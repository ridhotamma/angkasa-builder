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
import type { ReactNode } from 'react'

import { ImageWithFallback } from '@repo/theme'
import { SECTION_STAGGER_ENABLED, SECTION_TEXT_SHADOW_ENABLED } from '@repo/appwrite-config'

import {
  isWithinSchedule,
  readSectionStyle,
  resolveEntrance,
  type ResolvedSectionStyle,
  type SectionSpacing,
} from '../model/section-style'
import { resolveScheme, schemeCssVars, type SchemeKey } from '../model/settings'
import { useRenderEnvironment } from './context'
import {
  PANEL_PX,
  PATTERNS,
  SectionDivider,
  surfacePaint,
  surfaceShade,
  type SurfacePaint,
} from './dividers'
import type { SectionBackground } from './section-background'
import { BackgroundVideo } from './media'
import { ScrollReveal } from './motion'
import { FullBleed, HeadlineContext } from './primitives'
import { SectionLayoutContext } from './section-layout'
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

/** Whether the storefront draws the section at all, judged at the environment's `now`. */
export function isSectionScheduledIn(style: FieldValues, now: Date): boolean {
  return isWithinSchedule(readSectionStyle(style), now)
}

export function SectionFrame({
  style: stored,
  background,
  floating = false,
  children,
}: {
  style: FieldValues
  /** The section's own background when its renderer paints one (see `sectionBackground`). */
  background?: SectionBackground | null
  /**
   * Paints outside the page flow (see `SectionSchema.floating`): a pinned
   * overlay, so the frame contributes no height around it — its content is
   * out of flow and any padding or divider would be invisible space.
   */
  floating?: boolean
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
  // A banner's background is its content, not its style: the divider mirrors
  // what the renderer paints. An explicit style background still wins.
  const dividerPaint: SurfacePaint =
    background && style.backgroundType === 'default'
      ? {
          ...paint,
          bg: background.bg ?? paint.bg,
          media: background.media ?? paint.media,
          mediaFit: background.fit ?? paint.mediaFit,
          mediaPosition: background.position ?? paint.mediaPosition,
        }
      : paint

  const display = {
    ...(style.visibility === 'mobile' && { hideFrom: 'md' }),
    ...(style.visibility === 'desktop' && { hideBelow: 'md' }),
  } as const

  // Staggered, the entrance and the cascade must agree: a section that opted
  // out of motion still gets a subtle entrance for its blocks to step through.
  // See `SECTION_STAGGER_ENABLED`.
  const stagger = SECTION_STAGGER_ENABLED && style.stagger
  const entrance = resolveEntrance(settings.animation, { ...style, stagger })

  // A photo background may also be a video's poster.
  const poster =
    paint.media?.imageId != null && paint.media.imageId !== ''
      ? imageUrl(paint.media.imageId, { width: 1920, height: 1080 })
      : null

  const surface: BoxProps = {
    // Always positioned: the background layers and dividers inside are
    // absolute against it. The section's own "Stick while scrolling" lives on
    // the wrapper around this frame — see `SectionItem` for why.
    position: 'relative',
    ...(style.scheme && vars && { css: schemeCss(style.scheme, vars), color: 'fg' }),
    ...(paint.bg && { bg: paint.bg }),
    ...(paint.backgroundImage && { backgroundImage: paint.backgroundImage }),
    ...(SECTION_TEXT_SHADOW_ENABLED && style.textShadow
      ? {
          css: {
            ...(style.scheme && vars ? (schemeCss(style.scheme, vars) as object) : {}),
            textShadow: '0 1px 3px rgba(0, 0, 0, 0.8), 0 2px 12px rgba(0, 0, 0, 0.5)',
          },
          color: style.scheme ? 'fg' : undefined,
        }
      : {}),
    pt: floating ? '0' : padding(style.paddingTop, banded),
    pb: floating ? '0' : padding(style.paddingBottom, banded),
  }

  const pattern = paint.pattern
  const shade = surfaceShade(paint.overlay)
  // A shaped edge replaces the panel's rounded corners: keeping both left a
  // notch of page colour where the divider's straight edge met the radius.
  const shaped = style.dividerTop !== 'none' || style.dividerBottom !== 'none'

  // Background layers sit on the section itself, so a full-width band's
  // photo or video reaches both edges — not only the content column.
  const layers = (
    <>
      {paint.media && (paint.media.video || poster) && (
        <Box
          position="absolute"
          inset={0}
          rounded="inherit"
          overflow="hidden"
          zIndex={0}
          pointerEvents="none"
        >
          {paint.media.video ? (
            <BackgroundVideo
              video={paint.media.video}
              poster={poster}
              objectFit={style.backgroundSize}
              objectPosition={style.backgroundPosition}
            />
          ) : (
            <ImageWithFallback
              src={poster ?? undefined}
              alt=""
              w="full"
              h="full"
              objectFit={style.backgroundSize}
              objectPosition={style.backgroundPosition}
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
    </>
  )

  const dividerTop =
    !floating && style.dividerTop !== 'none' ? (
      <SectionDivider
        shape={style.dividerTop}
        position="top"
        paint={dividerPaint}
        tone={style.dividerTone}
      />
    ) : null
  const dividerBottom =
    !floating && style.dividerBottom !== 'none' ? (
      <SectionDivider
        shape={style.dividerBottom}
        position="bottom"
        paint={dividerPaint}
        tone={style.dividerTone}
      />
    ) : null

  const inner = (
    <SectionLayoutContext.Provider
      value={{
        width: style.width,
        contentWidth: style.contentWidth,
        banded,
        headline: style.headline,
      }}
    >
      <HeadlineContext.Provider value={style.headline}>
        <ScrollReveal entrance={entrance} stagger={stagger}>
          {children}
        </ScrollReveal>
      </HeadlineContext.Provider>
    </SectionLayoutContext.Provider>
  )

  if (style.width === 'edge') {
    return (
      <FullBleed {...display} {...surface}>
        {layers}
        {dividerTop}
        {inner}
        {dividerBottom}
      </FullBleed>
    )
  }

  if (style.width === 'full') {
    return (
      <FullBleed {...display} {...surface}>
        {layers}
        {dividerTop}
        {/* The content column, inside a band that runs edge to edge. The
            padding matches the storefront shell's, so a band's content lines
            up with the sections around it; the max width is the section's. */}
        <Container maxW={style.contentWidth} px={{ base: '4', md: '6' }} position="relative">
          {inner}
        </Container>
        {dividerBottom}
      </FullBleed>
    )
  }

  // Page width: a band is a rounded panel in the column, padded on all sides.
  // A content width narrower than the page centres inside the host column; no
  // extra gutter, because the host already supplies it.
  const content =
    style.contentWidth === '6xl' ? (
      inner
    ) : (
      <Container maxW={style.contentWidth} position="relative">
        {inner}
      </Container>
    )

  return (
    <Box
      {...display}
      {...surface}
      {...(banded && { px: PANEL_PX, ...(shaped ? {} : { rounded: 'l3' }) })}
    >
      {layers}
      {dividerTop}
      {content}
      {dividerBottom}
    </Box>
  )
}
