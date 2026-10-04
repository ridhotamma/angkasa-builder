import { describe, expect, test } from 'bun:test'

import { FEATURED_FONTS, FONT_OPTIONS, findFont, isFontFamily } from '../src/model/font-library'
import {
  DEFAULT_THEME_SETTINGS,
  fontStack,
  googleFontsHref,
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
