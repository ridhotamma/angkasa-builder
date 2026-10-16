/**
 * The dummy content a freshly added section starts with.
 *
 * A section dropped from the picker used to land empty — an image slot with a
 * placeholder glyph, a heading at its default — which left the seller staring
 * at nothing and guessing what the section was for. Instead every offered
 * section is seeded with a small, believable example: a few cards, a couple of
 * paragraphs, hotlinked stock photos (see `./sample-photos`). The seller then
 * edits the words and swaps the pictures for their own.
 *
 * Only the editor's "add a section" path uses these. Templates, theme seeds,
 * the AI builder and every programmatic `createSection` call keep the plain
 * field defaults, so a starter can never leak into a page nobody asked it to.
 *
 * Sections that draw from the shop's catalogue, and the product/article/
 * catalogue page sections that are rendered from the page's own data, are
 * deliberately absent: their content is not the seller's to place.
 */

import { SAMPLE_PHOTOS as P } from './sample-photos'
import { createSection, type SectionInstance } from './content'
import type { SectionPreset, SectionType } from './sections'

/** Dummy settings for one section type, resolved at the moment it is added. */
export type SectionStarter = (now: Date) => Record<string, unknown>

/* -------------------------------------------------------------------------- */
/* Field helpers                                                              */
/* -------------------------------------------------------------------------- */

/** A rich-text document from whole paragraphs of plain text. */
function doc(...paragraphs: string[]) {
  return {
    type: 'doc',
    content: paragraphs.map((text) => ({
      type: 'paragraph',
      content: [{ type: 'text', text }],
    })),
  }
}

const headingBlock = (text: string, level = 'h2', size = 'lg') => ({
  type: 'heading',
  settings: { text, level, size, align: 'left', width: 'full' },
})

const textBlock = (body: string, size = 'md') => ({
  type: 'richtext',
  settings: { body, size, align: 'left', width: 'full' },
})

const imageBlock = (image: string, ratio = '16/9') => ({
  type: 'image',
  settings: { image, alt: '', ratio, rounded: 'md', width: 'full', align: 'left' },
})

const buttonBlock = (label: string) => ({
  type: 'button',
  settings: {
    label,
    link: { kind: 'none' },
    size: 'lg',
    padding: 'default',
    width: 'auto',
    align: 'left',
    variant: 'solid',
    tone: 'brand',
    hover: 'fill-up',
  },
})

/** A photo card: the block behind the scroll rail's picture stops. */
const photoCardBlock = (image: string, title: string, body: string) => ({
  type: 'media-card',
  settings: {
    image,
    alt: title,
    overlay: 'gradient',
    contentPosition: 'bottom',
    height: 'md',
    padding: 'md',
    gap: 'sm',
    rounded: 'md',
    blocks: [headingBlock(title, 'h3', 'lg'), textBlock(body)],
  },
})

/** A stacked card: image, heading and a line, the pile's own shell around it.
 *  Wide pictures keep the card short enough that its heading and text stay in
 *  view once the card pins below the header. */
const cardColumnBlock = (image: string, title: string, body: string) => ({
  type: 'column',
  settings: {
    gap: 'md',
    padding: 'none',
    width: 'full',
    align: 'left',
    blocks: [imageBlock(image, '16/9'), headingBlock(title, 'h3', 'lg'), textBlock(body)],
  },
})

/* -------------------------------------------------------------------------- */
/* The starters                                                               */
/* -------------------------------------------------------------------------- */

