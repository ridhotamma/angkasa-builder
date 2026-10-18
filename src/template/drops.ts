/**
 * The drops: what a template is allowed to see.
 *
 * The template scope **is** `StorefrontRenderData`, mapped to Liquid-shaped
 * snake_case names once per render — a template never fetches, and it can
 * never reach a repository. Two halves live here, deliberately side by side
 * so they cannot drift:
 *
 * - `STOREFRONT_DROP_SCHEMA` — the typed description the compiler checks
 *   every `{{ … }}` against. An unknown property is a publish error.
 * - `buildTemplateScope` — the runtime values, built from the host's data.
 *
 * The mapping only ever exposes names, ids, prices and media; nothing the
 * shopper should not see and no way back to a raw record.
 * See docs/TEMPLATE_ENGINE.md.
 */

import type { FieldValues } from '../model/fields'
import { storefrontHref, type Link } from '../model/links'
import type { ThemeSettings } from '../model/settings'
import type {
  RenderEnvironment,
  StorefrontArticleCard,
  StorefrontArticleDetail,
  StorefrontBranchData,
  StorefrontCategoryData,
  StorefrontListingData,
  StorefrontProductCard,
  StorefrontProductDetail,
  StorefrontRenderData,
  StorefrontShelfData,
  StorefrontVoucherData,
} from '../render/context'

/**
 * Every route a compiled theme can draw.
 *
 * Deliberately not the page builder's own template keys: a theme draws pages
 * the structured model has no template for — a blog index, search results, a
 * seller's custom page — and the host names the route when it renders.
 */
export type TemplateRoute =
  'home' | 'product' | 'article' | 'catalog' | 'orderTracking' | 'page' | 'search' | 'blog' | 'cart'

/* -------------------------------------------------------------------------- */
/* The type schema                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The compiler's whole type system. Deliberately tiny: a template reads
 * properties and compares values, so a drop either has a known shape, is a
 * list, is an opaque value, or is nothing at all.
 */
export type DropType =
  | { kind: 'string' }
  | { kind: 'number' }
  | { kind: 'boolean' }
  | { kind: 'nil' }
  | { kind: 'any' }
  | { kind: 'list'; of: DropType }
  | DropRecordType

export interface DropRecordType {
  kind: 'record'
  fields: Readonly<Record<string, DropType>>
}

export const dropString: DropType = { kind: 'string' }
export const dropNumber: DropType = { kind: 'number' }
export const dropBoolean: DropType = { kind: 'boolean' }
export const dropAny: DropType = { kind: 'any' }
export const dropNil: DropType = { kind: 'nil' }

export function dropList(of: DropType): DropType {
  return { kind: 'list', of }
}

export function dropRecord(fields: Record<string, DropType>): DropRecordType {
  return { kind: 'record', fields }
}

/* -------------------------------------------------------------------------- */
/* The schema                                                                 */
/* -------------------------------------------------------------------------- */

/** A product as a listing or a card draws it. */
const PRODUCT_CARD_SCHEMA = dropRecord({
  id: dropString,
  name: dropString,
  /** `title` is the same value under the name most themes write. */
  title: dropString,
  slug: dropString,
  price: dropNumber,
  compare_at_price: dropAny,
  on_sale: dropBoolean,
  image_url: dropAny,
  image_urls: dropList(dropString),
  description: dropString,
  url: dropString,
})

const PRODUCT_DETAIL_SCHEMA = dropRecord({
  ...PRODUCT_CARD_SCHEMA.fields,
  images: dropList(dropRecord({ url: dropAny, thumb_url: dropAny })),
  rating: dropAny,
  rating_count: dropNumber,
  available: dropAny,
  category: dropRecord({ name: dropString, slug: dropString }),
  size_guide: dropAny,
  related: dropList(PRODUCT_CARD_SCHEMA),
})

const COLLECTION_SCHEMA = dropRecord({
  id: dropString,
  name: dropString,
  title: dropString,
  slug: dropString,
  description: dropAny,
  products: dropList(PRODUCT_CARD_SCHEMA),
  url: dropString,
})

const CATEGORY_SCHEMA = dropRecord({
  id: dropString,
  name: dropString,
  title: dropString,
  slug: dropString,
  image_url: dropAny,
  products: dropList(PRODUCT_CARD_SCHEMA),
  url: dropString,
})

const ARTICLE_CARD_SCHEMA = dropRecord({
  id: dropString,
  title: dropString,
  slug: dropString,
  blog_handle: dropString,
  summary: dropAny,
  cover_url: dropAny,
  published_at: dropAny,
  author_name: dropAny,
  tags: dropList(dropString),
  url: dropString,
})

