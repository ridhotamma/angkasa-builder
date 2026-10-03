/**
 * The icon catalogue shared by data sections and the primitive blocks.
 *
 * A fixed set of keys rather than an icon name, so a stored layout cannot ask
 * the renderer for a component that does not exist. Mapped to glyphs in
 * `render/icons`.
 */

import type { Localized } from './localized'

export const FEATURE_ICONS = [
  'truck',
  'cash',
  'shield',
  'refresh',
  'leaf',
  'star',
  'heart',
  'gift',
  'clock',
  'chat',
  'package',
  'badge',
  'sparkles',
  'pin',
  'card',
  'phone',
  'award',
  'droplet',
  'ruler',
  'hand',
] as const

export type FeatureIcon = (typeof FEATURE_ICONS)[number]

export const FEATURE_ICON_LABELS: Record<FeatureIcon, Localized> = {
  truck: { en: 'Delivery truck', id: 'Truk pengiriman' },
  cash: { en: 'Cash (COD)', id: 'Uang tunai (COD)' },
  shield: { en: 'Shield (guarantee)', id: 'Perisai (garansi)' },
  refresh: { en: 'Returns', id: 'Pengembalian' },
  leaf: { en: 'Leaf (natural)', id: 'Daun (alami)' },
  star: { en: 'Star', id: 'Bintang' },
  heart: { en: 'Heart', id: 'Hati' },
  gift: { en: 'Gift', id: 'Hadiah' },
  clock: { en: 'Clock', id: 'Jam' },
  chat: { en: 'Chat', id: 'Obrolan' },
  package: { en: 'Package', id: 'Paket' },
  badge: { en: 'Verified badge', id: 'Lencana terverifikasi' },
  sparkles: { en: 'Sparkles', id: 'Kilau' },
  pin: { en: 'Map pin', id: 'Penanda peta' },
  card: { en: 'Card payment', id: 'Pembayaran kartu' },
  phone: { en: 'Phone', id: 'Telepon' },
  award: { en: 'Award', id: 'Penghargaan' },
  droplet: { en: 'Droplet', id: 'Tetesan' },
  ruler: { en: 'Ruler (size)', id: 'Penggaris (ukuran)' },
  hand: { en: 'Handmade', id: 'Buatan tangan' },
}

/** The options an icon picker offers, labels already localised. */
export function featureIconOptions(): ReadonlyArray<{ value: FeatureIcon; label: Localized }> {
  return FEATURE_ICONS.map((value) => ({ value, label: FEATURE_ICON_LABELS[value] }))
}
