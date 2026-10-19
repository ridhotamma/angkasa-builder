/**
 * The platform's starter themes, as data.
 *
 * Twelve complete `ThemeContent`s — settings, header, footer and a home
 * template — covering the styles a new shop is most likely to ask for:
 * brutalist, minimalist, bold, modern, editorial, elegant, tech, playful, and
 * two marketplace looks (an Amazon-style general store and a Preloved-style
 * thrift marketplace), plus retro and organic.
 *
 * They are **seed data**, not a runtime fallback: `scripts/seed-themes.ts`
 * writes each one as a `scope: 'platform'` row of `themes`, after which the
 * developer console edits them like any other platform template and shops
 * install copies. There is no code-side preset library — nothing here
 * is offered from code at runtime, so the library still has one source of
 * truth.
 *
 * Every theme is built through `createSection` / `sanitizeThemeContent`, so a
 * seed cannot store a value the builder would reject: unknown fields default,
 * hidden sections stay out of the templates, and the tests re-sanitise every
 * content to prove the round trip is a no-op.
 */

import type { FieldValues } from './fields'
import {
  createSection,
  defaultArticleTemplate,
  defaultCatalogTemplate,
  defaultOrderTrackingTemplate,
  defaultProductTemplate,
  sanitizeThemeContent,
  type SectionInstance,
  type ThemeContent,
} from './content'
import { findFontPair, findLook, findPalette } from './looks'
import type { Localized } from './localized'
import type { SectionType } from './sections'
import {
  sanitizeThemeSettings,
  type AnimationStyle,
  type ButtonStyle,
  type CardStyle,
  type FontFamily,
  type RadiusOption,
  type SchemeColors,
  type SchemeKey,
  type ThemeSettings,
} from './settings'

export interface ThemeSeed {
  slug: string
  name: string
  description: Localized
  /** The template content, built fresh on every install. */
  content: () => ThemeContent
  /** Where the template sits in the developer console's library. */
  sortOrder: number
  /** The curated looks this template suggests when a shop restyles it. */
  recommendedLooks: readonly string[]
}

type SectionStyle = Record<string, unknown>
type SectionSettings = Record<string, unknown>

/** A section, sanitised at construction: unknown fields default rather than store. */
function section(
  type: SectionType,
  settings: SectionSettings = {},
  style: SectionStyle = {},
): SectionInstance {
  return createSection(type, settings, style)
}

/* -------------------------------------------------------------------------- */
/* Primitive layouts                                                          */
/* -------------------------------------------------------------------------- */

interface RawBlock {
  type: string
  settings?: Record<string, unknown>
  style?: Record<string, unknown>
}

interface TextOptions {
  level?: string
  size?: string
  align?: string
  width?: string
}

interface ColumnOptions {
  gap?: string
  padding?: string
  width?: string
  align?: string
  style?: SectionStyle
}

interface GridOptions {
  columns?: string
  gap?: string
  align?: string
  stackOnMobile?: boolean
  padding?: string
}

const bHeading = (text: string, o: TextOptions = {}): RawBlock => ({
  type: 'heading',
  settings: {
    text,
    level: o.level ?? 'h2',
    size: o.size ?? 'lg',
    align: o.align ?? 'left',
    width: o.width ?? 'full',
  },
})

const bText = (body: string, o: TextOptions = {}): RawBlock => ({
  type: 'richtext',
  settings: { body, size: o.size ?? 'md', align: o.align ?? 'left', width: o.width ?? 'full' },
})

const bRichText = (body: string, o: TextOptions = {}): RawBlock => ({
  type: 'richtext',
  settings: { body, align: o.align ?? 'left', width: o.width ?? 'full' },
})

const bButton = (
  label: string,
  o: { size?: string; align?: string; width?: string; variant?: string; tone?: string } = {},
): RawBlock => ({
  type: 'button',
  settings: {
    label,
    link: { kind: 'none' },
    size: o.size ?? 'md',
    padding: 'default',
    width: o.width ?? 'auto',
    align: o.align ?? 'left',
    variant: o.variant ?? 'solid',
    tone: o.tone ?? 'brand',
    hover: 'fill-up',
  },
})

const bIcon = (icon: string, o: { size?: string; tone?: string } = {}): RawBlock => ({
  type: 'icon',
  settings: { icon, size: o.size ?? 'lg', tone: o.tone ?? 'brand', align: 'left' },
})

const bImage = (o: { alt?: string; ratio?: string } = {}): RawBlock => ({
  type: 'image',
  settings: {
    image: '',
    alt: o.alt ?? '',
    ratio: o.ratio ?? '4/3',
    rounded: 'lg',
    width: 'full',
    align: 'left',
  },
})

const bBadge = (text: string, o: { tone?: string; align?: string } = {}): RawBlock => ({
  type: 'badge',
  settings: { text, tone: o.tone ?? 'brand', size: 'sm', align: o.align ?? 'left' },
})

const bColumn = (blocks: RawBlock[], o: ColumnOptions = {}): RawBlock => ({
  type: 'column',
  settings: {
    blocks,
    gap: o.gap ?? 'md',
    padding: o.padding ?? 'none',
    width: o.width ?? 'full',
    align: o.align ?? 'left',
  },
  ...(o.style ? { style: o.style } : {}),
})

const bGrid = (blocks: RawBlock[], o: GridOptions = {}): RawBlock => ({
  type: 'grid',
  settings: {
    blocks,
    columns: o.columns ?? '3',
    gap: o.gap ?? 'lg',
    align: o.align ?? 'stretch',
    stackOnMobile: o.stackOnMobile ?? true,
    padding: o.padding ?? 'none',
  },
})

/** A row of buttons, placed with the copy that introduces them. */
const bButtons = (buttons: RawBlock[], align = 'left'): RawBlock => ({
  type: 'row',
  settings: {
    blocks: buttons,
    gap: 'sm',
    align: 'center',
    justify: align === 'center' ? 'center' : 'start',
    wrap: true,
    stackOnMobile: false,
    padding: 'none',
  },
})

/** A composed block section: the page column, a band tone, generous padding. */
function composed(
  tone: 'default' | 'subtle' | 'inverse' | 'brand' | 'accent' = 'default',
  padding = 'xl',
): SectionStyle {
  return {
    width: 'full',
    paddingTop: padding,
    paddingBottom: padding,
    ...(tone !== 'default' ? { colorScheme: tone } : {}),
  }
}

type BandTone = Parameters<typeof composed>[0]

