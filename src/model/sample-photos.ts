/**
 * Stock photos the section starters draw their dummy images from.
 *
 * A freshly added section lands with content rather than a blank box, and its
 * images are hotlinked Unsplash photos stored the same way the AI builder's
 * stock pass stores them: the CDN URL plus a credit fragment, never a copy in
 * the shop's bucket. Every URL here has been checked to resolve; a seller
 * replaces them from the section panel.
 *
 * The credit is the provider's own fallback (the search client uses the same
 * "Unsplash" name when a provider's metadata is missing), so placeholder
 * images stay valid without naming a photographer the data never carried.
 */

import { stockPhotoValue } from '@repo/appwrite-config'

function unsplash(id: string): string {
  return stockPhotoValue(`https://images.unsplash.com/photo-${id}`, {
    provider: 'unsplash',
    photographer: 'Unsplash',
    photographerUrl: 'https://unsplash.com/',
  })
}

export const SAMPLE_PHOTOS = {
  /** A clothing shop floor — the general-purpose retail shot. */
  storeRack: unsplash('1441986300917-64674bd600d8'),
  /** A rail of hanging garments. */
  clothesRack: unsplash('1445205170230-053b83016050'),
  /** Folded tees on a shelf. */
  tshirts: unsplash('1523381210434-271e8be1f52b'),
  /** A shopper with bags. */
  shopping: unsplash('1483985988355-763728e1935b'),
  /** A model in a studio. */
  fashionModel: unsplash('1490481651871-ab68de25d43d'),
  /** A portrait, used for the team and testimonial avatars. */
  portrait: unsplash('1524504388940-b1c1722653e1'),
  /** A red sneaker. */
  sneakersRed: unsplash('1542291026-7eec264c27ff'),
  /** A plain white sneaker. */
  sneakerWhite: unsplash('1560343090-f0409e92791a'),
  /** Running shoes on a shelf. */
  runningShoes: unsplash('1549298916-b41d501d3772'),
  /** A wristwatch, for product detail shots. */
  watch: unsplash('1523275335684-37898b6baf30'),
  /** Over-ear headphones. */
  headphones: unsplash('1505740420928-5e560c06d30e'),
  /** A camera on a desk. */
  camera: unsplash('1526170375885-4d8ecf77b99f'),
  /** Gold jewellery. */
  jewellery: unsplash('1599643478518-a784e5dc4c8f'),
  /** A laid restaurant table. */
  restaurant: unsplash('1517248135467-4c7edcad34c4'),
  /** A cafe counter. */
  cafe: unsplash('1554118811-1e0d58224f24'),
  /** Coffee beans. */
  coffeeBeans: unsplash('1447933601403-0c6688de566e'),
  /** A bowl of food. */
  food: unsplash('1504674900247-0877df9cc836'),
  /** A dessert on a plate. */
  dessert: unsplash('1565958011703-44f9829ba187'),
  /** Two people working together. */
  teamwork: unsplash('1521737604893-d14cc237f11d'),
  /** A team around a table. */
  team: unsplash('1522071820081-009f0129c71c'),
  /** Portrait avatars for sample people. */
  avatarA: unsplash('1494790108377-be9c29b29330'),
  avatarB: unsplash('1507003211169-0a1dd7228f2d'),
  avatarC: unsplash('1438761681033-6461ffad8d80'),
  avatarD: unsplash('1472099645785-5658abf4ff4e'),
  avatarE: unsplash('1544005313-94ddf0286df2'),
  /** A shop front. */
  shopFront: unsplash('1472851294608-062f824d29cc'),
  /** A card payment terminal. */
  payment: unsplash('1556742049-0cfed4f6a45d'),
  /** A checkout counter. */
  checkout: unsplash('1556740738-b6a63e27c4df'),
  /** Shopping bags. */
  bags: unsplash('1607082348824-0a96f2a4b9da'),
  /** A boutique interior. */
  boutique: unsplash('1528698827591-e19ccd7bc23d'),
  /** A shop interior, wide. */
  storeInterior: unsplash('1441984904996-e0b6ba687e04'),
  /** A boxed order being packed. */
  packaging: unsplash('1554774853-aae0a22c8aa4'),
  /** Fashion, styled. */
  fashionTwo: unsplash('1487222477894-8943e31ef7b2'),
  /** A corner of a small shop. */
  shopCorner: unsplash('1534452203293-494d7ddbf7e0'),
  /** A market stall. */
  market: unsplash('1512436991641-6745cdb1723f'),
  /** A canvas tote. */
  tote: unsplash('1491637639811-60e2756cc1c7'),
  /** A backpack. */
  backpack: unsplash('1553062407-98eeb64c6a62'),
  /** A ring. */
  ring: unsplash('1573408301185-9146fe634ad0'),
  /** A bag of coffee. */
  coffeeBag: unsplash('1522312346375-d1a52e2b99b3'),
  /** A latte on a table. */
  latte: unsplash('1509042239860-f550ce710b93'),
} as const
