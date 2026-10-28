/**
 * The settings every section has, whatever it shows: which colour scheme it
 * wears, how much room it takes, how wide it runs, on which devices it
 * appears, and between which dates.
 *
 * Extended with premium visuals (docs/PREMIUM-VISUALS.md):
 * - Surface textures: background gradients and patterns
 * - Section dividers: top/bottom wave, slant, curve, arc, zigzag
 * - Motion overrides: per-section animation
 *
 * Kept apart from a section's own fields (`SectionInstance.style`, not
 * `.settings`) so that no section schema has to repeat them, and so that a
 * layout saved before they existed reads as the look it always had: every
 * default below is "exactly as before".
 */

import { SECTION_STAGGER_ENABLED, SECTION_STICKY_ENABLED, SECTION_TEXT_SHADOW_ENABLED } from './flags'

import {
  readBoolean,
  readDate,
  readText,
  readVideo,
  type Field,
  type FieldValues,
  type SelectField,
  type VideoRef,
} from './fields'
import type { Localized } from './localized'
import { SCHEME_KEYS, SCHEME_LABELS, type AnimationStyle, type SchemeKey } from './settings'

const SPACING = [
  { value: 'auto', label: { en: 'Automatic', id: 'Otomatis' } },
  { value: 'none', label: { en: 'None', id: 'Tanpa jarak' } },
  { value: 'sm', label: { en: 'Small', id: 'Kecil' } },
  { value: 'md', label: { en: 'Medium', id: 'Sedang' } },
  { value: 'lg', label: { en: 'Large', id: 'Besar' } },
  { value: 'xl', label: { en: 'Extra large', id: 'Sangat besar' } },
] as const

/**
 * How wide a section's content may run, centred in the page.
 *
 * Chakra container sizes, so the vocabulary matches the rest of the system: a
 * hero can run `md`, a product or collection grid `6xl` (the page column the
 * header and footer use), a text column `3xl`, and `full` removes the cap.
 * The default is the page column, so nothing moves until a seller chooses.
 */
export const CONTENT_WIDTHS = [
  { value: 'sm', label: { en: 'Container sm (24rem)', id: 'Kontainer sm (24rem)' } },
  { value: 'md', label: { en: 'Container md (28rem)', id: 'Kontainer md (28rem)' } },
  { value: 'lg', label: { en: 'Container lg (32rem)', id: 'Kontainer lg (32rem)' } },
  { value: 'xl', label: { en: 'Container xl (36rem)', id: 'Kontainer xl (36rem)' } },
  { value: '2xl', label: { en: 'Container 2xl (42rem)', id: 'Kontainer 2xl (42rem)' } },
  { value: '3xl', label: { en: 'Container 3xl (48rem)', id: 'Kontainer 3xl (48rem)' } },
  { value: '4xl', label: { en: 'Container 4xl (56rem)', id: 'Kontainer 4xl (56rem)' } },
  { value: '5xl', label: { en: 'Container 5xl (64rem)', id: 'Kontainer 5xl (64rem)' } },
  {
    value: '6xl',
    label: { en: 'Page width (6xl, 72rem)', id: 'Lebar halaman (6xl, 72rem)' },
  },
  { value: '7xl', label: { en: 'Container 7xl (80rem)', id: 'Kontainer 7xl (80rem)' } },
  { value: 'full', label: { en: 'No limit', id: 'Tanpa batas' } },
] as const
export type SectionContentWidth = (typeof CONTENT_WIDTHS)[number]['value']

const CONTENT_WIDTH_VALUES = CONTENT_WIDTHS.map((option) => option.value)

export function isContentWidth(value: unknown): value is SectionContentWidth {
  return typeof value === 'string' && (CONTENT_WIDTH_VALUES as readonly string[]).includes(value)
}

export const BACKGROUND_TYPES = ['default', 'gradient', 'pattern', 'image', 'video'] as const
export type BackgroundType = (typeof BACKGROUND_TYPES)[number]

/** How a photo or video background is dimmed so the words on it stay readable. */
export const SURFACE_OVERLAYS = [
  { value: 'none', label: { en: 'None', id: 'Tidak ada' } },
  { value: 'light', label: { en: 'Light', id: 'Ringan' } },
  { value: 'dark', label: { en: 'Dark', id: 'Gelap' } },
  { value: 'strong', label: { en: 'Strong', id: 'Kuat' } },
] as const
export type SurfaceOverlay = (typeof SURFACE_OVERLAYS)[number]['value']

