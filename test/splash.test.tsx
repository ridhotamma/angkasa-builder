import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import { renderToString } from 'react-dom/server'

import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

import {
  DEFAULT_SPLASH,
  DEFAULT_THEME_SETTINGS,
  sanitizeThemeSettings,
  type ThemeSettings,
} from '../src/index'
import { SplashScreen } from '../src/render/index'

const SHOP = { name: 'Kopi Kita', logoUrl: null }

function render(settings: ThemeSettings): string {
  return renderToString(
    <ChakraProvider value={system}>
      <I18nProvider locale="en" resources={{}}>
        <SplashScreen settings={settings} shop={SHOP} />
      </I18nProvider>
    </ChakraProvider>,
  )
}

describe('splash settings', () => {
  test('default off, and unknown values fall back safely', () => {
    expect(sanitizeThemeSettings({}).splash).toEqual(DEFAULT_SPLASH)
    const settings = sanitizeThemeSettings({
      splash: { enabled: true, style: 'warp', tone: 'neon', showName: false },
    })
    // Invalid fields fall back one by one; the valid ones survive.
    expect(settings.splash).toEqual({ ...DEFAULT_SPLASH, enabled: true, showName: false })
    const kept = sanitizeThemeSettings({
      splash: { ...DEFAULT_SPLASH, enabled: true, style: 'ink' },
    })
    expect(kept.splash).toEqual({ ...DEFAULT_SPLASH, enabled: true, style: 'ink' })
  })
})

describe('the splash screen', () => {
  test('renders nothing while disabled', () => {
    expect(render(DEFAULT_THEME_SETTINGS)).not.toContain('data-splash')
  })

  test('draws the shop name, its exit keyframes and the page tone', () => {
    const settings: ThemeSettings = {
      ...DEFAULT_THEME_SETTINGS,
      splash: { ...DEFAULT_SPLASH, enabled: true, style: 'slide-up' },
    }
    const html = render(settings)
    expect(html).toContain('data-splash')
    expect(html).toContain('Kopi Kita')
    expect(html).toContain('pb-splash-up')
    expect(html).toContain('prefers-reduced-motion')
  })

  test('a dark or brand backdrop carries the scheme colours', () => {
    const dark: ThemeSettings = {
      ...DEFAULT_THEME_SETTINGS,
      splash: { ...DEFAULT_SPLASH, enabled: true, tone: 'dark' },
    }
    const html = render(dark)
    expect(html).toContain('--chakra-colors-bg')
    expect(html).toContain('data-splash')
  })
})
