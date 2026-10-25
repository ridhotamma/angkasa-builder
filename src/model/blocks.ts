/**
 * The block library: the pieces a Blocks section is made of.
 *
 * Everything is a block — a heading, a paragraph, a button, an image, a
 * vertical column, a two-column row, a spacer — and every block draws its
 * size, width, alignment and spacing from the shared scale in
 * `./element-style`. Columns hold blocks, so the tree nests; storage bounds
 * that nesting (`MAX_BLOCK_DEPTH`, `MAX_BLOCKS_PER_SECTION` in `./fields`).
 *
 * The helpers here walk and edit a stored tree, shared by the editor's panel
 * and the canvas selection so both always speak about the same block.
 */

import { BLOCK_STYLE_FIELDS } from './block-style'
import type { BlockSchema, BlockValue, BlocksField, Field, FieldValues, JsonValue } from './fields'
import { isRecord, MAX_BLOCK_DEPTH, MAX_BLOCK_NAME, newId } from './fields'
import {
  alignmentField,
  buttonHoverField,
  buttonPaddingField,
  buttonSizeField,
  buttonToneField,
  buttonVariantField,
  contentWidthField,
  headingSizeField,
  selfWidthField,
  spaceField,
  textSizeField,
} from './element-style'
import type { Localized } from './localized'
import {
  PHOTO_FITS,
  PHOTO_POSITIONS,
  photoFitField,
  photoPositionField,
  slidesField,
  SLIDES_PER_VIEW,
  SLIDES_PER_VIEW_MOBILE,
} from './section-style'
import type { SectionSchema } from './sections'

/* -------------------------------------------------------------------------- */
/* Block schemas                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Every block type, in picker order. Columns and rows reference this list for
 * their children, so the array is populated in place: the self-reference is
 * live by the time anything reads it.
 */
export const BLOCK_TYPES: BlockSchema[] = []

const nested = (
  key: string,
  label: Localized,
  max: number,
  defaultBlocks?: readonly string[],
): BlocksField => ({
  kind: 'blocks',
  key,
  label,
  max,
  blocks: BLOCK_TYPES,
  styleFields: BLOCK_STYLE_FIELDS,
  ...(defaultBlocks && { defaultBlocks }),
})

const heading: BlockSchema = {
  type: 'heading',
  name: { en: 'Heading', id: 'Judul' },
  description: {
    en: 'A title. Its level says what it means, its size how loud it is.',
    id: 'Sebuah judul. Tingkatnya menentukan makna, ukurannya seberapa menonjol.',
  },
  fields: [
    {
      kind: 'text',
      key: 'text',
      label: { en: 'Heading', id: 'Judul' },
      max: 160,
      default: 'A clear, confident heading',
    },
    {
      kind: 'select',
      key: 'level',
      label: { en: 'Heading level', id: 'Tingkat judul' },
      options: [
        { value: 'h1', label: { en: 'Main title', id: 'Judul utama' } },
        { value: 'h2', label: { en: 'Section title', id: 'Judul bagian' } },
        { value: 'h3', label: { en: 'Subtitle', id: 'Subjudul' } },
      ],
      default: 'h2',
    },
    headingSizeField(),
    alignmentField(),
    contentWidthField(),
  ],
}

const button: BlockSchema = {
  type: 'button',
  name: { en: 'Button', id: 'Tombol' },
  description: {
    en: 'A call to action, in the brand, accent, dark or light tone — or a colour of your own.',
    id: 'Ajakan bertindak dengan warna brand, aksen, gelap, terang, atau warna pilihan Anda.',
  },
  fields: [
    {
      kind: 'text',
      key: 'label',
      label: { en: 'Label', id: 'Label' },
      max: 60,
      default: 'Shop now',
    },
    { kind: 'link', key: 'link', label: { en: 'Link', id: 'Tautan' } },
    buttonSizeField(),
    buttonPaddingField(),
    selfWidthField(),
    alignmentField(),
    buttonVariantField(),
    buttonToneField({ custom: true }),
    {
      kind: 'color',
      key: 'toneColor',
      label: { en: 'Custom colour', id: 'Warna kustom' },
      default: '',
      showWhen: { key: 'tone', is: ['custom'] },
    },
    {
      kind: 'color',
      key: 'toneTextColor',
      label: { en: 'Label colour', id: 'Warna label' },
      help: {
        en: 'Optional — a readable colour is picked automatically when empty.',
        id: 'Opsional — warna yang terbaca dipilih otomatis bila kosong.',
      },
      default: '',
      showWhen: { key: 'tone', is: ['custom'] },
    },
    buttonHoverField(),
  ],
}

const image: BlockSchema = {
  type: 'image',
  name: { en: 'Image', id: 'Gambar' },
  description: {
    en: 'A single picture, with a shape and corners.',
    id: 'Satu gambar, dengan bentuk dan sudut.',
  },
  fields: [
    { kind: 'image', key: 'image', label: { en: 'Image', id: 'Gambar' } },
    {
      kind: 'text',
      key: 'alt',
      label: { en: 'Alt text', id: 'Teks alternatif' },
      max: 160,
      default: '',
    },
    {
      kind: 'select',
      key: 'ratio',
      label: { en: 'Aspect ratio', id: 'Rasio' },
      options: [
        { value: 'auto', label: { en: 'Natural', id: 'Asli' } },
        { value: 'square', label: { en: 'Square', id: 'Persegi' } },
        { value: '4/3', label: { en: 'Landscape 4:3', id: 'Lanskap 4:3' } },
        { value: '16/9', label: { en: 'Wide 16:9', id: 'Lebar 16:9' } },
        { value: '3/4', label: { en: 'Portrait 3:4', id: 'Potret 3:4' } },
      ],
      default: '4/3',
    },
    {
      kind: 'select',
      key: 'rounded',
      label: { en: 'Corners', id: 'Sudut' },
      options: [
        { value: 'none', label: { en: 'Square', id: 'Siku' } },
        { value: 'sm', label: { en: 'Small', id: 'Kecil' } },
        { value: 'md', label: { en: 'Medium', id: 'Sedang' } },
        { value: 'lg', label: { en: 'Large', id: 'Besar' } },
        { value: 'full', label: { en: 'Round', id: 'Bulat' } },
      ],
      default: 'md',
    },
    {
      kind: 'select',
      key: 'fit',
      label: { en: 'Image size', id: 'Ukuran gambar' },
      help: {
        en: 'How the photo fills the frame.',
        id: 'Cara foto memenuhi bingkai.',
      },
      options: PHOTO_FITS,
      default: 'cover',
    },
    {
      kind: 'select',
      key: 'position',
      label: { en: 'Image position', id: 'Posisi gambar' },
      options: PHOTO_POSITIONS,
      default: 'center',
    },
    contentWidthField(),
    alignmentField(),
  ],
}

