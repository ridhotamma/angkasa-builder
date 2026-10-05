/**
 * Predefined looks, palettes and font pairings.
 *
 * A curated library that lets a shop pick a complete design identity — "warm",
 * "bold", "luxury", "minimal" — in one click, instead of configuring colours,
 * fonts, shape and motion by hand.
 *
 * Follows docs/PREMIUM-VISUALS.md:
 * - A look is pure settings data, never layout or sections.
 * - Imports option unions from ./settings.ts so a look only emits values the
 *   storefront already renders.
 * - Pure: runs on both server and client without React/Chakra dependencies.
 */

import type { Localized } from './localized'
import {
  type AnimationStyle,
  type ButtonStyle,
  type CardStyle,
  type FontFamily,
  type RadiusOption,
  type SchemeColors,
  type SchemeKey,
  type ThemeSettings,
} from './settings'

/* -------------------------------------------------------------------------- */
/* Tags & Types                                                               */
/* -------------------------------------------------------------------------- */

export const LOOK_TAGS = [
  'minimal',
  'editorial',
  'warm',
  'bold',
  'brutalist',
  'luxury',
  'retro',
  'futuristic',
  'natural',
  'playful',
  'monochrome',
  'quiet',
] as const

export type LookTag = (typeof LOOK_TAGS)[number]

export const PALETTE_TAGS = [
  'warm',
  'cool',
  'bold',
  'calm',
  'luxury',
  'natural',
  'mono',
  'dark',
  'vibrant',
  'pastel',
  'playful',
] as const

export type PaletteTag = (typeof PALETTE_TAGS)[number]

export interface FontPair {
  key: string
  name: Localized
  heading: FontFamily
  body: FontFamily
  description: Localized
}

export interface Palette {
  key: string
  name: Localized
  tags: readonly PaletteTag[]
  colors: ThemeSettings['colors']
  schemes?: Partial<Record<SchemeKey, SchemeColors>>
}

export interface Look {
  key: string
  name: Localized
  description: Localized
  tags: readonly LookTag[]
  palette: string // a PALETTES key
  fontPair: string // a FONT_PAIRS key
  radius: RadiusOption
  buttonStyle: ButtonStyle
  cardStyle: CardStyle
  animation: AnimationStyle
  schemes?: Partial<Record<SchemeKey, SchemeColors>>
  /** Optional seeds for section defaults when installing or aligning templates. */
  sectionDefaults?: Record<
    string,
    { style?: Record<string, unknown>; settings?: Record<string, unknown> }
  >
}

/* -------------------------------------------------------------------------- */
/* Font Pairings                                                              */
/* -------------------------------------------------------------------------- */

