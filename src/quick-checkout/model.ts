/**
 * Quick Checkout: a shop's link-in-bio page with its own one-sheet checkout.
 *
 * One page per shop, stored as JSON on `quick_checkout_pages` (a draft and its
 * published copy, like a theme). The page is a profile, an ordered list of
 * blocks — products, links, socials, contact, text, image, video — a look
 * (theme preset, layout, colours, fonts, shape) and the checkout's rules. See
 * docs/QUICK-CHECKOUT.md.
 *
 * Pure and dependency-light on purpose: the admin server validates with it,
 * the AI pipeline sanitises its answer with it, the editor previews from it
 * and the storefront renders from it. Every reader goes through
 * `sanitizeQuickCheckoutContent`, which never throws — an unknown block is
 * dropped, an invalid value falls back to its default, a URL that is not
 * http(s) is emptied — so a stored row can never take the page down.
 */

import { z } from 'zod'

import { findFont, isFontFamily } from '../model/font-library'
import type { Localized } from '../model/localized'
import {
  contrastRatio,
  DEFAULT_THEME_SETTINGS,
  fontHref,
  fontStack,
  mix,
  readableOn,
  sanitizeThemeSettings,
  type ButtonStyle,
  type CardStyle,
  type RadiusOption,
  type ThemeSettings,
} from '../model/settings'

export const QUICK_CHECKOUT_VERSION = 1

/** Mirrors the `draftJson` / `publishedJson` column size. */
export const MAX_QUICK_CHECKOUT_JSON_BYTES = 60_000

export const MAX_QC_BLOCKS = 20
export const MAX_QC_PRODUCTS_PER_BLOCK = 30
export const MAX_QC_LINKS_PER_BLOCK = 20
/** What a products block shows when the seller has not picked any. */
export const QC_AUTO_PRODUCTS = 12

/* -------------------------------------------------------------------------- */
/* Look                                                                       */
/* -------------------------------------------------------------------------- */

export const QC_THEME_IDS = [
  'clean',
  'midnight',
  'sunset',
  'blush',
  'forest',
  'brutal',
  'ocean',
  'kopi',
] as const
export type QcThemeId = (typeof QC_THEME_IDS)[number]

/**
 * How the profile and the products are arranged.
 *
 * - `list`    — centred profile, one row per product (the classic bio link);
 * - `grid`    — centred profile, products two to a row like a mini shop;
 * - `hero`    — a cover banner with the avatar on its edge, products as large
 *               cards: for a seller with a few hero products;
 * - `minimal` — a compact header and text-first rows: for links and services.
 */
export const QC_LAYOUTS = ['list', 'grid', 'hero', 'minimal'] as const
export type QcLayout = (typeof QC_LAYOUTS)[number]

export const QC_BACKGROUND_KINDS = ['solid', 'gradient', 'image'] as const
export type QcBackgroundKind = (typeof QC_BACKGROUND_KINDS)[number]

export const QC_RADII = ['none', 'sm', 'md', 'lg', 'full'] as const
export type QcRadius = (typeof QC_RADII)[number]

/** `hard` is the offset-shadow, thick-border look. */
export const QC_BUTTON_STYLES = ['solid', 'soft', 'outline', 'hard'] as const
export type QcButtonStyle = (typeof QC_BUTTON_STYLES)[number]

export const QC_CARD_STYLES = ['solid', 'glass', 'outline', 'hard'] as const
export type QcCardStyle = (typeof QC_CARD_STYLES)[number]

export interface QcBackground {
  kind: QcBackgroundKind
  /** The solid colour, the gradient's first stop, and the tint over an image. */
  color: string
  /** The gradient's second stop. */
  gradientTo: string
  /** The gradient's direction in degrees, in steps of 15. */
  angle: number
  /** A media file id or stock photo; only read when `kind` is `image`. */
  imageFileId: string | null
}

export interface QcStyle {
  theme: QcThemeId
  layout: QcLayout
  background: QcBackground
  /** Cards and the checkout sheet. */
  surface: string
  text: string
  /** Buttons, prices and highlights. */
  accent: string
  fontHeading: string
  fontBody: string
  radius: QcRadius
  buttonStyle: QcButtonStyle
  cardStyle: QcCardStyle
}

export interface QcThemePreset {
  id: QcThemeId
  name: Localized
  /** The words the AI matches a seller's brief against. */
  mood: string
  style: Omit<QcStyle, 'theme'>
}

const solid = (color: string): QcBackground => ({
  kind: 'solid',
  color,
  gradientTo: color,
  angle: 180,
  imageFileId: null,
})

const gradient = (from: string, to: string, angle: number): QcBackground => ({
  kind: 'gradient',
  color: from,
  gradientTo: to,
  angle,
  imageFileId: null,
})