/** The primitive hero: a headline, a line of copy and up to two buttons. */
function heroComposed(copy: {
  heading: string
  body: string
  primary?: string
  secondary?: string
  align?: 'left' | 'center'
  tone?: BandTone
}): SectionInstance {
  const align = copy.align ?? 'left'
  const buttons = [
    ...(copy.primary ? [bButton(copy.primary, { size: 'lg', align })] : []),
    ...(copy.secondary ? [bButton(copy.secondary, { size: 'lg', align, variant: 'outline' })] : []),
  ]
  return section(
    'blocks',
    {
      gap: 'md',
      blocks: [
        bColumn(
          [
            bHeading(copy.heading, { level: 'h1', size: '3xl', align }),
            bText(copy.body, { size: 'lg', align }),
            ...(buttons.length > 0 ? [bButtons(buttons, align)] : []),
          ],
          { align, width: align === 'center' ? 'medium' : 'full' },
        ),
      ],
    },
    composed(copy.tone ?? 'inverse'),
  )
}

/** A centred editorial statement on a band. */
function statementComposed(copy: {
  eyebrow: string
  heading: string
  body: string
  button?: string
  tone?: BandTone
}): SectionInstance {
  return section(
    'blocks',
    {
      gap: 'md',
      blocks: [
        bColumn(
          [
            bBadge(copy.eyebrow, { tone: 'subtle', align: 'center' }),
            bHeading(copy.heading, { level: 'h2', size: '3xl', align: 'center' }),
            bRichText(copy.body, { align: 'center' }),
            ...(copy.button
              ? [bButton(copy.button, { size: 'lg', align: 'center', variant: 'outline' })]
              : []),
          ],
          { align: 'center', width: 'medium' },
        ),
      ],
    },
    composed(copy.tone ?? 'inverse'),
  )
}

/** A centred note on the page background: a heading and rich text. */
function noteComposed(heading: string, body: string): SectionInstance {
  return section(
    'blocks',
    {
      gap: 'md',
      blocks: [
        bColumn(
          [
            bHeading(heading, { level: 'h2', size: 'xl', align: 'center' }),
            bRichText(body, { align: 'center' }),
          ],
          { align: 'center', width: 'medium' },
        ),
      ],
    },
    composed('default', 'xl'),
  )
}

/** A photo beside copy — the Statement section's contained and split layouts. */
function imageTextComposed(copy: {
  heading: string
  body: string
  button?: string
  imageSide?: 'left' | 'right'
}): SectionInstance {
  const image = bImage()
  const text = bColumn([
    bHeading(copy.heading, { level: 'h2', size: 'xl' }),
    bRichText(copy.body),
    ...(copy.button ? [bButton(copy.button, { size: 'md' })] : []),
  ])
  return section(
    'blocks',
    {
      gap: 'lg',
      blocks: [
        bGrid(copy.imageSide === 'right' ? [text, image] : [image, text], {
          columns: '2',
          gap: 'xl',
          align: 'center',
        }),
      ],
    },
    composed('default', 'lg'),
  )
}

/** Three soft cards with a title and a line each, under an optional heading. */
function cardsComposed(
  items: ReadonlyArray<{ title: string; text: string }>,
  heading?: string,
): SectionInstance {
  return section(
    'blocks',
    {
      gap: 'lg',
      blocks: [
        ...(heading ? [bHeading(heading, { level: 'h2', size: 'xl' })] : []),
        bGrid(
          items.map((item) =>
            bColumn([bHeading(item.title, { level: 'h3', size: 'md' }), bText(item.text)], {
              gap: 'sm',
              style: {
                padding: 'md',
                borderRadius: 'lg',
                borderWidth: '1',
                borderColor: '#e5e5e5',
              },
            }),
          ),
          { columns: '3', align: 'stretch' },
        ),
      ],
    },
    composed('default', 'lg'),
  )
}

/** Three customer quotes in soft cards, under an optional heading. */
function reviewsComposed(
  items: ReadonlyArray<{ quote: string; author: string; role: string }>,
  heading?: string,
): SectionInstance {
  return section(
    'blocks',
    {
      gap: 'lg',
      blocks: [
        ...(heading ? [bHeading(heading, { level: 'h2', size: 'xl' })] : []),
        bGrid(
          items.map((item) =>
            bColumn(
              [
                bText(item.quote, { size: 'lg' }),
                bHeading(item.author, { level: 'h3', size: 'md' }),
                bText(item.role),
              ],
              {
                gap: 'sm',
                style: { padding: 'md', borderRadius: 'lg', backgroundColor: '#f5f5f5' },
              },
            ),
          ),
          { columns: '3', align: 'stretch' },
        ),
      ],
    },
    composed('default', 'lg'),
  )
}

/** Short promises with an icon each, under an optional heading. */
function featuresComposed(
  items: ReadonlyArray<{ icon: string; title: string; text: string }>,
  heading?: string,
): SectionInstance {
  return section(
    'blocks',
    {
      gap: 'lg',
      blocks: [
        ...(heading ? [bHeading(heading, { level: 'h2', size: 'xl' })] : []),
        bGrid(
          items.map((item) =>
            bColumn(
              [
                bIcon(item.icon),
                bHeading(item.title, { level: 'h3', size: 'md' }),
                bText(item.text),
              ],
              { gap: 'sm' },
            ),
          ),
          { columns: String(Math.min(4, Math.max(2, items.length))), align: 'start' },
        ),
      ],
    },
    composed('default', 'lg'),
  )
}

interface ThemeBuild {
  settings: ThemeSettings
  header: FieldValues
  footer: FieldValues
  home: SectionInstance[]
}

function makeSeed(
  slug: string,
  name: string,
  description: Localized,
  sortOrder: number,
  recommendedLooks: readonly string[],
  build: () => ThemeBuild,
): ThemeSeed {
  let cached: ThemeContent | null = null
  return {
    slug,
    name,
    description,
    sortOrder,
    recommendedLooks,
    content: () => {
      if (cached) return cached
      const { settings, header, footer, home } = build()
      cached = sanitizeThemeContent({
        settings,
        layout: { header, footer },
        templates: {
          home,
          product: defaultProductTemplate(),
          article: defaultArticleTemplate(),
          catalog: defaultCatalogTemplate(),
          orderTracking: defaultOrderTrackingTemplate(),
        },
        recommendedLooks: [...recommendedLooks],
      })
      return cached
    },
  }
}

interface SettingsInput {
  colors: ThemeSettings['colors']
  heading: FontFamily
  body: FontFamily
  radius?: RadiusOption
  buttonStyle?: ButtonStyle
  cardStyle?: CardStyle
  animation?: AnimationStyle
  schemes?: Partial<Record<SchemeKey, SchemeColors>>
}

function themeSettings(input: SettingsInput): ThemeSettings {
  return sanitizeThemeSettings({
    colors: input.colors,
    fonts: { heading: input.heading, body: input.body },
    radius: input.radius ?? 'md',
    buttonStyle: input.buttonStyle ?? 'solid',
    cardStyle: input.cardStyle ?? 'border',
    animation: input.animation ?? 'none',
    ...(input.schemes ? { schemes: input.schemes } : {}),
  })
}