const spacer: BlockSchema = {
  type: 'spacer',
  name: { en: 'Spacer', id: 'Penyela' },
  description: {
    en: 'A deliberate gap on the spacing scale — add a line and it becomes a divider.',
    id: 'Jeda dengan skala jarak yang sama — tambahkan garis dan menjadi pembatas.',
  },
  fields: [
    spaceField('size', { en: 'Height', id: 'Tinggi' }, 'md'),
    {
      kind: 'boolean',
      key: 'line',
      label: { en: 'Show a line', id: 'Tampilkan garis' },
      default: false,
    },
    {
      kind: 'select',
      key: 'thickness',
      label: { en: 'Line thickness', id: 'Ketebalan garis' },
      options: [
        { value: 'thin', label: { en: 'Hairline', id: 'Sangat tipis' } },
        { value: 'medium', label: { en: 'Thin', id: 'Tipis' } },
        { value: 'thick', label: { en: 'Thick', id: 'Tebal' } },
      ],
      default: 'thin',
      // Only a spacer with its line on draws one.
      showWhen: { key: 'line', is: ['true'] },
    },
    {
      kind: 'select',
      key: 'tone',
      label: { en: 'Line colour', id: 'Warna garis' },
      options: [
        { value: 'subtle', label: { en: 'Subtle', id: 'Samar' } },
        { value: 'border', label: { en: 'Border', id: 'Garis tepi' } },
        { value: 'strong', label: { en: 'Strong', id: 'Kuat' } },
        { value: 'brand', label: { en: 'Brand', id: 'Brand' } },
      ],
      default: 'border',
      showWhen: { key: 'line', is: ['true'] },
    },
    contentWidthField(),
    alignmentField(),
  ],
}

const column: BlockSchema = {
  type: 'column',
  name: { en: 'Column', id: 'Kolom' },
  description: {
    en: 'A vertical group of blocks with its own spacing.',
    id: 'Kelompok blok vertikal dengan jaraknya sendiri.',
  },
  fields: [
    nested('blocks', { en: 'Blocks', id: 'Blok' }, 30),
    spaceField('gap', { en: 'Spacing', id: 'Jarak' }, 'md'),
    spaceField('padding', { en: 'Vertical padding', id: 'Jarak dalam' }, 'none'),
    contentWidthField(),
    alignmentField(),
  ],
}

const row: BlockSchema = {
  type: 'row',
  name: { en: 'Row', id: 'Baris' },
  description: {
    en: 'Blocks side by side, wrapping and stacking on phones.',
    id: 'Blok berdampingan, membungkus dan menumpuk di ponsel.',
  },
  fields: [
    nested('blocks', { en: 'Blocks', id: 'Blok' }, 30),
    spaceField('gap', { en: 'Gap', id: 'Jarak' }, 'md'),
    {
      kind: 'select',
      key: 'align',
      label: { en: 'Vertical alignment', id: 'Perataan vertikal' },
      options: [
        { value: 'start', label: { en: 'Top', id: 'Atas' } },
        { value: 'center', label: { en: 'Middle', id: 'Tengah' } },
        { value: 'end', label: { en: 'Bottom', id: 'Bawah' } },
        { value: 'stretch', label: { en: 'Stretch', id: 'Penuh' } },
      ],
      default: 'stretch',
    },
    {
      kind: 'select',
      key: 'justify',
      label: { en: 'Horizontal placement', id: 'Penempatan mendatar' },
      options: [
        { value: 'start', label: { en: 'Start', id: 'Awal' } },
        { value: 'center', label: { en: 'Centre', id: 'Tengah' } },
        { value: 'end', label: { en: 'End', id: 'Akhir' } },
        { value: 'between', label: { en: 'Space between', id: 'Renggang di antara' } },
        { value: 'around', label: { en: 'Space around', id: 'Renggang sekeliling' } },
        { value: 'evenly', label: { en: 'Space evenly', id: 'Renggang merata' } },
      ],
      default: 'start',
    },
    {
      kind: 'boolean',
      key: 'wrap',
      label: { en: 'Wrap onto the next line', id: 'Bungkus ke baris berikutnya' },
      default: true,
    },
    {
      kind: 'boolean',
      key: 'stackOnMobile',
      label: { en: 'Stack on phones', id: 'Menumpuk di ponsel' },
      default: true,
    },
    spaceField('padding', { en: 'Padding', id: 'Jarak dalam' }, 'none'),
  ],
}

const grid: BlockSchema = {
  type: 'grid',
  name: { en: 'Grid', id: 'Kisi' },
  description: {
    en: 'Blocks in a grid of equal columns, collapsing on phones.',
    id: 'Blok dalam kisi kolom sama lebar, menciut di ponsel.',
  },
  fields: [
    nested('blocks', { en: 'Blocks', id: 'Blok' }, 30),
    {
      kind: 'select',
      key: 'columns',
      label: { en: 'Columns on desktop', id: 'Kolom di desktop' },
      options: [1, 2, 3, 4, 5, 6].map((n) => ({
        value: String(n),
        label: { en: String(n), id: String(n) },
      })),
      default: '2',
    },
    {
      kind: 'select',
      key: 'widths',
      label: { en: 'Column widths', id: 'Lebar kolom' },
      options: [
        { value: 'equal', label: { en: 'Equal halves', id: 'Dua bagian sama' } },
        { value: 'leftWide', label: { en: 'Wider left', id: 'Kiri lebih lebar' } },
        { value: 'rightWide', label: { en: 'Wider right', id: 'Kanan lebih lebar' } },
      ],
      default: 'equal',
      showWhen: { key: 'columns', is: ['2'] },
    },
    spaceField('gap', { en: 'Gap', id: 'Jarak' }, 'md'),
    {
      kind: 'select',
      key: 'align',
      label: { en: 'Vertical alignment', id: 'Perataan vertikal' },
      options: [
        { value: 'start', label: { en: 'Top', id: 'Atas' } },
        { value: 'center', label: { en: 'Middle', id: 'Tengah' } },
        { value: 'end', label: { en: 'Bottom', id: 'Bawah' } },
        { value: 'stretch', label: { en: 'Stretch', id: 'Penuh' } },
      ],
      default: 'stretch',
    },
    {
      kind: 'boolean',
      key: 'stackOnMobile',
      label: { en: 'One column on phones', id: 'Satu kolom di ponsel' },
      default: true,
    },
    spaceField('padding', { en: 'Padding', id: 'Jarak dalam' }, 'none'),
  ],
}

