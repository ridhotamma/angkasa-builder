/**
 * The shape of a generated icon glyph.
 *
 * `scripts/generate-icons.ts` writes one self-contained module per icon, each
 * rendering an `<svg>` — so the bundler can give every glyph its own chunk. The
 * glyphs are keyed by `IconName`; see `render/icons` for the storefront's
 * core-plus-lazy rendering.
 */

import type { ComponentType, SVGProps } from 'react'

export type GlyphComponent = ComponentType<SVGProps<SVGSVGElement>>
