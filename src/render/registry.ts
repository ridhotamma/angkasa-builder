/**
 * Every section type's renderer, in one map.
 *
 * `satisfies Record<SectionType, …>` makes a schema without a renderer a
 * compile error, and the `SectionType` keys make a renderer without a schema
 * a type error too — the two halves of every section meet here. The
 * components live beside their siblings; this file is only the catalogue.
 */

import type { ComponentType } from 'react'

import type { SectionType } from '../model/sections'
import {
  ArticleContent,
  ArticleHeader,
  ArticlePagination,
  ArticleShare,
  RelatedArticles,
} from './article-page'
import { BlocksSection } from './blocks-section'
import { CatalogHeader, CatalogProducts } from './catalog-page'
import { Countdown, FeaturedProduct, PromoCodes } from './commerce-sections'
import { ContactCta, StoreLocations, TableSection } from './content-sections'
import { Banner, Cards, Gallery, ProductList, Quotes, Statement, Story } from './families'
import { FloatingContact, Spin360 } from './feature-sections'
import {
  BeforeAfter,
  LogoList,
  Lookbook,
  ScrollingText,
  VideoReels,
  VideoSection,
} from './media-sections'
import { PinnedScroll, ScrollRail, StackedCards } from './motion-sections'
import { OrderTracking } from './order-tracking'
import { ProductInfo, ProductReviews, RelatedProducts } from './product-page'
import { BannerSlider, CategoryRail, Faq, RichText, ShopIntro, type SectionProps } from './sections'

export const SECTION_RENDERERS = {
  banner: Banner,
  'banner-slider': BannerSlider,
  'product-list': ProductList,
  gallery: Gallery,
  quotes: Quotes,
  cards: Cards,
  statement: Statement,
  story: Story,
  'shop-intro': ShopIntro,
  'category-rail': CategoryRail,
  'rich-text': RichText,
  faq: Faq,
  blocks: BlocksSection,
  'featured-product': FeaturedProduct,
  video: VideoSection,
  'video-reels': VideoReels,
  lookbook: Lookbook,
  'before-after': BeforeAfter,
  'logo-list': LogoList,
  'scrolling-text': ScrollingText,
  'pinned-scroll': PinnedScroll,
  'scroll-rail': ScrollRail,
  'stacked-cards': StackedCards,
  table: TableSection,
  countdown: Countdown,
  'promo-codes': PromoCodes,
  'store-locations': StoreLocations,
  'contact-cta': ContactCta,
  'floating-contact': FloatingContact,
  'spin-360': Spin360,
  'order-tracking': OrderTracking,
  'product-info': ProductInfo,
  'product-reviews': ProductReviews,
  'related-products': RelatedProducts,
  'article-header': ArticleHeader,
  'article-content': ArticleContent,
  'article-share': ArticleShare,
  'article-pagination': ArticlePagination,
  'related-articles': RelatedArticles,
  'catalog-header': CatalogHeader,
  'catalog-products': CatalogProducts,
} satisfies Record<SectionType, ComponentType<SectionProps>>
