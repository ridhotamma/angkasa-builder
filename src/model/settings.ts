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

import { findFont, isFontFamily, type FontFallback } from './font-library'
import type { Localized } from './localized'

export {
  FEATURED_FONTS,
  FONT_OPTIONS,
  findFont,
  isFontFamily,
  type FontCategory,
  type FontFallback,
  type FontOption,
} from './font-library'

/* -------------------------------------------------------------------------- */
/* Fonts                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A font family, validated against the library rather than typed as a union:
 * the catalogue holds hundreds of families and a union of that size would
 * slow every file that touches a theme down. `isFontFamily` is the gate.
 */
export type FontFamily = string

const GENERIC_STACK: Record<FontFallback, string> = {
  'sans-serif': 'ui-sans-serif, system-ui, -apple-system, sans-serif',
  serif: "ui-serif, Georgia, 'Times New Roman', serif",
  monospace: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  cursive: "ui-rounded, 'Segoe UI', cursive",
}

/** The CSS stack for a family: the family itself, then its generic fallback. */
export function fontStack(family: FontFamily): string {
  const option = findFont(family) ?? findFont('Poppins')!
  return `'${option.family}', ${GENERIC_STACK[option.fallback]}`
}

/**
 * The Google Fonts stylesheet URL for a theme's heading and body faces.
 *
 * Only the chosen families are requested — the library's size never reaches
 * the storefront. The weights come from each family's own entry: Google's
 * CSS2 API rejects the whole request when one named weight does not exist, so
 * a family that ships only 400 and 700 asks for only those.
 */
export function googleFontsHref(settings: ThemeSettings): string {
  const families = [...new Set([settings.fonts.heading, settings.fonts.body])]
  const query = families
    .flatMap((family) => {
      // An unknown family is not requestable (and `fontStack` falls back to
      // Poppins anyway); skip it rather than 400 the whole stylesheet.
      const part = fontHref(family)
      return part ? [part] : []
    })
    .join('&')
  return `https://fonts.googleapis.com/css2?${query}&display=swap`
}

/**
 * One family's `family=…` query part, weights included, or `null` for a family
 * the library does not know. The editor's lazy previews use this too.
 */
