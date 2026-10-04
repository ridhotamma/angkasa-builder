/**
 * The background a section paints itself, for its dividers to mirror.
 *
 * Most sections get their background from the frame's style (a scheme band, a
 * gradient, a style-level background image), and `surfacePaint` already knows
 * it. Banner renderers are the exception: their background *is* their content
 * — a hero's photo, a video hero's poster, an editorial statement's image —
 * and that lives in the section's own settings, which the frame cannot see.
 *
 * Without this, a divider on a banner falls back to the page colour and is
 * invisible against it. This module names the few section types whose content
 * is the background, so the divider can carry it. A section with an explicit
 * style background still wins: the seller's choice is the deliberate one.
 */

import type { SectionInstance } from '../model/content'
import { readText, readVideo, type VideoRef } from '../model/fields'

export interface SectionBackground {
  /** A token background the renderer paints itself (the hero's subtle wash). */
  bg?: string
  media?: { imageId: string; video: VideoRef | null }
}

/** The media/background a banner renderer paints, or `null` when it paints none. */
export function sectionBackground(section: SectionInstance): SectionBackground | null {
  const { settings } = section

  switch (section.type) {
    case 'hero': {
      const imageId = readText(settings, 'image')
      if (imageId) return { media: { imageId, video: null } }
      // The renderer's own wash under a photo-less hero; the divider must match.
      return { bg: 'brand.subtle' }
    }
    case 'parallax-banner': {
      const imageId = readText(settings, 'image')
      return imageId ? { media: { imageId, video: null } } : null
    }
    case 'video-hero':
    case 'background-video': {
      const imageId = readText(settings, 'poster')
      const video = readVideo(settings, 'video')
      return imageId || video ? { media: { imageId, video } } : null
    }
    case 'editorial-statement': {
      const imageId = readText(settings, 'image')
      return imageId ? { media: { imageId, video: null } } : null
    }
    default:
      return null
  }
}
