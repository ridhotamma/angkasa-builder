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

import { readBoolean, readDate, readText, type Field, type FieldValues } from './fields'
import type { Localized } from './localized'
import { SCHEME_KEYS, SCHEME_LABELS, type SchemeKey } from './settings'

const SPACING = [
  { value: 'auto', label: { en: 'Automatic', id: 'Otomatis' } },
  { value: 'none', label: { en: 'None', id: 'Tanpa jarak' } },
  { value: 'sm', label: { en: 'Small', id: 'Kecil' } },
  { value: 'md', label: { en: 'Medium', id: 'Sedang' } },
  { value: 'lg', label: { en: 'Large', id: 'Besar' } },
  { value: 'xl', label: { en: 'Extra large', id: 'Sangat besar' } },
] as const

export const BACKGROUND_TYPES = ['default', 'gradient', 'pattern'] as const
export type BackgroundType = (typeof BACKGROUND_TYPES)[number]

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

export const MOTION_OVERRIDES = [
  { value: 'default', label: { en: 'Theme default', id: 'Ikuti tema' } },
  { value: 'none', label: { en: 'None (static)', id: 'Tanpa animasi' } },
  { value: 'subtle', label: { en: 'Subtle fade in', id: 'Muncul perlahan' } },
  { value: 'slide-up', label: { en: 'Rise & settle', id: 'Naik & menetap' } },
  { value: 'expressive', label: { en: 'Expressive zoom', id: 'Zoom ekspresif' } },
] as const
export type SectionMotion = (typeof MOTION_OVERRIDES)[number]['value']

export const HEADLINE_ANIMATIONS = [
  { value: 'none', label: { en: 'None', id: 'Tidak ada' } },
  { value: 'rise', label: { en: 'Words rise', id: 'Kata muncul' } },
] as const
export type SectionHeadline = (typeof HEADLINE_ANIMATIONS)[number]['value']

export const SECTION_STYLE_FIELDS: readonly Field[] = [
  {
    kind: 'select',
    key: 'colorScheme',
    label: { en: 'Colour scheme', id: 'Skema warna' },
    help: {
      en: 'Set the scheme colours in the Theme tab.',
      id: 'Atur warna skema di tab Tema.',
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
    key: 'motion',
    label: { en: 'Section motion', id: 'Animasi bagian' },
    options: MOTION_OVERRIDES,
    default: 'default',
  },
  {
    kind: 'select',
    key: 'headline',
    label: { en: 'Heading animation', id: 'Animasi judul' },
    help: {
      en: 'The section heading rises word by word. The preview shows the final text.',
      id: 'Judul bagian muncul kata per kata. Pratinjau menampilkan teks akhir.',
    },
    options: HEADLINE_ANIMATIONS,
    default: 'none',
  },
  {
    kind: 'boolean',
    key: 'stagger',
    label: { en: 'Stagger entrance', id: 'Muncul berurutan' },
    help: {
      en: 'Blocks enter one after another instead of all at once. Switches the section to a subtle entrance when motion is off.',
      id: 'Blok-blok muncul satu per satu. Mengalihkan bagian ke animasi halus saat animasi mati.',
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
      en: 'Edge to edge also stretches the content itself — best for banners, videos and galleries.',
      id: 'Penuh dari tepi ke tepi juga melebarkan isinya — cocok untuk banner, video, dan galeri.',
    },
    default: 'contained',
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
      en: 'Optional. Appears from this time.',
      id: 'Opsional. Muncul mulai waktu ini.',
    },
  },
  {
    kind: 'datetime',
    key: 'showUntil',
    label: { en: 'Show until', id: 'Tampil sampai' },
    help: {
      en: 'Optional. Disappears after this time.',
      id: 'Opsional. Hilang setelah waktu ini.',
    },
  },
]

/** The keys of the style fields shown under "Visibility" rather than "Style". */
export const VISIBILITY_STYLE_KEYS = ['visibility', 'showFrom', 'showUntil'] as const

export type SectionSpacing = (typeof SPACING)[number]['value']
export type SectionWidth = 'contained' | 'full' | 'edge'
export type SectionVisibility = 'all' | 'mobile' | 'desktop'

export interface ResolvedSectionStyle {
  scheme: SchemeKey | null
  backgroundType: BackgroundType
  backgroundGradient: BackgroundGradient
  backgroundPattern: BackgroundPattern
  dividerTop: DividerShape
  dividerBottom: DividerShape
  motion: SectionMotion
  headline: SectionHeadline
  stagger: boolean
  width: SectionWidth
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
    motion: readOption(style, 'motion', MOTION_OVERRIDES.map((motion) => motion.value), 'default'),
    headline: readOption(
      style,
      'headline',
      HEADLINE_ANIMATIONS.map((animation) => animation.value),
      'none',
    ),
    stagger: readBoolean(style, 'stagger'),
    width: width === 'full' || width === 'edge' ? width : 'contained',
    paddingTop: readOption(style, 'paddingTop', SPACING.map((option) => option.value), 'auto'),
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
