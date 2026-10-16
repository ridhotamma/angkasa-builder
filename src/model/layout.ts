/**
 * The header and footer: the chrome around every storefront page.
 *
 * Not sections — there is exactly one of each, on every page, in a fixed
 * place — but described as fields the same way, so the editor shows them as
 * two pinned rows in the section list with generated settings forms, and the
 * server sanitises them with the same code. They live on the theme
 * (`ThemeContent.layout`), so a new theme can bring a new header; the links
 * in them come from the shop's menus (`./menus`), which do not change when
 * the theme does.
 */

import { sanitizeValues, type Field, type FieldValues } from './fields'
import type { Localized } from './localized'
import { CONTENT_WIDTHS } from './section-style'
import { SCHEME_KEYS, SCHEME_LABELS } from './settings'

export const HEADER_FIELDS: readonly Field[] = [
  {
    kind: 'select',
    key: 'layout',
    label: { en: 'Layout', id: 'Tata letak' },
    options: [
      {
        value: 'classic',
        label: { en: 'Logo left, search in the middle', id: 'Logo kiri, pencarian di tengah' },
      },
      {
        value: 'centered',
        label: { en: 'Logo centred, menu below', id: 'Logo di tengah, menu di bawah' },
      },
      {
        value: 'inline',
        label: { en: 'Logo left, menu beside it', id: 'Logo kiri, menu di sampingnya' },
      },
    ],
    default: 'classic',
  },
  {
    kind: 'select',
    key: 'contentWidth',
    label: { en: 'Content width', id: 'Lebar konten' },
    options: CONTENT_WIDTHS,
    help: {
      en: 'The width the logo, search and menu line up in. Page width matches the sections below it.',
      id: 'Lebar tempat logo, pencarian, dan menu sejajar. Lebar halaman sama dengan bagian di bawahnya.',
    },
    default: '6xl',
  },
  {
    kind: 'select',
    key: 'mobileNav',
    label: { en: 'Phone navigation', id: 'Navigasi di ponsel' },
    options: [
      {
        value: 'menu',
        label: { en: 'Menu button at the top', id: 'Tombol menu di atas' },
      },
      {
        value: 'tabs',
        label: {
          en: 'Tab bar at the bottom, like an app',
          id: 'Bilah tab di bawah, seperti aplikasi',
        },
      },
    ],
    help: {
      en: 'The tab bar keeps home, catalog, cart and account under the shopper’s thumb; the menu button and search stay in the header. Phones only; a computer keeps the header above.',
      id: 'Bilah tab menaruh beranda, katalog, keranjang, dan akun di bawah jempol pembeli; tombol menu dan pencarian tetap di header. Hanya di ponsel; komputer tetap memakai header di atas.',
    },
    default: 'menu',
  },
  {
    kind: 'boolean',
    key: 'sticky',
    label: { en: 'Stay on screen while scrolling', id: 'Tetap terlihat saat menggulir' },
    default: true,
  },
  {
    kind: 'boolean',
    key: 'transparentOnHome',
    label: { en: 'See-through over the home banner', id: 'Transparan di atas banner beranda' },
    help: {
      en: 'On the home page, the header floats over a first section set to "Edge to edge", and turns solid once the shopper scrolls.',
      id: 'Di beranda, header melayang di atas bagian pertama yang diatur "Penuh dari tepi ke tepi", lalu menjadi solid saat pembeli menggulir.',
    },
    default: false,
  },
  {
    kind: 'boolean',
    key: 'showSearch',
    label: { en: 'Show search', id: 'Tampilkan pencarian' },
    default: true,
  },
  {
    kind: 'list',
    key: 'announcements',
    label: { en: 'Announcements', id: 'Pengumuman' },
    help: {
      en: 'A strip above the header on every page. Two or more take turns.',
      id: 'Strip di atas header di semua halaman. Dua atau lebih tampil bergantian.',
    },
    itemLabel: { en: 'Announcement', id: 'Pengumuman' },
    titleKey: 'text',
    max: 5,
    fields: [
      {
        kind: 'text',
        key: 'text',
        label: { en: 'Text', id: 'Teks' },
        max: 160,
        default: '',
      },
      { kind: 'link', key: 'link', label: { en: 'Link', id: 'Tautan' } },
    ],
  },
  {
    kind: 'select',
    key: 'announcementScheme',
    label: { en: 'Announcement colours', id: 'Warna pengumuman' },
    options: (['brand', ...SCHEME_KEYS.filter((key) => key !== 'brand')] as const).map((value) => ({
      value,
      label: SCHEME_LABELS[value],
    })),
    default: 'brand',
  },
]