const richText: BlockSchema = {
  type: 'richtext',
  name: { en: 'Rich text', id: 'Teks berformat' },
  description: {
    en: 'Paragraphs with bold, italics, links, lists and quotes.',
    id: 'Paragraf dengan tebal, miring, tautan, daftar, dan kutipan.',
  },
  fields: [
    {
      kind: 'richtext',
      key: 'body',
      label: { en: 'Text', id: 'Teks' },
      max: 3000,
      default: '',
    },
    textSizeField(),
    alignmentField(),
    contentWidthField(),
  ],
}

const icon: BlockSchema = {
  type: 'icon',
  name: { en: 'Icon', id: 'Ikon' },
  description: {
    en: 'A single symbol from the shop icon set.',
    id: 'Satu simbol dari set ikon toko.',
  },
  fields: [
    {
      kind: 'icon',
      key: 'icon',
      label: { en: 'Icon', id: 'Ikon' },
      default: 'sparkles',
    },
    {
      kind: 'select',
      key: 'size',
      label: { en: 'Size', id: 'Ukuran' },
      options: [
        { value: 'sm', label: { en: 'Small', id: 'Kecil' } },
        { value: 'md', label: { en: 'Medium', id: 'Sedang' } },
        { value: 'lg', label: { en: 'Large', id: 'Besar' } },
        { value: 'xl', label: { en: 'Extra large', id: 'Sangat besar' } },
      ],
      default: 'md',
    },
    {
      kind: 'select',
      key: 'tone',
      label: { en: 'Colour', id: 'Warna' },
      options: [
        { value: 'brand', label: { en: 'Brand', id: 'Brand' } },
        { value: 'accent', label: { en: 'Accent', id: 'Aksen' } },
        { value: 'muted', label: { en: 'Muted text', id: 'Teks redup' } },
        { value: 'dark', label: { en: 'Page text', id: 'Teks halaman' } },
        { value: 'inherit', label: { en: 'Follow section', id: 'Ikuti bagian' } },
      ],
      default: 'brand',
    },
    alignmentField(),
  ],
}

const video: BlockSchema = {
  type: 'video',
  name: { en: 'Video', id: 'Video' },
  description: {
    en: 'One video from your uploads, YouTube or Vimeo.',
    id: 'Satu video dari unggahan, YouTube, atau Vimeo.',
  },
  fields: [
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
      default: false,
    },
    contentWidthField(),
    alignmentField(),
  ],
}

/**
 * One place on a map: a marker at the one coordinate pair the seller pastes,
 * drawn as a light Google Maps embed rather than a map canvas.
 */
const map: BlockSchema = {
  type: 'map',
  name: { en: 'Map', id: 'Peta' },
  description: {
    en: 'A pin on a map at coordinates you paste from Google Maps.',
    id: 'Pin di peta pada koordinat yang Anda salin dari Google Maps.',
  },
  fields: [
    {
      kind: 'text',
      key: 'label',
      label: { en: 'Label', id: 'Label' },
      help: {
        en: 'Read out as the marker’s name, e.g. “Our shop, Jakarta”.',
        id: 'Dibacakan sebagai nama pin, mis. “Toko kami, Jakarta”.',
      },
      max: 80,
      default: 'Our shop',
    },
    {
      kind: 'coordinates',
      key: 'coordinates',
      label: { en: 'Coordinates', id: 'Koordinat' },
      help: {
        en: 'Right-click the spot in Google Maps, copy the pair and paste it here. e.g. -6.244, 106.799',
        id: 'Klik kanan titiknya di Google Maps, salin pasangannya, lalu tempel di sini. mis. -6.244, 106.799',
      },
      placeholder: { en: '-6.244, 106.799', id: '-6.244, 106.799' },
      default: { latitude: -6.2, longitude: 106.816666 },
    },
    {
      kind: 'select',
      key: 'zoom',
      label: { en: 'Zoom', id: 'Zum' },
      options: [
        { value: '11', label: { en: 'City', id: 'Kota' } },
        { value: '13', label: { en: 'Neighbourhood', id: 'Kecamatan' } },
        { value: '15', label: { en: 'Street', id: 'Jalan' } },
        { value: '17', label: { en: 'Building', id: 'Bangunan' } },
      ],
      default: '13',
    },
    contentWidthField(),
    alignmentField(),
  ],
}

const badge: BlockSchema = {
  type: 'badge',
  name: { en: 'Badge', id: 'Lencana' },
  description: {
    en: 'A small label — "New", "Sale", "Limited".',
    id: 'Label kecil — "Baru", "Diskon", "Terbatas".',
  },
  fields: [
    {
      kind: 'text',
      key: 'text',
      label: { en: 'Text', id: 'Teks' },
      max: 40,
      default: 'New',
    },
    {
      kind: 'select',
      key: 'tone',
      label: { en: 'Colour', id: 'Warna' },
      options: [
        { value: 'brand', label: { en: 'Brand', id: 'Brand' } },
        { value: 'dark', label: { en: 'Dark', id: 'Gelap' } },
        { value: 'subtle', label: { en: 'Soft', id: 'Lembut' } },
        { value: 'outline', label: { en: 'Outlined', id: 'Garis tepi' } },
      ],
      default: 'brand',
    },
    {
      kind: 'select',
      key: 'size',
      label: { en: 'Size', id: 'Ukuran' },
      options: [
        { value: 'sm', label: { en: 'Small', id: 'Kecil' } },
        { value: 'md', label: { en: 'Medium', id: 'Sedang' } },
      ],
      default: 'md',
    },
    alignmentField(),
  ],
}

