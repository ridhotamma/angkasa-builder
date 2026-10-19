/**
 * The family sections' renderers — one component per look, chosen by the
 * family's own variant field.
 *
 * A family type (`banner`, `product-list`, `gallery`, `quotes`, `cards`,
 * `statement`, `story`) stores a variant in `settings`; each map below names
 * the component that draws that look. The components are imported directly,
 * so a look that loses its renderer is a compile error rather than a silently
 * blank band.
 */

import type { ComponentType } from 'react'

import { readText } from '../model/fields'
import { BannerParallax, BannerVideo } from './banner-sections'
import { ProductListTabs } from './commerce-sections'
import { CardsIcons, CardsText, StoryChapters, StoryTimeline } from './content-sections'
import {
  CardsPeople,
  GalleryMasonry,
  GallerySocial,
  QuotesVideo,
  StatementFull,
  StatementSplit,
} from './feature-sections'
import {
  BannerImage,
  GalleryGrid,
  ProductListCollection,
  ProductListLatest,
  ProductListShelves,
  QuotesCards,
  StatementContained,
  type SectionProps,
} from './sections'

/** One family's looks, keyed by the value its variant field stores. */
type Looks = Record<string, ComponentType<SectionProps>>

/** A family component: reads `field` from its settings, draws the matching look. */
function family(field: string, looks: Looks, fallback: ComponentType<SectionProps>) {
  return function Family(props: SectionProps) {
    const Renderer = looks[readText(props.settings, field)] ?? fallback
    return <Renderer {...props} />
  }
}

export const Banner = family(
  'media',
  {
    image: BannerImage,
    video: BannerVideo,
    parallax: BannerParallax,
  },
  BannerImage,
)

export const ProductList = family(
  'source',
  {
    collection: ProductListCollection,
    shelves: ProductListShelves,
    latest: ProductListLatest,
    tabs: ProductListTabs,
  },
  ProductListCollection,
)

export const Gallery = family(
  'layout',
  { grid: GalleryGrid, masonry: GalleryMasonry, social: GallerySocial },
  GalleryGrid,
)

export const Quotes = family('variant', { quotes: QuotesCards, video: QuotesVideo }, QuotesCards)

export const Cards = family(
  'card',
  { text: CardsText, person: CardsPeople, icon: CardsIcons },
  CardsText,
)

export const Statement = family(
  'layout',
  { contained: StatementContained, split: StatementSplit, full: StatementFull },
  StatementContained,
)

export const Story = family(
  'style',
  { chapters: StoryChapters, timeline: StoryTimeline },
  StoryChapters,
)