export const BACKGROUND_GRADIENTS = [
  { value: 'subtle-warm', label: { en: 'Subtle Warm', id: 'Hangat Lembut' } },
  { value: 'subtle-cool', label: { en: 'Subtle Cool', id: 'Sejuk Lembut' } },
  { value: 'sunset', label: { en: 'Sunset Glow', id: 'Senja Bercahaya' } },
  { value: 'ocean', label: { en: 'Ocean Breeze', id: 'Semilir Samudra' } },
  { value: 'radial-glow', label: { en: 'Radial Glow', id: 'Pendar Memusat' } },
  { value: 'mesh', label: { en: 'Aurora Mesh', id: 'Aurora Mesh' } },
] as const
export type BackgroundGradient = (typeof BACKGROUND_GRADIENTS)[number]['value']

export const BACKGROUND_PATTERNS = [
  { value: 'none', label: { en: 'None', id: 'Tanpa pola' } },
  { value: 'dots', label: { en: 'Subtle Dots', id: 'Titik-titik Halus' } },
  { value: 'grid', label: { en: 'Blueprint Grid', id: 'Garis Kisi' } },
  { value: 'stripes', label: { en: 'Diagonal Stripes', id: 'Garis Diagonal' } },
  { value: 'grain', label: { en: 'Film Grain', id: 'Butiran Film' } },
  { value: 'aurora', label: { en: 'Aurora Drift', id: 'Aurora Mengalir' } },
] as const
export type BackgroundPattern = (typeof BACKGROUND_PATTERNS)[number]['value']

export const DIVIDER_SHAPES = [
  { value: 'none', label: { en: 'None', id: 'Tanpa pembatas' } },
  { value: 'wave', label: { en: 'Gentle Wave', id: 'Gelombang Halus' } },
  { value: 'slant', label: { en: 'Modern Slant', id: 'Garis Miring' } },
  { value: 'curve', label: { en: 'Smooth Curve', id: 'Lengkung Halus' } },
  { value: 'arc', label: { en: 'Inverted Arc', id: 'Busur Melengkung' } },
  { value: 'zigzag', label: { en: 'Dynamic Zigzag', id: 'Gerigi Zigzag' } },
] as const
export type DividerShape = (typeof DIVIDER_SHAPES)[number]['value']

/**
 * What a divider's shape is painted with. `auto` mirrors the section's own
 * background — which is invisible when the two sections it sits between share
 * a colour, as plain sections do on a dark page — so a seller can pick one of
 * the theme's bands instead and always see the shape.
 */
export const DIVIDER_TONES = [
  { value: 'auto', label: { en: 'Section background', id: 'Latar bagian' } },
  { value: 'subtle', label: SCHEME_LABELS.subtle },
  { value: 'inverse', label: SCHEME_LABELS.inverse },
  { value: 'brand', label: SCHEME_LABELS.brand },
  { value: 'accent', label: SCHEME_LABELS.accent },
] as const
export type DividerTone = (typeof DIVIDER_TONES)[number]['value']

/**
 * How a section enters as it scrolls into view. `default` follows the theme;
 * everything else is an explicit override, and `subtle`/`slide-up`/
 * `expressive` keep the entrance a layout saved before GSAP already had.
 */
export const MOTION_OVERRIDES = [
  { value: 'default', label: { en: 'Theme default', id: 'Ikuti tema' } },
  { value: 'none', label: { en: 'None (static)', id: 'Tanpa animasi' } },
  { value: 'fade', label: { en: 'Fade in', id: 'Memudar masuk' } },
  { value: 'subtle', label: { en: 'Subtle fade in', id: 'Muncul perlahan' } },
  { value: 'slide-up', label: { en: 'Rise & settle', id: 'Naik & menetap' } },
  { value: 'zoom', label: { en: 'Zoom in', id: 'Membesar masuk' } },
  { value: 'blur', label: { en: 'Blur in', id: 'Fokus perlahan' } },
  { value: 'expressive', label: { en: 'Expressive zoom', id: 'Zoom ekspresif' } },
] as const
export type SectionMotion = (typeof MOTION_OVERRIDES)[number]['value']

/** The motion values that actually animate — the tuning controls follow these. */
export const MOTION_ENTRANCES = MOTION_OVERRIDES.filter(
  (motion) => motion.value !== 'default' && motion.value !== 'none',
)

export const MOTION_DURATIONS = [
  { value: 'fast', label: { en: 'Fast', id: 'Cepat' } },
  { value: 'normal', label: { en: 'Normal', id: 'Normal' } },
  { value: 'slow', label: { en: 'Slow', id: 'Lambat' } },
] as const
export type MotionDuration = (typeof MOTION_DURATIONS)[number]['value']

