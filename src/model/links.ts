/**
 * Where a button, image or menu entry in a layout points.
 *
 * A tagged union rather than a free-form `href`, for two reasons. A link to
 * one of the shop's own things is stored as *what* it points at, so the
 * storefront builds the URL — the route shape can change without rewriting
 * every stored layout. And the only free-form case, `url`, is the one place a
 * seller can type an address, so it is the one place that is checked: http(s)
 * only, which is what keeps `javascript:` out of every `<a>` the builder
 * renders.
 *
 * Catalogue targets are addressed by slug, the same key the storefront routes
 * use. A renamed product breaks a link to it; that is the same trade the
 * storefront's own URLs already make.
 */

import { z } from 'zod'

export const LINK_KINDS = [
  'none',
  'home',
  'page',
  'product',
  'collection',
  'category',
  'search',
  'url',
] as const

export type LinkKind = (typeof LINK_KINDS)[number]

export type Link =
  | { kind: 'none' }
  | { kind: 'home' }
  | { kind: 'page'; slug: string }
  | { kind: 'product'; slug: string }
  | { kind: 'collection'; slug: string }
  | { kind: 'category'; slug: string }
  | { kind: 'search'; query: string }
  | { kind: 'url'; href: string }

export const NO_LINK: Link = { kind: 'none' }

const slug = z
  .string()
  .trim()
  .max(128)
  .regex(/^[a-z0-9][a-z0-9-]*$/)

/** An absolute http(s) URL, and nothing else. */
export function isSafeHref(href: string): boolean {
  try {
    const url = new URL(href)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

const linkSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }),
  z.object({ kind: z.literal('home') }),
  z.object({ kind: z.literal('page'), slug }),
  z.object({ kind: z.literal('product'), slug }),
  z.object({ kind: z.literal('collection'), slug }),
  z.object({ kind: z.literal('category'), slug }),
  z.object({ kind: z.literal('search'), query: z.string().trim().min(1).max(120) }),
  z.object({
    kind: z.literal('url'),
    href: z.string().trim().max(2000).refine(isSafeHref),
  }),
])

/** Any stored value, as a link — anything unrecognised or unsafe is no link. */
export function sanitizeLink(value: unknown): Link {
  const parsed = linkSchema.safeParse(value)
  return parsed.success ? (parsed.data as Link) : NO_LINK
}

/**
 * The storefront path a link resolves to, or `null` for no link.
 *
 * The storefront's own route shapes, kept here so the renderer and the
 * storefront cannot disagree about them.
 */
export function storefrontHref(link: Link): string | null {
  switch (link.kind) {
    case 'none':
      return null
    case 'home':
      return '/'
    case 'page':
      return `/pages/${link.slug}`
    case 'product':
      return `/p/${link.slug}`
    case 'collection':
      return `/k/${link.slug}`
    case 'category':
      return `/c/${link.slug}`
    case 'search':
      return `/search?q=${encodeURIComponent(link.query)}`
    case 'url':
      return link.href
  }
}