export const FONT_PAIRS: readonly FontPair[] = [
  {
    key: 'inter-inter',
    name: { en: 'Clean Modern', id: 'Modern Bersih' },
    heading: 'Inter',
    body: 'Inter',
    description: {
      en: 'Neutral, grid-led Swiss modernist type scale.',
      id: 'Gaya modernis Swiss yang netral dan rapi.',
    },
  },
  {
    key: 'fraunces-dm-sans',
    name: { en: 'Warm Editorial', id: 'Editorial Hangat' },
    heading: 'Fraunces',
    body: 'DM Sans',
    description: {
      en: 'Organic variable serif paired with friendly geometric sans.',
      id: 'Serif organik dipadu dengan sans geometris yang ramah.',
    },
  },
  {
    key: 'playfair-inter',
    name: { en: 'High Fashion', id: 'Mode Mewah' },
    heading: 'Playfair Display',
    body: 'Inter',
    description: {
      en: 'High-contrast display serif with clean neutral body text.',
      id: 'Serif kontras tinggi dengan teks isi yang bersih dan netral.',
    },
  },
  {
    key: 'space-space',
    name: { en: 'Neo-Brutalist', id: 'Neo-Brutalis' },
    heading: 'Space Grotesk',
    body: 'Space Grotesk',
    description: {
      en: 'Raw, monospaced-inspired geometric character for bold brands.',
      id: 'Karakter geometris berani bernuansa monospaced.',
    },
  },
  {
    key: 'lora-manrope',
    name: { en: 'Boutique Luxury', id: 'Kemewahan Butik' },
    heading: 'Lora',
    body: 'Manrope',
    description: {
      en: 'Refined contemporary serif with sleek modern grotesk.',
      id: 'Serif kontemporer elegan dengan grotesk modern yang ramping.',
    },
  },
  {
    key: 'outfit-outfit',
    name: { en: 'Bold Display', id: 'Tampilan Berani' },
    heading: 'Outfit',
    body: 'Outfit',
    description: {
      en: 'Punchy geometric typography built for high-energy brands.',
      id: 'Tipografi geometris kuat untuk brand dinamis dan percaya diri.',
    },
  },
  {
    key: 'fraunces-work-sans',
    name: { en: 'Retro Groove', id: 'Retro Klasik' },
    heading: 'Fraunces',
    body: 'Work Sans',
    description: {
      en: 'Warm, tactile 70s-inspired curve meets hardworking grotesk.',
      id: 'Lekukan hangat ala era 70-an dipadu grotesk yang fungsional.',
    },
  },
  {
    key: 'space-inter',
    name: { en: 'Tech Modern', id: 'Teknologi Modern' },
    heading: 'Space Grotesk',
    body: 'Inter',
    description: {
      en: 'Futuristic headlines grounded in ultra-readable body type.',
      id: 'Judul bernuansa futuristik dengan teks isi yang sangat mudah dibaca.',
    },
  },
  {
    key: 'lora-nunito',
    name: { en: 'Natural Calm', id: 'Ketenangan Alami' },
    heading: 'Lora',
    body: 'Nunito',
    description: {
      en: 'Literary serif paired with rounded, approachable sans.',
      id: 'Serif bersahaja dipadu sans membulat yang nyaman dan ramah.',
    },
  },
  {
    key: 'nunito-nunito',
    name: { en: 'Playful Friendly', id: 'Ceria & Ramah' },
    heading: 'Nunito',
    body: 'Nunito',
    description: {
      en: 'Soft terminal rounds with high warmth and friendliness.',
      id: 'Sudut membulat yang lembut, hangat, dan menyenangkan.',
    },
  },
  {
    key: 'work-work',
    name: { en: 'Studio Neutral', id: 'Netral Studio' },
    heading: 'Work Sans',
    body: 'Work Sans',
    description: {
      en: 'Objective, architectural sans for photography and portfolios.',
      id: 'Sans arsitektural objektif untuk fotografi dan portofolio.',
    },
  },
  {
    key: 'manrope-lora',
    name: { en: 'Japandi Quiet', id: 'Ketenangan Japandi' },
    heading: 'Manrope',
    body: 'Lora',
    description: {
      en: 'Understated Scandinavian minimalism with artisanal warmth.',
      id: 'Minimalisme Skandinavia dengan kehangatan artisanal yang tenang.',
    },
  },
  {
    key: 'poppins-poppins',
    name: { en: 'Balanced Brand', id: 'Brand Seimbang' },
    heading: 'Poppins',
    body: 'Poppins',
    description: {
      en: 'Pesanle standard geometric sans with open apertures.',
      id: 'Sans geometris standar Pesanle yang seimbang dan bersahabat.',
    },
  },
  {
    key: 'jakarta-inter',
    name: { en: 'Contemporary Product', id: 'Produk Kontemporer' },
    heading: 'Plus Jakarta Sans',
    body: 'Inter',
    description: {
      en: 'Vibrant modern geometric sans with supreme digital clarity.',
      id: 'Sans geometris modern yang lincah dengan kejelasan digital prima.',
    },
  },
  {
    key: 'sora-inter',
    name: { en: 'Tech Clarity', id: 'Kejelasan Teknologi' },
    heading: 'Sora',
    body: 'Inter',
    description: {
      en: 'Geometric display sans over a neutral workhorse body.',
      id: 'Sans display geometris di atas body netral yang andal.',
    },
  },
  {
    key: 'quicksand-nunito',
    name: { en: 'Soft Rounded', id: 'Bulat Lembut' },
    heading: 'Quicksand',
    body: 'Nunito',
    description: {
      en: 'Rounded, friendly faces for playful and family brands.',
      id: 'Huruf bulat dan ramah untuk brand yang ceria dan keluarga.',
    },
  },
  {
    key: 'garamond-lato',
    name: { en: 'Classic Book', id: 'Buku Klasik' },
    heading: 'EB Garamond',
    body: 'Lato',
    description: {
      en: 'Old-style serif headings with a quiet humanist body.',
      id: 'Judul serif klasik dengan body humanis yang tenang.',
    },
  },
  {
    key: 'bebas-inter',
    name: { en: 'Poster Impact', id: 'Dampak Poster' },
    heading: 'Bebas Neue',
    body: 'Inter',
    description: {
      en: 'Condensed poster caps for bold, high-impact headlines.',
      id: 'Huruf kapital padat untuk judul yang tegas dan berdampak.',
    },
  },
  {
    key: 'playfair-lato',
    name: { en: 'Editorial Contrast', id: 'Kontras Editorial' },
    heading: 'Playfair Display',
    body: 'Lato',
    description: {
      en: 'High-contrast serif headings against a restrained body.',
      id: 'Judul serif kontras tinggi dengan body yang terkendali.',
    },
  },
  {
    key: 'space-dm',
    name: { en: 'Technical Modern', id: 'Modern Teknis' },
    heading: 'Space Grotesk',
    body: 'DM Sans',
    description: {
      en: 'Quirky technical display over a soft geometric body.',
      id: 'Display teknis yang unik di atas body geometris yang lembut.',
    },
  },
  {
    key: 'syne-work',
    name: { en: 'Studio Expressive', id: 'Ekspresif Studio' },
    heading: 'Syne',
    body: 'Work Sans',
    description: {
      en: 'Art-house display type for studios, galleries and agencies.',
      id: 'Huruf display art-house untuk studio, galeri, dan agensi.',
    },
  },
  {
    key: 'urbanist-inter',
    name: { en: 'Geometric Clean', id: 'Geometris Bersih' },
    heading: 'Urbanist',
    body: 'Inter',
    description: {
      en: 'Low-contrast geometric sans, calm and contemporary.',
      id: 'Sans geometris kontras rendah, tenang dan kontemporer.',
    },
  },
]

