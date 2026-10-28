import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import { renderToString } from 'react-dom/server'

import { LocaleProvider } from '../src/locale'
import { system } from '../src/ui'

import {
  DEFAULT_POPUP,
  DEFAULT_THEME_SETTINGS,
  sanitizeThemeSettings,
  type ThemeSettings,
} from '../src/index'
import { SitePopup } from '../src/render/index'

function render(settings: ThemeSettings, replay = false): string {
  return renderToString(
    <ChakraProvider value={system}>
      <LocaleProvider locale="en">
        <SitePopup settings={settings} replay={replay} />
      </LocaleProvider>
    </ChakraProvider>,
  )
}

describe('popup settings', () => {
  test('default off, lenient per field', () => {
    expect(sanitizeThemeSettings({}).popup).toEqual(DEFAULT_POPUP)
    const settings = sanitizeThemeSettings({
      popup: { kind: 'nonsense', title: 'Hello', delaySeconds: 900 },
    })
    expect(settings.popup).toEqual({ ...DEFAULT_POPUP, title: 'Hello' })
    const kept = sanitizeThemeSettings({
      popup: { ...DEFAULT_POPUP, kind: 'exit', oncePerSession: false },
    })
    expect(kept.popup).toEqual({ ...DEFAULT_POPUP, kind: 'exit', oncePerSession: false })
  })
})

describe('the site popup', () => {
  test('renders nothing when off', () => {
    expect(render(DEFAULT_THEME_SETTINGS)).not.toContain('data-popup')
  })

  test('the cookie notice is in the server HTML, so no-JS still sees it', () => {
    const settings: ThemeSettings = {
      ...DEFAULT_THEME_SETTINGS,
      popup: { ...DEFAULT_POPUP, kind: 'cookie', body: 'We use cookies.', buttonLabel: 'Got it' },
    }
    const html = render(settings)
    expect(html).toContain('data-popup="cookie"')
    expect(html).toContain('We use cookies.')
    expect(html).toContain('Got it')
  })

  test('the age gate and welcome offer are modals with their words', () => {
    for (const kind of ['age', 'welcome'] as const) {
      const settings: ThemeSettings = {
        ...DEFAULT_THEME_SETTINGS,
        popup: { ...DEFAULT_POPUP, kind, title: 'Are you 18?', body: 'Please confirm.' },
      }
      const html = render(settings, true)
      expect(html, kind).toContain(`data-popup="${kind}"`)
      expect(html, kind).toContain('Are you 18?')
      expect(html, kind).toContain('Please confirm.')
    }
  })
})
