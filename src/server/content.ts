/**
 * A shop's published content, read the storefront's way: the theme, custom
 * pages, menus, blogs and articles, store locations and size guides.
 *
 * One reader for both apps that serve it — the storefront's server functions
 * (`apps/web` `features/storefront/theme-api`) and the headless API
 * (`apps/api` `/v1/content/*`) — so what a headless client is given is
 * exactly what the shop's own site renders, through the same parsers and
 * sanitisers (`parseThemeContent`, `parsePageContent`, `parseSizeGuideTable`,
 * `resolveShopMenus`): only published rows, no draft, no `style`, `className`,
 * `on*` handler or free-form URL that a stored layout might carry.
 *
 * Server-only: it is handed a tenant-bound `CatalogReader`. The blog page
 * draws a page count, so its reader must count totals (`catalogReader`'s
 * default).
 */

import {
  COLLECTION_IDS,
  isSlug,
  storefrontBranches,
  type AddressDocument,
  type ArticleBlogDocument,
  type ArticleDocument,
  type BranchDocument,
  type MenuDocument,
  type PageDocument,
  type ProductCategoryDocument,
  type ProductCollectionDocument,
  type ProductDocument,
  type ShopThemeDocument,
  type SizeGuideDocument,
} from '@repo/appwrite-config'
import { publicProductFilter, Query, type CatalogReader } from '@repo/appwrite-config/server'

import {
  ARTICLES_PER_PAGE,
  MAX_BLOGS,
  normalizeArticleTags,
  relatedArticles,
} from '../model/articles'
import {
  parsePageContent,
  parseThemeContent,
  type SectionInstance,
  type ThemeContent,
} from '../model/content'
import type { LocalizedText } from '../model/localized'
import { EMPTY_STOREFRONT_MENUS, resolveShopMenus, type StorefrontMenus } from '../model/menus'
import { MAX_RELATED_ARTICLES } from '../model/sections'
import { parseSizeGuideTable } from '../model/size-guide'
import { starterPageTitle } from '../model/starter-pages'
import type { StorefrontBranchData, StorefrontSizeGuide } from '../model/storefront-data'

/* -------------------------------------------------------------------------- */
/* Shapes                                                                     */
/* -------------------------------------------------------------------------- */

export interface StorefrontPageLink {
  title: LocalizedText
  slug: string
}

export interface StorefrontPage {
  title: LocalizedText
  seoTitle: string | null
  seoDescription: string | null
  sections: SectionInstance[]
}

export interface StorefrontArticleRow {
  id: string
  blogId: string
  title: string
  slug: string
  summary: string | null
  coverFileId: string | null
  publishedAt: string | null
  authorName: string | null
  tags: string[]
}

export interface StorefrontBlogInfo {
  handle: string
  title: string
  description: string | null
}

export interface StorefrontBlogPage {
  blog: StorefrontBlogInfo
  articles: StorefrontArticleRow[]
  tag: string | null
  page: number
  pageCount: number
  /** Every tag on this page's articles, for the filter chips. */
  tags: string[]
}

export interface StorefrontArticleContent {
  blog: StorefrontBlogInfo
  article: StorefrontArticleRow & { readingMinutes: number }
  seoTitle: string | null
  seoDescription: string | null
  sections: SectionInstance[]
  previous: { title: string; slug: string } | null
  next: { title: string; slug: string } | null
  related: Array<StorefrontArticleRow & { blogHandle: string }>
}

export type { StorefrontBranchData, StorefrontMenus, StorefrontSizeGuide }
export { EMPTY_STOREFRONT_MENUS }

/** The shop fields the reader needs beyond its id. */
export interface ContentShop {
  /** The seller wrote their own menus; otherwise the starter menus are drawn. */
  navigationCustom?: boolean | null
  homeBranchId?: string | null
}

/* -------------------------------------------------------------------------- */

const MAX_FOOTER_PAGES = 12
const RELATED_POOL = 20

const ARTICLE_ROW_COLUMNS = [
  '$id',
  'tenantId',
  'blogId',
  'title',
  'slug',
  'summary',
  'coverFileId',
  'publishedAt',
  'authorName',
  'tags',
]