export function fontHref(family: FontFamily): string | null {
  const option = findFont(family)
  if (!option) return null
  const weights = option.weights.length > 0 ? option.weights : [400]
  return `family=${family.replace(/ /g, '+')}:wght@${weights.join(';')}`
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */

export const RADIUS_OPTIONS = ['none', 'sm', 'md', 'lg'] as const
export const BUTTON_STYLES = ['solid', 'outline', 'pill'] as const
export const CARD_STYLES = ['border', 'shadow', 'flat'] as const

export const ANIMATION_STYLES = ['none', 'subtle', 'expressive'] as const

/**
 * One step for every text size in the storefront. A token scale, not a free
 * multiplier: the values move every Chakra font-size token by a fixed step, so
 * a heading, a paragraph and a button label stay in proportion.
 */
export const TYPE_SCALES = ['compact', 'default', 'large'] as const
export type TypeScale = (typeof TYPE_SCALES)[number]

/**
 * One step for every gap, padding and control size. Tight packs a catalogue,
 * airy gives a boutique room to breathe — without touching a single section.
 */
export const DENSITIES = ['tight', 'cozy', 'airy'] as const
export type Density = (typeof DENSITIES)[number]

export const TYPE_SCALE_LABELS: Record<TypeScale, Localized> = {
  compact: { en: 'Compact', id: 'Ringkas' },
  default: { en: 'Default', id: 'Bawaan' },
  large: { en: 'Large', id: 'Besar' },
}

export const DENSITY_LABELS: Record<Density, Localized> = {
  tight: { en: 'Tight', id: 'Rapat' },
  cozy: { en: 'Cozy', id: 'Nyaman' },
  airy: { en: 'Airy', id: 'Lega' },
}

/* -------------------------------------------------------------------------- */
/* Splash screen                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The brand intro: a full-screen logo card on a visit's first load, never on
 * in-site navigation. Off by default, so an existing theme reads unchanged.
 * `smoke` and `ink` are CSS approximations of the Tier 2 shader exits; a
 * no-JS page dismisses itself through the same CSS keyframes.
 */
export const SPLASH_STYLES = ['fade', 'slide-up', 'slide-down', 'smoke', 'ink'] as const
export const SPLASH_TONES = ['page', 'dark', 'brand'] as const

export type SplashStyle = (typeof SPLASH_STYLES)[number]
export type SplashTone = (typeof SPLASH_TONES)[number]

export interface SplashSettings {
  enabled: boolean
  style: SplashStyle
  /** The shop's logo from shop settings, when it has one. */
  showLogo: boolean
  /** The shop's name. */
  showName: boolean
  tone: SplashTone
  /** Skip the intro on later full loads in the same tab. Off: a reload replays. */
  oncePerSession: boolean
}

export const DEFAULT_SPLASH: SplashSettings = {
  enabled: false,
  style: 'fade',
  showLogo: true,
  showName: true,
  tone: 'page',
  oncePerSession: false,
}

export const SPLASH_STYLE_LABELS: Record<SplashStyle, Localized> = {
  fade: { en: 'Fade', id: 'Memudar' },
  'slide-up': { en: 'Slide up', id: 'Geser ke atas' },
  'slide-down': { en: 'Slide down', id: 'Geser ke bawah' },
  smoke: { en: 'Smoke', id: 'Asap' },
  ink: { en: 'Ink', id: 'Tinta' },
}

export const SPLASH_TONE_LABELS: Record<SplashTone, Localized> = {
  page: { en: 'Page', id: 'Halaman' },
  dark: { en: 'Dark', id: 'Gelap' },
  brand: { en: 'Brand', id: 'Brand' },
}

/* -------------------------------------------------------------------------- */
/* Site popup                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * One popup per theme, told what to be: a welcome offer after a delay, an
 * exit-intent offer, an age gate, or a cookie notice bar. Off by default.
 * `oncePerSession` is the polite default for all but the cookie bar, which is
 * remembered for the session so it does not nag.
 */
export const POPUP_KINDS = ['none', 'welcome', 'exit', 'age', 'cookie'] as const
export type PopupKind = (typeof POPUP_KINDS)[number]

export interface PopupSettings {
  kind: PopupKind
  title: string
  body: string
  buttonLabel: string
  /** Seconds before a welcome popup opens. */
  delaySeconds: number
  oncePerSession: boolean
  tone: SplashTone
}

export const DEFAULT_POPUP: PopupSettings = {
  kind: 'none',
  title: 'Welcome — here’s 10% off',
  body: 'Join the list for first access to new drops.',
  buttonLabel: 'Continue',
  delaySeconds: 4,
  oncePerSession: true,
  tone: 'page',
}

export const POPUP_KIND_LABELS: Record<PopupKind, Localized> = {
  none: { en: 'None', id: 'Tidak ada' },
  welcome: { en: 'Welcome offer', id: 'Tawaran selamat datang' },
  exit: { en: 'Exit intent', id: 'Saat akan keluar' },
  age: { en: 'Age gate', id: 'Gerbang usia' },
  cookie: { en: 'Cookie notice', id: 'Pemberitahuan cookie' },
}

/**
 * The colour schemes a section can wear besides the page's own. Four named
 * roles rather than a free list: a seller picks "the dark band", and every
 * template can rely on the same four existing.
 */
export const SCHEME_KEYS = ['subtle', 'inverse', 'brand', 'accent'] as const

export type RadiusOption = (typeof RADIUS_OPTIONS)[number]
export type AnimationStyle = (typeof ANIMATION_STYLES)[number]
export type SchemeKey = (typeof SCHEME_KEYS)[number]

export interface SchemeColors {
  background: string
  text: string
  /** Solid buttons and links inside the scheme. */
  button: string
}

export type ButtonStyle = (typeof BUTTON_STYLES)[number]
export type CardStyle = (typeof CARD_STYLES)[number]

export const SCHEME_LABELS: Record<'default' | SchemeKey, Localized> = {
  default: { en: 'Page colours', id: 'Warna halaman' },
  subtle: { en: 'Soft', id: 'Lembut' },
  inverse: { en: 'Dark', id: 'Gelap' },
  brand: { en: 'Brand', id: 'Brand' },
  accent: { en: 'Accent', id: 'Aksen' },
}

export const ANIMATION_LABELS: Record<AnimationStyle, Localized> = {
  none: { en: 'None', id: 'Tanpa animasi' },
  subtle: { en: 'Subtle — fade in', id: 'Halus — muncul perlahan' },
  expressive: { en: 'Expressive — rise and zoom', id: 'Ekspresif — naik dan membesar' },
}

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
  /** One step for every text size: compact, default or large. */
  typeScale: TypeScale
  /** One step for every gap, padding and control size: tight, cozy or airy. */
  density: Density
  /**
   * The seller's own colours for a scheme. A scheme without one follows the
   * theme's colours (see `resolveScheme`), so changing the brand colour
   * recolours every section that uses it.
   */
  schemes: Partial<Record<SchemeKey, SchemeColors>>
  /** How sections enter as the page scrolls. */
  animation: AnimationStyle
  /** The brand intro on a visit's first load. */
  splash: SplashSettings
  /** The one site popup: welcome, exit, age gate or cookie notice. */
  popup: PopupSettings
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
  // The middle of each scale is the storefront as it always was, so a theme
  // saved before these knobs existed reads exactly the same.
  typeScale: 'default',
  density: 'cozy',
  schemes: {},
  // Off for a theme that never chose: a storefront that did not move yesterday
  // should not start moving after a deploy.
  animation: 'none',
  splash: DEFAULT_SPLASH,
  popup: DEFAULT_POPUP,
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
      heading: z.string().trim().refine(isFontFamily).catch(DEFAULT_THEME_SETTINGS.fonts.heading),
      body: z.string().trim().refine(isFontFamily).catch(DEFAULT_THEME_SETTINGS.fonts.body),
    })
    .catch(DEFAULT_THEME_SETTINGS.fonts),
  radius: z.enum(RADIUS_OPTIONS).catch(DEFAULT_THEME_SETTINGS.radius),
  buttonStyle: z.enum(BUTTON_STYLES).catch(DEFAULT_THEME_SETTINGS.buttonStyle),
  cardStyle: z.enum(CARD_STYLES).catch(DEFAULT_THEME_SETTINGS.cardStyle),
  typeScale: z.enum(TYPE_SCALES).catch(DEFAULT_THEME_SETTINGS.typeScale),
  density: z.enum(DENSITIES).catch(DEFAULT_THEME_SETTINGS.density),
  schemes: z
    .object(
      Object.fromEntries(
        SCHEME_KEYS.map((key) => [
          key,
          z
            .object({ background: hexColor(''), text: hexColor(''), button: hexColor('') })
            .transform((scheme) =>
              scheme.background && scheme.text && scheme.button ? scheme : undefined,
            )
            .optional()
            .catch(undefined),
        ]),
      ),
    )
    .transform((schemes) =>
      Object.fromEntries(Object.entries(schemes).filter(([, scheme]) => scheme !== undefined)),
    )
    .catch({}),
  animation: z.enum(ANIMATION_STYLES).catch(DEFAULT_THEME_SETTINGS.animation),
  splash: z
    .object({
      enabled: z.boolean().catch(DEFAULT_SPLASH.enabled),
      style: z.enum(SPLASH_STYLES).catch(DEFAULT_SPLASH.style),
      showLogo: z.boolean().catch(DEFAULT_SPLASH.showLogo),
      showName: z.boolean().catch(DEFAULT_SPLASH.showName),
      tone: z.enum(SPLASH_TONES).catch(DEFAULT_SPLASH.tone),
      oncePerSession: z.boolean().catch(DEFAULT_SPLASH.oncePerSession),
    })
    .catch(DEFAULT_SPLASH),
  popup: z
    .object({
      kind: z.enum(POPUP_KINDS).catch(DEFAULT_POPUP.kind),
      title: z.string().trim().max(120).catch(DEFAULT_POPUP.title),
      body: z.string().trim().max(400).catch(DEFAULT_POPUP.body),
      buttonLabel: z.string().trim().max(40).catch(DEFAULT_POPUP.buttonLabel),
      delaySeconds: z.number().int().min(1).max(60).catch(DEFAULT_POPUP.delaySeconds),
      oncePerSession: z.boolean().catch(DEFAULT_POPUP.oncePerSession),
      tone: z.enum(SPLASH_TONES).catch(DEFAULT_POPUP.tone),
    })
    .catch(DEFAULT_POPUP),
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