export const MOTION_DISTANCES = [
  { value: 'short', label: { en: 'Short', id: 'Pendek' } },
  { value: 'medium', label: { en: 'Medium', id: 'Sedang' } },
  { value: 'long', label: { en: 'Long', id: 'Jauh' } },
] as const
export type MotionDistance = (typeof MOTION_DISTANCES)[number]['value']

export const MOTION_DELAYS = [
  { value: 'none', label: { en: 'None', id: 'Tidak ada' } },
  { value: 'short', label: { en: 'Short', id: 'Singkat' } },
  { value: 'medium', label: { en: 'Medium', id: 'Sedang' } },
  { value: 'long', label: { en: 'Long', id: 'Lama' } },
] as const
export type MotionDelay = (typeof MOTION_DELAYS)[number]['value']

export const HEADLINE_ANIMATIONS = [
  { value: 'none', label: { en: 'None', id: 'Tidak ada' } },
  { value: 'rise', label: { en: 'Words rise', id: 'Kata muncul' } },
] as const
export type SectionHeadline = (typeof HEADLINE_ANIMATIONS)[number]['value']

/**
 * How a photo fills the frame it is cropped into — `object-fit` in words.
 * Shared by a section's background photo and the Image block, so both crops
 * are described the same way.
 */
export const PHOTO_FITS = [
  { value: 'cover', label: { en: 'Fill the frame', id: 'Penuhi bingkai' } },
  { value: 'contain', label: { en: 'Fit inside', id: 'Muat seluruhnya' } },
  { value: 'fill', label: { en: 'Stretch to fit', id: 'Regangkan penuh' } },
  { value: 'none', label: { en: 'Actual size', id: 'Ukuran asli' } },
] as const
export type PhotoFit = (typeof PHOTO_FITS)[number]['value']
export const PHOTO_FIT_VALUES = PHOTO_FITS.map((option) => option.value)

/**
 * Which part of the photo stays in view when it is cropped — `object-position`
 * in words: the middle, an edge, or a corner.
 */
export const PHOTO_POSITIONS = [
  { value: 'center', label: { en: 'Centre', id: 'Tengah' } },
  { value: 'top', label: { en: 'Top', id: 'Atas' } },
  { value: 'bottom', label: { en: 'Bottom', id: 'Bawah' } },
  { value: 'left', label: { en: 'Left', id: 'Kiri' } },
  { value: 'right', label: { en: 'Right', id: 'Kanan' } },
  { value: 'left top', label: { en: 'Top left', id: 'Kiri atas' } },
  { value: 'right top', label: { en: 'Top right', id: 'Kanan atas' } },
  { value: 'left bottom', label: { en: 'Bottom left', id: 'Kiri bawah' } },
  { value: 'right bottom', label: { en: 'Bottom right', id: 'Kanan bawah' } },
] as const
export type PhotoPosition = (typeof PHOTO_POSITIONS)[number]['value']
export const PHOTO_POSITION_VALUES = PHOTO_POSITIONS.map((option) => option.value)

/**
 * The two fields every photo frame offers — how the picture fills it, and
 * which part stays in view. Defined once so a banner, a section background
 * and the Image block all say "Image size" and "Image position", read the
 * same keys, and resolve through the same tokens.
 */
export const photoFitField: SelectField = {
  kind: 'select',
  key: 'fit',
  label: { en: 'Image size', id: 'Ukuran gambar' },
  help: {
    en: 'How the photo fills the frame.',
    id: 'Cara foto memenuhi bingkai.',
  },
  options: PHOTO_FITS,
  default: 'cover',
}

export const photoPositionField: SelectField = {
  kind: 'select',
  key: 'position',
  label: { en: 'Image position', id: 'Posisi gambar' },
  options: PHOTO_POSITIONS,
  default: 'center',
}

/**
 * How many slides stand in view at once, as the slider's own scale. Whole
 * steps are rows of cards; the fractional ones leave the next slide peeking —
 * 1.5 is half of the one after, 3.2 a sliver of the fourth. Phones walk the
 * same idea on a shorter ladder: three cards across a phone is already a
 * thumbnail.
 */
export const SLIDES_PER_VIEW = [
  '1',
  '1.2',
  '1.5',
  '2',
  '2.2',
  '2.5',
  '3',
  '3.2',
  '3.5',
  '4',
  '4.5',
  '5',
  '5.5',
  '6',
] as const

export const SLIDES_PER_VIEW_MOBILE = ['1', '1.2', '1.5', '2', '2.2', '2.5', '3'] as const

/**
 * The banner's own scale stops at three across on every screen: a fourth slice
 * of an ultra-wide band is a thumbnail, not a banner. Older saved settings
 * above it are clamped to three by the renderer.
 */
export const BANNER_SLIDES_PER_VIEW = SLIDES_PER_VIEW_MOBILE

