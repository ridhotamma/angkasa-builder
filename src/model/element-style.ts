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

import {
  defaultForField,
  isRecord,
  readText,
  sanitizeValues,
  type Field,
  type FieldValues,
  type JsonValue,
} from './fields'
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

/** What a button is made of: the page's brand, the accent, the dark band, a soft surface — or a colour the seller picked. */
export const BUTTON_TONES = ['brand', 'accent', 'dark', 'light', 'custom'] as const
export type ButtonTone = (typeof BUTTON_TONES)[number]

/** A button's side padding, on the same spacing scale as everything else. */
export const BUTTON_PADDINGS = ['none', 'sm', 'md', 'lg', 'xl'] as const
export type ButtonPadding = (typeof BUTTON_PADDINGS)[number]

/**
 * What a button does under the pointer. `none` keeps the theme's own hover;
 * the rest wipe a contrasting fill across the button — the pattern most
 * storefronts use instead of pointer-following gimmicks.
 */
export const BUTTON_HOVERS = [
  'none',
  'fill-up',
  'fill-down',
  'fill-left',
  'fill-right',
  'shine',
] as const
export type ButtonHover = (typeof BUTTON_HOVERS)[number]

export const BUTTON_PADDING_X: Record<ButtonPadding, string> = {
  none: '0',
  sm: '3',
  md: '4',
  lg: '6',
  xl: '8',
}

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

/** The same alignment, as `alignSelf` for a button in a column. */
export const ALIGN_SELF: Record<ElementAlignment, string> = {
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
  /** The colour a hover fill wipes in with. */
  sweepBg: string
  /** The text colour on top of that fill. */
  sweepColor: string
}

interface ToneSpec {
  /** The solid fill. */
  fill: string
  /** Readable text on the fill. */
  contrast: string
  /** Outline border and ghost/outline text. */
  tint: string
  /** Readable text on the tint, for a hover fill. */
  tintContrast: string
  border?: string
}

/**
 * A button's custom colours, as the seller entered them. Both are hex codes
 * (the schema's `color` fields already bound them); `text` empty means the
 * readable one is derived from the fill.
 */
export interface ButtonCustomColors {
  fill?: string
  text?: string
}

function hexOrNull(value: string | undefined): string | null {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : null
}

