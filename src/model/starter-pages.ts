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
 * Their copy is deliberately plain and true of any shop: it is a starting
 * point a seller edits, not a legal document Pesanle is responsible for.
 */

import { CONTENT_VERSION, createSection, type PageContent } from './content'
import { richDocFromPlainText } from './rich-text'

/** A page a shop opens with: where it lives, what it is called, and its content. */
export interface StarterPage {
  /** The storefront path segment, `/pages/<slug>`. */
  slug: string
  /** The title the dashboard lists it under, in the shop's own language. */
  title: string
  content: PageContent
}

/**
 * One page, as a single `rich-text` section.
 *
 * The heading is plain text per locale and the body a rich document per locale
 * — the shapes those fields store, so switching a shop's language reads the
 * whole page in that language rather than leaving the body behind.
 */
function legalPage(
  slug: string,
  title: string,
  heading: { id: string; en: string },
  body: { id: string; en: string },
): StarterPage {
  return {
    slug,
    title,
    content: {
      version: CONTENT_VERSION,
      sections: [
        createSection('rich-text', {
          heading,
          body: {
            id: richDocFromPlainText(body.id),
            en: richDocFromPlainText(body.en),
          },
        }),
      ],
    },
  }
}

export function starterPages(): StarterPage[] {
  return [
    legalPage(
      'syarat-ketentuan',
      'Syarat & Ketentuan',
      { id: 'Syarat & Ketentuan', en: 'Terms & Conditions' },
      {
        id:
          'Dengan berbelanja di toko ini, Anda menyetujui syarat dan ketentuan berikut. ' +
          'Pesanan dianggap sah setelah pembayaran dikonfirmasi. Harga dan ketersediaan ' +
          'dapat berubah tanpa pemberitahuan. Hubungi kami bila ada pertanyaan.',
        en:
          'By shopping at this store you agree to the following terms. An order is ' +
          'confirmed once payment is verified. Prices and availability may change ' +
          'without notice. Contact us with any questions.',
      },
    ),
    legalPage(
      'kebijakan-privasi',
      'Kebijakan Privasi',
      { id: 'Kebijakan Privasi', en: 'Privacy Policy' },
      {
        id:
          'Kami mengumpulkan data Anda hanya untuk memproses pesanan, dan tidak ' +
          'membagikannya kepada pihak lain selain mitra pengiriman dan pembayaran. ' +
          'Anda dapat meminta penghapusan data Anda kapan saja.',
        en:
          'We collect your data only to process orders, and share it with no one but ' +
          'our delivery and payment partners. You may ask us to delete your data at ' +
          'any time.',
      },
    ),
  ]
}