/** A theme settings block straight from a curated look and palette pair. */
function lookSettings(
  lookKey: string,
  overrides: Omit<Partial<SettingsInput>, 'colors' | 'heading' | 'body'> & {
    colors?: ThemeSettings['colors']
    heading?: FontFamily
    body?: FontFamily
  } = {},
): ThemeSettings {
  const look = findLook(lookKey)
  const palette = findPalette(look.palette)
  const fonts = findFontPair(look.fontPair)
  return themeSettings({
    colors: overrides.colors ?? palette.colors,
    heading: overrides.heading ?? fonts.heading,
    body: overrides.body ?? fonts.body,
    radius: overrides.radius ?? look.radius,
    buttonStyle: overrides.buttonStyle ?? look.buttonStyle,
    cardStyle: overrides.cardStyle ?? look.cardStyle,
    animation: overrides.animation ?? look.animation,
    schemes: { ...(palette.schemes ?? {}), ...(overrides.schemes ?? {}) },
  })
}

/* -------------------------------------------------------------------------- */
/* Shared copy                                                                */
/* -------------------------------------------------------------------------- */

const TRUST_ITEMS = [
  {
    icon: 'truck',
    title: 'Gratis ongkir',
    text: 'Untuk pesanan di atas Rp 300.000, ke seluruh Indonesia.',
  },
  {
    icon: 'banknote',
    title: 'COD tersedia',
    text: 'Bayar di tempat untuk area yang didukung kurir.',
  },
  {
    icon: 'refresh-cw',
    title: 'Retur 7 hari',
    text: 'Tidak cocok? Ajukan pengembalian dengan mudah.',
  },
  { icon: 'shield-check', title: 'Pembayaran aman', text: 'Dana ditahan sampai barang diterima.' },
]

const FAQ_ITEMS = [
  {
    question: 'Berapa lama pesanan saya dikirim?',
    answer:
      'Pesanan diproses dalam 1×24 jam kerja. Estimasi tiba 1–4 hari tergantung kota tujuan, dan nomor resi dikirim lewat WhatsApp.',
  },
  {
    question: 'Apakah bisa bayar di tempat?',
    answer:
      'COD tersedia untuk area yang didukung kurir. Pilih metode COD saat checkout; biaya penanganan mengikuti tarif kurir.',
  },
  {
    question: 'Bagaimana cara mengembalikan barang?',
    answer:
      'Ajukan retur maksimal 7 hari setelah barang diterima lewat halaman pesanan. Barang dikembalikan dalam kondisi seperti saat diterima.',
  },
]

const REVIEWS = [
  {
    quote: 'Sampainya cepat dan packing rapi. Kualitasnya persis seperti di foto.',
    author: 'Rina',
    role: 'Jakarta',
  },
  {
    quote: 'Harga masuk akal untuk kualitas segini. Sudah pesan berkali-kali.',
    author: 'Bagas',
    role: 'Bandung',
  },
  {
    quote: 'Adminnya cepat balas dan membantu waktu ada kendala ukuran.',
    author: 'Sari',
    role: 'Surabaya',
  },
]

/* -------------------------------------------------------------------------- */
/* Brutalist                                                                  */
/* -------------------------------------------------------------------------- */

const brutalist = makeSeed(
  'brutalist',
  'Brutalist',
  {
    en: 'Raw type, thick lines and loud honesty — for streetwear and limited drops.',
    id: 'Tipografi tebal, garis kuat, dan kejujuran yang lantang — untuk streetwear dan rilisan terbatas.',
  },
  10,
  ['neo-brutalist'],
  () => ({
    settings: themeSettings({
      colors: { brand: '#111111', background: '#f4f3ee', text: '#111111', accent: '#ffd60a' },
      heading: 'Space Grotesk',
      body: 'Space Grotesk',
      radius: 'none',
      buttonStyle: 'hard',
      cardStyle: 'hard',
      animation: 'none',
      schemes: {
        subtle: { background: '#e7e4da', text: '#111111', button: '#111111' },
        inverse: { background: '#111111', text: '#f4f3ee', button: '#ffd60a' },
        brand: { background: '#111111', text: '#ffd60a', button: '#ffd60a' },
        accent: { background: '#ffd60a', text: '#111111', button: '#111111' },
      },
    }),
    header: {
      layout: 'classic',
      sticky: true,
      showSearch: true,
      announcementScheme: 'accent',
      announcements: [
        { text: 'Rilisan terbatas: batch Juli sudah dibuka', link: { kind: 'none' } },
      ],
    },
    footer: {
      colorScheme: 'inverse',
      about: 'Dibuat dalam batch kecil di Bandung. Tanpa jalan pintas.',
      showContact: true,
      showPages: true,
      showSocials: true,
    },
    // The visual sections are primitive block trees; the catalogue and the
    // accordion stay code sections, because they read shop data or interact.
    home: [
      heroComposed({
        heading: 'Tebal, jujur, tahan lama.',
        body: 'Barang dibuat dalam batch kecil dengan bahan yang bisa kamu lacak.',
        primary: 'Lihat rilisan',
        tone: 'inverse',
      }),
      section('scrolling-text', {
        items: [
          { text: 'TANPA JALAN PINTAS' },
          { text: 'BATCH KECIL' },
          { text: 'HARGA JUJUR' },
          { text: 'DIKERJAKAN TANGAN' },
        ],
        size: 'xl',
        separator: 'star',
        speed: 'normal',
        uppercase: true,
      }),
      section('category-rail', { heading: 'Pilih jalur', layout: 'tiles', limit: 6 }),
      section('product-list', {
        source: 'collection',
        heading: 'Rilisan minggu ini',
        limit: 8,
        columns: '4',
      }),
      imageTextComposed({
        heading: 'Dibuat orang, bukan mesin.',
        body: 'Setiap jahitan dikerjakan penjahit lokal. Kami memakai bahan sisa dan kain deadstock agar tidak ada yang terbuang.',
        button: 'Cerita kami',
        imageSide: 'right',
      }),
      cardsComposed(
        [
          {
            title: 'Kualitas dulu',
            text: 'Satu barang lulus tiga kali pemeriksaan sebelum dikirim.',
          },
          {
            title: 'Harga terbuka',
            text: 'Kami tulis biaya bahan dan jahit di tiap halaman produk.',
          },
          { title: 'Tidak musiman', text: 'Model klasik yang tetap dipakai bertahun-tahun.' },
        ],
        'Aturan main',
      ),
      featuresComposed(TRUST_ITEMS, 'Tanpa drama'),
      reviewsComposed(REVIEWS, 'Kata pembeli'),
      section('faq', {
        heading: 'Jawaban lugas',
        items: FAQ_ITEMS,
        align: 'left',
        width: 'narrow',
      }),
      section('product-list', {
        source: 'latest',
        heading: 'Semua produk',
        limit: 12,
        columns: '4',
      }),
    ],
  }),
)

