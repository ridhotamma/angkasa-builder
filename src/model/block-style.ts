/**
 * Per-block style overrides: the CSS a single block may step out on.
 *
 * Every block already draws its size, width, alignment and spacing from the
 * shared scale in `./element-style`. This module adds a second, optional
 * layer on top — a small, **allowlisted** set of CSS properties (position,
 * z-index, background size and position, borders, effects, …) a block can
 * override without touching its section or the theme.
 *
 * Two rules keep it safe and bounded:
 *
 * - Every property is a `Field`, so a value is a token from a fixed list, a
 *   bounded number or a hex colour. Nothing here can carry raw CSS, a URL or
 *   a function — the same reasoning as the Custom section's allowlist.
 * - A default-valued entry is never stored, so a block that overrode nothing
 *   costs nothing and reads as "exactly as before".
 *
 * The editor renders `BLOCK_STYLE_GROUPS` as generated forms; the renderer
 * turns the stored tokens into plain CSS with `blockStyleCss`; the server
 * sanitises the field list like any other. `model/fields.ts` owns the generic
 * `styleFields` handling, so this module stays free of imports from it beyond
 * the values it reads.
 */

import { readText, type Field, type FieldValues } from './fields'
import { readToken, responsiveFontSize } from './element-style'
import type { Localized } from './localized'
import {
  MOTION_DELAYS,
  MOTION_DISTANCES,
  MOTION_DURATIONS,
  MOTION_ENTRANCES,
  entrancePreset,
  type EntrancePreset,
  type SectionMotion,
} from './section-style'

const option = (value: string, label: Localized): { value: string; label: Localized } => ({
  value,
  label,
})

/** The "no override" choice every property starts at. */
const DEFAULT = option('default', { en: 'Default', id: 'Bawaan' })

const POSITIONS = [
  option('static', { en: 'Static', id: 'Statis' }),
  option('relative', { en: 'Relative', id: 'Relatif' }),
  option('absolute', { en: 'Absolute', id: 'Absolut' }),
  option('fixed', { en: 'Fixed', id: 'Tetap di layar' }),
  option('sticky', { en: 'Sticky', id: 'Menempel' }),
]

const Z_INDEXES = [
  option('auto', { en: 'Auto', id: 'Otomatis' }),
  option('0', { en: '0', id: '0' }),
  option('1', { en: '1', id: '1' }),
  option('10', { en: '10', id: '10' }),
  option('20', { en: '20', id: '20' }),
  option('30', { en: '30', id: '30' }),
  option('50', { en: '50', id: '50' }),
  option('100', { en: '100', id: '100' }),
  option('999', { en: '999', id: '999' }),
]

const INSET_VALUES = [
  option('auto', { en: 'Auto', id: 'Otomatis' }),
  option('0', { en: '0', id: '0' }),
  option('1', { en: 'S', id: 'S' }),
  option('2', { en: 'M', id: 'M' }),
  option('4', { en: 'L', id: 'L' }),
  option('6', { en: 'XL', id: 'XL' }),
  option('8', { en: '2XL', id: '2XL' }),
  option('12', { en: '3XL', id: '3XL' }),
  option('16', { en: '4XL', id: '4XL' }),
]

const SPACES = [
  option('none', { en: 'None', id: 'Tidak ada' }),
  option('sm', { en: 'Small', id: 'Kecil' }),
  option('md', { en: 'Medium', id: 'Sedang' }),
  option('lg', { en: 'Large', id: 'Besar' }),
  option('xl', { en: 'Extra large', id: 'Sangat besar' }),
]

const WIDTHS = [
  option('auto', { en: 'Auto', id: 'Otomatis' }),
  option('fit', { en: 'Fit content', id: 'Sesuai isi' }),
  option('25', { en: '25%', id: '25%' }),
  option('50', { en: '50%', id: '50%' }),
  option('75', { en: '75%', id: '75%' }),
  option('100', { en: '100%', id: '100%' }),
]

const MIN_HEIGHTS = [
  option('none', { en: 'None', id: 'Tidak ada' }),
  option('sm', { en: 'Short', id: 'Pendek' }),
  option('md', { en: 'Medium', id: 'Sedang' }),
  option('lg', { en: 'Tall', id: 'Tinggi' }),
  option('xl', { en: 'Extra tall', id: 'Sangat tinggi' }),
  option('screen', { en: 'One screen', id: 'Satu layar' }),
]

const DISPLAYS = [
  option('block', { en: 'Block', id: 'Blok' }),
  option('inline-block', { en: 'Inline block', id: 'Inline blok' }),
  option('flex', { en: 'Flex', id: 'Flex' }),
  option('inline-flex', { en: 'Inline flex', id: 'Inline flex' }),
  option('grid', { en: 'Grid', id: 'Grid' }),
  option('none', { en: 'Hidden', id: 'Tersembunyi' }),
]

const HEIGHTS = [
  option('auto', { en: 'Automatic', id: 'Otomatis' }),
  option('sm', { en: 'Short', id: 'Pendek' }),
  option('md', { en: 'Medium', id: 'Sedang' }),
  option('lg', { en: 'Tall', id: 'Tinggi' }),
  option('xl', { en: 'Extra tall', id: 'Sangat tinggi' }),
  option('full', { en: 'Full height', id: 'Setinggi induk' }),
  option('screen', { en: 'One screen', id: 'Satu layar' }),
]

const MAX_WIDTHS = [
  option('none', { en: 'No limit', id: 'Tanpa batas' }),
  option('sm', { en: 'S', id: 'S' }),
  option('md', { en: 'M', id: 'M' }),
  option('lg', { en: 'L', id: 'L' }),
  option('xl', { en: 'XL', id: 'XL' }),
  option('2xl', { en: '2XL', id: '2XL' }),
  option('3xl', { en: '3XL', id: '3XL' }),
  option('4xl', { en: '4XL', id: '4XL' }),
  option('5xl', { en: '5XL', id: '5XL' }),
  option('6xl', { en: '6XL', id: '6XL' }),
  option('full', { en: 'Full width', id: 'Selebar penuh' }),
]

const MAX_HEIGHTS = [
  option('none', { en: 'No limit', id: 'Tanpa batas' }),
  option('sm', { en: 'Short', id: 'Pendek' }),
  option('md', { en: 'Medium', id: 'Sedang' }),
  option('lg', { en: 'Tall', id: 'Tinggi' }),
  option('xl', { en: 'Extra tall', id: 'Sangat tinggi' }),
  option('screen', { en: 'One screen', id: 'Satu layar' }),
]