/** How far each text scale moves Chakra's font-size tokens. */
const TYPE_SCALE_FACTOR: Record<TypeScale, number> = {
  compact: 0.9,
  default: 1,
  large: 1.125,
}

/** How far each density moves Chakra's spacing tokens. */
const DENSITY_FACTOR: Record<Density, number> = {
  tight: 0.85,
  cozy: 1,
  airy: 1.18,
}

/** Chakra's default font sizes, in rem — the base each scale multiplies. */
const FONT_SIZE_REM: Record<string, number> = {
  '2xs': 0.625,
  xs: 0.75,
  sm: 0.875,
  md: 1,
  lg: 1.125,
  xl: 1.25,
  '2xl': 1.5,
  '3xl': 1.875,
  '4xl': 2.25,
  '5xl': 3,
  '6xl': 3.75,
  '7xl': 4.5,
  '8xl': 6,
  '9xl': 8,
}

/** Chakra's default spacing scale, in quarter-rem units. */
const SPACING_UNITS = [
  0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40,
  44, 48, 52, 56, 60, 64, 72, 80, 96,
] as const

/** `spacing.0.5` is the CSS variable `--chakra-spacing-0\.5` — Chakra escapes the dot. */
function spacingVar(unit: number): string {
  return `--chakra-spacing-${String(unit).replace('.', '\\.')}`
}