/* -------------------------------------------------------------------------- */
/* Minimalist                                                                 */
/* -------------------------------------------------------------------------- */

const minimalist = makeSeed(
  'minimalist',
  'Minimalist',
  {
    en: 'White space, a neutral palette and grid-led clarity — for design and tech.',
    id: 'Ruang putih, palet netral, dan tata letak grid — untuk desain dan teknologi.',
  },
  20,
  ['minimal', 'monochrome-studio'],
  () => ({
    settings: themeSettings({
      colors: findPalette('black-white').colors,
      heading: 'Inter',
      body: 'Inter',
      radius: 'none',
      buttonStyle: 'solid',
      cardStyle: 'flat',
      animation: 'none',
    }),
    header: { layout: 'inline', sticky: true, showSearch: true },
    footer: {
      colorScheme: 'default',
      about: '',
      showContact: true,
      showPages: true,
      showSocials: true,
    },
    home: [
      heroComposed({
        heading: 'Lebih sedikit, lebih baik.',
        body: 'Barang yang dibuat sekali dengan benar.',
        primary: 'Mulai belanja',
        tone: 'default',
      }),
      section('product-list', {
        source: 'latest',
        heading: 'Pilihan terbaru',
        limit: 8,
        columns: '4',
      }),
      section(
        'blocks',
        {
          gap: 'md',
          blocks: [
            bColumn(
              [
                bHeading('Satu barang, satu alasan.', { level: 'h2', size: 'xl' }),
                bRichText(
                  'Kami hanya menjual barang yang kami pakai sendiri. Tidak ada koleksi musiman, tidak ada diskon palsu — hanya barang yang layak dibeli.',
                ),
              ],
              { width: 'narrow' },
            ),
          ],
        },
        composed('default', 'xl'),
      ),
      imageTextComposed({
        heading: 'Bahan yang baik, dijahit sederhana.',
        body: 'Katun organik, potongan lurus, tanpa logo besar. Semakin lama dipakai, semakin nyaman.',
        button: 'Tentang kami',
        imageSide: 'right',
      }),
      section('logo-list', {
        heading: 'Diliput oleh',
        layout: 'row',
        speed: 'normal',
        grayscale: true,
        items: [
          { alt: 'Media satu', link: { kind: 'none' } },
          { alt: 'Media dua', link: { kind: 'none' } },
          { alt: 'Media tiga', link: { kind: 'none' } },
          { alt: 'Media empat', link: { kind: 'none' } },
        ],
      }),
      section('category-rail', { heading: 'Kategori', layout: 'tiles', limit: 6 }),
      section('faq', {
        heading: 'Pertanyaan umum',
        items: FAQ_ITEMS,
        align: 'left',
        width: 'narrow',
      }),
      reviewsComposed(REVIEWS, 'Ulasan'),
      section('product-list', {
        source: 'collection',
        heading: 'Koleksi pilihan',
        limit: 8,
        columns: '4',
      }),
    ],
  }),
)

/* -------------------------------------------------------------------------- */
/* Bold & maximal                                                             */
/* -------------------------------------------------------------------------- */

const bold = makeSeed(
  'bold',
  'Bold',
  {
    en: 'Saturated colour, punchy type and motion — for campaigns that need to be loud.',
    id: 'Warna saturasi tinggi, tipografi tebal, dan animasi — untuk kampanye yang harus lantang.',
  },
  30,
  ['bold-maximal'],
  () => ({
    settings: lookSettings('bold-maximal'),
    header: {
      layout: 'inline',
      sticky: true,
      showSearch: true,
      announcementScheme: 'brand',
      announcements: [{ text: 'Gratis ongkir minggu ini — tanpa minimum', link: { kind: 'none' } }],
    },
    footer: {
      colorScheme: 'inverse',
      about: '',
      showContact: true,
      showPages: true,
      showSocials: true,
    },
    home: [
      heroComposed({
        heading: 'Berani tampil beda.',
        body: 'Koleksi baru untuk kamu yang tidak mau terlihat sama.',
        primary: 'Belanja sekarang',
        secondary: 'Lihat kampanye',
        align: 'center',
        tone: 'brand',
      }),
      section('scrolling-text', {
        items: [{ text: 'BARU' }, { text: 'BERANI' }, { text: 'BEDA' }, { text: 'SEKARANG' }],
        size: 'xl',
        separator: 'dot',
        speed: 'fast',
        uppercase: true,
      }),
      section('product-list', {
        source: 'collection',
        heading: 'Sedang naik',
        limit: 10,
        columns: '5',
      }),
      cardsComposed(
        [
          { title: 'Warna berani', text: 'Palet yang tidak pernah setengah hati.' },
          { title: 'Potongan nyaman', text: 'Longgar di tempat yang tepat.' },
          { title: 'Edisi terbatas', text: 'Sekali habis, tidak dibuat lagi.' },
        ],
        'Yang bikin beda',
      ),
      featuresComposed(TRUST_ITEMS),
      section('quotes', {
        variant: 'quotes',
        heading: 'Kata mereka',
        layout: 'marquee',
        direction: 'left',
        speed: 'normal',
        items: REVIEWS,
      }),
      section('product-list', {
        source: 'tabs',
        heading: 'Pilih suasana',
        limit: 8,
        columns: '4',
        tabs: [],
      }),
      section('faq', {
        heading: 'Masih ragu?',
        items: FAQ_ITEMS,
        align: 'center',
        width: 'narrow',
      }),
      section('product-list', {
        source: 'latest',
        heading: 'Semua yang baru',
        limit: 12,
        columns: '5',
      }),
    ],
  }),
)

/* -------------------------------------------------------------------------- */
/* Modern                                                                     */
/* -------------------------------------------------------------------------- */