/* -------------------------------------------------------------------------- */
/* Predefined Palettes                                                        */
/* -------------------------------------------------------------------------- */

export const PALETTES: readonly Palette[] = [
  {
    key: 'terracotta-cream',
    name: { en: 'Terracotta & Cream', id: 'Terracotta & Krim' },
    tags: ['warm', 'natural'],
    colors: {
      brand: '#b4532a',
      background: '#faf6f0',
      text: '#291811',
      accent: '#c2410c',
    },
    schemes: {
      subtle: { background: '#f3ece1', text: '#291811', button: '#b4532a' },
      inverse: { background: '#20140e', text: '#faf6f0', button: '#d97706' },
      brand: { background: '#b4532a', text: '#ffffff', button: '#291811' },
      accent: { background: '#c2410c', text: '#ffffff', button: '#faf6f0' },
    },
  },
  {
    key: 'sand-clay',
    name: { en: 'Sand & Clay', id: 'Pasir & Liat' },
    tags: ['warm', 'calm'],
    colors: {
      brand: '#9a5b32',
      background: '#fdfbf7',
      text: '#2c1e16',
      accent: '#b45309',
    },
    schemes: {
      subtle: { background: '#f5efe6', text: '#2c1e16', button: '#9a5b32' },
      inverse: { background: '#1c1511', text: '#fdfbf7', button: '#d97706' },
    },
  },
  {
    key: 'amber-espresso',
    name: { en: 'Amber & Espresso', id: 'Amber & Espresso' },
    tags: ['warm', 'dark'],
    colors: {
      brand: '#d97706',
      background: '#18120e',
      text: '#fbf7f4',
      accent: '#f59e0b',
    },
    schemes: {
      subtle: { background: '#251c16', text: '#fbf7f4', button: '#d97706' },
      inverse: { background: '#0e0b08', text: '#fbf7f4', button: '#f59e0b' },
    },
  },
  {
    key: 'electric-ink',
    name: { en: 'Electric & Ink', id: 'Elektrik & Tinta' },
    tags: ['bold', 'vibrant'],
    colors: {
      brand: '#2563eb',
      background: '#f8fafc',
      text: '#0f172a',
      accent: '#7c3aed',
    },
    schemes: {
      subtle: { background: '#eff6ff', text: '#0f172a', button: '#2563eb' },
      inverse: { background: '#0f172a', text: '#f8fafc', button: '#3b82f6' },
      brand: { background: '#1d4ed8', text: '#ffffff', button: '#0f172a' },
    },
  },
  {
    key: 'tangerine-black',
    name: { en: 'Tangerine & Black', id: 'Tangerine & Hitam' },
    tags: ['bold', 'dark'],
    colors: {
      brand: '#ea580c',
      background: '#121214',
      text: '#f4f4f5',
      accent: '#f97316',
    },
    schemes: {
      subtle: { background: '#1c1c20', text: '#f4f4f5', button: '#ea580c' },
      inverse: { background: '#09090b', text: '#f4f4f5', button: '#f97316' },
    },
  },
  {
    key: 'cobalt-white',
    name: { en: 'Cobalt & White', id: 'Kobalt & Putih' },
    tags: ['bold', 'cool'],
    colors: {
      brand: '#1d4ed8',
      background: '#ffffff',
      text: '#0f172a',
      accent: '#0284c7',
    },
    schemes: {
      subtle: { background: '#f1f5f9', text: '#0f172a', button: '#1d4ed8' },
      inverse: { background: '#0f172a', text: '#ffffff', button: '#38bdf8' },
    },
  },
  {
    key: 'sage-bone',
    name: { en: 'Sage & Bone', id: 'Sage & Tulang' },
    tags: ['calm', 'natural'],
    colors: {
      brand: '#3f6212',
      background: '#f7f8f5',
      text: '#1c2416',
      accent: '#4d7c0f',
    },
    schemes: {
      subtle: { background: '#edf1e8', text: '#1c2416', button: '#3f6212' },
      inverse: { background: '#172012', text: '#f7f8f5', button: '#65a30d' },
    },
  },
  {
    key: 'mist-slate',
    name: { en: 'Mist & Slate', id: 'Kabut & Slate' },
    tags: ['calm', 'cool'],
    colors: {
      brand: '#334155',
      background: '#f8fafc',
      text: '#0f172a',
      accent: '#475569',
    },
    schemes: {
      subtle: { background: '#edf2f7', text: '#0f172a', button: '#334155' },
      inverse: { background: '#0f172a', text: '#f8fafc', button: '#64748b' },
    },
  },
  {
    key: 'ink-champagne',
    name: { en: 'Ink & Champagne', id: 'Tinta & Sampanye' },
    tags: ['luxury', 'dark'],
    colors: {
      // Warm ink and cream, not neutral blue-black and cold white: the
      // champagne only reads as champagne against a warm page.
      brand: '#c9a24d',
      background: '#141210',
      text: '#f2ead9',
      accent: '#dfc079',
    },
    schemes: {
      subtle: { background: '#1e1a15', text: '#f2ead9', button: '#c9a24d' },
      inverse: { background: '#0b0a08', text: '#f2ead9', button: '#dfc079' },
      brand: { background: '#2b2416', text: '#f6efe0', button: '#dfc079' },
    },
  },
  {
    key: 'charcoal-brass',
    name: { en: 'Charcoal & Brass', id: 'Arang & Kuningan' },
    tags: ['luxury', 'warm'],
    colors: {
      brand: '#b4833e',
      background: '#18181b',
      text: '#fafafa',
      accent: '#d97706',
    },
    schemes: {
      subtle: { background: '#27272a', text: '#fafafa', button: '#b4833e' },
      inverse: { background: '#09090b', text: '#fafafa', button: '#d97706' },
    },
  },
  {
    key: 'forest-oat',
    name: { en: 'Forest & Oat', id: 'Hutan & Gandum' },
    tags: ['natural', 'warm'],
    colors: {
      brand: '#166534',
      background: '#faf8f5',
      text: '#142217',
      accent: '#15803d',
    },
    schemes: {
      subtle: { background: '#eef5ec', text: '#142217', button: '#166534' },
      inverse: { background: '#0f1f13', text: '#faf8f5', button: '#22c55e' },
    },
  },
  {
    key: 'olive-sand',
    name: { en: 'Olive & Sand', id: 'Zaitun & Pasir' },
    tags: ['natural', 'calm'],
    colors: {
      brand: '#4d5320',
      background: '#fbf9f4',
      text: '#222413',
      accent: '#656d28',
    },
    schemes: {
      subtle: { background: '#f2eedf', text: '#222413', button: '#4d5320' },
      inverse: { background: '#191b0b', text: '#fbf9f4', button: '#848d39' },
    },
  },
  {
    key: 'black-white',
    name: { en: 'Black & White', id: 'Hitam & Putih' },
    tags: ['mono'],
    colors: {
      brand: '#09090b',
      background: '#ffffff',
      text: '#09090b',
      accent: '#27272a',
    },
    schemes: {
      subtle: { background: '#f4f4f5', text: '#09090b', button: '#09090b' },
      inverse: { background: '#09090b', text: '#ffffff', button: '#f4f4f5' },
    },
  },
  {
    key: 'charcoal-bone',
    name: { en: 'Charcoal & Bone', id: 'Arang & Tulang' },
    tags: ['mono', 'warm'],
    colors: {
      brand: '#262626',
      background: '#f7f6f2',
      text: '#171717',
      accent: '#404040',
    },
    schemes: {
      subtle: { background: '#eae7de', text: '#171717', button: '#262626' },
      inverse: { background: '#171717', text: '#f7f6f2', button: '#e5e5e5' },
    },
  },
  {
    key: 'candy-sky',
    name: { en: 'Candy & Sky', id: 'Permen & Langit' },
    tags: ['playful', 'pastel'],
    colors: {
      brand: '#db2777',
      background: '#fdf8fa',
      text: '#29141c',
      accent: '#0284c7',
    },
    schemes: {
      subtle: { background: '#fce7f3', text: '#29141c', button: '#db2777' },
      inverse: { background: '#201018', text: '#fdf8fa', button: '#f472b6' },
    },
  },
  {
    key: 'obsidian',
    name: { en: 'Obsidian Neon', id: 'Obsidian Neon' },
    tags: ['dark', 'bold'],
    colors: {
      brand: '#6366f1',
      background: '#09090b',
      text: '#f4f4f5',
      accent: '#818cf8',
    },
    schemes: {
      subtle: { background: '#18181b', text: '#f4f4f5', button: '#6366f1' },
      inverse: { background: '#030304', text: '#f4f4f5', button: '#818cf8' },
    },
  },
  {
    key: 'deep-teal',
    name: { en: 'Deep Teal', id: 'Teal Mendalam' },
    tags: ['calm', 'cool'],
    colors: {
      brand: '#0f766e',
      background: '#f4fbfb',
      text: '#0b2524',
      accent: '#0d9488',
    },
    schemes: {
      subtle: { background: '#e0f2f1', text: '#0b2524', button: '#0f766e' },
      inverse: { background: '#0a1d1c', text: '#f4fbfb', button: '#14b8a6' },
    },
  },
  {
    key: 'pesanle-heritage',
    name: { en: 'Pesanle Heritage', id: 'Pesanle Klasik' },
    tags: ['bold', 'vibrant'],
    colors: {
      brand: '#ff4f00',
      background: '#fffefb',
      text: '#201515',
      accent: '#ff3d8b',
    },
  },
  {
    key: 'plum-cream',
    name: { en: 'Plum & Cream', id: 'Plum & Krim' },
    tags: ['luxury', 'bold'],
    colors: {
      brand: '#6d28d9',
      background: '#faf7ff',
      text: '#241a33',
      accent: '#db2777',
    },
  },
  {
    key: 'ocean-sand',
    name: { en: 'Ocean & Sand', id: 'Laut & Pasir' },
    tags: ['calm', 'natural'],
    colors: {
      brand: '#0f766e',
      background: '#f7faf9',
      text: '#0f1f1d',
      accent: '#f59e0b',
    },
  },
  {
    key: 'berry-milk',
    name: { en: 'Berry & Milk', id: 'Beri & Susu' },
    tags: ['vibrant', 'playful'],
    colors: {
      brand: '#be123c',
      background: '#fff7f8',
      text: '#2a0b12',
      accent: '#7c3aed',
    },
  },
  {
    key: 'moss-cream',
    name: { en: 'Moss & Cream', id: 'Lumut & Krim' },
    tags: ['natural', 'warm'],
    colors: {
      brand: '#4d7c0f',
      background: '#fbfdf6',
      text: '#1a2410',
      accent: '#d97706',
    },
  },
  {
    key: 'navy-gold',
    name: { en: 'Navy & Gold', id: 'Navy & Emas' },
    tags: ['luxury', 'cool'],
    colors: {
      brand: '#1e3a8a',
      background: '#f8faff',
      text: '#0b1220',
      accent: '#b45309',
    },
  },
  {
    key: 'rosewood',
    name: { en: 'Rosewood', id: 'Kayu Mawar' },
    tags: ['warm', 'luxury'],
    colors: {
      brand: '#9f1239',
      background: '#fffaf7',
      text: '#2b120f',
      accent: '#0f766e',
    },
  },
  {
    key: 'lavender-ink',
    name: { en: 'Lavender & Ink', id: 'Lavender & Tinta' },
    tags: ['pastel', 'cool'],
    colors: {
      brand: '#7c3aed',
      background: '#fbfaff',
      text: '#1c1530',
      accent: '#06b6d4',
    },
  },
  {
    key: 'copper-slate',
    name: { en: 'Copper & Slate', id: 'Tembaga & Slate' },
    tags: ['warm', 'cool'],
    colors: {
      brand: '#b45309',
      background: '#f8fafc',
      text: '#0f172a',
      accent: '#0ea5e9',
    },
  },
  {
    key: 'emerald-charcoal',
    name: { en: 'Emerald & Charcoal', id: 'Emerald & Arang' },
    tags: ['natural', 'bold'],
    colors: {
      brand: '#047857',
      background: '#f6fbf8',
      text: '#111827',
      accent: '#f59e0b',
    },
  },
  {
    key: 'midnight-neon',
    name: { en: 'Midnight Neon', id: 'Midnight Neon' },
    tags: ['dark', 'vibrant'],
    colors: {
      brand: '#22d3ee',
      background: '#0b1020',
      text: '#e5e7eb',
      accent: '#a3e635',
    },
  },
  {
    key: 'blush-graphite',
    name: { en: 'Blush & Graphite', id: 'Blush & Grafit' },
    tags: ['playful', 'mono'],
    colors: {
      brand: '#db2777',
      background: '#fafafa',
      text: '#18181b',
      accent: '#7c3aed',
    },
  },
  {
    key: 'teal-coral',
    name: { en: 'Teal & Coral', id: 'Teal & Koral' },
    tags: ['calm', 'playful'],
    colors: {
      brand: '#0d9488',
      background: '#f0fdfa',
      text: '#134e4a',
      accent: '#fb7185',
    },
  },
  {
    key: 'mustard-ink',
    name: { en: 'Mustard & Ink', id: 'Mustard & Tinta' },
    tags: ['warm', 'bold'],
    colors: {
      brand: '#ca8a04',
      background: '#fffdf5',
      text: '#1c1917',
      accent: '#dc2626',
    },
  },
  {
    key: 'sky-chocolate',
    name: { en: 'Sky & Chocolate', id: 'Langit & Cokelat' },
    tags: ['cool', 'warm'],
    colors: {
      brand: '#0284c7',
      background: '#f8fbff',
      text: '#0c1a2b',
      accent: '#92400e',
    },
  },
]