/**
 * A customer rating the seller writes themselves: five stars, an average and
 * a review count. The product page's own rating is data-driven — it counts
 * the shop's reviews — so a composed page had no way to show a rating beside
 * a custom testimonial. This block stores the numbers as plain settings, and
 * the renderer draws the stars the same way the product page does.
 */
const rating: BlockSchema = {
  type: 'rating',
  name: { en: 'Rating', id: 'Rating' },
  description: {
    en: 'Five stars with an average and a review count — your own numbers.',
    id: 'Lima bintang dengan rata-rata dan jumlah ulasan — angka Anda sendiri.',
  },
  fields: [
    {
      kind: 'number',
      key: 'score',
      label: { en: 'Average score', id: 'Nilai rata-rata' },
      min: 0,
      max: 5,
      step: 0.1,
      default: 5,
    },
    {
      kind: 'number',
      key: 'count',
      label: { en: 'Reviews', id: 'Ulasan' },
      help: {
        en: 'Shown beside the score; 0 leaves it out.',
        id: 'Tampil di samping nilai; 0 menyembunyikannya.',
      },
      min: 0,
      max: 1_000_000,
      default: 0,
    },
    {
      kind: 'text',
      key: 'label',
      label: { en: 'Caption', id: 'Keterangan' },
      help: {
        en: 'An optional line under the stars, e.g. "From verified buyers".',
        id: 'Baris opsional di bawah bintang, mis. "Dari pembeli terverifikasi".',
      },
      max: 80,
      default: '',
    },
    {
      kind: 'select',
      key: 'size',
      label: { en: 'Star size', id: 'Ukuran bintang' },
      options: [
        { value: 'sm', label: { en: 'Small', id: 'Kecil' } },
        { value: 'md', label: { en: 'Medium', id: 'Sedang' } },
        { value: 'lg', label: { en: 'Large', id: 'Besar' } },
      ],
      default: 'md',
    },
    {
      kind: 'select',
      key: 'tone',
      label: { en: 'Star colour', id: 'Warna bintang' },
      options: [
        { value: 'yellow', label: { en: 'Yellow', id: 'Kuning' } },
        { value: 'brand', label: { en: 'Brand', id: 'Brand' } },
        { value: 'accent', label: { en: 'Accent', id: 'Aksen' } },
        { value: 'dark', label: { en: 'Page text', id: 'Teks halaman' } },
      ],
      default: 'yellow',
    },
    {
      kind: 'boolean',
      key: 'showScore',
      label: { en: 'Show the number', id: 'Tampilkan angka' },
      default: true,
    },
    alignmentField(),
    contentWidthField(),
  ],
}

/**
 * A heading that folds open to reveal its content — one FAQ item, a shipping
 * note, anything explained on demand. Its content is nested blocks, like every
 * other container (a column, a photo card), so an answer can be a paragraph, a
 * picture list, a button — not only rich text. Neighbouring collapsible blocks
 * each fold on their own, so stacking a few builds an FAQ without a list field.
 */
const collapsible: BlockSchema = {
  type: 'collapsible',
  name: { en: 'Collapsible', id: 'Lipatan' },
  description: {
    en: 'A heading that opens to reveal any blocks — an FAQ item, or anything explained on demand.',
    id: 'Judul yang membuka untuk menampilkan blok apa pun — item tanya jawab, atau apa pun yang dijelaskan saat dibutuhkan.',
  },
  fields: [
    {
      kind: 'text',
      key: 'heading',
      label: { en: 'Heading', id: 'Judul' },
      max: 120,
      default: '',
    },
    nested('blocks', { en: 'Content', id: 'Konten' }, 20),
    {
      kind: 'boolean',
      key: 'open',
      label: { en: 'Open by default', id: 'Terbuka di awal' },
      default: false,
    },
  ],
}

/**
 * A card whose whole face is a photo, with its words on top. The block the
 * ready-made sections did not draw: a `column` can wear a background colour
 * but not a background image, and an `image` is a sibling of its text, never
 * a layer under it — so "three cards, each a full photo with the text
 * centred inside" had no answer before this type. Children nest, so a card
 * holds a heading, a paragraph or a button like any container; the overlay
 * shade and the height keep the words readable on a bright photo.
 */
const mediaCard: BlockSchema = {
  type: 'media-card',
  name: { en: 'Photo card', id: 'Kartu foto' },
  description: {
    en: 'A card filled by a background photo, with its words on top.',
    id: 'Kartu berlatar foto penuh, dengan teks di atasnya.',
  },
  fields: [
    { kind: 'image', key: 'image', label: { en: 'Background image', id: 'Gambar latar' } },
    photoFitField,
    photoPositionField,
    {
      kind: 'text',
      key: 'alt',
      label: { en: 'Image description', id: 'Keterangan gambar' },
      help: {
        en: 'Read out to shoppers who cannot see the image, and used to pick a stock photo.',
        id: 'Dibacakan untuk pembeli yang tidak bisa melihat gambar, dan dipakai memilih foto stok.',
      },
      max: 160,
      default: '',
    },
    {
      kind: 'select',
      key: 'overlay',
      label: { en: 'Shade over the image', id: 'Bayangan di atas gambar' },
      help: {
        en: 'Keeps the words readable on a bright photo.',
        id: 'Menjaga teks tetap terbaca di foto yang terang.',
      },
      options: [
        { value: 'gradient', label: { en: 'Fade from the bottom', id: 'Memudar dari bawah' } },
        { value: 'dark', label: { en: 'Dark', id: 'Gelap' } },
        { value: 'light', label: { en: 'Light', id: 'Tipis' } },
        { value: 'none', label: { en: 'None', id: 'Tanpa bayangan' } },
      ],
      default: 'gradient',
    },
    {
      kind: 'select',
      key: 'contentPosition',
      label: { en: 'Text position', id: 'Posisi teks' },
      options: [
        { value: 'middle', label: { en: 'Middle', id: 'Tengah' } },
        { value: 'bottom', label: { en: 'Bottom', id: 'Bawah' } },
      ],
      default: 'middle',
    },
    {
      kind: 'select',
      key: 'height',
      label: { en: 'Height', id: 'Tinggi' },
      options: [
        { value: 'sm', label: { en: 'Short', id: 'Pendek' } },
        { value: 'md', label: { en: 'Medium', id: 'Sedang' } },
        { value: 'lg', label: { en: 'Tall', id: 'Tinggi' } },
        { value: 'xl', label: { en: 'Extra tall', id: 'Sangat tinggi' } },
      ],
      default: 'md',
    },
    spaceField('padding', { en: 'Padding', id: 'Jarak dalam' }, 'md'),
    spaceField('gap', { en: 'Spacing', id: 'Jarak' }, 'sm'),
    {
      kind: 'select',
      key: 'rounded',
      label: { en: 'Corners', id: 'Sudut' },
      options: [
        { value: 'none', label: { en: 'Square', id: 'Siku' } },
        { value: 'sm', label: { en: 'Small', id: 'Kecil' } },
        { value: 'md', label: { en: 'Medium', id: 'Sedang' } },
        { value: 'lg', label: { en: 'Large', id: 'Besar' } },
        { value: 'full', label: { en: 'Round', id: 'Bulat' } },
      ],
      default: 'md',
    },
    nested('blocks', { en: 'Content', id: 'Konten' }, 20),
  ],
}

