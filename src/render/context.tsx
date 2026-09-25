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

export interface StorefrontRenderData {
  shop: {
    name: string
    description: string | null
    logoUrl: string | null
    bannerUrl: string | null
    currency: string
  }
  categories: StorefrontCategoryData[]
  /** Active collections in sort order, each with its first products. */
  collections: StorefrontShelfData[]
  latest: StorefrontProductCard[]
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
  }
}
