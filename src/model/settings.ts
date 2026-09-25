/**
 * Theme settings: the small, fixed set of knobs a shop turns to make a
 * template its own.
 *
 * Deliberately few. Every setting here is one a seller can reason about
 * ("my brand colour", "rounder corners") and every one maps onto a Chakra
 * token, so a section written once looks right under every theme. There is no
 * free-form CSS on any plan — see docs/PAGE-BUILDER.md.
 *
 * Pure: the admin server validates with it, the editor renders from it, and
 * the storefront turns it into CSS variables.
 */

import { z } from 'zod'

import type { Localized } from './localized'

/* -------------------------------------------------------------------------- */
/* Fonts                                                                      */
/* -------------------------------------------------------------------------- */

export interface FontOption {
  family: string
  /** The CSS fallback stack after the family itself. */
  fallback: 'sans-serif' | 'serif'
}

/**
 * The curated Google Fonts list.
 *
 * A list rather than a text box: every entry is known to exist on Google
 * Fonts with the weights the sections use, and a typo cannot silently fall
 * back to Times New Roman on a live storefront.
 */
export const FONT_OPTIONS = [
  { family: 'Poppins', fallback: 'sans-serif' },
  { family: 'Inter', fallback: 'sans-serif' },
  { family: 'DM Sans', fallback: 'sans-serif' },
  { family: 'Plus Jakarta Sans', fallback: 'sans-serif' },
  { family: 'Manrope', fallback: 'sans-serif' },
  { family: 'Outfit', fallback: 'sans-serif' },
  { family: 'Space Grotesk', fallback: 'sans-serif' },
  { family: 'Nunito', fallback: 'sans-serif' },
  { family: 'Work Sans', fallback: 'sans-serif' },
  { family: 'Playfair Display', fallback: 'serif' },
  { family: 'Lora', fallback: 'serif' },
  { family: 'Merriweather', fallback: 'serif' },
  { family: 'Libre Baskerville', fallback: 'serif' },
  { family: 'Fraunces', fallback: 'serif' },
] as const satisfies readonly FontOption[]

export type FontFamily = (typeof FONT_OPTIONS)[number]['family']

const FONT_FAMILIES = FONT_OPTIONS.map((font) => font.family) as [FontFamily, ...FontFamily[]]

export function fontStack(family: FontFamily): string {
  const option = FONT_OPTIONS.find((font) => font.family === family) ?? FONT_OPTIONS[0]
  const generic =
    option.fallback === 'serif'
      ? "ui-serif, Georgia, 'Times New Roman', serif"
      : 'ui-sans-serif, system-ui, -apple-system, sans-serif'
  return `'${option.family}', ${generic}`
}

/** The Google Fonts stylesheet URL for a theme's heading and body faces. */
export function googleFontsHref(settings: ThemeSettings): string {
  const families = [...new Set([settings.fonts.heading, settings.fonts.body])]
  const query = families
    .map((family) => `family=${family.replace(/ /g, '+')}:wght@400;500;600;700`)
    .join('&')
  return `https://fonts.googleapis.com/css2?${query}&display=swap`
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */

export const RADIUS_OPTIONS = ['none', 'sm', 'md', 'lg'] as const
export const BUTTON_STYLES = ['solid', 'outline', 'pill'] as const
export const CARD_STYLES = ['border', 'shadow', 'flat'] as const

export type RadiusOption = (typeof RADIUS_OPTIONS)[number]
export type ButtonStyle = (typeof BUTTON_STYLES)[number]
export type CardStyle = (typeof CARD_STYLES)[number]

export const OPTION_LABELS: Record<RadiusOption | ButtonStyle | CardStyle, Localized> = {
  none: { en: 'Square', id: 'Siku' },
  sm: { en: 'Small', id: 'Kecil' },
  md: { en: 'Medium', id: 'Sedang' },
  lg: { en: 'Large', id: 'Besar' },
  solid: { en: 'Solid', id: 'Solid' },
  outline: { en: 'Outline', id: 'Garis' },
  pill: { en: 'Pill', id: 'Kapsul' },
  border: { en: 'Border', id: 'Garis tepi' },
  shadow: { en: 'Shadow', id: 'Bayangan' },
  flat: { en: 'Flat', id: 'Datar' },
}

export interface ThemeSettings {
  colors: {
    /** The one colour the brand ramp is generated from. */
    brand: string
    background: string
    text: string
    accent: string
  }
  fonts: {
    heading: FontFamily
    body: FontFamily
  }
  radius: RadiusOption
  buttonStyle: ButtonStyle
  cardStyle: CardStyle
}

/** Pesanle's own look, which is what an untouched storefront wears today. */
export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  colors: {
    brand: '#ff4f00',
    background: '#fffefb',
    text: '#201515',
    accent: '#ff3d8b',
  },
  fonts: { heading: 'Poppins', body: 'Poppins' },
  radius: 'md',
  buttonStyle: 'solid',
  cardStyle: 'border',
}

