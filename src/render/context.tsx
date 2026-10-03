/**
 * What a renderer is allowed to know, supplied by whoever is rendering.
 *
 * The sections never fetch. The storefront's loader, the admin preview and
 * the developer preview each assemble a `StorefrontRenderData` their own way —
 * the storefront from the live catalogue, the admin from the same shop's
 * catalogue, the developer from sample data — and hand it down here. That is
 * what lets one set of components serve all three without any of them
 * knowing which app they are in.
 */

import { createContext, useContext, type ReactNode } from 'react'

import type { ElementKind } from '../model/element-style'
import type { TableValue } from '../model/fields'
import { storefrontHref, type Link } from '../model/links'
import type { ThemeSettings } from '../model/settings'

export interface StorefrontProductCard {
  id: string
  name: string
  slug: string
  /** Minor units, as stored. */
  price: number
  compareAtPrice: number | null
  imageUrl: string | null
  /** More photos, when the section shows a gallery (a featured product). */
  imageUrls?: string[]
  /** Plain text. Only read by sections that show it. */
  description?: string
}

/** One photo in the product page's gallery. */
export interface StorefrontGalleryImage {
  /** Large enough for the main photo. */
  url: string | null
  /** A small square for the thumbnails. */
  thumbUrl: string | null
}

export interface StorefrontSizeGuide {
  name: string
  table: TableValue
  note: string
}

/**
 * The product a product page is about, as the product template draws it. The
 * gallery is whatever the page is showing *now* — a chosen variant's own
 * photos replace the product's — so the host passes it in on every render.
 */
export interface StorefrontProductDetail {
  id: string
  name: string
  slug: string
  /** Minor units: the chosen variant's price once one is picked. */
  price: number
  compareAtPrice: number | null
  images: StorefrontGalleryImage[]
  description: string
  rating: number | null
  ratingCount: number
  /** Units left to sell, or `null` when the shop does not track stock. */
  available: number | null
  category: { name: string; slug: string } | null
  sizeGuide: StorefrontSizeGuide | null
  related: StorefrontProductCard[]
}

/** An article as a listing or a "related" card draws it: metadata only, never its body. */
export interface StorefrontArticleCard {
  id: string
  title: string
  slug: string
  blogHandle: string
  /** The seller's excerpt, or the opening of the body — stored at publish. */
  summary: string | null
  coverUrl: string | null
  /** ISO instant; `null` only for a draft in the editor. */
  publishedAt: string | null
  authorName: string | null
  tags: string[]
}

/**
 * The article an article page is about, as the article template draws it
 * around the body. The body itself is not here: it is sections, drawn by the
 * host into `env.slots.articleBody`.
 */
export interface StorefrontArticleDetail extends StorefrontArticleCard {
  readingMinutes: number
  blog: { handle: string; title: string }
  /** The next older and next newer article in the same blog. */
  previous: { title: string; slug: string } | null
  next: { title: string; slug: string } | null
  related: StorefrontArticleCard[]
}

export interface StorefrontShelfData {
  id: string
  name: string
  slug: string
  description: string | null
  products: StorefrontProductCard[]
}

export interface StorefrontCategoryData {
  id: string
  name: string
  slug: string
  imageUrl: string | null
}

export interface StorefrontVoucherData {
  id: string
  code: string
  name: string
  description?: string | null
  discountType: 'percentage' | 'fixed_amount'
  discountValue: number
  maxDiscount?: number | null
  minOrderAmount?: number | null
  expiresAt?: string | null
}

export interface StorefrontRenderData {
  shop: {
    name: string
    description: string | null
    logoUrl: string | null
    bannerUrl: string | null
    currency: string
    /** From shop settings, for the contact section's email button. */
    email?: string | null
    /**
     * From shop settings, for widgets that hand an order to WhatsApp (the
     * order form). Guests never see it; the number travels in the link.
     */
    phone?: string | null
  }
  categories: StorefrontCategoryData[]
  /** Active collections in sort order, each with its first products. */
  collections: StorefrontShelfData[]
  latest: StorefrontProductCard[]
  /** Products the layout picks by id (featured product, hotspots, video tags). */
  products?: StorefrontProductCard[]
  /** Only on the product page. */
  product?: StorefrontProductDetail
  /** Only on an article page — or, in the editor, the article being written. */
  article?: StorefrontArticleDetail
  vouchers?: StorefrontVoucherData[]
}