/** How tall a vertical slider or marquee stands: it scrolls inside this window. */
const trackHeightField = (showWhen: Field['showWhen']): Field => ({
  kind: 'select',
  key: 'height',
  label: { en: 'Height', id: 'Tinggi' },
  options: [
    { value: 'sm', label: { en: 'Short', id: 'Pendek' } },
    { value: 'md', label: { en: 'Medium', id: 'Sedang' } },
    { value: 'lg', label: { en: 'Tall', id: 'Tinggi' } },
    { value: 'xl', label: { en: 'Extra tall', id: 'Sangat tinggi' } },
  ],
  default: 'md',
  showWhen,
})

/**
 * Blocks one after another in a swipeable track: every child is one slide,
 * so a slide can be an image, a photo card or a whole column of content.
 * Horizontal or vertical, several slides to a page, with arrows, dots or a
 * counter. Autoplay has a floor of three seconds and always draws a pause
 * control, and it never runs under reduced motion. The track ends on its last
 * slide — only the banner slider loops.
 */
const slider: BlockSchema = {
  type: 'slider',
  name: { en: 'Slider', id: 'Penggeser' },
  description: {
    en: 'Blocks as slides you swipe through, sideways or up and down.',
    id: 'Blok sebagai slide yang digeser, ke samping atau ke atas-bawah.',
  },
  fields: [
    nested('blocks', { en: 'Slides', id: 'Slide' }, 12),
    {
      kind: 'select',
      key: 'orientation',
      label: { en: 'Direction', id: 'Arah' },
      options: [
        { value: 'horizontal', label: { en: 'Sideways', id: 'Ke samping' } },
        { value: 'vertical', label: { en: 'Up and down', id: 'Atas-bawah' } },
      ],
      default: 'horizontal',
    },
    slidesField(
      'perPage',
      { en: 'Slides at a time on desktop', id: 'Slide sekaligus di desktop' },
      SLIDES_PER_VIEW,
      '1',
    ),
    slidesField(
      'perPageMobile',
      { en: 'Slides at a time on phones', id: 'Slide sekaligus di ponsel' },
      SLIDES_PER_VIEW_MOBILE,
      '1',
    ),
    trackHeightField({ key: 'orientation', is: ['vertical'] }),
    spaceField('gap', { en: 'Gap', id: 'Jarak' }, 'md'),
    {
      kind: 'boolean',
      key: 'peek',
      label: { en: 'Show the edges of the next slides', id: 'Tampilkan tepi slide berikutnya' },
      default: false,
    },
    {
      kind: 'boolean',
      key: 'autoplay',
      label: { en: 'Play automatically', id: 'Putar otomatis' },
      help: {
        en: 'Shoppers get a pause button, and it stays still for anyone who turned motion off.',
        id: 'Pembeli mendapat tombol jeda, dan diam bagi yang mematikan animasi.',
      },
      default: false,
    },
    {
      kind: 'select',
      key: 'interval',
      label: { en: 'Time on each slide', id: 'Durasi tiap slide' },
      options: [
        { value: '3', label: { en: '3 seconds', id: '3 detik' } },
        { value: '5', label: { en: '5 seconds', id: '5 detik' } },
        { value: '8', label: { en: '8 seconds', id: '8 detik' } },
      ],
      default: '5',
      showWhen: { key: 'autoplay', is: ['true'] },
    },
    {
      kind: 'select',
      key: 'arrows',
      label: { en: 'Arrows', id: 'Panah' },
      options: [
        { value: 'overlay', label: { en: 'On the slides', id: 'Di atas slide' } },
        { value: 'none', label: { en: 'None', id: 'Tanpa panah' } },
      ],
      default: 'overlay',
    },
    {
      kind: 'select',
      key: 'indicator',
      label: { en: 'Position indicator', id: 'Penanda posisi' },
      options: [
        { value: 'dots', label: { en: 'Dots', id: 'Titik' } },
        { value: 'count', label: { en: 'Counter (2 / 5)', id: 'Penghitung (2 / 5)' } },
        { value: 'none', label: { en: 'None', id: 'Tanpa penanda' } },
      ],
      // No dots at the foot of a slider unless the seller asks for them: the
      // banner slider is the one that always wears them.
      default: 'none',
    },
  ],
}

/**
 * Blocks running in an endless loop — logos, words, product photos, little
 * cards — sideways or up and down. Pauses under the pointer, and stands
 * still for shoppers who turned motion off.
 */
