/**
 * The built-in templates, as code.
 *
 * These are the source for `bun run seed:themes`, which writes them into the
 * `themes` collection as `scope: 'platform'` rows. They are also read directly
 * by the seller dashboard when a preset's slug has no row yet, so a fresh
 * project offers templates before anyone has run the seed.
 *
 * **Classic** reproduces the storefront home exactly as it was hard-coded
 * before the page builder: banner, shop name, category rail, one shelf per
 * collection, latest products. A shop that never opens the builder renders
 * Classic and looks the same as it did the day before.
 */

import { CONTENT_VERSION, createSection, defaultProductTemplate, type ThemeContent } from './content'
import { sanitizeLayout } from './layout'
import type { Localized } from './localized'
import { DEFAULT_THEME_SETTINGS } from './settings'

export interface ThemePreset {
  slug: string
  name: string
  description: Localized
  content: () => ThemeContent
}

export const CLASSIC_PRESET_SLUG = 'classic'

const BASE_PRESETS: readonly ThemePreset[] = [
  {
    slug: CLASSIC_PRESET_SLUG,
    name: 'Classic',
    description: {
      en: 'The original Pesanle storefront: your banner, categories and every collection.',
      id: 'Etalase Pesanle yang asli: banner, kategori, dan semua koleksi Anda.',
    },
    content: () => ({
      version: CONTENT_VERSION,
      settings: DEFAULT_THEME_SETTINGS,
      layout: sanitizeLayout(null),
      templates: {
        product: defaultProductTemplate(),
        home: [
          createSection('hero', { useShopBanner: true, height: 'md' }),
          createSection('shop-intro', { showDescription: true }),
          createSection('category-rail', { heading: 'Shop by category' }),
          createSection('collection-shelves', { limit: 8 }),
          createSection('latest-products', { heading: 'New arrivals', limit: 12 }),
        ],
      },
    }),
  },
  {
    slug: 'bold',
    name: 'Bold',
    description: {
      en: 'A big headline, one featured collection and your story. For brands with a strong look.',
      id: 'Judul besar, satu koleksi unggulan, dan cerita brand. Untuk brand dengan tampilan kuat.',
    },
    content: () => ({
      version: CONTENT_VERSION,
      settings: {
        colors: { brand: '#e4572e', background: '#fff8f0', text: '#1b1b1b', accent: '#17bebb' },
        fonts: { heading: 'Space Grotesk', body: 'Inter' },
        radius: 'none',
        buttonStyle: 'solid',
        cardStyle: 'flat',
        schemes: {},
        animation: 'subtle',
      },
      layout: sanitizeLayout(null),
      templates: {
        product: defaultProductTemplate(),
        home: [
          createSection('announcement-bar', { text: 'New collection out now' }),
          createSection('hero', {
            useShopBanner: true,
            heading: 'Made to stand out',
            subheading: 'Discover this season’s pieces, made in small batches.',
            height: 'lg',
          }),
          createSection('featured-collection', { limit: 8, columns: '4' }),
          createSection('image-with-text', {
            heading: 'Our story',
            body: 'Tell your customers who you are, how you make your products and why they are worth it.',
          }),
          createSection('testimonials', {
            items: [
              { quote: 'Great quality and fast delivery.', author: 'Rina', role: 'Jakarta' },
              { quote: 'My favourite local brand.', author: 'Dimas', role: 'Bandung' },
            ],
          }),
          createSection('latest-products', { heading: 'Just in', limit: 8 }),
        ],
      },
    }),
  },
  {
    slug: 'minimal',
    name: 'Minimal',
    description: {
      en: 'Quiet type, lots of space and your products front and centre.',
      id: 'Tipografi tenang, ruang lega, dan produk sebagai fokus utama.',
    },
    content: () => ({
      version: CONTENT_VERSION,
      settings: {
        colors: { brand: '#1f2937', background: '#ffffff', text: '#111827', accent: '#b45309' },
        fonts: { heading: 'Playfair Display', body: 'Inter' },
        radius: 'sm',
        buttonStyle: 'outline',
        cardStyle: 'flat',
        schemes: {},
        animation: 'subtle',
      },
      layout: sanitizeLayout(null),
      templates: {
        product: defaultProductTemplate(),
        home: [
          createSection('shop-intro', { showLogo: true, showDescription: true, align: 'center' }),
          createSection('featured-collection', { limit: 6, columns: '3' }),
          createSection('rich-text', {
            heading: 'Thoughtfully made',
            body: 'A short note about what makes your shop different.',
            align: 'center',
          }),
          createSection('latest-products', { heading: 'Latest', limit: 9, columns: '3' }),
          createSection('faq', {
            items: [
              {
                question: 'How long does delivery take?',
                answer: 'Most orders arrive in 2–4 days.',
              },
              { question: 'Can I return an item?', answer: 'Yes, within 7 days of delivery.' },
            ],
          }),
        ],
      },
    }),
  },
]