/** The starting points. A seller picks one, then may change any value. */
export const QC_THEME_PRESETS: readonly QcThemePreset[] = [
  {
    id: 'clean',
    name: { en: 'Clean', id: 'Bersih' },
    mood: 'minimal, modern, neutral, professional, monochrome',
    style: {
      layout: 'list',
      background: solid('#f5f5f4'),
      surface: '#ffffff',
      text: '#18181b',
      accent: '#18181b',
      fontHeading: 'Inter',
      fontBody: 'Inter',
      radius: 'lg',
      buttonStyle: 'solid',
      cardStyle: 'solid',
    },
  },
  {
    id: 'midnight',
    name: { en: 'Midnight', id: 'Tengah malam' },
    mood: 'dark, techy, creator, gaming, digital products, night',
    style: {
      layout: 'list',
      background: gradient('#0b1020', '#2e1065', 160),
      surface: '#1e1b4b',
      text: '#f8fafc',
      accent: '#a78bfa',
      fontHeading: 'Space Grotesk',
      fontBody: 'Inter',
      radius: 'lg',
      buttonStyle: 'soft',
      cardStyle: 'glass',
    },
  },
  {
    id: 'sunset',
    name: { en: 'Sunset', id: 'Senja' },
    mood: 'warm, energetic, fun, food, beauty, summer',
    style: {
      layout: 'grid',
      background: gradient('#ffd3a5', '#fd6585', 135),
      surface: '#ffffff',
      text: '#2a1215',
      accent: '#e11d48',
      fontHeading: 'Poppins',
      fontBody: 'Poppins',
      radius: 'full',
      buttonStyle: 'solid',
      cardStyle: 'solid',
    },
  },
  {
    id: 'blush',
    name: { en: 'Blush', id: 'Merona' },
    mood: 'soft, feminine, cute, pastel, beauty, kids, handmade',
    style: {
      layout: 'grid',
      background: solid('#fdf2f8'),
      surface: '#ffffff',
      text: '#500724',
      accent: '#db2777',
      fontHeading: 'Nunito',
      fontBody: 'Nunito',
      radius: 'full',
      buttonStyle: 'soft',
      cardStyle: 'outline',
    },
  },
  {
    id: 'forest',
    name: { en: 'Forest', id: 'Hutan' },
    mood: 'natural, elegant, premium, organic, herbal, wellness, luxury',
    style: {
      layout: 'hero',
      background: solid('#10291f'),
      surface: '#183a2c',
      text: '#f1ead8',
      accent: '#e9b872',
      fontHeading: 'Playfair Display',
      fontBody: 'DM Sans',
      radius: 'md',
      buttonStyle: 'solid',
      cardStyle: 'solid',
    },
  },
  {
    id: 'brutal',
    name: { en: 'Bold', id: 'Berani' },
    mood: 'bold, playful, streetwear, youth, loud, neo-brutalist',
    style: {
      layout: 'list',
      background: solid('#fff4d6'),
      surface: '#ffffff',
      text: '#111111',
      accent: '#ff5c39',
      fontHeading: 'Space Grotesk',
      fontBody: 'Space Grotesk',
      radius: 'sm',
      buttonStyle: 'hard',
      cardStyle: 'hard',
    },
  },
  {
    id: 'ocean',
    name: { en: 'Ocean', id: 'Samudra' },
    mood: 'fresh, calm, travel, sport, clean blue, trustworthy',
    style: {
      layout: 'hero',
      background: gradient('#0369a1', '#1e3a8a', 180),
      surface: '#ffffff',
      text: '#ffffff',
      accent: '#0369a1',
      fontHeading: 'Montserrat',
      fontBody: 'Montserrat',
      radius: 'lg',
      buttonStyle: 'solid',
      cardStyle: 'solid',
    },
  },
  {
    id: 'kopi',
    name: { en: 'Coffee', id: 'Kopi' },
    mood: 'cozy, coffee, bakery, traditional, batik, local, rustic, earthy',
    style: {
      layout: 'minimal',
      background: solid('#f3e9dc'),
      surface: '#fffaf3',
      text: '#3b2a1f',
      accent: '#7a4b2a',
      fontHeading: 'Lora',
      fontBody: 'Nunito Sans',
      radius: 'md',
      buttonStyle: 'solid',
      cardStyle: 'solid',
    },
  },
]

export function findQcTheme(id: string): QcThemePreset {
  return QC_THEME_PRESETS.find((preset) => preset.id === id) ?? QC_THEME_PRESETS[0]!
}

/**
 * A preset's whole look. The layout is the seller's separate choice and is
 * kept, so trying themes on never rearranges the page.
 */