/**
 * The shape of the banner slider's whole band. The photos fill it with a
 * cover crop, so a seller uploads one ratio across the slides; the desktop
 * and phone values are separate because a phone band usually wants to be
 * taller than a wide desktop hero.
 */
export const BANNER_BAND_SHAPES = [
  { value: '16/5', label: { en: 'Wide (16:5)', id: 'Lebar (16:5)' } },
  { value: '16/9', label: { en: 'Standard (16:9)', id: 'Standar (16:9)' } },
  { value: '2/1', label: { en: 'Cinema (2:1)', id: 'Sinema (2:1)' } },
  { value: '21/9', label: { en: 'Ultra wide (21:9)', id: 'Ultra lebar (21:9)' } },
  { value: '3/1', label: { en: 'Panoramic (3:1)', id: 'Panorama (3:1)' } },
  { value: '1/1', label: { en: 'Square (1:1)', id: 'Persegi (1:1)' } },
] as const

export const BANNER_BAND_SHAPE_VALUES = BANNER_BAND_SHAPES.map((option) => option.value)

/** The slides-per-view choice, shared by every slider that offers one. */
export function slidesField(
  key: string,
  label: Localized,
  values: readonly string[],
  fallback: string,
): SelectField {
  return {
    kind: 'select',
    key,
    label,
    options: values.map((value) => ({ value, label: { en: value, id: value } })),
    default: fallback,
  }
}

