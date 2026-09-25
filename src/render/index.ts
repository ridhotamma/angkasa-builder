/** `@repo/page-builder/render` — the Chakra renderers for stored layouts. */

export {
  RenderProvider,
  sampleStorefrontData,
  useRenderEnvironment,
  type RenderEnvironment,
  type StorefrontCategoryData,
  type StorefrontProductCard,
  type StorefrontRenderData,
  type StorefrontShelfData,
} from './context'
export { buttonLook, cardFrame, FullBleed, PAGE_WIDTH_CONTAINER } from './primitives'
export { RichTextView } from './rich-text'
export { SectionsRenderer, ThemeScope, type SectionsRendererProps } from './renderer'
export { SECTION_RENDERERS, type SectionProps } from './sections'