const marquee: BlockSchema = {
  type: 'marquee',
  name: { en: 'Marquee', id: 'Teks berjalan' },
  description: {
    en: 'Blocks running past in an endless loop, sideways or up and down.',
    id: 'Blok yang terus berjalan tanpa henti, ke samping atau ke atas-bawah.',
  },
  fields: [
    nested('blocks', { en: 'Items', id: 'Item' }, 20),
    {
      kind: 'select',
      key: 'direction',
      label: { en: 'Runs towards', id: 'Berjalan ke' },
      options: [
        { value: 'left', label: { en: 'Left', id: 'Kiri' } },
        { value: 'right', label: { en: 'Right', id: 'Kanan' } },
        { value: 'up', label: { en: 'Up', id: 'Atas' } },
        { value: 'down', label: { en: 'Down', id: 'Bawah' } },
      ],
      default: 'left',
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
    },
    trackHeightField({ key: 'direction', is: ['up', 'down'] }),
    spaceField('gap', { en: 'Gap', id: 'Jarak' }, 'lg'),
    {
      kind: 'select',
      key: 'align',
      label: { en: 'Item alignment', id: 'Perataan item' },
      options: [
        { value: 'start', label: { en: 'Start', id: 'Awal' } },
        { value: 'center', label: { en: 'Centre', id: 'Tengah' } },
        { value: 'end', label: { en: 'End', id: 'Akhir' } },
      ],
      default: 'center',
    },
    {
      kind: 'boolean',
      key: 'pauseOnHover',
      label: { en: 'Pause under the pointer', id: 'Berhenti saat disentuh kursor' },
      default: true,
    },
    {
      kind: 'boolean',
      key: 'fade',
      label: { en: 'Fade the edges', id: 'Pudarkan tepinya' },
      default: true,
    },
  ],
}

BLOCK_TYPES.push(
  heading,
  richText,
  button,
  image,
  spacer,
  column,
  row,
  grid,
  slider,
  marquee,
  icon,
  video,
  map,
  badge,
  rating,
  collapsible,
  mediaCard,
)

export function blockSchema(type: string): BlockSchema | null {
  return BLOCK_TYPES.find((block) => block.type === type) ?? null
}

// `as const` keeps the section's type a literal, so the library's union of
// section types does not widen to `string` where this schema is registered.
export const blocksSectionSchema = {
  type: 'blocks',
  name: { en: 'Blocks', id: 'Blok' },
  description: {
    en: 'Build any layout from blocks — headings, text, buttons, images and more.',
    id: 'Susun tata letak dari blok — judul, teks, tombol, gambar, dan lainnya.',
  },
  category: 'layout',
  icon: 'blocks',
  fields: [
    {
      kind: 'blocks',
      key: 'blocks',
      label: { en: 'Content', id: 'Konten' },
      max: 60,
      blocks: BLOCK_TYPES,
      defaultBlocks: ['heading', 'richtext', 'button'],
      styleFields: BLOCK_STYLE_FIELDS,
    },
    spaceField('gap', { en: 'Spacing between blocks', id: 'Jarak antar blok' }, 'md'),
  ],
} as const satisfies SectionSchema

/* -------------------------------------------------------------------------- */
/* Walking a stored tree                                                      */
/* -------------------------------------------------------------------------- */

export interface FoundBlock {
  block: BlockValue
  schema: BlockSchema
  /** The blocks field the block sits in. */
  field: BlocksField
  /** The block that owns that field, or `null` at the top level. */
  parentId: string | null
  /** Where the block sits among its siblings. */
  index: number
  /** How many siblings the containing field holds. */
  count: number
}

function blockIn(
  field: BlocksField,
  raw: unknown,
  id: string,
  parentId: string | null,
): FoundBlock | null {
  if (!Array.isArray(raw)) return null
  const blocks = raw as unknown as BlockValue[]
  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index]!
    if (block.id !== id) continue
    const schema = field.blocks.find((candidate) => candidate.type === block.type)
    return schema ? { block, schema, field, parentId, index, count: blocks.length } : null
  }
  for (const block of blocks) {
    const schema = field.blocks.find((candidate) => candidate.type === block.type)
    if (!schema || !isRecord(block.settings)) continue
    const nested = findBlock(schema.fields, block.settings as FieldValues, id, block.id)
    if (nested) return nested
  }
  return null
}

/** The block with `id`, wherever it sits — a column's child included. */
export function findBlock(
  fields: readonly Field[],
  values: FieldValues,
  id: string,
  parentId: string | null = null,
): FoundBlock | null {
  for (const field of fields) {
    const raw = values[field.key]
    if (field.kind === 'blocks') {
      const found = blockIn(field, raw, id, parentId)
      if (found) return found
    }
    if (field.kind === 'list' && Array.isArray(raw)) {
      for (const item of raw as unknown as FieldValues[]) {
        const found = findBlock(field.fields, item, id)
        if (found) return found
      }
    }
  }
  return null
}

/**
 * `values` with the list holding block `id` rewritten. The callback receives
 * the sibling list, the block's index, its schema and the field it sits in.
 * Returns `null` when no such block exists.
 */
export function updateBlocksIn(
  fields: readonly Field[],
  values: FieldValues,
  id: string,
  change: (
    blocks: BlockValue[],
    index: number,
    schema: BlockSchema,
    field: BlocksField,
  ) => BlockValue[],
): FieldValues | null {
  for (const field of fields) {
    const raw = values[field.key]
    if (field.kind === 'blocks' && Array.isArray(raw)) {
      const blocks = raw as unknown as BlockValue[]
      const index = blocks.findIndex((block) => block.id === id)
      if (index >= 0) {
        const schema = field.blocks.find((candidate) => candidate.type === blocks[index]!.type)
        if (!schema) continue
        return {
          ...values,
          [field.key]: change(blocks, index, schema, field) as unknown as JsonValue,
        }
      }
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i]!
        const schema = field.blocks.find((candidate) => candidate.type === block.type)
        if (!schema || !isRecord(block.settings)) continue
        const nested = updateBlocksIn(schema.fields, block.settings as FieldValues, id, change)
        if (nested) {
          const next = [...blocks]
          next[i] = { ...block, settings: nested }
          return { ...values, [field.key]: next as unknown as JsonValue }
        }
      }
    }
    if (field.kind === 'list' && Array.isArray(raw)) {
      const items = raw as unknown as FieldValues[]
      for (let i = 0; i < items.length; i++) {
        const nested = updateBlocksIn(field.fields, items[i]!, id, change)
        if (nested) {
          const next = [...items]
          next[i] = nested
          return { ...values, [field.key]: next as unknown as JsonValue }
        }
      }
    }
  }
  return null
}

