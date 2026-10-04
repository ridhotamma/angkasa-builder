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
 */

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
  const chosen = all
    .filter((family) => {
      if (!family.isOpenSource || isExcluded(family.family)) return false
      // Every family here can set Latin copy; a family that cannot is useless
      // to a storefront whose copy is Latin-script.
      if (!family.subsets?.includes('latin')) return false
      return uprightWeights(family).includes(400)
    })
    .sort((a, b) => (a.popularity ?? 99_999) - (b.popularity ?? 99_999))
    .slice(0, LIMIT)

  const entries = chosen.map((family) => {
    const weights = themeWeights(uprightWeights(family))
    return {
      family: family.family,
      category: CATEGORY[family.category] ?? 'sans',
      fallback: fallbackFor(family),
      weights,
      featured: featured.has(family.family),
    }
  })

  const missing = [...featured].filter((name) => !entries.some((entry) => entry.family === name))
  if (missing.length > 0) console.warn(`featured not in the library: ${missing.join(', ')}`)

  const lines = entries.map((entry) => {
    const weights = `[${entry.weights.join(', ')}]`
    return `  { family: ${quote(entry.family)}, category: '${entry.category}', fallback: '${entry.fallback}', weights: ${weights}${entry.featured ? ', featured: true' : ''} },`
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
