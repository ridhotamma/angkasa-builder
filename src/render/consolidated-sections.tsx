/**
 * The consolidated sections' renderers — thin dispatchers.
 *
 * A consolidated type (`banner`, `product-list`, `gallery`, `quotes`, `cards`,
 * `statement`, `story`) stores the same settings its old siblings did plus the
 * variant field; `readText(settings, variantKey)` picks which of the existing
 * renderers draws it. So no drawing code moved: the four banner looks, six
 * product lists and so on are still the same components, reached one field
 * earlier.
 */

import type { ComponentType } from 'react'

import { readText } from '../model/fields'
import { ParallaxBanner, VideoHero } from './banner-sections'
import { CollectionTabs } from './commerce-sections'
import { IconFeatures, Multicolumn, ScrollingStory, Timeline } from './content-sections'
import { FEATURE_SECTION_RENDERERS } from './feature-sections'
import { RelatedProducts } from './product-page'
import { BASE_SECTION_RENDERERS, type SectionProps } from './sections'

/**
 * The renderer each old type used; the consolidated types dispatch into this.
 *
 * It has to name **every** legacy type the maps below reach — including the
 * ones only `SECTION_RENDERERS` otherwise carries, like the two bespoke banner
 * looks and the icon features. A name missing here is not a compile error (this
 * is a plain record), and `draw` quietly returns nothing: the whole look
 * vanishes from the page. Three did (video, parallax, icon cards) until
 * `consolidated-looks.test.tsx` rendered every look to stop it happening again.
 */
const LEGACY: Record<string, ComponentType<SectionProps>> = {
  ...(BASE_SECTION_RENDERERS as Record<string, ComponentType<SectionProps>>),
  ...(FEATURE_SECTION_RENDERERS as Record<string, ComponentType<SectionProps>>),
  'collection-tabs': CollectionTabs,
  'related-products': RelatedProducts,
  'video-hero': VideoHero,
  'parallax-banner': ParallaxBanner,
  multicolumn: Multicolumn,
  'icon-features': IconFeatures,
  'scrolling-story': ScrollingStory,
  timeline: Timeline,
}

function draw(legacy: string | undefined, props: SectionProps) {
  const Renderer = legacy ? LEGACY[legacy] : undefined
  return Renderer ? <Renderer {...props} /> : null
}

const BANNER_MEDIA: Record<string, string> = {
  image: 'hero',
  video: 'video-hero',
  parallax: 'parallax-banner',
  background: 'background-video',
}
export function Banner(props: SectionProps) {
  return draw(BANNER_MEDIA[readText(props.settings, 'media')] ?? 'hero', props)
}

const PRODUCT_SOURCE: Record<string, string> = {
  collection: 'featured-collection',
  shelves: 'collection-shelves',
  latest: 'latest-products',
  tabs: 'collection-tabs',
}
export function ProductList(props: SectionProps) {
  return draw(PRODUCT_SOURCE[readText(props.settings, 'source')] ?? 'featured-collection', props)
}

const GALLERY_LAYOUT: Record<string, string> = {
  grid: 'image-gallery',
  masonry: 'masonry-gallery',
  social: 'social-wall',
}
export function Gallery(props: SectionProps) {
  return draw(GALLERY_LAYOUT[readText(props.settings, 'layout')] ?? 'image-gallery', props)
}

const QUOTES_VARIANT: Record<string, string> = {
  quotes: 'testimonials',
  video: 'video-testimonials',
  press: 'press',
}
export function Quotes(props: SectionProps) {
  return draw(QUOTES_VARIANT[readText(props.settings, 'variant')] ?? 'testimonials', props)
}

const CARDS_CARD: Record<string, string> = {
  text: 'multicolumn',
  person: 'team',
  icon: 'icon-features',
}
export function Cards(props: SectionProps) {
  return draw(CARDS_CARD[readText(props.settings, 'card')] ?? 'multicolumn', props)
}

const STATEMENT_LAYOUT: Record<string, string> = {
  contained: 'image-with-text',
  split: 'split-screen',
  full: 'editorial-statement',
}
export function Statement(props: SectionProps) {
  return draw(STATEMENT_LAYOUT[readText(props.settings, 'layout')] ?? 'image-with-text', props)
}

const STORY_STYLE: Record<string, string> = {
  chapters: 'scrolling-story',
  timeline: 'timeline',
}
export function Story(props: SectionProps) {
  return draw(STORY_STYLE[readText(props.settings, 'style')] ?? 'scrolling-story', props)
}