const BLEEDS = [
  option('full', {
    en: 'Full bleed — content stretches too',
    id: 'Penuh tepi ke tepi — isinya ikut melebar',
  }),
  option('band', {
    en: 'Full-width band — content in the page column',
    id: 'Pita selebar layar — isi tetap di kolom halaman',
  }),
]

const FONT_SIZES = [
  option('xs', { en: 'Extra small', id: 'Sangat kecil' }),
  option('sm', { en: 'Small', id: 'Kecil' }),
  option('md', { en: 'Medium', id: 'Sedang' }),
  option('lg', { en: 'Large', id: 'Besar' }),
  option('xl', { en: 'Extra large', id: 'Sangat besar' }),
  option('2xl', { en: '2XL', id: '2XL' }),
  option('3xl', { en: '3XL', id: '3XL' }),
  option('4xl', { en: '4XL', id: '4XL' }),
  option('5xl', { en: '5XL', id: '5XL' }),
  option('6xl', { en: '6XL', id: '6XL' }),
]

/**
 * The theme's own colours, as tokens a block override may name.
 *
 * These are the semantic Chakra variables the theme declares (`themeCssVars`)
 * and each section scheme remaps (`schemeCssVars`), so a block that picks one
 * follows the page's palette and the band it sits in — the thing a raw hex
 * cannot do. `accent` is the theme's accent colour (`--pb-accent`).
 */
const THEME_COLOR_OPTIONS = [
  option('fg', { en: 'Page text', id: 'Teks halaman' }),
  option('fg-muted', { en: 'Muted text', id: 'Teks redup' }),
  option('fg-subtle', { en: 'Subtle text', id: 'Teks samar' }),
  option('bg', { en: 'Page background', id: 'Latar halaman' }),
  option('bg-subtle', { en: 'Subtle surface', id: 'Permukaan halus' }),
  option('bg-panel', { en: 'Panel surface', id: 'Permukaan panel' }),
  option('bg-muted', { en: 'Muted surface', id: 'Permukaan redup' }),
  option('brand', { en: 'Brand', id: 'Brand' }),
  option('brand-subtle', { en: 'Brand, soft', id: 'Brand, lembut' }),
  option('brand-emphasized', { en: 'Brand, deep', id: 'Brand, pekat' }),
  option('accent', { en: 'Accent', id: 'Aksen' }),
  option('border', { en: 'Border', id: 'Garis tepi' }),
  option('white', { en: 'White', id: 'Putih' }),
  option('black', { en: 'Black', id: 'Hitam' }),
  option('transparent', { en: 'Transparent', id: 'Transparan' }),
]

const THEME_COLOR: Record<string, string> = {
  fg: 'var(--chakra-colors-fg)',
  'fg-muted': 'var(--chakra-colors-fg-muted)',
  'fg-subtle': 'var(--chakra-colors-fg-subtle)',
  bg: 'var(--chakra-colors-bg)',
  'bg-subtle': 'var(--chakra-colors-bg-subtle)',
  'bg-panel': 'var(--chakra-colors-bg-panel)',
  'bg-muted': 'var(--chakra-colors-bg-muted)',
  brand: 'var(--chakra-colors-brand-solid)',
  'brand-subtle': 'var(--chakra-colors-brand-subtle)',
  'brand-emphasized': 'var(--chakra-colors-brand-emphasized)',
  accent: 'var(--pb-accent)',
  border: 'var(--chakra-colors-border)',
  white: 'white',
  black: 'black',
  transparent: 'transparent',
}

/** The colour a text override may pick; `custom` opens the hex field. */
const TEXT_COLOR: Record<string, string> = { inherit: 'inherit', ...THEME_COLOR }

const TEXT_COLORS = [
  option('inherit', { en: 'Section colour', id: 'Warna bagian' }),
  ...THEME_COLOR_OPTIONS,
  option('custom', { en: 'Custom colour…', id: 'Warna kustom…' }),
]

const FONT_FAMILIES = [
  option('heading', { en: 'Heading font', id: 'Font judul' }),
  option('body', { en: 'Body font', id: 'Font isi' }),
  option('brand', { en: 'Display font', id: 'Font display' }),
]

const FONT_WEIGHTS = [
  option('light', { en: 'Light', id: 'Ringan' }),
  option('normal', { en: 'Normal', id: 'Normal' }),
  option('medium', { en: 'Medium', id: 'Sedang' }),
  option('semibold', { en: 'Semibold', id: 'Semi tebal' }),
  option('bold', { en: 'Bold', id: 'Tebal' }),
]

const LINE_HEIGHTS = [
  option('tight', { en: 'Tight', id: 'Rapat' }),
  option('snug', { en: 'Snug', id: 'Agak rapat' }),
  option('normal', { en: 'Normal', id: 'Normal' }),
  option('relaxed', { en: 'Relaxed', id: 'Renggang' }),
  option('loose', { en: 'Loose', id: 'Sangat renggang' }),
]

const LETTER_SPACINGS = [
  option('tighter', { en: 'Tighter', id: 'Sangat rapat' }),
  option('tight', { en: 'Tight', id: 'Rapat' }),
  option('normal', { en: 'Normal', id: 'Normal' }),
  option('wide', { en: 'Wide', id: 'Lebar' }),
  option('wider', { en: 'Wider', id: 'Lebih lebar' }),
  option('widest', { en: 'Widest', id: 'Paling lebar' }),
]

const TEXT_TRANSFORMS = [
  option('none', { en: 'As typed', id: 'Sesuai ketikan' }),
  option('uppercase', { en: 'UPPERCASE', id: 'HURUF BESAR' }),
  option('lowercase', { en: 'lowercase', id: 'huruf kecil' }),
  option('capitalize', { en: 'Capitalise', id: 'Huruf Awal Besar' }),
]

const FONT_STYLES = [
  option('normal', { en: 'Upright', id: 'Tegak' }),
  option('italic', { en: 'Italic', id: 'Miring' }),
]

const TEXT_DECORATIONS = [
  option('none', { en: 'None', id: 'Tanpa garis' }),
  option('underline', { en: 'Underline', id: 'Garis bawah' }),
  option('line-through', { en: 'Strikethrough', id: 'Coret' }),
]

const TEXT_ALIGNS = [
  option('left', { en: 'Left', id: 'Kiri' }),
  option('center', { en: 'Center', id: 'Tengah' }),
  option('right', { en: 'Right', id: 'Kanan' }),
]

const OVERFLOWS = [
  option('visible', { en: 'Visible', id: 'Terlihat' }),
  option('hidden', { en: 'Hidden', id: 'Terpotong' }),
  option('clip', { en: 'Clip', id: 'Klip' }),
  option('auto', { en: 'Auto scroll', id: 'Gulir otomatis' }),
  option('scroll', { en: 'Always scroll', id: 'Selalu gulir' }),
]

