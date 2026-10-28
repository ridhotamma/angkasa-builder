/**
 * A stock photo stored in an image field.
 *
 * The page builder's image fields normally hold a media file id. A stock photo
 * is the one other thing they may hold: the provider's CDN URL, hotlinked
 * exactly as the provider's terms require — never copied into the shop's
 * bucket. The photographer's credit rides in the URL **fragment**, which
 * browsers never send to the server: the CDN serves the same bytes, and the
 * renderer can still show the attribution the APIs require.
 *
 *   https://images.pexels.com/photos/123/pexels-photo-123.jpeg#pexels:Jane%20Doe:https%3A%2F%2Fwww.pexels.com%2F%40jane
 *
 * This module is pure and shared by the page-builder model (which sanitises
 * the value) and the theme's image component (which renders the credit).
 */

export const STOCK_PHOTO_PROVIDERS = ['pixabay', 'pexels', 'unsplash'] as const
export type StockPhotoProvider = (typeof STOCK_PHOTO_PROVIDERS)[number]

/**
 * Each provider's dedicated image host. Pixabay's `pixabay.com/get/`
 * renditions are the one path that also passes, handled in `providerForUrl`.
 */
export const STOCK_PHOTO_HOSTS: Record<StockPhotoProvider, string> = {
  pixabay: 'cdn.pixabay.com',
  pexels: 'images.pexels.com',
  unsplash: 'images.unsplash.com',
}

/** The provider's own site, where the attribution link must point. */
export const STOCK_PHOTO_SITES: Record<StockPhotoProvider, readonly string[]> = {
  pixabay: ['pixabay.com', 'www.pixabay.com'],
  pexels: ['www.pexels.com', 'pexels.com'],
  unsplash: ['unsplash.com', 'www.unsplash.com'],
}

export interface StockPhotoCredit {
  provider: StockPhotoProvider
  photographer: string
  /** The photographer's page on the provider — the link attribution needs. */
  photographerUrl: string
}

export interface StockPhotoRef extends StockPhotoCredit {
  /** The CDN base URL, with no sizing query. */
  url: string
}

/** A safe upper bound: the JSON a section stores is capped at 200 KB anyway. */
const MAX_VALUE = 700
const MAX_PHOTOGRAPHER = 80

/**
 * Pixabay's API now also answers with `pixabay.com/get/` renditions — the same
 * host as its site, where only that path is an image and every other path is
 * a page. The other providers keep a dedicated CDN host.
 */
function providerForUrl(url: URL): StockPhotoProvider | null {
  const found = STOCK_PHOTO_PROVIDERS.find(
    (provider) => STOCK_PHOTO_HOSTS[provider] === url.hostname,
  )
  if (found) return found
  if (url.hostname === 'pixabay.com' && url.pathname.startsWith('/get/')) return 'pixabay'
  return null
}

function isProviderSite(provider: StockPhotoProvider, host: string): boolean {
  return STOCK_PHOTO_SITES[provider].includes(host)
}

/**
 * The stored value for a photo: its CDN URL with the credit appended as a
 * fragment. The provider's own sizing parameters are kept off — the renderer
 * adds the ones the box needs.
 */
export function stockPhotoValue(url: string, credit: StockPhotoCredit): string {
  const base = baseUrl(url)
  const name = encodeURIComponent(credit.photographer.trim().slice(0, MAX_PHOTOGRAPHER))
  const profile = encodeURIComponent(credit.photographerUrl.trim())
  return `${base}#${credit.provider}:${name}:${profile}`
}

/** The CDN base: origin + path, no query and no fragment. */
export function baseUrl(value: string): string {
  try {
    const url = new URL(value)
    return `${url.origin}${url.pathname}`
  } catch {
    return ''
  }
}

/**
 * A stored value as its parts, or `null` when it is not a well-formed stock
 * photo. Both the host and the attribution link are checked: a value that
 * pointed its credit at an arbitrary site would be an open redirect in the
 * middle of a storefront image.
 */
export function parseStockPhoto(value: string | null | undefined): StockPhotoRef | null {
  if (!value || value.length > MAX_VALUE) return null

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null

  const provider = providerForUrl(url)
  if (!provider) return null

  const fragment = url.hash.slice(1)
  if (!fragment) return null
  const [tag, encodedName, encodedProfile] = fragment.split(':')
  if (tag !== provider || !encodedName || !encodedProfile) return null

  let photographer: string
  let photographerUrl: string
  try {
    photographer = decodeURIComponent(encodedName).trim().slice(0, MAX_PHOTOGRAPHER)
    photographerUrl = decodeURIComponent(encodedProfile).trim()
  } catch {
    return null
  }
  if (!photographer || !photographerUrl) return null

  let profile: URL
  try {
    profile = new URL(photographerUrl)
  } catch {
    return null
  }
  if (profile.protocol !== 'https:' || !isProviderSite(provider, profile.hostname)) return null

  return {
    provider,
    url: baseUrl(value),
    photographer,
    photographerUrl: profile.toString(),
  }
}

export function isStockPhoto(value: unknown): value is string {
  return typeof value === 'string' && parseStockPhoto(value) !== null
}

/**
 * The `crossorigin` attribute an `<img>` for this value must carry: a
 * hotlinked stock photo is fetched anonymously, so the provider's CDN — and
 * the bot-management cookies it sets — never touch the shopper's cookie jar.
 * Anything else (a media file id, a key, an ordinary URL) keeps the element's
 * default. `stockPhotoSrc` keeps the credit fragment, so this works on both
 * the stored value and the URL the renderer builds from it.
 */
export function stockPhotoCrossOrigin(value: string | null | undefined): 'anonymous' | undefined {
  return parseStockPhoto(value) ? 'anonymous' : undefined
}

/**
 * The photo at the size a render box wants.
 *
 * Pexels and Unsplash resize by query parameter and ignore parameters they do
 * not know, so the base URL the value stores stays untouched and the box's
 * width is applied here. Pixabay's CDN serves fixed renditions and reads no
 * parameters, so its stored URL passes through as-is. The fragment — the
 * credit — is carried through for the renderer to show.
 */
export function stockPhotoSrc(
  value: string,
  size: { width?: number; height?: number } = {},
): string | null {
  const photo = parseStockPhoto(value)
  if (!photo) return null

  const width = Math.min(4_000, Math.max(120, Math.round(size.width ?? 1_600)))
  const url = new URL(photo.url)
  if (photo.provider === 'pexels') {
    url.searchParams.set('auto', 'compress')
    url.searchParams.set('cs', 'tinysrgb')
    url.searchParams.set('w', String(width))
  } else if (photo.provider === 'unsplash') {
    url.searchParams.set('w', String(width))
    url.searchParams.set('q', '80')
    url.searchParams.set('fm', 'webp')
    url.searchParams.set('fit', 'crop')
  }

  const name = encodeURIComponent(photo.photographer)
  const profile = encodeURIComponent(photo.photographerUrl)
  url.hash = `${photo.provider}:${name}:${profile}`
  return url.toString()
}

/**
 * Any stored image value through the stock sanitiser: a well-formed stock
 * photo is returned canonically, anything else as `''`. File ids are handled
 * by the caller, which owns the id shape.
 */
export function sanitizeStockPhoto(value: unknown): string {
  if (typeof value !== 'string') return ''
  const photo = parseStockPhoto(value)
  if (!photo) return ''
  return stockPhotoValue(photo.url, photo)
}