function toneSpec(
  tone: ButtonTone,
  settings: ThemeSettings,
  custom?: ButtonCustomColors,
): ToneSpec {
  switch (tone) {
    case 'brand':
      return {
        fill: 'var(--chakra-colors-brand-solid)',
        contrast: 'var(--chakra-colors-brand-contrast)',
        tint: 'var(--chakra-colors-brand-solid)',
        tintContrast: 'var(--chakra-colors-brand-contrast)',
      }
    case 'accent': {
      const accent = settings.colors.accent
      return {
        fill: accent,
        contrast: readableOn(accent),
        tint: accent,
        tintContrast: readableOn(accent),
      }
    }
    case 'dark': {
      const inverse = resolveScheme(settings, 'inverse')
      return {
        fill: inverse.background,
        contrast: inverse.text,
        // Outline and ghost follow the section's own text colour, so a dark
        // outline never disappears into a dark band.
        tint: 'var(--chakra-colors-fg)',
        tintContrast: 'var(--chakra-colors-bg)',
      }
    }
    case 'light':
      return {
        fill: 'var(--chakra-colors-bg-subtle)',
        contrast: 'var(--chakra-colors-fg)',
        tint: 'var(--chakra-colors-fg)',
        tintContrast: 'var(--chakra-colors-bg)',
        border: 'var(--chakra-colors-border)',
      }
    case 'custom': {
      // An unset fill falls back to the brand token, and an unset label to the
      // readable colour of the fill — same contract as the tone presets.
      const fill = hexOrNull(custom?.fill) ?? 'var(--chakra-colors-brand-solid)'
      const text =
        hexOrNull(custom?.text) ??
        (fill.startsWith('#') ? readableOn(fill) : 'var(--chakra-colors-brand-contrast)')
      return { fill, contrast: text, tint: fill, tintContrast: text }
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
  custom?: ButtonCustomColors,
): ButtonAppearance {
  const spec = toneSpec(tone, settings, custom)
  switch (variant) {
    case 'solid':
      return {
        bg: spec.fill,
        color: spec.contrast,
        borderColor: spec.fill,
        hoverBg: `color-mix(in srgb, ${spec.fill} 88%, black)`,
        // A solid button inverts: the readable label colour wipes in and the
        // text takes the fill.
        sweepBg: spec.contrast,
        sweepColor: spec.fill,
      }
    case 'outline':
      return {
        bg: 'transparent',
        color: spec.tint,
        borderColor: spec.border ?? spec.tint,
        borderWidth: '1px',
        hoverBg: 'color-mix(in srgb, currentColor 10%, transparent)',
        sweepBg: spec.tint,
        sweepColor: spec.tintContrast,
      }
    case 'ghost':
      return {
        bg: 'transparent',
        color: spec.tint,
        hoverBg: 'color-mix(in srgb, currentColor 10%, transparent)',
        sweepBg: spec.tint,
        sweepColor: spec.tintContrast,
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

/** The block Button's extra tone: a colour the seller picks themselves. */
export const BUTTON_CUSTOM_TONE_OPTION = option('custom', {
  en: 'Custom colour…',
  id: 'Warna kustom…',
})

const BUTTON_PADDING_OPTIONS = [
  option('default', { en: 'Auto (by size)', id: 'Otomatis (sesuai ukuran)' }),
  option('none', { en: 'None', id: 'Tidak ada' }),
  option('sm', { en: 'Small', id: 'Kecil' }),
  option('md', { en: 'Medium', id: 'Sedang' }),
  option('lg', { en: 'Large', id: 'Besar' }),
  option('xl', { en: 'Extra large', id: 'Sangat besar' }),
]

const BUTTON_HOVER_OPTIONS = [
  option('none', { en: 'None (theme hover)', id: 'Tanpa efek (hover tema)' }),
  option('fill-up', { en: 'Fill up', id: 'Isi naik' }),
  option('fill-down', { en: 'Fill down', id: 'Isi turun' }),
  option('fill-left', { en: 'Fill from left', id: 'Isi dari kiri' }),
  option('fill-right', { en: 'Fill from right', id: 'Isi dari kanan' }),
  option('shine', { en: 'Shine sweep', id: 'Kilau menyapu' }),
]

const WIDTH_DEFAULT_OPTIONS = [
  option('default', { en: 'Theme default', id: 'Ikuti tema' }),
  ...SELF_WIDTH_OPTIONS,
]
const ALIGN_DEFAULT_OPTIONS = [
  option('default', { en: 'Theme default', id: 'Ikuti tema' }),
  ...ALIGN_OPTIONS,
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

export function buttonToneField(options: { custom?: boolean } = {}): Field {
  return {
    kind: 'select',
    key: 'tone',
    label: { en: 'Button colour', id: 'Warna tombol' },
    options: options.custom
      ? [...BUTTON_TONE_OPTIONS, BUTTON_CUSTOM_TONE_OPTION]
      : BUTTON_TONE_OPTIONS,
    default: 'brand',
  }
}

export function buttonPaddingField(): Field {
  return {
    kind: 'select',
    key: 'padding',
    label: { en: 'Side padding', id: 'Jarak samping' },
    options: BUTTON_PADDING_OPTIONS,
    default: 'default',
  }
}

export function buttonHoverField(): Field {
  return {
    kind: 'select',
    key: 'hover',
    label: { en: 'Hover effect', id: 'Efek hover' },
    options: BUTTON_HOVER_OPTIONS,
    default: 'none',
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

/* -------------------------------------------------------------------------- */
/* Element overrides                                                          */
/* -------------------------------------------------------------------------- */

/**
 * A button restyled in the editor, without touching the section's fields.
 * Every value is `'default'` until the seller overrides it, so a section
 * keeps its theme look and one button can step out on its own.
 */
export interface ButtonElementOverrides {
  /** Overrides the section's own label when set; empty keeps the section text. */
  label: string
  variant: ButtonVariant | 'default'
  tone: ButtonTone | 'default'
  size: ButtonSize | 'default'
  padding: ButtonPadding | 'default'
  width: SelfWidth | 'default'
  align: ElementAlignment | 'default'
  hover: ButtonHover | 'default'
}

export const BUTTON_ELEMENT_DEFAULTS: ButtonElementOverrides = {
  label: '',
  variant: 'default',
  tone: 'default',
  size: 'default',
  padding: 'default',
  width: 'default',
  align: 'default',
  hover: 'default',
}

/** The panel a button element opens when the seller clicks it in the preview. */
export const BUTTON_ELEMENT_FIELDS: readonly Field[] = [
  {
    kind: 'text',
    key: 'label',
    label: { en: 'Button label', id: 'Label tombol' },
    help: {
      en: 'The words on the button. Empty keeps the section’s own text.',
      id: 'Tulisan pada tombol. Kosong berarti memakai teks bagian itu sendiri.',
    },
    max: 60,
    default: '',
  },
  {
    kind: 'select',
    key: 'variant',
    label: { en: 'Button style', id: 'Gaya tombol' },
    options: [
      option('default', { en: 'Theme default', id: 'Ikuti tema' }),
      ...BUTTON_VARIANT_OPTIONS,
    ],
    default: 'default',
  },
  {
    kind: 'select',
    key: 'tone',
    label: { en: 'Button colour', id: 'Warna tombol' },
    options: [option('default', { en: 'Theme default', id: 'Ikuti tema' }), ...BUTTON_TONE_OPTIONS],
    default: 'default',
  },
  {
    kind: 'select',
    key: 'size',
    label: { en: 'Button size', id: 'Ukuran tombol' },
    options: [option('default', { en: 'Theme default', id: 'Ikuti tema' }), ...BUTTON_SIZE_OPTIONS],
    default: 'default',
  },
  {
    kind: 'select',
    key: 'padding',
    label: { en: 'Side padding', id: 'Jarak samping' },
    options: [
      option('default', { en: 'Auto (by size)', id: 'Otomatis (sesuai ukuran)' }),
      ...BUTTON_PADDING_OPTIONS.slice(1),
    ],
    default: 'default',
  },
  {
    kind: 'select',
    key: 'width',
    label: { en: 'Button width', id: 'Lebar tombol' },
    options: WIDTH_DEFAULT_OPTIONS,
    default: 'default',
  },
  {
    kind: 'select',
    key: 'hover',
    label: { en: 'Hover effect', id: 'Efek hover' },
    options: [
      option('default', { en: 'Theme default', id: 'Ikuti tema' }),
      ...BUTTON_HOVER_OPTIONS.slice(1),
    ],
    default: 'default',
  },
  {
    kind: 'select',
    key: 'align',
    label: { en: 'Alignment', id: 'Perataan' },
    options: ALIGN_DEFAULT_OPTIONS,
    default: 'default',
  },
]

export function readButtonElement(values?: FieldValues): ButtonElementOverrides {
  const source = values ?? {}
  return {
    label: readText(source, 'label').slice(0, 60),
    variant: readToken(source, 'variant', ['default', ...BUTTON_VARIANTS], 'default'),
    tone: readToken(source, 'tone', ['default', ...BUTTON_TONES], 'default'),
    size: readToken(source, 'size', ['default', ...BUTTON_SIZES], 'default'),
    padding: readToken(source, 'padding', ['default', ...BUTTON_PADDINGS], 'default'),
    width: readToken(source, 'width', ['default', ...SELF_WIDTHS], 'default'),
    align: readToken(source, 'align', ['default', ...ELEMENT_ALIGNMENTS], 'default'),
    hover: readToken(source, 'hover', ['default', ...BUTTON_HOVERS], 'default'),
  }
}

/** What kind of element an override belongs to; the editor picks its panel from it. */
export type ElementKind = 'button' | 'text'

/* -------------------------------------------------------------------------- */
/* Text element overrides                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A heading, a paragraph or a label restyled in the editor, without touching
 * the section's fields — the text counterpart of `ButtonElementOverrides`.
 * Every value is `'default'` until the seller overrides it, so a section keeps
 * its theme look and one element can step out on its own.
 *
 * Keys are namespaced (`text.` + the element's own name, see `textElementKey`)
 * so the sanitiser can tell a text override from a button's without knowing
 * the section.
 */
export const TEXT_ELEMENT_PREFIX = 'text.'

/** The element key a text element stores its overrides under. */
export function textElementKey(name: string): string {
  return `${TEXT_ELEMENT_PREFIX}${name}`
}

export const TEXT_ELEMENT_SIZES = [
  'default',
  'xs',
  'sm',
  'md',
  'lg',
  'xl',
  '2xl',
  '3xl',
  '4xl',
  '5xl',
] as const
export type TextElementSize = (typeof TEXT_ELEMENT_SIZES)[number]

/**
 * `custom` reveals a hex picker; every other value is a semantic token, so an
 * overridden label still follows the section's scheme and the dark mode.
 */
export const TEXT_ELEMENT_COLORS = [
  'default',
  'inherit',
  'fg',
  'fg-muted',
  'fg-subtle',
  'brand-solid',
  'brand-contrast',
  'white',
  'black',
  'custom',
] as const
export type TextElementColor = (typeof TEXT_ELEMENT_COLORS)[number]

export const TEXT_ELEMENT_FONTS = ['default', 'heading', 'body', 'brand'] as const
export type TextElementFont = (typeof TEXT_ELEMENT_FONTS)[number]

export const TEXT_ELEMENT_WEIGHTS = [
  'default',
  'light',
  'normal',
  'medium',
  'semibold',
  'bold',
] as const
export type TextElementWeight = (typeof TEXT_ELEMENT_WEIGHTS)[number]

export const TEXT_ELEMENT_LINE_HEIGHTS = [
  'default',
  'tight',
  'snug',
  'normal',
  'relaxed',
  'loose',
] as const
export type TextElementLineHeight = (typeof TEXT_ELEMENT_LINE_HEIGHTS)[number]

export const TEXT_ELEMENT_LETTER_SPACINGS = [
  'default',
  'tighter',
  'tight',
  'normal',
  'wide',
  'wider',
  'widest',
] as const
export type TextElementLetterSpacing = (typeof TEXT_ELEMENT_LETTER_SPACINGS)[number]

export const TEXT_ELEMENT_TRANSFORMS = [
  'default',
  'none',
  'uppercase',
  'lowercase',
  'capitalize',
] as const
export type TextElementTransform = (typeof TEXT_ELEMENT_TRANSFORMS)[number]

export const TEXT_ELEMENT_STYLES = ['default', 'normal', 'italic'] as const
export type TextElementFontStyle = (typeof TEXT_ELEMENT_STYLES)[number]

export const TEXT_ELEMENT_DECORATIONS = ['default', 'none', 'underline', 'line-through'] as const
export type TextElementDecoration = (typeof TEXT_ELEMENT_DECORATIONS)[number]

export const TEXT_ELEMENT_ALIGNS = ['default', 'left', 'center', 'right'] as const
export type TextElementAlign = (typeof TEXT_ELEMENT_ALIGNS)[number]

export interface TextElementOverrides {
  size: TextElementSize
  color: TextElementColor
  /** The hex behind `color: 'custom'`; empty until picked. */
  customColor: string
  font: TextElementFont
  weight: TextElementWeight
  lineHeight: TextElementLineHeight
  letterSpacing: TextElementLetterSpacing
  transform: TextElementTransform
  style: TextElementFontStyle
  decoration: TextElementDecoration
  align: TextElementAlign
}

export const TEXT_ELEMENT_DEFAULTS: TextElementOverrides = {
  size: 'default',
  color: 'default',
  customColor: '',
  font: 'default',
  weight: 'default',
  lineHeight: 'default',
  letterSpacing: 'default',
  transform: 'default',
  style: 'default',
  decoration: 'default',
  align: 'default',
}

const TEXT_ELEMENT_SIZE_OPTIONS = [
  option('xs', { en: 'Extra small', id: 'Sangat kecil' }),
  option('sm', { en: 'Small', id: 'Kecil' }),
  option('md', { en: 'Medium', id: 'Sedang' }),
  option('lg', { en: 'Large', id: 'Besar' }),
  option('xl', { en: 'Extra large', id: 'Sangat besar' }),
  option('2xl', { en: '2XL', id: '2XL' }),
  option('3xl', { en: '3XL', id: '3XL' }),
  option('4xl', { en: '4XL', id: '4XL' }),
  option('5xl', { en: '5XL', id: '5XL' }),
]

const TEXT_COLOR_OPTIONS = [
  option('inherit', { en: 'Section colour', id: 'Warna bagian' }),
  option('fg', { en: 'Page text', id: 'Teks halaman' }),
  option('fg-muted', { en: 'Muted text', id: 'Teks redup' }),
  option('fg-subtle', { en: 'Subtle text', id: 'Teks samar' }),
  option('brand-solid', { en: 'Brand', id: 'Brand' }),
  option('brand-contrast', { en: 'On brand', id: 'Di atas brand' }),
  option('white', { en: 'White', id: 'Putih' }),
  option('black', { en: 'Black', id: 'Hitam' }),
  option('custom', { en: 'Custom colour…', id: 'Warna kustom…' }),
]

const TEXT_FONT_OPTIONS = [
  option('heading', { en: 'Heading font', id: 'Font judul' }),
  option('body', { en: 'Body font', id: 'Font isi' }),
  option('brand', { en: 'Display font', id: 'Font display' }),
]

const TEXT_WEIGHT_OPTIONS = [
  option('light', { en: 'Light', id: 'Ringan' }),
  option('normal', { en: 'Normal', id: 'Normal' }),
  option('medium', { en: 'Medium', id: 'Sedang' }),
  option('semibold', { en: 'Semibold', id: 'Semi tebal' }),
  option('bold', { en: 'Bold', id: 'Tebal' }),
]

const TEXT_LINE_HEIGHT_OPTIONS = [
  option('tight', { en: 'Tight', id: 'Rapat' }),
  option('snug', { en: 'Snug', id: 'Agak rapat' }),
  option('normal', { en: 'Normal', id: 'Normal' }),
  option('relaxed', { en: 'Relaxed', id: 'Renggang' }),
  option('loose', { en: 'Loose', id: 'Sangat renggang' }),
]

const TEXT_LETTER_SPACING_OPTIONS = [
  option('tighter', { en: 'Tighter', id: 'Sangat rapat' }),
  option('tight', { en: 'Tight', id: 'Rapat' }),
  option('normal', { en: 'Normal', id: 'Normal' }),
  option('wide', { en: 'Wide', id: 'Lebar' }),
  option('wider', { en: 'Wider', id: 'Lebih lebar' }),
  option('widest', { en: 'Widest', id: 'Paling lebar' }),
]

const TEXT_TRANSFORM_OPTIONS = [
  option('none', { en: 'As typed', id: 'Sesuai ketikan' }),
  option('uppercase', { en: 'UPPERCASE', id: 'HURUF BESAR' }),
  option('lowercase', { en: 'lowercase', id: 'huruf kecil' }),
  option('capitalize', { en: 'Capitalise', id: 'Huruf Awal Besar' }),
]

const TEXT_STYLE_OPTIONS = [
  option('normal', { en: 'Upright', id: 'Tegak' }),
  option('italic', { en: 'Italic', id: 'Miring' }),
]

const TEXT_DECORATION_OPTIONS = [
  option('none', { en: 'None', id: 'Tanpa garis' }),
  option('underline', { en: 'Underline', id: 'Garis bawah' }),
  option('line-through', { en: 'Strikethrough', id: 'Coret' }),
]

const TEXT_ALIGN_OPTIONS = [
  option('left', { en: 'Left', id: 'Kiri' }),
  option('center', { en: 'Center', id: 'Tengah' }),
  option('right', { en: 'Right', id: 'Kanan' }),
]

const defaultOption = option('default', { en: 'Theme default', id: 'Ikuti tema' })

const textSelect = (
  key: string,
  label: Localized,
  options: ReadonlyArray<{ value: string; label: Localized }>,
): Field => ({
  kind: 'select',
  key,
  label,
  options: [defaultOption, ...options],
  default: 'default',
})

/** The panel a text element opens when the seller clicks it in the preview. */
export const TEXT_ELEMENT_FIELDS: readonly Field[] = [
  textSelect('size', { en: 'Font size', id: 'Ukuran huruf' }, TEXT_ELEMENT_SIZE_OPTIONS),
  textSelect('color', { en: 'Text colour', id: 'Warna teks' }, TEXT_COLOR_OPTIONS),
  {
    kind: 'color',
    key: 'customColor',
    label: { en: 'Custom colour', id: 'Warna kustom' },
    default: '',
    showWhen: { key: 'color', is: ['custom'] },
  },
  textSelect('font', { en: 'Font', id: 'Font' }, TEXT_FONT_OPTIONS),
  textSelect('weight', { en: 'Weight', id: 'Ketebalan' }, TEXT_WEIGHT_OPTIONS),
  textSelect('lineHeight', { en: 'Line height', id: 'Jarak baris' }, TEXT_LINE_HEIGHT_OPTIONS),
  textSelect(
    'letterSpacing',
    { en: 'Letter spacing', id: 'Jarak antar huruf' },
    TEXT_LETTER_SPACING_OPTIONS,
  ),
  textSelect('transform', { en: 'Letter case', id: 'Huruf besar/kecil' }, TEXT_TRANSFORM_OPTIONS),
  textSelect('style', { en: 'Italic', id: 'Miring' }, TEXT_STYLE_OPTIONS),
  textSelect('decoration', { en: 'Underline', id: 'Garis' }, TEXT_DECORATION_OPTIONS),
  textSelect('align', { en: 'Alignment', id: 'Perataan' }, TEXT_ALIGN_OPTIONS),
]

const HEX_COLOR = /^#[0-9a-f]{6}$/i

export function readTextElement(values?: FieldValues): TextElementOverrides {
  const source = values ?? {}
  const customColor = readText(source, 'customColor')
  return {
    size: readToken(source, 'size', TEXT_ELEMENT_SIZES, 'default'),
    color: readToken(source, 'color', TEXT_ELEMENT_COLORS, 'default'),
    customColor: HEX_COLOR.test(customColor) ? customColor.toLowerCase() : '',
    font: readToken(source, 'font', TEXT_ELEMENT_FONTS, 'default'),
    weight: readToken(source, 'weight', TEXT_ELEMENT_WEIGHTS, 'default'),
    lineHeight: readToken(source, 'lineHeight', TEXT_ELEMENT_LINE_HEIGHTS, 'default'),
    letterSpacing: readToken(source, 'letterSpacing', TEXT_ELEMENT_LETTER_SPACINGS, 'default'),
    transform: readToken(source, 'transform', TEXT_ELEMENT_TRANSFORMS, 'default'),
    style: readToken(source, 'style', TEXT_ELEMENT_STYLES, 'default'),
    decoration: readToken(source, 'decoration', TEXT_ELEMENT_DECORATIONS, 'default'),
    align: readToken(source, 'align', TEXT_ELEMENT_ALIGNS, 'default'),
  }
}

/** The style props an overridden text element draws with. */
export interface TextElementStyle {
  fontSize?: string
  fontFamily?: string
  fontWeight?: string
  lineHeight?: string
  letterSpacing?: string
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
  fontStyle?: 'normal' | 'italic'
  textDecoration?: string
  textAlign?: 'left' | 'center' | 'right'
  color?: string
}

const TEXT_SIZE_CSS: Record<string, string> = {
  xs: 'var(--chakra-font-sizes-xs)',
  sm: 'var(--chakra-font-sizes-sm)',
  md: 'var(--chakra-font-sizes-md)',
  lg: 'var(--chakra-font-sizes-lg)',
  xl: 'var(--chakra-font-sizes-xl)',
  '2xl': 'var(--chakra-font-sizes-2xl)',
  '3xl': 'var(--chakra-font-sizes-3xl)',
  '4xl': 'var(--chakra-font-sizes-4xl)',
  '5xl': 'var(--chakra-font-sizes-5xl)',
}

const TEXT_COLOR_CSS: Record<string, string> = {
  inherit: 'inherit',
  fg: 'var(--chakra-colors-fg)',
  'fg-muted': 'var(--chakra-colors-fg-muted)',
  'fg-subtle': 'var(--chakra-colors-fg-subtle)',
  'brand-solid': 'var(--chakra-colors-brand-solid)',
  'brand-contrast': 'var(--chakra-colors-brand-contrast)',
  white: 'white',
  black: 'black',
}

const TEXT_FONT_CSS: Record<string, string> = {
  heading: 'var(--chakra-fonts-heading)',
  body: 'var(--chakra-fonts-body)',
  brand: 'var(--chakra-fonts-brand)',
}

const TEXT_WEIGHT_CSS: Record<string, string> = {
  light: '300',
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
}

const TEXT_LINE_HEIGHT_CSS: Record<string, string> = {
  tight: '1.1',
  snug: '1.3',
  normal: '1.5',
  relaxed: '1.7',
  loose: '2',
}

const TEXT_LETTER_SPACING_CSS: Record<string, string> = {
  tighter: '-0.05em',
  tight: '-0.025em',
  normal: '0',
  wide: '0.025em',
  wider: '0.05em',
  widest: '0.1em',
}

/** Only what was overridden; every `default` is left off. */
export function textElementStyle(overrides: TextElementOverrides): TextElementStyle {
  const out: TextElementStyle = {}
  if (overrides.size !== 'default' && TEXT_SIZE_CSS[overrides.size]) {
    out.fontSize = TEXT_SIZE_CSS[overrides.size]
  }
  if (overrides.color === 'custom') {
    if (overrides.customColor) out.color = overrides.customColor
  } else if (overrides.color !== 'default' && TEXT_COLOR_CSS[overrides.color]) {
    out.color = TEXT_COLOR_CSS[overrides.color]
  }
  if (overrides.font !== 'default' && TEXT_FONT_CSS[overrides.font]) {
    out.fontFamily = TEXT_FONT_CSS[overrides.font]
  }
  if (overrides.weight !== 'default') out.fontWeight = TEXT_WEIGHT_CSS[overrides.weight]
  if (overrides.lineHeight !== 'default')
    out.lineHeight = TEXT_LINE_HEIGHT_CSS[overrides.lineHeight]
  if (overrides.letterSpacing !== 'default') {
    out.letterSpacing = TEXT_LETTER_SPACING_CSS[overrides.letterSpacing]
  }
  if (overrides.transform !== 'default') out.textTransform = overrides.transform
  if (overrides.style !== 'default') out.fontStyle = overrides.style
  if (overrides.decoration !== 'default') out.textDecoration = overrides.decoration
  if (overrides.align !== 'default') out.textAlign = overrides.align
  return out
}

/* -------------------------------------------------------------------------- */
/* Element sanitising                                                         */
/* -------------------------------------------------------------------------- */

/** The element key any override stores itself under. */
const ELEMENT_KEY = /^[A-Za-z0-9_.-]{1,80}$/

function isOverride(fields: readonly Field[], clean: FieldValues): boolean {
  return fields.some(
    (field) =>
      clean[field.key] !== undefined &&
      JSON.stringify(clean[field.key]) !== JSON.stringify(defaultForField(field)),
  )
}

/**
 * A section's element overrides, cleaned: unknown keys and values dropped, and
 * an entry left entirely at its defaults is not stored at all, so a layout
 * that never touched a button or a label stays exactly as it was. Text keys
 * are the ones namespaced with `text.`; everything else is a button.
 */
export function sanitizeElements(value: unknown): Record<string, FieldValues> {
  if (!isRecord(value)) return {}
  const out: Record<string, FieldValues> = {}
  for (const [key, style] of Object.entries(value)) {
    if (!ELEMENT_KEY.test(key)) continue
    const fields = key.startsWith(TEXT_ELEMENT_PREFIX) ? TEXT_ELEMENT_FIELDS : BUTTON_ELEMENT_FIELDS
    const clean = sanitizeValues(fields, style)
    if (isOverride(fields, clean)) out[key] = clean
  }
  return out
}