const ASPECTS = [
  option('square', { en: 'Square 1:1', id: 'Persegi 1:1' }),
  option('4/3', { en: 'Landscape 4:3', id: 'Lanskap 4:3' }),
  option('16/9', { en: 'Wide 16:9', id: 'Lebar 16:9' }),
  option('2/1', { en: 'Wide 2:1', id: 'Lebar 2:1' }),
  option('3/4', { en: 'Portrait 3:4', id: 'Potret 3:4' }),
  option('9/16', { en: 'Vertical 9:16', id: 'Vertikal 9:16' }),
]

const BACKGROUND_SIZES = [
  option('auto', { en: 'Natural', id: 'Asli' }),
  option('cover', { en: 'Cover', id: 'Penuh' }),
  option('contain', { en: 'Contain', id: 'Muat' }),
]

const BACKGROUND_REPEATS = [
  option('repeat', { en: 'Repeat', id: 'Ulang' }),
  option('no-repeat', { en: 'No repeat', id: 'Tidak diulang' }),
  option('repeat-x', { en: 'Repeat across', id: 'Ulang mendatar' }),
  option('repeat-y', { en: 'Repeat down', id: 'Ulang menurun' }),
]

const BACKGROUND_ATTACHMENTS = [
  option('scroll', { en: 'Scroll', id: 'Ikut gulir' }),
  option('fixed', { en: 'Fixed', id: 'Tetap' }),
  option('local', { en: 'Local', id: 'Lokal' }),
]

const CORNERS = [
  option('none', { en: 'Square', id: 'Siku' }),
  option('sm', { en: 'Small', id: 'Kecil' }),
  option('md', { en: 'Medium', id: 'Sedang' }),
  option('lg', { en: 'Large', id: 'Besar' }),
  option('xl', { en: 'Extra large', id: 'Sangat besar' }),
  option('full', { en: 'Round', id: 'Bulat' }),
]

const BORDER_WIDTHS = [
  option('0', { en: 'None', id: 'Tidak ada' }),
  option('1', { en: 'Thin', id: 'Tipis' }),
  option('2', { en: 'Medium', id: 'Sedang' }),
  option('4', { en: 'Thick', id: 'Tebal' }),
]

const BORDER_STYLES = [
  option('solid', { en: 'Solid', id: 'Solid' }),
  option('dashed', { en: 'Dashed', id: 'Garis putus' }),
  option('dotted', { en: 'Dotted', id: 'Titik' }),
]

const SHADOWS = [
  option('none', { en: 'None', id: 'Tidak ada' }),
  option('sm', { en: 'Subtle', id: 'Halus' }),
  option('md', { en: 'Medium', id: 'Sedang' }),
  option('lg', { en: 'Large', id: 'Besar' }),
  option('xl', { en: 'Extra large', id: 'Sangat besar' }),
]

const TRANSFORMS = [
  option('none', { en: 'None', id: 'Tidak ada' }),
  option('scale-95', { en: 'Scale 95%', id: 'Skala 95%' }),
  option('scale-105', { en: 'Scale 105%', id: 'Skala 105%' }),
  option('rotate-1', { en: 'Tilt right 1°', id: 'Miring kanan 1°' }),
  option('-rotate-1', { en: 'Tilt left 1°', id: 'Miring kiri 1°' }),
  option('rotate-2', { en: 'Tilt right 2°', id: 'Miring kanan 2°' }),
  option('-rotate-2', { en: 'Tilt left 2°', id: 'Miring kiri 2°' }),
  option('rotate-3', { en: 'Tilt right 3°', id: 'Miring kanan 3°' }),
  option('-rotate-3', { en: 'Tilt left 3°', id: 'Miring kiri 3°' }),
  option('translate-y-1', { en: 'Nudge down S', id: 'Turun S' }),
  option('-translate-y-1', { en: 'Nudge up S', id: 'Naik S' }),
  option('translate-y-2', { en: 'Nudge down M', id: 'Turun M' }),
  option('-translate-y-2', { en: 'Nudge up M', id: 'Naik M' }),
  option('translate-x-1', { en: 'Nudge right S', id: 'Geser kanan S' }),
  option('-translate-x-1', { en: 'Nudge left S', id: 'Geser kiri S' }),
  option('flip-x', { en: 'Flip horizontally', id: 'Balik mendatar' }),
  option('flip-y', { en: 'Flip vertically', id: 'Balik menurun' }),
]

const ORIGINS = [
  option('center', { en: 'Center', id: 'Tengah' }),
  option('top', { en: 'Top', id: 'Atas' }),
  option('bottom', { en: 'Bottom', id: 'Bawah' }),
  option('left', { en: 'Left', id: 'Kiri' }),
  option('right', { en: 'Right', id: 'Kanan' }),
  option('top-left', { en: 'Top left', id: 'Kiri atas' }),
  option('top-right', { en: 'Top right', id: 'Kanan atas' }),
  option('bottom-left', { en: 'Bottom left', id: 'Kiri bawah' }),
  option('bottom-right', { en: 'Bottom right', id: 'Kanan bawah' }),
]

const BLEND_MODES = [
  option('normal', { en: 'Normal', id: 'Normal' }),
  option('multiply', { en: 'Multiply', id: 'Kalikan' }),
  option('screen', { en: 'Screen', id: 'Layar' }),
  option('overlay', { en: 'Overlay', id: 'Overlay' }),
  option('darken', { en: 'Darken', id: 'Gelapkan' }),
  option('lighten', { en: 'Lighten', id: 'Terangkan' }),
  option('color-dodge', { en: 'Color dodge', id: 'Color dodge' }),
  option('color-burn', { en: 'Color burn', id: 'Color burn' }),
  option('hard-light', { en: 'Hard light', id: 'Hard light' }),
  option('soft-light', { en: 'Soft light', id: 'Soft light' }),
  option('difference', { en: 'Difference', id: 'Selisih' }),
  option('exclusion', { en: 'Exclusion', id: 'Eksklusi' }),
  option('hue', { en: 'Hue', id: 'Rona' }),
  option('saturation', { en: 'Saturation', id: 'Saturasi' }),
  option('color', { en: 'Color', id: 'Warna' }),
  option('luminosity', { en: 'Luminosity', id: 'Cahaya' }),
]

const FILTERS = [
  option('none', { en: 'None', id: 'Tidak ada' }),
  option('blur-sm', { en: 'Blur subtly', id: 'Buram halus' }),
  option('blur', { en: 'Blur', id: 'Buram' }),
  option('blur-lg', { en: 'Blur strongly', id: 'Buram kuat' }),
  option('grayscale', { en: 'Greyscale', id: 'Abu-abu' }),
  option('grayscale-50', { en: 'Half greyscale', id: 'Abu-abu separuh' }),
]

