/**
 * The settings every section has, whatever it shows: which colour scheme it
 * wears, how much room it takes, how wide it runs, on which devices it
 * appears, and between which dates.
 *
 * Kept apart from a section's own fields (`SectionInstance.style`, not
 * `.settings`) so that no section schema has to repeat them, and so that a
 * layout saved before they existed reads as the look it always had: every
 * default below is "exactly as before".
 */

import { readDate, readText, type Field, type FieldValues } from './fields'
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
  width: SectionWidth
  paddingTop: SectionSpacing
  paddingBottom: SectionSpacing
  visibility: SectionVisibility
  showFrom: Date | null
  showUntil: Date | null
}

export function readSectionStyle(style: FieldValues): ResolvedSectionStyle {
  const scheme = readText(style, 'colorScheme')
  const width = readText(style, 'width')
  const visibility = readText(style, 'visibility')
  const spacing = (key: string): SectionSpacing => {
    const value = readText(style, key)
    return SPACING.some((option) => option.value === value) ? (value as SectionSpacing) : 'auto'
  }
  return {
    scheme: (SCHEME_KEYS as readonly string[]).includes(scheme) ? (scheme as SchemeKey) : null,
    width: width === 'full' || width === 'edge' ? width : 'contained',
    paddingTop: spacing('paddingTop'),
    paddingBottom: spacing('paddingBottom'),
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
