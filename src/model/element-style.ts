/**
 * The shared content scale: the sizes, widths, alignment and spacing every
 * block composes from.
 *
 * One place decides what "large" means, how wide a "narrow" reading measure
 * is and how much air "medium" spacing buys, so a heading block, a button and
 * a column all sit on the same rhythm — and a seller picks tokens, never
 * pixels. The renderers turn these presets into Chakra props; nothing here
 * touches React so the server can validate a layout without it.
 */

import type { Field, FieldValues, JsonValue } from './fields'
import type { Localized } from './localized'
import { readableOn, resolveScheme, type ThemeSettings } from './settings'

/* -------------------------------------------------------------------------- */
/* The scale                                                                  */
/* -------------------------------------------------------------------------- */

export const ELEMENT_ALIGNMENTS = ['left', 'center', 'right'] as const
export type ElementAlignment = (typeof ELEMENT_ALIGNMENTS)[number]

/** The reading measure of a content block: wide/medium/narrow cap the line. */
export const CONTENT_WIDTHS = ['full', 'wide', 'medium', 'narrow'] as const
export type ContentWidth = (typeof CONTENT_WIDTHS)[number]

/** A self-sized element: natural size, or the full column. */
export const SELF_WIDTHS = ['auto', 'full'] as const
export type SelfWidth = (typeof SELF_WIDTHS)[number]

/** The one spacing scale: gaps, padding and spacer heights all read it. */
export const SPACES = ['none', 'sm', 'md', 'lg', 'xl'] as const
export type Space = (typeof SPACES)[number]

export const TEXT_SIZES = ['sm', 'md', 'lg', 'xl'] as const
export type TextSize = (typeof TEXT_SIZES)[number]

export const HEADING_SIZES = ['md', 'lg', 'xl', '2xl', '3xl'] as const
export type HeadingSize = (typeof HEADING_SIZES)[number]

export const BUTTON_SIZES = ['sm', 'md', 'lg', 'xl'] as const
export type ButtonSize = (typeof BUTTON_SIZES)[number]

export const BUTTON_VARIANTS = ['solid', 'outline', 'ghost'] as const
export type ButtonVariant = (typeof BUTTON_VARIANTS)[number]

/** What a button is made of: the page's brand, the accent, the dark band or a soft surface. */
export const BUTTON_TONES = ['brand', 'accent', 'dark', 'light'] as const
export type ButtonTone = (typeof BUTTON_TONES)[number]

export const IMAGE_RATIOS = ['auto', 'square', '4/3', '16/9', '3/4'] as const
export type ImageRatio = (typeof IMAGE_RATIOS)[number]

export const IMAGE_ROUNDING = ['none', 'sm', 'md', 'lg', 'full'] as const
export type ImageRounding = (typeof IMAGE_ROUNDING)[number]

export const HEADING_LEVELS = ['h1', 'h2', 'h3'] as const
export type HeadingLevel = (typeof HEADING_LEVELS)[number]

/* -------------------------------------------------------------------------- */
/* Resolution                                                                 */
/* -------------------------------------------------------------------------- */

/** Gaps between siblings: the `Stack`/`Grid` rhythm. */
export const SPACE_GAP: Record<Space, string> = {
  none: '0',
  sm: '2',
  md: '4',
  lg: '6',
  xl: '10',
}

/** A column's own vertical padding. */
export const SPACE_PADDING_Y: Record<Space, string> = {
  none: '0',
  sm: '2',
  md: '4',
  lg: '8',
  xl: '12',
}

/** How tall a spacer block stands. */
export const SPACE_HEIGHT: Record<Space, string> = {
  none: '0',
  sm: '4',
  md: '8',
  lg: '12',
  xl: '20',
}

export const CONTENT_MAX_WIDTH: Record<ContentWidth, string | undefined> = {
  full: undefined,
  wide: '5xl',
  medium: '3xl',
  narrow: '2xl',
}

export const TEXT_FONT_SIZE: Record<TextSize, string> = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
  xl: 'xl',
}

/** Headings scale down a step on phones, so a display line still fits. */
export const HEADING_FONT_SIZE = {
  md: { base: 'lg', md: 'xl' },
  lg: { base: 'xl', md: '2xl' },
  xl: { base: '2xl', md: '3xl' },
  '2xl': { base: '3xl', md: '4xl' },
  '3xl': { base: '4xl', md: '5xl' },
} as const satisfies Record<HeadingSize, { base: string; md: string }>

export const ALIGN_TEXT: Record<ElementAlignment, 'left' | 'center' | 'right'> = {
  left: 'left',
  center: 'center',
  right: 'right',
}

