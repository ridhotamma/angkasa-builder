/**
 * The glyph for each name in the icon catalogue (`ICON_NAMES`).
 *
 * The map is keyed by `IconName`, so TypeScript fails the build if a catalogue
 * name has no glyph here — the catalogue and its glyphs can never drift.
 */

import type { IconType } from 'react-icons'
import {
  LuAward,
  LuBadgeCheck,
  LuBanknote,
  LuBookOpen,
  LuCake,
  LuCalendar,
  LuCamera,
  LuCar,
  LuClock,
  LuCoffee,
  LuCreditCard,
  LuCrown,
  LuDroplet,
  LuFileText,
  LuFlame,
  LuGift,
  LuGlobe,
  LuHand,
  LuHandshake,
  LuHeart,
  LuImage,
  LuLeaf,
  LuLock,
  LuMail,
  LuMapPin,
  LuMegaphone,
  LuMessageCircle,
  LuPackage,
  LuPalette,
  LuPawPrint,
  LuPhone,
  LuPlane,
  LuReceipt,
  LuRefreshCw,
  LuRuler,
  LuScissors,
  LuSend,
  LuSettings,
  LuShieldCheck,
  LuShoppingBag,
  LuShoppingCart,
  LuSparkles,
  LuSprout,
  LuStar,
  LuStore,
  LuSun,
  LuTag,
  LuTicket,
  LuTimer,
  LuTruck,
  LuUser,
  LuUsers,
  LuUtensils,
  LuVideo,
  LuWallet,
  LuWrench,
} from 'react-icons/lu'

import { NO_ICON, resolveIconName, type IconName } from '../model/icons'

export const ICON_GLYPHS: Record<IconName, IconType> = {
  // Commerce and trust
  truck: LuTruck,
  banknote: LuBanknote,
  'shield-check': LuShieldCheck,
  'refresh-cw': LuRefreshCw,
  package: LuPackage,
  'shopping-bag': LuShoppingBag,
  'shopping-cart': LuShoppingCart,
  store: LuStore,
  tag: LuTag,
  ticket: LuTicket,
  receipt: LuReceipt,
  wallet: LuWallet,
  'credit-card': LuCreditCard,
  handshake: LuHandshake,

  // Contact and support
  phone: LuPhone,
  mail: LuMail,
  send: LuSend,
  'message-circle': LuMessageCircle,
  megaphone: LuMegaphone,

  // Place and delivery
  'map-pin': LuMapPin,
  globe: LuGlobe,
  car: LuCar,
  plane: LuPlane,

  // Time
  clock: LuClock,
  calendar: LuCalendar,
  timer: LuTimer,

  // Nature
  leaf: LuLeaf,
  sprout: LuSprout,
  sun: LuSun,
  droplet: LuDroplet,
  flame: LuFlame,

  // Food and drink
  coffee: LuCoffee,
  utensils: LuUtensils,
  cake: LuCake,

  // People
  user: LuUser,
  users: LuUsers,

  // Symbols and status
  star: LuStar,
  heart: LuHeart,
  gift: LuGift,
  award: LuAward,
  'badge-check': LuBadgeCheck,
  sparkles: LuSparkles,
  crown: LuCrown,
  lock: LuLock,

  // Tools and media
  settings: LuSettings,
  wrench: LuWrench,
  ruler: LuRuler,
  scissors: LuScissors,
  palette: LuPalette,
  camera: LuCamera,
  video: LuVideo,
  image: LuImage,

  // Knowledge and documents
  'book-open': LuBookOpen,
  'file-text': LuFileText,

  // Animals and health
  hand: LuHand,
  'paw-print': LuPawPrint,
}

/**
 * The glyph a stored icon name draws, or `null` when the seller picked "No
 * icon". A name with no glyph (a layout from a newer release) falls back to a
 * sparkle, the way an unknown section falls back to nothing.
 */
export function iconGlyph(name: string): IconType | null {
  if (name === NO_ICON) return null
  const resolved = resolveIconName(name)
  return resolved ? ICON_GLYPHS[resolved] : LuSparkles
}
