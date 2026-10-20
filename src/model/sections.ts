/**
 * The section library: every building block a template or page can use.
 *
 * This file is the schema half — names and fields, no React — so the admin
 * and developer servers can validate a saved layout without importing a
 * component. The renderers live in `../render/registry`, keyed by the same
 * `type`; a type with a schema and no renderer is a compile error there.
 *
 * One type per look. Where several looks share a template they are a family
 * (`banner`, `product-list`, `gallery`, `quotes`, `cards`, `statement`,
 * `story`) whose variant field picks the look; `../render/families` draws it.
 *
 * Adding a section: declare it here, render it there. Every template and page
 * in every shop can use it from that moment, which is the point — see "Scope
 * rules" in docs/POSITIONING.md.
 */

import { BLOCK_STYLE_FIELDS } from './block-style'
import { blocksSectionSchema, BLOCK_TYPES } from './blocks'
import type {
  BlockSchema,
  BooleanField,
  Field,
  ImageField,
  ItemField,
  LinkField,
  ListField,
  RichTextField,
  SelectField,
  TextareaField,
  TextField,
  VideoField,
} from './fields'
import type { IconName } from './icons'
import type { Localized } from './localized'
import {
  BANNER_BAND_SHAPES,
  BANNER_SLIDES_PER_VIEW,
  photoFitField,
  photoPositionField,
  slidesField,
  SLIDES_PER_VIEW,
  SLIDES_PER_VIEW_MOBILE,
} from './section-style'

// The icon catalogue lives in `./icons` so the primitive blocks can use it
// without importing this module (which imports them). Re-exported here for
// the API's existing readers.
export { ICON_NAMES, type IconName } from './icons'

/**
 * Where a template can use a section. Omitted means everywhere but the product
 * page. An article's own body is a page (`page`); `article` is the theme's
 * article template, the frame around every body. `catalog` is the product
 * catalogue and every listing page that shares it — the category and
 * collection detail pages.
 */
export type SectionScope = 'home' | 'page' | 'product' | 'article' | 'catalog' | 'orderTracking'

/** How the "Add section" picker groups sections. */
export const SECTION_CATEGORIES = [
  'banners',
  'products',
  'media',
  'text',
  'layout',
  'promotion',
  'trust',
  'store',
  'product-page',
  'article-page',
  'catalog-page',
] as const

export type SectionCategory = (typeof SECTION_CATEGORIES)[number]

export const SECTION_CATEGORY_LABELS: Record<SectionCategory, Localized> = {
  banners: { en: 'Banners and heroes', id: 'Banner dan sampul' },
  products: { en: 'Products and collections', id: 'Produk dan koleksi' },
  media: { en: 'Images and video', id: 'Gambar dan video' },
  text: { en: 'Text and storytelling', id: 'Teks dan cerita' },
  layout: { en: 'Layout and blocks', id: 'Tata letak dan blok' },
  promotion: { en: 'Promotions', id: 'Promosi' },
  trust: { en: 'Reviews and trust', id: 'Ulasan dan kepercayaan' },
  store: { en: 'Shop information', id: 'Informasi toko' },
  'product-page': { en: 'Product page', id: 'Halaman produk' },
  'article-page': { en: 'Article page', id: 'Halaman artikel' },
  'catalog-page': { en: 'Catalogue page', id: 'Halaman katalog' },
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
  /**
   * Kept for layouts that were built from it, but not offered in the picker.
   * The plain section stays available.
   */
  hidden?: boolean
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
  /**
   * Kept in the library for layouts that already use it, but not offered in
   * the "Add section" picker. Existing sections still render and sanitise;
   * only the catalogue is narrowed.
   */
  hidden?: boolean
  /**
   * Paints outside the page flow — a pinned overlay (the floating contact),
   * not a band. The frame gives it no padding and the layout skips it when
   * spacing sections and judging the page's edges, so it never pushes the
   * page around.
   */
  floating?: boolean
  /** Style a freshly added section starts with, e.g. edge to edge for a video. */
  defaultStyle?: Record<string, unknown>
  presets?: readonly SectionPreset[]
  fields: readonly Field[]
}

// The article and catalogue templates take the general sections too — a rich
// text under every article, a banner above the product grid — so both
// "everywhere" sets include them.
const EVERYWHERE_BUT_PRODUCT: readonly SectionScope[] = ['home', 'page', 'article', 'catalog']
const EVERYWHERE: readonly SectionScope[] = [
  'home',
  'page',
  'product',
  'article',
  'catalog',
  'orderTracking',
]
const PRODUCT_ONLY: readonly SectionScope[] = ['product']
const ARTICLE_ONLY: readonly SectionScope[] = ['article']
const CATALOG_ONLY: readonly SectionScope[] = ['catalog']

/** The most related articles an article page draws; the storefront reads this many. */
export const MAX_RELATED_ARTICLES = 6

export function sectionScopes(schema: SectionSchema): readonly SectionScope[] {
  return schema.scopes ?? EVERYWHERE_BUT_PRODUCT
}

export function isSectionAllowed(schema: SectionSchema, scope: SectionScope): boolean {
  return sectionScopes(schema).includes(scope)
}

/**
 * Whether the picker should offer `schema` for `scope`: allowed there and not
 * hidden from the catalogue. A hidden section stays valid everywhere else —
 * a layout that already holds one keeps rendering, duplicating and saving it.
 */
export function isSectionOffered(schema: SectionSchema, scope: SectionScope): boolean {
  return !schema.hidden && isSectionAllowed(schema, scope)
}

/** The presets the picker offers for a section, in order; hidden ones stay usable in stored layouts. */
export function offeredPresets(schema: SectionSchema): readonly SectionPreset[] {
  return (schema.presets ?? []).filter((preset) => !preset.hidden)
}

/* -------------------------------------------------------------------------- */
/* Field builders                                                             */
/* -------------------------------------------------------------------------- */

const heading = (fallback = ''): TextField => ({
  kind: 'text',
  key: 'heading',
  label: { en: 'Heading', id: 'Judul' },
  max: 120,
  default: fallback,
})

