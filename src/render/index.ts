/** `@repo/page-builder/render` — the Chakra renderers for stored layouts. */

export {
  findProductCard,
  previewArticleDetail,
  previewProductDetail,
  RenderProvider,
  sampleStorefrontData,
  useRenderEnvironment,
  type RenderEnvironment,
  type StorefrontArticleCard,
  type StorefrontArticleDetail,
  type StorefrontCategoryData,
  type StorefrontGalleryImage,
  type StorefrontProductCard,
  type StorefrontProductDetail,
  type StorefrontRenderData,
  type StorefrontShelfData,
  type StorefrontSizeGuide,
  type StorefrontVoucherData,
} from './context'
export {
  isHeaderTransparent,
  StoreFooter,
  StoreHeader,
  type ChromeShop,
  type SocialPlatform,
  type StoreFooterProps,
  type StoreHeaderProps,
} from './chrome'
export { ArticleCard, ArticleGrid, formatArticleDate } from './article-page'
export { DataTable, whatsappHref } from './content-sections'
export { embedUrl } from './media'
export { buttonLook, cardFrame, FullBleed, PAGE_WIDTH_CONTAINER } from './primitives'
export { RichTextView } from './rich-text'
export {
  drawnSections,
  isFullBleed,
  liveSections,
  NO_PAGE_EDGES,
  pageEdges,
  type PageEdges,
  SectionsRenderer,
  ThemeScope,
  type SectionsRendererProps,
} from './renderer'
export { SECTION_RENDERERS } from './registry'
export type { SectionProps } from './sections'
export { SNAPSHOT_WIDTH, TemplateSnapshotPage, type SnapshotPageProps } from './theme-preview'