const POINTER_EVENTS = [
  option('auto', { en: 'Interactive', id: 'Interaktif' }),
  option('none', { en: 'Click-through', id: 'Dilewati klik' }),
]

const ISOLATION_VALUES = [
  option('auto', { en: 'Auto', id: 'Otomatis' }),
  option('isolate', { en: 'Isolate', id: 'Isolasi' }),
]

const VISIBILITIES = [
  option('visible', { en: 'Visible', id: 'Terlihat' }),
  option('hidden', { en: 'Hidden (keeps space)', id: 'Tersembunyi (tetap berjarak)' }),
]

const select = (
  key: string,
  label: Localized,
  options: ReadonlyArray<{ value: string; label: Localized }>,
): Field => ({ kind: 'select', key, label, options: [DEFAULT, ...options], default: 'default' })

/**
 * A tuning control that only applies while an entrance is picked. The value
 * is still stored when hidden, so switching the entrance off and back
 * restores what the seller had chosen.
 */
const motionSelect = (
  key: string,
  label: Localized,
  options: ReadonlyArray<{ value: string; label: Localized }>,
): Field => ({
  kind: 'select',
  key,
  label,
  options: [DEFAULT, ...options],
  default: 'default',
  showWhen: { key: 'motion', is: MOTION_ENTRANCES.map((entry) => entry.value) },
})

const PARALLAXES = [
  option('soft', { en: 'Soft', id: 'Halus' }),
  option('strong', { en: 'Strong', id: 'Kuat' }),
]

/**
 * The overridable properties, grouped for the editor. Every property is a
 * fixed token list (or a bounded number or hex colour), so a stored style can
 * never carry arbitrary CSS.
 */
