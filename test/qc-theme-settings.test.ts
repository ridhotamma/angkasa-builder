/**
 * A Quick Checkout store's look on the storefront's own screens: the Quick
 * Checkout page's colours, fonts and shape, as theme settings.
 */

import { describe, expect, test } from 'bun:test'

import { contrastRatio } from '../src/model/settings'
import { findQcTheme, qcThemeSettings, type QcStyle } from '../src/quick-checkout/model'

function style(id: Parameters<typeof findQcTheme>[0]): QcStyle {
  return { theme: id, ...findQcTheme(id).style } as QcStyle
}

describe('qcThemeSettings', () => {
  test('the Bold page becomes a bold theme in its own colours', () => {
    const settings = qcThemeSettings(style('brutal'))
    expect(settings.colors.background).toBe('#fff4d6')
    expect(settings.colors.brand).toBe('#ff5c39')
    expect(settings.buttonStyle).toBe('hard')
    expect(settings.cardStyle).toBe('hard')
    expect(settings.fonts.heading).toBe('Space Grotesk')
  })

  test('a capsule page gets pill buttons', () => {
    const base = style('clean')
    expect(qcThemeSettings({ ...base, radius: 'full', buttonStyle: 'solid' }).buttonStyle).toBe(
      'pill',
    )
  })

  test('every preset reads: its text passes on its background', () => {
    for (const id of [
      'clean',
      'midnight',
      'sunset',
      'blush',
      'forest',
      'brutal',
      'ocean',
      'kopi',
    ] as const) {
      const { colors } = qcThemeSettings(style(id))
      expect(contrastRatio(colors.text, colors.background), id).toBeGreaterThanOrEqual(4.5)
    }
  })

  test('motion, the splash and the popup stay off', () => {
    const settings = qcThemeSettings(style('sunset'))
    expect(settings.animation).toBe('none')
    expect(settings.splash.enabled).toBe(false)
    expect(settings.popup.kind).toBe('none')
  })
})
