/**
 * The editor's own chrome, in both languages.
 *
 * Kept in the package for the same reason section labels are: the admin and
 * developer apps render the same editor, and one catalogue per app would be
 * two copies of every string.
 */

import { useMemo } from 'react'

import { useLocale } from '@repo/i18n'

import { localize, type Localized } from '../model/localized'

const MESSAGES = {
  sections: { en: 'Sections', id: 'Bagian' },
  theme: { en: 'Theme', id: 'Tema' },
  addSection: { en: 'Add section', id: 'Tambah bagian' },
  noSections: {
    en: 'No sections yet. Add one to start building this page.',
    id: 'Belum ada bagian. Tambahkan satu untuk mulai menyusun halaman ini.',
  },
  back: { en: 'All sections', id: 'Semua bagian' },
  hide: { en: 'Hide', id: 'Sembunyikan' },
  show: { en: 'Show', id: 'Tampilkan' },
  duplicate: { en: 'Duplicate', id: 'Duplikat' },
  remove: { en: 'Remove', id: 'Hapus' },
  moveUp: { en: 'Move up', id: 'Naikkan' },
  moveDown: { en: 'Move down', id: 'Turunkan' },
  dragToReorder: { en: 'Drag to reorder', id: 'Seret untuk mengurutkan' },
  hidden: { en: 'Hidden', id: 'Tersembunyi' },
  catalogue: { en: 'Uses your catalogue', id: 'Memakai katalog Anda' },
  addItem: { en: 'Add', id: 'Tambah' },
  untitled: { en: 'Untitled', id: 'Tanpa judul' },
  upload: { en: 'Upload image', id: 'Unggah gambar' },
  replace: { en: 'Replace', id: 'Ganti' },
  uploading: { en: 'Uploading…', id: 'Mengunggah…' },
  noImage: { en: 'No image', id: 'Tidak ada gambar' },
  none: { en: 'None', id: 'Tidak ada' },
  colors: { en: 'Colours', id: 'Warna' },
  brandColor: { en: 'Brand', id: 'Brand' },
  backgroundColor: { en: 'Background', id: 'Latar' },
  textColor: { en: 'Text', id: 'Teks' },
  accentColor: { en: 'Accent', id: 'Aksen' },
  typography: { en: 'Typography', id: 'Tipografi' },
  headingFont: { en: 'Heading font', id: 'Font judul' },
  bodyFont: { en: 'Body font', id: 'Font isi' },
  shape: { en: 'Shape', id: 'Bentuk' },
  radius: { en: 'Corner radius', id: 'Sudut' },
  buttonStyle: { en: 'Buttons', id: 'Tombol' },
  cardStyle: { en: 'Cards', id: 'Kartu' },
  contrastText: {
    en: 'Text on this background is hard to read. Pick a darker text or lighter background.',
    id: 'Teks di latar ini sulit dibaca. Pilih teks lebih gelap atau latar lebih terang.',
  },
  contrastBrand: {
    en: 'Button labels are hard to read on this brand colour. Try a darker or lighter shade.',
    id: 'Teks tombol sulit dibaca di warna brand ini. Coba warna lebih gelap atau lebih terang.',
  },
  linkKind: { en: 'Links to', id: 'Menuju' },
  linkNone: { en: 'Nothing', id: 'Tidak ada' },
  linkHome: { en: 'Home page', id: 'Beranda' },
  linkPage: { en: 'Page', id: 'Halaman' },
  linkProduct: { en: 'Product', id: 'Produk' },
  linkCollection: { en: 'Collection', id: 'Koleksi' },
  linkCategory: { en: 'Category', id: 'Kategori' },
  linkBlog: { en: 'Blog', id: 'Blog' },
  linkArticle: { en: 'Article', id: 'Artikel' },
  blogTag: { en: 'Only articles tagged (optional)', id: 'Hanya artikel dengan tag (opsional)' },
  linkSearch: { en: 'Search results', id: 'Hasil pencarian' },
  linkUrl: { en: 'Web address', id: 'Alamat web' },
  searchQuery: { en: 'Search for', id: 'Cari' },
  urlHelp: { en: 'Must start with https://', id: 'Harus diawali https://' },
  choose: { en: 'Choose…', id: 'Pilih…' },
  preview: { en: 'Preview', id: 'Pratinjau' },
  close: { en: 'Close editor', id: 'Tutup editor' },
  done: { en: 'Done', id: 'Selesai' },
  resizePanel: {
    en: 'Drag to resize the panel; double-click to reset',
    id: 'Seret untuk mengubah lebar panel; klik dua kali untuk mengembalikan',
  },
  unsaved: { en: 'Unsaved changes', id: 'Belum disimpan' },
  moreActions: { en: 'More actions', id: 'Aksi lainnya' },
  unsavedTitle: { en: 'Save your changes?', id: 'Simpan perubahan Anda?' },
  unsavedBody: {
    en: 'You have changes that are not saved yet. Keep editing, or discard them.',
    id: 'Ada perubahan yang belum disimpan. Lanjut mengedit, atau buang perubahannya.',
  },
  keepEditing: { en: 'Keep editing', id: 'Lanjut mengedit' },
  discard: { en: 'Discard changes', id: 'Buang perubahan' },
  previewNote: {
    en: 'Click a section in the preview to edit it.',
    id: 'Klik bagian di pratinjau untuk mengeditnya.',
  },
  bold: { en: 'Bold', id: 'Tebal' },
  italic: { en: 'Italic', id: 'Miring' },
  underline: { en: 'Underline', id: 'Garis bawah' },
  strike: { en: 'Strikethrough', id: 'Coret' },
  heading2: { en: 'Heading', id: 'Judul' },
  heading3: { en: 'Subheading', id: 'Subjudul' },
  bulletList: { en: 'Bulleted list', id: 'Daftar berpoin' },
  orderedList: { en: 'Numbered list', id: 'Daftar bernomor' },
  quote: { en: 'Quote', id: 'Kutipan' },
  link: { en: 'Link', id: 'Tautan' },
  linkPlaceholder: { en: 'https://… or /pages/…', id: 'https://… atau /pages/…' },
  linkInvalid: {
    en: 'Use a web address, email (mailto:), phone (tel:) or a path starting with /.',
    id: 'Gunakan alamat web, email (mailto:), telepon (tel:) atau path diawali /.',
  },
  applyLink: { en: 'Apply', id: 'Terapkan' },
  removeLink: { en: 'Remove link', id: 'Hapus tautan' },
  clearFormatting: { en: 'Clear formatting', id: 'Hapus format' },

  // Media, products, tables
  videoUpload: { en: 'Upload video', id: 'Unggah video' },
  videoLink: { en: 'YouTube or Vimeo', id: 'YouTube atau Vimeo' },
  videoFromUpload: { en: 'Uploaded video', id: 'Video unggahan' },
  videoUploadUnavailable: {
    en: 'Video uploads are not available here.',
    id: 'Unggah video tidak tersedia di sini.',
  },
  videoLinkInvalid: {
    en: 'That is not a YouTube or Vimeo link.',
    id: 'Itu bukan tautan YouTube atau Vimeo.',
  },
  videoLinkHelp: {
    en: 'Paste the address of the video page.',
    id: 'Tempel alamat halaman videonya.',
  },
  productSearch: { en: 'Search your products…', id: 'Cari produk Anda…' },
  productChange: { en: 'Pick another product…', id: 'Pilih produk lain…' },
  productNone: { en: 'No products match.', id: 'Tidak ada produk yang cocok.' },
  searching: { en: 'Searching…', id: 'Mencari…' },
  pointNoImage: {
    en: 'Add the section image first, then place the dot on it.',
    id: 'Tambahkan gambar bagian dulu, lalu taruh titiknya.',
  },
  pointDrag: { en: 'Drag to move', id: 'Geser untuk memindah' },
  pointHint: {
    en: 'Click or drag on the photo to move the dot.',
    id: 'Klik atau geser di foto untuk memindahkan titik.',
  },
  clear: { en: 'Clear', id: 'Hapus' },
  tableAddRow: { en: 'Row', id: 'Baris' },
  tableAddColumn: { en: 'Column', id: 'Kolom' },
  tableRemoveRow: { en: 'Delete row', id: 'Hapus baris' },
  tableRemoveColumn: { en: 'Delete column', id: 'Hapus kolom' },
  tableMoveLeft: { en: 'Move left', id: 'Geser ke kiri' },
  tableMoveRight: { en: 'Move right', id: 'Geser ke kanan' },
  tableColumnLabel: { en: 'Column', id: 'Kolom' },
  tableRowLabel: { en: 'Row', id: 'Baris' },
  tableColumnName: { en: 'Column name', id: 'Nama kolom' },
  tableColumnActions: { en: 'Column actions', id: 'Aksi kolom' },
  tableRowActions: { en: 'Row actions', id: 'Aksi baris' },
  tableHint: {
    en: 'Click a cell, then use the grip above its column or beside its row to move or delete it (or Alt + arrow keys). Paste cells from a spreadsheet into any cell.',
    id: 'Klik sel, lalu gunakan pegangan di atas kolom atau di samping barisnya untuk memindah atau menghapus (atau Alt + tombol panah). Tempel sel dari spreadsheet ke sel mana pun.',
  },
  addBlock: { en: 'Add block', id: 'Tambah blok' },
  buttonElement: { en: 'Button', id: 'Tombol' },
  buttonElementHelp: {
    en: 'Click the button in the preview to restyle just that one. Every other button keeps the theme.',
    id: 'Klik tombol di pratinjau untuk mengubah gayanya saja. Tombol lain tetap mengikuti tema.',
  },
  resetToTheme: { en: 'Reset to theme', id: 'Kembalikan ke tema' },

  // Section settings groups
  sectionContent: { en: 'Content', id: 'Isi' },
  sectionStyle: { en: 'Style', id: 'Gaya' },
  sectionVisibility: { en: 'Visibility', id: 'Visibilitas' },
  required: { en: 'Required on this page', id: 'Wajib di halaman ini' },
  onlyMobile: { en: 'Phones', id: 'Ponsel' },
  onlyDesktop: { en: 'Desktop', id: 'Desktop' },

  // Picker
  searchSections: { en: 'Search sections…', id: 'Cari bagian…' },
  noSectionsMatch: { en: 'No sections match.', id: 'Tidak ada bagian yang cocok.' },
  pasteSection: { en: 'Paste copied section', id: 'Tempel bagian yang disalin' },
  clearCopied: { en: 'Forget the copied section', id: 'Lupakan bagian yang disalin' },
  copySection: { en: 'Copy', id: 'Salin' },
  sectionCopied: {
    en: 'Section copied. Paste it from "Add section" on any page or theme.',
    id: 'Bagian disalin. Tempel dari "Tambah bagian" di halaman atau tema mana pun.',
  },
  preset: { en: 'Ready-made', id: 'Siap pakai' },

  // Editor chrome
  undo: { en: 'Undo', id: 'Urungkan' },
  redo: { en: 'Redo', id: 'Ulangi' },
  deviceDesktop: { en: 'Desktop', id: 'Desktop' },
  deviceTablet: { en: 'Tablet', id: 'Tablet' },
  deviceMobile: { en: 'Phone', id: 'Ponsel' },
  showPreview: { en: 'View preview', id: 'Lihat pratinjau' },
  closePreview: { en: 'Close preview', id: 'Tutup pratinjau' },
  templateHome: { en: 'Home page', id: 'Beranda' },
  templateProduct: { en: 'Product page', id: 'Halaman produk' },
  templateArticle: { en: 'Article page', id: 'Halaman artikel' },
  editingTemplate: { en: 'Editing', id: 'Mengedit' },
  inlineHint: {
    en: 'Click a section to edit it; click a heading to type straight into it.',
    id: 'Klik bagian untuk mengeditnya; klik judul untuk langsung mengetik.',
  },

  // Theme tab
  colorSchemes: { en: 'Colour schemes', id: 'Skema warna' },
  colorSchemesHelp: {
    en: 'Sections can wear one of these instead of the page colours. Automatic schemes follow your brand colours.',
    id: 'Bagian bisa memakai salah satu skema ini, bukan warna halaman. Skema otomatis mengikuti warna brand Anda.',
  },
  schemeAutomatic: { en: 'Automatic', id: 'Otomatis' },
  schemeBackground: { en: 'Background', id: 'Latar' },
  schemeText: { en: 'Text', id: 'Teks' },
  schemeButton: { en: 'Buttons', id: 'Tombol' },
  schemeContrast: {
    en: 'Text or buttons in this scheme are hard to read.',
    id: 'Teks atau tombol di skema ini sulit dibaca.',
  },
  motion: { en: 'Motion', id: 'Gerakan' },
  animation: { en: 'Sections appearing on scroll', id: 'Bagian muncul saat digulir' },
  animationHelp: {
    en: 'Shoppers who ask their device for less motion never see it.',
    id: 'Pembeli yang meminta perangkatnya mengurangi gerakan tidak akan melihatnya.',
  },

  // Preview chrome
  footerInformation: { en: 'Information', id: 'Informasi' },
  footerFollowUs: { en: 'Follow us', id: 'Ikuti kami' },
  footerLinks: { en: 'Links', id: 'Tautan' },
  poweredBy: { en: 'Powered by Pesanle', id: 'Didukung oleh Pesanle' },
  standInSearch: { en: 'Search', id: 'Cari' },
  standInCart: { en: 'Cart', id: 'Keranjang' },
  standInAccount: { en: 'Account', id: 'Akun' },

  // Looks and palettes
  looksAndPalettes: { en: 'Looks & Palettes', id: 'Tampilan & Palet' },
  looksAndPalettesHelp: {
    en: 'Start from a curated look or palette, then make it yours.',
    id: 'Mulai dari tampilan atau palet pilihan, lalu sesuaikan.',
  },
  browseLooks: { en: 'Browse curated looks…', id: 'Jelajahi pilihan tampilan…' },
  curatedLooks: { en: 'Curated looks', id: 'Pilihan tampilan' },
  colorPalettes: { en: 'Color palettes', id: 'Palet warna' },
  recommendedLooks: { en: 'Recommended for this template', id: 'Disarankan untuk template ini' },
  searchMoodPlaceholder: {
    en: 'Search mood: warm, luxury, bold…',
    id: 'Cari mood: hangat, mewah, berani…',
  },
  applyLook: { en: 'Apply look', id: 'Terapkan tampilan' },
  applyPalette: { en: 'Apply palette', id: 'Terapkan palet' },

  // Menus
  menuAddItem: { en: 'Add link', id: 'Tambah tautan' },
  menuAddChild: { en: 'Add link under this one', id: 'Tambah tautan di bawahnya' },
  menuLabel: { en: 'Label', id: 'Label' },
  menuEmpty: { en: 'No links yet.', id: 'Belum ada tautan.' },
  menuEmptyHint: {
    en: 'Add the pages shoppers should reach from here.',
    id: 'Tambahkan halaman yang perlu dijangkau pembeli dari sini.',
  },
  menuLabelPlaceholder: { en: 'e.g. Shop all', id: 'mis. Semua produk' },
  menuNeedsLabel: { en: 'Needs a label', id: 'Perlu label' },
  menuUntitled: { en: 'New link', id: 'Tautan baru' },
} satisfies Record<string, Localized>

export type EditorMessage = keyof typeof MESSAGES

export function useEditorText() {
  const { locale } = useLocale()
  // The same functions until the locale changes, so the editor can memoize
  // what it draws with them.
  return useMemo(
    () => ({
      locale,
      t: (key: EditorMessage) => localize(MESSAGES[key], locale),
      l: (text: Localized) => localize(text, locale),
    }),
    [locale],
  )
}