/* -------------------------------------------------------------------------- */
/* Predefined Looks                                                           */
/* -------------------------------------------------------------------------- */

export const LOOKS: readonly Look[] = [
  {
    key: 'minimal',
    name: { en: 'Minimal (Swiss)', id: 'Minimal (Swiss)' },
    description: {
      en: 'White space, neutral, grid-led clarity for design & tech.',
      id: 'Ruang bersih, netral, tata letak grid untuk desain & teknologi.',
    },
    tags: ['minimal', 'monochrome'],
    palette: 'black-white',
    fontPair: 'inter-inter',
    radius: 'none',
    buttonStyle: 'solid',
    cardStyle: 'flat',
    animation: 'none',
  },
  {
    key: 'warm-organic',
    name: { en: 'Warm & Organic', id: 'Hangat & Alami' },
    description: {
      en: 'Cream, terracotta, tactile soft edges for F&B, beauty & homeware.',
      id: 'Krim, terracotta, sudut lembut untuk kuliner, kecantikan & hunian.',
    },
    tags: ['warm', 'natural'],
    palette: 'terracotta-cream',
    fontPair: 'fraunces-dm-sans',
    radius: 'lg',
    buttonStyle: 'solid',
    cardStyle: 'flat',
    animation: 'subtle',
  },
  {
    key: 'editorial-fashion',
    name: { en: 'Editorial & Fashion', id: 'Editorial & Mode' },
    description: {
      en: 'Dramatic serif titles, high contrast, image-first presentation.',
      id: 'Judul serif dramatis, kontras tinggi, mengutamakan visual foto.',
    },
    tags: ['editorial', 'luxury'],
    palette: 'charcoal-bone',
    fontPair: 'playfair-inter',
    radius: 'none',
    buttonStyle: 'outline',
    cardStyle: 'border',
    animation: 'subtle',
  },
  {
    key: 'neo-brutalist',
    name: { en: 'Neo-Brutalist', id: 'Neo-Brutalis' },
    description: {
      en: 'Raw, thick borders and uncompromising lines for streetwear drops.',
      id: 'Garis tegas, sudut siku kuat untuk streetwear dan rilisan terbatas.',
    },
    tags: ['brutalist', 'bold'],
    palette: 'tangerine-black',
    fontPair: 'space-space',
    radius: 'none',
    buttonStyle: 'solid',
    cardStyle: 'border',
    animation: 'none',
  },
  {
    key: 'luxury-boutique',
    name: { en: 'Luxury & Boutique', id: 'Kemewahan Butik' },
    description: {
      en: 'Dark, champagne accents, slow and quiet confidence for jewellery.',
      id: 'Nuansa gelap beraksen sampanye keemasan yang tenang dan elegan.',
    },
    tags: ['luxury', 'quiet'],
    palette: 'ink-champagne',
    fontPair: 'lora-manrope',
    radius: 'sm',
    buttonStyle: 'outline',
    cardStyle: 'border',
    animation: 'subtle',
  },
  {
    key: 'bold-maximal',
    name: { en: 'Bold & Maximal', id: 'Berani & Maksimal' },
    description: {
      en: 'Saturated energetic tones, punchy typography for big campaigns.',
      id: 'Warna saturasi kuat dan tipografi dinamis untuk kampanye heboh.',
    },
    tags: ['bold', 'playful'],
    palette: 'electric-ink',
    fontPair: 'outfit-outfit',
    radius: 'lg',
    buttonStyle: 'pill',
    cardStyle: 'shadow',
    animation: 'expressive',
  },
  {
    key: 'retro-vintage',
    name: { en: 'Retro & Vintage', id: 'Retro & Antik' },
    description: {
      en: 'Warm muted tones, groovy serif character for specialty coffee & apparel.',
      id: 'Nuansa hangat lembut dan tipografi berkarakter untuk kedai kopi & fashion.',
    },
    tags: ['retro', 'warm'],
    palette: 'sand-clay',
    fontPair: 'fraunces-work-sans',
    radius: 'sm',
    buttonStyle: 'solid',
    cardStyle: 'border',
    animation: 'subtle',
  },
  {
    key: 'tech-futuristic',
    name: { en: 'Tech & Futuristic', id: 'Teknologi & Futuristik' },
    description: {
      en: 'Dark obsidian surfaces with neon accents for digital and electronics.',
      id: 'Latar obsidian gelap dengan aksen neon untuk produk digital & gawai.',
    },
    tags: ['futuristic', 'bold'],
    palette: 'obsidian',
    fontPair: 'space-inter',
    radius: 'sm',
    buttonStyle: 'solid',
    cardStyle: 'flat',
    animation: 'subtle',
  },
  {
    key: 'natural-earthy',
    name: { en: 'Natural & Earthy', id: 'Alami & Membumi' },
    description: {
      en: 'Botanical greens, honest clay for organic wellness and craft brands.',
      id: 'Hijau botani dan lempung bersahaja untuk produk organik & kriya.',
    },
    tags: ['natural', 'quiet'],
    palette: 'forest-oat',
    fontPair: 'lora-nunito',
    radius: 'lg',
    buttonStyle: 'solid',
    cardStyle: 'flat',
    animation: 'subtle',
  },
  {
    key: 'playful-candy',
    name: { en: 'Playful & Candy', id: 'Ceria & Manis' },
    description: {
      en: 'Vibrant pastels, rounded shapes and bouncy motion for snacks & pets.',
      id: 'Pastel cerah, bentuk membulat dan animasi lincah untuk camilan & hobi.',
    },
    tags: ['playful'],
    palette: 'candy-sky',
    fontPair: 'nunito-nunito',
    radius: 'lg',
    buttonStyle: 'pill',
    cardStyle: 'shadow',
    animation: 'expressive',
  },
  {
    key: 'monochrome-studio',
    name: { en: 'Monochrome Studio', id: 'Studio Monokrom' },
    description: {
      en: 'Greyscale restraint that puts photography and product imagery first.',
      id: 'Kesederhanaan monokrom yang menonjolkan keindahan foto produk.',
    },
    tags: ['monochrome', 'minimal'],
    palette: 'charcoal-bone',
    fontPair: 'work-work',
    radius: 'none',
    buttonStyle: 'solid',
    cardStyle: 'flat',
    animation: 'none',
  },
  {
    key: 'japandi-quiet',
    name: { en: 'Japandi Quiet', id: 'Ketenangan Japandi' },
    description: {
      en: 'Low contrast, textured serenity for home decor, ceramics & spa.',
      id: 'Ketenangan kontras lembut untuk dekorasi rumah, keramik & spa.',
    },
    tags: ['quiet', 'natural'],
    palette: 'olive-sand',
    fontPair: 'manrope-lora',
    radius: 'sm',
    buttonStyle: 'outline',
    cardStyle: 'flat',
    animation: 'subtle',
  },
  {
    key: 'sora-clean',
    name: { en: 'Sora Clean', id: 'Sora Bersih' },
    description: {
      en: 'Crisp geometric tech for SaaS, gadgets and modern services.',
      id: 'Teknologi geometris yang tajam untuk SaaS, gadget, dan jasa modern.',
    },
    tags: ['futuristic', 'minimal'],
    palette: 'lavender-ink',
    fontPair: 'sora-inter',
    radius: 'md',
    buttonStyle: 'solid',
    cardStyle: 'shadow',
    animation: 'subtle',
  },
  {
    key: 'soft-candy',
    name: { en: 'Soft Candy', id: 'Permen Lembut' },
    description: {
      en: 'Rounded and friendly for bakeries, kids brands and gifts.',
      id: 'Bulat dan ramah untuk toko kue, brand anak, dan hadiah.',
    },
    tags: ['playful', 'warm'],
    palette: 'candy-sky',
    fontPair: 'quicksand-nunito',
    radius: 'lg',
    buttonStyle: 'pill',
    cardStyle: 'flat',
    animation: 'subtle',
  },
  {
    key: 'classic-book',
    name: { en: 'Classic Book', id: 'Buku Klasik' },
    description: {
      en: 'Old-style serif authority for publishers, law and heritage.',
      id: 'Kewibawaan serif klasik untuk penerbit, hukum, dan warisan.',
    },
    tags: ['editorial', 'luxury'],
    palette: 'navy-gold',
    fontPair: 'garamond-lato',
    radius: 'sm',
    buttonStyle: 'solid',
    cardStyle: 'border',
    animation: 'none',
  },
  {
    key: 'poster-pop',
    name: { en: 'Poster Pop', id: 'Poster Pop' },
    description: {
      en: 'Condensed poster caps for streetwear, events and F&B promos.',
      id: 'Huruf poster padat untuk streetwear, acara, dan promo F&B.',
    },
    tags: ['bold', 'brutalist'],
    palette: 'mustard-ink',
    fontPair: 'bebas-inter',
    radius: 'none',
    buttonStyle: 'solid',
    cardStyle: 'flat',
    animation: 'expressive',
  },
  {
    key: 'editorial-rose',
    name: { en: 'Editorial Rose', id: 'Editorial Mawar' },
    description: {
      en: 'High-contrast serif and rose tones for fashion and beauty.',
      id: 'Serif kontras tinggi dengan nuansa mawar untuk fashion dan kecantikan.',
    },
    tags: ['editorial', 'luxury'],
    palette: 'rosewood',
    fontPair: 'playfair-lato',
    radius: 'sm',
    buttonStyle: 'outline',
    cardStyle: 'border',
    animation: 'none',
  },
  {
    key: 'neon-midnight',
    name: { en: 'Neon Midnight', id: 'Neon Tengah Malam' },
    description: {
      en: 'Dark, electric and expressive for nightlife, music and gaming.',
      id: 'Gelap, elektrik, dan ekspresif untuk hiburan malam, musik, dan game.',
    },
    tags: ['futuristic', 'bold'],
    palette: 'midnight-neon',
    fontPair: 'syne-work',
    radius: 'md',
    buttonStyle: 'solid',
    cardStyle: 'shadow',
    animation: 'expressive',
  },
]

