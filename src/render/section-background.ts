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
import { readToken } from '../model/element-style'
import { readText, readVideo, type FieldValues, type VideoRef } from '../model/fields'
import {
  PHOTO_FIT_VALUES,
  PHOTO_POSITION_VALUES,
  type PhotoFit,
  type PhotoPosition,
} from '../model/section-style'

export interface SectionBackground {
  /** A token background the renderer paints itself (the hero's subtle wash). */
  bg?: string
  media?: { imageId: string; video: VideoRef | null }
  /** How the photo fills the frame, from the section's own `fit` field. */
  fit?: PhotoFit
  /** Which part of it stays in view, from the section's own `position` field. */
  position?: PhotoPosition
}

/** The photo crop a banner's own settings ask for, validated like any token. */
function photoCrop(settings: FieldValues): { fit: PhotoFit; position: PhotoPosition } {
  return {
    fit: readToken(settings, 'fit', PHOTO_FIT_VALUES, 'cover'),
    position: readToken(settings, 'position', PHOTO_POSITION_VALUES, 'center'),
  }
}

/** The media/background a banner renderer paints, or `null` when it paints none. */
export function sectionBackground(section: SectionInstance): SectionBackground | null {
  const { settings } = section

  switch (section.type) {
    case 'hero': {
      const imageId = readText(settings, 'image')
      if (imageId) return { media: { imageId, video: null }, ...photoCrop(settings) }
      // The renderer's own wash under a photo-less hero; the divider must match.
      return { bg: 'brand.subtle' }
    }
    case 'parallax-banner': {
      const imageId = readText(settings, 'image')
      return imageId ? { media: { imageId, video: null }, ...photoCrop(settings) } : null
    }
    case 'video-hero':
    case 'background-video': {
      const imageId = readText(settings, 'poster')
      const video = readVideo(settings, 'video')
      return imageId || video ? { media: { imageId, video }, ...photoCrop(settings) } : null
    }
    case 'editorial-statement': {
      const imageId = readText(settings, 'image')
      return imageId ? { media: { imageId, video: null }, ...photoCrop(settings) } : null
    }
    default:
      return null
  }
}
