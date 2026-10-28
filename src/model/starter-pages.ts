/**
 * The pages every new shop opens with: its terms and its privacy policy.
 *
 * A brand-new storefront with no legal pages reads as unfinished — and, worse,
 * a shopper has nowhere to check how a shop handles their data. So both are
 * written *with the shop*: published, bilingual, and listed in the footer (see
 * `showInFooter` and the footer's Information column).
 *
 * This is the single definition of them. The dashboard writes them on
 * `createTenant` (see `apps/admin`'s `seedStarterPages`) and `seed:demo` writes
 * the same ones, which is what makes a seeded demo indistinguishable from a
 * shop made by hand.
 *
 * The copy follows the shape shoppers already expect from Indonesian shops —
 * an intro, then a short section per topic, bulleted where it is a list — and
 * it is deliberately generic: it talks about "this store" and "we", never a
 * brand, because it is the same page for every shop until a seller edits it.
 * It is a starting point, not a legal document the builder is responsible for.
 */

import { CONTENT_VERSION, createSection, type PageContent } from './content'
import type { Localized } from './localized'
import type { RichBlock, RichDoc } from './rich-text'

/** A page a shop opens with: where it lives, what it is called, and its content. */
export interface StarterPage {
  /** The storefront path segment, `/pages/<slug>`. */
  slug: string
  /** The title the dashboard lists it under, in the shop's own language. */
  title: string
  content: PageContent
}

/**
 * The seeded legal pages' titles, per slug, in both languages.
 *
 * The storefront draws a page's title in the footer and in the `<title>`, and
 * `pages.title` is a single column — so a shop seeded before page titles were
 * translatable, still carrying its original title, reads its own language back
 * through here (`starterPageTitle`). A seller who renamed the page stops
 * matching and keeps their own title.
 */
const TITLES: Record<string, Localized> = {
  'syarat-ketentuan': { id: 'Syarat & Ketentuan', en: 'Terms & Conditions' },
  'kebijakan-privasi': { id: 'Kebijakan Privasi', en: 'Privacy Policy' },
}

/** The platform title for a starter page's slug, or `undefined` for any other page. */
export function starterPageTitle(slug: string): Localized | undefined {
  return TITLES[slug]
}

/* -------------------------------------------------------------------------- */
/* Building the body                                                          */
/* -------------------------------------------------------------------------- */

/**
 * The body of a legal page, block by block.
 *
 * Written as the rich-text vocabulary directly rather than as Markdown or HTML:
 * this is what the editor's own document tree looks like, so a page opens in
 * the editor with its headings and lists already there to be edited.
 */
const paragraph = (text: string): RichBlock => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
})

/** A topic heading — a level below the page's own title. */
const topic = (text: string): RichBlock => ({
  type: 'heading',
  attrs: { level: 3 },
  content: [{ type: 'text', text }],
})

const bullets = (...items: string[]): RichBlock => ({
  type: 'bulletList',
  content: items.map((item) => ({ type: 'listItem', content: [paragraph(item)] })),
})

const body = (...blocks: RichBlock[]): RichDoc => ({ type: 'doc', content: blocks })

/**
 * One page, as a single `rich-text` section.
 *
 * Both the heading and the body are per-locale, so switching the shop's
 * language reads the whole page in that language rather than leaving the body
 * behind.
 */
function legalPage(slug: string, text: { id: RichDoc; en: RichDoc }): StarterPage {
  const heading = TITLES[slug]!
  return {
    slug,
    title: heading.id,
    content: {
      version: CONTENT_VERSION,
      sections: [createSection('rich-text', { heading, body: text })],
    },
  }
}

/* -------------------------------------------------------------------------- */
/* The pages                                                                  */
/* -------------------------------------------------------------------------- */