const modern = makeSeed(
  'modern',
  'Modern',
  {
    en: 'Clean, confident and conversion-led — the everyday commerce default.',
    id: 'Bersih, percaya diri, dan berorientasi penjualan — pilihan umum untuk toko harian.',
  },
  40,
  ['minimal', 'tech-futuristic'],
  () => ({
    settings: themeSettings({
      colors: findPalette('cobalt-white').colors,
      heading: 'Plus Jakarta Sans',
      body: 'Inter',
      radius: 'md',
      buttonStyle: 'solid',
      cardStyle: 'border',
      animation: 'subtle',
    }),
    header: { layout: 'classic', sticky: true, showSearch: true },
    footer: {
      colorScheme: 'subtle',
      about: '',
      showContact: true,
      showPages: true,
      showSocials: true,
    },
    home: [
      heroComposed({
        heading: 'Belanja cepat, barang sampai.',
        body: 'Produk pilihan, harga jelas, pengiriman hari yang sama untuk area kota.',
        primary: 'Mulai belanja',
        secondary: 'Lacak pesanan',
        tone: 'subtle',
      }),
      featuresComposed(TRUST_ITEMS),
      section('product-list', {
        source: 'collection',
        heading: 'Paling dicari',
        limit: 10,
        columns: '5',
      }),
      imageTextComposed({
        heading: 'Cek dulu, belanja kemudian.',
        body: 'Setiap produk punya foto asli, ukuran detail, dan ulasan pembeli sungguhan.',
        button: 'Cara belanja',
        imageSide: 'left',
      }),
      section('product-list', {
        source: 'tabs',
        heading: 'Jelajahi koleksi',
        limit: 8,
        columns: '4',
        tabs: [],
      }),
      reviewsComposed(REVIEWS, 'Dipercaya ribuan pembeli'),
      section('faq', {
        heading: 'Pertanyaan yang sering muncul',
        items: FAQ_ITEMS,
        align: 'left',
        width: 'narrow',
      }),
      section('product-list', { source: 'latest', heading: 'Baru masuk', limit: 12, columns: '5' }),
      noteComposed(
        'Butuh bantuan memilih?',
        'Tim kami siap membantu lewat WhatsApp setiap hari, 09.00–21.00 WIB.',
      ),
    ],
  }),
)

/* -------------------------------------------------------------------------- */
/* Editorial                                                                  */
/* -------------------------------------------------------------------------- */

const editorial = makeSeed(
  'editorial',
  'Editorial',
  {
    en: 'A dramatic serif, high contrast and image-first storytelling — for fashion labels.',
    id: 'Serif dramatis, kontras tinggi, dan bercerita lewat gambar — untuk label fashion.',
  },
  50,
  ['editorial-fashion', 'luxury-boutique'],
  () => ({
    settings: lookSettings('editorial-fashion'),
    header: { layout: 'centered', sticky: true, showSearch: false },
    footer: {
      colorScheme: 'inverse',
      about: '',
      showContact: true,
      showPages: true,
      showSocials: true,
    },
    home: [
      statementComposed({
        eyebrow: 'Musim ini',
        heading: 'Mode yang tidak mengikuti tren.',
        body: 'Sepuluh potong yang dibuat untuk dipakai bertahun-tahun, bukan satu musim.',
        button: 'Baca cerita',
      }),
      section('product-list', {
        source: 'collection',
        heading: 'Koleksi utama',
        limit: 8,
        columns: '4',
      }),
      imageTextComposed({
        heading: 'Di balik layar.',
        body: 'Kami bekerja dengan penjahit kecil di tiga kota, memakai kain sisa dari pabrik tekstil.',
        button: 'Proses kami',
        imageSide: 'right',
      }),
      cardsComposed(
        [
          { title: 'Bahan', text: 'Kain mati dari pabrik yang tetap layak pakai.' },
          { title: 'Potongan', text: 'Dipotong tangan, satu per satu.' },
          { title: 'Perawatan', text: 'Cuci dingin, jemur di tempat teduh.' },
        ],
        'Sisi lain',
      ),
      reviewsComposed(REVIEWS, 'Kata mereka'),
      section('faq', {
        heading: 'Sebelum memesan',
        items: FAQ_ITEMS,
        align: 'left',
        width: 'narrow',
      }),
      section('product-list', {
        source: 'latest',
        heading: 'Semua koleksi',
        limit: 12,
        columns: '4',
      }),
    ],
  }),
)

/* -------------------------------------------------------------------------- */
/* Elegant                                                                    */
/* -------------------------------------------------------------------------- */

const elegant = makeSeed(
  'elegant',
  'Elegant',
  {
    en: 'Dark surfaces, champagne accents and quiet space — for boutique and jewellery.',
    id: 'Permukaan gelap, aksen sampanye, dan ruang tenang — untuk butik dan perhiasan.',
  },
  60,
  ['luxury-boutique'],
  () => ({
    settings: lookSettings('luxury-boutique'),
    header: { layout: 'centered', sticky: true, showSearch: false },
    footer: {
      colorScheme: 'inverse',
      about: '',
      showContact: true,
      showPages: true,
      showSocials: true,
    },
    home: [
      imageTextComposed({
        heading: 'Dibuat untuk disimpan lama.',
        body: 'Perhiasan dan aksesori dalam jumlah terbatas, dikerjakan pengrajin dengan pengalaman puluhan tahun.',
        button: 'Lihat koleksi',
        imageSide: 'right',
      }),
      section('product-list', {
        source: 'collection',
        heading: 'Pilihan butik',
        limit: 8,
        columns: '4',
      }),
      statementComposed({
        eyebrow: 'Sejak 1998',
        heading: 'Satu potong untuk seumur hidup.',
        body: 'Kami memilih batu dan logam terbaik, lalu mengerjakannya dengan tangan.',
        button: 'Tentang kami',
      }),
      cardsComposed(
        [
          { title: 'Material jujur', text: 'Emas dan perak bersertifikat.' },
          { title: 'Dikerjakan tangan', text: 'Tidak ada produksi massal.' },
          { title: 'Garansi seumur hidup', text: 'Perbaikan gratis untuk kerusakan pengerjaan.' },
        ],
        'Nilai kami',
      ),
      imageTextComposed({
        heading: 'Kotak yang siap diberikan.',
        body: 'Setiap pesanan datang dalam kotak kayu dengan kartu perawatan.',
        button: 'Panduan hadiah',
        imageSide: 'left',
      }),
      reviewsComposed(REVIEWS, 'Cerita pelanggan'),
      section('faq', {
        heading: 'Perlu diketahui',
        items: FAQ_ITEMS,
        align: 'left',
        width: 'narrow',
      }),
      section('product-list', { source: 'latest', heading: 'Koleksi', limit: 8, columns: '4' }),
    ],
  }),
)

/* -------------------------------------------------------------------------- */
/* Marketplace (Amazon-style)                                                 */
/* -------------------------------------------------------------------------- */

