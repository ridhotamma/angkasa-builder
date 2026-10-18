/** `@repo/page-builder/render` — the Chakra renderers for stored layouts. */

export {
  findProductCard,
  previewArticleDetail,
  previewListing,
  previewProductDetail,
  RenderProvider,
  sampleStorefrontData,
  useRenderEnvironment,
  type RenderEnvironment,
  type StorefrontArticleCard,
  type StorefrontArticleDetail,
  type StorefrontBranchData,
  type StorefrontCategoryData,
  type StorefrontGalleryImage,
  type StorefrontListingData,
  type StorefrontProductCard,
  type StorefrontProductDetail,
  type StorefrontRenderData,
  type StorefrontShelfData,
  type StorefrontSizeGuide,
  type StorefrontVoucherData,
} from './context'
export {
  hasTabBar,
  HEADER_HEIGHT_VAR,
  HEADER_OFFSET_VAR,
  isHeaderTransparent,
  StoreFooter,
  StoreHeader,
  StoreTab,
  StoreTabBar,
  STICKY_BELOW_HEADER,
  TABBAR_HEIGHT_VAR,
  type ChromeShop,
  type SocialPlatform,
  type StoreFooterProps,
  type StoreHeaderProps,
  type StoreTabBarProps,
} from './chrome'
export { BOLD_INK, boldButton, boldCard, boldShadow } from './bold'
export {
  informationLinks,
  menuHasLinkKind,
  type InformationLabels,
  type InformationLink,
} from './footer-links'
export { ArticleCard, ArticleGrid, formatArticleDate } from './article-page'
export { BlockChildren, BlockStrip } from './blocks-section'
export {
  blockRenderer,
  registerBlockRenderer,
  registeredBlockRenderers,
  registerWidget,
  type BlockRenderer,
  type BlockRendererProps,
} from './block-registry'
export { DataTable, whatsappHref } from './content-sections'
export { embedUrl } from './media'
export {
  buttonLook,
  cardFrame,
  cardHoverProps,
  FullBleed,
  PAGE_WIDTH_CONTAINER,
  useCard,
  type CardTheme,
} from './primitives'
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
export { SectionDivider } from './dividers'
export type { DividerShape } from '../model/section-style'
export { SplitText, useTilt, VelocityMarquee } from './motion'
export { SitePopup } from './popup'
export { SplashScreen, splashSkipScript, type SplashShop } from './splash'
export type { SectionProps } from './sections'
export {
  compiledSectionComponent,
  themeSectionResolver,
  type TemplateSectionOptions,
} from './template'
export { SNAPSHOT_WIDTH, TemplateSnapshotPage, type SnapshotPageProps } from './theme-preview'