/** The block's own settings replaced. */
export function updateBlockSettings(
  fields: readonly Field[],
  values: FieldValues,
  id: string,
  settings: FieldValues,
): FieldValues | null {
  return updateBlocksIn(fields, values, id, (blocks, index) => {
    const next = [...blocks]
    next[index] = { ...blocks[index]!, settings }
    return next
  })
}

/**
 * The block's style overrides replaced — set to `undefined` to clear every
 * override, leaving the block exactly as its section draws it.
 */
export function updateBlockStyle(
  fields: readonly Field[],
  values: FieldValues,
  id: string,
  style: FieldValues | undefined,
): FieldValues | null {
  return updateBlocksIn(fields, values, id, (blocks, index) => {
    const next = [...blocks]
    const { style: _cleared, ...block } = next[index]!
    next[index] = style && Object.keys(style).length > 0 ? { ...block, style } : block
    return next
  })
}

/**
 * The seller's own name for the block, stored as typed (within the name
 * limit) so a space can be typed between words; the sanitiser trims it when
 * the layout is saved. Clearing the name removes the key, so the schema's
 * name shows again. It is an editor label only — no renderer reads it.
 */
export function renameBlock(
  fields: readonly Field[],
  values: FieldValues,
  id: string,
  name: string,
): FieldValues | null {
  const clean = name.slice(0, MAX_BLOCK_NAME)
  return updateBlocksIn(fields, values, id, (blocks, index) => {
    const next = [...blocks]
    const { name: _previous, ...block } = next[index]!
    next[index] = clean ? { ...block, name: clean } : block
    return next
  })
}

/**
 * The block removed, leaving its siblings; an empty field renders its empty state.
 */
export function removeBlock(
  fields: readonly Field[],
  values: FieldValues,
  id: string,
): FieldValues | null {
  return updateBlocksIn(fields, values, id, (blocks) => blocks.filter((block) => block.id !== id))
}

/** The block moved `by` places among its siblings; unchanged at the ends. */
export function moveBlock(
  fields: readonly Field[],
  values: FieldValues,
  id: string,
  by: number,
): FieldValues | null {
  return updateBlocksIn(fields, values, id, (blocks, index) => {
    const to = index + by
    if (to < 0 || to >= blocks.length) return blocks
    const next = [...blocks]
    const [block] = next.splice(index, 1)
    next.splice(to, 0, block!)
    return next
  })
}

/**
 * A deep copy of a block with fresh ids throughout — a duplicated column must
 * not share its children's ids with the original, or selecting one child
 * would edit the other.
 */
export function cloneBlock(block: BlockValue, schema: BlockSchema): BlockValue {
  return {
    id: newId(),
    type: block.type,
    ...(block.name && { name: block.name }),
    settings: cloneSettings(schema.fields, block.settings),
    ...(block.style && { style: { ...block.style } }),
  }
}

function cloneSettings(fields: readonly Field[], settings: FieldValues): FieldValues {
  const out = { ...settings }
  for (const field of fields) {
    const raw = out[field.key]
    if (field.kind === 'blocks' && Array.isArray(raw)) {
      out[field.key] = (raw as unknown as BlockValue[]).map((child) => {
        const schema = field.blocks.find((candidate) => candidate.type === child.type)
        return schema ? cloneBlock(child, schema) : child
      }) as unknown as JsonValue
    }
    if (field.kind === 'list' && Array.isArray(raw)) {
      out[field.key] = (raw as unknown as FieldValues[]).map((item) => ({
        ...cloneSettings(field.fields, item),
        id: newId(),
      })) as unknown as JsonValue
    }
  }
  return out
}

/** A copy of the block, right after it — `null` when the field is full. */
export function duplicateBlock(
  fields: readonly Field[],
  values: FieldValues,
  id: string,
): { values: FieldValues; copy: BlockValue } | null {
  const created: { copy: BlockValue | null } = { copy: null }
  const next = updateBlocksIn(fields, values, id, (blocks, index, schema, field) => {
    if (blocks.length >= field.max) return blocks
    const copy = cloneBlock(blocks[index]!, schema)
    created.copy = copy
    const out = [...blocks]
    out.splice(index + 1, 0, copy)
    return out
  })
  if (!next || !created.copy) return null
  return { values: next, copy: created.copy }
}

/* -------------------------------------------------------------------------- */
/* Moving a block into another parent                                         */
/* -------------------------------------------------------------------------- */

/** One block on the way down to a blocks field: the owner and its schema. */
export interface BlockContainerStep {
  block: BlockValue
  schema: BlockSchema
  /** This block's 1-based place among same-type siblings, to name "Column 2". */
  ordinal: number
  /** How many same-type siblings there are; `1` needs no number in the name. */
  siblings: number
}

/**
 * A blocks field a block may be moved into — the section's own top-level list
 * when `parentId` is `null`, or the list inside a column, row, grid or custom
 * layout block.
 */
export interface BlockContainer {
  /** The block that owns the list, or `null` for the section's own top level. */
  parentId: string | null
  /** The field inside that owner — `blocks` for every built-in container. */
  fieldKey: string
  /** The owners from the section down to this list, for a readable path. */
  path: readonly BlockContainerStep[]
  field: BlocksField
  /** How many blocks the list holds now. */
  count: number
}

function collectContainers(
  fields: readonly Field[],
  values: FieldValues,
  path: readonly BlockContainerStep[],
  out: BlockContainer[],
): void {
  for (const field of fields) {
    if (field.kind !== 'blocks') continue
    const raw = values[field.key]
    const blocks = Array.isArray(raw) ? (raw as unknown as BlockValue[]) : []
    const owner = path.at(-1)
    out.push({
      parentId: owner ? owner.block.id : null,
      fieldKey: field.key,
      path,
      field,
      count: blocks.length,
    })
    for (const block of blocks) {
      const schema = field.blocks.find((candidate) => candidate.type === block.type)
      if (!schema || !isRecord(block.settings)) continue
      const sameType = blocks.filter((candidate) => candidate.type === block.type)
      collectContainers(
        schema.fields,
        block.settings as FieldValues,
        [
          ...path,
          {
            block,
            schema,
            ordinal: sameType.findIndex((candidate) => candidate.id === block.id) + 1,
            siblings: sameType.length,
          },
        ],
        out,
      )
    }
  }
}