const marketplace = makeSeed(
  'marketplace',
  'Marketplace',
  {
    en: 'A dense general store: many products, clear prices, fast delivery — Amazon-style.',
    id: 'Toko serba ada yang padat: banyak produk, harga jelas, kirim cepat — gaya Amazon.',
  },
  70,
  ['minimal', 'bold-maximal'],
  () => ({
    settings: themeSettings({
      colors: { brand: '#ff9900', background: '#ffffff', text: '#0f1111', accent: '#146eb4' },
      heading: 'Inter',
      body: 'Inter',
      radius: 'sm',
      buttonStyle: 'solid',
      cardStyle: 'border',
      animation: 'none',
      schemes: {
        subtle: { background: '#f7f8f8', text: '#0f1111', button: '#ff9900' },
        inverse: { background: '#131921', text: '#ffffff', button: '#ff9900' },
        brand: { background: '#ff9900', text: '#111111', button: '#111111' },
        accent: { background: '#146eb4', text: '#ffffff', button: '#ffffff' },
      },
    }),
    header: {
      layout: 'inline',
      sticky: true,
      showSearch: true,
      announcementScheme: 'inverse',
      announcements: [
        { text: 'Gratis ongkir untuk pesanan di atas Rp 300.000', link: { kind: 'none' } },
      ],
    },
    footer: {
      colorScheme: 'inverse',
      about: 'Jual beli online dengan pengiriman ke seluruh Indonesia.',
      showContact: true,
      showPages: true,
      showSocials: true,
    },
    home: [
      heroComposed({
        heading: 'Semua kebutuhan, dikirim cepat.',
        body: 'Ribuan produk dari penjual terverifikasi, dengan harga yang jelas.',
        primary: 'Mulai belanja',
        tone: 'inverse',
      }),
      section('category-rail', { heading: 'Kategori populer', layout: 'tiles', limit: 6 }),
      section('product-list', {
        source: 'collection',
        heading: 'Terlaris minggu ini',
        limit: 10,
        columns: '5',
      }),
      featuresComposed(TRUST_ITEMS, 'Belanja tanpa khawatir'),
      section('product-list', { source: 'shelves', limit: 6, columns: '4' }),
      section('product-list', { source: 'latest', heading: 'Baru masuk', limit: 12, columns: '5' }),
      section('promo-codes', {
        heading: 'Voucher yang bisa dipakai',
        items: [
          { code: 'HEMAT10', title: 'Diskon 10%', terms: 'Min. belanja Rp 150.000' },
          { code: 'GRATISONGKIR', title: 'Gratis ongkir', terms: 'Min. belanja Rp 300.000' },
          { code: 'BARU20', title: 'Pembeli baru 20%', terms: 'Maks. diskon Rp 50.000' },
        ],
      }),
      reviewsComposed(REVIEWS, 'Ulasan pembeli'),
      section('faq', {
        heading: 'Pusat bantuan',
        items: FAQ_ITEMS,
        align: 'left',
        width: 'narrow',
      }),
    ],
  }),
)

/* -------------------------------------------------------------------------- */
/* Preloved (thrift marketplace)                                              */
/* -------------------------------------------------------------------------- */

const preloved = makeSeed(
  'preloved',
  'Preloved',
  {
    en: 'A warm thrift marketplace: community sellers, rekber payments and second-hand finds — Preloved-style.',
    id: 'Marketplace thrift yang ramah: penjual komunitas, pembayaran rekber, dan barang preloved — gaya Preloved.',
  },
  80,
  ['warm-organic', 'retro-vintage'],
  () => ({
    settings: themeSettings({
      // The logo red and near-black CTA from Preloved's own storefront, with
      // the same soft grey surfaces and rounded cards.
      colors: { brand: '#eb2120', background: '#ffffff', text: '#0f1111', accent: '#111111' },
      heading: 'Manrope',
      body: 'Manrope',
      radius: 'lg',
      buttonStyle: 'solid',
      cardStyle: 'border',
      animation: 'subtle',
      schemes: {
        subtle: { background: '#f3f4f5', text: '#0f1111', button: '#111111' },
        inverse: { background: '#0f1111', text: '#ffffff', button: '#eb2120' },
        // A shade deeper than the solid button red so white body text clears
        // the 4.5:1 guard; the solid brand colour stays #eb2120.
        brand: { background: '#d61f1e', text: '#ffffff', button: '#111111' },
        accent: { background: '#111111', text: '#ffffff', button: '#eb2120' },
      },
    }),
    header: {
      layout: 'classic',
      sticky: true,
      showSearch: true,
      announcementScheme: 'brand',
      announcements: [
        { text: 'Barang baru diunggah setiap hari oleh ratusan penjual', link: { kind: 'none' } },
      ],
    },
    footer: {
      colorScheme: 'subtle',
      about:
        'Jual beli fashion preloved dengan pembayaran rekber dan pengiriman ke seluruh Indonesia.',
      showContact: true,
      showPages: true,
      showSocials: true,
    },
    home: [
      heroComposed({
        heading: 'Barang bagus, pemilik baru.',
        body: 'Jual-beli fashion preloved dengan rekber aman dan kurir terpantau.',
        primary: 'Belanja sekarang',
        secondary: 'Mulai jualan',
        tone: 'inverse',
      }),
      section('category-rail', { heading: 'Jelajahi kategori', layout: 'tiles', limit: 6 }),
      featuresComposed([
        {
          icon: 'shield-check',
          title: 'Rekber aman',
          text: 'Dana diteruskan setelah barang diterima.',
        },
        {
          icon: 'badge-check',
          title: 'Penjual terverifikasi',
          text: 'Identitas dan ulasan asli dari pembeli.',
        },
        {
          icon: 'truck',
          title: 'Ongkir dihitung',
          text: 'Tarif kurir otomatis di halaman produk.',
        },
        {
          icon: 'refresh-cw',
          title: 'Bisa retur',
          text: 'Barang tidak sesuai? Ajukan pengembalian.',
        },
      ]),
      section('product-list', { source: 'shelves', limit: 8, columns: '4' }),
      section('product-list', {
        source: 'collection',
        heading: 'Pilihan editor',
        limit: 10,
        columns: '5',
      }),
      cardsComposed(
        [
          {
            title: 'Harga masuk akal',
            text: 'Barang berkualitas dengan harga jauh di bawah baru.',
          },
          { title: 'Tidak kembaran', text: 'Setiap potong unik, tidak diproduksi ulang.' },
          {
            title: 'Lebih ramah bumi',
            text: 'Satu baju dipakai lagi berarti satu limbah berkurang.',
          },
        ],
        'Kenapa belanja preloved?',
      ),
      reviewsComposed(REVIEWS, 'Cerita komunitas'),
      section('faq', {
        heading: 'Pertanyaan pembeli baru',
        items: FAQ_ITEMS,
        align: 'left',
        width: 'narrow',
      }),
      section('product-list', {
        source: 'latest',
        heading: 'Baru diunggah',
        limit: 12,
        columns: '5',
      }),
    ],
  }),
)

/* -------------------------------------------------------------------------- */
/* Retro                                                                      */
/* -------------------------------------------------------------------------- */

