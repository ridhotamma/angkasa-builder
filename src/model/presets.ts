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

import { CONTENT_VERSION, createSection, type ThemeContent } from './content'
import type { Localized } from './localized'
import { DEFAULT_THEME_SETTINGS } from './settings'

export interface ThemePreset {
  slug: string
  name: string
  description: Localized
  content: () => ThemeContent
}

export const CLASSIC_PRESET_SLUG = 'classic'

export const THEME_PRESETS: readonly ThemePreset[] = [
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
      templates: {
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
      },
      templates: {
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
      },
      templates: {
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

export function findPreset(slug: string): ThemePreset | null {
  return THEME_PRESETS.find((preset) => preset.slug === slug) ?? null
}