export function applyQcTheme(style: QcStyle, id: QcThemeId): QcStyle {
  const preset = findQcTheme(id)
  return { ...preset.style, theme: preset.id, layout: style.layout }
}

export const QC_LAYOUT_LABELS: Record<QcLayout, Localized> = {
  list: { en: 'List', id: 'Daftar' },
  grid: { en: 'Grid', id: 'Grid' },
  hero: { en: 'Spotlight', id: 'Sorotan' },
  minimal: { en: 'Minimal', id: 'Minimalis' },
}

/* -------------------------------------------------------------------------- */
/* Blocks                                                                     */
/* -------------------------------------------------------------------------- */

export const QC_BLOCK_TYPES = [
  'products',
  'links',
  'socials',
  'contact',
  'text',
  'image',
  'video',
] as const
export type QcBlockType = (typeof QC_BLOCK_TYPES)[number]

export const QC_BLOCK_LABELS: Record<QcBlockType, Localized> = {
  products: { en: 'Products', id: 'Produk' },
  links: { en: 'Links', id: 'Tautan' },
  socials: { en: 'Social media', id: 'Media sosial' },
  contact: { en: 'Contact', id: 'Kontak' },
  text: { en: 'Text', id: 'Teks' },
  image: { en: 'Image banner', id: 'Banner gambar' },
  video: { en: 'YouTube video', id: 'Video YouTube' },
}

/** In the order a shopper in Indonesia expects to find them. */
export const QC_SOCIAL_PLATFORMS = [
  'instagram',
  'tiktok',
  'youtube',
  'facebook',
  'x',
  'threads',
  'shopee',
  'tokopedia',
  'telegram',
  'linkedin',
  'spotify',
  'website',
] as const
export type QcSocialPlatform = (typeof QC_SOCIAL_PLATFORMS)[number]

export const QC_SOCIAL_LABELS: Record<QcSocialPlatform, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  facebook: 'Facebook',
  x: 'X',
  threads: 'Threads',
  shopee: 'Shopee',
  tokopedia: 'Tokopedia',
  telegram: 'Telegram',
  linkedin: 'LinkedIn',
  spotify: 'Spotify',
  website: 'Website',
}

interface QcBlockBase {
  id: string
  /** Hidden blocks stay in the draft but are not drawn. */
  visible: boolean
}

export interface QcProductsBlock extends QcBlockBase {
  type: 'products'
  title: string
  /** In display order. Empty shows the shop's newest live products. */
  productIds: string[]
}

export interface QcLinkItem {
  id: string
  label: string
  url: string
  /** Drawn in the accent colour, for the one link that matters most. */
  highlight: boolean
}

export interface QcLinksBlock extends QcBlockBase {
  type: 'links'
  title: string
  items: QcLinkItem[]
}

export interface QcSocialItem {
  platform: QcSocialPlatform
  /** A URL, or a handle (`@kaoskeren`) for the platforms that have them. */
  value: string
}

export interface QcSocialsBlock extends QcBlockBase {
  type: 'socials'
  items: QcSocialItem[]
}

export interface QcContactBlock extends QcBlockBase {
  type: 'contact'
  title: string
  whatsapp: string
  /** Prefilled into the chat the button opens. */
  whatsappMessage: string
  email: string
  phone: string
  /** A WhatsApp bubble pinned to the corner of the page. */
  floating: boolean
}

export interface QcTextBlock extends QcBlockBase {
  type: 'text'
  title: string
  body: string
  align: 'left' | 'center'
}

export interface QcImageBlock extends QcBlockBase {
  type: 'image'
  imageFileId: string | null
  url: string
  alt: string
}

export interface QcVideoBlock extends QcBlockBase {
  type: 'video'
  title: string
  url: string
}

export type QcBlock =
  | QcProductsBlock
  | QcLinksBlock
  | QcSocialsBlock
  | QcContactBlock
  | QcTextBlock
  | QcImageBlock
  | QcVideoBlock

/* -------------------------------------------------------------------------- */
/* The page                                                                   */
/* -------------------------------------------------------------------------- */

export interface QcProfile {
  name: string
  bio: string
  avatarFileId: string | null
  coverFileId: string | null
  location: string
}

/**
 * - `ship` asks for an address and prices delivery like the cart does;
 * - `none` asks for none: digital products, services, pre-orders collected in
 *   person. The order carries no address and no shipping charge.
 */
export const QC_DELIVERY_MODES = ['ship', 'none'] as const
export type QcDeliveryMode = (typeof QC_DELIVERY_MODES)[number]

