import { describe, expect, test } from 'bun:test'

import {
  applyLook,
  applyPalette,
  findFontPair,
  findLook,
  findPalette,
  FONT_PAIRS,
  LOOKS,
  PALETTES,
  searchLooks,
  searchPalettes,
} from '../src/model/looks'
import {
  contrastIssues,
  DEFAULT_THEME_SETTINGS,
  FONT_OPTIONS,
  sanitizeThemeSettings,
  schemeContrastIssues,
  type ThemeSettings,
} from '../src/model/settings'

describe('looks & palettes library', () => {
  test('all font pairings use fonts available in FONT_OPTIONS', () => {
    const families = new Set(FONT_OPTIONS.map((f) => f.family))
    for (const pair of FONT_PAIRS) {
      expect(families.has(pair.heading)).toBe(true)
      expect(families.has(pair.body)).toBe(true)
    }
  })

  test('every curated palette passes WCAG text and brand contrast checks', () => {
    for (const palette of PALETTES) {
      const settings: ThemeSettings = {
        ...DEFAULT_THEME_SETTINGS,
        colors: palette.colors,
        schemes: palette.schemes ?? {},
      }

      // Check text contrast (must be >= 4.5:1 on background)
      const issues = contrastIssues(settings)
      expect(issues).toEqual([])

      // Check scheme contrast
      const schemeIssues = schemeContrastIssues(settings)
      expect(schemeIssues).toEqual([])
    }
  })

  test('every look references an existing palette and font pair', () => {
    for (const look of LOOKS) {
      const palette = findPalette(look.palette)
      expect(palette).toBeDefined()
      expect(palette.key).toBe(look.palette)

      const fontPair = findFontPair(look.fontPair)
      expect(fontPair).toBeDefined()
      expect(fontPair.key).toBe(look.fontPair)
    }
  })

  test('applyLook applies palette, typography, shape and motion without corrupting settings', () => {
    for (const look of LOOKS) {
      const applied = applyLook(DEFAULT_THEME_SETTINGS, look)
      const sanitized = sanitizeThemeSettings(applied)

      expect(sanitized.fonts.heading).toBe(findFontPair(look.fontPair).heading)
      expect(sanitized.fonts.body).toBe(findFontPair(look.fontPair).body)
      expect(sanitized.radius).toBe(look.radius)
      expect(sanitized.buttonStyle).toBe(look.buttonStyle)
      expect(sanitized.cardStyle).toBe(look.cardStyle)
      expect(sanitized.animation).toBe(look.animation)
      expect(contrastIssues(sanitized)).toEqual([])
    }
  })

  test('applyPalette swaps colours while preserving typography and shape', () => {
    const original: ThemeSettings = {
      ...DEFAULT_THEME_SETTINGS,
      fonts: { heading: 'Playfair Display', body: 'Manrope' },
      radius: 'lg',
    }
    const palette = findPalette('forest-oat')
    const result = applyPalette(original, palette)

    expect(result.colors).toEqual(palette.colors)
    expect(result.fonts.heading).toBe('Playfair Display')
    expect(result.fonts.body).toBe('Manrope')
    expect(result.radius).toBe('lg')
  })

  test('searchLooks finds looks by Indonesian and English mood keywords', () => {
    expect(searchLooks('hangat').some((l) => l.key === 'warm-organic')).toBe(true)
    expect(searchLooks('warm').some((l) => l.key === 'warm-organic')).toBe(true)
    expect(searchLooks('mewah').some((l) => l.key === 'luxury-boutique')).toBe(true)
    expect(searchLooks('luxury').some((l) => l.key === 'luxury-boutique')).toBe(true)
    expect(searchLooks('minimal').some((l) => l.key === 'minimal')).toBe(true)
    expect(searchLooks('berani').some((l) => l.key === 'bold-maximal' || l.key === 'neo-brutalist')).toBe(true)
  })

  test('searchPalettes finds palettes by name or tag', () => {
    const natural = searchPalettes('natural')
    expect(natural.length).toBeGreaterThan(0)
    expect(natural.some((p) => p.key === 'forest-oat' || p.key === 'sage-bone')).toBe(true)
  })

})
