/**
 * The storefront words sections say on their own — "Copy", "days", "Add to
 * cart" — in both languages. The seller's own text comes from settings; this
 * is only the chrome around it.
 */

import { useLocale } from '@repo/i18n'

import { localize, type Localized } from '../model/localized'

const TEXT = {
  copy: { en: 'Copy', id: 'Salin' },
  copied: { en: 'Copied', id: 'Tersalin' },
  days: { en: 'Days', id: 'Hari' },
  hours: { en: 'Hours', id: 'Jam' },
  minutes: { en: 'Minutes', id: 'Menit' },
  seconds: { en: 'Seconds', id: 'Detik' },
  shopNow: { en: 'Shop now', id: 'Belanja sekarang' },
  viewProduct: { en: 'View product', id: 'Lihat produk' },
  pickProduct: {
    en: 'Pick a product in the section settings.',
    id: 'Pilih produk di pengaturan bagian.',
  },
  pickVideo: {
    en: 'Add a video in the section settings.',
    id: 'Tambahkan video di pengaturan bagian.',
  },
  pickDate: {
    en: 'Set the end date and time in the section settings.',
    id: 'Atur tanggal dan jam berakhir di pengaturan bagian.',
  },
  pickImages: {
    en: 'Add both images in the section settings.',
    id: 'Tambahkan kedua gambar di pengaturan bagian.',
  },
  pickCollections: {
    en: 'Add a tab with a collection in the section settings.',
    id: 'Tambahkan tab berisi koleksi di pengaturan bagian.',
  },
  ended: {
    en: 'Countdown ended — hidden on the storefront.',
    id: 'Hitung mundur selesai — tersembunyi di etalase.',
  },
  contactMissing: {
    en: 'Add a WhatsApp number or an email address in the section settings.',
    id: 'Tambahkan nomor WhatsApp atau alamat email di pengaturan bagian.',
  },
  directions: { en: 'Directions', id: 'Petunjuk arah' },
  call: { en: 'Call', id: 'Telepon' },
  sizeGuideMissing: {
    en: 'Size guide link — shown on products that have a size guide.',
    id: 'Tautan panduan ukuran — tampil pada produk yang punya panduan ukuran.',
  },
  lowStock: { en: 'Only {n} left — order soon', id: 'Tinggal {n} lagi — segera pesan' },
  save: { en: 'Save {n}%', id: 'Hemat {n}%' },
  reviews: { en: '{n} reviews', id: '{n} ulasan' },
  description: { en: 'Description', id: 'Deskripsi' },
  purchasePreview: {
    en: 'Variants, quantity and buy buttons appear here on the storefront.',
    id: 'Varian, jumlah, dan tombol beli tampil di sini di etalase.',
  },
  addToCart: { en: 'Add to cart', id: 'Tambah ke keranjang' },
  buyNow: { en: 'Buy now', id: 'Beli sekarang' },
  saveToWishlist: { en: 'Save to wishlist', id: 'Simpan ke wishlist' },
  savedToWishlist: { en: 'Saved to wishlist', id: 'Tersimpan di wishlist' },
  reviewsPreview: {
    en: "Buyers' reviews of the product appear here on the storefront.",
    id: 'Ulasan pembeli untuk produk tampil di sini di etalase.',
  },
  noRelated: {
    en: 'Other products in the same category appear here.',
    id: 'Produk lain dari kategori yang sama tampil di sini.',
  },
  close: { en: 'Close', id: 'Tutup' },
  viewAllPhotos: { en: 'View all photos', id: 'Lihat semua foto' },
  previousPhoto: { en: 'Previous photo', id: 'Foto sebelumnya' },
  nextPhoto: { en: 'Next photo', id: 'Foto berikutnya' },
  play: { en: 'Play', id: 'Putar' },
  pause: { en: 'Pause', id: 'Jeda' },
  mute: { en: 'Mute', id: 'Bisukan' },
  unmute: { en: 'Unmute', id: 'Nyalakan suara' },
  compareSlider: { en: 'Drag to compare', id: 'Geser untuk membandingkan' },
  home: { en: 'Home', id: 'Beranda' },
  catalog: { en: 'Catalog', id: 'Katalog' },
  allProducts: { en: 'All products', id: 'Semua produk' },
  allCategories: { en: 'All', id: 'Semua' },
  results: { en: '{n} products', id: '{n} produk' },
  filters: { en: 'Categories', id: 'Kategori' },
  filtersCollections: { en: 'Collections', id: 'Koleksi' },
  noMatches: { en: 'No matches', id: 'Tidak ada hasil' },
  noProducts: { en: 'No products to show yet.', id: 'Belum ada produk untuk ditampilkan.' },
  previousPage: { en: 'Previous page', id: 'Halaman sebelumnya' },
  nextPage: { en: 'Next page', id: 'Halaman berikutnya' },
  pageOf: { en: 'Page {page} of {pages}', id: 'Halaman {page} dari {pages}' },
  menu: { en: 'Menu', id: 'Menu' },
  seeAll: { en: 'See all', id: 'Lihat semua' },
  phoneNavigation: { en: 'Shop navigation', id: 'Navigasi toko' },
  textPlaceholder: { en: 'Write your text here…', id: 'Tulis teks Anda di sini…' },
  readingTime: { en: '{n} min read', id: '{n} menit baca' },
  copyLink: { en: 'Copy link', id: 'Salin tautan' },
  linkCopied: { en: 'Link copied', id: 'Tautan tersalin' },
  whatsapp: { en: 'WhatsApp', id: 'WhatsApp' },
  articleBodyPreview: {
    en: 'Each article’s own text, photos and videos appear here — written in the article editor.',
    id: 'Teks, foto, dan video tiap artikel tampil di sini — ditulis di editor artikel.',
  },
  noPagination: {
    en: 'Links to the previous and next article in the blog appear here.',
    id: 'Tautan ke artikel sebelum dan sesudahnya di blog tampil di sini.',
  },
  noRelatedArticles: {
    en: 'Your other published articles appear here.',
    id: 'Artikel lain yang sudah terbit tampil di sini.',
  },
} satisfies Record<string, Localized>

export type RenderText = keyof typeof TEXT

export function useRenderText() {
  const { locale } = useLocale()
  return (key: RenderText, values: Record<string, string | number> = {}) =>
    localize(TEXT[key], locale).replace(/\{(\w+)\}/g, (_, name: string) =>
      String(values[name] ?? ''),
    )
}