export const QC_EMAIL_MODES = ['hidden', 'optional', 'required'] as const
export type QcEmailMode = (typeof QC_EMAIL_MODES)[number]

export interface QcCheckout {
  delivery: QcDeliveryMode
  email: QcEmailMode
  allowNote: boolean
  allowQuantity: boolean
  /** Empty uses the page's own "Buy now" in the shopper's language. */
  buttonLabel: string
}

export interface QcSeo {
  title: string
  description: string
}

export interface QuickCheckoutContent {
  version: typeof QUICK_CHECKOUT_VERSION
  profile: QcProfile
  style: QcStyle
  blocks: QcBlock[]
  checkout: QcCheckout
  seo: QcSeo
}

/* -------------------------------------------------------------------------- */
/* Sanitising                                                                 */
/* -------------------------------------------------------------------------- */

const HEX = /^#[0-9a-f]{6}$/i
const ID = /^[a-zA-Z0-9_-]{1,36}$/
/** Appwrite ids, or a hotlinked stock photo (`https://images.pexels.com/...#credit`). */
const FILE_ID = /^(?:[a-zA-Z0-9._-]{1,36}|https:\/\/(?:cdn\.pixabay\.com|images\.pexels\.com|images\.unsplash\.com)\/[^\s"'<>]{1,500})$/

const text = (max: number, fallback = '') =>
  z
    .string()
    .transform((value) => value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max))
    .catch(fallback)

/** Multi-line copy keeps its line breaks, but no more than two in a row. */
const prose = (max: number) =>
  z
    .string()
    .transform((value) =>
      value
        .replace(/\r\n?/g, '\n')
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .slice(0, max),
    )
    .catch('')

const hex = (fallback: string) =>
  z
    .string()
    .transform((value) => value.trim().toLowerCase())
    .refine((value) => HEX.test(value))
    .catch(fallback)

const fileId = z
  .string()
  .trim()
  .refine((value) => FILE_ID.test(value))
  .nullable()
  .catch(null)

const font = (fallback: string) =>
  z
    .string()
    .refine((value) => isFontFamily(value))
    .catch(fallback)

const flag = (fallback: boolean) => z.boolean().catch(fallback)

function oneOf<const T extends readonly [string, ...string[]]>(values: T, fallback: T[number]) {
  return z.enum(values).catch(fallback)
}

/** A short random id for a new block or link. Not a secret, just unique on the page. */
export function qcId(prefix = 'b'): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 10)
      : Math.random().toString(36).slice(2, 12)
  return `${prefix}${random}`
}

const blockId = z
  .string()
  .refine((value) => ID.test(value))
  .catch(() => qcId())

/**
 * A link the page may open: http(s) only, a bare domain gets `https://`.
 * Anything else — `javascript:`, `data:`, a relative path — becomes empty, and
 * an empty link is not drawn.
 */
export function safeUrl(value: unknown): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim().slice(0, 500)
  if (!trimmed) return ''
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(candidate)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return ''
    if (!url.hostname.includes('.')) return ''
    return url.toString()
  } catch {
    return ''
  }
}

const url = z.unknown().transform(safeUrl)

const linkItemSchema = z.object({
  id: blockId,
  label: text(60),
  url,
  highlight: flag(false),
})

const socialItemSchema = z.object({
  platform: z.enum(QC_SOCIAL_PLATFORMS),
  value: text(200),
})

const base = { id: blockId, visible: flag(true) }

const blockSchemas = {
  products: z.object({
    ...base,
    type: z.literal('products'),
    title: text(80),
    productIds: z
      .array(z.unknown())
      .catch([])
      .transform((ids) =>
        [...new Set(ids.filter((id): id is string => typeof id === 'string' && ID.test(id)))].slice(
          0,
          MAX_QC_PRODUCTS_PER_BLOCK,
        ),
      ),
  }),
  links: z.object({
    ...base,
    type: z.literal('links'),
    title: text(80),
    items: z
      .array(z.unknown())
      .catch([])
      .transform((items) =>
        items
          .flatMap((item) => {
            const parsed = linkItemSchema.safeParse(item)
            return parsed.success ? [parsed.data] : []
          })
          .slice(0, MAX_QC_LINKS_PER_BLOCK),
      ),
  }),
  socials: z.object({
    ...base,
    type: z.literal('socials'),
    items: z
      .array(z.unknown())
      .catch([])
      .transform((items) => {
        const seen = new Set<string>()
        return items.flatMap((item) => {
          const parsed = socialItemSchema.safeParse(item)
          if (!parsed.success || seen.has(parsed.data.platform)) return []
          seen.add(parsed.data.platform)
          return [parsed.data]
        })
      }),
  }),
  contact: z.object({
    ...base,
    type: z.literal('contact'),
    title: text(80),
    whatsapp: text(24).transform((value) => value.replace(/[^\d+\s-]/g, '')),
    whatsappMessage: text(200),
    email: text(128).transform((value) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : '')),
    phone: text(24).transform((value) => value.replace(/[^\d+\s-]/g, '')),
    floating: flag(false),
  }),
  text: z.object({
    ...base,
    type: z.literal('text'),
    title: text(80),
    body: prose(1000),
    align: oneOf(['left', 'center'], 'center'),
  }),
  image: z.object({
    ...base,
    type: z.literal('image'),
    imageFileId: fileId,
    url,
    alt: text(120),
  }),
  video: z.object({
    ...base,
    type: z.literal('video'),
    title: text(80),
    url,
  }),
} satisfies Record<QcBlockType, z.ZodType>

