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

import type { Field, ItemField } from './fields'
import type { Localized } from './localized'

export interface SectionSchema {
  type: string
  name: Localized
  description: Localized
  /** Sections that read the shop's catalogue, so the editor can say so. */
  usesCatalogue?: boolean
  fields: readonly Field[]
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

const body = (rows = 4): ItemField => ({
  kind: 'textarea',
  key: 'body',
  label: { en: 'Text', id: 'Teks' },
  help: {
    en: 'Leave an empty line between paragraphs.',
    id: 'Beri satu baris kosong di antara paragraf.',
  },
  max: 2000,
  default: '',
  rows,
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

const limit = (fallback: number, max = 24): Field => ({
  kind: 'number',
  key: 'limit',
  label: { en: 'Products to show', id: 'Jumlah produk' },
  min: 2,
  max,
  default: fallback,
})

const columns = (fallback: number): Field => ({
  kind: 'select',
  key: 'columns',
  label: { en: 'Columns on desktop', id: 'Kolom di desktop' },
  options: [2, 3, 4, 5, 6].map((n) => ({
    value: String(n),
    label: { en: String(n), id: String(n) },
  })),
  default: String(fallback),
})

/* -------------------------------------------------------------------------- */
/* The library                                                                */
/* -------------------------------------------------------------------------- */

export const SECTION_SCHEMAS = [
  {
    type: 'announcement-bar',
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
      {
        kind: 'textarea',
        key: 'subheading',
        label: { en: 'Subheading', id: 'Subjudul' },
        max: 300,
        default: '',
        rows: 2,
      },
      buttonLabel,
      buttonLink,
      align,
      {
        kind: 'select',
        key: 'height',
        label: { en: 'Height', id: 'Tinggi' },
        options: [
          { value: 'sm', label: { en: 'Short', id: 'Pendek' } },
          { value: 'md', label: { en: 'Medium', id: 'Sedang' } },
          { value: 'lg', label: { en: 'Tall', id: 'Tinggi' } },
        ],
        default: 'md',
      },
    ],
  },
  {
    type: 'banner-slider',
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
    ],
  },
  {
    type: 'category-rail',
    name: { en: 'Category rail', id: 'Deretan kategori' },
    description: { en: "The shop's categories as tiles.", id: 'Kategori toko dalam bentuk ubin.' },
    usesCatalogue: true,
    fields: [
      heading('Shop by category'),
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
    name: { en: 'Text', id: 'Teks' },
    description: { en: 'A heading and paragraphs.', id: 'Judul dan paragraf.' },
    fields: [
      heading('Our story'),
      body(6),
      align,
      {
        kind: 'select',
        key: 'width',
        label: { en: 'Width', id: 'Lebar' },
        options: [
          { value: 'narrow', label: { en: 'Narrow', id: 'Sempit' } },
          { value: 'wide', label: { en: 'Wide', id: 'Lebar' } },
        ],
        default: 'narrow',
      },
    ],
  },
  {
    type: 'image-with-text',
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
    ],
  },
  {
    type: 'testimonials',
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