const body = (max = 5000): RichTextField => ({
  kind: 'richtext',
  key: 'body',
  label: { en: 'Text', id: 'Teks' },
  max,
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

/** The same button-label field, with a starting word — the family sections' default. */
const buttonLabelText = (fallback: string): ItemField => ({ ...buttonLabel, default: fallback })

/* The field builders the family sections share. They are the one vocabulary
   every section declares its settings in; no family keeps a private copy. */

const textField = (
  key: string,
  label: Localized,
  max: number,
  fallback = '',
  help?: Localized,
): TextField => ({ kind: 'text', key, label, max, default: fallback, ...(help ? { help } : {}) })

const areaField = (key: string, label: Localized, max: number, rows = 4): TextareaField => ({
  kind: 'textarea',
  key,
  label,
  max,
  default: '',
  rows,
})

const imageField = (key: string, label: Localized, help?: Localized): ImageField => ({
  kind: 'image',
  key,
  label,
  ...(help ? { help } : {}),
})

const videoField = (key: string, label: Localized, uploadOnly = false): VideoField => ({
  kind: 'video',
  key,
  label,
  ...(uploadOnly ? { uploadOnly: true } : {}),
})

const linkField = (key: string, label: Localized): LinkField => ({ kind: 'link', key, label })

const selectField = (
  key: string,
  label: Localized,
  options: ReadonlyArray<{ value: string; label: Localized }>,
  fallback: string,
  help?: Localized,
): SelectField => ({
  kind: 'select',
  key,
  label,
  options,
  default: fallback,
  ...(help ? { help } : {}),
})

const toggleField = (
  key: string,
  label: Localized,
  fallback = false,
  help?: Localized,
): BooleanField => ({ kind: 'boolean', key, label, default: fallback, ...(help ? { help } : {}) })

const listField = (
  key: string,
  label: Localized,
  itemLabel: Localized,
  titleKey: string,
  max: number,
  fields: readonly ItemField[],
): ListField => ({ kind: 'list', key, label, itemLabel, titleKey, max, fields })

const subheading = (fallback = ''): TextField =>
  textField('subheading', { en: 'Subheading', id: 'Subjudul' }, 200, fallback)

/** A left/right choice stored under `key`. */
const positionField = (key: string, label: Localized, fallback = 'left'): SelectField =>
  selectField(
    key,
    label,
    [
      { value: 'left', label: { en: 'Left', id: 'Kiri' } },
      { value: 'right', label: { en: 'Right', id: 'Kanan' } },
    ],
    fallback,
  )

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

/**
 * A columns pair: how many the section draws on a desktop, and how many on a
 * phone — one (a stack) or two. Every renderer reads both, so no section
 * surprises a seller by squeezing two columns into a phone.
 */
const columns = (fallback: number, from = 2, mobile = 1): ItemField[] => [
  {
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
  },
  {
    kind: 'select',
    key: 'mobileColumns',
    label: { en: 'Columns on phones', id: 'Kolom di ponsel' },
    options: [1, 2].map((n) => ({
      value: String(n),
      label: { en: String(n), id: String(n) },
    })),
    default: String(mobile),
  },
]

/** How a product list arranges its cards: the plain grid, a slider or a bento. */
const productLayout = (): ItemField => ({
  kind: 'select',
  key: 'layout',
  label: { en: 'Layout', id: 'Tampilan' },
  options: [
    { value: 'grid', label: { en: 'Grid', id: 'Kisi' } },
    { value: 'slider', label: { en: 'Slider', id: 'Slider (geser)' } },
    { value: 'bento', label: { en: 'Bento grid', id: 'Kisi bento' } },
  ],
  default: 'grid',
  help: {
    en: 'Slider lays the cards in one row with arrows over its edges; bento mixes tile sizes with the name and price on the image.',
    id: 'Slider menaruh kartu dalam satu baris dengan panah di tepinya; bento mencampur ukuran ubin dengan nama dan harga di atas gambar.',
  },
})

/**
 * Whether a bento's tiles always show their text, or show it on hover — the
 * photos uncovered until the shopper points at one. Screens without hover
 * always show it.
 */
const bentoText = (): ItemField => ({
  kind: 'select',
  key: 'bentoText',
  label: { en: 'Text on tiles', id: 'Teks di ubin' },
  options: [
    { value: 'always', label: { en: 'Always', id: 'Selalu' } },
    { value: 'hover', label: { en: 'On hover', id: 'Saat disorot' } },
  ],
  default: 'always',
  help: {
    en: 'On hover leaves each photo clear and brings its text in when the shopper points at it. Phones always show the text.',
    id: 'Saat disorot membiarkan foto bersih dan memunculkan teksnya saat pembeli mengarahkan kursor. Ponsel selalu menampilkan teks.',
  },
  showWhen: { key: 'layout', is: ['bento'] },
})

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

const iconField = (fallback: IconName): ItemField => ({
  kind: 'icon',
  key: 'icon',
  label: { en: 'Icon', id: 'Ikon' },
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
          en: 'Shown only on products whose category or product settings have a size guide.',
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

export const SECTION_SCHEMAS = [
  blocksSectionSchema,

  /* --- Section families: one type per family, a variant field picks the look --- */

  {
    type: 'banner',
    category: 'banners',
    icon: 'image',
    name: { en: 'Banner', id: 'Banner' },
    description: {
      en: 'A headline and buttons over an image, a looping video or a parallax photo.',
      id: 'Judul dan tombol di atas gambar, video berulang, atau foto paralaks.',
    },
    defaultStyle: { width: 'edge', paddingTop: 'none', paddingBottom: 'none' },
    fields: [
      selectField(
        'media',
        { en: 'Background', id: 'Latar' },
        [
          { value: 'image', label: { en: 'Image', id: 'Gambar' } },
          { value: 'video', label: { en: 'Looping video', id: 'Video berulang' } },
          { value: 'parallax', label: { en: 'Parallax photo', id: 'Foto paralaks' } },
        ],
        'image',
      ),
      {
        ...imageField('image', { en: 'Image', id: 'Gambar' }),
        showWhen: { key: 'media', is: ['image', 'parallax'] },
      },
      {
        ...toggleField(
          'useShopBanner',
          { en: "Use the shop's banner", id: 'Pakai banner toko' },
          true,
        ),
        showWhen: { key: 'media', is: ['image'] },
      },
      {
        ...videoField('video', { en: 'Video', id: 'Video' }, true),
        showWhen: { key: 'media', is: ['video'] },
      },
      {
        ...imageField('poster', { en: 'Cover image', id: 'Gambar sampul' }),
        showWhen: { key: 'media', is: ['video'] },
      },
      {
        ...photoFitField,
        showWhen: { key: 'media', is: ['image', 'video', 'parallax'] },
      },
      {
        ...photoPositionField,
        showWhen: { key: 'media', is: ['image', 'video', 'parallax'] },
      },
      heading(''),
      subheading(''),
      { ...body(600), showWhen: { key: 'media', is: ['video'] } },
      buttonLabelText('Shop now'),
      buttonLink,
      textField('secondaryButtonLabel', { en: 'Second button label', id: 'Teks tombol kedua' }, 40),
      linkField('secondaryButtonLink', { en: 'Second button link', id: 'Tautan tombol kedua' }),
      { ...align, default: 'left' },
      {
        ...selectField(
          'contentPosition',
          { en: 'Text position', id: 'Posisi teks' },
          [
            { value: 'top', label: { en: 'Top', id: 'Atas' } },
            { value: 'middle', label: { en: 'Middle', id: 'Tengah' } },
            { value: 'bottom', label: { en: 'Bottom', id: 'Bawah' } },
          ],
          'bottom',
        ),
      },
      selectField(
        'height',
        { en: 'Height', id: 'Tinggi' },
        [
          { value: 'sm', label: { en: 'Short', id: 'Pendek' } },
          { value: 'md', label: { en: 'Medium', id: 'Sedang' } },
          { value: 'lg', label: { en: 'Tall', id: 'Tinggi' } },
          {
            value: 'wide',
            label: { en: 'Wide (16:5)', id: 'Lebar (16:5)' },
          },
          { value: 'screen', label: { en: 'Full screen', id: 'Satu layar' } },
        ],
        'md',
      ),
      overlay,
      {
        ...selectField(
          'intensity',
          { en: 'Movement', id: 'Gerakan' },
          [
            { value: 'soft', label: { en: 'Soft', id: 'Halus' } },
            { value: 'strong', label: { en: 'Strong', id: 'Kuat' } },
          ],
          'soft',
        ),
        showWhen: { key: 'media', is: ['parallax'] },
      },
    ],
  },
  {
    type: 'product-list',
    scopes: [
      'home',
      'page',
      'product',
      'article',
      'catalog',
    ] as const satisfies readonly SectionScope[],
    category: 'products',
    icon: 'grid',
    usesCatalogue: true,
    name: { en: 'Product list', id: 'Daftar produk' },
    description: {
      en: 'Products from a collection you pick, the newest, one shelf per collection, or several collections in tabs.',
      id: 'Produk dari koleksi pilihan, terbaru, satu rak per koleksi, atau beberapa koleksi dalam tab.',
    },
    fields: [
      selectField(
        'source',
        { en: 'Which products', id: 'Produk mana' },
        [
          { value: 'collection', label: { en: 'One collection', id: 'Satu koleksi' } },
          { value: 'latest', label: { en: 'Newest', id: 'Terbaru' } },
          {
            value: 'shelves',
            label: { en: 'One shelf per collection', id: 'Satu rak per koleksi' },
          },
          { value: 'tabs', label: { en: 'Collections in tabs', id: 'Koleksi dalam tab' } },
        ],
        'collection',
      ),
      {
        kind: 'collection',
        key: 'collectionId',
        label: { en: 'Collection', id: 'Koleksi' },
        emptyLabel: { en: 'First collection', id: 'Koleksi pertama' },
        showWhen: { key: 'source', is: ['collection'] },
      },
      heading(''),
      productLayout(),
      bentoText(),
      limit(8),
      // The grid's whole columns and the slider's own per-view: the first
      // only moves the grid, the second — whole or fractional, a card peeking
      // at the edge — only the row.
      ...columns(4, 2, 2).map((field) => ({
        ...field,
        showWhen: { key: 'layout', is: ['grid'] },
      })),
      {
        ...slidesField(
          'perPage',
          { en: 'Slides on desktop', id: 'Slide di desktop' },
          SLIDES_PER_VIEW,
          '4',
        ),
        showWhen: { key: 'layout', is: ['slider'] },
      },
      {
        ...slidesField(
          'perPageMobile',
          { en: 'Slides on phones', id: 'Slide di ponsel' },
          SLIDES_PER_VIEW_MOBILE,
          '2',
        ),
        showWhen: { key: 'layout', is: ['slider'] },
      },
      {
        // Only the newest list ends with a link to the whole catalogue; the
        // collection looks always carry their own "See all" in the header.
        ...toggleField(
          'showAll',
          { en: 'Link to all products', id: 'Tautan ke semua produk' },
          true,
        ),
        showWhen: { key: 'source', is: ['latest'] },
      },
      {
        ...listField('tabs', { en: 'Tabs', id: 'Tab' }, { en: 'Tab', id: 'Tab' }, 'label', 6, [
          { kind: 'collection', key: 'collectionId', label: { en: 'Collection', id: 'Koleksi' } },
          textField('label', { en: 'Tab name', id: 'Nama tab' }, 40),
        ]),
        showWhen: { key: 'source', is: ['tabs'] },
      },
    ],
  },
  {
    type: 'gallery',
    category: 'media',
    icon: 'gallery',
    name: { en: 'Gallery', id: 'Galeri' },
    description: {
      en: 'A grid of photos — even, staggered like masonry, or a shop-your-feed wall with a handle.',
      id: 'Kisi foto — rata, berselang seperti masonry, atau dinding feed dengan nama akun.',
    },
    fields: [
      selectField(
        'layout',
        { en: 'Look', id: 'Tampilan' },
        [
          { value: 'grid', label: { en: 'Grid', id: 'Kisi' } },
          { value: 'masonry', label: { en: 'Masonry', id: 'Masonry' } },
          { value: 'social', label: { en: 'Social wall', id: 'Dinding sosial' } },
        ],
        'grid',
      ),
      heading(''),
      {
        ...textField('handle', { en: 'Handle', id: 'Nama akun' }, 60, '@yourshop'),
        showWhen: { key: 'layout', is: ['social'] },
      },
      listField('items', { en: 'Photos', id: 'Foto' }, { en: 'Photo', id: 'Foto' }, 'caption', 30, [
        // Each look reads its own fields off an item: `ImageGallery` and
        // `SocialWall` take caption and link, `MasonryGallery` takes the alt
        // text (its tiles have no room for a caption) and a link.
        imageField('image', { en: 'Photo', id: 'Foto' }),
        photoFitField,
        photoPositionField,
        {
          ...textField('caption', { en: 'Caption', id: 'Keterangan' }, 160),
          showWhen: { key: 'layout', is: ['grid', 'social'] },
        },
        {
          ...textField('alt', { en: 'Description', id: 'Deskripsi' }, 160),
          showWhen: { key: 'layout', is: ['masonry'] },
        },
        linkField('link', { en: 'Link (optional)', id: 'Tautan (opsional)' }),
      ]),
      ...columns(3, 2, 2),
    ],
  },
  {
    type: 'quotes',
    category: 'trust',
    icon: 'quote',
    name: { en: 'Quotes and reviews', id: 'Kutipan dan ulasan' },
    description: {
      en: 'What customers say — quote cards, each with an optional video.',
      id: 'Kata para pelanggan — kartu kutipan, masing-masing bisa dengan video.',
    },
    fields: [
      selectField(
        'variant',
        { en: 'Look', id: 'Tampilan' },
        [
          { value: 'quotes', label: { en: 'Quotes', id: 'Kutipan' } },
          { value: 'video', label: { en: 'Quotes with video', id: 'Kutipan dengan video' } },
        ],
        'quotes',
      ),
      heading(''),
      {
        // The video look lays its cards out itself; only the plain quotes
        // read the arrangement.
        ...selectField(
          'layout',
          { en: 'Arrangement', id: 'Susunan' },
          [
            { value: 'grid', label: { en: 'Grid', id: 'Kisi' } },
            { value: 'marquee', label: { en: 'Running cards', id: 'Kartu berjalan' } },
            { value: 'carousel', label: { en: 'Slider', id: 'Slider (geser)' } },
            { value: 'list', label: { en: 'List', id: 'Daftar' } },
          ],
          'grid',
        ),
        showWhen: { key: 'variant', is: ['quotes'] },
      },
      {
        ...selectField(
          'direction',
          { en: 'Direction', id: 'Arah berjalan' },
          [
            { value: 'left', label: { en: 'Right to left', id: 'Kanan ke kiri' } },
            { value: 'right', label: { en: 'Left to right', id: 'Kiri ke kanan' } },
          ],
          'left',
        ),
        showWhen: [
          { key: 'variant', is: ['quotes'] },
          { key: 'layout', is: ['marquee'] },
        ],
      },
      {
        ...selectField(
          'speed',
          { en: 'Speed', id: 'Kecepatan' },
          [
            { value: 'slow', label: { en: 'Slow', id: 'Pelan' } },
            { value: 'normal', label: { en: 'Normal', id: 'Normal' } },
            { value: 'fast', label: { en: 'Fast', id: 'Cepat' } },
          ],
          'normal',
        ),
        showWhen: [
          { key: 'variant', is: ['quotes'] },
          { key: 'layout', is: ['marquee'] },
        ],
      },
      {
        ...toggleField('autoplay', { en: 'Slide automatically', id: 'Geser otomatis' }),
        showWhen: [
          { key: 'variant', is: ['quotes'] },
          { key: 'layout', is: ['carousel'] },
        ],
      },
      listField(
        'items',
        { en: 'Quotes', id: 'Kutipan' },
        { en: 'Quote', id: 'Kutipan' },
        'author',
        12,
        [
          // Each look reads its own fields off an item, so an item declares only
          // those. What the storefront actually reads is the map: `Testimonials`
          // takes quote/author/avatar/role and `VideoTestimonials` takes
          // quote/name/role/video/poster. Both read `quote`.
          areaField('quote', { en: 'Quote', id: 'Kutipan' }, 600, 3),
          {
            ...textField('author', { en: 'Name', id: 'Nama' }, 80),
            showWhen: { key: 'variant', is: ['quotes'] },
          },
          {
            ...imageField('avatar', { en: 'Photo', id: 'Foto' }),
            showWhen: { key: 'variant', is: ['quotes'] },
          },
          {
            ...photoFitField,
            showWhen: { key: 'variant', is: ['quotes'] },
          },
          {
            ...photoPositionField,
            showWhen: { key: 'variant', is: ['quotes'] },
          },
          {
            ...textField('name', { en: 'Name', id: 'Nama' }, 80),
            showWhen: { key: 'variant', is: ['video'] },
          },
          {
            ...textField('role', { en: 'Detail', id: 'Keterangan' }, 80),
            showWhen: { key: 'variant', is: ['quotes', 'video'] },
          },
          {
            ...videoField('video', { en: 'Video', id: 'Video' }),
            showWhen: { key: 'variant', is: ['video'] },
          },
          {
            ...imageField('poster', { en: 'Poster', id: 'Poster' }),
            showWhen: { key: 'variant', is: ['video'] },
          },
          {
            ...photoFitField,
            showWhen: { key: 'variant', is: ['video'] },
          },
          {
            ...photoPositionField,
            showWhen: { key: 'variant', is: ['video'] },
          },
        ],
      ),
      // Only the video look lays its cards out in a grid the seller chooses;
      // the quotes look fixes its own (three across).
      ...columns(3, 2, 1).map((field) => ({
        ...field,
        showWhen: { key: 'variant', is: ['video'] },
      })),
    ],
  },
  {
    type: 'cards',
    category: 'text',
    icon: 'columns',
    name: { en: 'Cards', id: 'Kartu' },
    description: {
      en: 'Side-by-side cards — image and text, the people behind the shop, or icons with short promises.',
      id: 'Kartu berdampingan — gambar dan teks, orang-orang di balik toko, atau ikon dengan janji singkat.',
    },
    fields: [
      selectField(
        'card',
        { en: 'Card type', id: 'Jenis kartu' },
        [
          { value: 'text', label: { en: 'Image and text', id: 'Gambar dan teks' } },
          { value: 'person', label: { en: 'Person', id: 'Orang' } },
          { value: 'icon', label: { en: 'Icon and text', id: 'Ikon dan teks' } },
        ],
        'text',
      ),
      heading(''),
      // Only the person look draws a body — `Team` renders it under its
      // heading. `Multicolumn` and `IconFeatures` carry their words per card.
      { ...body(500), showWhen: { key: 'card', is: ['person'] } },
      ...columns(3, 2, 1),
      {
        ...selectField(
          'imageRatio',
          { en: 'Image shape', id: 'Bentuk gambar' },
          [
            { value: '4/3', label: { en: 'Landscape', id: 'Mendatar' } },
            { value: '1/1', label: { en: 'Square', id: 'Persegi' } },
            { value: '3/4', label: { en: 'Portrait', id: 'Tegak' } },
          ],
          '4/3',
        ),
        showWhen: { key: 'card', is: ['text'] },
      },
      {
        ...selectField(
          'iconStyle',
          { en: 'Icon style', id: 'Gaya ikon' },
          [
            { value: 'circle', label: { en: 'In a circle', id: 'Dalam lingkaran' } },
            { value: 'plain', label: { en: 'Plain', id: 'Polos' } },
          ],
          'circle',
        ),
        showWhen: { key: 'card', is: ['icon'] },
      },
      { ...align, default: 'center' },
      listField('items', { en: 'Cards', id: 'Kartu' }, { en: 'Card', id: 'Kartu' }, 'title', 12, [
        // As with the quotes above, each card type reads its own fields off an
        // item — `Multicolumn` takes image/title/text/link, `Team` takes
        // photo/name/role/link, `IconFeatures` takes icon/title/text — so each
        // declares only its own rather than leaving all nine on screen.
        {
          kind: 'icon',
          key: 'icon',
          label: { en: 'Icon', id: 'Ikon' },
          default: 'truck',
          showWhen: { key: 'card', is: ['icon'] },
        },
        {
          ...imageField('image', { en: 'Image', id: 'Gambar' }),
          showWhen: { key: 'card', is: ['text'] },
        },
        {
          ...imageField('photo', { en: 'Photo', id: 'Foto' }),
          showWhen: { key: 'card', is: ['person'] },
        },
        {
          ...photoFitField,
          showWhen: { key: 'card', is: ['person'] },
        },
        {
          ...photoPositionField,
          showWhen: { key: 'card', is: ['person'] },
        },
        {
          ...textField('title', { en: 'Title', id: 'Judul' }, 80),
          showWhen: { key: 'card', is: ['text', 'icon'] },
        },
        {
          ...areaField('text', { en: 'Text', id: 'Teks' }, 400, 3),
          showWhen: { key: 'card', is: ['text', 'icon'] },
        },
        {
          ...textField('name', { en: 'Name', id: 'Nama' }, 80),
          showWhen: { key: 'card', is: ['person'] },
        },
        {
          ...textField('role', { en: 'Role', id: 'Peran' }, 80),
          showWhen: { key: 'card', is: ['person'] },
        },
        {
          ...textField('linkLabel', { en: 'Link text', id: 'Teks tautan' }, 40),
          showWhen: { key: 'card', is: ['text'] },
        },
        {
          ...linkField('link', { en: 'Link', id: 'Tautan' }),
          showWhen: { key: 'card', is: ['text', 'person'] },
        },
      ]),
    ],
  },
  {
    type: 'statement',
    category: 'media',
    icon: 'image-text',
    name: { en: 'Statement', id: 'Pernyataan' },
    description: {
      en: 'A photo with a message — a card beside the words, a full-width photo split half and half, or a photo behind giant type.',
      id: 'Foto dengan pesan — kartu di samping teks, foto selebar layar terbagi dua, atau foto di belakang tipografi besar.',
    },
    fields: [
      selectField(
        'layout',
        { en: 'Look', id: 'Tampilan' },
        [
          { value: 'contained', label: { en: 'Image and text', id: 'Gambar dan teks' } },
          { value: 'split', label: { en: 'Split screen', id: 'Layar terbagi' } },
          { value: 'full', label: { en: 'Full-bleed statement', id: 'Pernyataan penuh' } },
        ],
        'contained',
      ),
      imageField('image', { en: 'Photo', id: 'Foto' }),
      photoFitField,
      photoPositionField,
      {
        // The full-bleed statement puts the photo behind the words, so there
        // is no side to pick; the card and the split both sit it beside them.
        ...positionField('imagePosition', { en: 'Photo side', id: 'Sisi foto' }),
        showWhen: { key: 'layout', is: ['contained', 'split'] },
      },
      { ...overlay, showWhen: { key: 'layout', is: ['full'] } },
      {
        ...textField('eyebrow', { en: 'Eyebrow', id: 'Label kecil' }, 60, 'Our promise'),
        showWhen: { key: 'layout', is: ['full'] },
      },
      heading(''),
      body(900),
      buttonLabelText('Learn more'),
      buttonLink,
      {
        // Only the full-bleed statement centres or left-aligns its words; the
        // card and the split fix their own alignment.
        ...align,
        default: 'left',
        showWhen: { key: 'layout', is: ['full'] },
      },
      {
        ...selectField(
          'tone',
          { en: 'Panel', id: 'Panel' },
          [
            { value: 'page', label: { en: 'Page colours', id: 'Warna halaman' } },
            { value: 'subtle', label: { en: 'Soft', id: 'Lembut' } },
            { value: 'inverse', label: { en: 'Dark', id: 'Gelap' } },
            { value: 'brand', label: { en: 'Brand', id: 'Brand' } },
          ],
          'subtle',
        ),
        showWhen: { key: 'layout', is: ['split'] },
      },
      {
        ...selectField(
          'minHeight',
          { en: 'Height', id: 'Tinggi' },
          [
            { value: 'md', label: { en: 'Medium', id: 'Sedang' } },
            { value: 'lg', label: { en: 'Tall', id: 'Tinggi' } },
            { value: 'screen', label: { en: 'Full screen', id: 'Satu layar' } },
          ],
          'lg',
        ),
        showWhen: { key: 'layout', is: ['split'] },
      },
    ],
  },
  {
    type: 'story',
    category: 'text',
    icon: 'story',
    name: { en: 'Story', id: 'Cerita' },
    description: {
      en: 'Chapters of your story with a picture that changes, or milestones in order on a spine.',
      id: 'Bab-bab cerita Anda dengan gambar yang berganti, atau tonggak berurutan di satu garis.',
    },
    fields: [
      selectField(
        'style',
        { en: 'Style', id: 'Gaya' },
        [
          { value: 'chapters', label: { en: 'Scrolling chapters', id: 'Bab bergulir' } },
          { value: 'timeline', label: { en: 'Timeline', id: 'Linimasa' } },
        ],
        'chapters',
      ),
      heading(''),
      {
        ...positionField('imagePosition', { en: 'Image position', id: 'Posisi gambar' }),
        showWhen: { key: 'style', is: ['chapters'] },
      },
      listField(
        'items',
        { en: 'Steps', id: 'Langkah' },
        { en: 'Step', id: 'Langkah' },
        'heading',
        16,
        [
          // As with the quotes and cards above: a chapter reads image/heading/body
          // (`ScrollingStory`), a milestone reads image/label/title/text
          // (`Timeline`), so each style declares only its own.
          imageField('image', { en: 'Image', id: 'Gambar' }),
          photoFitField,
          photoPositionField,
          {
            ...textField('heading', { en: 'Heading', id: 'Judul' }, 100),
            showWhen: { key: 'style', is: ['chapters'] },
          },
          {
            ...body(1000),
            showWhen: { key: 'style', is: ['chapters'] },
          },
          {
            ...textField('label', { en: 'Year or date', id: 'Tahun atau tanggal' }, 30),
            showWhen: { key: 'style', is: ['timeline'] },
          },
          {
            ...textField('title', { en: 'Title', id: 'Judul' }, 100),
            showWhen: { key: 'style', is: ['timeline'] },
          },
          {
            ...areaField('text', { en: 'Text', id: 'Teks' }, 500, 3),
            showWhen: { key: 'style', is: ['timeline'] },
          },
        ],
      ),
    ],
  },

  /* --- Storefront features --- */

  {
    type: 'floating-contact',
    category: 'store',
    icon: 'chat',
    max: 1,
    floating: true,
    name: { en: 'Floating contact', id: 'Kontak mengambang' },
    description: {
      en: 'A WhatsApp and email button pinned to the corner, plus a back-to-top control.',
      id: 'Tombol WhatsApp dan email di sudut layar, plus tombol kembali ke atas.',
    },
    fields: [
      textField('whatsapp', { en: 'WhatsApp number', id: 'Nomor WhatsApp' }, 20, '', {
        en: 'Leave empty for no chat button.',
        id: 'Kosongkan tanpa tombol chat.',
      }),
      textField(
        'whatsappMessage',
        { en: 'Message typed for the shopper', id: 'Pesan yang sudah diketik' },
        200,
        'Hi! I have a question.',
      ),
      textField('email', { en: 'Email address', id: 'Alamat email' }, 120),
      toggleField('showTop', { en: 'Back to top', id: 'Kembali ke atas' }, true),
      selectField(
        'position',
        { en: 'Corner', id: 'Sudut' },
        [
          { value: 'right', label: { en: 'Bottom right', id: 'Kanan bawah' } },
          { value: 'left', label: { en: 'Bottom left', id: 'Kiri bawah' } },
        ],
        'right',
      ),
    ],
    defaultStyle: { paddingTop: 'none', paddingBottom: 'none' },
  },
  {
    type: 'spin-360',
    category: 'media',
    icon: 'spin',
    hidden: true,
    name: { en: '360° spin', id: 'Putaran 360°' },
    description: {
      en: 'A product turned frame by frame — drag to spin. Frames, not a 3D model.',
      id: 'Produk berputar bingkai demi bingkai — geser untuk memutar. Bingkai, bukan model 3D.',
    },
    fields: [
      heading(''),
      listField(
        'frames',
        { en: 'Frames', id: 'Bingkai' },
        { en: 'Frame', id: 'Bingkai' },
        'alt',
        36,
        [
          imageField('image', { en: 'Frame', id: 'Bingkai' }),
          textField('alt', { en: 'Description', id: 'Deskripsi' }, 120),
        ],
      ),
      toggleField(
        'autoSpin',
        { en: 'Turn slowly on its own', id: 'Berputar perlahan sendiri' },
        true,
        {
          en: 'Pauses while the shopper drags, then starts again.',
          id: 'Berhenti saat pengunjung menggeser, lalu mulai lagi.',
        },
      ),
      textField('caption', { en: 'Drag hint', id: 'Petunjuk geser' }, 120, 'Drag to spin', {
        en: 'Shown over the photo until the shopper drags it.',
        id: 'Ditampilkan di atas foto sampai pengunjung menggesernya.',
      }),
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
          photoFitField,
          photoPositionField,
        ],
      },
      slidesField(
        'perPage',
        { en: 'Slides on desktop', id: 'Slide di desktop' },
        BANNER_SLIDES_PER_VIEW,
        '2',
      ),
      slidesField(
        'perPageMobile',
        { en: 'Slides on phones', id: 'Slide di ponsel' },
        BANNER_SLIDES_PER_VIEW,
        '1',
      ),
      {
        kind: 'select',
        key: 'ratio',
        label: { en: 'Band shape (desktop)', id: 'Bentuk banner (desktop)' },
        help: {
          en: 'The slider’s height on desktop. Keep one ratio across the slides, with faces and text away from the edges.',
          id: 'Tinggi slider di desktop. Pakai satu rasio untuk semua slide, dengan wajah dan teks jauh dari tepi.',
        },
        options: BANNER_BAND_SHAPES,
        default: '16/5',
      },
      {
        kind: 'select',
        key: 'ratioMobile',
        label: { en: 'Band shape (phones)', id: 'Bentuk banner (ponsel)' },
        help: {
          en: 'The slider’s height on phones. A taller shape usually reads better on a small screen.',
          id: 'Tinggi slider di ponsel. Bentuk yang lebih tinggi biasanya lebih enak dibaca di layar kecil.',
        },
        options: BANNER_BAND_SHAPES,
        default: '16/5',
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
          { value: 'list', label: { en: 'List with preview', id: 'Daftar dengan pratinjau' } },
        ],
        default: 'tiles',
        help: {
          en: 'Bento shows each image as a background with the name on top, in tiles of mixed sizes. List writes each name large, one per row, and brings in its best sellers on hover.',
          id: 'Bento menampilkan gambar sebagai latar dengan nama di atasnya, dalam ubin beragam ukuran. Daftar menulis tiap nama besar, satu per baris, dan memunculkan produk terlarisnya saat disorot.',
        },
      },
      bentoText(),
      {
        kind: 'select',
        key: 'listSize',
        label: { en: 'Size', id: 'Ukuran' },
        options: [
          { value: 'sm', label: { en: 'Small', id: 'Kecil' } },
          { value: 'md', label: { en: 'Medium', id: 'Sedang' } },
          { value: 'lg', label: { en: 'Large', id: 'Besar' } },
        ],
        default: 'md',
        help: {
          en: 'How large each name is written, with its row and preview photos to match.',
          id: 'Seberapa besar tiap nama ditulis, beserta baris dan foto pratinjaunya.',
        },
        showWhen: { key: 'layout', is: ['list'] },
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
    type: 'rich-text',
    scopes: EVERYWHERE,
    category: 'text',
    icon: 'text',
    name: { en: 'Text', id: 'Teks' },
    description: { en: 'A heading and paragraphs.', id: 'Judul dan paragraf.' },
    fields: [heading('Our story'), body(), align, width],
  },
  {
    type: 'faq',
    scopes: EVERYWHERE,
    category: 'text',
    icon: 'help',
    name: { en: 'FAQ', id: 'Tanya jawab' },
    description: {
      en: 'Questions and answers that expand — with a choice of border, size and indicator icon.',
      id: 'Pertanyaan dan jawaban yang bisa dibuka — dengan pilihan garis, ukuran, dan ikon penanda.',
    },
    fields: [
      heading('Frequently asked questions'),
      {
        kind: 'select',
        key: 'variant',
        label: { en: 'Borders', id: 'Garis' },
        options: [
          { value: 'enclosed', label: { en: 'Boxed', id: 'Kotak' } },
          { value: 'outline', label: { en: 'Dividers', id: 'Garis pemisah' } },
          { value: 'plain', label: { en: 'None', id: 'Tanpa garis' } },
        ],
        default: 'enclosed',
      },
      {
        kind: 'select',
        key: 'size',
        label: { en: 'Size', id: 'Ukuran' },
        options: [
          { value: 'sm', label: { en: 'Small', id: 'Kecil' } },
          { value: 'md', label: { en: 'Medium', id: 'Sedang' } },
          { value: 'lg', label: { en: 'Large', id: 'Besar' } },
        ],
        default: 'md',
      },
      {
        kind: 'select',
        key: 'icon',
        label: { en: 'Indicator icon', id: 'Ikon penanda' },
        options: [
          { value: 'chevron', label: { en: 'Chevron', id: 'Chevron' } },
          { value: 'plus', label: { en: 'Plus / minus', id: 'Plus / minus' } },
        ],
        default: 'chevron',
      },
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
          {
            kind: 'product',
            key: 'productId',
            label: { en: 'Product in the video', id: 'Produk di video' },
          },
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
    type: 'scroll-rail',
    scopes: EVERYWHERE,
    category: 'media',
    icon: 'marquee',
    name: { en: 'Scroll rail', id: 'Rel gulir' },
    description: {
      en: 'A horizontal rail driven by vertical scrolling — any blocks, from product cards to a custom grid.',
      id: 'Rel horizontal yang bergerak saat halaman digulir — blok apa pun, dari kartu produk hingga kisi kustom.',
    },
    fields: [
      heading(''),
      {
        kind: 'select',
        key: 'content',
        label: { en: 'Content', id: 'Konten' },
        segment: true,
        options: [
          { value: 'cards', label: { en: 'Default cards', id: 'Kartu bawaan' } },
          { value: 'blocks', label: { en: 'Custom blocks', id: 'Blok kustom' } },
        ],
        default: 'cards',
      },
      {
        kind: 'blocks',
        key: 'blocks',
        label: { en: 'Blocks', id: 'Blok' },
        help: {
          en: 'Every block is one stop in the rail — an image, a card, a column, a grid or a whole row.',
          id: 'Setiap blok menjadi satu bagian di rel — gambar, kartu, kolom, kisi, atau satu baris utuh.',
        },
        max: 20,
        blocks: BLOCK_TYPES,
        styleFields: BLOCK_STYLE_FIELDS,
        showWhen: { key: 'content', is: ['blocks'] },
      },
      {
        kind: 'list',
        key: 'items',
        label: { en: 'Cards', id: 'Kartu' },
        itemLabel: { en: 'Card', id: 'Kartu' },
        titleKey: 'title',
        max: 10,
        showWhen: { key: 'content', is: ['cards'] },
        fields: [
          { kind: 'image', key: 'image', label: { en: 'Image', id: 'Gambar' } },
          photoFitField,
          photoPositionField,
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
            max: 200,
            default: '',
            rows: 2,
          },
          { kind: 'link', key: 'link', label: { en: 'Link', id: 'Tautan' } },
        ],
      },
      {
        kind: 'select',
        key: 'speed',
        label: { en: 'Scroll speed', id: 'Kecepatan gulir' },
        help: {
          en: 'How much page scrolling moves the rail. Slower gives the rail more room to travel.',
          id: 'Seberapa jauh halaman menggulir menggerakkan rel. Lebih pelan memberi rel ruang lebih.',
        },
        options: [
          { value: 'slow', label: { en: 'Slow', id: 'Pelan' } },
          { value: 'normal', label: { en: 'Normal', id: 'Normal' } },
          { value: 'fast', label: { en: 'Fast', id: 'Cepat' } },
        ],
        default: 'normal',
      },
      {
        kind: 'select',
        key: 'stopWidth',
        label: { en: 'Stop width', id: 'Lebar bagian' },
        help: {
          en: 'How wide each block sits in the rail. Large suits grids and cards; small suits images and chips.',
          id: 'Seberapa lebar setiap blok di rel. Besar cocok untuk kisi dan kartu; kecil untuk gambar dan label.',
        },
        options: [
          { value: 'sm', label: { en: 'Small', id: 'Kecil' } },
          { value: 'md', label: { en: 'Medium', id: 'Sedang' } },
          { value: 'lg', label: { en: 'Large', id: 'Besar' } },
        ],
        default: 'md',
      },
      {
        kind: 'select',
        key: 'height',
        label: { en: 'Height', id: 'Tinggi' },
        help: {
          en: 'How tall the pinned stage stands while the rail travels. Phones always use the natural height.',
          id: 'Seberapa tinggi panggung yang menempel saat rel bergerak. Ponsel selalu memakai tinggi alami.',
        },
        options: [
          { value: 'md', label: { en: 'Medium', id: 'Sedang' } },
          { value: 'lg', label: { en: 'Tall', id: 'Tinggi' } },
          { value: 'screen', label: { en: 'Full screen', id: 'Satu layar penuh' } },
        ],
        default: 'screen',
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
      en: 'Big words running across the page — a slogan, a promise, a promo — with images and products mixed in. Quickens as the shopper scrolls.',
      id: 'Kata-kata besar berjalan melintasi halaman — slogan, janji, atau promo — diselingi gambar dan produk. Melaju saat pembeli menggulir.',
    },
    defaultStyle: { width: 'edge' },
    usesCatalogue: true,
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
          {
            kind: 'image',
            key: 'image',
            label: { en: 'Image', id: 'Gambar' },
            help: {
              en: 'Optional chip shown beside the text.',
              id: 'Gambar kecil opsional di samping teks.',
            },
          },
          {
            kind: 'product',
            key: 'productId',
            label: { en: 'Product', id: 'Produk' },
            help: {
              en: 'Optional: shows this product instead of the text.',
              id: 'Opsional: menampilkan produk ini sebagai pengganti teks.',
            },
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
    type: 'pinned-scroll',
    category: 'text',
    icon: 'layers',
    hidden: true,
    name: { en: 'Pinned story', id: 'Cerita menempel' },
    description: {
      en: 'A full-screen stage pinned while scrolling through feature panels.',
      id: 'Panggung selayar penuh yang menempel saat menggulir panel fitur.',
    },
    fields: [
      heading(''),
      {
        kind: 'select',
        key: 'scrollLength',
        label: { en: 'Scroll length per panel', id: 'Panjang gulir per panel' },
        help: {
          en: 'How far each panel holds the stage: compact moves on quickly, roomy lingers.',
          id: 'Seberapa jauh setiap panel menahan panggung: ringkas cepat berlalu, lapang lebih lama.',
        },
        options: [
          { value: 'compact', label: { en: 'Compact', id: 'Ringkas' } },
          { value: 'comfortable', label: { en: 'Comfortable', id: 'Nyaman' } },
          { value: 'roomy', label: { en: 'Roomy', id: 'Lapang' } },
        ],
        default: 'comfortable',
      },
      {
        kind: 'list',
        key: 'panels',
        label: { en: 'Panels', id: 'Panel' },
        itemLabel: { en: 'Panel', id: 'Panel' },
        titleKey: 'heading',
        max: 6,
        fields: [
          heading(''),
          body(),
          { kind: 'image', key: 'image', label: { en: 'Image', id: 'Gambar' } },
          photoFitField,
          photoPositionField,
          buttonLabel,
          buttonLink,
          {
            kind: 'select',
            key: 'tone',
            label: { en: 'Panel style', id: 'Gaya panel' },
            options: [
              { value: 'page', label: { en: 'Page', id: 'Halaman' } },
              { value: 'dark', label: { en: 'Dark', id: 'Gelap' } },
              { value: 'brand', label: { en: 'Brand', id: 'Brand' } },
            ],
            default: 'page',
          },
        ],
      },
    ],
  },
  {
    type: 'stacked-cards',
    category: 'text',
    icon: 'stack',
    name: { en: 'Stacking cards', id: 'Kartu bertumpuk' },
    description: {
      en: 'Cards that pin and stack as the shopper scrolls, shrinking into the pile.',
      id: 'Kartu yang menempel dan bertumpuk saat pembeli menggulir.',
    },
    fields: [
      heading(''),
      align,
      {
        kind: 'select',
        key: 'content',
        label: { en: 'Content', id: 'Konten' },
        segment: true,
        options: [
          { value: 'cards', label: { en: 'Default cards', id: 'Kartu bawaan' } },
          { value: 'blocks', label: { en: 'Custom blocks', id: 'Blok kustom' } },
        ],
        default: 'cards',
      },
      {
        kind: 'blocks',
        key: 'blocks',
        label: { en: 'Blocks', id: 'Blok' },
        help: {
          en: 'Every block is one card in the pile — an image, a card, a column, a grid or a whole row.',
          id: 'Setiap blok menjadi satu kartu di tumpukan — gambar, kartu, kolom, kisi, atau satu baris utuh.',
        },
        max: 6,
        blocks: BLOCK_TYPES,
        styleFields: BLOCK_STYLE_FIELDS,
        showWhen: { key: 'content', is: ['blocks'] },
      },
      {
        kind: 'list',
        key: 'items',
        label: { en: 'Cards', id: 'Kartu' },
        itemLabel: { en: 'Card', id: 'Kartu' },
        titleKey: 'title',
        max: 6,
        showWhen: { key: 'content', is: ['cards'] },
        fields: [
          { kind: 'image', key: 'image', label: { en: 'Image', id: 'Gambar' } },
          photoFitField,
          photoPositionField,
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
            placeholder: {
              en: 'Leave empty to use code from voucher',
              id: 'Kosongkan untuk memakai kode dari voucher',
            },
            max: 40,
            default: '',
          },
          {
            kind: 'text',
            key: 'title',
            label: { en: 'Title override', id: 'Judul khusus' },
            placeholder: {
              en: 'e.g. 10% off your first order',
              id: 'mis. Diskon 10% pesanan pertama',
            },
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

  /* ---------------------------------------------------------------------- */
  /* Shop information                                                       */
  /* ---------------------------------------------------------------------- */

  {
    type: 'store-locations',
    category: 'store',
    icon: 'pin',
    name: { en: 'Store locations', id: 'Lokasi toko' },
    description: {
      en: 'Your physical stores — from the shop’s branches, or a list you type, with a map and directions.',
      id: 'Toko fisik Anda — dari cabang toko, atau daftar yang Anda tulis, dengan peta dan petunjuk arah.',
    },
    fields: [
      heading('Visit our stores'),
      {
        kind: 'select',
        key: 'layout',
        label: { en: 'Layout', id: 'Tampilan' },
        options: [
          { value: 'grid', label: { en: 'Cards', id: 'Kartu' } },
          {
            value: 'locator',
            label: { en: 'List and map', id: 'Daftar dan peta' },
          },
        ],
        default: 'grid',
        help: {
          en: 'List and map puts the stores on the left; picking one moves the map beside it.',
          id: 'Daftar dan peta menaruh toko di kiri; memilih satu menggerakkan peta di sampingnya.',
        },
      },
      {
        kind: 'boolean',
        key: 'showMap',
        label: { en: 'Show a map', id: 'Tampilkan peta' },
        help: {
          en: 'Ignored by the list-and-map layout, which always shows both. Needs store coordinates to draw pins.',
          id: 'Diabaikan oleh tampilan daftar-dan-peta yang selalu menampilkan keduanya. Perlu koordinat toko untuk menggambar pin.',
        },
        default: true,
        showWhen: { key: 'layout', is: ['grid'] },
      },
      {
        kind: 'list',
        key: 'items',
        label: { en: 'Stores', id: 'Toko' },
        help: {
          en: 'Used when the shop has no branches. Add branches in Settings to fill this automatically.',
          id: 'Dipakai bila toko belum punya cabang. Tambahkan cabang di Pengaturan agar terisi otomatis.',
        },
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
          {
            kind: 'coordinates',
            key: 'coordinates',
            label: { en: 'Coordinates', id: 'Koordinat' },
            help: {
              en: 'Optional, for the map pin. Right-click the store in Google Maps, copy the pair and paste it here.',
              id: 'Opsional, untuk pin di peta. Klik kanan tokonya di Google Maps, salin pasangannya, lalu tempel di sini.',
            },
            placeholder: { en: '-6.244, 106.799', id: '-6.244, 106.799' },
            default: null,
          },
        ],
      },
      // The list-and-map layout sizes its own two panes, so the column counts
      // only move the card grid.
      ...columns(3, 1, 1).map((field) => ({
        ...field,
        showWhen: { key: 'layout', is: ['grid'] },
      })),
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

  {
    type: 'order-tracking',
    scopes: EVERYWHERE,
    category: 'store',
    icon: 'bag',
    // Not offered in the Add-section picker: order tracking is its own screen
    // (`/track-order`, the `orderTracking` template). Kept in the library so the
    // template's section still renders and sanitises.
    hidden: true,
    // The form is the screen; a template cannot be left without it.
    required: true,
    name: { en: 'Order tracking', id: 'Lacak pesanan' },
    description: {
      en: 'A form that looks an order up by its number and phone, then opens it.',
      id: 'Formulir untuk mencari pesanan lewat nomor dan nomor telepon, lalu membukanya.',
    },
    fields: [
      heading('Track your order'),
      subheading('Enter your order number and the phone you used, and we will take you to it.'),
      {
        kind: 'text',
        key: 'orderNumberLabel',
        label: { en: 'Order number label', id: 'Label nomor pesanan' },
        max: 40,
        default: 'Order number',
      },
      {
        kind: 'text',
        key: 'phoneLabel',
        label: { en: 'Phone label', id: 'Label nomor telepon' },
        max: 40,
        default: 'WhatsApp / phone number',
      },
      {
        kind: 'text',
        key: 'submitLabel',
        label: { en: 'Button label', id: 'Teks tombol' },
        max: 40,
        default: 'Track order',
      },
      {
        kind: 'text',
        key: 'notFoundMessage',
        label: { en: 'Not-found message', id: 'Pesan tidak ditemukan' },
        max: 160,
        default: 'We could not find that order. Check the number and the phone number.',
      },
      { ...align, default: 'left' },
    ],
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
      en: 'The first product photo, name, price and the buy buttons. Arrange what shows beside the photo with blocks.',
      id: 'Foto produk pertama, nama, harga, dan tombol beli. Atur isi di samping foto dengan blok.',
    },
    scopes: PRODUCT_ONLY,
    max: 1,
    required: true,
    usesCatalogue: true,
    fields: [
      {
        kind: 'boolean',
        key: 'stickyInfo',
        label: { en: 'Keep details in view', id: 'Detail tetap terlihat' },
        help: {
          en: 'On a desktop, the details stay on screen while the page scrolls.',
          id: 'Di desktop, detail tetap di layar saat halaman digulir.',
        },
        default: true,
      },
      {
        kind: 'boolean',
        key: 'zoom',
        label: { en: 'Zoom photo on hover', id: 'Perbesar foto saat disorot' },
        // Off unless a theme asks for it: a photo that grows under the pointer
        // is a deliberate look, not the look the photo starts with.
        default: false,
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
        defaultBlocks: [
          'title',
          'rating',
          'price',
          'purchase',
          'size-guide',
          'badges',
          'description',
        ],
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
    fields: [
      heading('You may also like'),
      productLayout(),
      bentoText(),
      limit(4, 12),
      // The grid's whole columns and the slider's own per-view; an older row
      // carries the grid's pair alone, and each slider setting inherits it.
      ...columns(4, 2, 2).map((field) => ({
        ...field,
        showWhen: { key: 'layout', is: ['grid'] },
      })),
      {
        ...slidesField(
          'perPage',
          { en: 'Slides on desktop', id: 'Slide di desktop' },
          SLIDES_PER_VIEW,
          '4',
        ),
        showWhen: { key: 'layout', is: ['slider'] },
      },
      {
        ...slidesField(
          'perPageMobile',
          { en: 'Slides on phones', id: 'Slide di ponsel' },
          SLIDES_PER_VIEW_MOBILE,
          '2',
        ),
        showWhen: { key: 'layout', is: ['slider'] },
      },
    ],
  },

  /* ---------------------------------------------------------------------- */
  /* Article page — the theme's frame around every article's own body       */
  /* ---------------------------------------------------------------------- */

  {
    type: 'article-header',
    category: 'article-page',
    icon: 'article',
    name: { en: 'Article header', id: 'Kepala artikel' },
    description: {
      en: "The article's cover, title, date, author, reading time and tags.",
      id: 'Sampul, judul, tanggal, penulis, waktu baca, dan tag artikel.',
    },
    scopes: ARTICLE_ONLY,
    max: 1,
    required: true,
    fields: [
      {
        kind: 'select',
        key: 'coverPosition',
        label: { en: 'Cover image', id: 'Gambar sampul' },
        options: [
          { value: 'below', label: { en: 'Below the title', id: 'Di bawah judul' } },
          { value: 'above', label: { en: 'Above the title', id: 'Di atas judul' } },
          { value: 'none', label: { en: 'Hidden', id: 'Disembunyikan' } },
        ],
        default: 'below',
      },
      {
        kind: 'select',
        key: 'metaPosition',
        label: { en: 'Date and author', id: 'Tanggal dan penulis' },
        options: [
          { value: 'below', label: { en: 'Below the title', id: 'Di bawah judul' } },
          { value: 'above', label: { en: 'Above the title', id: 'Di atas judul' } },
        ],
        default: 'below',
      },
      { ...align, default: 'center' },
      {
        kind: 'boolean',
        key: 'showBlog',
        label: { en: 'Show the blog name', id: 'Tampilkan nama blog' },
        help: {
          en: 'A link back to the blog, e.g. "News".',
          id: 'Tautan kembali ke blog, mis. "Berita".',
        },
        default: true,
      },
      {
        kind: 'boolean',
        key: 'showDate',
        label: { en: 'Show the date', id: 'Tampilkan tanggal' },
        default: true,
      },
      {
        kind: 'boolean',
        key: 'showAuthor',
        label: { en: 'Show the author', id: 'Tampilkan penulis' },
        default: true,
      },
      {
        kind: 'boolean',
        key: 'showReadingTime',
        label: { en: 'Show the reading time', id: 'Tampilkan waktu baca' },
        default: true,
      },
      {
        kind: 'boolean',
        key: 'showTags',
        label: { en: 'Show the tags', id: 'Tampilkan tag' },
        default: true,
      },
    ],
  },
  {
    type: 'article-content',
    category: 'article-page',
    icon: 'text',
    name: { en: 'Article content', id: 'Isi artikel' },
    description: {
      en: 'Where each article’s own text, photos and videos go. Written in the article editor.',
      id: 'Tempat teks, foto, dan video tiap artikel. Ditulis di editor artikel.',
    },
    scopes: ARTICLE_ONLY,
    max: 1,
    required: true,
    fields: [
      {
        ...width,
        help: {
          en: 'A narrow column is easier to read for long text.',
          id: 'Kolom sempit lebih nyaman untuk teks panjang.',
        },
      },
    ],
  },
  {
    type: 'article-share',
    category: 'article-page',
    icon: 'share',
    name: { en: 'Share buttons', id: 'Tombol bagikan' },
    description: {
      en: 'Let readers copy the link or send the article on WhatsApp.',
      id: 'Pembaca bisa menyalin tautan atau mengirim artikel lewat WhatsApp.',
    },
    scopes: ARTICLE_ONLY,
    max: 1,
    fields: [
      {
        kind: 'text',
        key: 'label',
        label: { en: 'Label', id: 'Label' },
        max: 60,
        default: 'Share this article',
      },
      { ...align, default: 'center' },
    ],
  },
  {
    type: 'article-pagination',
    category: 'article-page',
    icon: 'arrows',
    name: { en: 'Previous and next', id: 'Sebelumnya dan berikutnya' },
    description: {
      en: 'Links to the article before and after this one in the same blog.',
      id: 'Tautan ke artikel sebelum dan sesudah ini di blog yang sama.',
    },
    scopes: ARTICLE_ONLY,
    max: 1,
    fields: [
      {
        kind: 'text',
        key: 'previousLabel',
        label: { en: 'Previous label', id: 'Label sebelumnya' },
        max: 40,
        default: 'Previous article',
      },
      {
        kind: 'text',
        key: 'nextLabel',
        label: { en: 'Next label', id: 'Label berikutnya' },
        max: 40,
        default: 'Next article',
      },
    ],
  },
  {
    type: 'related-articles',
    category: 'article-page',
    icon: 'shelves',
    name: { en: 'Related articles', id: 'Artikel terkait' },
    description: {
      en: 'More to read from your blogs — same tags first, then the same blog, then the newest.',
      id: 'Bacaan lain dari blog Anda — tag yang sama lebih dulu, lalu blog yang sama, lalu yang terbaru.',
    },
    scopes: ARTICLE_ONLY,
    max: 1,
    fields: [
      heading('More articles'),
      {
        kind: 'number',
        key: 'limit',
        label: { en: 'Articles to show', id: 'Jumlah artikel' },
        min: 1,
        max: MAX_RELATED_ARTICLES,
        default: 3,
      },
    ],
  },

  /* ---------------------------------------------------------------------- */
  /* Catalogue page — the product catalogue and the category/collection      */
  /* listings that share it                                                  */
  /* ---------------------------------------------------------------------- */

  {
    type: 'catalog-header',
    category: 'catalog-page',
    icon: 'tag',
    name: { en: 'Catalogue header', id: 'Kepala katalog' },
    description: {
      en: 'The listing title, its description, the result count and the category filter.',
      id: 'Judul daftar, deskripsi, jumlah hasil, dan filter kategori.',
    },
    scopes: CATALOG_ONLY,
    max: 1,
    required: true,
    usesCatalogue: true,
    fields: [
      {
        kind: 'boolean',
        key: 'breadcrumbs',
        label: { en: 'Show the path (Shop › Catalogue)', id: 'Tampilkan jalur (Toko › Katalog)' },
        default: true,
      },
      {
        kind: 'boolean',
        key: 'showTitle',
        label: { en: 'Show the title', id: 'Tampilkan judul' },
        default: true,
      },
      {
        kind: 'boolean',
        key: 'showDescription',
        label: { en: 'Show the description', id: 'Tampilkan deskripsi' },
        default: true,
      },
      {
        kind: 'text',
        key: 'description',
        label: { en: 'All-products description', id: 'Deskripsi semua produk' },
        help: {
          en: 'Shown on the all-products page. A category or collection page shows its own description instead.',
          id: 'Tampil di halaman semua produk. Halaman kategori atau koleksi memakai deskripsinya sendiri.',
        },
        max: 240,
        default: '',
        showWhen: { key: 'showDescription', is: ['true'] },
      },
      {
        kind: 'boolean',
        key: 'showCount',
        label: { en: 'Show the result count', id: 'Tampilkan jumlah hasil' },
        default: false,
      },
      {
        kind: 'boolean',
        key: 'showFilters',
        label: { en: 'Show the category filter', id: 'Tampilkan filter kategori' },
        default: true,
      },
      {
        kind: 'select',
        key: 'filterStyle',
        label: { en: 'Filter style', id: 'Gaya filter' },
        options: [
          { value: 'chips', label: { en: 'Pill chips', id: 'Chip pil' } },
          { value: 'underline', label: { en: 'Underline tabs', id: 'Tab garis bawah' } },
          { value: 'select', label: { en: 'Dropdown', id: 'Menu turun' } },
        ],
        default: 'underline',
        showWhen: { key: 'showFilters', is: ['true'] },
      },
      {
        kind: 'select',
        key: 'filterSticky',
        label: { en: 'Keep the filter on screen', id: 'Filter tetap di layar' },
        help: {
          en: 'Sticky holds the filter row under the header while the products scroll. On phones only is the app-like choice; always also pins it on a computer.',
          id: 'Menempel menahan baris filter di bawah header saat produk bergulir. Hanya di ponsel cocok untuk gaya aplikasi; selalu juga menempel di komputer.',
        },
        options: [
          { value: 'none', label: { en: 'Never', id: 'Tidak pernah' } },
          { value: 'mobile', label: { en: 'On phones only', id: 'Hanya di ponsel' } },
          { value: 'always', label: { en: 'Always', id: 'Selalu' } },
        ],
        default: 'none',
        showWhen: { key: 'showFilters', is: ['true'] },
      },
      align,
    ],
  },
  {
    type: 'catalog-products',
    category: 'catalog-page',
    icon: 'grid',
    name: { en: 'Product grid', id: 'Kisi produk' },
    description: {
      en: 'The listing itself, with its card columns and pagination.',
      id: 'Daftar produknya, lengkap dengan kolom kartu dan paginasi.',
    },
    scopes: CATALOG_ONLY,
    max: 1,
    required: true,
    usesCatalogue: true,
    fields: [
      {
        kind: 'select',
        key: 'columns',
        label: { en: 'Columns on desktop', id: 'Kolom di desktop' },
        options: [2, 3, 4, 5, 6].map((n) => ({
          value: String(n),
          label: { en: String(n), id: String(n) },
        })),
        default: '4',
      },
      {
        kind: 'select',
        key: 'tabletColumns',
        label: { en: 'Columns on tablets', id: 'Kolom di tablet' },
        options: [2, 3, 4].map((n) => ({
          value: String(n),
          label: { en: String(n), id: String(n) },
        })),
        default: '3',
      },
      {
        kind: 'select',
        key: 'mobileColumns',
        label: { en: 'Columns on phones', id: 'Kolom di ponsel' },
        options: [1, 2].map((n) => ({
          value: String(n),
          label: { en: String(n), id: String(n) },
        })),
        default: '2',
      },
      {
        kind: 'select',
        key: 'gap',
        label: { en: 'Space between cards', id: 'Jarak antar kartu' },
        options: [
          { value: 'tight', label: { en: 'Tight', id: 'Rapat' } },
          { value: 'cozy', label: { en: 'Cozy', id: 'Nyaman' } },
          { value: 'airy', label: { en: 'Airy', id: 'Longgar' } },
        ],
        default: 'cozy',
      },
      {
        kind: 'select',
        key: 'pagination',
        label: { en: 'Pagination', id: 'Paginasi' },
        options: [
          { value: 'numbers', label: { en: 'Page numbers', id: 'Nomor halaman' } },
          { value: 'simple', label: { en: 'Previous / Next', id: 'Sebelumnya / Berikutnya' } },
          { value: 'compact', label: { en: 'Compact (2 / 5)', id: 'Ringkas (2 / 5)' } },
          { value: 'none', label: { en: 'None', id: 'Tanpa' } },
        ],
        default: 'numbers',
      },
      {
        kind: 'select',
        key: 'paginationAlign',
        label: { en: 'Pagination alignment', id: 'Perataan paginasi' },
        options: [
          { value: 'start', label: { en: 'Left', id: 'Kiri' } },
          { value: 'center', label: { en: 'Center', id: 'Tengah' } },
          { value: 'end', label: { en: 'Right', id: 'Kanan' } },
        ],
        default: 'center',
        showWhen: { key: 'pagination', is: ['numbers', 'simple', 'compact'] },
      },
    ],
  },
] as const satisfies readonly SectionSchema[]

export type SectionType = (typeof SECTION_SCHEMAS)[number]['type']

const BY_TYPE = new Map<string, SectionSchema>(
  SECTION_SCHEMAS.map((schema) => [schema.type, schema]),
)

export function sectionSchema(type: string): SectionSchema | null {
  return BY_TYPE.get(type) ?? null
}

/** Whether `type` paints outside the page flow — see `SectionSchema.floating`. */
export function isFloatingSection(type: string): boolean {
  return BY_TYPE.get(type)?.floating === true
}

export function isSectionType(type: unknown): type is SectionType {
  return typeof type === 'string' && BY_TYPE.has(type)
}