export const BLOCK_STYLE_GROUPS: ReadonlyArray<{
  key: string
  label: Localized
  fields: readonly Field[]
}> = [
  {
    key: 'devices',
    label: { en: 'Show on', id: 'Tampil di' },
    fields: [
      {
        kind: 'select',
        key: 'showOn',
        label: { en: 'Show on', id: 'Tampil di' },
        help: {
          en: 'Pair a phones-only block with a desktop-only one to give each screen its own layout.',
          id: 'Pasangkan blok khusus ponsel dengan blok khusus desktop agar tiap layar punya tata letaknya sendiri.',
        },
        // The same split, and the same breakpoint, as a section's "Show on".
        options: [
          option('default', { en: 'All devices', id: 'Semua perangkat' }),
          option('mobile', { en: 'Phones only', id: 'Hanya ponsel' }),
          option('desktop', { en: 'Tablets and desktops only', id: 'Hanya tablet & desktop' }),
        ],
        default: 'default',
      },
    ],
  },
  {
    key: 'layout',
    label: { en: 'Layout', id: 'Tata letak' },
    fields: [
      select('position', { en: 'Position', id: 'Posisi' }, POSITIONS),
      select('zIndex', { en: 'Stack order (z-index)', id: 'Urutan tumpuk (z-index)' }, Z_INDEXES),
      select('inset', { en: 'Offset (all sides)', id: 'Geser (semua sisi)' }, INSET_VALUES),
      select('top', { en: 'Top', id: 'Atas' }, INSET_VALUES),
      select('right', { en: 'Right', id: 'Kanan' }, INSET_VALUES),
      select('bottom', { en: 'Bottom', id: 'Bawah' }, INSET_VALUES),
      select('left', { en: 'Left', id: 'Kiri' }, INSET_VALUES),
      select('width', { en: 'Width', id: 'Lebar' }, WIDTHS),
      select('height', { en: 'Height', id: 'Tinggi' }, HEIGHTS),
      select('minHeight', { en: 'Minimum height', id: 'Tinggi minimum' }, MIN_HEIGHTS),
      select('maxWidth', { en: 'Maximum width', id: 'Lebar maksimum' }, MAX_WIDTHS),
      select('maxHeight', { en: 'Maximum height', id: 'Tinggi maksimum' }, MAX_HEIGHTS),
      select('bleed', { en: 'Full bleed', id: 'Penuh tepi ke tepi' }, BLEEDS),
      select('display', { en: 'Display', id: 'Tampilan' }, DISPLAYS),
      select('aspectRatio', { en: 'Aspect ratio', id: 'Rasio' }, ASPECTS),
      select('overflow', { en: 'Overflow', id: 'Luapan' }, OVERFLOWS),
    ],
  },
  {
    key: 'text',
    label: { en: 'Text', id: 'Teks' },
    fields: [
      select('fontSize', { en: 'Font size', id: 'Ukuran huruf' }, FONT_SIZES),
      select('color', { en: 'Text colour', id: 'Warna teks' }, TEXT_COLORS),
      {
        kind: 'color',
        key: 'textColorCustom',
        label: { en: 'Custom colour', id: 'Warna kustom' },
        default: '',
        showWhen: { key: 'color', is: ['custom'] },
      },
      select('fontFamily', { en: 'Font', id: 'Font' }, FONT_FAMILIES),
      select('fontWeight', { en: 'Weight', id: 'Ketebalan' }, FONT_WEIGHTS),
      select('lineHeight', { en: 'Line height', id: 'Jarak baris' }, LINE_HEIGHTS),
      select('letterSpacing', { en: 'Letter spacing', id: 'Jarak antar huruf' }, LETTER_SPACINGS),
      select('textTransform', { en: 'Letter case', id: 'Huruf besar/kecil' }, TEXT_TRANSFORMS),
      select('fontStyle', { en: 'Italic', id: 'Miring' }, FONT_STYLES),
      select('textDecoration', { en: 'Underline', id: 'Garis' }, TEXT_DECORATIONS),
      select('textAlign', { en: 'Alignment', id: 'Perataan' }, TEXT_ALIGNS),
    ],
  },
  {
    key: 'spacing',
    label: { en: 'Spacing', id: 'Jarak' },
    fields: [
      select('padding', { en: 'Padding', id: 'Jarak dalam' }, SPACES),
      select('paddingX', { en: 'Padding, sides', id: 'Jarak samping' }, SPACES),
      select('paddingY', { en: 'Padding, top and bottom', id: 'Jarak atas-bawah' }, SPACES),
      select('marginTop', { en: 'Space above', id: 'Jarak atas' }, SPACES),
      select('marginBottom', { en: 'Space below', id: 'Jarak bawah' }, SPACES),
    ],
  },
  {
    key: 'background',
    label: { en: 'Background', id: 'Latar' },
    fields: [
      select('backgroundColorTheme', { en: 'Theme colour', id: 'Warna tema' }, THEME_COLOR_OPTIONS),
      {
        kind: 'color',
        key: 'backgroundColor',
        label: { en: 'Custom colour', id: 'Warna kustom' },
        help: {
          en: 'Used when no theme colour is picked.',
          id: 'Dipakai bila tidak ada warna tema yang dipilih.',
        },
        default: '',
      },
      select('backgroundSize', { en: 'Background size', id: 'Ukuran latar' }, BACKGROUND_SIZES),
      select('backgroundPosition', { en: 'Background position', id: 'Posisi latar' }, ORIGINS),
      select(
        'backgroundRepeat',
        { en: 'Background repeat', id: 'Pengulangan latar' },
        BACKGROUND_REPEATS,
      ),
      select(
        'backgroundAttachment',
        { en: 'Background attachment', id: 'Perekat latar' },
        BACKGROUND_ATTACHMENTS,
      ),
    ],
  },
  {
    key: 'border',
    label: { en: 'Border', id: 'Garis tepi' },
    fields: [
      select('borderRadius', { en: 'Corners', id: 'Sudut' }, CORNERS),
      select('borderWidth', { en: 'Border width', id: 'Tebal garis' }, BORDER_WIDTHS),
      select('borderStyle', { en: 'Border style', id: 'Gaya garis' }, BORDER_STYLES),
      select('borderColorTheme', { en: 'Theme colour', id: 'Warna tema' }, THEME_COLOR_OPTIONS),
      {
        kind: 'color',
        key: 'borderColor',
        label: { en: 'Custom colour', id: 'Warna kustom' },
        help: {
          en: 'Used when no theme colour is picked.',
          id: 'Dipakai bila tidak ada warna tema yang dipilih.',
        },
        default: '',
      },
    ],
  },
  {
    key: 'effects',
    label: { en: 'Effects', id: 'Efek' },
    fields: [
      {
        kind: 'number',
        key: 'opacity',
        label: { en: 'Opacity (%)', id: 'Transparansi (%)' },
        min: 0,
        max: 100,
        default: 100,
      },
      select('boxShadow', { en: 'Shadow', id: 'Bayangan' }, SHADOWS),
      select('transform', { en: 'Transform', id: 'Transformasi' }, TRANSFORMS),
      select('transformOrigin', { en: 'Transform origin', id: 'Titik transformasi' }, ORIGINS),
      select('filter', { en: 'Filter', id: 'Filter' }, FILTERS),
      select('mixBlendMode', { en: 'Blend mode', id: 'Mode campur' }, BLEND_MODES),
      select('isolation', { en: 'Blend isolation', id: 'Isolasi campur' }, ISOLATION_VALUES),
      select('pointerEvents', { en: 'Pointer events', id: 'Interaksi klik' }, POINTER_EVENTS),
      select('visibility', { en: 'Visibility', id: 'Visibilitas' }, VISIBILITIES),
    ],
  },
  {
    key: 'motion',
    label: { en: 'Motion', id: 'Animasi' },
    fields: [
      select('motion', { en: 'Entrance', id: 'Animasi masuk' }, MOTION_ENTRANCES),
      motionSelect(
        'motionDuration',
        { en: 'Entrance speed', id: 'Kecepatan animasi' },
        MOTION_DURATIONS,
      ),
      motionSelect(
        'motionDistance',
        { en: 'Entrance distance', id: 'Jarak animasi' },
        MOTION_DISTANCES,
      ),
      motionSelect('motionDelay', { en: 'Entrance delay', id: 'Jeda animasi' }, MOTION_DELAYS),
      select('parallax', { en: 'Scroll parallax', id: 'Paralaks gulir' }, PARALLAXES),
    ],
  },
  {
    key: 'hover',
    label: { en: 'Hover', id: 'Hover' },
    fields: [
      {
        kind: 'select',
        key: 'hoverTrigger',
        label: { en: 'React when', id: 'Bereaksi saat' },
        options: [
          option('self', { en: 'This block is hovered', id: 'Blok ini di-hover' }),
          option('group', {
            en: 'Its card or container is hovered',
            id: 'Kartu/wadahnya di-hover',
          }),
        ],
        help: {
          en: 'The group trigger lets one hover move several parts at once — a card that scales its image and underlines its caption.',
          id: 'Pemicu grup membuat satu hover menggerakkan beberapa bagian sekaligus — kartu yang memperbesar gambarnya dan menggarisbawahi teksnya.',
        },
        default: 'self',
      },
      select('hoverTransform', { en: 'Scale / move', id: 'Skala / geser' }, [
        option('none', { en: 'None', id: 'Tidak ada' }),
        option('scale-105', { en: 'Scale 105%', id: 'Skala 105%' }),
        option('scale-110', { en: 'Scale 110%', id: 'Skala 110%' }),
        option('-translate-y-1', { en: 'Rise slightly', id: 'Naik sedikit' }),
        option('-translate-y-2', { en: 'Rise more', id: 'Naik lebih' }),
      ]),
      select('hoverImageZoom', { en: 'Image zoom', id: 'Zoom gambar' }, [
        option('zoom-in', { en: 'Zoom in', id: 'Perbesar' }),
      ]),
      select('hoverFilter', { en: 'Image filter', id: 'Filter gambar' }, [
        option('none', { en: 'None', id: 'Tidak ada' }),
        option('grayscale', { en: 'Greyscale', id: 'Abu-abu' }),
        option('grayscale-50', { en: 'Half greyscale', id: 'Abu-abu separuh' }),
      ]),
      select('hoverShadow', { en: 'Shadow', id: 'Bayangan' }, SHADOWS),
      select('hoverDecoration', { en: 'Text decoration', id: 'Garis teks' }, TEXT_DECORATIONS),
      select('hoverColor', { en: 'Text colour', id: 'Warna teks' }, TEXT_COLORS),
      {
        kind: 'color',
        key: 'hoverColorCustom',
        label: { en: 'Custom text colour', id: 'Warna teks kustom' },
        default: '',
        showWhen: { key: 'hoverColor', is: ['custom'] },
      },
      select(
        'hoverBackgroundTheme',
        { en: 'Background colour', id: 'Warna latar' },
        THEME_COLOR_OPTIONS,
      ),
      {
        kind: 'color',
        key: 'hoverBackgroundColor',
        label: { en: 'Custom background', id: 'Latar kustom' },
        help: {
          en: 'Used when no theme colour is picked.',
          id: 'Dipakai bila tidak ada warna tema yang dipilih.',
        },
        default: '',
      },
    ],
  },
]

/**
 * The properties a hover reaction may move, listed explicitly — never
 * `transition: all`, which animates layout and janks.
 */
const HOVER_TRANSITION =
  'transform 200ms ease, filter 200ms ease, color 150ms ease, background-color 150ms ease, box-shadow 200ms ease, text-decoration-color 150ms ease'

