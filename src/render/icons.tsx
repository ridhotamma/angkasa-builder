/** The glyph for each icon key a seller can pick (`FEATURE_ICONS`). */

import type { IconType } from 'react-icons'
import {
  LuAward,
  LuBadgeCheck,
  LuBanknote,
  LuClock,
  LuCreditCard,
  LuDroplet,
  LuGift,
  LuHand,
  LuHeart,
  LuLeaf,
  LuMapPin,
  LuMessageCircle,
  LuPackage,
  LuPhone,
  LuRefreshCw,
  LuRuler,
  LuShieldCheck,
  LuSparkles,
  LuStar,
  LuTruck,
} from 'react-icons/lu'

import type { FeatureIcon } from '../model/sections'

export const FEATURE_ICON_GLYPHS: Record<FeatureIcon, IconType> = {
  truck: LuTruck,
  cash: LuBanknote,
  shield: LuShieldCheck,
  refresh: LuRefreshCw,
  leaf: LuLeaf,
  star: LuStar,
  heart: LuHeart,
  gift: LuGift,
  clock: LuClock,
  chat: LuMessageCircle,
  package: LuPackage,
  badge: LuBadgeCheck,
  sparkles: LuSparkles,
  pin: LuMapPin,
  card: LuCreditCard,
  phone: LuPhone,
  award: LuAward,
  droplet: LuDroplet,
  ruler: LuRuler,
  hand: LuHand,
}

export function featureIcon(key: string): IconType {
  return FEATURE_ICON_GLYPHS[key as FeatureIcon] ?? LuSparkles
}