/* -------------------------------------------------------------------------- */
/* Helpers & Applicators                                                      */
/* -------------------------------------------------------------------------- */

export function findPalette(key: string): Palette {
  return PALETTES.find((p) => p.key === key) ?? PALETTES[0]!
}

export function findFontPair(key: string): FontPair {
  return FONT_PAIRS.find((f) => f.key === key) ?? FONT_PAIRS[0]!
}

export function findLook(key: string): Look {
  return LOOKS.find((l) => l.key === key) ?? LOOKS[0]!
}

/** Whether `key` names one of the curated looks. */
export function isLookKey(key: unknown): key is string {
  return typeof key === 'string' && LOOKS.some((look) => look.key === key)
}

/**
 * Applies a curated Look to ThemeSettings.
 *
 * Flattens the look into existing settings keys without mutating layouts or
 * sections. Returns a clean ThemeSettings object.
 */
export function applyLook(settings: ThemeSettings, look: Look): ThemeSettings {
  const palette = findPalette(look.palette)
  const fonts = findFontPair(look.fontPair)

  return {
    ...settings,
    colors: { ...palette.colors },
    fonts: {
      heading: fonts.heading,
      body: fonts.body,
    },
    radius: look.radius,
    buttonStyle: look.buttonStyle,
    cardStyle: look.cardStyle,
    animation: look.animation,
    schemes: {
      ...(palette.schemes ?? {}),
      ...(look.schemes ?? {}),
    },
  }
}