/** Alignment as a flex `justifyContent`, for self-sized children. */
export const ALIGN_JUSTIFY: Record<ElementAlignment, string> = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
}

export const IMAGE_RATIO: Record<ImageRatio, number | undefined> = {
  auto: undefined,
  square: 1,
  '4/3': 4 / 3,
  '16/9': 16 / 9,
  '3/4': 3 / 4,
}

export const IMAGE_ROUNDED: Record<ImageRounding, string> = {
  none: '0',
  sm: 'l1',
  md: 'l2',
  lg: 'l3',
  full: 'full',
}

/** The placement props a content block's measure asks for. */
export interface ContentLayout {
  maxW?: string
  mx?: 'auto'
  ml?: 'auto'
  textAlign: 'left' | 'center' | 'right'
}

export function contentLayout(width: ContentWidth, align: ElementAlignment): ContentLayout {
  const maxW = CONTENT_MAX_WIDTH[width]
  return {
    ...(maxW && { maxW }),
    ...(maxW && align === 'center' && { mx: 'auto' as const }),
    ...(maxW && align === 'right' && { ml: 'auto' as const }),
    textAlign: ALIGN_TEXT[align],
  }
}

/** The props a self-sized block (a button, a photo) asks for. */
export interface SelfLayout {
  w?: 'full'
  justify: string
}

export function selfLayout(width: SelfWidth, align: ElementAlignment): SelfLayout {
  return { ...(width === 'full' && { w: 'full' as const }), justify: ALIGN_JUSTIFY[align] }
}

/* -------------------------------------------------------------------------- */
/* Buttons                                                                    */
/* -------------------------------------------------------------------------- */

export interface ButtonAppearance {
  bg?: string
  color: string
  borderColor?: string
  borderWidth?: string
  hoverBg?: string
}

interface ToneSpec {
  /** The solid fill. */
  fill: string
  /** Readable text on the fill. */
  contrast: string
  /** Outline border and ghost/outline text. */
  tint: string
  border?: string
}

function toneSpec(tone: ButtonTone, settings: ThemeSettings): ToneSpec {
  switch (tone) {
    case 'brand':
      return {
        fill: 'var(--chakra-colors-brand-solid)',
        contrast: 'var(--chakra-colors-brand-contrast)',
        tint: 'var(--chakra-colors-brand-solid)',
      }
    case 'accent': {
      const accent = settings.colors.accent
      return { fill: accent, contrast: readableOn(accent), tint: accent }
    }
    case 'dark': {
      const inverse = resolveScheme(settings, 'inverse')
      return {
        fill: inverse.background,
        contrast: inverse.text,
        // Outline and ghost follow the section's own text colour, so a dark
        // outline never disappears into a dark band.
        tint: 'var(--chakra-colors-fg)',
      }
    }
    case 'light':
      return {
        fill: 'var(--chakra-colors-bg-subtle)',
        contrast: 'var(--chakra-colors-fg)',
        tint: 'var(--chakra-colors-fg)',
        border: 'var(--chakra-colors-border)',
      }
  }
}

/**
 * A button's colours, resolved to plain values the renderer applies. Every
 * token the theme owns is a CSS variable, so a button inside a brand or dark
 * band follows the band without knowing it is in one.
 */
export function buttonAppearance(
  tone: ButtonTone,
  variant: ButtonVariant,
  settings: ThemeSettings,
): ButtonAppearance {
  const spec = toneSpec(tone, settings)
  switch (variant) {
    case 'solid':
      return {
        bg: spec.fill,
        color: spec.contrast,
        borderColor: spec.fill,
        hoverBg: `color-mix(in srgb, ${spec.fill} 88%, black)`,
      }
    case 'outline':
      return {
        bg: 'transparent',
        color: spec.tint,
        borderColor: spec.border ?? spec.tint,
        borderWidth: '1px',
        hoverBg: 'color-mix(in srgb, currentColor 10%, transparent)',
      }
    case 'ghost':
      return {
        bg: 'transparent',
        color: spec.tint,
        hoverBg: 'color-mix(in srgb, currentColor 10%, transparent)',
      }
  }
}

/* -------------------------------------------------------------------------- */
/* Field builders                                                             */
/* -------------------------------------------------------------------------- */

const option = (value: string, label: Localized): { value: string; label: Localized } => ({
  value,
  label,
})

const ALIGN_OPTIONS = [
  option('left', { en: 'Left', id: 'Kiri' }),
  option('center', { en: 'Center', id: 'Tengah' }),
  option('right', { en: 'Right', id: 'Kanan' }),
]