export const SECTION_STYLE_FIELDS: readonly Field[] = [
  {
    kind: 'select',
    key: 'colorScheme',
    label: { en: 'Colour scheme', id: 'Skema warna' },
    help: {
      en: 'Colours live in the Theme tab.',
      id: 'Warnanya ada di tab Tema.',
    },
    options: (['default', ...SCHEME_KEYS] as const).map((value) => ({
      value,
      label: SCHEME_LABELS[value],
    })),
    default: 'default',
  },
  {
    kind: 'select',
    key: 'backgroundType',
    label: { en: 'Surface texture', id: 'Tekstur latar' },
    options: [
      { value: 'default', label: { en: 'Solid / Scheme', id: 'Warna polos / skema' } },
      { value: 'gradient', label: { en: 'Gradient', id: 'Gradasi' } },
      { value: 'pattern', label: { en: 'Pattern texture', id: 'Tekstur pola' } },
    ],
    default: 'default',
  },
  {
    kind: 'select',
    key: 'backgroundGradient',
    label: { en: 'Gradient style', id: 'Gaya gradasi' },
    options: BACKGROUND_GRADIENTS,
    default: 'subtle-warm',
    showWhen: { key: 'backgroundType', is: ['gradient'] },
  },
  {
    kind: 'select',
    key: 'backgroundPattern',
    label: { en: 'Pattern overlay', id: 'Lapisan pola' },
    options: BACKGROUND_PATTERNS,
    default: 'none',
    showWhen: { key: 'backgroundType', is: ['pattern'] },
  },
  {
    kind: 'image',
    key: 'backgroundImage',
    label: { en: 'Background image', id: 'Gambar latar' },
    help: {
      en: 'Also the video’s poster.',
      id: 'Sekaligus poster videonya.',
    },
    showWhen: { key: 'backgroundType', is: ['image', 'video'] },
  },
  {
    kind: 'select',
    key: 'backgroundSize',
    label: { en: 'Image size', id: 'Ukuran gambar' },
    help: {
      en: 'How the photo fills the section.',
      id: 'Cara foto memenuhi bagian.',
    },
    options: PHOTO_FITS,
    default: 'cover',
    showWhen: { key: 'backgroundType', is: ['image', 'video'] },
  },
  {
    kind: 'select',
    key: 'backgroundPosition',
    label: { en: 'Image position', id: 'Posisi gambar' },
    options: PHOTO_POSITIONS,
    default: 'center',
    showWhen: { key: 'backgroundType', is: ['image', 'video'] },
  },
  {
    kind: 'video',
    key: 'backgroundVideo',
    label: { en: 'Background video', id: 'Video latar' },
    uploadOnly: true,
    showWhen: { key: 'backgroundType', is: ['video'] },
  },
  {
    kind: 'select',
    key: 'backgroundOverlay',
    label: { en: 'Image shade', id: 'Peredup gambar' },
    help: {
      en: 'Keeps text readable over it.',
      id: 'Menjaga teks tetap terbaca.',
    },
    options: SURFACE_OVERLAYS,
    default: 'light',
    showWhen: { key: 'backgroundType', is: ['image', 'video'] },
  },
  {
    kind: 'boolean',
    key: 'textShadow',
    label: { en: 'Lift text over the image', id: 'Angkat teks di atas gambar' },
    help: {
      en: 'A soft shadow behind the text.',
      id: 'Bayangan halus di belakang teks.',
    },
    default: false,
  },
  {
    kind: 'boolean',
    key: 'sticky',
    label: { en: 'Stick while scrolling', id: 'Menempel saat digulir' },
    help: {
      en: 'Holds at the top while the next section scrolls over.',
      id: 'Menahan di atas saat bagian berikut bergulir.',
    },
    default: false,
  },
  {
    kind: 'select',
    key: 'dividerTop',
    label: { en: 'Top divider', id: 'Pembatas atas' },
    options: DIVIDER_SHAPES,
    default: 'none',
  },
  {
    kind: 'select',
    key: 'dividerBottom',
    label: { en: 'Bottom divider', id: 'Pembatas bawah' },
    options: DIVIDER_SHAPES,
    default: 'none',
  },
  {
    kind: 'select',
    key: 'dividerTone',
    label: { en: 'Divider colour', id: 'Warna pembatas' },
    help: {
      en: 'Automatic matches the section. Pick a band when neighbours share its colour.',
      id: 'Otomatis mengikuti bagian. Pilih warna bila sekitarnya sewarna.',
    },
    options: DIVIDER_TONES,
    default: 'auto',
  },
  {
    kind: 'select',
    key: 'motion',
    label: { en: 'Section motion', id: 'Animasi bagian' },
    options: MOTION_OVERRIDES,
    default: 'default',
  },
  {
    kind: 'select',
    key: 'motionDuration',
    label: { en: 'Entrance speed', id: 'Kecepatan animasi' },
    options: MOTION_DURATIONS,
    default: 'normal',
    showWhen: { key: 'motion', is: MOTION_ENTRANCES.map((motion) => motion.value) },
  },
  {
    kind: 'select',
    key: 'motionDistance',
    label: { en: 'Entrance distance', id: 'Jarak animasi' },
    help: {
      en: 'How far it travels. Fade and zoom ignore it.',
      id: 'Seberapa jauh bergerak. Memudar dan membesar mengabaikannya.',
    },
    options: MOTION_DISTANCES,
    default: 'medium',
    showWhen: { key: 'motion', is: MOTION_ENTRANCES.map((motion) => motion.value) },
  },
  {
    kind: 'select',
    key: 'motionDelay',
    label: { en: 'Entrance delay', id: 'Jeda animasi' },
    options: MOTION_DELAYS,
    default: 'none',
    showWhen: { key: 'motion', is: MOTION_ENTRANCES.map((motion) => motion.value) },
  },
  {
    kind: 'select',
    key: 'headline',
    label: { en: 'Heading animation', id: 'Animasi judul' },
    help: {
      en: 'Rises word by word. The preview shows the final text.',
      id: 'Muncul kata per kata. Pratinjau menampilkan teks akhir.',
    },
    options: HEADLINE_ANIMATIONS,
    default: 'none',
  },
  {
    kind: 'boolean',
    key: 'stagger',
    label: { en: 'Stagger entrance', id: 'Muncul berurutan' },
    help: {
      en: 'Blocks enter one after another.',
      id: 'Blok muncul satu per satu.',
    },
    default: false,
  },
  {
    kind: 'select',
    key: 'width',
    label: { en: 'Section width', id: 'Lebar bagian' },
    options: [
      { value: 'contained', label: { en: 'Page width', id: 'Selebar halaman' } },
      {
        value: 'full',
        label: { en: 'Full-width background', id: 'Latar selebar layar' },
      },
      { value: 'edge', label: { en: 'Edge to edge', id: 'Penuh dari tepi ke tepi' } },
    ],
    help: {
      en: 'Text stays in the column; edge to edge lets photos and video span the screen.',
      id: 'Teks tetap di kolom; penuh tepi ke tepi untuk media selebar layar.',
    },
    default: 'contained',
  },
  {
    kind: 'select',
    key: 'contentWidth',
    label: { en: 'Content width', id: 'Lebar konten' },
    options: CONTENT_WIDTHS,
    help: {
      en: 'How wide the content runs, centred. Page width lines up with the header.',
      id: 'Seberapa lebar konten, dipusatkan. Lebar halaman sejajar dengan header.',
    },
    default: '6xl',
  },
  {
    kind: 'select',
    key: 'paddingTop',
    label: { en: 'Space above', id: 'Jarak atas' },
    options: SPACING,
    default: 'auto',
  },
  {
    kind: 'select',
    key: 'paddingBottom',
    label: { en: 'Space below', id: 'Jarak bawah' },
    options: SPACING,
    default: 'auto',
  },
  {
    kind: 'select',
    key: 'visibility',
    label: { en: 'Show on', id: 'Tampil di' },
    options: [
      { value: 'all', label: { en: 'All devices', id: 'Semua perangkat' } },
      { value: 'mobile', label: { en: 'Phones only', id: 'Hanya ponsel' } },
      {
        value: 'desktop',
        label: { en: 'Tablets and desktops only', id: 'Hanya tablet & desktop' },
      },
    ],
    default: 'all',
  },
  {
    kind: 'datetime',
    key: 'showFrom',
    label: { en: 'Show from', id: 'Tampil mulai' },
    help: {
      en: 'Appears from this time.',
      id: 'Muncul mulai waktu ini.',
    },
  },
  {
    kind: 'datetime',
    key: 'showUntil',
    label: { en: 'Show until', id: 'Tampil sampai' },
    help: {
      en: 'Disappears after this time.',
      id: 'Hilang setelah waktu ini.',
    },
  },
]

