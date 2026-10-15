/**
 * Every section type's renderer. `satisfies Record<SectionType, …>` is what
 * makes a schema without a renderer a compile error.
 */

import type { ComponentType } from 'react'

import type { SectionType } from '../model/sections'
import { ParallaxBanner, VideoHero } from './banner-sections'
import { BlocksSection } from './blocks-section'
import { CollectionTabs, Countdown, FeaturedProduct, PromoCodes } from './commerce-sections'
import {
  Banner,
  Cards,
  Gallery,
  ProductList,
  Quotes,
  Statement,
  Story,
} from './consolidated-sections'
import {
  ContactCta,
  IconFeatures,
  Multicolumn,
  ScrollingStory,
  StoreLocations,
  TableSection,
  Timeline,
} from './content-sections'
import {
  BeforeAfter,
  LogoList,
  Lookbook,
  ScrollingText,
  VideoReels,
  VideoSection,
} from './media-sections'
import {
  ArticleContent,
  ArticleHeader,
  ArticlePagination,
  ArticleShare,
  RelatedArticles,
} from './article-page'
import { CatalogHeader, CatalogProducts } from './catalog-page'
import { PinnedScroll, ScrollRail, StackedCards } from './motion-sections'
import { ProductInfo, ProductReviews, RelatedProducts } from './product-page'
import { FEATURE_SECTION_RENDERERS } from './feature-sections'
import { BASE_SECTION_RENDERERS, type SectionProps } from './sections'

export const SECTION_RENDERERS = {
  ...BASE_SECTION_RENDERERS,
  ...FEATURE_SECTION_RENDERERS,
  banner: Banner,
  'product-list': ProductList,
  gallery: Gallery,
  quotes: Quotes,
  cards: Cards,
  statement: Statement,
  story: Story,
  blocks: BlocksSection,
  custom: BlocksSection,
  'video-hero': VideoHero,
  'parallax-banner': ParallaxBanner,
  'featured-product': FeaturedProduct,
  'collection-tabs': CollectionTabs,
  video: VideoSection,
  'video-reels': VideoReels,
  lookbook: Lookbook,
  'before-after': BeforeAfter,
  'logo-list': LogoList,
  'scrolling-text': ScrollingText,
  multicolumn: Multicolumn,
  'scrolling-story': ScrollingStory,
  'pinned-scroll': PinnedScroll,
  'scroll-rail': ScrollRail,
  'stacked-cards': StackedCards,
  timeline: Timeline,
  table: TableSection,
  countdown: Countdown,
  'promo-codes': PromoCodes,
  'icon-features': IconFeatures,
  'store-locations': StoreLocations,
  'contact-cta': ContactCta,
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