const ARTICLE_DETAIL_SCHEMA = dropRecord({
  ...ARTICLE_CARD_SCHEMA.fields,
  reading_minutes: dropNumber,
  blog: dropRecord({ handle: dropString, title: dropString }),
  previous: dropAny,
  next: dropAny,
  related: dropList(ARTICLE_CARD_SCHEMA),
})

const VOUCHER_SCHEMA = dropRecord({
  id: dropString,
  code: dropString,
  name: dropString,
  description: dropAny,
  discount_type: dropString,
  discount_value: dropNumber,
  max_discount: dropAny,
  min_order_amount: dropAny,
  expires_at: dropAny,
})

/**
 * A blog, as the article page and the index draw it. The index's own fields
 * (`page`, `pages`, `tag`, `tags`) are empty on an article page.
 */
const BLOG_SCHEMA = dropRecord({
  handle: dropString,
  title: dropString,
  description: dropAny,
  url: dropString,
  page: dropNumber,
  pages: dropNumber,
  tag: dropAny,
  tags: dropList(dropString),
})

const BRANCH_SCHEMA = dropRecord({
  id: dropString,
  name: dropString,
  address: dropString,
  phone: dropAny,
  latitude: dropAny,
  longitude: dropAny,
  is_headquarters: dropBoolean,
})

const LISTING_SCHEMA = dropRecord({
  title: dropString,
  description: dropString,
  total: dropNumber,
  page: dropNumber,
  pages: dropNumber,
  products: dropList(PRODUCT_CARD_SCHEMA),
  categories: dropList(
    dropRecord({ id: dropString, name: dropString, slug: dropString, url: dropString }),
  ),
  collections: dropList(
    dropRecord({ id: dropString, name: dropString, slug: dropString, url: dropString }),
  ),
  current: dropAny,
})

const ROUTES_SCHEMA = dropRecord({
  home: dropString,
  products: dropString,
  search: dropString,
  cart: dropString,
  account: dropString,
  order_tracking: dropString,
})

/** The query a search page was opened with. */
const SEARCH_SCHEMA = dropRecord({ query: dropString })

/**
 * Every root name a template may read, with its shape. `section` is the one
 * field the compiler narrows further: a compiled section's own `{% schema %}`
 * replaces its `settings` with a typed record (see `./schema`).
 */
export const STOREFRONT_DROP_SCHEMA: DropType = dropRecord({
  shop: dropRecord({
    name: dropString,
    description: dropAny,
    logo_url: dropAny,
    banner_url: dropAny,
    currency: dropString,
    email: dropAny,
    phone: dropAny,
    address: dropAny,
    url: dropString,
  }),
  page: dropRecord({ kind: dropString, title: dropString }),
  search: SEARCH_SCHEMA,
  section: dropRecord({ id: dropString, settings: dropAny, style: dropAny }),
  settings: dropAny,
  product: PRODUCT_DETAIL_SCHEMA,
  collection: COLLECTION_SCHEMA,
  category: CATEGORY_SCHEMA,
  blog: BLOG_SCHEMA,
  article: ARTICLE_DETAIL_SCHEMA,
  articles: dropList(ARTICLE_CARD_SCHEMA),
  listing: LISTING_SCHEMA,
  collections: dropList(COLLECTION_SCHEMA),
  categories: dropList(CATEGORY_SCHEMA),
  latest: dropList(PRODUCT_CARD_SCHEMA),
  products: dropList(PRODUCT_CARD_SCHEMA),
  vouchers: dropList(VOUCHER_SCHEMA),
  branches: dropList(BRANCH_SCHEMA),
  cart: dropAny,
  customer: dropAny,
  routes: ROUTES_SCHEMA,
})

/** The names of every root drop, for "did you mean …?" suggestions. */
export function dropNames(schema: DropType = STOREFRONT_DROP_SCHEMA): string[] {
  return schema.kind === 'record' ? Object.keys(schema.fields) : []
}

/* -------------------------------------------------------------------------- */
/* The runtime scope                                                          */
/* -------------------------------------------------------------------------- */

export type TemplateScope = Record<string, unknown>

/**
 * The cart a theme draws, passed by the host as `extras.cart`.
 *
 * The cart lives in the host's own state — a guest's localStorage, a
 * shopper's account row — never in the scope's `data`, which is why it
 * travels as an extra. Only the *presentation* is here: the interactive
 * leaves (a line's quantity controls, and the whole checkout stack below the
 * lines) arrive as host slots, because they need the host's cart API and a
 * browser a theme may not ship.
 */