const CONTENT_WIDTH_OPTIONS = [
  option('full', { en: 'Full width', id: 'Penuh' }),
  option('wide', { en: 'Wide', id: 'Lebar' }),
  option('medium', { en: 'Medium', id: 'Sedang' }),
  option('narrow', { en: 'Narrow', id: 'Sempit' }),
]

const SELF_WIDTH_OPTIONS = [
  option('auto', { en: 'Fit content', id: 'Sesuai isi' }),
  option('full', { en: 'Full width', id: 'Penuh' }),
]

const SPACE_OPTIONS = [
  option('none', { en: 'None', id: 'Tidak ada' }),
  option('sm', { en: 'Small', id: 'Kecil' }),
  option('md', { en: 'Medium', id: 'Sedang' }),
  option('lg', { en: 'Large', id: 'Besar' }),
  option('xl', { en: 'Extra large', id: 'Sangat besar' }),
]

const TEXT_SIZE_OPTIONS = [
  option('sm', { en: 'Small', id: 'Kecil' }),
  option('md', { en: 'Medium', id: 'Sedang' }),
  option('lg', { en: 'Large', id: 'Besar' }),
  option('xl', { en: 'Extra large', id: 'Sangat besar' }),
]

const HEADING_SIZE_OPTIONS = [
  option('md', { en: 'Small', id: 'Kecil' }),
  option('lg', { en: 'Medium', id: 'Sedang' }),
  option('xl', { en: 'Large', id: 'Besar' }),
  option('2xl', { en: 'Extra large', id: 'Sangat besar' }),
  option('3xl', { en: 'Display', id: 'Display' }),
]

const BUTTON_SIZE_OPTIONS = [
  option('sm', { en: 'Small', id: 'Kecil' }),
  option('md', { en: 'Medium', id: 'Sedang' }),
  option('lg', { en: 'Large', id: 'Besar' }),
  option('xl', { en: 'Extra large', id: 'Sangat besar' }),
]

const BUTTON_VARIANT_OPTIONS = [
  option('solid', { en: 'Solid', id: 'Solid' }),
  option('outline', { en: 'Outlined', id: 'Garis tepi' }),
  option('ghost', { en: 'Ghost', id: 'Transparan' }),
]

const BUTTON_TONE_OPTIONS = [
  option('brand', { en: 'Brand', id: 'Brand' }),
  option('accent', { en: 'Accent', id: 'Aksen' }),
  option('dark', { en: 'Dark', id: 'Gelap' }),
  option('light', { en: 'Light', id: 'Terang' }),
]

export function alignmentField(): Field {
  return {
    kind: 'select',
    key: 'align',
    label: { en: 'Alignment', id: 'Perataan' },
    options: ALIGN_OPTIONS,
    default: 'left',
  }
}

export function contentWidthField(): Field {
  return {
    kind: 'select',
    key: 'width',
    label: { en: 'Width', id: 'Lebar' },
    options: CONTENT_WIDTH_OPTIONS,
    default: 'full',
  }
}

export function selfWidthField(): Field {
  return {
    kind: 'select',
    key: 'width',
    label: { en: 'Width', id: 'Lebar' },
    options: SELF_WIDTH_OPTIONS,
    default: 'auto',
  }
}

export function textSizeField(): Field {
  return {
    kind: 'select',
    key: 'size',
    label: { en: 'Text size', id: 'Ukuran teks' },
    options: TEXT_SIZE_OPTIONS,
    default: 'md',
  }
}

export function headingSizeField(): Field {
  return {
    kind: 'select',
    key: 'size',
    label: { en: 'Heading size', id: 'Ukuran judul' },
    options: HEADING_SIZE_OPTIONS,
    default: 'lg',
  }
}

export function buttonSizeField(): Field {
  return {
    kind: 'select',
    key: 'size',
    label: { en: 'Button size', id: 'Ukuran tombol' },
    options: BUTTON_SIZE_OPTIONS,
    default: 'md',
  }
}

export function buttonVariantField(): Field {
  return {
    kind: 'select',
    key: 'variant',
    label: { en: 'Button style', id: 'Gaya tombol' },
    options: BUTTON_VARIANT_OPTIONS,
    default: 'solid',
  }
}

export function buttonToneField(): Field {
  return {
    kind: 'select',
    key: 'tone',
    label: { en: 'Button colour', id: 'Warna tombol' },
    options: BUTTON_TONE_OPTIONS,
    default: 'brand',
  }
}

export function spaceField(key: string, label: Localized, fallback: Space): Field {
  return { kind: 'select', key, label, options: SPACE_OPTIONS, default: fallback }
}

/** A stored token, or its fallback when the value is missing or unknown. */
export function readToken<T extends string>(
  values: FieldValues,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = values[key] as JsonValue
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback
}
