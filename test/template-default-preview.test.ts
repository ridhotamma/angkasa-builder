import { describe, expect, test } from 'bun:test'

import {
  buildTemplateTheme,
  compileTheme,
  defaultThemeFiles,
  parseTemplateThemeBuild,
  signThemePreview,
  verifyThemePreview,
} from '../src/template'

describe('the platform default theme', () => {
  test('compiles cleanly and draws every themeable route', () => {
    const theme = compileTheme(defaultThemeFiles())
    expect(theme.diagnostics.map((diagnostic) => diagnostic.message)).toEqual([])
    for (const route of [
      'home',
      'product',
      'catalog',
      'search',
      'page',
      'article',
      'blog',
      'orderTracking',
    ] as const) {
      expect(theme.manifest.routes[route]).toBeDefined()
    }
    // Every host slot the default templates call is a registered one.
    expect(theme.manifest.snippets).toEqual(['product-card'])
  })

  test('packs into a build a theme row can hold', () => {
    const files = defaultThemeFiles()
    const build = buildTemplateTheme(compileTheme(files), files, { name: 'Pesanle default' })
    expect(parseTemplateThemeBuild(JSON.stringify(build))?.version).toBe(build.version)
    expect(JSON.stringify(build).length).toBeLessThan(190_000)
  })
})

describe('theme preview links', () => {
  const secret = 'test-secret'
  const version = '0123456789abcdef'

  test('a signed value verifies for its shop and version only', async () => {
    const value = await signThemePreview(secret, 'my-shop', version)
    expect(value.startsWith(`${version}.`)).toBe(true)

    expect(await verifyThemePreview(secret, 'my-shop', value)).toBe(version)
    expect(await verifyThemePreview(secret, 'other-shop', value)).toBeNull()
    expect(await verifyThemePreview('other-secret', 'my-shop', value)).toBeNull()
    expect(
      await verifyThemePreview(secret, 'my-shop', `${'f'.repeat(16)}.${value.split('.')[1]}`),
    ).toBeNull()
  })

  test('malformed values are simply not a preview', async () => {
    expect(await verifyThemePreview(secret, 'my-shop', null)).toBeNull()
    expect(await verifyThemePreview(secret, 'my-shop', '')).toBeNull()
    expect(await verifyThemePreview(secret, 'my-shop', 'nope')).toBeNull()
    expect(await verifyThemePreview(secret, 'my-shop', `${version}.short`)).toBeNull()
    expect(
      await verifyThemePreview(secret, 'my-shop', `not-a-version.${'a'.repeat(43)}`),
    ).toBeNull()
  })
})
