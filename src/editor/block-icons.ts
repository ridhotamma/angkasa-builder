/**
 * The glyph shown for each primitive block, shared by the add palette and the
 * "Add block" menu inside a section. A registered custom block without a glyph
 * falls back to the caller's generic icon.
 */

import type { IconType } from 'react-icons'
import {
  LuChevronDown,
  LuColumns3,
  LuGalleryHorizontal,
  LuGrid2X2,
  LuHeading,
  LuImage,
  LuListTree,
  LuMap,
  LuMinus,
  LuMousePointerClick,
  LuMoveHorizontal,
  LuPilcrow,
  LuPlay,
  LuSparkles,
  LuSquare,
  LuStar,
  LuTag,
  LuText,
} from 'react-icons/lu'

const BLOCK_GLYPHS: Record<string, IconType> = {
  heading: LuHeading,
  text: LuPilcrow,
  richtext: LuText,
  button: LuMousePointerClick,
  image: LuImage,
  video: LuPlay,
  map: LuMap,
  icon: LuSparkles,
  badge: LuTag,
  rating: LuStar,
  collapsible: LuChevronDown,
  divider: LuMinus,
  spacer: LuSquare,
  column: LuColumns3,
  columns: LuColumns3,
  row: LuListTree,
  grid: LuGrid2X2,
  slider: LuGalleryHorizontal,
  marquee: LuMoveHorizontal,
}

/** The glyph for a block type, or `null` when the type has none of its own. */
export function blockGlyph(type: string): IconType | null {
  return BLOCK_GLYPHS[type] ?? null
}
