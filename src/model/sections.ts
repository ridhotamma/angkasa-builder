/**
 * The section library: every building block a template or page can use.
 *
 * This file is the schema half — names and fields, no React — so the admin
 * and developer servers can validate a saved layout without importing a
 * component. The renderers live in `../render/sections`, keyed by the same
 * `type`; a type with a schema and no renderer is a compile error there.
 *
 * Adding a section: declare it here, render it there. Every template and page
 * in every shop can use it from that moment, which is the point — see "Scope
 * rules" in docs/POSITIONING.md.
 */

import type { BlockSchema, Field, ItemField, ListField, RichTextField } from './fields'
import type { Localized } from './localized'

/** Where a template can use a section. Omitted means everywhere but the product page. */
export type SectionScope = 'home' | 'page' | 'product'

/** How the "Add section" picker groups sections. */
export const SECTION_CATEGORIES = [
  'banners',
  'products',
  'media',
  'text',
  'promotion',
  'trust',
  'store',
  'product-page',
] as const

export type SectionCategory = (typeof SECTION_CATEGORIES)[number]

export const SECTION_CATEGORY_LABELS: Record<SectionCategory, Localized> = {
  banners: { en: 'Banners and heroes', id: 'Banner dan sampul' },
  products: { en: 'Products and collections', id: 'Produk dan koleksi' },
  media: { en: 'Images and video', id: 'Gambar dan video' },
  text: { en: 'Text and storytelling', id: 'Teks dan cerita' },
  promotion: { en: 'Promotions', id: 'Promosi' },
  trust: { en: 'Reviews and trust', id: 'Ulasan dan kepercayaan' },
  store: { en: 'Shop information', id: 'Informasi toko' },
  'product-page': { en: 'Product page', id: 'Halaman produk' },
}

/**
 * A ready-made variant of a section, offered in the picker beside the plain
 * one: the same type with some settings and style already chosen, so a
 * seller picks a look instead of assembling it.
 */
export interface SectionPreset {
  key: string
  name: Localized
  description: Localized
  settings?: Record<string, unknown>
  style?: Record<string, unknown>
}

export interface SectionSchema {
  type: string
  name: Localized
  description: Localized
  category: SectionCategory
  /** An icon key the editor maps to a glyph — see `editor/section-icons`. */
  icon: string
  /** Sections that read the shop's catalogue, so the editor can say so. */
  usesCatalogue?: boolean
  /** Where it can be used; see `SectionScope`. */
  scopes?: readonly SectionScope[]
  /** At most this many in one layout. */
  max?: number
  /** Cannot be removed from a layout that allows it, e.g. the product's buy box. */
  required?: boolean
  /** Style a freshly added section starts with, e.g. edge to edge for a video. */
  defaultStyle?: Record<string, unknown>
  presets?: readonly SectionPreset[]
  fields: readonly Field[]
}

const EVERYWHERE_BUT_PRODUCT: readonly SectionScope[] = ['home', 'page']
const EVERYWHERE: readonly SectionScope[] = ['home', 'page', 'product']
const PRODUCT_ONLY: readonly SectionScope[] = ['product']

export function sectionScopes(schema: SectionSchema): readonly SectionScope[] {
  return schema.scopes ?? EVERYWHERE_BUT_PRODUCT
}

export function isSectionAllowed(schema: SectionSchema, scope: SectionScope): boolean {
  return sectionScopes(schema).includes(scope)
}

/* -------------------------------------------------------------------------- */
/* Field builders                                                             */
/* -------------------------------------------------------------------------- */

const heading = (fallback = ''): Field => ({
  kind: 'text',
  key: 'heading',
  label: { en: 'Heading', id: 'Judul' },
  max: 120,
  default: fallback,
})

const body = (): RichTextField => ({
  kind: 'richtext',
  key: 'body',
  label: { en: 'Text', id: 'Teks' },
  max: 5000,
  default: '',
})

const buttonLabel: ItemField = {
  kind: 'text',
  key: 'buttonLabel',
  label: { en: 'Button label', id: 'Teks tombol' },
  help: { en: 'Leave empty for no button.', id: 'Kosongkan jika tanpa tombol.' },
  max: 40,
  default: '',
}

const buttonLink: ItemField = {
  kind: 'link',
  key: 'buttonLink',
  label: { en: 'Button link', id: 'Tautan tombol' },
}

const align: Field = {
  kind: 'select',
  key: 'align',
  label: { en: 'Alignment', id: 'Perataan' },
  options: [
    { value: 'left', label: { en: 'Left', id: 'Kiri' } },
    { value: 'center', label: { en: 'Center', id: 'Tengah' } },
  ],
  default: 'left',
}

/** How wide a column of text runs. Each section maps the two to its own widths. */
const width: Field = {
  kind: 'select',
  key: 'width',
  label: { en: 'Width', id: 'Lebar' },
  options: [
    { value: 'narrow', label: { en: 'Narrow', id: 'Sempit' } },
    { value: 'wide', label: { en: 'Wide', id: 'Lebar' } },
  ],
  default: 'narrow',
}

const limit = (fallback: number, max = 24): Field => ({
  kind: 'number',
  key: 'limit',
  label: { en: 'Products to show', id: 'Jumlah produk' },
  min: 2,
  max,
  default: fallback,
})

const columns = (fallback: number, from = 2): ItemField => ({
  kind: 'select',
  key: 'columns',
  label: { en: 'Columns on desktop', id: 'Kolom di desktop' },
  options: [1, 2, 3, 4, 5, 6]
    .filter((n) => n >= from)
    .map((n) => ({
      value: String(n),
      label: { en: String(n), id: String(n) },
    })),
  default: String(fallback),
})

const subheading = (fallback = ''): ItemField => ({
  kind: 'textarea',
  key: 'subheading',
  label: { en: 'Subheading', id: 'Subjudul' },
  max: 300,
  default: fallback,
  rows: 2,
})

const secondaryButtonLabel: ItemField = {
  kind: 'text',
  key: 'secondaryButtonLabel',
  label: { en: 'Second button label', id: 'Teks tombol kedua' },
  help: { en: 'Optional, shown as an outline button.', id: 'Opsional, tampil sebagai tombol garis.' },
  max: 40,
  default: '',
}

const secondaryButtonLink: ItemField = {
  kind: 'link',
  key: 'secondaryButtonLink',
  label: { en: 'Second button link', id: 'Tautan tombol kedua' },
}

const overlay: ItemField = {
  kind: 'select',
  key: 'overlay',
  label: { en: 'Shade over the image', id: 'Bayangan di atas gambar' },
  help: {
    en: 'Keeps white text readable on a bright photo.',
    id: 'Menjaga teks putih tetap terbaca di foto yang terang.',
  },
  options: [
    { value: 'gradient', label: { en: 'Fade from the bottom', id: 'Memudar dari bawah' } },
    { value: 'dark', label: { en: 'Dark', id: 'Gelap' } },
    { value: 'light', label: { en: 'Light', id: 'Tipis' } },
    { value: 'none', label: { en: 'None', id: 'Tanpa bayangan' } },
  ],
  default: 'gradient',
}

const bannerHeight = (fallback: 'sm' | 'md' | 'lg' | 'screen' = 'md'): ItemField => ({
  kind: 'select',
  key: 'height',
  label: { en: 'Height', id: 'Tinggi' },
  options: [
    { value: 'sm', label: { en: 'Short', id: 'Pendek' } },
    { value: 'md', label: { en: 'Medium', id: 'Sedang' } },
    { value: 'lg', label: { en: 'Tall', id: 'Tinggi' } },
    { value: 'screen', label: { en: 'Full screen', id: 'Satu layar penuh' } },
  ],
  default: fallback,
})

const contentPosition: ItemField = {
  kind: 'select',
  key: 'contentPosition',
  label: { en: 'Text position', id: 'Posisi teks' },
  options: [
    { value: 'bottom', label: { en: 'Bottom', id: 'Bawah' } },
    { value: 'middle', label: { en: 'Middle', id: 'Tengah' } },
  ],
  default: 'bottom',
}

const speed: ItemField = {
  kind: 'select',
  key: 'speed',
  label: { en: 'Speed', id: 'Kecepatan' },
  options: [
    { value: 'slow', label: { en: 'Slow', id: 'Pelan' } },
    { value: 'normal', label: { en: 'Normal', id: 'Normal' } },
    { value: 'fast', label: { en: 'Fast', id: 'Cepat' } },
  ],
  default: 'normal',
}