const retro = makeSeed(
  'retro',
  'Retro',
  {
    en: 'Muted warm tones and a groovy serif — for coffee, vinyl and vintage apparel.',
    id: 'Warna hangat yang lembut dan serif berkarakter — untuk kopi, vinil, dan pakaian vintage.',
  },
  90,
  ['retro-vintage', 'warm-organic'],
  () => ({
    settings: lookSettings('retro-vintage'),
    header: { layout: 'centered', sticky: true, showSearch: true },
    footer: {
      colorScheme: 'inverse',
      about: '',
      showContact: true,
      showPages: true,
      showSocials: true,
    },
    home: [
      heroComposed({
        heading: 'Rasa lama, dibuat hari ini.',
        body: 'Kopi sangrai kecil dan barang vintage pilihan.',
        primary: 'Lihat menu',
        align: 'center',
        tone: 'inverse',
      }),
      section('scrolling-text', {
        items: [{ text: 'SANGGAR KECIL' }, { text: 'SEJAK 2016' }, { text: 'VINTAGE PILIHAN' }],
        size: 'lg',
        separator: 'star',
        speed: 'slow',
        uppercase: true,
      }),
      section('product-list', {
        source: 'collection',
        heading: 'Sedang diseduh',
        limit: 8,
        columns: '4',
      }),
      imageTextComposed({
        heading: 'Disangrai setiap minggu.',
        body: 'Biji dari petani Sumatra dan Jawa, disangrai dalam batch 5 kg agar selalu segar.',
        button: 'Cara menyeduh',
        imageSide: 'right',
      }),
      cardsComposed(
        [
          { title: 'Manual brew', text: 'V60 dan tubruk, diseduh di depan kamu.' },
          { title: 'Barang vintage', text: 'Piring, radio, dan poster dari era 70-an.' },
          { title: 'Ruang baca', text: 'Buku bekas yang boleh dipinjam di tempat.' },
        ],
        'Sudut kedai',
      ),
      reviewsComposed(REVIEWS, 'Kata pelanggan'),
      section('faq', {
        heading: 'Sering ditanyakan',
        items: FAQ_ITEMS,
        align: 'left',
        width: 'narrow',
      }),
      section('product-list', {
        source: 'latest',
        heading: 'Dari rak kami',
        limit: 12,
        columns: '4',
      }),
      section('category-rail', { heading: 'Kategori', layout: 'tiles', limit: 6 }),
    ],
  }),
)

/* -------------------------------------------------------------------------- */
/* Organic                                                                    */
/* -------------------------------------------------------------------------- */

const organic = makeSeed(
  'organic',
  'Organic',
  {
    en: 'Botanical greens and honest texture — for wellness, crafts and sustainable goods.',
    id: 'Hijau botani dan tekstur apa adanya — untuk wellness, kriya, dan barang berkelanjutan.',
  },
  100,
  ['natural-earthy', 'japandi-quiet'],
  () => ({
    settings: lookSettings('natural-earthy'),
    header: { layout: 'classic', sticky: true, showSearch: true },
    footer: {
      colorScheme: 'subtle',
      about: 'Barang alami yang dibuat dengan tangan, untuk rumah dan tubuh.',
      showContact: true,
      showPages: true,
      showSocials: true,
    },
    home: [
      heroComposed({
        heading: 'Tumbuh perlahan, dibuat dengan tangan.',
        body: 'Perawatan dan perlengkapan rumah dari bahan alami.',
        primary: 'Belanja sekarang',
        align: 'center',
        tone: 'inverse',
      }),
      noteComposed(
        'Dari kebun ke rak.',
        'Kami bekerja langsung dengan petani dan perajin. Tidak ada bahan sintetis, tidak ada kemasan sekali pakai.',
      ),
      section('product-list', {
        source: 'collection',
        heading: 'Paling dicintai',
        limit: 8,
        columns: '4',
      }),
      imageTextComposed({
        heading: 'Bahan yang bisa dilacak.',
        body: 'Setiap produk menuliskan asal bahan dan siapa yang membuatnya.',
        button: 'Baca jurnal',
        imageSide: 'left',
      }),
      featuresComposed(
        [
          { icon: 'leaf', title: 'Alami', text: 'Tanpa paraben, silikon, dan pewarna sintetis.' },
          {
            icon: 'heart',
            title: 'Cruelty-free',
            text: 'Tidak diuji pada hewan, tanpa bahan hewani.',
          },
          { icon: 'droplet', title: 'Isi ulang', text: 'Bawa wadahmu, dapat potongan harga.' },
          { icon: 'award', title: 'Perajin lokal', text: 'Dibuat petani dan perajin mitra kami.' },
        ],
        'Janji kami',
      ),
      cardsComposed(
        [
          { title: 'Merawat kulit', text: 'Rutinitas tiga langkah yang cukup.' },
          { title: 'Menanam di rumah', text: 'Mulai dari herba di ambang jendela.' },
          { title: 'Mengurangi plastik', text: 'Kebiasaan kecil yang bertahan.' },
        ],
        'Jurnal',
      ),
      reviewsComposed(REVIEWS, 'Kata pelanggan'),
      section('faq', {
        heading: 'Pertanyaan umum',
        items: FAQ_ITEMS,
        align: 'left',
        width: 'narrow',
      }),
      section('product-list', {
        source: 'latest',
        heading: 'Semua produk',
        limit: 12,
        columns: '4',
      }),
    ],
  }),
)

/* -------------------------------------------------------------------------- */
/* Tech                                                                       */
/* -------------------------------------------------------------------------- */