/** Every overridable property, flattened. What a `BlocksField.styleFields` gets. */
export const BLOCK_STYLE_FIELDS: readonly Field[] = BLOCK_STYLE_GROUPS.flatMap(
  (group) => group.fields,
)

/* -------------------------------------------------------------------------- */
/* Reading                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A plain CSS object, ready for a Chakra `css` prop or a `style` attribute.
 * Values may nest: hover reactions are stored under `&:hover` (or the group
 * selector) as a sub-object.
 */
export interface BlockStyleCss {
  [property: string]: string | number | BlockStyleCss
}

const NO_STYLE: BlockStyleCss = {}

/**
 * The custom property a block's Text colour is mirrored into. It inherits down
 * the tree, so text that names its own colour — a rich-text paragraph's muted
 * ink — can still follow a surrounding block's colour. Read by `RichTextView`.
 */
export const BLOCK_INK_VAR = '--pb-ink'

const INSET: Record<string, string> = {
  auto: 'auto',
  '0': '0',
  '1': '0.25rem',
  '2': '0.5rem',
  '4': '1rem',
  '6': '1.5rem',
  '8': '2rem',
  '12': '3rem',
  '16': '4rem',
}

const SPACE: Record<string, string> = {
  none: '0',
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
}

const MIN_HEIGHT: Record<string, string> = {
  none: '0',
  sm: '6rem',
  md: '10rem',
  lg: '16rem',
  xl: '24rem',
  screen: '100svh',
}

const PERCENT: Record<string, string> = {
  auto: 'auto',
  fit: 'fit-content',
  '25': '25%',
  '50': '50%',
  '75': '75%',
  '100': '100%',
}

const HEIGHT: Record<string, string> = {
  auto: 'auto',
  sm: '6rem',
  md: '10rem',
  lg: '16rem',
  xl: '24rem',
  full: '100%',
  screen: '100svh',
}

const MAX_WIDTH: Record<string, string> = {
  none: 'none',
  sm: '24rem',
  md: '28rem',
  lg: '32rem',
  xl: '36rem',
  '2xl': '42rem',
  '3xl': '48rem',
  '4xl': '56rem',
  '5xl': '64rem',
  '6xl': '72rem',
  full: '100%',
}

const MAX_HEIGHT: Record<string, string> = {
  none: 'none',
  sm: '6rem',
  md: '10rem',
  lg: '16rem',
  xl: '24rem',
  screen: '100svh',
}

const FONT_SIZE: Record<string, string> = {
  xs: 'var(--chakra-font-sizes-xs)',
  sm: 'var(--chakra-font-sizes-sm)',
  md: 'var(--chakra-font-sizes-md)',
  lg: 'var(--chakra-font-sizes-lg)',
  xl: 'var(--chakra-font-sizes-xl)',
  '2xl': 'var(--chakra-font-sizes-2xl)',
  '3xl': 'var(--chakra-font-sizes-3xl)',
  '4xl': 'var(--chakra-font-sizes-4xl)',
  '5xl': 'var(--chakra-font-sizes-5xl)',
  '6xl': 'var(--chakra-font-sizes-6xl)',
}

const FONT_FAMILY: Record<string, string> = {
  heading: 'var(--chakra-fonts-heading)',
  body: 'var(--chakra-fonts-body)',
  brand: 'var(--chakra-fonts-brand)',
}

const FONT_WEIGHT: Record<string, string> = {
  light: '300',
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
}

const LINE_HEIGHT: Record<string, string> = {
  tight: '1.1',
  snug: '1.3',
  normal: '1.5',
  relaxed: '1.7',
  loose: '2',
}

const LETTER_SPACING: Record<string, string> = {
  tighter: '-0.05em',
  tight: '-0.025em',
  normal: '0',
  wide: '0.025em',
  wider: '0.05em',
  widest: '0.1em',
}

const FONT_STYLE: Record<string, string> = { normal: 'normal', italic: 'italic' }
const TEXT_DECORATION: Record<string, string> = {
  none: 'none',
  underline: 'underline',
  'line-through': 'line-through',
}
const TEXT_ALIGN: Record<string, string> = { left: 'left', center: 'center', right: 'right' }

const RADIUS: Record<string, string> = {
  none: '0',
  sm: '0.25rem',
  md: '0.375rem',
  lg: '0.5rem',
  xl: '0.75rem',
  full: '9999px',
}

const SHADOW: Record<string, string> = {
  none: 'none',
  sm: '0 1px 2px rgb(0 0 0 / 0.06)',
  md: '0 4px 12px rgb(0 0 0 / 0.10)',
  lg: '0 8px 24px rgb(0 0 0 / 0.12)',
  xl: '0 16px 40px rgb(0 0 0 / 0.16)',
}

const TRANSFORM: Record<string, string> = {
  none: 'none',
  'scale-95': 'scale(0.95)',
  'scale-105': 'scale(1.05)',
  'scale-110': 'scale(1.1)',
  'rotate-1': 'rotate(1deg)',
  '-rotate-1': 'rotate(-1deg)',
  'rotate-2': 'rotate(2deg)',
  '-rotate-2': 'rotate(-2deg)',
  'rotate-3': 'rotate(3deg)',
  '-rotate-3': 'rotate(-3deg)',
  'translate-y-1': 'translateY(0.25rem)',
  '-translate-y-1': 'translateY(-0.25rem)',
  'translate-y-2': 'translateY(0.5rem)',
  '-translate-y-2': 'translateY(-0.5rem)',
  'translate-x-1': 'translateX(0.25rem)',
  '-translate-x-1': 'translateX(-0.25rem)',
  'flip-x': 'scaleX(-1)',
  'flip-y': 'scaleY(-1)',
}

const FILTER: Record<string, string> = {
  none: 'none',
  'blur-sm': 'blur(4px)',
  blur: 'blur(10px)',
  'blur-lg': 'blur(18px)',
  grayscale: 'grayscale(1)',
  'grayscale-50': 'grayscale(0.5)',
}

const ASPECT: Record<string, string> = {
  square: '1',
  '4/3': '4 / 3',
  '16/9': '16 / 9',
  '2/1': '2 / 1',
  '3/4': '3 / 4',
  '9/16': '9 / 16',
}

/** The nine box positions, shared by `background-position` and `transform-origin`. */
const BOX_POSITION: Record<string, string> = {
  center: 'center',
  top: 'top',
  bottom: 'bottom',
  left: 'left',
  right: 'right',
  'top-left': 'top left',
  'top-right': 'top right',
  'bottom-left': 'bottom left',
  'bottom-right': 'bottom right',
}

