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
import { CollectionTabs } from './commerce-sections'
import { Multicolumn, ScrollingStory, Timeline } from './content-sections'
import { FEATURE_SECTION_RENDERERS } from './feature-sections'
import { RelatedProducts } from './product-page'
import { BASE_SECTION_RENDERERS, type SectionProps } from './sections'

/** The renderer each old type used; the consolidated types dispatch into this. */
const LEGACY: Record<string, ComponentType<SectionProps>> = {
  ...(BASE_SECTION_RENDERERS as Record<string, ComponentType<SectionProps>>),
  ...(FEATURE_SECTION_RENDERERS as Record<string, ComponentType<SectionProps>>),
  'collection-tabs': CollectionTabs,
  multicolumn: Multicolumn,
  'scrolling-story': ScrollingStory,
  timeline: Timeline,
  'related-products': RelatedProducts,
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