/**
 * Applies a Palette to ThemeSettings without changing fonts, shape or motion.
 */
export function applyPalette(settings: ThemeSettings, palette: Palette): ThemeSettings {
  return {
    ...settings,
    colors: { ...palette.colors },
    schemes: {
      ...settings.schemes,
      ...(palette.schemes ?? {}),
    },
  }
}

/* -------------------------------------------------------------------------- */
/* Search & Filter                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Mood aliases across English and Indonesian, so "hangat" finds the warm
 * looks and "mewah" the luxury ones. Plain tag strings — shared by the look
 * and palette search.
 */
const QUERY_ALIASES: Record<string, readonly string[]> = {
  hangat: ['warm'],
  warm: ['warm'],
  panas: ['warm'],
  berani: ['bold'],
  bold: ['bold'],
  tegas: ['bold', 'brutalist'],
  mewah: ['luxury'],
  luxury: ['luxury'],
  elegan: ['luxury', 'editorial'],
  bersih: ['minimal', 'monochrome'],
  clean: ['minimal'],
  minimalis: ['minimal'],
  minimal: ['minimal'],
  tenang: ['quiet', 'natural'],
  calm: ['quiet'],
  quiet: ['quiet'],
  alami: ['natural'],
  natural: ['natural'],
  ceria: ['playful'],
  playful: ['playful'],
  fun: ['playful'],
  gelap: ['dark'],
  dark: ['dark'],
  modern: ['minimal', 'futuristic'],
}

