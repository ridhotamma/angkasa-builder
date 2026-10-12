/**
 * The icon catalogue shared by data sections and the primitive blocks.
 *
 * A value is a Lucide icon's own name (`shield-check`), so the picker shows the
 * glyph's real name and searches by it, and a stored layout asks for an icon
 * the same way the icon set names one.
 *
 * This module is deliberately React-free: the root entry point imports it to
 * validate a saved layout on the server. The glyphs live in `render/icons`,
 * which keys its map by `IconName` — so TypeScript refuses a name here that has
 * no glyph there, and adding an icon is a two-line change the compiler checks.
 *
 * The set is curated rather than exhaustive: `render/icons` is on the
 * storefront's critical path, and every name ships a glyph to every page. It
 * stays a superset of the original semantic set, so a saved layout never loses
 * its icon.
 *
 * `''` is a real value too: the seller picked "No icon", and the renderer draws
 * nothing for it.
 */

export const ICON_NAMES = [
  // Commerce and trust
  'truck',
  'banknote',
  'shield-check',
  'refresh-cw',
  'package',
  'shopping-bag',
  'shopping-cart',
  'store',
  'tag',
  'ticket',
  'receipt',
  'wallet',
  'credit-card',
  'handshake',

  // Contact and support
  'phone',
  'mail',
  'send',
  'message-circle',
  'megaphone',

  // Place and delivery
  'map-pin',
  'globe',
  'car',
  'plane',

  // Time
  'clock',
  'calendar',
  'timer',

  // Nature
  'leaf',
  'sprout',
  'sun',
  'droplet',
  'flame',

  // Food and drink
  'coffee',
  'utensils',
  'cake',

  // People
  'user',
  'users',

  // Symbols and status
  'star',
  'heart',
  'gift',
  'award',
  'badge-check',
  'sparkles',
  'crown',
  'lock',

  // Tools and media
  'settings',
  'wrench',
  'ruler',
  'scissors',
  'palette',
  'camera',
  'video',
  'image',

  // Knowledge and documents
  'book-open',
  'file-text',

  // Animals and health
  'hand',
  'paw-print',
] as const

export type IconName = (typeof ICON_NAMES)[number]

/** The empty value: the seller chose "No icon", and nothing is drawn. */
export const NO_ICON = ''

/**
 * The keys a layout saved before the set moved to Lucide names still holds,
 * and the Lucide name each became — so a merchant's chosen icon survives the
 * rename. Read by the sanitiser, which stores only the new name.
 */
export const ICON_ALIASES: Record<string, IconName> = {
  cash: 'banknote',
  shield: 'shield-check',
  refresh: 'refresh-cw',
  chat: 'message-circle',
  badge: 'badge-check',
  pin: 'map-pin',
  card: 'credit-card',
}

/** The catalogue name a stored value means, or null when it is empty or unknown. */
export function resolveIconName(value: unknown): IconName | null {
  if (typeof value !== 'string' || value === NO_ICON) return null
  const key = ICON_ALIASES[value] ?? value
  return (ICON_NAMES as readonly string[]).includes(key) ? (key as IconName) : null
}