const HEX = /^#[0-9a-f]{6}$/i

function hexColor(fallback: string) {
  return z
    .string()
    .trim()
    .regex(HEX)
    .transform((value) => value.toLowerCase())
    .catch(fallback)
}

const settingsSchema = z.object({
  colors: z
    .object({
      brand: hexColor(DEFAULT_THEME_SETTINGS.colors.brand),
      background: hexColor(DEFAULT_THEME_SETTINGS.colors.background),
      text: hexColor(DEFAULT_THEME_SETTINGS.colors.text),
      accent: hexColor(DEFAULT_THEME_SETTINGS.colors.accent),
    })
    .catch(DEFAULT_THEME_SETTINGS.colors),
  fonts: z
    .object({
      heading: z.enum(FONT_FAMILIES).catch(DEFAULT_THEME_SETTINGS.fonts.heading),
      body: z.enum(FONT_FAMILIES).catch(DEFAULT_THEME_SETTINGS.fonts.body),
    })
    .catch(DEFAULT_THEME_SETTINGS.fonts),
  radius: z.enum(RADIUS_OPTIONS).catch(DEFAULT_THEME_SETTINGS.radius),
  buttonStyle: z.enum(BUTTON_STYLES).catch(DEFAULT_THEME_SETTINGS.buttonStyle),
  cardStyle: z.enum(CARD_STYLES).catch(DEFAULT_THEME_SETTINGS.cardStyle),
})

/**
 * Any stored value, as settings. Lenient field by field: one bad colour falls
 * back to the default colour rather than throwing away the whole theme.
 */
export function sanitizeThemeSettings(value: unknown): ThemeSettings {
  return settingsSchema.catch(DEFAULT_THEME_SETTINGS).parse(value ?? {}) as ThemeSettings
}

/* -------------------------------------------------------------------------- */
/* Colour                                                                     */
/* -------------------------------------------------------------------------- */

type Rgb = [number, number, number]