const tech = makeSeed(
  'tech',
  'Tech',
  {
    en: 'Neon on obsidian: a dark, precise storefront for electronics, gadgets and digital goods.',
    id: 'Neon di atas obsidian: etalase gelap yang presisi untuk elektronik, gawai, dan produk digital.',
  },
  110,
  ['tech-futuristic', 'sora-clean', 'neon-midnight'],
  () => ({
    settings: lookSettings('tech-futuristic', {
      // A deeper indigo band so white copy clears the contrast guard; the
      // obsidian palette's own subtle and inverse bands stay as they are.
      schemes: { brand: { background: '#4f46e5', text: '#ffffff', button: '#c7d2fe' } },
    }),
    header: {
      layout: 'inline',
      sticky: true,
      showSearch: true,
      announcementScheme: 'brand',
      announcements: [
        { text: 'Bebas ongkir untuk pembelian di atas Rp 500.000', link: { kind: 'none' } },
      ],
    },
    footer: {
      colorScheme: 'subtle',
      about: 'Toko elektronik dan gawai resmi — bergaransi distributor, dikirim cepat.',
      showContact: true,
      showPages: true,
      showSocials: true,
    },
    home: [
      heroComposed({
        heading: 'Gawai yang bekerja untukmu.',
        body: 'Elektronik, aksesori, dan perlengkapan digital pilihan — resmi dan bergaransi.',
        primary: 'Belanja sekarang',
        secondary: 'Lihat spesifikasi',
        tone: 'subtle',
      }),
      section('scrolling-text', {
        items: [
          { text: 'GARANSI RESMI' },
          { text: 'KIRIM HARI INI' },
          { text: 'HARGA JELAS' },
          { text: 'SUDAH DIUJI' },
        ],
        size: 'lg',
        separator: 'dot',
        speed: 'fast',
        uppercase: true,
      }),
      section('category-rail', { heading: 'Kategori', layout: 'tiles', limit: 6 }),
      section('product-list', {
        source: 'collection',
        heading: 'Paling dicari',
        limit: 10,
        columns: '5',
      }),
      imageTextComposed({
        heading: 'Spesifikasi jujur, tanpa jargon.',
        body: 'Setiap produk kami uji dan tulis apa adanya — daya tahan, isi kotak, dan siapa yang melayaninya.',
        button: 'Cara memilih',
        imageSide: 'right',
      }),
      featuresComposed(
        [
          {
            icon: 'shield-check',
            title: 'Garansi resmi',
            text: 'Semua unit bergaransi distributor resmi.',
          },
          {
            icon: 'truck',
            title: 'Kirim hari ini',
            text: 'Pesan sebelum sore, dikirim hari yang sama.',
          },
          {
            icon: 'refresh-cw',
            title: 'Tukar 14 hari',
            text: 'Unit bermasalah ditukar dengan yang baru.',
          },
          {
            icon: 'award',
            title: 'Terkurasi',
            text: 'Hanya merek dan model yang kami pakai sendiri.',
          },
        ],
        'Kenapa belanja di sini',
      ),
      cardsComposed(
        [
          { title: 'Gadget harian', text: 'Ponsel, audio, dan wearable yang benar-benar dipakai.' },
          { title: 'Peralatan kerja', text: 'Laptop dan aksesori untuk kerja dari mana saja.' },
          { title: 'Rumah pintar', text: 'Perangkat yang membuat rumah lebih ringkas.' },
        ],
        'Belanja per kebutuhan',
      ),
      section('product-list', {
        source: 'tabs',
        heading: 'Jelajahi koleksi',
        limit: 8,
        columns: '4',
        tabs: [],
      }),
      // Marquee testimonials rather than `reviewsComposed`: its cards read the
      // theme's own surfaces, where the block helper's fixed light panels would
      // not sit right on an obsidian page.
      section('quotes', {
        variant: 'quotes',
        heading: 'Kata pengguna',
        layout: 'marquee',
        direction: 'left',
        speed: 'normal',
        items: REVIEWS,
      }),
      section('faq', {
        heading: 'Pertanyaan umum',
        items: FAQ_ITEMS,
        align: 'left',
        width: 'narrow',
      }),
      section('product-list', { source: 'latest', heading: 'Baru masuk', limit: 12, columns: '5' }),
    ],
  }),
)

/* -------------------------------------------------------------------------- */
/* Playful                                                                    */
/* -------------------------------------------------------------------------- */

const playful = makeSeed(
  'playful',
  'Playful',
  {
    en: 'Candy colour, rounded shapes and bouncy motion — for toys, snacks, bakeries and gifts.',
    id: 'Warna permen, bentuk membulat, dan animasi lincah — untuk mainan, camilan, toko kue, dan hadiah.',
  },
  120,
  ['playful-candy', 'soft-candy', 'bold-pop'],
  () => ({
    settings: lookSettings('playful-candy'),
    header: {
      layout: 'classic',
      sticky: true,
      showSearch: true,
      announcementScheme: 'brand',
      announcements: [{ text: 'Stiker lucu gratis di setiap pesanan', link: { kind: 'none' } }],
    },
    footer: {
      colorScheme: 'subtle',
      about: 'Mainan, camilan, dan hadiah pilihan untuk hari kecil yang lebih ceria.',
      showContact: true,
      showPages: true,
      showSocials: true,
    },
    home: [
      heroComposed({
        heading: 'Senang itu penting.',
        body: 'Mainan, camilan, dan hadiah yang bikin hari kecil lebih ceria.',
        primary: 'Mulai pilih',
        secondary: 'Lihat hadiah',
        align: 'center',
        tone: 'brand',
      }),
      section('scrolling-text', {
        items: [
          { text: 'BANYAK BONUS' },
          { text: 'AMAN UNTUK ANAK' },
          { text: 'KIRIM CEPAT' },
          { text: 'DIKEMAS RAPI' },
        ],
        size: 'lg',
        separator: 'star',
        speed: 'normal',
        uppercase: true,
      }),
      section('category-rail', { heading: 'Kategori seru', layout: 'tiles', limit: 6 }),
      section('product-list', {
        source: 'collection',
        heading: 'Paling disukai',
        limit: 10,
        columns: '4',
      }),
      cardsComposed(
        [
          { title: 'Mainan edukatif', text: 'Belajar sambil bermain, aman untuk si kecil.' },
          { title: 'Camilan aman', text: 'Bahan jelas dan kemasan rapat.' },
          { title: 'Hadiah spesial', text: 'Dikemas siap diberi, cocok untuk kejutan.' },
        ],
        'Pilih sesuai suasana',
      ),
      featuresComposed(
        [
          { icon: 'heart', title: 'Aman untuk anak', text: 'Bahan non-toksik dan bersertifikat.' },
          { icon: 'refresh-cw', title: 'Tukar 7 hari', text: 'Salah pilih? Tukar dengan mudah.' },
          { icon: 'truck', title: 'Kirim cepat', text: 'Dikemas rapi, dikirim di hari yang sama.' },
          { icon: 'gift', title: 'Bonus kecil', text: 'Ada kejutan di setiap paket.' },
        ],
        'Janji kami',
      ),
      section('quotes', {
        variant: 'quotes',
        heading: 'Kata orang tua',
        layout: 'marquee',
        direction: 'left',
        speed: 'normal',
        items: REVIEWS,
      }),
      section('product-list', {
        source: 'tabs',
        heading: 'Koleksi tema',
        limit: 8,
        columns: '4',
        tabs: [],
      }),
      section('faq', {
        heading: 'Pertanyaan umum',
        items: FAQ_ITEMS,
        align: 'center',
        width: 'narrow',
      }),
      section('product-list', {
        source: 'latest',
        heading: 'Baru datang',
        limit: 12,
        columns: '4',
      }),
    ],
  }),
)

/* -------------------------------------------------------------------------- */

/** Every platform theme seed, in library order. */
export const THEME_SEEDS: readonly ThemeSeed[] = [
  brutalist,
  minimalist,
  bold,
  modern,
  editorial,
  elegant,
  marketplace,
  preloved,
  retro,
  organic,
  tech,
  playful,
]

/** The seed with `slug`, or `null`. */
export function findThemeSeed(slug: string): ThemeSeed | null {
  return THEME_SEEDS.find((seed) => seed.slug === slug) ?? null
}