/** One block, or `null` when it is not one the page knows how to draw. */
export function sanitizeQcBlock(value: unknown): QcBlock | null {
  if (!value || typeof value !== 'object') return null
  const type = (value as { type?: unknown }).type
  if (typeof type !== 'string' || !(QC_BLOCK_TYPES as readonly string[]).includes(type)) return null
  const parsed = blockSchemas[type as QcBlockType].safeParse(value)
  return parsed.success ? (parsed.data as QcBlock) : null
}

function sanitizeBlocks(value: unknown): QcBlock[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const blocks: QcBlock[] = []
  for (const candidate of value) {
    const block = sanitizeQcBlock(candidate)
    if (!block) continue
    // Two blocks with one id would make the editor's list and the preview
    // disagree about which one was dragged.
    if (seen.has(block.id)) block.id = qcId()
    seen.add(block.id)
    blocks.push(block)
    if (blocks.length >= MAX_QC_BLOCKS) break
  }
  return blocks
}

function sanitizeStyle(value: unknown): QcStyle {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const preset = findQcTheme(typeof raw.theme === 'string' ? raw.theme : 'clean')
  const fallback = preset.style
  const background = (raw.background && typeof raw.background === 'object'
    ? raw.background
    : {}) as Record<string, unknown>

  return z
    .object({
      theme: oneOf(QC_THEME_IDS, preset.id),
      layout: oneOf(QC_LAYOUTS, fallback.layout),
      background: z.object({
        kind: oneOf(QC_BACKGROUND_KINDS, fallback.background.kind),
        color: hex(fallback.background.color),
        gradientTo: hex(fallback.background.gradientTo),
        angle: z
          .number()
          .transform((angle) => (((Math.round(angle / 15) * 15) % 360) + 360) % 360)
          .catch(fallback.background.angle),
        imageFileId: fileId,
      }),
      surface: hex(fallback.surface),
      text: hex(fallback.text),
      accent: hex(fallback.accent),
      fontHeading: font(fallback.fontHeading),
      fontBody: font(fallback.fontBody),
      radius: oneOf(QC_RADII, fallback.radius),
      buttonStyle: oneOf(QC_BUTTON_STYLES, fallback.buttonStyle),
      cardStyle: oneOf(QC_CARD_STYLES, fallback.cardStyle),
    })
    .parse({ ...raw, background })
}

const profileSchema = z.object({
  name: text(60),
  bio: prose(280),
  avatarFileId: fileId,
  coverFileId: fileId,
  location: text(60),
})

const checkoutSchema = z.object({
  delivery: oneOf(QC_DELIVERY_MODES, 'ship'),
  email: oneOf(QC_EMAIL_MODES, 'optional'),
  allowNote: flag(true),
  allowQuantity: flag(true),
  buttonLabel: text(32),
})

const seoSchema = z.object({
  title: text(70),
  description: text(160),
})

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

/**
 * Any value to a page the renderer can draw. Never throws; the empty page is
 * the floor.
 */
export function sanitizeQuickCheckoutContent(value: unknown): QuickCheckoutContent {
  const raw = record(value)
  return {
    version: QUICK_CHECKOUT_VERSION,
    profile: profileSchema.parse(record(raw.profile)),
    style: sanitizeStyle(raw.style),
    blocks: sanitizeBlocks(raw.blocks),
    checkout: checkoutSchema.parse(record(raw.checkout)),
    seo: seoSchema.parse(record(raw.seo)),
  }
}

/** A stored column to a page; a malformed row reads as the empty page. */
export function parseQuickCheckoutContent(json: string | null | undefined): QuickCheckoutContent {
  if (!json) return sanitizeQuickCheckoutContent({})
  try {
    return sanitizeQuickCheckoutContent(JSON.parse(json))
  } catch {
    return sanitizeQuickCheckoutContent({})
  }
}

