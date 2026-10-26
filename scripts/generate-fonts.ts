/**
 * Generate the page builder's font library from Google Fonts' own metadata.
 *
 * The catalogue has to be accurate, not aspirational: Google's CSS2 API
 * rejects a whole request when one requested weight does not exist for a
 * family, so every entry carries the weights that family really ships. The
 * metadata endpoint (`fonts.google.com/metadata/fonts`) is the source.
 *
 * Run: `bun run generate:fonts` from `packages/page-builder`. The output is
 * committed; re-run when the library should grow or refresh.
 *
 * The library is append-only. Popularity reshuffles every month, and a family
 * that falls out of the top `LIMIT` is still the face some saved theme or
 * studio design names — dropping it would quietly turn that shop into Poppins.
 * So every family already in the library is kept, in its place, with fresh
 * metadata; only the room left under `LIMIT` is filled by popularity.
 */

import { FONT_OPTIONS as CURRENT } from '../src/model/font-library'

const METADATA_URL = 'https://fonts.google.com/metadata/fonts'
const OUTPUT = new URL('../src/model/font-library.ts', import.meta.url)

/** How many families the picker offers, most popular first. */
const LIMIT = 300

/**
 * Families Google serves but does not license for third-party use. Google
 * Sans is its corporate typeface; the rest of the "brand font" flag covers
 * open families like Roboto, so this is a name list, not a flag.
 */
function isExcluded(family: string): boolean {
  return family.startsWith('Google Sans')
}

/** The AI is prompted with these only; a 300-name list would drown the plan. */
const FEATURED = [
  'Archivo',
  'Barlow',
  'Bebas Neue',
  'Cabin',
  'Cormorant Garamond',
  'Crimson Text',
  'DM Sans',
  'DM Serif Display',
  'EB Garamond',
  'Figtree',
  'Fraunces',
  'Inter',
  'Josefin Sans',
  'Jost',
  'Karla',
  'Lato',
  'Lexend',
  'Libre Baskerville',
  'Libre Franklin',
  'Lora',
  'Manrope',
  'Merriweather',
  'Montserrat',
  'Mulish',
  'Noto Sans',
  'Nunito',
  'Nunito Sans',
  'Open Sans',
  'Oswald',
  'Outfit',
  'PT Sans',
  'PT Serif',
  'Playfair Display',
  'Plus Jakarta Sans',
  'Poppins',
  'Public Sans',
  'Quicksand',
  'Raleway',
  'Red Hat Display',
  'Roboto',
  'Roboto Condensed',
  'Roboto Mono',
  'Roboto Slab',
  'Rubik',
  'Sora',
  'Source Sans 3',
  'Space Grotesk',
  'Syne',
  'Ubuntu',
  'Urbanist',
  'Work Sans',
  'Zilla Slab',
] as const

interface FamilyMetadata {
  family: string
  category: string
  stroke?: string
  subsets?: string[]
  fonts?: Record<string, unknown>
  popularity?: number
  isOpenSource?: boolean
  isBrandFont?: boolean
  primaryScript?: string
}

const CATEGORY: Record<string, string> = {
  'Sans Serif': 'sans',
  Serif: 'serif',
  Display: 'display',
  Handwriting: 'handwriting',
  Monospace: 'monospace',
}

/** Upright weights only: the theme never asks for italics. */
function uprightWeights(family: FamilyMetadata): number[] {
  const weights = new Set<number>()
  for (const key of Object.keys(family.fonts ?? {})) {
    if (key.endsWith('i')) continue
    const weight = Number(key)
    if (Number.isInteger(weight)) weights.add(weight)
  }
  return [...weights].sort((a, b) => a - b)
}

/** The four the theme actually uses, when the family has them. */
function themeWeights(weights: number[]): number[] {
  const wanted = [400, 500, 600, 700].filter((weight) => weights.includes(weight))
  return wanted.length > 0 ? wanted : [weights[0]!]
}

/**
 * The weights a studio design can ask for (300–900) beyond the theme's four.
 * Without them the canvas and the render service each pick the nearest face
 * on their own, and a weight-800 headline need not land on the same one.
 */
const DESIGN_WEIGHTS = [300, 400, 500, 600, 700, 800, 900]

function extraWeights(weights: number[], theme: number[]): number[] {
  return DESIGN_WEIGHTS.filter((weight) => weights.includes(weight) && !theme.includes(weight))
}

/**
 * The design weights that ship a true italic. A family without one has no
 * italic at all as far as the studio is concerned: the browser would slant
 * the upright face and the render service would not, so the two disagree.
 */
function italicWeights(family: FamilyMetadata): number[] {
  const weights = new Set<number>()
  for (const key of Object.keys(family.fonts ?? {})) {
    if (!key.endsWith('i')) continue
    const weight = Number(key.slice(0, -1))
    if (DESIGN_WEIGHTS.includes(weight)) weights.add(weight)
  }
  return [...weights].sort((a, b) => a - b)
}

function fallbackFor(family: FamilyMetadata): string {
  switch (family.category) {
    case 'Serif':
      return 'serif'
    case 'Handwriting':
      return 'cursive'
    case 'Monospace':
      return 'monospace'
    case 'Display':
      // Display families are split: keep the serif ones serif.
      return family.stroke === 'Serif' ? 'serif' : 'sans-serif'
    default:
      return 'sans-serif'
  }
}