function rem(value: number): string {
  return `${Math.round(value * 10_000) / 10_000}rem`
}

/**
 * The type and density scales, as the Chakra token overrides that move every
 * text size and every gap at once. The middle of each scale emits nothing, so
 * a theme that never touched them declares exactly the variables it did
 * before. Every value is computed from a fixed base — no free-form CSS.
 */
function scaleCssVars(settings: ThemeSettings): Record<string, string> {
  const vars: Record<string, string> = {}
  const type = TYPE_SCALE_FACTOR[settings.typeScale]
  if (type !== 1) {
    for (const [token, base] of Object.entries(FONT_SIZE_REM)) {
      vars[`--chakra-font-sizes-${token}`] = rem(base * type)
    }
  }
  const density = DENSITY_FACTOR[settings.density]
  if (density !== 1) {
    for (const unit of SPACING_UNITS) {
      vars[spacingVar(unit)] = rem(unit * 0.25 * density)
    }
  }
  return vars
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
    // Every button's shape, read by the shared button recipe. Mirrors
    // `buttonLook`: a capsule for `pill`, the theme's button corner otherwise.
    '--button-radius': settings.buttonStyle === 'pill' ? '9999px' : l2,

    '--pb-accent': settings.colors.accent,
  })

  // Type and density scale Chakra's own tokens, so every section — and the
  // chrome around it — follows without a renderer knowing the setting exists.
  Object.assign(always, scaleCssVars(settings))

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

/* -------------------------------------------------------------------------- */
/* Colour schemes                                                             */
/* -------------------------------------------------------------------------- */

/**
 * A scheme's colours: the seller's own when they set them, otherwise derived
 * from the theme's colours so that every template gets four usable bands the
 * moment it picks a brand colour. Derived schemes are readable by
 * construction — their text is always `readableOn` their background.
 */
export function resolveScheme(settings: ThemeSettings, key: SchemeKey): SchemeColors {
  const own = settings.schemes[key]
  if (own) return own

  const { brand, background, text, accent } = settings.colors
  switch (key) {
    case 'subtle':
      return { background: mix(background, brand, 0.07), text, button: brand }
    case 'inverse': {
      // The page's text colour makes the dark band, when it is dark enough to
      // be one; a light text colour (a dark theme) falls back to near-black.
      const dark = contrastRatio(text, '#ffffff') >= 7 ? text : '#141414'
      const button = contrastRatio(brand, dark) >= 3 ? brand : brandRamp(brand)[300]
      return {
        background: dark,
        text: readableOn(dark) === '#ffffff' ? '#fafafa' : '#111111',
        button,
      }
    }
    case 'brand': {
      const label = readableOn(brand)
      return { background: brand, text: label, button: label }
    }
    case 'accent': {
      const label = readableOn(accent)
      return { background: accent, text: label, button: label }
    }
  }
}

