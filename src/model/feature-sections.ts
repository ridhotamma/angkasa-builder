/**
 * The storefront feature sections (docs/PREMIUM-VISUALS.md, Tier 3 and the
 * local Tier 4 pieces): newsletter capture, video backgrounds, masonry and
 * social walls, team and press, an editorial statement, a split-screen band, a
 * video testimonial wall, a floating contact cluster and a 360° spin.
 *
 * Not a plan gate: every one of these is offered to every shop on the builder,
 * exactly like the core sections. "Feature" here means a richer look, nothing
 * about entitlement.
 *
 * Same model as every other section: pure data here, renderers in
 * `../render/feature-sections`, sanitised by the same field engine, drawn by
 * the same `SectionFrame`. Nothing here adds a collection or a second engine.
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
import { photoFitField, photoPositionField } from './section-style'
import type { SectionSchema } from './sections'

/* -------------------------------------------------------------------------- */
/* Field builders                                                             */
/* -------------------------------------------------------------------------- */

const text = (
  key: string,
  label: Localized,
  max: number,
  fallback = '',
  help?: Localized,
): TextField => ({
  kind: 'text',
  key,
  label,
  max,
  default: fallback,
  ...(help ? { help } : {}),
})

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
): SelectField => ({ kind: 'select', key, label, options, default: fallback })

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

/** The desktop count and the phone choice (one or two), like the core sections. */
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

/** Photos and videos over words: the shade that keeps the words readable. */
const overlayField: Field = choice(
  'overlay',
  { en: 'Shade', id: 'Peredup' },
  [
    { value: 'none', label: { en: 'None', id: 'Tidak ada' } },
    { value: 'light', label: { en: 'Light', id: 'Ringan' } },
    { value: 'dark', label: { en: 'Dark', id: 'Gelap' } },
  ],
  'dark',
)

/* -------------------------------------------------------------------------- */
/* Sections                                                                   */
/* -------------------------------------------------------------------------- */