/** Sanitised and serialised, or an error a seller can act on when it is too large. */
export function serializeQuickCheckoutContent(content: unknown): string {
  const json = JSON.stringify(sanitizeQuickCheckoutContent(content))
  if (new TextEncoder().encode(json).length > MAX_QUICK_CHECKOUT_JSON_BYTES) {
    throw new Error('This page is too large. Remove a few blocks or links and try again.')
  }
  return json
}

/* -------------------------------------------------------------------------- */
/* Starting a page                                                            */
/* -------------------------------------------------------------------------- */

/** What the shop already knows about itself, to fill a new page from. */
export interface QcShopSeed {
  name: string
  description: string
  logoFileId: string | null
  bannerFileId: string | null
  contactEmail: string | null
  contactPhone: string | null
  socials: Partial<Record<QcSocialPlatform, string>>
}

export function newQcBlock(type: QcBlockType, locale: 'en' | 'id' = 'id'): QcBlock {
  const id = qcId()
  const word = (en: string, idText: string) => (locale === 'id' ? idText : en)
  switch (type) {
    case 'products':
      return { id, visible: true, type, title: word('Shop', 'Belanja'), productIds: [] }
    case 'links':
      return {
        id,
        visible: true,
        type,
        title: '',
        items: [{ id: qcId('l'), label: word('My website', 'Website saya'), url: '', highlight: false }],
      }
    case 'socials':
      return { id, visible: true, type, items: [] }
    case 'contact':
      return {
        id,
        visible: true,
        type,
        title: word('Get in touch', 'Hubungi kami'),
        whatsapp: '',
        whatsappMessage: word('Hi! I would like to ask about…', 'Halo kak, saya mau tanya…'),
        email: '',
        phone: '',
        floating: false,
      }
    case 'text':
      return { id, visible: true, type, title: '', body: '', align: 'center' }
    case 'image':
      return { id, visible: true, type, imageFileId: null, url: '', alt: '' }
    case 'video':
      return { id, visible: true, type, title: '', url: '' }
  }
}

/** A first draft from the shop's own profile: nothing to type before it looks right. */
export function starterQuickCheckout(
  shop: QcShopSeed,
  theme: QcThemeId = 'clean',
  locale: 'en' | 'id' = 'id',
): QuickCheckoutContent {
  const preset = findQcTheme(theme)
  const socials = QC_SOCIAL_PLATFORMS.flatMap((platform) => {
    const value = shop.socials[platform]?.trim()
    return value ? [{ platform, value }] : []
  })
  const products = newQcBlock('products', locale)
  const contact: QcContactBlock = {
    ...(newQcBlock('contact', locale) as QcContactBlock),
    whatsapp: shop.contactPhone ?? '',
    email: shop.contactEmail ?? '',
    floating: Boolean(shop.contactPhone),
  }
  const blocks: QcBlock[] = [
    ...(socials.length > 0 ? [{ id: qcId(), visible: true, type: 'socials' as const, items: socials }] : []),
    products,
    contact,
  ]
  return sanitizeQuickCheckoutContent({
    profile: {
      name: shop.name,
      bio: shop.description.slice(0, 280),
      avatarFileId: shop.logoFileId,
      coverFileId: shop.bannerFileId,
      location: '',
    },
    style: { ...preset.style, theme: preset.id },
    blocks,
    checkout: { delivery: 'ship', email: 'optional', allowNote: true, allowQuantity: true, buttonLabel: '' },
    seo: { title: '', description: '' },
  })
}

/* -------------------------------------------------------------------------- */
/* Colours                                                                    */
/* -------------------------------------------------------------------------- */

/** WCAG AA for body text. */
const MIN_TEXT_CONTRAST = 4.5
/** Large text and button labels. */
const MIN_UI_CONTRAST = 3

/**
 * The colours the page is actually drawn with.
 *
 * The seller's values are kept as they typed them; what is drawn is repaired
 * here, so a dark text on a dark gradient cannot ship unreadable whatever the
 * seller or the AI picked. `pageText` sits on the background (every stop of a
 * gradient, and the tint over an image), `cardText` on the cards.
 */
export interface QcPalette {
  pageText: string
  pageMuted: string
  card: string
  cardText: string
  cardMuted: string
  cardBorder: string
  accent: string
  accentText: string
  /** An accent that reads on the card, for prices and outline buttons. */
  accentOnCard: string
  /** The colour behind everything, used where a single value is needed. */
  backdrop: string
  /** The CSS `background` of the page. */
  pageBackground: string
  /** Whether the text was changed for readability, so the editor can say so. */
  repaired: boolean
  /**
   * Whether even the repaired text misses AA somewhere — a gradient whose two
   * stops no single text colour can serve. The editor warns; it never blocks.
   */
  lowContrast: boolean
}

