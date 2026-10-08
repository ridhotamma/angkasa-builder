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
 *
 * One kind stays on the page: `section` points at another section of the same
 * layout by its id, which is what a hero's "Explore now" scrolls to.
 */

import { z } from 'zod'

export const LINK_KINDS = [
  'none',
  'home',
  'page',
  'product',
  'collection',
  'category',
  'catalog',
  'blog',
  'article',
  'search',
  'section',
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
  /**
   * The whole catalogue, `/products` — opened on one category's chip when
   * `category` is set. Unlike `category`, the shopper can switch to the others.
   */
  | { kind: 'catalog'; category?: string }
  /** A blog's index, `/blogs/<blogHandle>` — narrowed to one tag when `tag` is set. */
  | { kind: 'blog'; blogHandle: string; tag?: string }
  /** One article, `/blogs/<blogHandle>/<slug>` — slugs are unique per blog, not per shop. */
  | { kind: 'article'; blogHandle: string; slug: string }
  | { kind: 'search'; query: string }
  /**
   * Another section on the same page — what a hero's "Explore now" points at.
   * The section's id is stored and the anchor derived, so moving or renaming
   * the target never rewrites the link.
   */
  | { kind: 'section'; sectionId: string }
  | { kind: 'url'; href: string }

export const NO_LINK: Link = { kind: 'none' }

/**
 * The DOM id a section renders with, and the fragment a section link uses.
 *
 * Prefixed so it can never collide with an id the host's own chrome carries,
 * and derived from the section id so nothing about the target is stored on the
 * link itself.
 */
export function sectionAnchorId(sectionId: string): string {
  return `section-${sectionId}`
}

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
  z.object({
    kind: z.literal('catalog'),
    // An empty or malformed category is the unfiltered catalogue, not a broken link.
    category: slug.optional().catch(undefined),
  }),
  z.object({
    kind: z.literal('blog'),
    blogHandle: slug,
    // An empty tag is no tag, not a broken link.
    tag: z
      .string()
      .trim()
      .toLowerCase()
      .max(30)
      .optional()
      .transform((tag) => tag || undefined),
  }),
  z.object({ kind: z.literal('article'), blogHandle: slug, slug }),
  z.object({ kind: z.literal('search'), query: z.string().trim().min(1).max(120) }),
  // The same shape a section id is sanitised to in `model/content`.
  z.object({
    kind: z.literal('section'),
    sectionId: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]{1,64}$/),
  }),
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
    case 'catalog':
      return link.category ? `/products?category=${encodeURIComponent(link.category)}` : '/products'
    case 'blog':
      return link.tag
        ? `/blogs/${link.blogHandle}?tag=${encodeURIComponent(link.tag)}`
        : `/blogs/${link.blogHandle}`
    case 'article':
      return `/blogs/${link.blogHandle}/${link.slug}`
    case 'search':
      return `/search?q=${encodeURIComponent(link.query)}`
    case 'section':
      return `#${sectionAnchorId(link.sectionId)}`
    case 'url':
      return link.href
  }
}