export interface RenderEnvironment {
  data: StorefrontRenderData
  settings: ThemeSettings
  /**
   * `live` on the storefront; `preview` in an editor, where empty sections
   * explain themselves instead of silently rendering nothing, and links do
   * not navigate.
   */
  mode: 'live' | 'preview'
  /** A media file id as a URL at roughly this size, or `null` for none. */
  imageUrl: (fileId: string, size: { width: number; height: number }) => string | null
  formatPrice: (amount: number, currency: string) => string
  /** A link as a URL. Defaults to the storefront's own route shapes. */
  href?: (link: Link) => string | null
  /**
   * Follows an internal link without a document load, through the host's
   * router. Without it, links are plain anchors and every click reloads the
   * page — header, fonts and all.
   */
  navigate?: (href: string) => void
  /** An uploaded video's file id as a URL the `<video>` element can stream. */
  videoUrl?: (fileId: string) => string | null
  /**
   * The moment scheduled sections and countdowns are judged against. The
   * storefront passes the request's time, so the server and the browser
   * agree on which sections exist; defaults to now.
   */
  now?: Date
  /**
   * Parts of the product page only the host can draw: the variant picker and
   * buy buttons need its cart, reviews its session. The editor leaves them
   * out and gets stand-ins.
   */
  slots?: {
    productPurchase?: ReactNode
    productReviews?: ReactNode
    /**
     * The article's own sections, drawn where the template's
     * `article-content` section sits. The theme editor has no article and
     * gets a stand-in body.
     */
    articleBody?: ReactNode
  }
  /**
   * The signed-in shopper's saved products, when the host has a wishlist.
   *
   * A product card draws a heart for the ids it finds here and calls
   * `onToggle` to save or unsave. The host owns both the write and the
   * optimistic state; the editor preview passes an empty set so the icon is
   * visible on the canvas, and snapshots and theme previews leave it out
   * entirely, since there is no shopper behind them.
   */
  wishlist?: {
    /** Product ids this shopper has saved, so a heart starts filled. */
    ids: ReadonlySet<string>
    /** Save or unsave one product. */
    onToggle: (product: StorefrontProductCard) => void
  }
  /**
   * The window media queries run against. The editor renders its preview in
   * an iframe the width of the chosen device, and a breakpoint read from the
   * editor's own window would lay the phone preview out as a desktop.
   */
  getWindow?: () => Window
  /** Editor only: text typed and elements clicked straight in the preview. */
  editing?: {
    onEditText: (sectionId: string, key: string, value: string) => void
    /** Text typed into a block's field, however deep the block sits. */
    onEditBlockText?: (sectionId: string, blockId: string, key: string, value: string) => void
    /** A block clicked in the preview; the editor selects it. */
    onSelectBlock?: (sectionId: string, blockId: string) => void
    /** The block the editor has selected, so the canvas can outline it. */
    selectedBlockId?: string | null
    /**
     * An element clicked in the preview; the editor selects it and opens the
     * matching panel. The kind is `button` when omitted, so existing hosts
     * keep working.
     */
    onSelectElement?: (sectionId: string, elementId: string, kind?: ElementKind) => void
    /** The element the editor has selected, so the canvas can outline it. */
    selectedElementId?: string | null
  }
}

const RenderContext = createContext<RenderEnvironment | null>(null)

export function RenderProvider({
  value,
  children,
}: {
  value: RenderEnvironment
  children: ReactNode
}) {
  return <RenderContext.Provider value={value}>{children}</RenderContext.Provider>
}

export function useRenderEnvironment(): RenderEnvironment & {
  href: (link: Link) => string | null
} {
  const env = useContext(RenderContext)
  if (!env) throw new Error('Page builder sections must be rendered inside <RenderProvider>.')
  return { ...env, href: env.href ?? storefrontHref }
}