/**
 * How the Style tab folds `SECTION_STYLE_FIELDS`: a few named groups, each
 * closed to a one-line summary, so the tab opens as four rows instead of a
 * column of twenty dropdowns. Every style field outside "Visibility" sits in
 * exactly one group.
 */
export const SECTION_STYLE_GROUPS: ReadonlyArray<{
  key: string
  label: Localized
  keys: readonly string[]
}> = [
  {
    key: 'surface',
    label: { en: 'Colour and background', id: 'Warna & latar' },
    keys: [
      'colorScheme',
      'backgroundType',
      'backgroundGradient',
      'backgroundPattern',
      'backgroundImage',
      'backgroundSize',
      'backgroundPosition',
      'backgroundVideo',
      'backgroundOverlay',
      'textShadow',
    ],
  },
  {
    key: 'size',
    label: { en: 'Width and spacing', id: 'Lebar & jarak' },
    keys: ['width', 'contentWidth', 'paddingTop', 'paddingBottom', 'sticky'],
  },
  {
    key: 'dividers',
    label: { en: 'Dividers', id: 'Pembatas' },
    keys: ['dividerTop', 'dividerBottom', 'dividerTone'],
  },
  {
    key: 'motion',
    label: { en: 'Motion', id: 'Animasi' },
    keys: ['motion', 'motionDuration', 'motionDistance', 'motionDelay', 'headline', 'stagger'],
  },
]

/** The keys of the style fields shown under "Visibility" rather than "Style". */
export const VISIBILITY_STYLE_KEYS = ['visibility', 'showFrom', 'showUntil'] as const

/**
 * Style keys the editor does not offer, because their features are built but
 * switched off — see the `SECTION_*_ENABLED` flags.
 *
 * Nothing is deleted when one lands here: the field, the sanitiser and the
 * renderer all keep working, the stored value survives every save, and the
 * day its flag flips back to `true` the toggle returns with the layout it
 * always had.
 */
export const SWITCHED_OFF_STYLE_KEYS: readonly string[] = [
  ...(SECTION_STICKY_ENABLED ? [] : ['sticky']),
  ...(SECTION_TEXT_SHADOW_ENABLED ? [] : ['textShadow']),
  ...(SECTION_STAGGER_ENABLED ? [] : ['stagger']),
]

export type SectionSpacing = (typeof SPACING)[number]['value']
export type SectionWidth = 'contained' | 'full' | 'edge'
export type SectionVisibility = 'all' | 'mobile' | 'desktop'

export interface ResolvedSectionStyle {
  scheme: SchemeKey | null
  backgroundType: BackgroundType
  backgroundGradient: BackgroundGradient
  backgroundPattern: BackgroundPattern
  /** A media file id for an image background, or the poster of a video one. */
  backgroundImageId: string
  /** How the background photo fills the section. */
  backgroundSize: PhotoFit
  /** Which part of it stays in view. */
  backgroundPosition: PhotoPosition
  /** An uploaded file behind the section; embeds cannot loop silently. */
  backgroundVideo: VideoRef | null
  backgroundOverlay: SurfaceOverlay
  textShadow: boolean
  sticky: boolean
  dividerTop: DividerShape
  dividerBottom: DividerShape
  dividerTone: DividerTone
  motion: SectionMotion
  motionDuration: MotionDuration
  motionDistance: MotionDistance
  motionDelay: MotionDelay
  headline: SectionHeadline
  stagger: boolean
  width: SectionWidth
  /** The cap on the content's width, inside whatever the section's `width` paints. */
  contentWidth: SectionContentWidth
  paddingTop: SectionSpacing
  paddingBottom: SectionSpacing
  visibility: SectionVisibility
  showFrom: Date | null
  showUntil: Date | null
}

