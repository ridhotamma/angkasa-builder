/**
 * The editor's own chrome, in both languages.
 *
 * Kept in the package for the same reason section labels are: the admin and
 * developer apps render the same editor, and one catalogue per app would be
 * two copies of every string.
 */

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
  linkSearch: { en: 'Search results', id: 'Hasil pencarian' },
  linkUrl: { en: 'Web address', id: 'Alamat web' },
  productSlug: { en: 'Product URL name (slug)', id: 'Nama URL produk (slug)' },
  searchQuery: { en: 'Search for', id: 'Cari' },
  urlHelp: { en: 'Must start with https://', id: 'Harus diawali https://' },
  choose: { en: 'Choose…', id: 'Pilih…' },
  preview: { en: 'Preview', id: 'Pratinjau' },
  close: { en: 'Close editor', id: 'Tutup editor' },
  unsavedTitle: { en: 'Save your changes?', id: 'Simpan perubahan Anda?' },
  unsavedBody: {
    en: 'You have changes that are not saved yet. Save them before closing, or discard them.',
    id: 'Ada perubahan yang belum disimpan. Simpan sebelum menutup, atau buang perubahannya.',
  },
  keepEditing: { en: 'Keep editing', id: 'Lanjut mengedit' },
  discard: { en: 'Discard changes', id: 'Buang perubahan' },
  saveAndClose: { en: 'Save and close', id: 'Simpan dan tutup' },
  previewNote: {
    en: 'Click a section in the preview to edit it.',
    id: 'Klik bagian di pratinjau untuk mengeditnya.',
  },
} satisfies Record<string, Localized>

export type EditorMessage = keyof typeof MESSAGES

export function useEditorText() {
  const { locale } = useLocale()
  return {
    locale,
    t: (key: EditorMessage) => localize(MESSAGES[key], locale),
    l: (text: Localized) => localize(text, locale),
  }
}
