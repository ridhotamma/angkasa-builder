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
import { isRecord, newId } from './fields'
import { FEATURE_ICONS, FEATURE_ICON_LABELS } from './icons'
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

const text: BlockSchema = {
  type: 'text',
  name: { en: 'Text', id: 'Teks' },
  description: {
    en: 'A paragraph. Blank lines make new paragraphs.',
    id: 'Sebuah paragraf. Baris kosong memisahkan paragraf.',
  },
  fields: [
    {
      kind: 'textarea',
      key: 'body',
      label: { en: 'Text', id: 'Teks' },
      max: 2000,
      rows: 5,
      default: '',
    },
    textSizeField(),
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
    contentWidthField(),
    alignmentField(),
  ],
}

const spacer: BlockSchema = {
  type: 'spacer',
  name: { en: 'Spacer', id: 'Penyela' },
  description: {
    en: 'A deliberate gap on the spacing scale.',
    id: 'Jeda dengan skala jarak yang sama.',
  },
  fields: [spaceField('size', { en: 'Height', id: 'Tinggi' }, 'md')],
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

const columns: BlockSchema = {
  type: 'columns',
  name: { en: 'Two columns', id: 'Dua kolom' },
  description: {
    en: 'Two columns side by side, stacking on phones.',
    id: 'Dua kolom berdampingan, menumpuk di ponsel.',
  },
  fields: [
    {
      kind: 'select',
      key: 'layout',
      label: { en: 'Layout', id: 'Tata letak' },
      options: [
        { value: 'equal', label: { en: 'Equal halves', id: 'Dua bagian sama' } },
        { value: 'leftWide', label: { en: 'Wider left', id: 'Kiri lebih lebar' } },
        { value: 'rightWide', label: { en: 'Wider right', id: 'Kanan lebih lebar' } },
      ],
      default: 'equal',
    },
    spaceField('gap', { en: 'Gap', id: 'Jarak' }, 'lg'),
    {
      kind: 'select',
      key: 'align',
      label: { en: 'Vertical alignment', id: 'Perataan vertikal' },
      options: [
        { value: 'start', label: { en: 'Top', id: 'Atas' } },
        { value: 'center', label: { en: 'Middle', id: 'Tengah' } },
        { value: 'end', label: { en: 'Bottom', id: 'Bawah' } },
      ],
      default: 'start',
    },
    nested('left', { en: 'Left column', id: 'Kolom kiri' }, 20),
    nested('right', { en: 'Right column', id: 'Kolom kanan' }, 20),
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
      kind: 'select',
      key: 'icon',
      label: { en: 'Icon', id: 'Ikon' },
      options: FEATURE_ICONS.map((value) => ({ value, label: FEATURE_ICON_LABELS[value] })),
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

const divider: BlockSchema = {
  type: 'divider',
  name: { en: 'Divider', id: 'Pembatas' },
  description: {
    en: 'A horizontal line, with room above and below.',
    id: 'Garis mendatar, dengan ruang di atas dan bawahnya.',
  },
  fields: [
    spaceField('spacing', { en: 'Space around', id: 'Jarak sekeliling' }, 'md'),
    {
      kind: 'select',
      key: 'thickness',
      label: { en: 'Thickness', id: 'Ketebalan' },
      options: [
        { value: 'thin', label: { en: 'Hairline', id: 'Sangat tipis' } },
        { value: 'medium', label: { en: 'Thin', id: 'Tipis' } },
        { value: 'thick', label: { en: 'Thick', id: 'Tebal' } },
      ],
      default: 'thin',
    },
    {
      kind: 'select',
      key: 'tone',
      label: { en: 'Colour', id: 'Warna' },
      options: [
        { value: 'subtle', label: { en: 'Subtle', id: 'Samar' } },
        { value: 'border', label: { en: 'Border', id: 'Garis tepi' } },
        { value: 'strong', label: { en: 'Strong', id: 'Kuat' } },
        { value: 'brand', label: { en: 'Brand', id: 'Brand' } },
      ],
      default: 'border',
    },
    contentWidthField(),
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
 * A heading that folds open to reveal its answer — one FAQ item, a shipping
 * note, anything explained on demand. Neighbouring collapsible blocks each
 * fold on their own, so stacking a few builds an FAQ without a list field.
 */
const collapsible: BlockSchema = {
  type: 'collapsible',
  name: { en: 'Collapsible', id: 'Lipatan' },
  description: {
    en: 'A heading that opens to show its answer — an FAQ item, or anything explained on demand.',
    id: 'Judul yang membuka untuk menampilkan jawabannya — item tanya jawab, atau apa pun yang dijelaskan saat dibutuhkan.',
  },
  fields: [
    {
      kind: 'text',
      key: 'heading',
      label: { en: 'Heading', id: 'Judul' },
      max: 120,
      default: '',
    },
    {
      kind: 'richtext',
      key: 'body',
      label: { en: 'Answer', id: 'Jawaban' },
      max: 3000,
      default: '',
    },
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

BLOCK_TYPES.push(
  heading,
  text,
  button,
  image,
  spacer,
  column,
  columns,
  row,
  grid,
  richText,
  icon,
  divider,
  video,
  badge,
  rating,
  collapsible,
  mediaCard,
)

export function blockSchema(type: string): BlockSchema | null {
  return BLOCK_TYPES.find((block) => block.type === type) ?? null
}

/* -------------------------------------------------------------------------- */
/* Ready-made primitive layouts                                               */
/* -------------------------------------------------------------------------- */

/**
 * Webflow-style starter blocks: whole common layouts — a split hero, a
 * feature grid, pricing, an FAQ list, a call to action and a stats row —
 * composed entirely from the primitives above. A preset is only settings, so
 * a seller picks one from the add-section picker and then edits every block
 * of it like any other, on the same scale and with the same style overrides.
 *
 * Ids are deliberately absent: the sanitiser gives each block a fresh one,
 * so two copies of a preset never share ids.
 */
const BLOCK_PRESETS = [
  {
    key: 'hero-split',
    name: { en: 'Hero — split', id: 'Sampul — terbagi' },
    description: {
      en: 'A headline, text and a button beside a photo.',
      id: 'Judul, teks, dan tombol di samping foto.',
    },
    settings: {
      gap: 'lg',
      blocks: [
        {
          type: 'grid',
          settings: {
            columns: '2',
            gap: 'xl',
            align: 'center',
            stackOnMobile: true,
            padding: 'none',
            blocks: [
              {
                type: 'column',
                settings: {
                  gap: 'md',
                  padding: 'none',
                  width: 'full',
                  align: 'left',
                  blocks: [
                    {
                      type: 'heading',
                      settings: {
                        text: 'Judul yang jelas dan percaya diri',
                        level: 'h1',
                        size: '3xl',
                        align: 'left',
                        width: 'full',
                      },
                    },
                    {
                      type: 'text',
                      settings: {
                        body: 'Satu-dua kalimat tentang kenapa pembeli harus memilih toko ini.',
                        size: 'lg',
                        align: 'left',
                        width: 'full',
                      },
                    },
                    {
                      type: 'button',
                      settings: {
                        label: 'Belanja sekarang',
                        link: { kind: 'none' },
                        size: 'lg',
                        padding: 'default',
                        width: 'auto',
                        align: 'left',
                        variant: 'solid',
                        tone: 'brand',
                        hover: 'fill-up',
                      },
                    },
                  ],
                },
              },
              {
                type: 'column',
                settings: {
                  gap: 'md',
                  padding: 'none',
                  width: 'full',
                  align: 'left',
                  blocks: [
                    {
                      type: 'image',
                      settings: {
                        image: '',
                        alt: 'Foto produk',
                        ratio: '4/3',
                        rounded: 'lg',
                        width: 'full',
                        align: 'left',
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  },
  {
    key: 'feature-grid',
    name: { en: 'Features — three icons', id: 'Fitur — tiga ikon' },
    description: {
      en: 'Three promises, each with an icon, a title and a line of text.',
      id: 'Tiga janji, masing-masing dengan ikon, judul, dan satu baris teks.',
    },
    settings: {
      gap: 'lg',
      blocks: [
        {
          type: 'grid',
          settings: {
            columns: '3',
            gap: 'lg',
            align: 'start',
            stackOnMobile: true,
            padding: 'none',
            blocks: [
              {
                type: 'column',
                settings: {
                  gap: 'sm',
                  padding: 'none',
                  width: 'full',
                  align: 'left',
                  blocks: [
                    {
                      type: 'icon',
                      settings: { icon: 'leaf', size: 'lg', tone: 'brand', align: 'left' },
                    },
                    {
                      type: 'heading',
                      settings: {
                        text: 'Alami',
                        level: 'h3',
                        size: 'md',
                        align: 'left',
                        width: 'full',
                      },
                    },
                    {
                      type: 'text',
                      settings: {
                        body: 'Bahan yang bisa dilacak asalnya.',
                        size: 'md',
                        align: 'left',
                        width: 'full',
                      },
                    },
                  ],
                },
              },
              {
                type: 'column',
                settings: {
                  gap: 'sm',
                  padding: 'none',
                  width: 'full',
                  align: 'left',
                  blocks: [
                    {
                      type: 'icon',
                      settings: { icon: 'truck', size: 'lg', tone: 'brand', align: 'left' },
                    },
                    {
                      type: 'heading',
                      settings: {
                        text: 'Kirim cepat',
                        level: 'h3',
                        size: 'md',
                        align: 'left',
                        width: 'full',
                      },
                    },
                    {
                      type: 'text',
                      settings: {
                        body: 'Dikirim di hari yang sama.',
                        size: 'md',
                        align: 'left',
                        width: 'full',
                      },
                    },
                  ],
                },
              },
              {
                type: 'column',
                settings: {
                  gap: 'sm',
                  padding: 'none',
                  width: 'full',
                  align: 'left',
                  blocks: [
                    {
                      type: 'icon',
                      settings: { icon: 'shield', size: 'lg', tone: 'brand', align: 'left' },
                    },
                    {
                      type: 'heading',
                      settings: {
                        text: 'Aman',
                        level: 'h3',
                        size: 'md',
                        align: 'left',
                        width: 'full',
                      },
                    },
                    {
                      type: 'text',
                      settings: {
                        body: 'Dana ditahan sampai barang tiba.',
                        size: 'md',
                        align: 'left',
                        width: 'full',
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  },
  {
    key: 'pricing-3',
    name: { en: 'Pricing — three tiers', id: 'Harga — tiga paket' },
    description: {
      en: 'Three price cards side by side, the middle one highlighted.',
      id: 'Tiga kartu harga berdampingan, yang tengah disorot.',
    },
    settings: {
      gap: 'lg',
      blocks: [
        {
          type: 'grid',
          settings: {
            columns: '3',
            gap: 'lg',
            align: 'stretch',
            stackOnMobile: true,
            padding: 'none',
            blocks: [
              {
                type: 'column',
                style: {
                  borderWidth: '1',
                  borderColor: '#e5e5e5',
                  borderRadius: 'lg',
                  padding: 'md',
                },
                settings: {
                  gap: 'sm',
                  padding: 'none',
                  width: 'full',
                  align: 'left',
                  blocks: [
                    { type: 'heading', settings: { text: 'Mulai', level: 'h3', size: 'md' } },
                    { type: 'heading', settings: { text: 'Rp 99.000', level: 'h2', size: 'xl' } },
                    { type: 'text', settings: { body: 'Untuk toko yang baru membuka.' } },
                    {
                      type: 'button',
                      settings: {
                        label: 'Pilih paket',
                        link: { kind: 'none' },
                        variant: 'outline',
                        tone: 'brand',
                        width: 'full',
                        align: 'left',
                      },
                    },
                  ],
                },
              },
              {
                type: 'column',
                style: {
                  borderWidth: '2',
                  borderColor: '#111111',
                  borderRadius: 'lg',
                  padding: 'md',
                  backgroundColor: '#f7f7f2',
                },
                settings: {
                  gap: 'sm',
                  padding: 'none',
                  width: 'full',
                  align: 'left',
                  blocks: [
                    { type: 'heading', settings: { text: 'Tumbuh', level: 'h3', size: 'md' } },
                    { type: 'heading', settings: { text: 'Rp 199.000', level: 'h2', size: 'xl' } },
                    { type: 'text', settings: { body: 'Untuk toko yang sedang naik.' } },
                    {
                      type: 'button',
                      settings: {
                        label: 'Pilih paket',
                        link: { kind: 'none' },
                        variant: 'solid',
                        tone: 'brand',
                        width: 'full',
                        align: 'left',
                        hover: 'fill-up',
                      },
                    },
                  ],
                },
              },
              {
                type: 'column',
                style: {
                  borderWidth: '1',
                  borderColor: '#e5e5e5',
                  borderRadius: 'lg',
                  padding: 'md',
                },
                settings: {
                  gap: 'sm',
                  padding: 'none',
                  width: 'full',
                  align: 'left',
                  blocks: [
                    { type: 'heading', settings: { text: 'Besar', level: 'h3', size: 'md' } },
                    { type: 'heading', settings: { text: 'Rp 399.000', level: 'h2', size: 'xl' } },
                    { type: 'text', settings: { body: 'Untuk tim dan banyak produk.' } },
                    {
                      type: 'button',
                      settings: {
                        label: 'Hubungi kami',
                        link: { kind: 'none' },
                        variant: 'outline',
                        tone: 'brand',
                        width: 'full',
                        align: 'left',
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  },
  {
    key: 'faq-list',
    name: { en: 'FAQ — questions and answers', id: 'Tanya jawab — daftar' },
    description: {
      en: 'A stack of question-and-answer pairs.',
      id: 'Tumpukan pasangan pertanyaan dan jawaban.',
    },
    settings: {
      gap: 'lg',
      blocks: [
        {
          type: 'column',
          settings: {
            gap: 'lg',
            padding: 'none',
            width: 'medium',
            align: 'left',
            blocks: [
              {
                type: 'column',
                settings: {
                  gap: 'sm',
                  padding: 'none',
                  width: 'full',
                  align: 'left',
                  blocks: [
                    {
                      type: 'heading',
                      settings: {
                        text: 'Berapa lama pengirimannya?',
                        level: 'h3',
                        size: 'md',
                        align: 'left',
                        width: 'full',
                      },
                    },
                    {
                      type: 'text',
                      settings: {
                        body: 'Diproses 1×24 jam, tiba 1–4 hari tergantung kota.',
                        align: 'left',
                        width: 'full',
                      },
                    },
                  ],
                },
              },
              {
                type: 'column',
                settings: {
                  gap: 'sm',
                  padding: 'none',
                  width: 'full',
                  align: 'left',
                  blocks: [
                    {
                      type: 'heading',
                      settings: {
                        text: 'Apakah bisa COD?',
                        level: 'h3',
                        size: 'md',
                        align: 'left',
                        width: 'full',
                      },
                    },
                    {
                      type: 'text',
                      settings: {
                        body: 'Bisa, untuk area yang didukung kurir.',
                        align: 'left',
                        width: 'full',
                      },
                    },
                  ],
                },
              },
              {
                type: 'column',
                settings: {
                  gap: 'sm',
                  padding: 'none',
                  width: 'full',
                  align: 'left',
                  blocks: [
                    {
                      type: 'heading',
                      settings: {
                        text: 'Bagaimana cara retur?',
                        level: 'h3',
                        size: 'md',
                        align: 'left',
                        width: 'full',
                      },
                    },
                    {
                      type: 'text',
                      settings: {
                        body: 'Ajukan dalam 7 hari lewat halaman pesanan.',
                        align: 'left',
                        width: 'full',
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  },
  {
    key: 'cta-band',
    name: { en: 'Call to action — centered band', id: 'Ajakan — pita tengah' },
    description: {
      en: 'A short message and a button on a brand-coloured band.',
      id: 'Pesan singkat dan tombol di pita warna brand.',
    },
    settings: {
      gap: 'md',
      blocks: [
        {
          type: 'column',
          settings: {
            gap: 'md',
            padding: 'none',
            width: 'medium',
            align: 'center',
            blocks: [
              {
                type: 'heading',
                settings: {
                  text: 'Siap mulai?',
                  level: 'h2',
                  size: '2xl',
                  align: 'center',
                  width: 'full',
                },
              },
              {
                type: 'text',
                settings: {
                  body: 'Gabung bersama ribuan pembeli yang sudah menemukan barang favoritnya.',
                  size: 'lg',
                  align: 'center',
                  width: 'full',
                },
              },
              {
                type: 'button',
                settings: {
                  label: 'Mulai sekarang',
                  link: { kind: 'none' },
                  size: 'lg',
                  padding: 'default',
                  width: 'auto',
                  align: 'center',
                  variant: 'solid',
                  tone: 'brand',
                  hover: 'fill-up',
                },
              },
            ],
          },
        },
      ],
    },
    style: { colorScheme: 'brand', paddingTop: 'xl', paddingBottom: 'xl' },
  },
  {
    key: 'stats-row',
    name: { en: 'Stats — three numbers', id: 'Statistik — tiga angka' },
    description: {
      en: 'Three big numbers with a line each.',
      id: 'Tiga angka besar dengan satu baris penjelasan.',
    },
    settings: {
      gap: 'lg',
      blocks: [
        {
          type: 'grid',
          settings: {
            columns: '3',
            gap: 'lg',
            align: 'start',
            stackOnMobile: true,
            padding: 'none',
            blocks: [
              {
                type: 'column',
                settings: {
                  gap: 'sm',
                  padding: 'none',
                  width: 'full',
                  align: 'center',
                  blocks: [
                    {
                      type: 'heading',
                      settings: {
                        text: '10rb+',
                        level: 'h2',
                        size: '2xl',
                        align: 'center',
                        width: 'full',
                      },
                    },
                    {
                      type: 'text',
                      settings: { body: 'Pesanan dikirim', align: 'center', width: 'full' },
                    },
                  ],
                },
              },
              {
                type: 'column',
                settings: {
                  gap: 'sm',
                  padding: 'none',
                  width: 'full',
                  align: 'center',
                  blocks: [
                    {
                      type: 'heading',
                      settings: {
                        text: '4,9/5',
                        level: 'h2',
                        size: '2xl',
                        align: 'center',
                        width: 'full',
                      },
                    },
                    {
                      type: 'text',
                      settings: { body: 'Rating pembeli', align: 'center', width: 'full' },
                    },
                  ],
                },
              },
              {
                type: 'column',
                settings: {
                  gap: 'sm',
                  padding: 'none',
                  width: 'full',
                  align: 'center',
                  blocks: [
                    {
                      type: 'heading',
                      settings: {
                        text: '24 jam',
                        level: 'h2',
                        size: '2xl',
                        align: 'center',
                        width: 'full',
                      },
                    },
                    {
                      type: 'text',
                      settings: { body: 'Balasan tim kami', align: 'center', width: 'full' },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  },
  {
    key: 'statement',
    name: { en: 'Statement — editorial', id: 'Pernyataan — editorial' },
    description: {
      en: 'A large centred statement over a dark band.',
      id: 'Pernyataan besar di tengah pita gelap.',
    },
    settings: {
      gap: 'md',
      blocks: [
        {
          type: 'column',
          settings: {
            gap: 'md',
            padding: 'none',
            width: 'medium',
            align: 'center',
            blocks: [
              {
                type: 'badge',
                settings: { text: 'Kabar terbaru', tone: 'subtle', size: 'sm', align: 'center' },
              },
              {
                type: 'heading',
                settings: {
                  text: 'Satu pernyataan yang jelas',
                  level: 'h2',
                  size: '3xl',
                  align: 'center',
                  width: 'full',
                },
              },
              {
                type: 'richtext',
                settings: {
                  body: 'Dua-tiga kalimat yang menjelaskan kenapa ini penting, dengan penekanan pada hal yang benar-benar kamu percaya.',
                  align: 'center',
                  width: 'full',
                },
              },
              {
                type: 'button',
                settings: {
                  label: 'Baca selengkapnya',
                  link: { kind: 'none' },
                  size: 'lg',
                  padding: 'default',
                  width: 'auto',
                  align: 'center',
                  variant: 'outline',
                  tone: 'brand',
                  hover: 'fill-up',
                },
              },
            ],
          },
        },
      ],
    },
    style: { colorScheme: 'inverse', paddingTop: 'xl', paddingBottom: 'xl' },
  },
  {
    key: 'image-text',
    name: { en: 'Image and text', id: 'Gambar dan teks' },
    description: {
      en: 'A photo beside a heading, a paragraph and a button.',
      id: 'Foto di samping judul, paragraf, dan tombol.',
    },
    settings: {
      gap: 'lg',
      blocks: [
        {
          type: 'grid',
          settings: {
            columns: '2',
            gap: 'xl',
            align: 'center',
            stackOnMobile: true,
            padding: 'none',
            blocks: [
              {
                type: 'image',
                settings: {
                  image: '',
                  alt: 'Foto produk',
                  ratio: '4/3',
                  rounded: 'lg',
                  width: 'full',
                  align: 'left',
                },
              },
              {
                type: 'column',
                settings: {
                  gap: 'md',
                  padding: 'none',
                  width: 'full',
                  align: 'left',
                  blocks: [
                    {
                      type: 'heading',
                      settings: { text: 'Judul bagian', level: 'h2', size: 'xl' },
                    },
                    {
                      type: 'richtext',
                      settings: {
                        body: 'Ceritakan bahan, proses, atau alasan barang ini dibuat.',
                        align: 'left',
                        width: 'full',
                      },
                    },
                    {
                      type: 'button',
                      settings: {
                        label: 'Selengkapnya',
                        link: { kind: 'none' },
                        size: 'md',
                        padding: 'default',
                        width: 'auto',
                        align: 'left',
                        variant: 'solid',
                        tone: 'brand',
                        hover: 'fill-up',
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  },
  {
    key: 'cards-three',
    name: { en: 'Cards — three', id: 'Kartu — tiga' },
    description: {
      en: 'Three bordered cards with a title and a line of text each.',
      id: 'Tiga kartu bergaris dengan judul dan satu baris teks.',
    },
    settings: {
      gap: 'lg',
      blocks: [
        {
          type: 'grid',
          settings: {
            columns: '3',
            gap: 'lg',
            align: 'stretch',
            stackOnMobile: true,
            padding: 'none',
            blocks: [
              {
                type: 'column',
                style: {
                  padding: 'md',
                  borderRadius: 'lg',
                  borderWidth: '1',
                  borderColor: '#e5e5e5',
                },
                settings: {
                  gap: 'sm',
                  padding: 'none',
                  width: 'full',
                  align: 'left',
                  blocks: [
                    { type: 'heading', settings: { text: 'Judul kartu', level: 'h3', size: 'md' } },
                    { type: 'text', settings: { body: 'Satu-dua baris penjelasan singkat.' } },
                  ],
                },
              },
              {
                type: 'column',
                style: {
                  padding: 'md',
                  borderRadius: 'lg',
                  borderWidth: '1',
                  borderColor: '#e5e5e5',
                },
                settings: {
                  gap: 'sm',
                  padding: 'none',
                  width: 'full',
                  align: 'left',
                  blocks: [
                    { type: 'heading', settings: { text: 'Judul kartu', level: 'h3', size: 'md' } },
                    { type: 'text', settings: { body: 'Satu-dua baris penjelasan singkat.' } },
                  ],
                },
              },
              {
                type: 'column',
                style: {
                  padding: 'md',
                  borderRadius: 'lg',
                  borderWidth: '1',
                  borderColor: '#e5e5e5',
                },
                settings: {
                  gap: 'sm',
                  padding: 'none',
                  width: 'full',
                  align: 'left',
                  blocks: [
                    { type: 'heading', settings: { text: 'Judul kartu', level: 'h3', size: 'md' } },
                    { type: 'text', settings: { body: 'Satu-dua baris penjelasan singkat.' } },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  },
  {
    key: 'photo-cards',
    name: { en: 'Cards — photos with text', id: 'Kartu — foto dengan teks' },
    description: {
      en: 'Three cards, each a full photo with a title and a line centred on it.',
      id: 'Tiga kartu, masing-masing foto penuh dengan judul dan satu baris teks di tengahnya.',
    },
    settings: {
      gap: 'lg',
      blocks: [
        {
          type: 'heading',
          settings: {
            text: 'Pilih favoritmu',
            level: 'h2',
            size: 'xl',
            align: 'center',
            width: 'full',
          },
        },
        {
          type: 'grid',
          settings: {
            columns: '3',
            gap: 'lg',
            align: 'stretch',
            stackOnMobile: true,
            padding: 'none',
            blocks: [
              {
                type: 'media-card',
                settings: {
                  image: '',
                  alt: '',
                  overlay: 'gradient',
                  contentPosition: 'middle',
                  height: 'md',
                  padding: 'md',
                  gap: 'sm',
                  rounded: 'lg',
                  blocks: [
                    {
                      type: 'heading',
                      settings: {
                        text: 'Judul kartu',
                        level: 'h3',
                        size: 'lg',
                        align: 'center',
                        width: 'full',
                      },
                    },
                    {
                      type: 'text',
                      settings: {
                        body: 'Satu-dua baris penjelasan singkat.',
                        size: 'md',
                        align: 'center',
                        width: 'full',
                      },
                    },
                  ],
                },
              },
              {
                type: 'media-card',
                settings: {
                  image: '',
                  alt: '',
                  overlay: 'gradient',
                  contentPosition: 'middle',
                  height: 'md',
                  padding: 'md',
                  gap: 'sm',
                  rounded: 'lg',
                  blocks: [
                    {
                      type: 'heading',
                      settings: {
                        text: 'Judul kartu',
                        level: 'h3',
                        size: 'lg',
                        align: 'center',
                        width: 'full',
                      },
                    },
                    {
                      type: 'text',
                      settings: {
                        body: 'Satu-dua baris penjelasan singkat.',
                        size: 'md',
                        align: 'center',
                        width: 'full',
                      },
                    },
                  ],
                },
              },
              {
                type: 'media-card',
                settings: {
                  image: '',
                  alt: '',
                  overlay: 'gradient',
                  contentPosition: 'middle',
                  height: 'md',
                  padding: 'md',
                  gap: 'sm',
                  rounded: 'lg',
                  blocks: [
                    {
                      type: 'heading',
                      settings: {
                        text: 'Judul kartu',
                        level: 'h3',
                        size: 'lg',
                        align: 'center',
                        width: 'full',
                      },
                    },
                    {
                      type: 'text',
                      settings: {
                        body: 'Satu-dua baris penjelasan singkat.',
                        size: 'md',
                        align: 'center',
                        width: 'full',
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  },
  {
    key: 'reviews-three',
    name: { en: 'Reviews — three cards', id: 'Ulasan — tiga kartu' },
    description: {
      en: 'Three customer quotes in soft cards.',
      id: 'Tiga kutipan pelanggan dalam kartu lembut.',
    },
    settings: {
      gap: 'lg',
      blocks: [
        {
          type: 'grid',
          settings: {
            columns: '3',
            gap: 'lg',
            align: 'stretch',
            stackOnMobile: true,
            padding: 'none',
            blocks: [
              {
                type: 'column',
                style: { padding: 'md', borderRadius: 'lg', backgroundColor: '#f5f5f5' },
                settings: {
                  gap: 'sm',
                  padding: 'none',
                  width: 'full',
                  align: 'left',
                  blocks: [
                    {
                      type: 'text',
                      settings: { body: '“Kualitasnya melebihi ekspektasi.”', size: 'lg' },
                    },
                    { type: 'heading', settings: { text: 'Rina', level: 'h3', size: 'md' } },
                    { type: 'text', settings: { body: 'Jakarta' } },
                  ],
                },
              },
              {
                type: 'column',
                style: { padding: 'md', borderRadius: 'lg', backgroundColor: '#f5f5f5' },
                settings: {
                  gap: 'sm',
                  padding: 'none',
                  width: 'full',
                  align: 'left',
                  blocks: [
                    {
                      type: 'text',
                      settings: { body: '“Sampainya cepat dan packing rapi.”', size: 'lg' },
                    },
                    { type: 'heading', settings: { text: 'Bagas', level: 'h3', size: 'md' } },
                    { type: 'text', settings: { body: 'Bandung' } },
                  ],
                },
              },
              {
                type: 'column',
                style: { padding: 'md', borderRadius: 'lg', backgroundColor: '#f5f5f5' },
                settings: {
                  gap: 'sm',
                  padding: 'none',
                  width: 'full',
                  align: 'left',
                  blocks: [
                    { type: 'text', settings: { body: '“Adminnya cepat membantu.”', size: 'lg' } },
                    { type: 'heading', settings: { text: 'Sari', level: 'h3', size: 'md' } },
                    { type: 'text', settings: { body: 'Surabaya' } },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  },
] as const

// `as const` keeps the section's type a literal, so the library's union of
// section types does not widen to `string` where this schema is registered.
export const blocksSectionSchema = {
  type: 'blocks',
  name: { en: 'Blocks', id: 'Blok' },
  description: {
    en: 'Every layout, built from blocks: headings, text, buttons, images, icons, badges, video, ratings, collapsibles, rows, columns and grids — each one styleable on its own.',
    id: 'Semua tata letak, dibangun dari blok: judul, teks, tombol, gambar, ikon, lencana, video, rating, lipatan, baris, kolom, dan kisi — masing-masing bisa diatur gayanya.',
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
      defaultBlocks: ['heading', 'text', 'button'],
      styleFields: BLOCK_STYLE_FIELDS,
    },
    spaceField('gap', { en: 'Spacing between blocks', id: 'Jarak antar blok' }, 'md'),
  ],
  presets: BLOCK_PRESETS,
} as const satisfies SectionSchema

/**
 * The Custom section: the same composer under a name that says what it is
 * for — a blank canvas when none of the ready-made sections fit. It is a thin
 * alias of the Blocks section (same fields, same renderer, no presets), not a
 * second engine; the docs' "Custom section" is this primitive tree.
 */
export const customSectionSchema = {
  type: 'custom',
  name: { en: 'Custom layout', id: 'Tata letak kustom' },
  description: {
    en: 'A blank canvas: compose anything from headings, text, buttons, images, video, icons, badges, ratings, collapsibles, rows, columns and grids.',
    id: 'Kanvas kosong: susun apa pun dari judul, teks, tombol, gambar, video, ikon, lencana, rating, lipatan, baris, kolom, dan kisi.',
  },
  category: 'layout',
  icon: 'blocks',
  fields: blocksSectionSchema.fields,
} as const satisfies SectionSchema

/* -------------------------------------------------------------------------- */
/* Walking a stored tree                                                      */
/* -------------------------------------------------------------------------- */

export interface FoundBlock {
  block: BlockValue
  schema: BlockSchema
  /** The blocks field the block sits in. */
  field: BlocksField
  /** Where the block sits among its siblings. */
  index: number
  /** How many siblings the containing field holds. */
  count: number
}

function blockIn(field: BlocksField, raw: unknown, id: string): FoundBlock | null {
  if (!Array.isArray(raw)) return null
  const blocks = raw as unknown as BlockValue[]
  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index]!
    if (block.id !== id) continue
    const schema = field.blocks.find((candidate) => candidate.type === block.type)
    return schema ? { block, schema, field, index, count: blocks.length } : null
  }
  for (const block of blocks) {
    const schema = field.blocks.find((candidate) => candidate.type === block.type)
    if (!schema || !isRecord(block.settings)) continue
    const nested = findBlock(schema.fields, block.settings as FieldValues, id)
    if (nested) return nested
  }
  return null
}

/** The block with `id`, wherever it sits — a column's child included. */
export function findBlock(
  fields: readonly Field[],
  values: FieldValues,
  id: string,
): FoundBlock | null {
  for (const field of fields) {
    const raw = values[field.key]
    if (field.kind === 'blocks') {
      const found = blockIn(field, raw, id)
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

/** The block removed, leaving its siblings; an empty field renders its empty state. */
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
function cloneBlock(block: BlockValue, schema: BlockSchema): BlockValue {
  return {
    id: newId(),
    type: block.type,
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