/**
 * The immersive one: video, motion, colour bands and shoppable media. Added
 * after the others, so it is the showcase for what the builder can do — and
 * the first template a setup-service client is shown.
 */
const STUDIO_PRESET: ThemePreset = {
  slug: 'studio',
  name: 'Studio',
  description: {
    en: 'Video, colour bands, motion and shoppable looks. For brands that want to impress.',
    id: 'Video, pita warna, animasi, dan tampilan yang bisa dibelanjakan. Untuk brand yang ingin memukau.',
  },
  content: () => ({
    version: CONTENT_VERSION,
    settings: {
      colors: { brand: '#111111', background: '#faf7f2', text: '#171717', accent: '#c2410c' },
      fonts: { heading: 'Fraunces', body: 'DM Sans' },
      radius: 'lg',
      buttonStyle: 'pill',
      cardStyle: 'flat',
      schemes: {},
      animation: 'expressive',
    },
    layout: sanitizeLayout({
      header: {
        layout: 'centered',
        sticky: true,
        transparentOnHome: true,
        announcements: [
          { text: 'Free shipping over Rp 300.000', link: { kind: 'none' } },
          { text: 'Cash on delivery available', link: { kind: 'none' } },
        ],
        announcementScheme: 'inverse',
      },
      footer: { colorScheme: 'inverse' },
    }),
    templates: {
      home: [
        createSection('video-hero', {
          heading: 'Made to be worn',
          subheading: 'Our new collection, in motion.',
          buttonLabel: 'Shop the collection',
          buttonLink: { kind: 'home' },
        }),
        createSection(
          'scrolling-text',
          { items: [{ text: 'New season' }, { text: 'Small batches' }, { text: 'Made locally' }] },
          { colorScheme: 'accent' },
        ),
        createSection('collection-tabs', { heading: 'Shop the edit' }),
        createSection('lookbook', { heading: 'Shop the look' }),
        createSection(
          'icon-features',
          {
            items: [
              { icon: 'truck', title: 'Free shipping', text: 'On orders over Rp 300.000' },
              { icon: 'cash', title: 'Cash on delivery', text: 'Pay when it arrives' },
              { icon: 'refresh', title: '7-day returns', text: 'No questions asked' },
              { icon: 'hand', title: 'Made by hand', text: 'In our Bandung studio' },
            ],
          },
          { colorScheme: 'subtle' },
        ),
        createSection('scrolling-story', {
          heading: 'From sketch to shelf',
          steps: [
            { heading: 'Designed in the studio', body: 'Every piece starts as a sketch on our table.' },
            { heading: 'Cut and sewn by hand', body: 'Our makers finish each seam themselves.' },
            { heading: 'Packed with care', body: 'Wrapped in recycled paper and sent to you.' },
          ],
        }),
        createSection(
          'testimonials',
          {
            layout: 'marquee',
            items: [
              { quote: 'The quality is unreal for the price.', author: 'Sari', role: 'Jakarta' },
              { quote: 'Fits perfectly, arrived in two days.', author: 'Bima', role: 'Surabaya' },
              { quote: 'My new favourite local brand.', author: 'Ayu', role: 'Denpasar' },
            ],
          },
          { colorScheme: 'inverse', width: 'full' },
        ),
        createSection('video-reels', { heading: 'Seen on you' }),
        createSection('contact-cta'),
      ],
      product: defaultProductTemplate(),
    },
  }),
}

export const THEME_PRESETS: readonly ThemePreset[] = [...BASE_PRESETS, STUDIO_PRESET]

export function findPreset(slug: string): ThemePreset | null {
  return THEME_PRESETS.find((preset) => preset.slug === slug) ?? null
}