export const FOOTER_FIELDS: readonly Field[] = [
  {
    kind: 'select',
    key: 'colorScheme',
    label: { en: 'Colour scheme', id: 'Skema warna' },
    options: (['subtle', 'default', 'inverse', 'brand', 'accent'] as const).map((value) => ({
      value,
      label: SCHEME_LABELS[value],
    })),
    default: 'default',
  },
  {
    kind: 'select',
    key: 'contentWidth',
    label: { en: 'Content width', id: 'Lebar konten' },
    options: CONTENT_WIDTHS,
    help: {
      en: 'The width the footer columns line up in. Page width matches the sections above it.',
      id: 'Lebar tempat kolom footer sejajar. Lebar halaman sama dengan bagian di atasnya.',
    },
    default: '6xl',
  },
  {
    kind: 'textarea',
    key: 'about',
    label: { en: 'About the shop', id: 'Tentang toko' },
    help: {
      en: 'A sentence or two under the shop name. Leave empty to use the shop description.',
      id: 'Satu-dua kalimat di bawah nama toko. Kosongkan untuk memakai deskripsi toko.',
    },
    max: 400,
    default: '',
    rows: 3,
  },
  {
    kind: 'boolean',
    key: 'showContact',
    label: { en: 'Show contact details', id: 'Tampilkan kontak' },
    default: true,
  },
  {
    kind: 'boolean',
    key: 'showPages',
    label: { en: 'List custom pages', id: 'Tampilkan halaman kustom' },
    help: {
      en: 'Published pages marked "Show in footer". Hidden when the footer menu has links.',
      id: 'Halaman terbit yang ditandai "Tampil di footer". Disembunyikan jika menu footer berisi tautan.',
    },
    default: true,
  },
  {
    kind: 'boolean',
    key: 'showOrderTracking',
    label: { en: 'Show order tracking', id: 'Tampilkan lacak pesanan' },
    help: {
      en: 'A link to the page where a shopper looks an order up. Hidden when the footer menu has links.',
      id: 'Tautan ke halaman untuk mencari pesanan. Disembunyikan jika menu footer berisi tautan.',
    },
    default: true,
  },
  {
    kind: 'boolean',
    key: 'showSocials',
    label: { en: 'Show social media', id: 'Tampilkan media sosial' },
    default: true,
  },
]

export interface ThemeLayout {
  header: FieldValues
  footer: FieldValues
}

export function sanitizeLayout(value: unknown): ThemeLayout {
  const source =
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
  return {
    header: sanitizeValues(HEADER_FIELDS, source.header),
    footer: sanitizeValues(FOOTER_FIELDS, source.footer),
  }
}

export const LAYOUT_PART_NAMES: Record<keyof ThemeLayout, Localized> = {
  header: { en: 'Header', id: 'Header' },
  footer: { en: 'Footer', id: 'Footer' },
}

export const LAYOUT_PART_DESCRIPTIONS: Record<keyof ThemeLayout, Localized> = {
  header: {
    en: 'Logo, menu, search, cart and announcements, on every page. Its links come from Navigation.',
    id: 'Logo, menu, pencarian, keranjang, dan pengumuman, di semua halaman. Tautannya dari Navigasi.',
  },
  footer: {
    en: 'Contact details, links and social media, on every page. Its links come from Navigation.',
    id: 'Kontak, tautan, dan media sosial, di semua halaman. Tautannya dari Navigasi.',
  },
}
