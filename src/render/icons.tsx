/**
 * The storefront's icon renderer.
 *
 * The catalogue is large (200+), but a page only ever draws a handful, so the
 * glyphs are split: a small eager core (the icons most likely above the fold)
 * is bundled, and every other icon is its own chunk pulled in on demand. A
 * storefront therefore ships only the icons its pages actually render — see
 * `scripts/generate-icons.ts` for the generated modules behind this.
 *
 * The catalogue names live in `model/icons`; the glyphs are generated.
 */

import { Icon, type IconProps } from '@chakra-ui/react'
import { lazy, Suspense } from 'react'

import { NO_ICON, resolveIconName, type IconName } from '../model/icons'
import { CORE_ICONS } from './core-icons'
import type { GlyphComponent } from './glyph'
import sparkles from './glyphs/sparkles'
import { ICON_LOADERS } from './icon-loaders'

/**
 * One lazy component per non-core icon, made once so its identity is stable
 * across renders — a fresh `lazy()` every render would remount the glyph.
 */
const LAZY_GLYPHS = new Map<IconName, GlyphComponent>()

function lazyGlyph(name: IconName): GlyphComponent {
  let glyph = LAZY_GLYPHS.get(name)
  if (!glyph) {
    glyph = lazy(ICON_LOADERS[name])
    LAZY_GLYPHS.set(name, glyph)
  }
  return glyph
}

/**
 * The component a stored icon name draws: a core glyph, a lazily loaded one, or
 * `null` when the seller picked "No icon". A name with no glyph (a layout from
 * a newer release) falls back to a sparkle.
 */
export function iconGlyph(name: string): GlyphComponent | null {
  if (name === NO_ICON) return null
  const resolved = resolveIconName(name)
  if (!resolved) return sparkles
  return CORE_ICONS[resolved] ?? lazyGlyph(resolved)
}

/**
 * One icon, ready to render. The Suspense boundary is what lets a non-core
 * glyph stream in (server) or pop in (client) instead of blocking the page;
 * core glyphs and "No icon" render synchronously.
 */
export function FeatureIcon({
  name,
  ...props
}: { name: string } & Omit<IconProps, 'as' | 'children'>) {
  const glyph = iconGlyph(name)
  if (!glyph) return null
  return (
    <Suspense fallback={null}>
      <Icon as={glyph} {...props} />
    </Suspense>
  )
}