/** Placeholder catalogue for previews with no shop behind them. */
export function sampleStorefrontData(shopName = 'Your shop'): StorefrontRenderData {
  const product = (n: number): StorefrontProductCard => ({
    id: `sample-${n}`,
    name: [
      'Signature tote',
      'Everyday tee',
      'Canvas cap',
      'Linen shirt',
      'Weekend bag',
      'Knit scarf',
    ][n % 6]!,
    slug: `sample-${n}`,
    price: [125_000, 89_000, 75_000, 199_000, 349_000, 110_000][n % 6]!,
    compareAtPrice: n % 4 === 1 ? 129_000 : null,
    imageUrl: null,
  })
  const products = (from: number, count: number) =>
    Array.from({ length: count }, (_, i) => product(from + i))

  return {
    shop: {
      name: shopName,
      description: 'A short description of the shop, from shop settings.',
      logoUrl: null,
      bannerUrl: null,
      currency: 'IDR',
      phone: '+62 812-3456-7890',
    },
    categories: ['Apparel', 'Bags', 'Accessories', 'Home', 'Gifts', 'Sale'].map((name, i) => ({
      id: `sample-category-${i}`,
      name,
      slug: name.toLowerCase(),
      imageUrl: null,
    })),
    collections: [
      {
        id: 'sample-collection-1',
        name: 'Best sellers',
        slug: 'best-sellers',
        description: null,
        products: products(0, 12),
      },
      {
        id: 'sample-collection-2',
        name: 'New season',
        slug: 'new-season',
        description: null,
        products: products(3, 12),
      },
    ],
    latest: products(6, 24),
    vouchers: [
      {
        id: 'sample-voucher-1',
        name: 'Welcome 10%',
        code: 'WELCOME10',
        description: '10% off your first order',
        discountType: 'percentage',
        discountValue: 10,
        minOrderAmount: 100000,
      },
      {
        id: 'sample-voucher-2',
        name: 'Flash Sale Rp 50.000',
        code: 'FLASHSALE',
        description: 'Rp 50.000 off orders over Rp 250.000',
        discountType: 'fixed_amount',
        discountValue: 50000,
        minOrderAmount: 250000,
      },
      {
        id: 'sample-voucher-3',
        name: 'Weekend Special 20%',
        code: 'WEEKEND20',
        description: '20% off all collections',
        discountType: 'percentage',
        discountValue: 20,
        maxDiscount: 100000,
        minOrderAmount: 150000,
      },
    ],
  }
}

/**
 * The product a product-page preview shows: the shop's newest product when
 * it has one — with the details the editor knows — otherwise a sample. The
 * editor has no variant picker or reviews of its own, so the host's slots
 * are replaced by stand-ins in `render/product-page`.
 */
export function previewProductDetail(data: StorefrontRenderData): StorefrontProductDetail {
  if (data.product) return data.product
  const card = data.latest[0]
  const related = data.latest.slice(1, 9)
  return {
    id: card?.id ?? 'sample-product',
    name: card?.name ?? 'Signature linen shirt',
    slug: card?.slug ?? 'sample-product',
    price: card?.price ?? 249_000,
    compareAtPrice: card?.compareAtPrice ?? 299_000,
    images: (card?.imageUrls?.length ? card.imageUrls : [card?.imageUrl ?? null, null, null]).map(
      (url) => ({ url, thumbUrl: url }),
    ),
    description:
      card?.description ||
      'A relaxed shirt in breathable linen, cut for everyday wear.\n\nMachine wash cold, line dry.',
    rating: 4.8,
    ratingCount: 126,
    available: 4,
    category: data.categories[0]
      ? { name: data.categories[0].name, slug: data.categories[0].slug }
      : { name: 'Apparel', slug: 'apparel' },
    sizeGuide: {
      name: 'Tops',
      table: {
        columns: ['Size', 'Chest (cm)', 'Length (cm)'],
        rows: [
          ['S', '96', '68'],
          ['M', '102', '70'],
          ['L', '108', '72'],
        ],
      },
      note: 'Measured flat, across the chest from armpit to armpit.',
    },
    related,
  }
}

/**
 * The article an article-template preview shows: the one being written, or
 * the shop's newest one, when the editor has them — otherwise a sample, so
 * every section of the template has something to draw.
 */
export function previewArticleDetail(data: StorefrontRenderData): StorefrontArticleDetail {
  if (data.article) return data.article
  const sample = (n: number, title: string, tags: string[]): StorefrontArticleCard => ({
    id: `sample-article-${n}`,
    title,
    slug: `sample-article-${n}`,
    blogHandle: 'news',
    summary: 'A short summary of the article, as the blog’s listing shows it.',
    coverUrl: null,
    publishedAt: new Date(Date.UTC(2026, 0, 12 - n, 12)).toISOString(),
    authorName: data.shop.name,
    tags,
  })
  return {
    ...sample(0, 'Behind the scenes of our new collection', ['news', 'behind the scenes']),
    readingMinutes: 4,
    blog: { handle: 'news', title: 'News' },
    previous: { title: 'How we choose our fabrics', slug: 'sample-article-1' },
    next: null,
    related: [
      sample(1, 'How we choose our fabrics', ['behind the scenes']),
      sample(2, 'Five ways to wear a linen shirt', ['style']),
      sample(3, 'Caring for your favourite pieces', ['care']),
    ],
  }
}

/**
 * One product card by id, from anywhere the render data has it: the picked
 * products first, then the newest products and the shelves, so a product the
 * page already shows elsewhere needs no second read.
 */
export function findProductCard(
  data: StorefrontRenderData,
  id: string,
): StorefrontProductCard | null {
  if (!id) return null
  return (
    data.products?.find((product) => product.id === id) ??
    data.latest.find((product) => product.id === id) ??
    data.collections.flatMap((shelf) => shelf.products).find((product) => product.id === id) ??
    null
  )
}