function toRgb(hex: string): Rgb {
  const value = HEX.test(hex) ? hex.slice(1) : '000000'
  return [0, 2, 4].map((at) => parseInt(value.slice(at, at + 2), 16)) as Rgb
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b]
    .map((channel) =>
      Math.round(Math.min(255, Math.max(0, channel)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}

/** `amount` of the way from `from` to `to`, in sRGB. Good enough for tints. */
export function mix(from: string, to: string, amount: number): string {
  const a = toRgb(from)
  const b = toRgb(to)
  return toHex([0, 1, 2].map((i) => a[i]! + (b[i]! - a[i]!) * amount) as Rgb)
}

function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((channel) => {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as Rgb
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio, 1–21. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (light + 0.05) / (dark + 0.05)
}

/** Readable text on `background`: whichever of near-white or near-black wins. */
export function readableOn(background: string): string {
  return contrastRatio(background, '#ffffff') >= contrastRatio(background, '#111111')
    ? '#ffffff'
    : '#111111'
}

export const BRAND_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const

/** A 50–950 ramp with `hex` at 500, tinted toward white and shaded toward black. */
export function brandRamp(hex: string): Record<(typeof BRAND_SHADES)[number], string> {
  const tint = (amount: number) => mix(hex, '#ffffff', amount)
  const shade = (amount: number) => mix(hex, '#000000', amount)
  return {
    50: tint(0.92),
    100: tint(0.82),
    200: tint(0.64),
    300: tint(0.44),
    400: tint(0.22),
    500: hex,
    600: shade(0.12),
    700: shade(0.26),
    800: shade(0.4),
    900: shade(0.54),
    950: shade(0.68),
  }
}

/** The minimum contrast a theme must meet to be saved: WCAG AA for body text. */
export const MIN_CONTRAST = 4.5

export type ContrastIssue = 'text' | 'brand'

/**
 * What would make this theme hard to read, if anything.
 *
 * `text` is body copy on the page background. `brand` is a solid button's
 * label on the brand colour — the label colour is picked automatically, so
 * this only fails for a mid-tone brand colour that neither white nor black
 * reads well on.
 */
export function contrastIssues(settings: ThemeSettings): ContrastIssue[] {
  const issues: ContrastIssue[] = []
  if (contrastRatio(settings.colors.text, settings.colors.background) < MIN_CONTRAST) {
    issues.push('text')
  }
  const brand = settings.colors.brand
  if (contrastRatio(brand, readableOn(brand)) < 3) issues.push('brand')
  return issues
}

/* -------------------------------------------------------------------------- */
/* CSS variables                                                              */
/* -------------------------------------------------------------------------- */

const RADII: Record<RadiusOption, [string, string, string]> = {
  none: ['0px', '0px', '0px'],
  sm: ['2px', '4px', '6px'],
  md: ['4px', '6px', '8px'],
  lg: ['8px', '12px', '16px'],
}

/**
 * The Chakra CSS variables a theme overrides, for a wrapping element.
 *
 * Semantic tokens are overridden as well as the raw ramp, and that is
 * necessary rather than thorough: `--chakra-colors-brand-solid` is declared on
 * `:root` as `var(--chakra-colors-brand-500)`, and a custom property's `var()`
 * is resolved where it is *declared*. Overriding only the ramp on a wrapper
 * would leave every semantic token still pointing at the root's orange.
 */
export function themeCssVars(settings: ThemeSettings): Record<string, string> {
  const { always, surfaces } = themeCssVarGroups(settings)
  return { ...always, ...surfaces }
}

/**
 * The same variables, split by whether they hold in dark mode.
 *
 * `always` is the brand ramp, the solid brand colours, fonts and radii — true
 * whichever mode the shopper picked. `surfaces` is every colour derived from
 * the theme's background and text; a theme is designed in light, so those
 * apply only in light mode and dark mode keeps Chakra's own dark surfaces.
 */
export function themeCssVarGroups(settings: ThemeSettings): {
  always: Record<string, string>
  surfaces: Record<string, string>
} {
  const { brand, background, text } = settings.colors
  const ramp = brandRamp(brand)
  const [l1, l2, l3] = RADII[settings.radius]

  const always: Record<string, string> = {}
  for (const shade of BRAND_SHADES) always[`--chakra-colors-brand-${shade}`] = ramp[shade]

  Object.assign(always, {
    '--chakra-colors-brand-solid': brand,
    '--chakra-colors-brand-contrast': readableOn(brand),
    '--chakra-colors-brand-emphasized': ramp[600],
    '--chakra-colors-brand-focus-ring': brand,

    '--chakra-fonts-heading': fontStack(settings.fonts.heading),
    '--chakra-fonts-body': fontStack(settings.fonts.body),

    '--chakra-radii-l1': l1,
    '--chakra-radii-l2': l2,
    '--chakra-radii-l3': l3,

    '--pb-accent': settings.colors.accent,
  })

  const surfaces: Record<string, string> = {
    '--chakra-colors-brand-fg': contrastRatio(brand, background) >= 3 ? brand : ramp[700],
    '--chakra-colors-brand-muted': mix(brand, background, 0.75),
    '--chakra-colors-brand-subtle': mix(brand, background, 0.88),

    '--chakra-colors-bg': background,
    '--chakra-colors-bg-subtle': mix(background, text, 0.04),
    '--chakra-colors-bg-panel': background,
    '--chakra-colors-bg-muted': mix(background, text, 0.1),

    '--chakra-colors-fg': text,
    '--chakra-colors-fg-muted': mix(text, background, 0.3),
    '--chakra-colors-fg-subtle': mix(text, background, 0.5),
    '--chakra-colors-fg-inverted': background,

    '--chakra-colors-border': mix(text, background, 0.78),
    '--chakra-colors-border-subtle': mix(text, background, 0.88),
  }

  return { always, surfaces }
}

function declarations(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([name, value]) => `${name}:${value};`)
    .join('')
}

/**
 * A whole document's theme, as the text of a `<style>` tag.
 *
 * Unlayered on purpose: Chakra declares its tokens inside `@layer tokens`, and
 * an unlayered rule beats a layered one whatever its specificity, so these
 * win without `!important`. Light-mode surfaces are keyed off the `dark` class
 * the colour-mode provider puts on `<html>`.
 *
 * Every value comes out of `sanitizeThemeSettings` — hex colours, fonts from a
 * fixed list, radii from a fixed table — so the text is safe to inline.
 */
export function themeStylesheet(settings: ThemeSettings): string {
  const { always, surfaces } = themeCssVarGroups(settings)
  const dark = { '--chakra-colors-brand-fg': darkModeBrandFg(settings.colors.brand) }
  return (
    `:root{${declarations(always)}}` +
    `html:not(.dark){${declarations(surfaces)}}` +
    `html.dark{${declarations(dark)}}`
  )
}

/** The platform's dark page background (`surface.900`), which dark mode keeps. */
const DARK_BACKGROUND = '#140c0c'

/**
 * Brand-coloured text in dark mode: the brand colour itself when it reads on a
 * dark page, otherwise the first lighter shade of it that does. A theme with a
 * near-black brand colour — Minimal's charcoal — would otherwise write its
 * links in charcoal on black.
 */
export function darkModeBrandFg(brand: string): string {
  const ramp = brandRamp(brand)
  for (const shade of [500, 400, 300, 200, 100, 50] as const) {
    if (contrastRatio(ramp[shade], DARK_BACKGROUND) >= MIN_CONTRAST) return ramp[shade]
  }
  return ramp[50]
}