/**
 * The Chakra variables a section band overrides to wear a scheme. The same
 * semantic tokens as the page's (`bg`, `fg`, `border`, `brand.solid`), so
 * every section — and every card, button and link inside it — follows the
 * scheme without knowing it is in one.
 */
export function schemeCssVars(scheme: SchemeColors): Record<string, string> {
  const { background, text, button } = scheme
  return {
    '--chakra-colors-bg': background,
    '--chakra-colors-bg-subtle': mix(background, text, 0.05),
    '--chakra-colors-bg-panel': mix(background, text, 0.03),
    '--chakra-colors-bg-muted': mix(background, text, 0.1),
    '--chakra-colors-fg': text,
    '--chakra-colors-fg-muted': mix(text, background, 0.25),
    '--chakra-colors-fg-subtle': mix(text, background, 0.45),
    '--chakra-colors-fg-inverted': background,
    '--chakra-colors-border': mix(text, background, 0.75),
    '--chakra-colors-border-subtle': mix(text, background, 0.86),
    '--chakra-colors-border-emphasized': mix(text, background, 0.6),
    '--chakra-colors-brand-solid': button,
    '--chakra-colors-brand-contrast': readableOn(button),
    '--chakra-colors-brand-emphasized': mix(button, readableOn(button), 0.14),
    '--chakra-colors-brand-fg': contrastRatio(button, background) >= 3 ? button : text,
    '--chakra-colors-brand-muted': mix(button, background, 0.7),
    '--chakra-colors-brand-subtle': mix(button, background, 0.85),
    '--chakra-colors-brand-focus-ring': button,
  }
}

/**
 * The schemes whose text or buttons would be hard to read. Only a seller's
 * own colours can fail: derived schemes are readable by construction.
 */
export function schemeContrastIssues(settings: ThemeSettings): SchemeKey[] {
  return SCHEME_KEYS.filter((key) => {
    const own = settings.schemes[key]
    if (!own) return false
    return (
      contrastRatio(own.text, own.background) < MIN_CONTRAST ||
      contrastRatio(own.button, readableOn(own.button)) < 3
    )
  })
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
    `html.dark{${declarations(dark)}}` +
    effectCss(settings)
  )
}

/**
 * Storefront-only effect rules, as stylesheet text: underline sweeps for
 * links that opt in with `data-sweep`, and page transitions between
 * same-document navigations.
 *
 * Token-only and layout-free, like the variables above — and like them, safe
 * to inline. Page transitions ride the theme's motion choice: a theme with
 * motion off keeps instant navigations. Reduced motion always wins.
 */
export function effectCss(settings: ThemeSettings): string {
  const sweep =
    'a[data-sweep]{text-decoration:none;background-image:linear-gradient(currentColor,currentColor);' +
    'background-size:0% 1px;background-repeat:no-repeat;background-position:left calc(100% - 1px);' +
    'transition:background-size 260ms ease;}' +
    'a[data-sweep]:hover{background-size:100% 1px;}' +
    '@media (prefers-reduced-motion:reduce){a[data-sweep]{transition:none;}}'
  if (settings.animation === 'none') return sweep
  return (
    sweep +
    '@view-transition{navigation:auto;}' +
    '::view-transition-old(root){animation:pb-page-out 220ms ease both;}' +
    '::view-transition-new(root){animation:pb-page-in 300ms ease both;}' +
    '@keyframes pb-page-out{to{opacity:0;transform:translateY(8px);}}' +
    '@keyframes pb-page-in{from{opacity:0;transform:translateY(8px);}}' +
    '@media (prefers-reduced-motion:reduce){' +
    '::view-transition-old(root),::view-transition-new(root){animation:none;}}'
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