function readableAgainst(color: string, backgrounds: string[], min: number): string {
  if (backgrounds.every((background) => contrastRatio(color, background) >= min)) return color
  // Whichever of near-white or near-black clears the worst background best.
  const candidates = ['#ffffff', '#111111']
  const score = (candidate: string) =>
    Math.min(...backgrounds.map((background) => contrastRatio(candidate, background)))
  return score(candidates[0]!) >= score(candidates[1]!) ? candidates[0]! : candidates[1]!
}

/** The accent, darkened or lightened until it reads on `background`. */
function accentAgainst(accent: string, background: string): string {
  if (contrastRatio(accent, background) >= MIN_UI_CONTRAST) return accent
  const toward = readableOn(background)
  for (let amount = 0.15; amount <= 0.9; amount += 0.15) {
    const candidate = mix(accent, toward, amount)
    if (contrastRatio(candidate, background) >= MIN_UI_CONTRAST) return candidate
  }
  return toward
}

function rgba(hexColor: string, alpha: number): string {
  const value = hexColor.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16))
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * `imageUrl` is only needed for an image background; without it the page
 * falls back to the background's tint.
 */
export function qcPalette(style: QcStyle, imageUrl?: string | null): QcPalette {
  const { background } = style
  const stops =
    background.kind === 'gradient' ? [background.color, background.gradientTo] : [background.color]
  const pageText = readableAgainst(style.text, stops, MIN_TEXT_CONTRAST)

  // An outline card has no fill of its own: its text sits on the page.
  const cardFill = style.cardStyle === 'outline' ? null : style.surface
  const cardBackgrounds = cardFill ? [cardFill] : stops
  const cardText = readableAgainst(style.text, cardBackgrounds, MIN_TEXT_CONTRAST)
  const cardBase = cardFill ?? background.color

  const accentText = readableOn(style.accent)
  const accentOnCard = accentAgainst(style.accent, cardBase)

  const card =
    style.cardStyle === 'outline'
      ? 'transparent'
      : style.cardStyle === 'glass'
        ? rgba(style.surface, 0.62)
        : style.surface

  let pageBackground = background.color
  if (background.kind === 'gradient') {
    pageBackground = `linear-gradient(${background.angle}deg, ${background.color}, ${background.gradientTo})`
  } else if (background.kind === 'image' && imageUrl) {
    // The tint keeps the text's contrast promise over any photograph.
    pageBackground = `linear-gradient(${rgba(background.color, 0.72)}, ${rgba(background.color, 0.72)}), url("${imageUrl.replace(/"/g, '%22')}") center / cover no-repeat`
  }

  return {
    pageText,
    pageMuted: mix(pageText, background.color, 0.32),
    card,
    cardText,
    cardMuted: mix(cardText, cardBase, 0.38),
    cardBorder:
      style.cardStyle === 'hard'
        ? cardText
        : style.cardStyle === 'glass'
          ? rgba(cardText, 0.14)
          : mix(cardText, cardBase, 0.82),
    accent: style.accent,
    accentText,
    accentOnCard,
    backdrop: background.color,
    pageBackground,
    repaired: pageText !== style.text || cardText !== style.text,
    lowContrast:
      stops.some((stop) => contrastRatio(pageText, stop) < MIN_TEXT_CONTRAST) ||
      cardBackgrounds.some((fill) => contrastRatio(cardText, fill) < MIN_TEXT_CONTRAST),
  }
}

export const QC_RADIUS_PX: Record<QcRadius, { card: string; button: string; image: string }> = {
  none: { card: '0px', button: '0px', image: '0px' },
  sm: { card: '6px', button: '6px', image: '4px' },
  md: { card: '12px', button: '10px', image: '8px' },
  lg: { card: '20px', button: '14px', image: '14px' },
  full: { card: '28px', button: '999px', image: '20px' },
}

export function qcFontStacks(style: QcStyle): { heading: string; body: string } {
  return { heading: fontStack(style.fontHeading), body: fontStack(style.fontBody) }
}

/** The Google Fonts stylesheet for the page's two faces, or `null` when neither is known. */
export function qcFontsHref(style: QcStyle): string | null {
  const parts = [...new Set([style.fontHeading, style.fontBody])].flatMap((family) => {
    const part = findFont(family) ? fontHref(family) : null
    return part ? [part] : []
  })
  return parts.length > 0 ? `https://fonts.googleapis.com/css2?${parts.join('&')}&display=swap` : null
}

/* -------------------------------------------------------------------------- */
/* As a store theme                                                           */
/* -------------------------------------------------------------------------- */

