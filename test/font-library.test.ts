import { describe, expect, test } from 'bun:test'

import { FEATURED_FONTS, FONT_OPTIONS, findFont, isFontFamily } from '../src/model/font-library'
import {
  DEFAULT_THEME_SETTINGS,
  designFontHref,
  designWeights,
  fontStack,
  googleFontsCssUrl,
  googleFontsHref,
  hasItalic,
  sanitizeThemeSettings,
  type ThemeSettings,
} from '../src/model/settings'

describe('font library', () => {
  test('holds hundreds of unique families, each with a real 400 weight', () => {
    expect(FONT_OPTIONS.length).toBeGreaterThanOrEqual(300)
    expect(new Set(FONT_OPTIONS.map((font) => font.family)).size).toBe(FONT_OPTIONS.length)

    for (const font of FONT_OPTIONS) {
      expect(font.weights.length).toBeGreaterThan(0)
      // The theme's body text is 400; a family without it is not usable.
      expect(font.weights).toContain(400)
      expect(['sans', 'serif', 'display', 'handwriting', 'monospace']).toContain(font.category)
      expect(['sans-serif', 'serif', 'monospace', 'cursive']).toContain(font.fallback)
    }
  })

  test('featured is a small shortlist inside the library', () => {
    expect(FEATURED_FONTS.length).toBeGreaterThan(20)
    expect(FEATURED_FONTS.length).toBeLessThan(80)
    for (const font of FEATURED_FONTS) expect(findFont(font.family)).not.toBeNull()
    expect(FEATURED_FONTS.some((font) => font.family === 'Inter')).toBe(true)
  })

  test('isFontFamily gates a stored value', () => {
    expect(isFontFamily('Inter')).toBe(true)
    expect(isFontFamily('Comic Sans')).toBe(false)
    expect(isFontFamily(42)).toBe(false)
  })
})

describe('googleFontsHref', () => {
  const withFonts = (heading: string, body: string): ThemeSettings => ({
    ...DEFAULT_THEME_SETTINGS,
    fonts: { heading, body },
  })

  test('requests only the chosen families, with their real weights', () => {
    const href = googleFontsHref(withFonts('Playfair Display', 'Lato'))
    expect(href).toContain('family=Playfair+Display:wght@400;500;600;700')
    expect(href).toContain('family=Lato:wght@400;700')
    expect(href).toContain('display=swap')
    // Never the whole library: one stylesheet, two families.
    expect(href).not.toContain('family=Inter')
  })

  test('dedupes heading and body, and skips an unknown family', () => {
    expect(googleFontsHref(withFonts('Inter', 'Inter')).match(/family=Inter/g)).toHaveLength(1)
    const unknown = googleFontsHref(withFonts('Nope Sans', 'Inter'))
    expect(unknown).not.toContain('Nope')
    expect(unknown).toContain('family=Inter')
  })

  test('fontStack falls back to Poppins for an unknown family', () => {
    expect(fontStack('Nope Sans')).toContain("'Poppins'")
    expect(fontStack('Lora')).toContain("'Lora'")
  })

  test('an unknown stored font sanitises to the default', () => {
    const clean = sanitizeThemeSettings({ fonts: { heading: 'Nope Sans', body: 'Inter' } })
    expect(clean.fonts).toEqual({ heading: 'Poppins', body: 'Inter' })
  })
})

describe('studio font faces', () => {
  test('the library records true italics and the heavier weights, never inventing one', () => {
    const poppins = findFont('Poppins')!
    expect(poppins.extraWeights).toEqual([300, 800, 900])
    expect(poppins.italics).toContain(400)
    // Bebas Neue ships one upright face and no italic at all.
    expect(findFont('Bebas Neue')!.italics).toBeUndefined()
    for (const font of FONT_OPTIONS) {
      for (const weight of [...(font.extraWeights ?? []), ...(font.italics ?? [])]) {
        expect([300, 400, 500, 600, 700, 800, 900]).toContain(weight)
      }
      // The theme's four never move: storefront stylesheets stay as they were.
      for (const weight of font.extraWeights ?? []) expect(font.weights).not.toContain(weight)
    }
  })

  test('designWeights and hasItalic read the library', () => {
    expect(designWeights('Poppins')).toEqual([300, 400, 500, 600, 700, 800, 900])
    expect(designWeights('Nope Sans')).toEqual([])
    expect(hasItalic('Playfair Display')).toBe(true)
    expect(hasItalic('Bebas Neue')).toBe(false)
  })

  test('uprights, italics or both, as sorted ital,wght tuples', () => {
    expect(designFontHref('Playfair Display', { upright: true, italic: false })).toBe(
      'family=Playfair+Display:wght@400;500;600;700;800;900',
    )
    expect(designFontHref('Playfair Display', { upright: false, italic: true })).toBe(
      'family=Playfair+Display:ital,wght@1,400;1,500;1,600;1,700;1,800;1,900',
    )
    expect(designFontHref('Lato', { upright: true, italic: true })).toBe(
      'family=Lato:ital,wght@0,300;0,400;0,700;0,900;1,300;1,400;1,700;1,900',
    )
  })

  test('a face the family lacks is never requested — Google would refuse the whole sheet', () => {
    expect(designFontHref('Bebas Neue', { upright: true, italic: true })).toBe(
      'family=Bebas+Neue:wght@400',
    )
    expect(designFontHref('Bebas Neue', { upright: false, italic: true })).toBeNull()
    expect(designFontHref('Nope Sans', { upright: true, italic: true })).toBeNull()
  })

  test('googleFontsCssUrl joins parts and skips the empty ones', () => {
    expect(googleFontsCssUrl([null])).toBeNull()
    expect(googleFontsCssUrl(['family=A:wght@400', null, 'family=B:wght@700'])).toBe(
      'https://fonts.googleapis.com/css2?family=A:wght@400&family=B:wght@700&display=swap',
    )
  })
})