const direction: ItemField = {
  kind: 'select',
  key: 'direction',
  label: { en: 'Direction', id: 'Arah berjalan' },
  options: [
    { value: 'left', label: { en: 'Right to left', id: 'Kanan ke kiri' } },
    { value: 'right', label: { en: 'Left to right', id: 'Kiri ke kanan' } },
  ],
  default: 'left',
}

const imageAlt: ItemField = {
  kind: 'text',
  key: 'alt',
  label: { en: 'Image description', id: 'Keterangan gambar' },
  help: {
    en: 'Read out to shoppers who cannot see the image.',
    id: 'Dibacakan untuk pembeli yang tidak bisa melihat gambar.',
  },
  max: 120,
  default: '',
}

/**
 * The icons a seller can pick for a feature or a badge. A fixed set of keys
 * rather than an icon name, so a stored layout cannot ask the renderer for a
 * component that does not exist. Mapped to glyphs in `render/icons`.
 */
export const FEATURE_ICONS = [
  'truck',
  'cash',
  'shield',
  'refresh',
  'leaf',
  'star',
  'heart',
  'gift',
  'clock',
  'chat',
  'package',
  'badge',
  'sparkles',
  'pin',
  'card',
  'phone',
  'award',
  'droplet',
  'ruler',
  'hand',
] as const

export type FeatureIcon = (typeof FEATURE_ICONS)[number]

const FEATURE_ICON_LABELS: Record<FeatureIcon, Localized> = {
  truck: { en: 'Delivery truck', id: 'Truk pengiriman' },
  cash: { en: 'Cash (COD)', id: 'Uang tunai (COD)' },
  shield: { en: 'Shield (guarantee)', id: 'Perisai (garansi)' },
  refresh: { en: 'Returns', id: 'Pengembalian' },
  leaf: { en: 'Leaf (natural)', id: 'Daun (alami)' },
  star: { en: 'Star', id: 'Bintang' },
  heart: { en: 'Heart', id: 'Hati' },
  gift: { en: 'Gift', id: 'Hadiah' },
  clock: { en: 'Clock', id: 'Jam' },
  chat: { en: 'Chat', id: 'Obrolan' },
  package: { en: 'Package', id: 'Paket' },
  badge: { en: 'Verified badge', id: 'Lencana terverifikasi' },
  sparkles: { en: 'Sparkles', id: 'Kilau' },
  pin: { en: 'Map pin', id: 'Penanda peta' },
  card: { en: 'Card payment', id: 'Pembayaran kartu' },
  phone: { en: 'Phone', id: 'Telepon' },
  award: { en: 'Award', id: 'Penghargaan' },
  droplet: { en: 'Droplet', id: 'Tetesan' },
  ruler: { en: 'Ruler (size)', id: 'Penggaris (ukuran)' },
  hand: { en: 'Handmade', id: 'Buatan tangan' },
}

const iconField = (fallback: FeatureIcon): ItemField => ({
  kind: 'select',
  key: 'icon',
  label: { en: 'Icon', id: 'Ikon' },
  options: FEATURE_ICONS.map((value) => ({ value, label: FEATURE_ICON_LABELS[value] })),
  default: fallback,
})

/* -------------------------------------------------------------------------- */
/* Product page blocks                                                        */
/* -------------------------------------------------------------------------- */

const PRODUCT_INFO_BLOCKS: readonly BlockSchema[] = [
  {
    type: 'title',
    name: { en: 'Product name', id: 'Nama produk' },
    max: 1,
    fields: [
      {
        kind: 'select',
        key: 'size',
        label: { en: 'Size', id: 'Ukuran' },
        options: [
          { value: 'md', label: { en: 'Medium', id: 'Sedang' } },
          { value: 'lg', label: { en: 'Large', id: 'Besar' } },
        ],
        default: 'md',
      },
    ],
  },
  { type: 'rating', name: { en: 'Rating', id: 'Rating' }, max: 1, fields: [] },
  {
    type: 'price',
    name: { en: 'Price', id: 'Harga' },
    max: 1,
    fields: [
      {
        kind: 'boolean',
        key: 'showSaving',
        label: { en: 'Show the discount', id: 'Tampilkan diskon' },
        help: {
          en: 'A "Save 20%" badge when the product has a compare-at price.',
          id: 'Lencana "Hemat 20%" jika produk punya harga coret.',
        },
        default: true,
      },
    ],
  },
  {
    type: 'purchase',
    name: { en: 'Variants and buy buttons', id: 'Varian dan tombol beli' },
    max: 1,
    fields: [],
  },
  {
    type: 'stock',
    name: { en: 'Low stock notice', id: 'Pemberitahuan stok menipis' },
    max: 1,
    fields: [
      {
        kind: 'number',
        key: 'threshold',
        label: { en: 'Show when stock is at or below', id: 'Tampil jika stok sama atau di bawah' },
        min: 1,
        max: 100,
        default: 5,
      },
    ],
  },
  {
    type: 'description',
    name: { en: 'Description', id: 'Deskripsi' },
    max: 1,
    fields: [
      {
        kind: 'boolean',
        key: 'collapsible',
        label: { en: 'Fold into a tab', id: 'Lipat menjadi tab' },
        default: false,
      },
    ],
  },
  {
    type: 'size-guide',
    name: { en: 'Size guide link', id: 'Tautan panduan ukuran' },
    max: 1,
    fields: [
      {
        kind: 'text',
        key: 'label',
        label: { en: 'Link text', id: 'Teks tautan' },
        help: {
          en: "Shown only on products whose category or product settings have a size guide.",
          id: 'Hanya tampil pada produk yang kategori atau pengaturannya punya panduan ukuran.',
        },
        max: 40,
        default: 'Size guide',
      },
    ],
  },
  {
    type: 'collapsible',
    name: { en: 'Collapsible tab', id: 'Tab lipat' },
    fields: [
      {
        kind: 'text',
        key: 'heading',
        label: { en: 'Heading', id: 'Judul' },
        max: 80,
        default: 'Shipping & returns',
      },
      { ...body(), default: 'Orders ship within 1–2 working days.' },
      {
        kind: 'boolean',
        key: 'open',
        label: { en: 'Open by default', id: 'Terbuka di awal' },
        default: false,
      },
    ],
  },
  {
    type: 'badges',
    name: { en: 'Trust badges', id: 'Lencana kepercayaan' },
    max: 2,
    fields: [
      {
        kind: 'list',
        key: 'items',
        label: { en: 'Badges', id: 'Lencana' },
        itemLabel: { en: 'Badge', id: 'Lencana' },
        titleKey: 'text',
        max: 6,
        fields: [
          iconField('truck'),
          {
            kind: 'text',
            key: 'text',
            label: { en: 'Text', id: 'Teks' },
            max: 60,
            default: '',
          },
        ],
      } satisfies ListField,
    ],
  },
  {
    type: 'text',
    name: { en: 'Text', id: 'Teks' },
    fields: [body()],
  },
]

/* -------------------------------------------------------------------------- */
/* The library                                                                */
/* -------------------------------------------------------------------------- */


/* -------------------------------------------------------------------------- */
/* The library                                                                */
/* -------------------------------------------------------------------------- */