export interface TemplateCartDrop {
  /** False until the host has read the cart — a theme may hold a skeleton open. */
  ready: boolean
  empty: boolean
  item_count: number
  subtotal: number
  currency: string
  items: TemplateCartLine[]
  /** Lines that can no longer be bought, shown so they can be removed. */
  unavailable: TemplateCartUnavailableLine[]
}

/** One cart line, as `templates/cart.tpl` reads it. */
export interface TemplateCartLine {
  product_id: string
  variant_id: string | null
  name: string
  variant_name: string | null
  slug: string | null
  /** The product page, when the line has a slug. */
  url: string | null
  image_url: string | null
  /** The live price checkout will charge, in minor units. */
  price: number
  /** `price × quantity`, in minor units. */
  line_total: number
  quantity: number
  max_stock: number
  /** The price when it was added, when that differs from `price`. */
  previous_price: number | null
  /** Set when stock no longer covers what was asked for. */
  requested_quantity: number
}

/** A line that cannot be bought right now, as the cart template reads it. */
export interface TemplateCartUnavailableLine {
  product_id: string
  variant_id: string | null
  name: string
  variant_name: string | null
  slug: string | null
  image_url: string | null
  /** A stable code for why (`sold_out`, `removed`, …); the host phrases it. */
  issue: string
}

export interface TemplateScopeInput {
  data: StorefrontRenderData
  env: RenderEnvironment
  /** Which template is being drawn; defaults to `home`. */
  route?: TemplateRoute
  /** The section being drawn, when the unit is a compiled section. */
  section?: { id: string; settings: FieldValues; style?: FieldValues }
  /** Host slots: the cart and customer a storefront passes in when it has them. */
  extras?: { cart?: unknown; customer?: unknown }
}

/** The storefront paths a theme may build, mirroring `storefrontHref`. */
export const ROUTE_DROPS: Record<string, string> = {
  home: '/',
  products: '/products',
  search: '/search',
  cart: '/cart',
  account: '/account',
  order_tracking: '/track-order',
}

/**
 * Builds the runtime scope for one render.
 *
 * Pure and cheap: it maps the host's data to plain objects and derives the
 * two or three values a template would otherwise recompute (a card's `url`,
 * its `on_sale` flag). Nothing is fetched, nothing is written.
 */
export function buildTemplateScope(input: TemplateScopeInput): TemplateScope {
  const { data, env, section, extras } = input
  const route = input.route ?? 'home'
  const href = env.href ?? storefrontHref
  const link = (value: Link): string => href(value) ?? ''

  const blog = data.blog ?? data.article?.blog ?? null
  const collection =
    data.listing?.current?.kind === 'collection'
      ? data.collections.find((shelf) => shelf.slug === data.listing!.current!.slug)
      : undefined
  const category =
    data.listing?.current?.kind === 'category'
      ? data.categories.find((entry) => entry.slug === data.listing!.current!.slug)
      : undefined

  return {
    shop: {
      name: data.shop.name,
      description: data.shop.description,
      logo_url: data.shop.logoUrl,
      banner_url: data.shop.bannerUrl,
      currency: data.shop.currency,
      email: data.shop.email ?? null,
      phone: data.shop.phone ?? null,
      address: data.shop.address ?? null,
      url: ROUTE_DROPS.home,
    },
    page: { kind: route, title: pageTitle(data, route) },
    search: { query: data.search?.query ?? '' },
    section: section
      ? { id: section.id, settings: section.settings, style: section.style ?? {} }
      : null,
    settings: env.settings satisfies ThemeSettings,
    product: data.product ? productDrop(data.product, link) : null,
    collection: collection ? collectionDrop(collection, link) : null,
    category: category ? categoryDrop(category, link) : null,
    blog: blog ? { ...blog, url: link({ kind: 'blog', blogHandle: blog.handle }) } : null,
    article: data.article ? articleDrop(data.article, link) : null,
    articles: (data.articles ?? []).map((article) => articleCardDrop(article, link)),
    listing: data.listing ? listingDrop(data.listing, link) : null,
    collections: data.collections.map((shelf) => collectionDrop(shelf, link)),
    categories: data.categories.map((entry) => categoryDrop(entry, link)),
    latest: data.latest.map((card) => productCardDrop(card, link)),
    products: (data.products ?? []).map((card) => productCardDrop(card, link)),
    vouchers: (data.vouchers ?? []).map(voucherDrop),
    branches: (data.branches ?? []).map(branchDrop),
    cart: extras?.cart ?? null,
    customer: extras?.customer ?? null,
    routes: ROUTE_DROPS,
  }
}

