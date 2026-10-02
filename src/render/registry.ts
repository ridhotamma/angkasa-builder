/**
 * Every section type's renderer. `satisfies Record<SectionType, …>` is what
 * makes a schema without a renderer a compile error.
 */

import type { ComponentType } from 'react'

import type { SectionType } from '../model/sections'
import { ParallaxBanner, VideoHero } from './banner-sections'
import { CollectionTabs, Countdown, FeaturedProduct, PromoCodes } from './commerce-sections'
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
import { PinnedScroll, ScrollRail, Stats } from './motion-sections'
import { ProductInfo, ProductReviews, RelatedProducts } from './product-page'
import { BASE_SECTION_RENDERERS, type SectionProps } from './sections'

export const SECTION_RENDERERS = {
  ...BASE_SECTION_RENDERERS,
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
  stats: Stats,
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
} satisfies Record<SectionType, ComponentType<SectionProps>>