export const SECTION_SCHEMAS = [
  {
    type: 'announcement-bar',
    scopes: EVERYWHERE,
    category: 'promotion',
    icon: 'megaphone',
    name: { en: 'Announcement bar', id: 'Bar pengumuman' },
    description: {
      en: 'A thin strip for a promotion or notice.',
      id: 'Strip tipis untuk promo atau pemberitahuan.',
    },
    fields: [
      {
        kind: 'text',
        key: 'text',
        label: { en: 'Text', id: 'Teks' },
        max: 160,
        default: 'Free delivery on orders over Rp 200.000',
      },
      { kind: 'link', key: 'link', label: { en: 'Link', id: 'Tautan' } },
    ],
  },
  {
    type: 'hero',
    category: 'banners',
    icon: 'image',
    name: { en: 'Hero banner', id: 'Banner utama' },
    description: {
      en: 'A large image with a headline and a button.',
      id: 'Gambar besar dengan judul dan tombol.',
    },
    fields: [
      { kind: 'image', key: 'image', label: { en: 'Image', id: 'Gambar' } },
      {
        kind: 'boolean',
        key: 'useShopBanner',
        label: { en: "Use the shop's banner", id: 'Pakai banner toko' },
        help: {
          en: 'Shows the banner from shop settings when no image is picked.',
          id: 'Menampilkan banner dari pengaturan toko jika gambar tidak dipilih.',
        },
        default: true,
      },
      heading(),
      subheading(),
      buttonLabel,
      buttonLink,
      secondaryButtonLabel,
      secondaryButtonLink,
      align,
      contentPosition,
      bannerHeight('md'),
      overlay,
    ],
    presets: [
      {
        key: 'centered-full',
        name: { en: 'Hero — full width, centred', id: 'Banner — selebar layar, di tengah' },
        description: {
          en: 'Edge to edge, tall, with the headline in the middle.',
          id: 'Penuh dari tepi ke tepi, tinggi, dengan judul di tengah.',
        },
        settings: {
          heading: 'New season, new favourites',
          subheading: 'Discover pieces made to last.',
          buttonLabel: 'Shop now',
          buttonLink: { kind: 'home' },
          align: 'center',
          contentPosition: 'middle',
          height: 'lg',
          overlay: 'dark',
        },
        style: { width: 'edge', paddingTop: 'none', paddingBottom: 'none' },
      },
      {
        key: 'split-buttons',
        name: { en: 'Hero — two buttons', id: 'Banner — dua tombol' },
        description: {
          en: 'A headline with a main and a second button.',
          id: 'Judul dengan tombol utama dan tombol kedua.',
        },
        settings: {
          heading: 'Made for everyday',
          buttonLabel: 'Shop women',
          secondaryButtonLabel: 'Shop men',
          height: 'lg',
        },
      },
    ],
  },
  {
    type: 'video-hero',
    category: 'banners',
    icon: 'video',
    name: { en: 'Video banner', id: 'Banner video' },
    description: {
      en: 'A silent looping video behind a headline and buttons.',
      id: 'Video berulang tanpa suara di belakang judul dan tombol.',
    },
    defaultStyle: { width: 'edge', paddingTop: 'none', paddingBottom: 'none' },
    fields: [
      {
        kind: 'video',
        key: 'video',
        label: { en: 'Video', id: 'Video' },
        uploadOnly: true,
        help: {
          en: 'An MP4 or WebM up to 30 MB. Short (10–30 s) and without sound works best — it plays muted.',
          id: 'MP4 atau WebM hingga 30 MB. Pendek (10–30 detik) dan tanpa suara paling cocok — diputar tanpa suara.',
        },
      },
      {
        kind: 'image',
        key: 'poster',
        label: { en: 'Cover image', id: 'Gambar sampul' },
        help: {
          en: 'Shown while the video loads, and instead of it when a shopper prefers less motion.',
          id: 'Tampil saat video dimuat, dan menggantikannya jika pembeli memilih mengurangi gerakan.',
        },
      },
      heading('Feel the difference'),
      subheading(),
      buttonLabel,
      buttonLink,
      secondaryButtonLabel,
      secondaryButtonLink,
      { ...align, default: 'center' },
      { ...contentPosition, default: 'middle' },
      bannerHeight('lg'),
      { ...overlay, default: 'dark' },
    ],
  },
  {
    type: 'parallax-banner',
    category: 'banners',
    icon: 'layers',
    name: { en: 'Parallax banner', id: 'Banner paralaks' },
    description: {
      en: 'An image that moves slower than the page as it scrolls, with text on top.',
      id: 'Gambar yang bergerak lebih lambat dari halaman saat digulir, dengan teks di atasnya.',
    },
    defaultStyle: { width: 'edge' },
    fields: [
      { kind: 'image', key: 'image', label: { en: 'Image', id: 'Gambar' } },
      heading('Crafted in small batches'),
      subheading(),
      buttonLabel,
      buttonLink,
      { ...align, default: 'center' },
      bannerHeight('lg'),
      { ...overlay, default: 'dark' },
      {
        kind: 'select',
        key: 'intensity',
        label: { en: 'Movement', id: 'Gerakan' },
        options: [
          { value: 'soft', label: { en: 'Soft', id: 'Halus' } },
          { value: 'strong', label: { en: 'Strong', id: 'Kuat' } },
        ],
        default: 'soft',
      },
    ],
  },
  {
    type: 'banner-slider',
    category: 'banners',
    icon: 'slides',
    name: { en: 'Banner slider', id: 'Slider banner' },
    description: {
      en: 'Image banners that slide, each with its own link.',
      id: 'Banner gambar yang bisa digeser, masing-masing bertautan.',
    },
    fields: [
      {
        kind: 'list',
        key: 'slides',
        label: { en: 'Slides', id: 'Slide' },
        itemLabel: { en: 'Slide', id: 'Slide' },
        titleKey: 'alt',
        max: 12,
        fields: [
          { kind: 'image', key: 'image', label: { en: 'Image', id: 'Gambar' } },
          {
            kind: 'text',
            key: 'alt',
            label: { en: 'Image description', id: 'Keterangan gambar' },
            help: {
              en: 'Read out to shoppers who cannot see the image.',
              id: 'Dibacakan untuk pembeli yang tidak bisa melihat gambar.',
            },
            max: 120,
            default: '',
          },
          { kind: 'link', key: 'link', label: { en: 'Link', id: 'Tautan' } },
        ],
      },
      {
        kind: 'select',
        key: 'perPage',
        label: { en: 'Slides visible on desktop', id: 'Slide terlihat di desktop' },
        help: {
          en: 'Phones always show one slide at a time.',
          id: 'Di ponsel selalu tampil satu slide.',
        },
        options: [
          { value: '1', label: { en: '1', id: '1' } },
          { value: '2', label: { en: '2', id: '2' } },
          { value: '3', label: { en: '3', id: '3' } },
        ],
        default: '2',
      },
      {
        kind: 'select',
        key: 'ratio',
        label: { en: 'Slide shape', id: 'Bentuk slide' },
        options: [
          { value: '16/9', label: { en: 'Standard (16:9)', id: 'Standar (16:9)' } },
          { value: '2/1', label: { en: 'Wide (2:1)', id: 'Lebar (2:1)' } },
          { value: '1/1', label: { en: 'Square (1:1)', id: 'Persegi (1:1)' } },
        ],
        default: '16/9',
      },
      {
        kind: 'boolean',
        key: 'loop',
        label: { en: 'Loop', id: 'Putar berulang' },
        help: {
          en: 'After the last slide, go back to the first.',
          id: 'Setelah slide terakhir, kembali ke slide pertama.',
        },
        default: true,
      },
      {
        kind: 'boolean',
        key: 'autoplay',
        label: { en: 'Slide automatically', id: 'Geser otomatis' },
        help: {
          en: 'Moves to the next slide every few seconds.',
          id: 'Pindah ke slide berikutnya setiap beberapa detik.',
        },
        default: false,
      },
    ],
  },
  {
    type: 'shop-intro',
    category: 'store',
    icon: 'store',
    name: { en: 'Shop introduction', id: 'Perkenalan toko' },
    description: {
      en: "The shop's name, logo and description from shop settings.",
      id: 'Nama, logo, dan deskripsi toko dari pengaturan toko.',
    },
    fields: [
      {
        kind: 'boolean',
        key: 'showLogo',
        label: { en: 'Show logo', id: 'Tampilkan logo' },
        default: false,
      },
      {
        kind: 'boolean',
        key: 'showDescription',
        label: { en: 'Show description', id: 'Tampilkan deskripsi' },
        default: true,
      },
      align,
      {
        kind: 'select',
        key: 'background',
        label: { en: 'Background', id: 'Latar' },
        help: {
          en: 'A full-width band behind the top of the section, with the logo overlapping it.',
          id: 'Pita selebar layar di bagian atas, dengan logo menumpang di atasnya.',
        },
        options: [
          { value: 'none', label: { en: 'None', id: 'Tanpa latar' } },
          { value: 'pattern', label: { en: 'Pattern', id: 'Pola' } },
          { value: 'image', label: { en: 'Image', id: 'Gambar' } },
        ],
        default: 'none',
      },
      {
        kind: 'select',
        key: 'pattern',
        label: { en: 'Pattern', id: 'Pola' },
        // Keys match `PATTERN_KEYS` in `../render/patterns`.
        options: [
          { value: 'geometric', label: { en: 'Geometric', id: 'Geometris' } },
          { value: 'lines', label: { en: 'Lines', id: 'Garis' } },
          { value: 'scales', label: { en: 'Scales', id: 'Sisik' } },
          { value: 'waves', label: { en: 'Waves', id: 'Gelombang' } },
          { value: 'dots', label: { en: 'Dots', id: 'Titik' } },
          { value: 'grid', label: { en: 'Grid', id: 'Kisi' } },
        ],
        default: 'dots',
        showWhen: { key: 'background', is: ['pattern'] },
      },
      {
        kind: 'color',
        key: 'patternColor',
        label: { en: 'Pattern colour', id: 'Warna pola' },
        default: '#444cf7',
        showWhen: { key: 'background', is: ['pattern'] },
      },
      {
        kind: 'color',
        key: 'patternBackground',
        label: { en: 'Pattern background', id: 'Warna dasar pola' },
        default: '#e5e5f7',
        showWhen: { key: 'background', is: ['pattern'] },
      },
      {
        kind: 'image',
        key: 'backgroundImage',
        label: { en: 'Background image', id: 'Gambar latar' },
        help: {
          en: 'A wide image works best; it is cropped to fill the band.',
          id: 'Gambar lebar paling cocok; gambar dipotong agar memenuhi pita.',
        },
        showWhen: { key: 'background', is: ['image'] },
      },
    ],
  },
  {
    type: 'category-rail',
    category: 'products',
    icon: 'grid',
    name: { en: 'Category rail', id: 'Deretan kategori' },
    description: { en: "The shop's categories as tiles.", id: 'Kategori toko dalam bentuk ubin.' },
    usesCatalogue: true,
    fields: [
      heading('Shop by category'),
      {
        kind: 'select',
        key: 'layout',
        label: { en: 'Layout', id: 'Tampilan' },
        options: [
          { value: 'tiles', label: { en: 'Tiles', id: 'Ubin' } },
          { value: 'bento', label: { en: 'Bento grid', id: 'Kisi bento' } },
        ],
        default: 'tiles',
        help: {
          en: 'Bento shows each image as a background with the name on top, in tiles of mixed sizes.',
          id: 'Bento menampilkan gambar sebagai latar dengan nama di atasnya, dalam ubin beragam ukuran.',
        },
      },
      {
        kind: 'number',
        key: 'limit',
        label: { en: 'Categories to show', id: 'Jumlah kategori' },
        min: 2,
        max: 24,
        default: 12,
      },
    ],
  },
  {
    type: 'featured-collection',
    scopes: EVERYWHERE,
    category: 'products',
    icon: 'star',
    name: { en: 'Featured collection', id: 'Koleksi unggulan' },
    description: {
      en: 'Products from one collection you pick.',
      id: 'Produk dari satu koleksi pilihan.',
    },
    usesCatalogue: true,
    fields: [
      {
        kind: 'collection',
        key: 'collectionId',
        label: { en: 'Collection', id: 'Koleksi' },
        emptyLabel: { en: 'First collection', id: 'Koleksi pertama' },
      },
      {
        ...(heading() as Extract<Field, { kind: 'text' }>),
        help: {
          en: "Leave empty to use the collection's name.",
          id: 'Kosongkan untuk memakai nama koleksi.',
        },
      },
      limit(8),
      columns(4),
    ],
  },
  {
    type: 'collection-shelves',
    category: 'products',
    icon: 'shelves',
    name: { en: 'All collections', id: 'Semua koleksi' },
    description: {
      en: 'One shelf per active collection, in their sort order.',
      id: 'Satu rak untuk setiap koleksi aktif, sesuai urutan.',
    },
    usesCatalogue: true,
    fields: [limit(8), columns(4)],
  },
  {
    type: 'latest-products',
    scopes: EVERYWHERE,
    category: 'products',
    icon: 'sparkles',
    name: { en: 'Latest products', id: 'Produk terbaru' },
    description: {
      en: 'The most recently published products.',
      id: 'Produk yang terakhir terbit.',
    },
    usesCatalogue: true,
    fields: [heading('New arrivals'), limit(12), columns(4)],
  },
  {
    type: 'rich-text',
    scopes: EVERYWHERE,
    category: 'text',
    icon: 'text',
    name: { en: 'Text', id: 'Teks' },
    description: { en: 'A heading and paragraphs.', id: 'Judul dan paragraf.' },
    fields: [heading('Our story'), body(), align, width],
  },
  {
    type: 'image-with-text',
    scopes: EVERYWHERE,
    category: 'media',
    icon: 'image-text',
    name: { en: 'Image with text', id: 'Gambar dengan teks' },
    description: {
      en: 'An image beside a heading and text.',
      id: 'Gambar di samping judul dan teks.',
    },
    fields: [
      { kind: 'image', key: 'image', label: { en: 'Image', id: 'Gambar' } },
      heading('Made with care'),
      body(),
      buttonLabel,
      buttonLink,
      {
        kind: 'select',
        key: 'imagePosition',
        label: { en: 'Image position', id: 'Posisi gambar' },
        options: [
          { value: 'left', label: { en: 'Left', id: 'Kiri' } },
          { value: 'right', label: { en: 'Right', id: 'Kanan' } },
        ],
        default: 'left',
      },
    ],
  },
  {
    type: 'image-gallery',
    scopes: EVERYWHERE,
    category: 'media',
    icon: 'gallery',
    name: { en: 'Image gallery', id: 'Galeri gambar' },
    description: {
      en: 'A grid of images, each with an optional link.',
      id: 'Kisi gambar, masing-masing bisa bertautan.',
    },
    fields: [
      heading(),
      columns(3),
      {
        kind: 'list',
        key: 'items',
        label: { en: 'Images', id: 'Gambar' },
        itemLabel: { en: 'Image', id: 'Gambar' },
        titleKey: 'caption',
        max: 24,
        fields: [
          { kind: 'image', key: 'image', label: { en: 'Image', id: 'Gambar' } },
          {
            kind: 'text',
            key: 'caption',
            label: { en: 'Caption', id: 'Keterangan' },
            max: 120,
            default: '',
          },
          { kind: 'link', key: 'link', label: { en: 'Link', id: 'Tautan' } },
        ],
      },
    ],
  },
  {
    type: 'faq',
    scopes: EVERYWHERE,
    category: 'text',
    icon: 'help',
    name: { en: 'FAQ', id: 'Tanya jawab' },
    description: {
      en: 'Questions and answers that expand.',
      id: 'Pertanyaan dan jawaban yang bisa dibuka.',
    },
    fields: [
      heading('Frequently asked questions'),
      {
        kind: 'list',
        key: 'items',
        label: { en: 'Questions', id: 'Pertanyaan' },
        itemLabel: { en: 'Question', id: 'Pertanyaan' },
        titleKey: 'question',
        max: 30,
        fields: [
          {
            kind: 'text',
            key: 'question',
            label: { en: 'Question', id: 'Pertanyaan' },
            max: 200,
            default: '',
          },
          {
            kind: 'textarea',
            key: 'answer',
            label: { en: 'Answer', id: 'Jawaban' },
            max: 2000,
            default: '',
            rows: 3,
          },
        ],
      },
      // Centred by default: that is where every FAQ sat before it had the setting.
      { ...align, default: 'center' },
      width,
    ],
  },
  {
    type: 'testimonials',
    scopes: EVERYWHERE,
    category: 'trust',
    icon: 'quote',
    name: { en: 'Testimonials', id: 'Testimoni' },
    description: { en: 'What customers say about the shop.', id: 'Kata pelanggan tentang toko.' },
    fields: [
      heading('What our customers say'),
      {
        kind: 'select',
        key: 'layout',
        label: { en: 'Layout', id: 'Tampilan' },
        options: [
          { value: 'grid', label: { en: 'Grid', id: 'Kisi' } },
          { value: 'marquee', label: { en: 'Running cards', id: 'Kartu berjalan' } },
          { value: 'carousel', label: { en: 'Slider', id: 'Slider (geser)' } },
        ],
        default: 'grid',
      },
      {
        kind: 'select',
        key: 'direction',
        label: { en: 'Direction', id: 'Arah berjalan' },
        options: [
          { value: 'left', label: { en: 'Right to left', id: 'Kanan ke kiri' } },
          { value: 'right', label: { en: 'Left to right', id: 'Kiri ke kanan' } },
        ],
        default: 'left',
        showWhen: { key: 'layout', is: ['marquee'] },
      },
      {
        kind: 'select',
        key: 'speed',
        label: { en: 'Speed', id: 'Kecepatan' },
        options: [
          { value: 'slow', label: { en: 'Slow', id: 'Pelan' } },
          { value: 'normal', label: { en: 'Normal', id: 'Normal' } },
          { value: 'fast', label: { en: 'Fast', id: 'Cepat' } },
        ],
        default: 'normal',
        showWhen: { key: 'layout', is: ['marquee'] },
      },
      {
        kind: 'boolean',
        key: 'autoplay',
        label: { en: 'Slide automatically', id: 'Geser otomatis' },
        help: {
          en: 'Moves to the next card every few seconds.',
          id: 'Pindah ke kartu berikutnya setiap beberapa detik.',
        },
        default: false,
        showWhen: { key: 'layout', is: ['carousel'] },
      },
      {
        kind: 'list',
        key: 'items',
        label: { en: 'Testimonials', id: 'Testimoni' },
        itemLabel: { en: 'Testimonial', id: 'Testimoni' },
        titleKey: 'author',
        max: 12,
        fields: [
          {
            kind: 'textarea',
            key: 'quote',
            label: { en: 'Quote', id: 'Kutipan' },
            max: 600,
            default: '',
            rows: 3,
          },
          {
            kind: 'text',
            key: 'author',
            label: { en: 'Name', id: 'Nama' },
            max: 80,
            default: '',
          },
          {
            kind: 'image',
            key: 'avatar',
            label: { en: 'Photo', id: 'Foto' },
            help: {
              en: 'Optional. Without one, the initials are shown.',
              id: 'Opsional. Tanpa foto, inisial nama yang ditampilkan.',
            },
          },
          {
            kind: 'text',
            key: 'role',
            label: { en: 'Detail', id: 'Keterangan' },
            placeholder: { en: 'e.g. Jakarta', id: 'mis. Jakarta' },
            max: 80,
            default: '',
          },
        ],
      },
    ],
  },

  /* ---------------------------------------------------------------------- */
  /* Products                                                               */
  /* ---------------------------------------------------------------------- */

  {
    type: 'featured-product',
    scopes: EVERYWHERE,
    category: 'products',
    icon: 'tag',
    name: { en: 'Featured product', id: 'Produk unggulan' },
    description: {
      en: 'One product, large, with its photos, price and a button — for a launch or a hero product.',
      id: 'Satu produk, besar, dengan foto, harga, dan tombol — untuk peluncuran atau produk andalan.',
    },
    usesCatalogue: true,
    fields: [
      {
        kind: 'product',
        key: 'productId',
        label: { en: 'Product', id: 'Produk' },
      },
      {
        kind: 'text',
        key: 'eyebrow',
        label: { en: 'Small text above the name', id: 'Teks kecil di atas nama' },
        placeholder: { en: 'e.g. New launch', id: 'mis. Baru rilis' },
        max: 40,
        default: '',
      },
      {
        kind: 'boolean',
        key: 'showDescription',
        label: { en: 'Show description', id: 'Tampilkan deskripsi' },
        default: true,
      },
      { ...buttonLabel, default: 'Shop now', help: undefined },
      {
        kind: 'select',
        key: 'imagePosition',
        label: { en: 'Image position', id: 'Posisi gambar' },
        options: [
          { value: 'left', label: { en: 'Left', id: 'Kiri' } },
          { value: 'right', label: { en: 'Right', id: 'Kanan' } },
        ],
        default: 'left',
      },
    ],
  },
  {
    type: 'collection-tabs',
    scopes: EVERYWHERE,
    category: 'products',
    icon: 'tabs',
    name: { en: 'Collection tabs', id: 'Tab koleksi' },
    description: {
      en: 'Several collections behind tabs — New, Best sellers, Sale — in one section.',
      id: 'Beberapa koleksi dalam tab — Terbaru, Terlaris, Diskon — dalam satu bagian.',
    },
    usesCatalogue: true,
    fields: [
      heading('Shop the edit'),
      {
        kind: 'list',
        key: 'tabs',
        label: { en: 'Tabs', id: 'Tab' },
        itemLabel: { en: 'Tab', id: 'Tab' },
        titleKey: 'label',
        max: 6,
        fields: [
          {
            kind: 'collection',
            key: 'collectionId',
            label: { en: 'Collection', id: 'Koleksi' },
          },
          {
            kind: 'text',
            key: 'label',
            label: { en: 'Tab name', id: 'Nama tab' },
            help: {
              en: "Leave empty to use the collection's name.",
              id: 'Kosongkan untuk memakai nama koleksi.',
            },
            max: 40,
            default: '',
          },
        ],
      },
      limit(8),
      columns(4),
    ],
  },

  /* ---------------------------------------------------------------------- */
  /* Media                                                                  */
  /* ---------------------------------------------------------------------- */

  {
    type: 'video',
    scopes: EVERYWHERE,
    category: 'media',
    icon: 'play',
    name: { en: 'Video', id: 'Video' },
    description: {
      en: 'A video from your uploads, YouTube or Vimeo, with an optional heading.',
      id: 'Video dari unggahan, YouTube, atau Vimeo, dengan judul opsional.',
    },
    fields: [
      heading(),
      subheading(),
      { kind: 'video', key: 'video', label: { en: 'Video', id: 'Video' } },
      {
        kind: 'image',
        key: 'poster',
        label: { en: 'Cover image', id: 'Gambar sampul' },
        help: {
          en: 'Uploaded videos only: shown before the video plays.',
          id: 'Khusus video unggahan: tampil sebelum video diputar.',
        },
      },
      {
        kind: 'select',
        key: 'ratio',
        label: { en: 'Shape', id: 'Bentuk' },
        options: [
          { value: '16/9', label: { en: 'Wide (16:9)', id: 'Lebar (16:9)' } },
          { value: '4/3', label: { en: 'Standard (4:3)', id: 'Standar (4:3)' } },
          { value: '1/1', label: { en: 'Square', id: 'Persegi' } },
          { value: '9/16', label: { en: 'Vertical (9:16)', id: 'Vertikal (9:16)' } },
        ],
        default: '16/9',
      },
      {
        kind: 'boolean',
        key: 'autoplay',
        label: { en: 'Play silently on its own', id: 'Putar otomatis tanpa suara' },
        help: {
          en: 'Uploaded videos loop muted as soon as they are on screen.',
          id: 'Video unggahan berulang tanpa suara begitu terlihat di layar.',
        },
        default: false,
      },
      align,
    ],
  },
  {
    type: 'video-reels',
    scopes: EVERYWHERE,
    category: 'media',
    icon: 'reels',
    name: { en: 'Shoppable videos', id: 'Video belanja' },
    description: {
      en: 'Short vertical videos, TikTok-style, each tagged with the product in it.',
      id: 'Video vertikal pendek ala TikTok, masing-masing ditandai produk di dalamnya.',
    },
    usesCatalogue: true,
    fields: [
      heading('Seen on our customers'),
      {
        kind: 'list',
        key: 'items',
        label: { en: 'Videos', id: 'Video' },
        itemLabel: { en: 'Video', id: 'Video' },
        titleKey: 'caption',
        max: 12,
        fields: [
          {
            kind: 'video',
            key: 'video',
            label: { en: 'Video', id: 'Video' },
            uploadOnly: true,
            help: {
              en: 'A vertical MP4 or WebM up to 30 MB.',
              id: 'MP4 atau WebM vertikal hingga 30 MB.',
            },
          },
          { kind: 'image', key: 'poster', label: { en: 'Cover image', id: 'Gambar sampul' } },
          {
            kind: 'text',
            key: 'caption',
            label: { en: 'Caption', id: 'Keterangan' },
            max: 100,
            default: '',
          },
          { kind: 'product', key: 'productId', label: { en: 'Product in the video', id: 'Produk di video' } },
        ],
      },
    ],
  },
  {
    type: 'lookbook',
    scopes: EVERYWHERE,
    category: 'media',
    icon: 'target',
    name: { en: 'Shop the look', id: 'Belanja tampilan' },
    description: {
      en: 'A photo with dots on the products in it; tap a dot to see the product.',
      id: 'Foto dengan titik pada produk di dalamnya; ketuk titik untuk melihat produknya.',
    },
    usesCatalogue: true,
    fields: [
      { kind: 'image', key: 'image', label: { en: 'Image', id: 'Gambar' } },
      heading('Shop the look'),
      body(),
      {
        kind: 'list',
        key: 'hotspots',
        label: { en: 'Products in the photo', id: 'Produk di foto' },
        help: {
          en: 'Pick a product, then click the photo to place its dot.',
          id: 'Pilih produk, lalu klik foto untuk menaruh titiknya.',
        },
        itemLabel: { en: 'Product', id: 'Produk' },
        titleKey: 'label',
        max: 8,
        fields: [
          { kind: 'product', key: 'productId', label: { en: 'Product', id: 'Produk' } },
          {
            kind: 'point',
            key: 'position',
            label: { en: 'Position on the photo', id: 'Posisi di foto' },
            imageKey: 'image',
          },
          {
            kind: 'text',
            key: 'label',
            label: { en: 'Label in the editor', id: 'Label di editor' },
            help: {
              en: 'Names this dot in the list above, so it is easy to find. Shoppers never see it.',
              id: 'Nama titik ini di daftar di atas, agar mudah dicari. Tidak terlihat oleh pembeli.',
            },
            max: 60,
            default: '',
          },
        ],
      },
      {
        kind: 'boolean',
        key: 'showList',
        label: { en: 'List the products beside the photo', id: 'Daftar produk di samping foto' },
        default: true,
      },
      {
        kind: 'select',
        key: 'imagePosition',
        label: { en: 'Photo position', id: 'Posisi foto' },
        options: [
          { value: 'left', label: { en: 'Left', id: 'Kiri' } },
          { value: 'right', label: { en: 'Right', id: 'Kanan' } },
        ],
        default: 'left',
      },
    ],
  },
  {
    type: 'before-after',
    scopes: EVERYWHERE,
    category: 'media',
    icon: 'compare',
    name: { en: 'Before and after', id: 'Sebelum dan sesudah' },
    description: {
      en: 'Two photos under one slider the shopper drags to compare.',
      id: 'Dua foto di bawah satu penggeser yang bisa digeser pembeli untuk membandingkan.',
    },
    fields: [
      heading('See the difference'),
      body(),
      { kind: 'image', key: 'before', label: { en: 'Before', id: 'Sebelum' } },
      { kind: 'image', key: 'after', label: { en: 'After', id: 'Sesudah' } },
      {
        kind: 'text',
        key: 'beforeLabel',
        label: { en: 'Before label', id: 'Label sebelum' },
        max: 30,
        default: 'Before',
      },
      {
        kind: 'text',
        key: 'afterLabel',
        label: { en: 'After label', id: 'Label sesudah' },
        max: 30,
        default: 'After',
      },
      {
        kind: 'number',
        key: 'start',
        label: { en: 'Slider starts at (%)', id: 'Posisi awal penggeser (%)' },
        min: 5,
        max: 95,
        default: 50,
      },
    ],
  },
  {
    type: 'logo-list',
    scopes: EVERYWHERE,
    category: 'trust',
    icon: 'logos',
    name: { en: 'Logo list', id: 'Deretan logo' },
    description: {
      en: 'Partner, press or marketplace logos — as a row or a running strip.',
      id: 'Logo mitra, media, atau marketplace — berjajar atau berjalan.',
    },
    fields: [
      heading('As seen in'),
      {
        kind: 'list',
        key: 'items',
        label: { en: 'Logos', id: 'Logo' },
        itemLabel: { en: 'Logo', id: 'Logo' },
        titleKey: 'alt',
        max: 20,
        fields: [
          { kind: 'image', key: 'image', label: { en: 'Logo', id: 'Logo' } },
          { ...imageAlt, label: { en: 'Name', id: 'Nama' } },
          { kind: 'link', key: 'link', label: { en: 'Link', id: 'Tautan' } },
        ],
      },
      {
        kind: 'select',
        key: 'layout',
        label: { en: 'Layout', id: 'Tampilan' },
        options: [
          { value: 'row', label: { en: 'Row', id: 'Berjajar' } },
          { value: 'marquee', label: { en: 'Running strip', id: 'Berjalan' } },
        ],
        default: 'row',
      },
      { ...speed, showWhen: { key: 'layout', is: ['marquee'] } },
      {
        kind: 'boolean',
        key: 'grayscale',
        label: { en: 'Show in grey', id: 'Tampilkan abu-abu' },
        help: {
          en: 'Logos are grey until hovered, so a row of mixed brands looks calm.',
          id: 'Logo abu-abu sampai disorot, agar deretan logo tampak rapi.',
        },
        default: true,
      },
    ],
  },
  {
    type: 'scrolling-text',
    scopes: EVERYWHERE,
    category: 'promotion',
    icon: 'marquee',
    name: { en: 'Scrolling text', id: 'Teks berjalan' },
    description: {
      en: 'Big words running across the page — a slogan, a promise, a promo.',
      id: 'Kata-kata besar berjalan melintasi halaman — slogan, janji, atau promo.',
    },
    defaultStyle: { width: 'edge' },
    fields: [
      {
        kind: 'list',
        key: 'items',
        label: { en: 'Phrases', id: 'Frasa' },
        itemLabel: { en: 'Phrase', id: 'Frasa' },
        titleKey: 'text',
        max: 10,
        fields: [
          {
            kind: 'text',
            key: 'text',
            label: { en: 'Text', id: 'Teks' },
            max: 80,
            default: '',
          },
        ],
      },
      {
        kind: 'select',
        key: 'size',
        label: { en: 'Text size', id: 'Ukuran teks' },
        options: [
          { value: 'md', label: { en: 'Medium', id: 'Sedang' } },
          { value: 'lg', label: { en: 'Large', id: 'Besar' } },
          { value: 'xl', label: { en: 'Huge', id: 'Sangat besar' } },
        ],
        default: 'lg',
      },
      {
        kind: 'select',
        key: 'separator',
        label: { en: 'Between phrases', id: 'Di antara frasa' },
        options: [
          { value: 'star', label: { en: 'Star ✦', id: 'Bintang ✦' } },
          { value: 'dot', label: { en: 'Dot •', id: 'Titik •' } },
          { value: 'none', label: { en: 'Nothing', id: 'Tidak ada' } },
        ],
        default: 'star',
      },
      direction,
      speed,
      {
        kind: 'boolean',
        key: 'uppercase',
        label: { en: 'Capital letters', id: 'Huruf kapital' },
        default: true,
      },
    ],
  },

  /* ---------------------------------------------------------------------- */
  /* Text and storytelling                                                  */
  /* ---------------------------------------------------------------------- */

  {
    type: 'multicolumn',
    scopes: EVERYWHERE,
    category: 'text',
    icon: 'columns',
    name: { en: 'Columns', id: 'Kolom' },
    description: {
      en: 'Cards side by side, each with an image, a title, text and a link.',
      id: 'Kartu berdampingan, masing-masing dengan gambar, judul, teks, dan tautan.',
    },
    fields: [
      heading('Why shop with us'),
      columns(3),
      {
        kind: 'select',
        key: 'imageRatio',
        label: { en: 'Image shape', id: 'Bentuk gambar' },
        options: [
          { value: '4/3', label: { en: 'Landscape', id: 'Mendatar' } },
          { value: '1/1', label: { en: 'Square', id: 'Persegi' } },
          { value: '3/4', label: { en: 'Portrait', id: 'Tegak' } },
        ],
        default: '4/3',
      },
      align,
      {
        kind: 'list',
        key: 'items',
        label: { en: 'Columns', id: 'Kolom' },
        itemLabel: { en: 'Column', id: 'Kolom' },
        titleKey: 'title',
        max: 12,
        fields: [
          { kind: 'image', key: 'image', label: { en: 'Image', id: 'Gambar' } },
          {
            kind: 'text',
            key: 'title',
            label: { en: 'Title', id: 'Judul' },
            max: 80,
            default: '',
          },
          {
            kind: 'textarea',
            key: 'text',
            label: { en: 'Text', id: 'Teks' },
            max: 400,
            default: '',
            rows: 3,
          },
          {
            kind: 'text',
            key: 'linkLabel',
            label: { en: 'Link text', id: 'Teks tautan' },
            max: 40,
            default: '',
          },
          { kind: 'link', key: 'link', label: { en: 'Link', id: 'Tautan' } },
        ],
      },
    ],
  },
  {
    type: 'scrolling-story',
    category: 'text',
    icon: 'story',
    name: { en: 'Scrolling story', id: 'Cerita bergulir' },
    description: {
      en: 'Chapters of your story; the picture stays in place and changes as the shopper scrolls.',
      id: 'Bab-bab cerita Anda; gambar tetap di tempat dan berganti saat pembeli menggulir.',
    },
    fields: [
      heading('How it is made'),
      {
        kind: 'list',
        key: 'steps',
        label: { en: 'Chapters', id: 'Bab' },
        itemLabel: { en: 'Chapter', id: 'Bab' },
        titleKey: 'heading',
        max: 8,
        fields: [
          { kind: 'image', key: 'image', label: { en: 'Image', id: 'Gambar' } },
          {
            kind: 'text',
            key: 'heading',
            label: { en: 'Heading', id: 'Judul' },
            max: 100,
            default: '',
          },
          body(),
        ],
      },
      {
        kind: 'select',
        key: 'imagePosition',
        label: { en: 'Image position', id: 'Posisi gambar' },
        options: [
          { value: 'left', label: { en: 'Left', id: 'Kiri' } },
          { value: 'right', label: { en: 'Right', id: 'Kanan' } },
        ],
        default: 'left',
      },
    ],
  },
  {
    type: 'timeline',
    scopes: EVERYWHERE,
    category: 'text',
    icon: 'timeline',
    name: { en: 'Timeline', id: 'Linimasa' },
    description: {
      en: 'Milestones in order — how the brand started and grew.',
      id: 'Tonggak secara berurutan — bagaimana brand dimulai dan tumbuh.',
    },
    fields: [
      heading('Our journey'),
      {
        kind: 'list',
        key: 'items',
        label: { en: 'Milestones', id: 'Tonggak' },
        itemLabel: { en: 'Milestone', id: 'Tonggak' },
        titleKey: 'title',
        max: 16,
        fields: [
          {
            kind: 'text',
            key: 'label',
            label: { en: 'Year or date', id: 'Tahun atau tanggal' },
            max: 30,
            default: '',
          },
          {
            kind: 'text',
            key: 'title',
            label: { en: 'Title', id: 'Judul' },
            max: 100,
            default: '',
          },
          {
            kind: 'textarea',
            key: 'text',
            label: { en: 'Text', id: 'Teks' },
            max: 500,
            default: '',
            rows: 3,
          },
          { kind: 'image', key: 'image', label: { en: 'Image', id: 'Gambar' } },
        ],
      },
    ],
  },
  {
    type: 'table',
    scopes: EVERYWHERE,
    category: 'text',
    icon: 'table',
    name: { en: 'Table', id: 'Tabel' },
    description: {
      en: 'A comparison or size chart: rows and columns with a header.',
      id: 'Tabel perbandingan atau ukuran: baris dan kolom dengan judul.',
    },
    fields: [
      heading('Compare'),
      body(),
      {
        kind: 'table',
        key: 'table',
        label: { en: 'Table', id: 'Tabel' },
        maxColumns: 8,
        maxRows: 30,
      },
      {
        kind: 'boolean',
        key: 'highlightFirstColumn',
        label: { en: 'Bold first column', id: 'Tebalkan kolom pertama' },
        default: true,
      },
      {
        kind: 'boolean',
        key: 'striped',
        label: { en: 'Striped rows', id: 'Baris belang' },
        default: true,
      },
      { ...width, default: 'wide' },
      align,
    ],
    presets: [
      {
        key: 'size-chart',
        name: { en: 'Size chart', id: 'Tabel ukuran' },
        description: {
          en: 'A starting size chart for a size guide page.',
          id: 'Tabel ukuran awal untuk halaman panduan ukuran.',
        },
        settings: {
          heading: 'Size chart',
          table: {
            columns: ['Size', 'Chest (cm)', 'Waist (cm)', 'Length (cm)'],
            rows: [
              ['S', '96', '80', '68'],
              ['M', '102', '86', '70'],
              ['L', '108', '92', '72'],
              ['XL', '114', '98', '74'],
            ],
          },
        },
      },
    ],
  },

  /* ---------------------------------------------------------------------- */
  /* Promotions                                                             */
  /* ---------------------------------------------------------------------- */

  {
    type: 'countdown',
    scopes: EVERYWHERE,
    category: 'promotion',
    icon: 'timer',
    name: { en: 'Countdown', id: 'Hitung mundur' },
    description: {
      en: 'Days, hours and minutes to the end of a sale — for flash sales and 11.11.',
      id: 'Hari, jam, dan menit menuju akhir promo — untuk flash sale dan 11.11.',
    },
    fields: [
      heading('Flash sale ends in'),
      subheading(),
      {
        kind: 'datetime',
        key: 'endsAt',
        label: { en: 'Counts down to', id: 'Menghitung mundur ke' },
      },
      buttonLabel,
      buttonLink,
      {
        kind: 'select',
        key: 'afterEnd',
        label: { en: 'When the time is up', id: 'Saat waktu habis' },
        options: [
          { value: 'hide', label: { en: 'Hide the section', id: 'Sembunyikan bagian ini' } },
          { value: 'message', label: { en: 'Show a message', id: 'Tampilkan pesan' } },
        ],
        default: 'hide',
      },
      {
        kind: 'text',
        key: 'endedText',
        label: { en: 'Message', id: 'Pesan' },
        max: 120,
        default: 'This sale has ended. Stay tuned for the next one!',
        showWhen: { key: 'afterEnd', is: ['message'] },
      },
      { ...align, default: 'center' },
    ],
    defaultStyle: { colorScheme: 'brand' },
  },
  {
    type: 'promo-codes',
    scopes: EVERYWHERE,
    category: 'promotion',
    icon: 'ticket',
    name: { en: 'Voucher codes', id: 'Kode voucher' },
    description: {
      en: 'Voucher codes shoppers copy with one tap.',
      id: 'Kode voucher yang bisa disalin pembeli dengan sekali ketuk.',
    },
    usesCatalogue: true,
    fields: [
      heading('Vouchers for you'),
      {
        kind: 'list',
        key: 'items',
        label: { en: 'Vouchers', id: 'Voucher' },
        help: {
          en: 'Pick vouchers from your shop, or type custom codes.',
          id: 'Pilih voucher dari toko Anda, atau ketik kode khusus.',
        },
        itemLabel: { en: 'Voucher', id: 'Voucher' },
        titleKey: 'code',
        max: 6,
        fields: [
          {
            kind: 'voucher',
            key: 'voucherId',
            label: { en: 'Voucher', id: 'Voucher' },
            emptyLabel: { en: 'Custom / manual code', id: 'Kode khusus / manual' },
          },
          {
            kind: 'text',
            key: 'code',
            label: { en: 'Code override', id: 'Kode khusus' },
            placeholder: { en: 'Leave empty to use code from voucher', id: 'Kosongkan untuk memakai kode dari voucher' },
            max: 40,
            default: '',
          },
          {
            kind: 'text',
            key: 'title',
            label: { en: 'Title override', id: 'Judul khusus' },
            placeholder: { en: 'e.g. 10% off your first order', id: 'mis. Diskon 10% pesanan pertama' },
            max: 80,
            default: '',
          },
          {
            kind: 'text',
            key: 'terms',
            label: { en: 'Terms override', id: 'Syarat khusus' },
            placeholder: { en: 'e.g. Min. spend Rp 150.000', id: 'mis. Min. belanja Rp 150.000' },
            max: 120,
            default: '',
          },
        ],
      },
    ],
  },

  /* ---------------------------------------------------------------------- */
  /* Trust                                                                  */
  /* ---------------------------------------------------------------------- */

  {
    type: 'icon-features',
    scopes: EVERYWHERE,
    category: 'trust',
    icon: 'badge',
    name: { en: 'Icons with text', id: 'Ikon dengan teks' },
    description: {
      en: 'Short promises with icons: free shipping, COD, returns, guarantees.',
      id: 'Janji singkat dengan ikon: gratis ongkir, COD, pengembalian, garansi.',
    },
    fields: [
      heading(),
      {
        kind: 'list',
        key: 'items',
        label: { en: 'Items', id: 'Item' },
        itemLabel: { en: 'Item', id: 'Item' },
        titleKey: 'title',
        max: 8,
        fields: [
          iconField('truck'),
          {
            kind: 'text',
            key: 'title',
            label: { en: 'Title', id: 'Judul' },
            max: 60,
            default: '',
          },
          {
            kind: 'textarea',
            key: 'text',
            label: { en: 'Text', id: 'Teks' },
            max: 200,
            default: '',
            rows: 2,
          },
        ],
      },
      columns(4),
      {
        kind: 'select',
        key: 'iconStyle',
        label: { en: 'Icon style', id: 'Gaya ikon' },
        options: [
          { value: 'circle', label: { en: 'In a circle', id: 'Dalam lingkaran' } },
          { value: 'plain', label: { en: 'Plain', id: 'Polos' } },
        ],
        default: 'circle',
      },
      { ...align, default: 'center' },
    ],
    presets: [
      {
        key: 'indonesia-trust',
        name: { en: 'Icons — shipping, COD, returns', id: 'Ikon — ongkir, COD, retur' },
        description: {
          en: 'The four promises Indonesian shoppers look for.',
          id: 'Empat janji yang dicari pembeli Indonesia.',
        },
        settings: {
          items: [
            { icon: 'truck', title: 'Free shipping', text: 'On orders over Rp 200.000' },
            { icon: 'cash', title: 'Cash on delivery', text: 'Pay when it arrives' },
            { icon: 'refresh', title: '7-day returns', text: 'Change your mind, no fuss' },
            { icon: 'shield', title: '100% original', text: 'Straight from the brand' },
          ],
        },
        style: { colorScheme: 'subtle' },
      },
    ],
  },

  /* ---------------------------------------------------------------------- */
  /* Shop information                                                       */
  /* ---------------------------------------------------------------------- */

  {
    type: 'store-locations',
    category: 'store',
    icon: 'pin',
    name: { en: 'Store locations', id: 'Lokasi toko' },
    description: {
      en: 'Your physical stores, with address, opening hours and directions.',
      id: 'Toko fisik Anda, dengan alamat, jam buka, dan petunjuk arah.',
    },
    fields: [
      heading('Visit our stores'),
      {
        kind: 'list',
        key: 'items',
        label: { en: 'Stores', id: 'Toko' },
        itemLabel: { en: 'Store', id: 'Toko' },
        titleKey: 'name',
        max: 24,
        fields: [
          { kind: 'image', key: 'image', label: { en: 'Photo', id: 'Foto' } },
          {
            kind: 'text',
            key: 'name',
            label: { en: 'Name', id: 'Nama' },
            max: 80,
            default: '',
          },
          {
            kind: 'textarea',
            key: 'address',
            label: { en: 'Address', id: 'Alamat' },
            max: 300,
            default: '',
            rows: 2,
          },
          {
            kind: 'textarea',
            key: 'hours',
            label: { en: 'Opening hours', id: 'Jam buka' },
            placeholder: { en: 'Mon–Fri 10:00–21:00', id: 'Sen–Jum 10.00–21.00' },
            max: 200,
            default: '',
            rows: 2,
          },
          {
            kind: 'text',
            key: 'phone',
            label: { en: 'Phone', id: 'Telepon' },
            max: 32,
            default: '',
          },
          {
            kind: 'link',
            key: 'mapLink',
            label: { en: 'Directions link', id: 'Tautan petunjuk arah' },
            help: {
              en: 'Paste the Google Maps share link as a web address.',
              id: 'Tempel tautan bagikan Google Maps sebagai alamat web.',
            },
          },
        ],
      },
      columns(3, 1),
    ],
  },
  {
    type: 'contact-cta',
    scopes: EVERYWHERE,
    category: 'store',
    icon: 'chat',
    name: { en: 'Chat with us', id: 'Hubungi kami' },
    description: {
      en: 'Buttons that open WhatsApp with a message ready, or an email.',
      id: 'Tombol yang membuka WhatsApp dengan pesan siap kirim, atau email.',
    },
    fields: [
      heading('Questions? We are happy to help'),
      subheading('Chat with our team — we usually reply within the hour.'),
      {
        kind: 'text',
        key: 'whatsapp',
        label: { en: 'WhatsApp number', id: 'Nomor WhatsApp' },
        placeholder: { en: 'e.g. 0812 3456 7890', id: 'mis. 0812 3456 7890' },
        max: 20,
        default: '',
      },
      {
        kind: 'text',
        key: 'whatsappMessage',
        label: { en: 'Message typed for the shopper', id: 'Pesan yang sudah diketik' },
        max: 200,
        default: 'Hi! I have a question about your products.',
      },
      {
        kind: 'text',
        key: 'whatsappLabel',
        label: { en: 'WhatsApp button', id: 'Tombol WhatsApp' },
        max: 40,
        default: 'Chat on WhatsApp',
      },
      {
        kind: 'text',
        key: 'email',
        label: { en: 'Email address', id: 'Alamat email' },
        help: {
          en: 'Leave empty to use the one in shop settings; clear both for no email button.',
          id: 'Kosongkan untuk memakai email di pengaturan toko.',
        },
        max: 120,
        default: '',
      },
      {
        kind: 'text',
        key: 'emailLabel',
        label: { en: 'Email button', id: 'Tombol email' },
        max: 40,
        default: 'Send an email',
      },
      { ...align, default: 'center' },
    ],
    defaultStyle: { colorScheme: 'subtle' },
  },

  /* ---------------------------------------------------------------------- */
  /* Product page                                                           */
  /* ---------------------------------------------------------------------- */

  {
    type: 'product-info',
    category: 'product-page',
    icon: 'bag',
    name: { en: 'Product details', id: 'Detail produk' },
    description: {
      en: 'Photos, name, price and the buy buttons. Arrange what shows beside the photos with blocks.',
      id: 'Foto, nama, harga, dan tombol beli. Atur isi di samping foto dengan blok.',
    },
    scopes: PRODUCT_ONLY,
    max: 1,
    required: true,
    usesCatalogue: true,
    fields: [
      {
        kind: 'select',
        key: 'gallery',
        label: { en: 'Photo layout', id: 'Tata letak foto' },
        options: [
          { value: 'thumbnails', label: { en: 'Large photo and thumbnails', id: 'Foto besar dan thumbnail' } },
          { value: 'grid', label: { en: 'Grid of photos', id: 'Kisi foto' } },
          { value: 'stacked', label: { en: 'Photos stacked', id: 'Foto bertumpuk' } },
          { value: 'mosaic', label: { en: 'Photo mosaic', id: 'Mozaik foto' } },
        ],
        default: 'thumbnails',
      },
      {
        kind: 'boolean',
        key: 'stickyInfo',
        label: { en: 'Keep details in view', id: 'Detail tetap terlihat' },
        help: {
          en: 'On a desktop, the details stay on screen while the photos scroll.',
          id: 'Di desktop, detail tetap di layar saat foto digulir.',
        },
        default: true,
      },
      {
        kind: 'boolean',
        key: 'zoom',
        label: { en: 'Zoom photos on hover', id: 'Perbesar foto saat disorot' },
        default: true,
      },
      {
        kind: 'boolean',
        key: 'breadcrumbs',
        label: { en: 'Show the path (Shop › Category)', id: 'Tampilkan jalur (Toko › Kategori)' },
        default: true,
      },
      {
        kind: 'blocks',
        key: 'blocks',
        label: { en: 'Beside the photos', id: 'Di samping foto' },
        max: 16,
        blocks: PRODUCT_INFO_BLOCKS,
        defaultBlocks: ['title', 'rating', 'price', 'purchase', 'size-guide', 'badges', 'description'],
      },
    ],
  },
  {
    type: 'product-reviews',
    category: 'product-page',
    icon: 'quote',
    name: { en: 'Product reviews', id: 'Ulasan produk' },
    description: {
      en: "Buyers' ratings and reviews of this product.",
      id: 'Rating dan ulasan pembeli untuk produk ini.',
    },
    scopes: PRODUCT_ONLY,
    max: 1,
    fields: [],
  },
  {
    type: 'related-products',
    category: 'product-page',
    icon: 'shelves',
    name: { en: 'Related products', id: 'Produk terkait' },
    description: {
      en: 'More from the same category.',
      id: 'Produk lain dari kategori yang sama.',
    },
    scopes: PRODUCT_ONLY,
    max: 1,
    usesCatalogue: true,
    fields: [heading('You may also like'), limit(4, 12), columns(4)],
  },
] as const satisfies readonly SectionSchema[]

export type SectionType = (typeof SECTION_SCHEMAS)[number]['type']

const BY_TYPE = new Map<string, SectionSchema>(
  SECTION_SCHEMAS.map((schema) => [schema.type, schema]),
)

export function sectionSchema(type: string): SectionSchema | null {
  return BY_TYPE.get(type) ?? null
}

export function isSectionType(type: unknown): type is SectionType {
  return typeof type === 'string' && BY_TYPE.has(type)
}
