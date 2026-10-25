/**
 * Ready-made layouts for a Custom blocks section: a grid of feature cards, an
 * image beside its text, a photo gallery — the arrangements a seller would
 * otherwise build block by block, from a row, two columns and their contents.
 *
 * Each preset is plain block data with sample content filled in, so it lands
 * looking finished and every part stays an ordinary block the seller can edit,
 * move or remove. The palette and Ctrl+K add them like any other block; the
 * sanitiser fills in every setting not named here.
 */

import type { Localized } from './localized'
import { SAMPLE_PHOTOS } from './sample-photos'

/** A block as a preset describes it: its type, and whatever it sets. */
export interface PresetBlock {
  type: string
  settings?: Record<string, unknown>
}

export interface BlockPreset {
  key: string
  name: Localized
  description: Localized
  /** The block type whose glyph stands for the preset in the palette. */
  glyph: string
  blocks: readonly PresetBlock[]
}

const heading = (text: string, level: 'h1' | 'h2' | 'h3' = 'h2'): PresetBlock => ({
  type: 'heading',
  settings: { text, level },
})
const text = (body: string): PresetBlock => ({ type: 'richtext', settings: { body } })
const button = (label: string): PresetBlock => ({ type: 'button', settings: { label } })
const image = (photo: string, ratio = '4/3'): PresetBlock => ({
  type: 'image',
  settings: { image: photo, ratio },
})
const icon = (name: string): PresetBlock => ({ type: 'icon', settings: { icon: name } })
const column = (blocks: PresetBlock[], settings: Record<string, unknown> = {}): PresetBlock => ({
  type: 'column',
  settings: { gap: 'sm', ...settings, blocks },
})
const grid = (
  columns: number,
  blocks: PresetBlock[],
  settings: Record<string, unknown> = {},
): PresetBlock => ({
  type: 'grid',
  settings: { columns: String(columns), gap: 'lg', ...settings, blocks },
})

export const BLOCK_PRESETS: readonly BlockPreset[] = [
  {
    key: 'image-text',
    name: { en: 'Image with text', id: 'Gambar dan teks' },
    description: {
      en: 'A photo on one side, a heading, text and a button on the other.',
      id: 'Foto di satu sisi, judul, teks, dan tombol di sisi lain.',
    },
    glyph: 'row',
    blocks: [
      grid(
        2,
        [
          image(SAMPLE_PHOTOS.storeInterior),
          column([
            heading('Made for everyday'),
            text('Tell shoppers what makes this product or collection worth a look.'),
            button('Shop now'),
          ]),
        ],
        { align: 'center' },
      ),
    ],
  },
  {
    key: 'features-3',
    name: { en: 'Three features', id: 'Tiga keunggulan' },
    description: {
      en: 'Three columns, each with an icon, a short title and a line of text.',
      id: 'Tiga kolom, masing-masing dengan ikon, judul singkat, dan satu baris teks.',
    },
    glyph: 'grid',
    blocks: [
      grid(3, [
        column([icon('truck'), heading('Fast delivery', 'h3'), text('Shipped the same day.')]),
        column([
          icon('shield-check'),
          heading('Secure payment', 'h3'),
          text('Pay the way you prefer.'),
        ]),
        column([icon('heart'), heading('Loved by customers', 'h3'), text('Rated 4.9 out of 5.')]),
      ]),
    ],
  },
  {
    key: 'cards-3',
    name: { en: 'Three image cards', id: 'Tiga kartu gambar' },
    description: {
      en: 'Three photos with a title, text and a button under each.',
      id: 'Tiga foto dengan judul, teks, dan tombol di bawah masing-masing.',
    },
    glyph: 'grid',
    blocks: [
      grid(3, [
        column([
          image(SAMPLE_PHOTOS.tshirts),
          heading('New arrivals', 'h3'),
          text('The latest pieces, just in.'),
          button('Explore'),
        ]),
        column([
          image(SAMPLE_PHOTOS.bags),
          heading('Best sellers', 'h3'),
          text('What everyone is buying.'),
          button('Explore'),
        ]),
        column([
          image(SAMPLE_PHOTOS.packaging),
          heading('Gift sets', 'h3'),
          text('Ready to give, wrapped.'),
          button('Explore'),
        ]),
      ]),
    ],
  },
  {
    key: 'gallery-4',
    name: { en: 'Photo grid', id: 'Kisi foto' },
    description: {
      en: 'Four square photos in a 2 × 2 grid — four across on a desktop.',
      id: 'Empat foto persegi dalam kisi 2 × 2 — empat berjajar di desktop.',
    },
    glyph: 'image',
    blocks: [
      grid(
        4,
        [
          image(SAMPLE_PHOTOS.clothesRack, '1/1'),
          image(SAMPLE_PHOTOS.sneakerWhite, '1/1'),
          image(SAMPLE_PHOTOS.watch, '1/1'),
          image(SAMPLE_PHOTOS.jewellery, '1/1'),
        ],
        { gap: 'sm', stackOnMobile: false },
      ),
    ],
  },
  {
    key: 'columns-2',
    name: { en: 'Two text columns', id: 'Dua kolom teks' },
    description: {
      en: 'Two columns of text side by side — a story and its details.',
      id: 'Dua kolom teks berdampingan — cerita dan rinciannya.',
    },
    glyph: 'column',
    blocks: [
      grid(2, [
        column([heading('Our story', 'h3'), text('How the shop started, and who is behind it.')]),
        column([heading('Our promise', 'h3'), text('What every customer can count on.')]),
      ]),
    ],
  },
  {
    key: 'call-to-action',
    name: { en: 'Call to action', id: 'Ajakan bertindak' },
    description: {
      en: 'A centred heading, a line of text and a button.',
      id: 'Judul di tengah, satu baris teks, dan tombol.',
    },
    glyph: 'button',
    blocks: [
      column(
        [
          heading('Ready to order?'),
          text('Pick your favourites and check out in a minute.'),
          button('Shop now'),
        ],
        { align: 'center', width: 'narrow', gap: 'md', padding: 'lg' },
      ),
    ],
  },
]