/** The query plus its aliases: every term a search may match on. */
function searchTerms(query: string): readonly string[] {
  const q = query.trim().toLowerCase()
  return [q, ...(QUERY_ALIASES[q] ?? [])]
}

function matchesLocalized(text: Localized, terms: readonly string[]): boolean {
  const en = text.en.toLowerCase()
  const id = text.id.toLowerCase()
  return terms.some((term) => en.includes(term) || id.includes(term))
}

function matchesTags(tags: readonly string[], terms: readonly string[]): boolean {
  return tags.some((tag) => terms.some((term) => tag.includes(term)))
}

/**
 * Searches looks by keyword or mood in both English and Indonesian.
 * Matches name, description, tags and palette moods.
 */
export function searchLooks(query: string): readonly Look[] {
  const q = query.trim().toLowerCase()
  if (!q) return LOOKS
  const terms = searchTerms(q)

  return LOOKS.filter(
    (look) =>
      matchesLocalized(look.name, terms) ||
      matchesLocalized(look.description, terms) ||
      matchesTags(look.tags, terms) ||
      matchesTags([look.palette], terms),
  )
}

/**
 * Searches palettes by keyword or tag, with the same mood aliases as looks.
 */
export function searchPalettes(query: string): readonly Palette[] {
  const q = query.trim().toLowerCase()
  if (!q) return PALETTES
  const terms = searchTerms(q)

  return PALETTES.filter(
    (palette) => matchesLocalized(palette.name, terms) || matchesTags(palette.tags, terms),
  )
}
