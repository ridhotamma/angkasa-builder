/**
 * Consolidated sections — one type per family, a `variant`/`layout` field
 * choosing the look, instead of a parallel catalogue entry for every sibling.
 *
 * The palette used to offer near-duplicates as their own cards (four banners,
 * six product lists, three galleries, three quote walls, three card grids,
 * three statements, two stories). Each family is now a single type whose
 * fields are the union of the family's fields; the renderer for the type
 * dispatches on the variant to the same component that used to back the
 * standalone section (see `../render/consolidated-sections`).
 *
 * The old type names still exist (hidden, in `sections.ts`) so every stored
 * layout keeps rendering, and `normalizeSection` below rewrites them to the
 * consolidated type plus its variant when a layout is parsed — so an old page
 * converges on the new catalogue the next time it is saved.
 *
 * Pure data, like every other section: renderers live in `../render`, the same
 * field engine sanitises it, the same `SectionFrame` draws it.
 */

import type {
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
import type { Localized } from './localized'
import {
  photoFitField,
  photoPositionField,
  slidesField,
  SLIDES_PER_VIEW,
  SLIDES_PER_VIEW_MOBILE,
} from './section-style'
import type { SectionScope, SectionSchema } from './sections'

/* -------------------------------------------------------------------------- */
/* Field builders                                                             */
/* -------------------------------------------------------------------------- */

const text = (
  key: string,
  label: Localized,
  max: number,
  fallback = '',
  help?: Localized,
): TextField => ({ kind: 'text', key, label, max, default: fallback, ...(help ? { help } : {}) })

const area = (key: string, label: Localized, max: number, rows = 4): TextareaField => ({
  kind: 'textarea',
  key,
  label,
  max,
  default: '',
  rows,
})

const body = (max = 1200): RichTextField => ({
  kind: 'richtext',
  key: 'body',
  label: { en: 'Text', id: 'Teks' },
  max,
  default: '',
})

const image = (key: string, label: Localized, help?: Localized): ImageField => ({
  kind: 'image',
  key,
  label,
  ...(help ? { help } : {}),
})

const video = (key: string, label: Localized, uploadOnly = false): VideoField => ({
  kind: 'video',
  key,
  label,
  ...(uploadOnly ? { uploadOnly: true } : {}),
})

const link = (key: string, label: Localized): LinkField => ({ kind: 'link', key, label })

const choice = (
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

const toggle = (
  key: string,
  label: Localized,
  fallback = false,
  help?: Localized,
): BooleanField => ({
  kind: 'boolean',
  key,
  label,
  default: fallback,
  ...(help ? { help } : {}),
})

const numberField = (
  key: string,
  label: Localized,
  fallback: number,
  min = 2,
  max = 24,
): Field => ({ kind: 'number', key, label, min, max, default: fallback })

const list = (
  key: string,
  label: Localized,
  itemLabel: Localized,
  titleKey: string,
  max: number,
  fields: readonly ItemField[],
): ListField => ({ kind: 'list', key, label, itemLabel, titleKey, max, fields })

const heading = (fallback = ''): TextField =>
  text('heading', { en: 'Heading', id: 'Judul' }, 160, fallback)
const subheading = (fallback = ''): TextField =>
  text('subheading', { en: 'Subheading', id: 'Subjudul' }, 200, fallback)
const buttonLabel = (fallback = 'Learn more'): TextField =>
  text('buttonLabel', { en: 'Button label', id: 'Label tombol' }, 40, fallback)
const buttonLink: Field = link('buttonLink', { en: 'Button link', id: 'Tautan tombol' })

const alignField = (fallback: 'left' | 'center' = 'center'): Field =>
  choice(
    'align',
    { en: 'Alignment', id: 'Perataan' },
    [
      { value: 'left', label: { en: 'Left', id: 'Kiri' } },
      { value: 'center', label: { en: 'Center', id: 'Tengah' } },
    ],
    fallback,
  )

const columnsField = (values: readonly string[], fallback: string, mobile = '1'): Field[] => [
  choice(
    'columns',
    { en: 'Columns on desktop', id: 'Kolom di desktop' },
    values.map((value) => ({ value, label: { en: value, id: value } })),
    fallback,
  ),
  choice(
    'mobileColumns',
    { en: 'Columns on phones', id: 'Kolom di ponsel' },
    [1, 2].map((n) => ({ value: String(n), label: { en: String(n), id: String(n) } })),
    mobile,
  ),
]

const overlayField: Field = choice(
  'overlay',
  { en: 'Shade', id: 'Peredup' },
  [
    { value: 'gradient', label: { en: 'Fade from the bottom', id: 'Memudar dari bawah' } },
    { value: 'dark', label: { en: 'Dark', id: 'Gelap' } },
    { value: 'light', label: { en: 'Light', id: 'Tipis' } },
    { value: 'none', label: { en: 'None', id: 'Tanpa bayangan' } },
  ],
  'gradient',
)

const positionField = (key: string, label: Localized, fallback = 'left'): Field =>
  choice(
    key,
    label,
    [
      { value: 'left', label: { en: 'Left', id: 'Kiri' } },
      { value: 'right', label: { en: 'Right', id: 'Kanan' } },
    ],
    fallback,
  )

/** The product-card arrangement: grid, slider or bento — one control everywhere. */
const productLayoutField: Field = choice(
  'layout',
  { en: 'Layout', id: 'Tampilan' },
  [
    { value: 'grid', label: { en: 'Grid', id: 'Kisi' } },
    { value: 'slider', label: { en: 'Slider', id: 'Slider (geser)' } },
    { value: 'bento', label: { en: 'Bento grid', id: 'Kisi bento' } },
  ],
  'grid',
)

const bentoTextField: Field = {
  ...choice(
    'bentoText',
    { en: 'Text on tiles', id: 'Teks di ubin' },
    [
      { value: 'always', label: { en: 'Always', id: 'Selalu' } },
      { value: 'hover', label: { en: 'On hover', id: 'Saat disorot' } },
    ],
    'always',
  ),
  // Only the bento tiles hide their text until hover; the grid and the slider
  // always show the card's own copy.
  showWhen: { key: 'layout', is: ['bento'] },
}

/* -------------------------------------------------------------------------- */
/* Variant maps — the value a consolidated type stores, and the old types it  */
/* replaces. The editor normaliser reads these.                               */
/* -------------------------------------------------------------------------- */

export interface ConsolidatedVariant {
  /** The consolidated section type. */
  type: string
  /** The field on it that selects this look, and the value to store. Omitted for a plain rename. */
  field?: string
  value?: string
  /** Settings keys to rename when the two types named the same thing differently. */
  move?: Record<string, string>
}

/** Old type name → the consolidated type and variant it becomes. */
export const SECTION_ALIASES: Readonly<Record<string, ConsolidatedVariant>> = {
  hero: { type: 'banner', field: 'media', value: 'image' },
  'video-hero': { type: 'banner', field: 'media', value: 'video' },
  'parallax-banner': { type: 'banner', field: 'media', value: 'parallax' },
  'background-video': { type: 'banner', field: 'media', value: 'background' },

  'featured-collection': { type: 'product-list', field: 'source', value: 'collection' },
  'collection-shelves': { type: 'product-list', field: 'source', value: 'shelves' },
  'latest-products': { type: 'product-list', field: 'source', value: 'latest' },
  'collection-tabs': { type: 'product-list', field: 'source', value: 'tabs' },

  'image-gallery': { type: 'gallery', field: 'layout', value: 'grid' },
  'masonry-gallery': { type: 'gallery', field: 'layout', value: 'masonry' },
  'social-wall': { type: 'gallery', field: 'layout', value: 'social' },

  testimonials: { type: 'quotes', field: 'variant', value: 'quotes' },
  'video-testimonials': { type: 'quotes', field: 'variant', value: 'video' },

  multicolumn: { type: 'cards', field: 'card', value: 'text' },
  team: { type: 'cards', field: 'card', value: 'person' },
  'icon-features': { type: 'cards', field: 'card', value: 'icon' },

  'image-with-text': { type: 'statement', field: 'layout', value: 'contained' },
  'split-screen': { type: 'statement', field: 'layout', value: 'split' },
  'editorial-statement': { type: 'statement', field: 'layout', value: 'full' },

  // `scrolling-story` called its list `steps`; the consolidated type calls it `items`.
  'scrolling-story': { type: 'story', field: 'style', value: 'chapters', move: { steps: 'items' } },
  timeline: { type: 'story', field: 'style', value: 'timeline' },

  // Two names for one composer: the editor used `custom`, templates used
  // `blocks`; `blocks` is the one now, with the ready-made presets.
  custom: { type: 'blocks' },
}

/** Whether `type` is an old family member that a consolidated type replaces. */
export function consolidatedAlias(type: string): ConsolidatedVariant | null {
  return SECTION_ALIASES[type] ?? null
}

/**
 * The settings a consolidated section starts with when migrating from `alias`:
 * the old settings, with any renamed keys moved and the variant field set.
 */
export function consolidateSettings(
  alias: ConsolidatedVariant,
  rawSettings: unknown,
): Record<string, unknown> {
  const out: Record<string, unknown> =
    rawSettings !== null && typeof rawSettings === 'object' && !Array.isArray(rawSettings)
      ? { ...(rawSettings as Record<string, unknown>) }
      : {}
  for (const [from, to] of Object.entries(alias.move ?? {})) {
    if (from in out) {
      out[to] = out[from]
      delete out[from]
    }
  }
  if (alias.field !== undefined && alias.value !== undefined) out[alias.field] = alias.value
  return out
}

/* -------------------------------------------------------------------------- */
/* The consolidated schemas                                                   */
/* -------------------------------------------------------------------------- */

const BANNERS: Localized = { en: 'Banners and heroes', id: 'Banner dan sampul' }
const PRODUCTS: Localized = { en: 'Products and collections', id: 'Produk dan koleksi' }
const MEDIA: Localized = { en: 'Images and video', id: 'Gambar dan video' }
const TEXT: Localized = { en: 'Text and storytelling', id: 'Teks dan cerita' }

export const CONSOLIDATED_SECTION_SCHEMAS = [
  {
    type: 'banner',
    category: 'banners',
    icon: 'image',
    name: { en: 'Banner', id: 'Banner' },
    description: {
      en: 'A headline and buttons over an image, a video, a looping background or a parallax photo.',
      id: 'Judul dan tombol di atas gambar, video, latar berulang, atau foto paralaks.',
    },
    defaultStyle: { width: 'edge', paddingTop: 'none', paddingBottom: 'none' },
    fields: [
      choice(
        'media',
        { en: 'Background', id: 'Latar' },
        [
          { value: 'image', label: { en: 'Image', id: 'Gambar' } },
          { value: 'video', label: { en: 'Video', id: 'Video' } },
          { value: 'background', label: { en: 'Looping video', id: 'Video berulang' } },
          { value: 'parallax', label: { en: 'Parallax photo', id: 'Foto paralaks' } },
        ],
        'image',
      ),
      {
        ...image('image', { en: 'Image', id: 'Gambar' }),
        showWhen: { key: 'media', is: ['image', 'parallax'] },
      },
      {
        ...toggle('useShopBanner', { en: "Use the shop's banner", id: 'Pakai banner toko' }, true),
        showWhen: { key: 'media', is: ['image'] },
      },
      {
        ...video('video', { en: 'Video', id: 'Video' }, true),
        showWhen: { key: 'media', is: ['video', 'background'] },
      },
      {
        ...image('poster', { en: 'Cover image', id: 'Gambar sampul' }),
        showWhen: { key: 'media', is: ['video', 'background'] },
      },
      {
        ...photoFitField,
        showWhen: { key: 'media', is: ['image', 'video', 'background', 'parallax'] },
      },
      {
        ...photoPositionField,
        showWhen: { key: 'media', is: ['image', 'video', 'background', 'parallax'] },
      },
      heading(''),
      subheading(''),
      buttonLabel('Shop now'),
      buttonLink,
      text('secondaryButtonLabel', { en: 'Second button label', id: 'Teks tombol kedua' }, 40),
      link('secondaryButtonLink', { en: 'Second button link', id: 'Tautan tombol kedua' }),
      { ...alignField('left') },
      {
        ...choice(
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
      choice(
        'height',
        { en: 'Height', id: 'Tinggi' },
        [
          { value: 'sm', label: { en: 'Short', id: 'Pendek' } },
          { value: 'md', label: { en: 'Medium', id: 'Sedang' } },
          { value: 'lg', label: { en: 'Tall', id: 'Tinggi' } },
          { value: 'screen', label: { en: 'Full screen', id: 'Satu layar' } },
        ],
        'md',
      ),
      overlayField,
      {
        ...choice(
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
      { ...body(600), showWhen: { key: 'media', is: ['background'] } },
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
      choice(
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
      productLayoutField,
      bentoTextField,
      numberField('limit', { en: 'Products to show', id: 'Jumlah produk' }, 8),
      // The grid's whole columns and the slider's own per-view: the first
      // only moves the grid, the second — whole or fractional, a card peeking
      // at the edge — only the row. An older row carries the grid's pair
      // alone, and each slider setting inherits it (see `legacyKey`).
      ...columnsField(['2', '3', '4', '5', '6'], '4', '2').map((field) => ({
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
        legacyKey: 'columns',
      },
      {
        ...slidesField(
          'perPageMobile',
          { en: 'Slides on phones', id: 'Slide di ponsel' },
          SLIDES_PER_VIEW_MOBILE,
          '2',
        ),
        showWhen: { key: 'layout', is: ['slider'] },
        legacyKey: 'mobileColumns',
      },
      {
        // Only the newest list ends with a link to the whole catalogue; the
        // collection looks always carry their own "See all" in the header.
        ...toggle('showAll', { en: 'Link to all products', id: 'Tautan ke semua produk' }, true),
        showWhen: { key: 'source', is: ['latest'] },
      },
      {
        ...list('tabs', { en: 'Tabs', id: 'Tab' }, { en: 'Tab', id: 'Tab' }, 'label', 6, [
          { kind: 'collection', key: 'collectionId', label: { en: 'Collection', id: 'Koleksi' } },
          text('label', { en: 'Tab name', id: 'Nama tab' }, 40),
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
      choice(
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
        ...text('handle', { en: 'Handle', id: 'Nama akun' }, 60, '@yourshop'),
        showWhen: { key: 'layout', is: ['social'] },
      },
      list('items', { en: 'Photos', id: 'Foto' }, { en: 'Photo', id: 'Foto' }, 'caption', 30, [
        // Each look reads its own fields off an item: `ImageGallery` and
        // `SocialWall` take caption and link, `MasonryGallery` takes the alt
        // text (its tiles have no room for a caption) and a link.
        image('image', { en: 'Photo', id: 'Foto' }),
        photoFitField,
        photoPositionField,
        {
          ...text('caption', { en: 'Caption', id: 'Keterangan' }, 160),
          showWhen: { key: 'layout', is: ['grid', 'social'] },
        },
        {
          ...text('alt', { en: 'Description', id: 'Deskripsi' }, 160),
          showWhen: { key: 'layout', is: ['masonry'] },
        },
        link('link', { en: 'Link (optional)', id: 'Tautan (opsional)' }),
      ]),
      ...columnsField(['2', '3', '4', '5', '6'], '3', '2'),
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
      choice(
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
        ...choice(
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
        ...choice(
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
        ...choice(
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
        ...toggle('autoplay', { en: 'Slide automatically', id: 'Geser otomatis' }),
        showWhen: [
          { key: 'variant', is: ['quotes'] },
          { key: 'layout', is: ['carousel'] },
        ],
      },
      list('items', { en: 'Quotes', id: 'Kutipan' }, { en: 'Quote', id: 'Kutipan' }, 'author', 12, [
        // Each look reads its own fields off an item, so an item declares only
        // those. What the storefront actually reads is the map: `Testimonials`
        // takes quote/author/avatar/role and `VideoTestimonials` takes
        // quote/name/role/video/poster. Both read `quote`.
        area('quote', { en: 'Quote', id: 'Kutipan' }, 600, 3),
        {
          ...text('author', { en: 'Name', id: 'Nama' }, 80),
          showWhen: { key: 'variant', is: ['quotes'] },
        },
        {
          ...image('avatar', { en: 'Photo', id: 'Foto' }),
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
          ...text('name', { en: 'Name', id: 'Nama' }, 80),
          showWhen: { key: 'variant', is: ['video'] },
        },
        {
          ...text('role', { en: 'Detail', id: 'Keterangan' }, 80),
          showWhen: { key: 'variant', is: ['quotes', 'video'] },
        },
        {
          ...video('video', { en: 'Video', id: 'Video' }),
          showWhen: { key: 'variant', is: ['video'] },
        },
        {
          ...image('poster', { en: 'Poster', id: 'Poster' }),
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
      ]),
      // Only the video look lays its cards out in a grid the seller chooses;
      // the quotes look fixes its own (three across).
      ...columnsField(['2', '3', '4'], '3').map((field) => ({
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
      choice(
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
      ...columnsField(['2', '3', '4', '5', '6'], '3'),
      {
        ...choice(
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
        ...choice(
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
      { ...alignField('center') },
      list('items', { en: 'Cards', id: 'Kartu' }, { en: 'Card', id: 'Kartu' }, 'title', 12, [
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
          ...image('image', { en: 'Image', id: 'Gambar' }),
          showWhen: { key: 'card', is: ['text'] },
        },
        {
          ...image('photo', { en: 'Photo', id: 'Foto' }),
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
          ...text('title', { en: 'Title', id: 'Judul' }, 80),
          showWhen: { key: 'card', is: ['text', 'icon'] },
        },
        {
          ...area('text', { en: 'Text', id: 'Teks' }, 400, 3),
          showWhen: { key: 'card', is: ['text', 'icon'] },
        },
        {
          ...text('name', { en: 'Name', id: 'Nama' }, 80),
          showWhen: { key: 'card', is: ['person'] },
        },
        {
          ...text('role', { en: 'Role', id: 'Peran' }, 80),
          showWhen: { key: 'card', is: ['person'] },
        },
        {
          ...text('linkLabel', { en: 'Link text', id: 'Teks tautan' }, 40),
          showWhen: { key: 'card', is: ['text'] },
        },
        {
          ...link('link', { en: 'Link', id: 'Tautan' }),
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
      choice(
        'layout',
        { en: 'Look', id: 'Tampilan' },
        [
          { value: 'contained', label: { en: 'Image and text', id: 'Gambar dan teks' } },
          { value: 'split', label: { en: 'Split screen', id: 'Layar terbagi' } },
          { value: 'full', label: { en: 'Full-bleed statement', id: 'Pernyataan penuh' } },
        ],
        'contained',
      ),
      image('image', { en: 'Photo', id: 'Foto' }),
      photoFitField,
      photoPositionField,
      {
        // The full-bleed statement puts the photo behind the words, so there
        // is no side to pick; the card and the split both sit it beside them.
        ...positionField('imagePosition', { en: 'Photo side', id: 'Sisi foto' }),
        showWhen: { key: 'layout', is: ['contained', 'split'] },
      },
      { ...overlayField, showWhen: { key: 'layout', is: ['full'] } },
      {
        ...text('eyebrow', { en: 'Eyebrow', id: 'Label kecil' }, 60, 'Our promise'),
        showWhen: { key: 'layout', is: ['full'] },
      },
      heading(''),
      body(900),
      buttonLabel('Learn more'),
      buttonLink,
      {
        // Only the full-bleed statement centres or left-aligns its words; the
        // card and the split fix their own alignment.
        ...alignField('left'),
        showWhen: { key: 'layout', is: ['full'] },
      },
      {
        ...choice(
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
        ...choice(
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
      choice(
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
      list('items', { en: 'Steps', id: 'Langkah' }, { en: 'Step', id: 'Langkah' }, 'heading', 16, [
        // As with the quotes and cards above: a chapter reads image/heading/body
        // (`ScrollingStory`), a milestone reads image/label/title/text
        // (`Timeline`), so each style declares only its own.
        image('image', { en: 'Image', id: 'Gambar' }),
        photoFitField,
        photoPositionField,
        {
          ...text('heading', { en: 'Heading', id: 'Judul' }, 100),
          showWhen: { key: 'style', is: ['chapters'] },
        },
        {
          ...body(1000),
          showWhen: { key: 'style', is: ['chapters'] },
        },
        {
          ...text('label', { en: 'Year or date', id: 'Tahun atau tanggal' }, 30),
          showWhen: { key: 'style', is: ['timeline'] },
        },
        {
          ...text('title', { en: 'Title', id: 'Judul' }, 100),
          showWhen: { key: 'style', is: ['timeline'] },
        },
        {
          ...area('text', { en: 'Text', id: 'Teks' }, 500, 3),
          showWhen: { key: 'style', is: ['timeline'] },
        },
      ]),
    ],
  },
] as const satisfies readonly SectionSchema[]