/**
 * A stored select value, or `fallback` when it is missing or not one of the
 * allowed options. Every style option reads through this, so a value saved by
 * an older or newer release degrades to "exactly as before".
 */
function readOption<T extends string>(
  style: FieldValues,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = readText(style, key)
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

export function readSectionStyle(style: FieldValues): ResolvedSectionStyle {
  const scheme = readText(style, 'colorScheme')
  const width = readText(style, 'width')
  const visibility = readText(style, 'visibility')

  return {
    scheme: (SCHEME_KEYS as readonly string[]).includes(scheme) ? (scheme as SchemeKey) : null,
    backgroundType: readOption(style, 'backgroundType', BACKGROUND_TYPES, 'default'),
    backgroundGradient: readOption(
      style,
      'backgroundGradient',
      BACKGROUND_GRADIENTS.map((gradient) => gradient.value),
      'subtle-warm',
    ),
    backgroundPattern: readOption(
      style,
      'backgroundPattern',
      BACKGROUND_PATTERNS.map((pattern) => pattern.value),
      'none',
    ),
    backgroundImageId: readText(style, 'backgroundImage'),
    backgroundSize: readOption(style, 'backgroundSize', PHOTO_FIT_VALUES, 'cover'),
    backgroundPosition: readOption(style, 'backgroundPosition', PHOTO_POSITION_VALUES, 'center'),
    backgroundVideo: readVideo(style, 'backgroundVideo'),
    backgroundOverlay: readOption(
      style,
      'backgroundOverlay',
      SURFACE_OVERLAYS.map((overlay) => overlay.value),
      'light',
    ),
    textShadow: readBoolean(style, 'textShadow'),
    sticky: readBoolean(style, 'sticky'),
    dividerTop: readOption(
      style,
      'dividerTop',
      DIVIDER_SHAPES.map((divider) => divider.value),
      'none',
    ),
    dividerBottom: readOption(
      style,
      'dividerBottom',
      DIVIDER_SHAPES.map((divider) => divider.value),
      'none',
    ),
    dividerTone: readOption(
      style,
      'dividerTone',
      DIVIDER_TONES.map((tone) => tone.value),
      'auto',
    ),
    motion: readOption(
      style,
      'motion',
      MOTION_OVERRIDES.map((motion) => motion.value),
      'default',
    ),
    motionDuration: readOption(
      style,
      'motionDuration',
      MOTION_DURATIONS.map((duration) => duration.value),
      'normal',
    ),
    motionDistance: readOption(
      style,
      'motionDistance',
      MOTION_DISTANCES.map((distance) => distance.value),
      'medium',
    ),
    motionDelay: readOption(
      style,
      'motionDelay',
      MOTION_DELAYS.map((delay) => delay.value),
      'none',
    ),
    headline: readOption(
      style,
      'headline',
      HEADLINE_ANIMATIONS.map((animation) => animation.value),
      'none',
    ),
    stagger: readBoolean(style, 'stagger'),
    width: width === 'full' || width === 'edge' ? width : 'contained',
    contentWidth: readOption(style, 'contentWidth', CONTENT_WIDTH_VALUES, '6xl'),
    paddingTop: readOption(
      style,
      'paddingTop',
      SPACING.map((option) => option.value),
      'auto',
    ),
    paddingBottom: readOption(
      style,
      'paddingBottom',
      SPACING.map((option) => option.value),
      'auto',
    ),
    visibility: visibility === 'mobile' || visibility === 'desktop' ? visibility : 'all',
    showFrom: readDate(style, 'showFrom'),
    showUntil: readDate(style, 'showUntil'),
  }
}

/** Whether a section's dates put it on the storefront at `now`. */
export function isWithinSchedule(style: ResolvedSectionStyle, now: Date): boolean {
  if (style.showFrom && now < style.showFrom) return false
  if (style.showUntil && now >= style.showUntil) return false
  return true
}

/** What the editor says about a section's schedule, for the badge in the list. */
export function scheduleState(
  style: ResolvedSectionStyle,
  now: Date,
): 'always' | 'scheduled' | 'live' | 'ended' {
  if (!style.showFrom && !style.showUntil) return 'always'
  if (style.showUntil && now >= style.showUntil) return 'ended'
  if (style.showFrom && now < style.showFrom) return 'scheduled'
  return 'live'
}

export const SCHEDULE_LABELS: Record<'scheduled' | 'live' | 'ended', Localized> = {
  scheduled: { en: 'Scheduled', id: 'Terjadwal' },
  live: { en: 'Timed', id: 'Berjangka' },
  ended: { en: 'Ended', id: 'Berakhir' },
}

/* -------------------------------------------------------------------------- */
/* Entrances                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * A section's entrance, resolved to the numbers GSAP animates. `opacity`,
 * `y`, `scale` and `blur` are the from-state; the tween ends at the element's
 * natural state. `imageScale` additionally eases photos inside the section
 * down from a slight zoom.
 */
export interface EntrancePreset {
  /** Identity for effect dependencies: two equal settings share one. */
  key: string
  opacity: number
  y: number
  scale: number
  blur: number
  imageScale: number
  /** Seconds. */
  duration: number
  /** Seconds before the entrance starts. */
  delay: number
  /** Seconds between children when the section staggers. */
  stagger: number
  /** A GSAP ease name. */
  ease: string
}

interface EntranceSpec {
  opacity: number
  y: number
  scale: number
  blur: number
  imageScale: number
  duration: number
  ease: string
}

/** The look of each explicit entrance, tuned by the seller's controls. */
const ENTRANCES: Record<Exclude<SectionMotion, 'default' | 'none'>, EntranceSpec> = {
  fade: { opacity: 0, y: 0, scale: 1, blur: 0, imageScale: 1, duration: 0.6, ease: 'power2.out' },
  subtle: {
    opacity: 0,
    y: 16,
    scale: 1,
    blur: 0,
    imageScale: 1,
    duration: 0.6,
    ease: 'power2.out',
  },
  'slide-up': {
    opacity: 0,
    y: 48,
    scale: 1,
    blur: 0,
    imageScale: 1,
    duration: 0.7,
    ease: 'power3.out',
  },
  zoom: {
    opacity: 0,
    y: 0,
    scale: 0.94,
    blur: 0,
    imageScale: 1,
    duration: 0.7,
    ease: 'power3.out',
  },
  blur: { opacity: 0, y: 12, scale: 1, blur: 12, imageScale: 1, duration: 0.8, ease: 'power2.out' },
  expressive: {
    opacity: 0,
    y: 48,
    scale: 0.98,
    blur: 0,
    imageScale: 1.06,
    duration: 0.9,
    ease: 'power3.out',
  },
}

/** What the theme's own motion setting means, in entrance terms. */
const THEME_ENTRANCES: Record<AnimationStyle, Exclude<SectionMotion, 'default'> | null> = {
  none: null,
  subtle: 'subtle',
  expressive: 'expressive',
}

const DISTANCE_FACTOR: Record<MotionDistance, number> = { short: 0.5, medium: 1, long: 1.75 }
const DURATION_FACTOR: Record<MotionDuration, number> = { fast: 0.65, normal: 1, slow: 1.6 }
const DELAY_SECONDS: Record<MotionDelay, number> = { none: 0, short: 0.1, medium: 0.25, long: 0.5 }
const STAGGER_SECONDS = 0.08

/**
 * An entrance's numbers, from its name and the seller's tuning. Shared by
 * sections and blocks: a block's own entrance follows the same scale, so a
 * card and the band around it cannot disagree on what "slow" means.
 */
export function entrancePreset(
  motion: Exclude<SectionMotion, 'default' | 'none'>,
  duration: MotionDuration,
  distance: MotionDistance,
  delay: MotionDelay,
  stagger = false,
): EntrancePreset {
  const spec = ENTRANCES[motion]
  return {
    key: [motion, duration, distance, delay, stagger ? 'stagger' : 'plain'].join(':'),
    opacity: spec.opacity,
    y: spec.y * DISTANCE_FACTOR[distance],
    scale: spec.scale,
    blur: spec.blur,
    imageScale: spec.imageScale,
    duration: spec.duration * DURATION_FACTOR[duration],
    delay: DELAY_SECONDS[delay],
    stagger: stagger ? STAGGER_SECONDS : 0,
    ease: spec.ease,
  }
}

/**
 * The entrance a section should play, or `null` for none: the section's own
 * motion when set, the theme's otherwise. Staggering implies an entrance — a
 * section that opted out still needs one for its blocks to cascade through.
 */
export function resolveEntrance(
  theme: AnimationStyle,
  style: ResolvedSectionStyle,
): EntrancePreset | null {
  let entrance: SectionMotion | null =
    style.motion === 'default' ? THEME_ENTRANCES[theme] : style.motion
  if (!entrance || entrance === 'none') {
    // Staggering implies an entrance: a section that opted out of motion
    // still needs one for its blocks to cascade through.
    if (!style.stagger) return null
    entrance = 'subtle'
  }

  return entrancePreset(
    entrance,
    style.motionDuration,
    style.motionDistance,
    style.motionDelay,
    style.stagger,
  )
}