const BORDER_WIDTH: Record<string, string> = { '0': '0', '1': '1px', '2': '2px', '4': '4px' }

/** Identity maps for tokens whose CSS value is the token itself. */
const fromValues = <T extends { value: string }>(options: readonly T[]): Record<string, string> =>
  Object.fromEntries(options.map((entry) => [entry.value, entry.value]))

const POSITION = fromValues(POSITIONS)
const DISPLAY = fromValues(DISPLAYS)
const OVERFLOW = fromValues(OVERFLOWS)
const BACKGROUND_SIZE = fromValues(BACKGROUND_SIZES)
const BACKGROUND_REPEAT = fromValues(BACKGROUND_REPEATS)
const BACKGROUND_ATTACHMENT = fromValues(BACKGROUND_ATTACHMENTS)
const BORDER_STYLE = fromValues(BORDER_STYLES)
const TEXT_TRANSFORM = fromValues(TEXT_TRANSFORMS)
const MIX_BLEND = fromValues(BLEND_MODES)
const ISOLATION = fromValues(ISOLATION_VALUES)
const POINTER = fromValues(POINTER_EVENTS)
const VISIBILITY = fromValues(VISIBILITIES)

/** A stored token's CSS value, or `undefined` when it is absent or `default`. */
function token(values: FieldValues, key: string, map: Record<string, string>): string | undefined {
  const value = readText(values, key)
  return value && value !== 'default' ? map[value] : undefined
}

/**
 * How a block escapes the page column: `full` stretches the content with the
 * band, `band` keeps the content in the page column (the renderer wraps it),
 * `null` leaves the block where it is.
 */
export type BlockBleed = 'full' | 'band'

export function readBlockBleed(style: FieldValues | undefined): BlockBleed | null {
  const value = style ? readText(style, 'bleed') : ''
  return value === 'full' || value === 'band' ? value : null
}

/** Which screens a block draws on; `all` unless the seller narrowed it. */
export type BlockDevices = 'all' | 'mobile' | 'desktop'

export function readBlockDevices(style: FieldValues | undefined): BlockDevices {
  const value = style ? readText(style, 'showOn') : ''
  return value === 'mobile' || value === 'desktop' ? value : 'all'
}

/* -------------------------------------------------------------------------- */
/* Motion                                                                     */
/* -------------------------------------------------------------------------- */

/** How far a parallaxed block travels each way, in pixels. */
const PARALLAX_TRAVEL: Record<string, number> = { soft: 36, strong: 84 }

/** The entrances a block may pick — the section scale, without the theme. */
const BLOCK_MOTIONS = MOTION_ENTRANCES.map((entry) => entry.value)
type BlockMotion = Exclude<SectionMotion, 'default' | 'none'>

export interface BlockMotionPreset {
  /** The block's own entrance, or `null` when it has none. */
  entrance: EntrancePreset | null
  /** Pixels the block travels each way as the page scrolls; 0 for none. */
  parallax: number
}

const NO_MOTION: BlockMotionPreset = { entrance: null, parallax: 0 }

/**
 * The entrance and parallax a stored block style asks for. Both are opt-in:
 * a block with no motion overrides reads exactly as before, and a value
 * outside the allowlist resolves to none.
 */
export function readBlockMotion(style: FieldValues | undefined): BlockMotionPreset {
  if (!style) return NO_MOTION
  const motion = readText(style, 'motion')
  const entrance = (BLOCK_MOTIONS as readonly string[]).includes(motion)
    ? entrancePreset(
        motion as BlockMotion,
        readToken(
          style,
          'motionDuration',
          MOTION_DURATIONS.map((entry) => entry.value),
          'normal',
        ),
        readToken(
          style,
          'motionDistance',
          MOTION_DISTANCES.map((entry) => entry.value),
          'medium',
        ),
        readToken(
          style,
          'motionDelay',
          MOTION_DELAYS.map((entry) => entry.value),
          'none',
        ),
      )
    : null
  const parallax = PARALLAX_TRAVEL[readText(style, 'parallax')] ?? 0
  return { entrance, parallax }
}

/**
 * The CSS a stored block style stands for. Tokens outside the allowlist are
 * ignored — the sanitiser should have dropped them already, and a renderer
 * must not mint a class for a value it does not know.
 */
