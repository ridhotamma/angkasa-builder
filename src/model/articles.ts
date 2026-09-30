/**
 * What an article is besides its layout: the words a listing shows, how long
 * it takes to read, and the tags it is filed under.
 *
 * An article's body is a `PageContent`, sanitised like a page's. The listing
 * never reads that body — the blog index and the sitemap would otherwise pull
 * every 200 KB layout to draw a card — so the summary and reading time are
 * worked out here when an article is published and stored beside it. See
 * docs/ARTICLES.md.
 *
 * Pure, like the rest of `model/`.
 */

import type { PageContent } from './content'
import { collectFieldValues } from './fields'
import { richDocText, sanitizeRichDoc } from './rich-text'
import { sectionSchema } from './sections'

/** A shop with more blogs than this wants tags, not blogs. */
export const MAX_BLOGS = 10

/** Articles on one page of a blog's index. */
export const ARTICLES_PER_PAGE = 12

export const MAX_ARTICLE_TAGS = 10
export const MAX_ARTICLE_TAG_LENGTH = 30

/** The listing blurb's length when it is taken from the body. */
const SUMMARY_FROM_BODY = 160
/** The stored summary's column. */
const MAX_SUMMARY = 320

const WORDS_PER_MINUTE = 200

/**
 * The reading text of a body: its formatted text and its longer plain text, in
 * order, from the sections a shopper sees. Short labels — headings, button
 * text — are left out: a summary that opens "Shop now" reads as broken.
 */
export function articleBodyText(content: PageContent): string {
  const parts: string[] = []
  for (const section of content.sections) {
    if (section.hidden) continue
    const schema = sectionSchema(section.type)
    if (!schema) continue
    for (const value of collectFieldValues(schema.fields, section.settings, [
      'richtext',
      'textarea',
    ])) {
      const text =
        typeof value === 'string'
          ? value
          : richDocText(sanitizeRichDoc(value, Number.MAX_SAFE_INTEGER))
      if (text.trim()) parts.push(text.trim())
    }
  }
  return parts.join('\n\n')
}

/** Whitespace collapsed, and cut at a word near `max` with an ellipsis. */
function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s.,;:!?-]+$/, '')}…`
}

/**
 * What a listing card says about an article: the seller's excerpt, or the
 * opening of the body. `null` when there is neither.
 */
export function articleSummary(
  excerpt: string | null | undefined,
  content: PageContent,
): string | null {
  const own = excerpt?.trim()
  if (own) return clip(own, MAX_SUMMARY)
  const body = articleBodyText(content)
  return body ? clip(body, SUMMARY_FROM_BODY) : null
}

/** Minutes to read the body, at an unhurried pace; never less than one. */
export function articleReadingMinutes(content: PageContent): number {
  const words = articleBodyText(content).split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE))
}

/** What ranking articles against each other reads: identity, filing and date. */
export interface RankableArticle {
  id: string
  tags: readonly string[]
  publishedAt: string | null
  /** Which blog it is in; related articles prefer the same one. */
  blogId?: string
}

const time = (article: RankableArticle) => Date.parse(article.publishedAt ?? '') || 0

/**
 * The article just older (`previous`) and just newer (`next`) than `current`
 * among `others` — one blog's published articles. Ties on the date fall back
 * to the id, so two articles of the same moment still have an order.
 */
export function articleNeighbours<T extends RankableArticle>(
  current: RankableArticle,
  others: readonly T[],
): { previous: T | null; next: T | null } {
  const order = (a: RankableArticle, b: RankableArticle) =>
    time(a) - time(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  const sorted = others.filter((other) => other.id !== current.id).sort(order)
  const previous = [...sorted].reverse().find((other) => order(other, current) < 0) ?? null
  const next = sorted.find((other) => order(other, current) > 0) ?? null
  return { previous, next }
}

/**
 * Up to `limit` articles to read next, from any of the shop's blogs: those
 * sharing the most tags with `current` first, then ones from its own blog,
 * then the newest. So a blog with one article still gets a row to read on,
 * and a tag shared across blogs ("kopi" in both News and Recipes) links them.
 */
export function relatedArticles<T extends RankableArticle>(
  current: RankableArticle,
  others: readonly T[],
  limit: number,
): T[] {
  const shared = (other: RankableArticle) =>
    other.tags.filter((tag) => current.tags.includes(tag)).length
  const sameBlog = (other: RankableArticle) =>
    current.blogId !== undefined && other.blogId === current.blogId ? 1 : 0
  return others
    .filter((other) => other.id !== current.id)
    .map((other) => ({ other, shared: shared(other), same: sameBlog(other) }))
    .sort((a, b) => b.shared - a.shared || b.same - a.same || time(b.other) - time(a.other))
    .slice(0, limit)
    .map(({ other }) => other)
}

/**
 * Tags as stored: trimmed, lowercased, each at most `MAX_ARTICLE_TAG_LENGTH`,
 * no repeats, at most `MAX_ARTICLE_TAGS`. Anything that is not a string is
 * dropped.
 */
export function normalizeArticleTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const raw of value) {
    if (typeof raw !== 'string') continue
    const tag = raw
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .slice(0, MAX_ARTICLE_TAG_LENGTH)
      .trim()
    if (tag && !out.includes(tag)) out.push(tag)
    if (out.length >= MAX_ARTICLE_TAGS) break
  }
  return out
}