export const SECTION_STARTERS: Partial<Record<SectionType, SectionStarter>> = {
  /* Layout composers ------------------------------------------------------- */

  blocks: () => ({
    gap: 'lg',
    blocks: [
      headingBlock('Build the page your shop deserves', 'h2', 'xl'),
      textBlock(
        'Add text, images, buttons, columns and grids — then style each block on its own.',
        'lg',
      ),
      imageBlock(P.storeRack),
      buttonBlock('Shop the collection'),
    ],
  }),
  custom: () => ({
    blocks: [
      headingBlock('Tell your story here', 'h2', 'xl'),
      textBlock(
        'Use this space for a short introduction — who you are, what you make, and why it matters.',
        'lg',
      ),
      buttonBlock('Shop now'),
    ],
  }),

  /* Banners ---------------------------------------------------------------- */

  hero: () => ({
    image: P.storeRack,
    heading: 'Everyday essentials, made to last',
    subheading: 'A short list of things we actually use, made in small batches and priced fairly.',
    buttonLabel: 'Shop the collection',
    secondaryButtonLabel: 'Our story',
  }),
  'video-hero': () => ({
    poster: P.fashionModel,
    subheading: 'A minute inside the workshop, from first sketch to final stitch.',
    buttonLabel: 'Watch the film',
  }),
  'parallax-banner': () => ({
    image: P.boutique,
    subheading: 'Small batches, honest materials, no shortcuts.',
    buttonLabel: 'Explore the range',
  }),
  'banner-slider': () => ({
    slides: [
      { image: P.storeRack, alt: 'New arrivals' },
      { image: P.fashionModel, alt: 'The capsule collection' },
      { image: P.sneakersRed, alt: 'Everyday footwear' },
    ],
  }),
  'shop-intro': () => ({
    background: 'image',
    backgroundImage: P.shopFront,
  }),

  /* Text and storytelling -------------------------------------------------- */

  'rich-text': () => ({
    body: doc(
      'We started in a small workshop with one idea: make the things people reach for every day a little better.',
      'Today we still make in small batches, test everything ourselves, and pack every order by hand.',
    ),
  }),
  'image-with-text': () => ({
    image: P.coffeeBeans,
    body: doc(
      'Roasted in small batches, days before it reaches your door. Every bag is dated so you always know how fresh it is.',
    ),
    buttonLabel: 'Learn more',
  }),
  faq: () => ({
    items: [
      {
        question: 'How long does delivery take?',
        answer:
          'Orders leave our warehouse within one working day, and most arrive in two to four days.',
      },
      {
        question: 'Can I return an item?',
        answer: 'Yes — unused items can be returned within 14 days for a full refund.',
      },
      {
        question: 'Do you ship nationwide?',
        answer: 'We ship to every province, with tracking sent over WhatsApp or email.',
      },
      {
        question: 'How do I care for my purchase?',
        answer: 'Wash cold and air dry. Every order includes a short care card.',
      },
    ],
  }),
  'scrolling-story': () => ({
    steps: [
      {
        image: P.teamwork,
        heading: 'It starts with a sketch',
        body: doc('Every piece begins on paper, argued over until it earns its place.'),
      },
      {
        image: P.packaging,
        heading: 'Then the first sample',
        body: doc('We wear it, wash it and use it for weeks before it goes anywhere near a shelf.'),
      },
      {
        image: P.shopFront,
        heading: 'And finally, your door',
        body: doc('Orders are packed by the people who made them, and shipped the same day.'),
      },
    ],
  }),
  timeline: () => ({
    items: [
      {
        label: '2019',
        title: 'The first table',
        text: 'We started with a market stall and exactly one product.',
        image: P.market,
      },
      {
        label: '2021',
        title: 'Our own workshop',
        text: 'Enough orders to stop renting space and build our own.',
        image: P.teamwork,
      },
      {
        label: '2023',
        title: 'Going nationwide',
        text: 'We shipped to every province for the first time.',
        image: P.packaging,
      },
      {
        label: '2026',
        title: 'Still small on purpose',
        text: 'Same hands, same standards, a slightly bigger bench.',
        image: P.shopFront,
      },
    ],
  }),
  table: () => ({
    body: doc('The short version of what each size includes.'),
    table: {
      columns: ['', 'Everyday', 'Travel', 'Pro'],
      rows: [
        ['Weight', '220 g', '260 g', '310 g'],
        ['Warranty', '1 year', '2 years', '5 years'],
        ['Water resistance', 'Splash-proof', 'Rain-proof', 'Submersible'],
      ],
    },
  }),
  'stacked-cards': () => ({
    heading: 'How we work',
    items: [
      {
        image: P.teamwork,
        title: 'Designed in-house',
        text: 'Every piece starts as a sketch on our own table.',
        linkLabel: '',
      },
      {
        image: P.packaging,
        title: 'Made in small batches',
        text: 'We produce in runs we can check by hand, not by the thousand.',
        linkLabel: '',
      },
      {
        image: P.shopFront,
        title: 'Shipped from our shop',
        text: 'Orders leave the same day, packed by the people who made them.',
        linkLabel: '',
      },
    ],
    blocks: [
      cardColumnBlock(
        P.teamwork,
        'Designed in-house',
        'Every piece starts as a sketch on our own table.',
      ),
      cardColumnBlock(
        P.packaging,
        'Made in small batches',
        'We produce in runs we can check by hand, not by the thousand.',
      ),
      cardColumnBlock(
        P.shopFront,
        'Shipped from our shop',
        'Orders leave the same day, packed by the people who made them.',
      ),
    ],
  }),
  'editorial-statement': () => ({
    image: P.boutique,
    body: doc(
      'We would rather make a few things properly than many things quickly. Everything here is designed to be used, repaired and kept.',
    ),
  }),
  'split-screen': () => ({
    image: P.coffeeBeans,
    body: doc(
      'From the first roast to the last bag on the shelf, every step happens within a few kilometres of where it was grown.',
    ),
  }),

  /* Media ------------------------------------------------------------------ */

  'image-gallery': () => ({
    items: [
      { image: P.fashionModel, caption: 'Studio, morning light' },
      { image: P.sneakersRed, caption: 'The everyday pair' },
      { image: P.watch, caption: 'Details that last' },
      { image: P.coffeeBeans, caption: 'Small-batch roast' },
      { image: P.shopFront, caption: 'Our shop' },
      { image: P.tote, caption: 'Made to carry' },
    ],
  }),
  video: () => ({
    poster: P.teamwork,
    subheading: 'A one-minute look at how it is made.',
  }),
  'before-after': () => ({
    before: P.boutique,
    after: P.storeInterior,
    body: doc('Drag the handle to see the difference a fresh coat and better lighting make.'),
  }),
  'scroll-rail': () => ({
    heading: 'New in this month',
    items: [
      { image: P.tshirts, title: 'Everyday tee', text: 'Heavyweight cotton that keeps its shape.' },
      { image: P.tote, title: 'Canvas tote', text: 'Roomy, sturdy, and made to be carried daily.' },
      { image: P.watch, title: 'Field watch', text: 'A quiet face that goes with everything.' },
      {
        image: P.sneakersRed,
        title: 'Court sneaker',
        text: 'Cushioned, flexible and easy to clean.',
      },
    ],
    blocks: [
      photoCardBlock(P.tshirts, 'Everyday tee', 'Heavyweight cotton that keeps its shape.'),
      photoCardBlock(P.tote, 'Canvas tote', 'Roomy, sturdy, and made to be carried daily.'),
      photoCardBlock(P.watch, 'Field watch', 'A quiet face that goes with everything.'),
    ],
  }),
  'masonry-gallery': () => ({
    items: [
      { image: P.storeRack, alt: 'Rack of new arrivals' },
      { image: P.fashionModel, alt: 'Studio portrait' },
      { image: P.sneakersRed, alt: 'Sneakers on a bench' },
      { image: P.coffeeBeans, alt: 'Coffee beans' },
      { image: P.watch, alt: 'A watch on a table' },
      { image: P.tote, alt: 'Canvas tote' },
    ],
  }),
  'video-testimonials': () => ({
    items: [
      {
        name: 'Ayu',
        role: 'Jakarta',
        quote: 'The quality is far better than I expected.',
        poster: P.avatarA,
      },
      {
        name: 'Budi',
        role: 'Bandung',
        quote: 'Ordered on Monday and it arrived Wednesday.',
        poster: P.avatarB,
      },
      {
        name: 'Citra',
        role: 'Surabaya',
        quote: 'Support answered every question within minutes.',
        poster: P.avatarC,
      },
    ],
  }),
  'background-video': () => ({
    poster: P.teamwork,
    subheading: 'A look inside the workshop.',
    body: doc('Thirty seconds of what a normal morning looks like here.'),
  }),
  'social-wall': () => ({
    items: [
      { image: P.fashionModel, caption: '#newin' },
      { image: P.tshirts, caption: '#everyday' },
      { image: P.watch, caption: '#details' },
      { image: P.coffeeBeans, caption: '#slowmornings' },
      { image: P.tote, caption: '#carryall' },
      { image: P.sneakersRed, caption: '#onthego' },
      { image: P.shopFront, caption: '#ourcorner' },
      { image: P.packaging, caption: '#packedbyhand' },
    ],
  }),
  'video-reels': () => ({
    items: [
      { poster: P.fashionModel, caption: 'New in this week', productId: '' },
      { poster: P.coffeeBeans, caption: 'Behind the scenes', productId: '' },
      { poster: P.sneakersRed, caption: 'How we style it', productId: '' },
      { poster: P.packaging, caption: 'Packing your order', productId: '' },
    ],
  }),
  lookbook: () => ({
    image: P.fashionModel,
    body: doc('Tap a tag to shop the pieces in this look.'),
  }),

  /* Trust and store -------------------------------------------------------- */

  testimonials: () => ({
    items: [
      {
        quote:
          'The quality is far better than I expected — it has held up beautifully after months of daily use.',
        author: 'Ayu Lestari',
        role: 'Jakarta',
        avatar: P.avatarA,
      },
      {
        quote:
          'Ordered on Monday, arrived Wednesday, and the packaging was lovely. I will definitely order again.',
        author: 'Budi Santoso',
        role: 'Bandung',
        avatar: P.avatarB,
      },
      {
        quote: 'Their team answered every question within minutes. That kind of service is rare.',
        author: 'Citra Dewi',
        role: 'Surabaya',
        avatar: P.avatarC,
      },
    ],
  }),
  team: () => ({
    body: doc(
      'A small team, on purpose — the people who make your order are the people who answer your messages.',
    ),
    items: [
      { photo: P.avatarA, name: 'Rina Pratama', role: 'Founder and designer' },
      { photo: P.avatarD, name: 'Adi Nugroho', role: 'Workshop lead' },
      { photo: P.avatarE, name: 'Sari Wijaya', role: 'Customer care' },
    ],
  }),
  press: () => ({
    items: [
      { quote: 'A quiet favourite among people who notice the details.', source: 'The Journal' },
      { quote: 'Small-batch done right — the quality speaks for itself.', source: 'Daily Post' },
      { quote: 'One of the most thoughtful local labels right now.', source: 'Business Weekly' },
    ],
  }),
  'logo-list': () => ({
    items: [
      { image: P.camera, alt: 'The Journal' },
      { image: P.watch, alt: 'Daily Post' },
      { image: P.headphones, alt: 'Business Weekly' },
      { image: P.ring, alt: 'Style Today' },
      { image: P.coffeeBag, alt: 'Morning Review' },
    ],
  }),
  'icon-features': () => ({
    heading: 'Why shop with us',
    items: [
      {
        icon: 'truck',
        title: 'Free delivery',
        text: 'On every order over Rp 200.000, nationwide.',
      },
      {
        icon: 'shield-check',
        title: 'Secure payments',
        text: 'QRIS, transfer and e-wallets — all encrypted.',
      },
      {
        icon: 'refresh-cw',
        title: 'Easy returns',
        text: 'Unused items can go back within 14 days.',
      },
      {
        icon: 'message-circle',
        title: 'Real support',
        text: 'A person answers, usually within the hour.',
      },
    ],
  }),
  multicolumn: () => ({
    heading: 'Why shop with us',
    items: [
      {
        image: P.packaging,
        title: 'Packed with care',
        text: 'Every order is checked and wrapped by hand before it ships.',
        linkLabel: '',
      },
      {
        image: P.payment,
        title: 'Pay how you like',
        text: 'QRIS, bank transfer, or your favourite e-wallet.',
        linkLabel: '',
      },
      {
        image: P.shopFront,
        title: 'Visit the shop',
        text: 'Come say hello — our door is open six days a week.',
        linkLabel: 'Find us',
      },
    ],
  }),
  'store-locations': () => ({
    items: [
      {
        image: P.shopFront,
        name: 'Flagship — Jakarta',
        address: 'Jl. Contoh Raya No. 24, Kebayoran Baru, Jakarta Selatan',
        hours: 'Mon–Sat 10.00–21.00',
        phone: '0812-3456-7890',
        mapLink: { kind: 'url', href: 'https://maps.google.com/?q=Jakarta' },
        coordinates: { latitude: -6.244, longitude: 106.799 },
      },
      {
        image: P.boutique,
        name: 'Bandung',
        address: 'Jl. Contoh No. 8, Dago, Bandung',
        hours: 'Daily 10.00–22.00',
        phone: '0812-3456-7891',
        mapLink: { kind: 'url', href: 'https://maps.google.com/?q=Bandung' },
        coordinates: { latitude: -6.8915, longitude: 107.6107 },
      },
    ],
  }),
  'contact-cta': () => ({
    whatsapp: '0812-3456-7890',
    email: 'hello@example.com',
  }),
  'floating-contact': () => ({
    whatsapp: '0812-3456-7890',
    email: 'hello@example.com',
  }),
  'order-tracking': () => ({
    subheading: 'Enter your order number and the phone you used, and we will open it.',
  }),

  /* Promotion -------------------------------------------------------------- */

  countdown: (now) => ({
    subheading: 'Up to 30% off across the shop — while stock lasts.',
    endsAt: new Date(now.getTime() + 14 * 86_400_000).toISOString(),
    buttonLabel: 'Shop the sale',
  }),
  'scrolling-text': () => ({
    items: [
      { text: 'Free delivery over Rp 200.000' },
      { text: 'New arrivals every month' },
      { text: 'Order on WhatsApp' },
    ],
  }),

  /* Consolidated families -------------------------------------------------- */

  banner: () => ({
    media: 'image',
    image: P.boutique,
    heading: 'New season, new favourites',
    subheading: 'Discover pieces made to last.',
    buttonLabel: 'Shop now',
    buttonLink: { kind: 'home' },
    align: 'center',
    contentPosition: 'middle',
    height: 'lg',
    overlay: 'dark',
  }),
  gallery: () => ({
    layout: 'grid',
    heading: 'From the shop',
    items: [
      { image: P.storeRack, caption: 'The rack', link: { kind: 'none' } },
      { image: P.bags, caption: 'Everyday bags', link: { kind: 'none' } },
      { image: P.watch, caption: 'Timepieces', link: { kind: 'none' } },
    ],
    columns: '3',
    mobileColumns: '2',
  }),
  quotes: () => ({
    variant: 'quotes',
    heading: 'What our customers say',
    layout: 'grid',
    items: [
      { quote: 'Fast delivery and lovely packaging.', author: 'Rina', role: 'Jakarta' },
      { quote: 'The quality surprised me.', author: 'Budi', role: 'Bandung' },
      { quote: 'Will order again.', author: 'Sari', role: 'Surabaya' },
    ],
  }),
  cards: () => ({
    card: 'text',
    heading: 'Why shop with us',
    columns: '3',
    mobileColumns: '1',
    items: [
      {
        image: P.packaging,
        title: 'Careful packing',
        text: 'Every order wrapped by hand.',
        link: { kind: 'none' },
      },
      {
        image: P.checkout,
        title: 'Easy checkout',
        text: 'Pay in whatever way suits you.',
        link: { kind: 'none' },
      },
      {
        image: P.shopFront,
        title: 'A real shop',
        text: 'Come see us in person.',
        link: { kind: 'none' },
      },
    ],
  }),
  statement: () => ({
    layout: 'contained',
    image: P.fashionModel,
    heading: 'Made with care',
    body: doc('We make small batches, by hand, with materials chosen to last.'),
    buttonLabel: 'Our story',
    buttonLink: { kind: 'none' },
    align: 'left',
  }),
  story: () => ({
    style: 'chapters',
    heading: 'How it is made',
    items: [
      { image: P.teamwork, heading: 'Designed', body: doc('Every piece starts as a sketch.') },
      { image: P.packaging, heading: 'Made', body: doc('Cut and sewn in our studio.') },
      { image: P.bags, heading: 'Shipped', body: doc('Packed carefully and sent out.') },
    ],
  }),
}

/**
 * The section a picker click or drop should add: a preset when the seller
 * picked one, otherwise the type's starter content. A preset never mixes with
 * starter keys — the preset's own settings are the whole answer.
 */
export function createStarterSection(
  type: SectionType,
  preset?: SectionPreset | null,
  now: Date = new Date(),
): SectionInstance {
  const starter = preset ? undefined : SECTION_STARTERS[type]?.(now)
  return createSection(type, preset?.settings ?? starter ?? {}, preset?.style)
}