export function blockStyleCss(style: FieldValues | undefined): BlockStyleCss {
  if (!style) return NO_STYLE
  const out: BlockStyleCss = {}
  const set = (property: string, value: string | number | undefined) => {
    if (value !== undefined) out[property] = value
  }

  // Layout
  set('position', token(style, 'position', POSITION))
  const z = readText(style, 'zIndex')
  if (z && z !== 'default' && z !== 'auto') {
    const value = Number(z)
    if (Number.isFinite(value)) out.zIndex = value
  }
  const inset = token(style, 'inset', INSET)
  if (inset) {
    out.top = inset
    out.right = inset
    out.bottom = inset
    out.left = inset
  }
  set('top', token(style, 'top', INSET))
  set('right', token(style, 'right', INSET))
  set('bottom', token(style, 'bottom', INSET))
  set('left', token(style, 'left', INSET))
  // A sticky block with no vertical offset never leaves its static spot and
  // scrolls away like any other, which reads as "sticky is broken". Sections
  // default their own sticky to `top: 0` the same way; a chosen top, inset or
  // bottom still wins.
  if (out.position === 'sticky' && out.top === undefined && out.bottom === undefined) {
    out.top = '0'
  }
  set('width', token(style, 'width', PERCENT))
  set('height', token(style, 'height', HEIGHT))
  set('minHeight', token(style, 'minHeight', MIN_HEIGHT))
  set('maxWidth', token(style, 'maxWidth', MAX_WIDTH))
  set('maxHeight', token(style, 'maxHeight', MAX_HEIGHT))
  // Full bleed escapes the page column to the page's container width
  // (`PAGE_WIDTH_CONTAINER`), the same trick `FullBleed` uses. It wins over a
  // chosen width or maximum width. `band` keeps the content in the page column
  // through the renderer.
  if (readBlockBleed(style)) {
    out.width = '100cqw'
    out.maxWidth = 'none'
    out.marginInline = 'calc(50% - 50cqw)'
  }
  set('display', token(style, 'display', DISPLAY))
  set('aspectRatio', token(style, 'aspectRatio', ASPECT))
  set('overflow', token(style, 'overflow', OVERFLOW))
  // Which screens: the conditions Chakra's own `hideFrom` / `hideBelow` use,
  // so a block and a section narrowed to phones switch at the same width.
  // Added after `display`, so the hiding rule wins over a display override.
  const devices = readBlockDevices(style)
  if (devices === 'mobile') out.md = { display: 'none' }
  if (devices === 'desktop') out.mdDown = { display: 'none' }

  // Text
  const fontSize = token(style, 'fontSize', FONT_SIZE)
  if (fontSize) out.fontSize = responsiveFontSize(fontSize)
  const textColor = readText(style, 'color')
  if (textColor === 'custom') {
    const custom = readText(style, 'textColorCustom')
    if (/^#[0-9a-f]{6}$/i.test(custom)) out.color = custom.toLowerCase()
  } else {
    set('color', token(style, 'color', TEXT_COLOR))
  }
  // Mirror the colour as a custom property. It inherits down the tree, so text
  // that names its own colour — a rich-text paragraph's muted ink — can still
  // follow a surrounding block's Text colour; plain CSS inheritance never
  // reaches a child that sets its own colour.
  if (out.color !== undefined) out[BLOCK_INK_VAR] = out.color
  set('fontFamily', token(style, 'fontFamily', FONT_FAMILY))
  set('fontWeight', token(style, 'fontWeight', FONT_WEIGHT))
  set('lineHeight', token(style, 'lineHeight', LINE_HEIGHT))
  set('letterSpacing', token(style, 'letterSpacing', LETTER_SPACING))
  set('textTransform', token(style, 'textTransform', TEXT_TRANSFORM))
  set('fontStyle', token(style, 'fontStyle', FONT_STYLE))
  set('textDecoration', token(style, 'textDecoration', TEXT_DECORATION))
  set('textAlign', token(style, 'textAlign', TEXT_ALIGN))

  // Spacing
  set('padding', token(style, 'padding', SPACE))
  set('paddingInline', token(style, 'paddingX', SPACE))
  set('paddingBlock', token(style, 'paddingY', SPACE))
  set('marginTop', token(style, 'marginTop', SPACE))
  set('marginBottom', token(style, 'marginBottom', SPACE))

  // Background. A theme token wins over the hex: it follows the page palette
  // and the section scheme, which a raw colour cannot. The hex stays for
  // layouts stored before the tokens existed.
  const backgroundColorTheme = token(style, 'backgroundColorTheme', THEME_COLOR)
  const backgroundColor = readText(style, 'backgroundColor')
  if (backgroundColorTheme) out.backgroundColor = backgroundColorTheme
  else if (backgroundColor) out.backgroundColor = backgroundColor
  set('backgroundSize', token(style, 'backgroundSize', BACKGROUND_SIZE))
  set('backgroundPosition', token(style, 'backgroundPosition', BOX_POSITION))
  set('backgroundRepeat', token(style, 'backgroundRepeat', BACKGROUND_REPEAT))
  set('backgroundAttachment', token(style, 'backgroundAttachment', BACKGROUND_ATTACHMENT))

  // Border
  set('borderRadius', token(style, 'borderRadius', RADIUS))
  set('borderWidth', token(style, 'borderWidth', BORDER_WIDTH))
  set('borderStyle', token(style, 'borderStyle', BORDER_STYLE))
  const borderColorTheme = token(style, 'borderColorTheme', THEME_COLOR)
  const borderColor = readText(style, 'borderColor')
  if (borderColorTheme) out.borderColor = borderColorTheme
  else if (borderColor) out.borderColor = borderColor
  // A rounded block clips its content: without this a photo child draws its own
  // corners back over the rounding, and "Corners" looks like it does nothing.
  // An explicit Overflow choice still wins.
  if (out.borderRadius !== undefined && out.overflow === undefined) out.overflow = 'hidden'

  // Effects
  const opacity = style.opacity
  if (typeof opacity === 'number' && opacity !== 100) out.opacity = opacity / 100
  set('boxShadow', token(style, 'boxShadow', SHADOW))
  set('transform', token(style, 'transform', TRANSFORM))
  set('transformOrigin', token(style, 'transformOrigin', BOX_POSITION))
  set('filter', token(style, 'filter', FILTER))
  set('mixBlendMode', token(style, 'mixBlendMode', MIX_BLEND))
  set('isolation', token(style, 'isolation', ISOLATION))
  set('pointerEvents', token(style, 'pointerEvents', POINTER))
  set('visibility', token(style, 'visibility', VISIBILITY))

  // Hover. The tokens describe the rest state's reaction to a pointer: on the
  // block itself, or — with `hoverTrigger: group` — on the card/container
  // around it, so one hover can scale an image and underline its caption
  // together.
  const hover: BlockStyleCss = {}
  const hoverTransform = token(style, 'hoverTransform', TRANSFORM)
  if (hoverTransform) hover.transform = hoverTransform
  // An image zoom: the photo grows inside whatever clips it — the same move
  // the theme's card zoom makes, so a block and a card ease alike. The
  // transition rides on the image itself so the growth eases back too.
  if (readText(style, 'hoverImageZoom') === 'zoom-in') {
    out['& img'] = { transition: 'transform 600ms ease' }
    hover['& img'] = { transform: 'scale(1.05)' }
  }
  const hoverFilter = token(style, 'hoverFilter', FILTER)
  if (hoverFilter) hover.filter = hoverFilter
  const hoverShadow = token(style, 'hoverShadow', SHADOW)
  if (hoverShadow) hover.boxShadow = hoverShadow
  const hoverDecoration = token(style, 'hoverDecoration', TEXT_DECORATION)
  if (hoverDecoration) hover.textDecoration = hoverDecoration
  const hoverColor = readText(style, 'hoverColor')
  if (hoverColor === 'custom') {
    const custom = readText(style, 'hoverColorCustom')
    if (/^#[0-9a-f]{6}$/i.test(custom)) hover.color = custom.toLowerCase()
  } else {
    const value = token(style, 'hoverColor', TEXT_COLOR)
    if (value) hover.color = value
  }
  // The hover rule updates the same custom property, so the rich text follows
  // a hover colour too (on the block itself or, with the group trigger, a card).
  if (hover.color !== undefined) hover[BLOCK_INK_VAR] = hover.color
  const hoverBackgroundTheme = token(style, 'hoverBackgroundTheme', THEME_COLOR)
  const hoverBackground = readText(style, 'hoverBackgroundColor')
  if (hoverBackgroundTheme) hover.backgroundColor = hoverBackgroundTheme
  else if (hoverBackground) hover.backgroundColor = hoverBackground

  if (Object.keys(hover).length > 0) {
    out[
      readText(style, 'hoverTrigger') === 'group' ? '[data-block-hover-group]:hover &' : '&:hover'
    ] = hover
    out.transition = HOVER_TRANSITION
  }

  // A style holding only defaults resolves to nothing: share the empty object
  // so an unstyled block and a no-op style behave identically.
  return Object.keys(out).length > 0 ? out : NO_STYLE
}