export const FEATURE_SECTION_SCHEMAS = [
  {
    type: 'newsletter',
    category: 'promotion',
    icon: 'mail',
    hidden: true,
    name: { en: 'Newsletter', id: 'Buletin' },
    description: {
      en: 'A signup invitation that links to your own form — links first, no stored addresses.',
      id: 'Ajakan mendaftar yang mengarah ke formulir Anda — tautan dulu, tanpa menyimpan alamat.',
    },
    fields: [
      heading('Stay in the loop'),
      body(400),
      buttonLabel('Subscribe'),
      buttonLink,
      text(
        'note',
        { en: 'Small note', id: 'Catatan kecil' },
        160,
        'New drops and offers, once a month.',
      ),
      alignField('center'),
    ],
  },
  {
    type: 'background-video',
    category: 'media',
    icon: 'play',
    name: { en: 'Background video', id: 'Video latar' },
    description: {
      en: 'A looping video behind any message, with a poster and a shade. Muted and paused for reduced motion.',
      id: 'Video berulang di belakang pesan, dengan poster dan peredup. Dibisukan dan dijeda bila gerakan dikurangi.',
    },
    fields: [
      video('video', { en: 'Video', id: 'Video' }, true),
      image('poster', { en: 'Poster', id: 'Poster' }),
      photoFitField,
      photoPositionField,
      overlayField,
      choice(
        'height',
        { en: 'Height', id: 'Tinggi' },
        [
          { value: 'sm', label: { en: 'Short', id: 'Pendek' } },
          { value: 'md', label: { en: 'Medium', id: 'Sedang' } },
          { value: 'lg', label: { en: 'Tall', id: 'Tinggi' } },
          { value: 'screen', label: { en: 'Full screen', id: 'Satu layar' } },
        ],
        'lg',
      ),
      heading('Made for the moment'),
      subheading(''),
      body(600),
      buttonLabel('Discover'),
      buttonLink,
      choice(
        'contentPosition',
        { en: 'Content position', id: 'Posisi konten' },
        [
          { value: 'top', label: { en: 'Top', id: 'Atas' } },
          { value: 'middle', label: { en: 'Middle', id: 'Tengah' } },
          { value: 'bottom', label: { en: 'Bottom', id: 'Bawah' } },
        ],
        'middle',
      ),
      alignField('left'),
    ],
  },
  {
    type: 'masonry-gallery',
    category: 'media',
    icon: 'gallery',
    name: { en: 'Masonry gallery', id: 'Galeri masonry' },
    description: {
      en: 'Photos in a staggered grid; click one for a full-screen lightbox.',
      id: 'Foto dalam kisi berselang; klik untuk melihat layar penuh.',
    },
    fields: [
      heading(''),
      list('items', { en: 'Photos', id: 'Foto' }, { en: 'Photo', id: 'Foto' }, 'alt', 30, [
        image('image', { en: 'Photo', id: 'Foto' }),
        text('alt', { en: 'Description', id: 'Deskripsi' }, 160),
        link('link', { en: 'Link (optional)', id: 'Tautan (opsional)' }),
      ]),
      ...columnsField(['2', '3', '4'], '3'),
    ],
  },
  {
    type: 'video-testimonials',
    category: 'trust',
    icon: 'quote',
    name: { en: 'Video testimonials', id: 'Testimoni video' },
    description: {
      en: 'Customers in their own words, with a playable video for each.',
      id: 'Pelanggan dalam kata-kata mereka, dengan video yang bisa diputar.',
    },
    fields: [
      heading('In their words'),
      list(
        'items',
        { en: 'Testimonials', id: 'Testimoni' },
        { en: 'Testimonial', id: 'Testimoni' },
        'name',
        12,
        [
          text('name', { en: 'Name', id: 'Nama' }, 80),
          text('role', { en: 'Role or note', id: 'Peran atau catatan' }, 80),
          area('quote', { en: 'Quote', id: 'Kutipan' }, 400, 3),
          video('video', { en: 'Video', id: 'Video' }),
          image('poster', { en: 'Poster', id: 'Poster' }),
        ],
      ),
      ...columnsField(['2', '3'], '3'),
    ],
  },
  {
    type: 'team',
    category: 'text',
    icon: 'team',
    name: { en: 'Team', id: 'Tim' },
    description: {
      en: 'The people behind the shop — founders, makers, support.',
      id: 'Orang-orang di balik toko — pendiri, perajin, dukungan.',
    },
    fields: [
      heading('The people behind it'),
      body(500),
      list('items', { en: 'People', id: 'Orang' }, { en: 'Person', id: 'Orang' }, 'name', 12, [
        image('photo', { en: 'Photo', id: 'Foto' }),
        text('name', { en: 'Name', id: 'Nama' }, 80),
        text('role', { en: 'Role', id: 'Peran' }, 80),
        link('link', { en: 'Link (optional)', id: 'Tautan (opsional)' }),
      ]),
      ...columnsField(['2', '3', '4'], '3'),
      alignField('center'),
    ],
  },
  {
    type: 'editorial-statement',
    category: 'text',
    icon: 'statement',
    name: { en: 'Editorial statement', id: 'Pernyataan editorial' },
    description: {
      en: 'Giant type over a full-bleed photo — the About-page centrepiece.',
      id: 'Tipografi besar di atas foto penuh — inti halaman Tentang.',
    },
    fields: [
      image('image', { en: 'Background', id: 'Latar' }),
      photoFitField,
      photoPositionField,
      overlayField,
      text('eyebrow', { en: 'Eyebrow', id: 'Label kecil' }, 60, 'Our promise'),
      heading('Made slowly, on purpose'),
      body(900),
      buttonLabel('Read our story'),
      buttonLink,
      alignField('center'),
    ],
    defaultStyle: { width: 'edge', paddingTop: 'xl', paddingBottom: 'xl' },
  },
  {
    type: 'split-screen',
    category: 'banners',
    icon: 'split',
    name: { en: 'Split screen', id: 'Layar terbagi' },
    description: {
      en: 'A photo and a message, half and half, edge to edge.',
      id: 'Foto dan pesan, separuh-separuh, dari tepi ke tepi.',
    },
    fields: [
      image('image', { en: 'Photo', id: 'Foto' }),
      photoFitField,
      photoPositionField,
      choice(
        'imagePosition',
        { en: 'Photo side', id: 'Sisi foto' },
        [
          { value: 'left', label: { en: 'Left', id: 'Kiri' } },
          { value: 'right', label: { en: 'Right', id: 'Kanan' } },
        ],
        'left',
      ),
      heading('Two halves, one story'),
      body(800),
      buttonLabel('See the range'),
      buttonLink,
      choice(
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
      choice(
        'minHeight',
        { en: 'Height', id: 'Tinggi' },
        [
          { value: 'md', label: { en: 'Medium', id: 'Sedang' } },
          { value: 'lg', label: { en: 'Tall', id: 'Tinggi' } },
          { value: 'screen', label: { en: 'Full screen', id: 'Satu layar' } },
        ],
        'lg',
      ),
    ],
    defaultStyle: { width: 'edge', paddingTop: 'none', paddingBottom: 'none' },
  },
  {
    type: 'social-wall',
    category: 'media',
    icon: 'social',
    name: { en: 'Social wall', id: 'Dinding sosial' },
    description: {
      en: 'A shop-your-feed grid of photos, with a handle and links. No API, no tracking.',
      id: 'Kisi foto bergaya feed, dengan nama akun dan tautan. Tanpa API, tanpa pelacakan.',
    },
    fields: [
      heading('From the community'),
      text('handle', { en: 'Handle', id: 'Nama akun' }, 60, '@yourshop'),
      list('items', { en: 'Photos', id: 'Foto' }, { en: 'Photo', id: 'Foto' }, 'caption', 24, [
        image('image', { en: 'Photo', id: 'Foto' }),
        text('caption', { en: 'Caption', id: 'Keterangan' }, 160),
        link('link', { en: 'Link', id: 'Tautan' }),
      ]),
      ...columnsField(['3', '4', '6'], '4', '2'),
    ],
  },
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
      text('whatsapp', { en: 'WhatsApp number', id: 'Nomor WhatsApp' }, 20, '', {
        en: 'Leave empty for no chat button.',
        id: 'Kosongkan tanpa tombol chat.',
      }),
      text(
        'whatsappMessage',
        { en: 'Message typed for the shopper', id: 'Pesan yang sudah diketik' },
        200,
        'Hi! I have a question.',
      ),
      text('email', { en: 'Email address', id: 'Alamat email' }, 120),
      toggle('showTop', { en: 'Back to top', id: 'Kembali ke atas' }, true),
      choice(
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
      list('frames', { en: 'Frames', id: 'Bingkai' }, { en: 'Frame', id: 'Bingkai' }, 'alt', 36, [
        image('image', { en: 'Frame', id: 'Bingkai' }),
        text('alt', { en: 'Description', id: 'Deskripsi' }, 120),
      ]),
      toggle('autoSpin', { en: 'Turn slowly on its own', id: 'Berputar perlahan sendiri' }, true, {
        en: 'Pauses while the shopper drags, then starts again.',
        id: 'Berhenti saat pengunjung menggeser, lalu mulai lagi.',
      }),
      text('caption', { en: 'Drag hint', id: 'Petunjuk geser' }, 120, 'Drag to spin', {
        en: 'Shown over the photo until the shopper drags it.',
        id: 'Ditampilkan di atas foto sampai pengunjung menggesernya.',
      }),
    ],
  },
] as const satisfies readonly SectionSchema[]