/**
 * Every blocks field in `values`, in the order a seller reads the page: the
 * top level first, then each container's own children tree. A block's own
 * subtree is included, so the editor can offer every valid new parent.
 */
export function blockContainers(fields: readonly Field[], values: FieldValues): BlockContainer[] {
  const out: BlockContainer[] = []
  collectContainers(fields, values, [], out)
  return out
}

/** How many levels of children hang off `block`, at its deepest. */
function blockTreeHeight(block: BlockValue, schema: BlockSchema): number {
  let height = 0
  for (const field of schema.fields) {
    if (field.kind !== 'blocks') continue
    const raw = block.settings[field.key]
    if (!Array.isArray(raw)) continue
    for (const child of raw as unknown as BlockValue[]) {
      const childSchema = field.blocks.find((candidate) => candidate.type === child.type)
      if (!childSchema) continue
      height = Math.max(height, 1 + blockTreeHeight(child, childSchema))
    }
  }
  return height
}

function destinationFor(
  fields: readonly Field[],
  values: FieldValues,
  found: FoundBlock,
  target: { parentId: string | null; fieldKey: string },
): { container: BlockContainer; removed: FieldValues } | null {
  if (target.parentId === found.block.id) return null
  const removed = removeBlock(fields, values, found.block.id)
  if (!removed) return null
  const container = blockContainers(fields, removed).find(
    (candidate) => candidate.parentId === target.parentId && candidate.fieldKey === target.fieldKey,
  )
  if (!container) return null
  if (container.count >= container.field.max) return null
  // The moved block sits at the container's depth; its own children add to it.
  if (container.path.length + blockTreeHeight(found.block, found.schema) > MAX_BLOCK_DEPTH) {
    return null
  }
  return { container, removed }
}

/** Whether `moveBlockTo` would accept this destination, for enabling a menu item. */
export function canMoveBlockTo(
  fields: readonly Field[],
  values: FieldValues,
  id: string,
  target: { parentId: string | null; fieldKey: string },
): boolean {
  const found = findBlock(fields, values, id)
  return found ? destinationFor(fields, values, found, target) !== null : false
}

/**
 * `values` with block `id` moved to the end of the blocks field a parent menu
 * named. The block keeps its id, its own name, its settings and its children.
 * `null` when the destination is stale, full, the block's own subtree, or too
 * deep for the storage limit.
 */
export function moveBlockTo(
  fields: readonly Field[],
  values: FieldValues,
  id: string,
  target: { parentId: string | null; fieldKey: string },
): FieldValues | null {
  const found = findBlock(fields, values, id)
  if (!found) return null
  const destination = destinationFor(fields, values, found, target)
  if (!destination) return null
  return insertBlock(fields, destination.removed, target, destination.container.count, found.block)
}

/* -------------------------------------------------------------------------- */
/* Inserting a dragged block                                                  */
/* -------------------------------------------------------------------------- */

function splice<T>(list: readonly T[], index: number, item: T): T[] {
  const next = [...list]
  next.splice(Math.max(0, Math.min(list.length, index)), 0, item)
  return next
}

/**
 * The blocks of the container a drop named: the top-level blocks field when
 * `parentId` is `null`, otherwise the `fieldKey` blocks field inside the block
 * with that id. `null` when the container does not exist or is full.
 */
function insertInto(
  fields: readonly Field[],
  values: FieldValues,
  parentId: string | null,
  fieldKey: string,
  index: number,
  block: BlockValue,
): FieldValues | null {
  for (const field of fields) {
    const raw = values[field.key]
    if (field.kind === 'blocks' && Array.isArray(raw)) {
      const blocks = raw as unknown as BlockValue[]
      if (parentId === null && field.key === fieldKey) {
        if (blocks.length >= field.max) return null
        return { ...values, [field.key]: splice(blocks, index, block) as unknown as JsonValue }
      }
      for (let at = 0; at < blocks.length; at++) {
        const candidate = blocks[at]!
        if (!isRecord(candidate.settings)) continue
        if (candidate.id === parentId) {
          const container = field.blocks
            .find((schema) => schema.type === candidate.type)
            ?.fields.find((inner) => inner.kind === 'blocks' && inner.key === fieldKey)
          if (!container || container.kind !== 'blocks') return null
          const children = Array.isArray(candidate.settings[fieldKey])
            ? (candidate.settings[fieldKey] as unknown as BlockValue[])
            : []
          if (children.length >= container.max) return null
          const next = [...blocks]
          next[at] = {
            ...candidate,
            settings: {
              ...candidate.settings,
              [fieldKey]: splice(children, index, block) as unknown as JsonValue,
            },
          }
          return { ...values, [field.key]: next as unknown as JsonValue }
        }
        const schema = field.blocks.find(
          (candidateSchema) => candidateSchema.type === candidate.type,
        )
        if (!schema) continue
        const nested = insertInto(
          schema.fields,
          candidate.settings as FieldValues,
          parentId,
          fieldKey,
          index,
          block,
        )
        if (nested) {
          const next = [...blocks]
          next[at] = { ...candidate, settings: nested }
          return { ...values, [field.key]: next as unknown as JsonValue }
        }
      }
    }
    if (field.kind === 'list' && Array.isArray(raw)) {
      const items = raw as unknown as FieldValues[]
      for (let at = 0; at < items.length; at++) {
        const nested = insertInto(field.fields, items[at]!, parentId, fieldKey, index, block)
        if (nested) {
          const next = [...items]
          next[at] = nested
          return { ...values, [field.key]: next as unknown as JsonValue }
        }
      }
    }
  }
  return null
}

/**
 * `values` with `block` inserted at `index` in the blocks container a drop
 * pointed at — the top-level field when `parentId` is `null`, or a nested
 * column, row or grid row otherwise. `null` when that container is full or no
 * longer exists, so a stale drop can never corrupt the tree.
 */
export function insertBlock(
  fields: readonly Field[],
  values: FieldValues,
  target: { parentId: string | null; fieldKey: string },
  index: number,
  block: BlockValue,
): FieldValues | null {
  return insertInto(fields, values, target.parentId, target.fieldKey, index, block)
}