export function starterPages(): StarterPage[] {
  return [
    legalPage('syarat-ketentuan', {
      id: body(
        paragraph(
          'Dengan mengakses dan berbelanja di toko ini, kamu dianggap menyetujui syarat dan ketentuan berikut.',
        ),
        topic('Pemesanan'),
        bullets(
          'Pesanan dianggap sah setelah pembayaran terkonfirmasi.',
          'Harga, ketersediaan, dan promo dapat berubah sewaktu-waktu.',
          'Kami berhak membatalkan pesanan bila terjadi kesalahan harga atau stok.',
        ),
        topic('Produk'),
        paragraph(
          'Seluruh produk dijual dengan kualitas yang kami jaga dan dikemas dengan rapi. Foto produk bersifat ilustrasi; warna dapat sedikit berbeda dari tampilan layar.',
        ),
        topic('Pembayaran'),
        paragraph(
          'Pembayaran dilakukan melalui metode yang tersedia di situs maupun via WhatsApp. Pastikan menyelesaikan pembayaran sesuai batas waktu agar pesanan tidak dibatalkan otomatis.',
        ),
        topic('Hak Kekayaan Intelektual'),
        paragraph(
          'Seluruh konten, logo, dan materi di situs ini milik kami dan dilindungi hukum yang berlaku.',
        ),
        paragraph('Pertanyaan seputar ketentuan ini dapat diajukan melalui halaman kontak.'),
      ),
      en: body(
        paragraph(
          'By accessing and shopping at this store, you are deemed to accept the terms and conditions below.',
        ),
        topic('Orders'),
        bullets(
          'An order is valid once payment is confirmed.',
          'Prices, availability, and promotions may change at any time.',
          'We may cancel an order if there is a pricing or stock error.',
        ),
        topic('Products'),
        paragraph(
          'Every product is sold at the quality we stand behind and packed with care. Product photos are illustrative; colours may differ slightly from your screen.',
        ),
        topic('Payment'),
        paragraph(
          'Payment is made through the methods available on the site or via WhatsApp. Please complete payment within the time limit so your order is not cancelled automatically.',
        ),
        topic('Intellectual Property'),
        paragraph(
          'All content, logos, and materials on this site belong to us and are protected by applicable law.',
        ),
        paragraph('Questions about these terms can be raised through the contact page.'),
      ),
    }),
    legalPage('kebijakan-privasi', {
      id: body(
        paragraph(
          'Kami menghormati privasi setiap pelanggan. Kebijakan ini menjelaskan bagaimana kami mengumpulkan, menggunakan, dan melindungi informasi pribadi kamu.',
        ),
        topic('Data yang Kami Kumpulkan'),
        bullets(
          'Nama, nomor telepon, email, dan alamat pengiriman.',
          'Detail pesanan dan riwayat transaksi.',
          'Data teknis seperti perangkat dan aktivitas di situs (cookies).',
        ),
        topic('Penggunaan Data'),
        paragraph(
          'Data digunakan untuk memproses pesanan, mengirim produk, memberikan layanan pelanggan, serta menginformasikan promo bila kamu menyetujuinya. Kami tidak menjual data pribadi kamu kepada pihak ketiga.',
        ),
        topic('Keamanan'),
        paragraph(
          'Kami menerapkan langkah keamanan yang wajar untuk melindungi data kamu. Pembayaran diproses melalui gateway tepercaya dan terenkripsi.',
        ),
        topic('Hak Kamu'),
        paragraph(
          'Kamu berhak meminta akses, perbaikan, atau penghapusan data pribadi. Untuk itu, silakan hubungi kami.',
        ),
      ),
      en: body(
        paragraph(
          'We respect the privacy of every customer. This policy explains how we collect, use, and protect your personal information.',
        ),
        topic('Data We Collect'),
        bullets(
          'Name, phone number, email, and delivery address.',
          'Order details and transaction history.',
          'Technical data such as your device and activity on the site (cookies).',
        ),
        topic('How We Use Data'),
        paragraph(
          'Data is used to process orders, ship products, provide customer service, and tell you about promotions if you agree. We do not sell your personal data to third parties.',
        ),
        topic('Security'),
        paragraph(
          'We apply reasonable security measures to protect your data. Payments are processed through a trusted, encrypted gateway.',
        ),
        topic('Your Rights'),
        paragraph(
          'You may ask to access, correct, or delete your personal data. To do so, please contact us.',
        ),
      ),
    }),
  ]
}
