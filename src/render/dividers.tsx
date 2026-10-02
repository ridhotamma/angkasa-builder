/**
 * SVG Section Dividers: smooth transitions between page sections.
 *
 * A divider mirrors its own section's painted background — scheme colour,
 * gradient, pattern or plain page — clipped to the shape with a mask, so it
 * follows the section whatever the seller picks. No separate fill colour to
 * drift out of sync. Marking (mask-image) needs the -webkit- prefix in
 * Safari; both are emitted.
 */

import { Box, type BoxProps } from '@chakra-ui/react'

import type { VideoRef } from '../model/fields'
import type {
  BackgroundGradient,
  BackgroundPattern,
  DividerShape,
  ResolvedSectionStyle,
  SurfaceOverlay,
} from '../model/section-style'

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
const GRAIN = encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180">' +
    '<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" stitchTiles="stitch"/></filter>' +
    '<rect width="180" height="180" filter="url(#n)"/></svg>',
)

export const PATTERNS: Record<Exclude<BackgroundPattern, 'none'>, BoxProps['css']> = {
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
  // Film grain: an SVG turbulence tile, no image file and no WebGL.
  grain: {
    backgroundImage: `url("data:image/svg+xml,${GRAIN}")`,
    backgroundRepeat: 'repeat',
    opacity: 0.14,
    mixBlendMode: 'overlay',
  },
  // An aurora drift, approximated with an animated gradient; still under
  // reduced motion.
  aurora: {
    backgroundImage:
      'linear-gradient(120deg, transparent 0%, var(--chakra-colors-brand-muted) 28%, transparent 52%, var(--chakra-colors-brand-subtle) 78%, transparent 100%)',
    backgroundSize: '220% 220%',
    opacity: 0.85,
    animation: 'pb-aurora 16s ease-in-out infinite alternate',
    '@keyframes pb-aurora': {
      from: { backgroundPosition: '0% 50%' },
      to: { backgroundPosition: '100% 50%' },
    },
    '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
  },
}

/** The panel padding a contained band wears; its dividers inset to match. */
export const PANEL_PX: { base: string; md: string } = { base: '5', md: '10' }

export interface SurfacePaint {
  /** Token background for scheme bands; unset when the page shows through. */
  bg?: string
  /** A gradient wash over the background, if any. */
  backgroundImage?: string
  /** Pattern texture over the background, if any. */
  pattern: BackgroundPattern
  /** A photo or video layer under the content, if the section asked for one. */
  media: { imageId: string; video: VideoRef | null } | null
  /** How dark that layer is, so text on it stays readable. */
  overlay: SurfaceOverlay
}

/** A section's painted background, whatever kind it is — the frame and the divider share this. */
export function surfacePaint(style: ResolvedSectionStyle): SurfacePaint {
  const media =
    style.backgroundType === 'image' || style.backgroundType === 'video'
      ? {
          imageId: style.backgroundImageId,
          video: style.backgroundType === 'video' ? style.backgroundVideo : null,
        }
      : null
  return {
    bg: style.scheme ? 'bg' : undefined,
    backgroundImage:
      style.backgroundType === 'gradient' ? GRADIENTS[style.backgroundGradient] : undefined,
    pattern: style.backgroundType === 'pattern' ? style.backgroundPattern : 'none',
    media,
    overlay: style.backgroundOverlay,
  }
}

/* -------------------------------------------------------------------------- */
/* Shapes                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Every path is authored for the TOP position — filled below a shaped top
 * edge, rising into the previous section with a straight edge flush against
 * its own. The bottom reuses the same path flipped vertically, so its
 * straight edge stays flush and the shape dissolves into the next section.
 */
const DIVIDER_PATHS: Record<Exclude<DividerShape, 'none'>, string> = {
  wave: '<path d="M0,0 C150,90 400,100 600,40 C800,-20 1050,70 1200,30 L1200,120 L0,120 Z"/>',
  slant: '<polygon points="0,0 1200,120 0,120"/>',
  curve: '<path d="M0,120 Q600,-40 1200,120 Z"/>',
  arc: '<path d="M0,0 Q600,120 1200,0 L1200,120 L0,120 Z"/>',
  zigzag:
    '<polygon points="0,120 0,30 100,90 200,30 300,90 400,30 500,90 600,30 700,90 800,30 900,90 1000,30 1100,90 1200,30 1200,120"/>',
}

function dividerMask(shape: Exclude<DividerShape, 'none'>): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" ` +
    `preserveAspectRatio="none">${DIVIDER_PATHS[shape]}</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

function maskProps(shape: Exclude<DividerShape, 'none'>): BoxProps['css'] {
  const mask = dividerMask(shape)
  return {
    maskImage: mask,
    WebkitMaskImage: mask,
    maskSize: '100% 100%',
    WebkitMaskSize: '100% 100%',
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
  }
}

/**
 * Where the divider sits. A `scaleY` flip (not a rotation, so the
 * left-right phase is kept) turns a top path into a bottom one; the straight
 * edge stays flush with its own section either way.
 */
export function dividerContainerStyle(position: 'top' | 'bottom', contained = false): BoxProps {
  return {
    position: 'absolute',
    left: contained ? PANEL_PX : 0,
    right: contained ? PANEL_PX : 0,
    width: '100%',
    overflow: 'hidden',
    lineHeight: 0,
    pointerEvents: 'none',
    zIndex: 1,
    ...(position === 'top'
      ? { top: 0, transform: 'translateY(-98%)' }
      : { bottom: 0, transform: 'translateY(98%) scaleY(-1)' }),
  }
}

interface SectionDividerProps extends BoxProps {
  shape: DividerShape
  position: 'top' | 'bottom'
  /** The section's own paint, mirrored exactly. */
  paint: SurfacePaint
  /** Constrain to the content column on contained sections. */
  contained?: boolean
}

export function SectionDivider({
  shape,
  position,
  paint,
  contained = false,
  ...rest
}: SectionDividerProps) {
  if (shape === 'none') return null
  const mask = maskProps(shape)
  return (
    <Box
      {...dividerContainerStyle(position, contained)}
      bg={paint.bg}
      backgroundImage={paint.backgroundImage}
      css={mask}
      {...rest}
    >
      {paint.pattern !== 'none' && (
        <Box
          position="absolute"
          inset={0}
          pointerEvents="none"
          css={{ ...PATTERNS[paint.pattern], ...mask }}
        />
      )}
    </Box>
  )
}