function pageTitle(data: StorefrontRenderData, route: TemplateRoute): string {
  switch (route) {
    case 'product':
      return data.product?.name ?? data.shop.name
    case 'article':
      return data.article?.title ?? data.shop.name
    case 'catalog':
      return data.listing?.title ?? 'Products'
    case 'search':
      return data.listing?.title ?? 'Search'
    case 'blog':
      return data.blog?.title ?? data.shop.name
    case 'page':
      return data.page?.title ?? data.shop.name
    case 'orderTracking':
      return 'Order tracking'
    case 'cart':
      return 'Cart'
    case 'home':
      return data.shop.name
  }
}

function productCardDrop(card: StorefrontProductCard, link: (link: Link) => string) {
  return {
    id: card.id,
    name: card.name,
    title: card.name,
    slug: card.slug,
    price: card.price,
    compare_at_price: card.compareAtPrice,
    on_sale: card.compareAtPrice !== null && card.compareAtPrice > card.price,
    image_url: card.imageUrl,
    image_urls: card.imageUrls ?? (card.imageUrl ? [card.imageUrl] : []),
    description: card.description ?? '',
    url: link({ kind: 'product', slug: card.slug }),
  }
}

function productDrop(product: StorefrontProductDetail, link: (link: Link) => string) {
  const primary = product.images.find((image) => image.url)?.url ?? null
  return {
    ...productCardDrop(
      {
        id: product.id,
        name: product.name,
        slug: product.slug,
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        imageUrl: primary,
        imageUrls: product.images
          .map((image) => image.url)
          .filter((url): url is string => typeof url === 'string'),
        description: product.description,
      },
      link,
    ),
    images: product.images.map((image) => ({ url: image.url, thumb_url: image.thumbUrl })),
    description: product.description,
    rating: product.rating,
    rating_count: product.ratingCount,
    available: product.available,
    category: product.category,
    size_guide: product.sizeGuide,
    related: product.related.map((card) => productCardDrop(card, link)),
  }
}

function collectionDrop(shelf: StorefrontShelfData, link: (link: Link) => string) {
  return {
    id: shelf.id,
    name: shelf.name,
    title: shelf.name,
    slug: shelf.slug,
    description: shelf.description,
    products: shelf.products.map((card) => productCardDrop(card, link)),
    url: link({ kind: 'collection', slug: shelf.slug }),
  }
}

function categoryDrop(category: StorefrontCategoryData, link: (link: Link) => string) {
  return {
    id: category.id,
    name: category.name,
    title: category.name,
    slug: category.slug,
    image_url: category.imageUrl,
    products: (category.products ?? []).map((card) => productCardDrop(card, link)),
    url: link({ kind: 'category', slug: category.slug }),
  }
}

function articleCardDrop(article: StorefrontArticleCard, link: (link: Link) => string) {
  return {
    id: article.id,
    title: article.title,
    slug: article.slug,
    blog_handle: article.blogHandle,
    summary: article.summary,
    cover_url: article.coverUrl,
    published_at: article.publishedAt,
    author_name: article.authorName,
    tags: article.tags,
    url: link({ kind: 'article', blogHandle: article.blogHandle, slug: article.slug }),
  }
}

function articleDrop(article: StorefrontArticleDetail, link: (link: Link) => string) {
  return {
    ...articleCardDrop(article, link),
    reading_minutes: article.readingMinutes,
    blog: article.blog,
    previous: article.previous,
    next: article.next,
    related: article.related.map((card) => articleCardDrop(card, link)),
  }
}

function listingDrop(listing: StorefrontListingData, link: (link: Link) => string) {
  return {
    title: listing.title,
    description: listing.description,
    total: listing.total,
    page: listing.page,
    pages: listing.pages,
    products: listing.products.map((card) => productCardDrop(card, link)),
    categories: listing.categories.map((category) => ({
      ...category,
      url: link({ kind: 'category', slug: category.slug }),
    })),
    collections: (listing.collections ?? []).map((collection) => ({
      ...collection,
      url: link({ kind: 'collection', slug: collection.slug }),
    })),
    current: listing.current,
  }
}

function voucherDrop(voucher: StorefrontVoucherData) {
  return {
    id: voucher.id,
    code: voucher.code,
    name: voucher.name,
    description: voucher.description ?? null,
    discount_type: voucher.discountType,
    discount_value: voucher.discountValue,
    max_discount: voucher.maxDiscount ?? null,
    min_order_amount: voucher.minOrderAmount ?? null,
    expires_at: voucher.expiresAt ?? null,
  }
}

function branchDrop(branch: StorefrontBranchData) {
  return {
    id: branch.id,
    name: branch.name,
    address: branch.address,
    phone: branch.phone,
    latitude: branch.latitude,
    longitude: branch.longitude,
    is_headquarters: branch.isHeadquarters ?? false,
  }
}