async function main(): Promise<void> {
  const response = await fetch(METADATA_URL)
  if (!response.ok) throw new Error(`metadata_${response.status}`)
  const payload = (await response.json()) as { familyMetadataList?: FamilyMetadata[] }
  const all = payload.familyMetadataList ?? []

  const featured = new Set<string>(FEATURED)
  const byName = new Map(all.map((family) => [family.family, family]))

  // Every family already in the library, in its place — see the file header.
  const kept = CURRENT.flatMap((option) => {
    const family = byName.get(option.family)
    if (!family) console.warn(`no longer on Google Fonts, kept as is: ${option.family}`)
    return family ? [family] : []
  })
  const keptNames = new Set(CURRENT.map((option) => option.family))
  const added = all
    .filter((family) => {
      if (keptNames.has(family.family)) return false
      if (!family.isOpenSource || isExcluded(family.family)) return false
      // Every family here can set Latin copy; a family that cannot is useless
      // to a storefront whose copy is Latin-script.
      if (!family.subsets?.includes('latin')) return false
      return uprightWeights(family).includes(400)
    })
    .sort((a, b) => (a.popularity ?? 99_999) - (b.popularity ?? 99_999))
    .slice(0, Math.max(0, LIMIT - CURRENT.length))
  const chosen = [...kept, ...added]

  const entries = chosen.map((family) => {
    const upright = uprightWeights(family)
    const weights = themeWeights(upright)
    return {
      family: family.family,
      category: CATEGORY[family.category] ?? 'sans',
      fallback: fallbackFor(family),
      weights,
      extraWeights: extraWeights(upright, weights),
      italics: italicWeights(family),
      featured: featured.has(family.family),
    }
  })
  // A family Google has withdrawn is carried over verbatim rather than lost.
  for (const option of CURRENT) {
    if (byName.has(option.family)) continue
    entries.splice(CURRENT.indexOf(option), 0, {
      family: option.family,
      category: option.category,
      fallback: option.fallback,
      weights: [...option.weights],
      extraWeights: [...(option.extraWeights ?? [])],
      italics: [...(option.italics ?? [])],
      featured: option.featured === true,
    })
  }

  const missing = [...featured].filter((name) => !entries.some((entry) => entry.family === name))
  if (missing.length > 0) console.warn(`featured not in the library: ${missing.join(', ')}`)

  const list = (values: readonly number[]) => `[${values.join(', ')}]`
  const lines = entries.map((entry) => {
    const extra = entry.extraWeights.length > 0 ? `, extraWeights: ${list(entry.extraWeights)}` : ''
    const italics = entry.italics.length > 0 ? `, italics: ${list(entry.italics)}` : ''
    return `  { family: ${quote(entry.family)}, category: '${entry.category}', fallback: '${entry.fallback}', weights: ${list(entry.weights)}${extra}${italics}${entry.featured ? ', featured: true' : ''} },`
  })

  const file = `/**
 * The page builder's font library.
 *
 * Generated by \`scripts/generate-fonts.ts\` from Google Fonts' metadata —
 * popularity order, Latin subset, open-source families only. Each entry
 * carries the weights that family really ships, because Google's CSS2 API
 * rejects a request that names a weight the family does not have.
 *
 * Only the families a shop actually picks are ever requested: the storefront
 * builds one CSS2 URL from its heading and body fonts (see \`googleFontsHref\`
 * in \`./settings\`). A larger library costs the storefront nothing.
 *
 * Do not edit by hand; run \`bun run generate:fonts\` instead.
 */

export type FontCategory = 'sans' | 'serif' | 'display' | 'handwriting' | 'monospace'

export type FontFallback = 'sans-serif' | 'serif' | 'monospace' | 'cursive'

export interface FontOption {
  family: string
  category: FontCategory
  /** The generic stack the family falls back to while it loads or if it fails. */
  fallback: FontFallback
  /** The weights the family ships, narrowed to the four a theme uses. */
  weights: readonly number[]
  /** Upright weights it also ships that a studio design can use (300, 800, 900). */
  extraWeights?: readonly number[]
  /** Weights (300–900) it ships a true italic for; absent when it has none. */
  italics?: readonly number[]
  /** On the AI's shortlist: popular enough to suggest and cheap to prompt. */
  featured?: boolean
}

// Generated entries are one family per line and deliberately not reflowed.
// prettier-ignore
export const FONT_OPTIONS: readonly FontOption[] = [
${lines.join('\n')}
]

const BY_FAMILY = new Map(FONT_OPTIONS.map((font) => [font.family, font]))

export function findFont(family: string): FontOption | null {
  return BY_FAMILY.get(family) ?? null
}

export function isFontFamily(value: unknown): value is string {
  return typeof value === 'string' && BY_FAMILY.has(value)
}

/** The AI's shortlist, in popularity order. */
export const FEATURED_FONTS: readonly FontOption[] = FONT_OPTIONS.filter(
  (font) => font.featured === true,
)
`

  await Bun.write(OUTPUT, file)
  console.log(`[generate-fonts] wrote ${entries.length} families (${featured.size} featured)`)
}

function quote(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

await main()