const THEME_RADIUS: Record<QcRadius, RadiusOption> = {
  none: 'none',
  sm: 'sm',
  md: 'md',
  lg: 'lg',
  full: 'lg',
}

/**
 * The page's look as storefront theme settings, for a simple store.
 *
 * A simple store's shopper starts on the Quick Checkout page and may go on to
 * a product page, the cart or checkout — storefront screens, drawn from theme
 * settings. Those take the page's colours, fonts and shape from here, so the
 * shop does not change its face halfway through a purchase.
 *
 * The page's background colour is the theme's (a gradient's first stop, an
 * image's tint), and its text is repaired against that the way `qcPalette`
 * repairs the page's own. Motion, the splash and the popup stay off: those
 * belong to a full store's theme.
 */
export function qcThemeSettings(style: QcStyle): ThemeSettings {
  const background = style.background.color
  const buttonStyle: ButtonStyle =
    style.buttonStyle === 'hard'
      ? 'hard'
      : style.buttonStyle === 'outline'
        ? 'outline'
        : style.radius === 'full'
          ? 'pill'
          : 'solid'
  const cardStyle: CardStyle =
    style.cardStyle === 'hard'
      ? 'hard'
      : style.cardStyle === 'solid'
        ? 'shadow'
        : 'border'
  return sanitizeThemeSettings({
    ...DEFAULT_THEME_SETTINGS,
    colors: {
      brand: style.accent,
      background,
      text: readableAgainst(style.text, [background], MIN_TEXT_CONTRAST),
      accent: style.accent,
    },
    fonts: { heading: style.fontHeading, body: style.fontBody },
    radius: THEME_RADIUS[style.radius],
    buttonStyle,
    cardStyle,
  })
}

/* -------------------------------------------------------------------------- */
/* Links                                                                      */
/* -------------------------------------------------------------------------- */

/** An Indonesian number in any of its spellings, as wa.me wants it: `628…`. */
export function whatsappNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('62')) return digits
  if (digits.startsWith('0')) return `62${digits.slice(1)}`
  if (digits.startsWith('8')) return `62${digits}`
  return digits
}

export function whatsappHref(raw: string, message = ''): string | null {
  const number = whatsappNumber(raw)
  if (number.length < 8) return null
  const text = message.trim()
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

const HANDLE_BASES: Partial<Record<QcSocialPlatform, string>> = {
  instagram: 'https://instagram.com/',
  tiktok: 'https://www.tiktok.com/@',
  youtube: 'https://www.youtube.com/@',
  x: 'https://x.com/',
  threads: 'https://www.threads.net/@',
  telegram: 'https://t.me/',
  shopee: 'https://shopee.co.id/',
  tokopedia: 'https://www.tokopedia.com/',
}

/** A social profile's address, from a URL or a bare handle. */
export function socialHref(platform: QcSocialPlatform, value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const handle = trimmed.replace(/^@/, '')
  const base = HANDLE_BASES[platform]
  if (base && /^[a-zA-Z0-9._-]{1,64}$/.test(handle) && !handle.includes('.')) {
    return `${base}${handle}`
  }
  return safeUrl(trimmed) || null
}

/** The video id of a YouTube watch, share, shorts or embed URL. */
export function youtubeId(value: string): string | null {
  const href = safeUrl(value)
  if (!href) return null
  const url = new URL(href)
  const host = url.hostname.replace(/^www\.|^m\./, '')
  let id: string | null = null
  if (host === 'youtu.be') id = url.pathname.slice(1)
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id =
      url.searchParams.get('v') ??
      url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1] ??
      null
  }
  return id && /^[a-zA-Z0-9_-]{6,20}$/.test(id) ? id : null
}

/** Every product id the page names, for the server to resolve in one read. */
export function qcProductIds(content: QuickCheckoutContent): string[] {
  return [
    ...new Set(
      content.blocks.flatMap((block) =>
        block.type === 'products' && block.visible ? block.productIds : [],
      ),
    ),
  ]
}

/** Whether any products block falls back to the newest products. */
export function qcNeedsAutoProducts(content: QuickCheckoutContent): boolean {
  return content.blocks.some(
    (block) => block.type === 'products' && block.visible && block.productIds.length === 0,
  )
}

/** The WhatsApp number the floating bubble opens, when a contact block asks for one. */
export function qcFloatingWhatsapp(
  content: QuickCheckoutContent,
): { number: string; message: string } | null {
  const block = content.blocks.find(
    (candidate): candidate is QcContactBlock =>
      candidate.type === 'contact' && candidate.visible && candidate.floating,
  )
  if (!block || !whatsappHref(block.whatsapp)) return null
  return { number: block.whatsapp, message: block.whatsappMessage }
}