/**
 * A starter page keeps its translated title until the seller renames it; the
 * stored title is then theirs, exactly as typed.
 */
function storefrontPageTitle(page: Pick<PageDocument, 'slug' | 'title'>): LocalizedText {
  const starter = starterPageTitle(page.slug)
  return starter && starter.id === page.title ? starter : page.title
}

function toArticleRow(article: ArticleDocument): StorefrontArticleRow {
  return {
    id: article.$id,
    blogId: article.blogId,
    title: article.title,
    slug: article.slug,
    summary: article.summary ?? null,
    coverFileId: article.coverFileId ?? null,
    publishedAt: article.publishedAt ?? null,
    authorName: article.authorName ?? null,
    tags: article.tags ?? [],
  }
}

function toBlogInfo(blog: ArticleBlogDocument): StorefrontBlogInfo {
  return { handle: blog.handle, title: blog.title, description: blog.description ?? null }
}

function publishedIn(blog: ArticleBlogDocument) {
  return [Query.equal('blogId', blog.$id), Query.equal('status', 'published')]
}

export function storefrontContentReader(reader: CatalogReader, shop: ContentShop = {}) {
  async function findBlog(handle: string) {
    const found = await reader.list<ArticleBlogDocument>(COLLECTION_IDS.article_blogs, [
      Query.equal('handle', handle),
      Query.limit(1),
    ])
    return found.documents[0] ?? null
  }

  return {
    /** The published theme — settings, chrome layout and templates — or `null` before one. */
    async publishedTheme(): Promise<ThemeContent | null> {
      const page = await reader.list<ShopThemeDocument>(COLLECTION_IDS.shop_themes, [
        Query.equal('isPublished', true),
        Query.limit(1),
      ])
      const theme = page.documents[0]
      return theme?.publishedJson ? parseThemeContent(theme.publishedJson) : null
    },

    /** Published pages the footer links to, by title. */
    async footerPages(): Promise<StorefrontPageLink[]> {
      const found = await reader.list<PageDocument>(COLLECTION_IDS.pages, [
        Query.equal('status', 'published'),
        Query.select(['title', 'slug', 'showInFooter']),
        Query.orderAsc('title'),
        Query.limit(50),
      ])
      return found.documents
        .filter((page) => page.showInFooter !== false)
        .slice(0, MAX_FOOTER_PAGES)
        .map((page) => ({ title: storefrontPageTitle(page), slug: page.slug }))
    },

    /** Every published page, footer or not — for a sitemap or an app's menu. */
    async publishedPages(): Promise<Array<StorefrontPageLink & { showInFooter: boolean }>> {
      const found = await reader.list<PageDocument>(COLLECTION_IDS.pages, [
        Query.equal('status', 'published'),
        Query.select(['title', 'slug', 'showInFooter']),
        Query.orderAsc('title'),
        Query.limit(100),
      ])
      return found.documents.map((page) => ({
        title: storefrontPageTitle(page),
        slug: page.slug,
        showInFooter: page.showInFooter !== false,
      }))
    },

    /** One published custom page by slug, or `null`. */
    async page(rawSlug: string): Promise<StorefrontPage | null> {
      const slug = rawSlug.trim().toLowerCase()
      if (!isSlug(slug)) return null
      const found = await reader.list<PageDocument>(COLLECTION_IDS.pages, [
        Query.equal('slug', slug),
        Query.equal('status', 'published'),
        Query.limit(1),
      ])
      const page = found.documents[0]
      if (!page?.publishedJson) return null
      return {
        title: storefrontPageTitle(page),
        seoTitle: page.seoTitle ?? null,
        seoDescription: page.seoDescription ?? null,
        sections: parsePageContent(page.publishedJson).sections,
      }
    },

    /** The main and footer menus, and the categories and collections they may link to. */
    async menus(): Promise<StorefrontMenus> {
      const [found, categories, collections] = await Promise.all([
        reader.list<MenuDocument>(COLLECTION_IDS.menus, [Query.limit(10)]),
        reader.list<ProductCategoryDocument>(COLLECTION_IDS.product_categories, [
          Query.equal('isActive', true),
          Query.orderAsc('sortOrder'),
          Query.limit(50),
        ]),
        reader.list<ProductCollectionDocument>(COLLECTION_IDS.product_collections, [
          Query.equal('isActive', true),
          Query.orderAsc('sortOrder'),
          Query.limit(50),
        ]),
      ])
      const byHandle = new Map(found.documents.map((menu) => [menu.handle, menu.itemsJson]))
      const { main, footer } = resolveShopMenus(shop.navigationCustom === true, {
        main: byHandle.get('main'),
        footer: byHandle.get('footer'),
      })
      return {
        main,
        footer,
        categories: categories.documents.map((category) => ({
          id: category.$id,
          name: category.name,
          slug: category.slug,
        })),
        collections: collections.documents.map((collection) => ({
          id: collection.$id,
          name: collection.name,
          slug: collection.slug,
        })),
      }
    },

    /** The shop's physical stores: its branches with their addresses. */
    async branches(): Promise<StorefrontBranchData[]> {
      const [branches, addresses] = await Promise.all([
        reader.list<BranchDocument>(COLLECTION_IDS.branches, [
          Query.equal('status', 'active'),
          Query.orderAsc('sortOrder'),
          Query.limit(50),
        ]),
        reader.list<AddressDocument>(COLLECTION_IDS.addresses, [
          Query.equal('ownerType', 'tenant'),
          Query.limit(50),
        ]),
      ])
      const byId = new Map(addresses.documents.map((address) => [address.$id, address]))
      return storefrontBranches(branches.documents, shop.homeBranchId ?? null).map(
        (branch): StorefrontBranchData => {
          const address = branch.addressId ? byId.get(branch.addressId) : undefined
          return {
            id: branch.$id,
            name: branch.name,
            address: address?.formatted?.trim() ?? '',
            phone: branch.phone ?? null,
            latitude: address?.latitude ?? null,
            longitude: address?.longitude ?? null,
          }
        },
      )
    },

    /** The shop's blogs. */
    async blogs(): Promise<StorefrontBlogInfo[]> {
      const found = await reader.list<ArticleBlogDocument>(COLLECTION_IDS.article_blogs, [
        Query.orderAsc('title'),
        Query.limit(MAX_BLOGS),
      ])
      return found.documents.map(toBlogInfo)
    },

    /** One page of a blog's published articles, newest first, optionally of one tag. */
    async blog(
      rawHandle: string,
      options: { page?: number; tag?: string } = {},
    ): Promise<StorefrontBlogPage | null> {
      const handle = rawHandle.trim().toLowerCase()
      if (!isSlug(handle)) return null
      const page = Number.isInteger(options.page) && options.page! > 0 ? options.page! : 1
      const [tag] = normalizeArticleTags(options.tag ? [options.tag] : [])

      const blog = await findBlog(handle)
      if (!blog) return null

      const found = await reader.list<ArticleDocument>(COLLECTION_IDS.articles, [
        ...publishedIn(blog),
        ...(tag ? [Query.contains('tags', tag)] : []),
        Query.select(ARTICLE_ROW_COLUMNS),
        Query.orderDesc('publishedAt'),
        Query.limit(ARTICLES_PER_PAGE),
        Query.offset((page - 1) * ARTICLES_PER_PAGE),
      ])
      const pageCount = Math.max(1, Math.ceil(found.total / ARTICLES_PER_PAGE))
      if (page > pageCount) return null

      const articles = found.documents.map(toArticleRow)
      return {
        blog: toBlogInfo(blog),
        articles,
        tag: tag ?? null,
        page,
        pageCount,
        tags: [...new Set(articles.flatMap((article) => article.tags))].sort(),
      }
    },

    /** One published article, its neighbours in the blog, and related reading. */
    async article(
      rawBlogHandle: string,
      rawSlug: string,
    ): Promise<StorefrontArticleContent | null> {
      const blogHandle = rawBlogHandle.trim().toLowerCase()
      const slug = rawSlug.trim().toLowerCase()
      if (!isSlug(blogHandle) || !isSlug(slug)) return null

      const blog = await findBlog(blogHandle)
      if (!blog) return null

      const found = await reader.list<ArticleDocument>(COLLECTION_IDS.articles, [
        ...publishedIn(blog),
        Query.equal('slug', slug),
        Query.limit(1),
      ])
      const article = found.documents[0]
      if (!article?.publishedJson || !article.publishedAt) return null

      const neighbour = (older: boolean) =>
        reader.list<ArticleDocument>(COLLECTION_IDS.articles, [
          ...publishedIn(blog),
          older
            ? Query.lessThan('publishedAt', article.publishedAt!)
            : Query.greaterThan('publishedAt', article.publishedAt!),
          Query.select(['$id', 'tenantId', 'title', 'slug']),
          older ? Query.orderDesc('publishedAt') : Query.orderAsc('publishedAt'),
          Query.limit(1),
        ])
      // Related reading is picked from the newest of this blog and of the
      // whole shop, then ranked by shared tags (`relatedArticles`).
      const pool = (queries: string[]) =>
        reader.list<ArticleDocument>(COLLECTION_IDS.articles, [
          ...queries,
          Query.equal('status', 'published'),
          Query.notEqual('$id', article.$id),
          Query.select(ARTICLE_ROW_COLUMNS),
          Query.orderDesc('publishedAt'),
          Query.limit(RELATED_POOL),
        ])

      const [previous, next, fromBlog, fromShop, blogs] = await Promise.all([
        neighbour(true),
        neighbour(false),
        pool([Query.equal('blogId', blog.$id)]),
        pool([]),
        reader.list<ArticleBlogDocument>(COLLECTION_IDS.article_blogs, [
          Query.select(['$id', 'tenantId', 'handle']),
          Query.limit(MAX_BLOGS),
        ]),
      ])

      const handles = new Map(blogs.documents.map((other) => [other.$id, other.handle]))
      const candidates = new Map<string, StorefrontArticleRow & { blogHandle: string }>()
      for (const document of [...fromBlog.documents, ...fromShop.documents]) {
        const handle = handles.get(document.blogId)
        if (handle) candidates.set(document.$id, { ...toArticleRow(document), blogHandle: handle })
      }
      const pick = (page: { documents: ArticleDocument[] }) => {
        const row = page.documents[0]
        return row ? { title: row.title, slug: row.slug } : null
      }

      const row = toArticleRow(article)
      return {
        blog: toBlogInfo(blog),
        article: { ...row, readingMinutes: article.readingMinutes ?? 1 },
        seoTitle: article.seoTitle ?? null,
        seoDescription: article.seoDescription ?? null,
        sections: parsePageContent(article.publishedJson).sections,
        previous: pick(previous),
        next: pick(next),
        related: relatedArticles(row, [...candidates.values()], MAX_RELATED_ARTICLES),
      }
    },

    /**
     * The size guide for one product on sale: its own, or its category's when
     * it names none. `null` when neither names one or the product is not live.
     */
    async sizeGuide(
      productId: string,
      options: { allowDigital: boolean },
    ): Promise<StorefrontSizeGuide | null> {
      if (!productId) return null
      const found = await reader.list<ProductDocument>(COLLECTION_IDS.products, [
        Query.equal('$id', productId),
        ...publicProductFilter(new Date(), { allowDigital: options.allowDigital }),
        Query.limit(1),
      ])
      const product = found.documents[0]
      if (!product) return null

      let guideId = product.sizeGuideId ?? null
      if (!guideId && product.categoryId) {
        const categories = await reader.list<ProductCategoryDocument>(
          COLLECTION_IDS.product_categories,
          [Query.equal('$id', product.categoryId), Query.limit(1)],
        )
        guideId = categories.documents[0]?.sizeGuideId ?? null
      }
      if (!guideId) return null

      const guides = await reader.list<SizeGuideDocument>(COLLECTION_IDS.size_guides, [
        Query.equal('$id', guideId),
        Query.limit(1),
      ])
      const guide = guides.documents[0]
      if (!guide) return null
      return {
        name: guide.name,
        table: parseSizeGuideTable(guide.tableJson),
        note: guide.note ?? '',
      }
    },
  }
}

export type StorefrontContentReader = ReturnType<typeof storefrontContentReader>
