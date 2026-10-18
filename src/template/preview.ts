/**
 * Draft preview links.
 *
 * `pesanle-theme preview` prints a URL that makes the storefront draw a
 * shop's **draft** theme instead of its published one. The URL carries a
 * signature over `slug + version`, keyed by the project's API key — the same
 * secret the CLI pushes with and the storefront already holds — so nobody who
 * is not allowed to push a theme can look at an unpublished one.
 *
 * The signature travels as `?theme_preview=<version>.<signature>`; the
 * storefront verifies it, then keeps it in a short-lived cookie so the
 * preview survives navigation through the theme's own links.
 *
 * Web Crypto only (`globalThis.crypto.subtle`), so the same helper runs in
 * the CLI (Bun/Node) and in the storefront's server function.
 */

/** The query parameter and cookie a preview link uses. */
export const THEME_PREVIEW_PARAM = 'theme_preview'
export const THEME_PREVIEW_COOKIE = 'pesanle_theme_preview'

/** How long a preview link and its cookie stay valid. */
export const THEME_PREVIEW_MAX_AGE_SECONDS = 60 * 60

const VERSION_PATTERN = /^[0-9a-f]{16}$/
const encoder = new TextEncoder()

function message(tenant: string, version: string): string {
  return `pesanle-theme-preview:${tenant}:${version}`
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

/**
 * The `<version>.<signature>` value a preview link carries.
 *
 * The secret is the project's API key: only a caller who may push a theme can
 * mint a preview link, and the storefront verifies with the same key.
 */
export async function signThemePreview(
  secret: string,
  tenant: string,
  version: string,
): Promise<string> {
  const signature = await crypto.subtle.sign(
    'HMAC',
    await hmacKey(secret),
    encoder.encode(message(tenant, version)),
  )
  return `${version}.${base64UrlEncode(new Uint8Array(signature))}`
}

/**
 * The version a preview value names, when the signature is valid — `null`
 * otherwise. Never throws: a bad link is simply not a preview.
 */
export async function verifyThemePreview(
  secret: string,
  tenant: string,
  value: string | null | undefined,
): Promise<string | null> {
  if (!value) return null
  const at = value.indexOf('.')
  if (at <= 0) return null
  const version = value.slice(0, at)
  const signature = value.slice(at + 1)
  if (!VERSION_PATTERN.test(version) || signature.length !== 43) return null

  try {
    const valid = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(secret),
      base64UrlDecode(signature),
      encoder.encode(message(tenant, version)),
    )
    return valid ? version : null
  } catch {
    return null
  }
}

function base64UrlEncode(bytes: Uint8Array<ArrayBufferLike>): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '==='.slice((value.length + 3) % 4))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}
