import { describe, expect, test } from 'bun:test'

import {
  buildTemplateTheme,
  buildTemplateThemeJson,
  compileTheme,
  MAX_TEMPLATE_BUILD_BYTES,
  parseTemplateThemeBuild,
  TEMPLATE_BUILD_KIND,
} from '../src/template'

const FILES = {
  'layout/theme.tpl': `<main>{{ content_for_layout }}</main>`,
  'templates/index.tpl': `<h1>{{ shop.name }}</h1>`,
  'assets/theme.css': `.x { color: red }`,
}

describe('template theme builds', () => {
  test('wraps a compiled theme and round-trips through a theme row', () => {
    const theme = compileTheme(FILES)
    const build = buildTemplateTheme(theme, FILES, { name: 'My theme' })
    expect(build.kind).toBe(TEMPLATE_BUILD_KIND)
    expect(build.version).toBe(theme.version)
    expect(build.name).toBe('My theme')
    expect(build.source).toContain('__body_home')
    expect(build.files['templates/index.tpl']).toContain('shop.name')

    const parsed = parseTemplateThemeBuild(buildTemplateThemeJson(build))
    expect(parsed).not.toBeNull()
    expect(parsed!.version).toBe(theme.version)
    expect(parsed!.manifest.routes.home).toBeDefined()
    expect(parsed!.files).toEqual(FILES)
  })

  test('reads the JSON a row stores, and a parsed object alike', () => {
    const theme = compileTheme(FILES)
    const build = buildTemplateTheme(theme, FILES, { name: 'My theme' })
    expect(parseTemplateThemeBuild(build)?.version).toBe(theme.version)
    expect(parseTemplateThemeBuild(buildTemplateThemeJson(build))?.version).toBe(theme.version)
  })

  test('refuses anything that is not a bounded template build', () => {
    const theme = compileTheme(FILES)
    const build = buildTemplateTheme(theme, FILES, { name: 'My theme' })

    expect(parseTemplateThemeBuild('not json')).toBeNull()
    expect(parseTemplateThemeBuild('{"kind":"page","version":"x"}')).toBeNull()
    expect(parseTemplateThemeBuild({ ...build, kind: 'page-builder' })).toBeNull()
    expect(parseTemplateThemeBuild({ ...build, version: 'nope' })).toBeNull()
    expect(parseTemplateThemeBuild({ ...build, source: '' })).toBeNull()
    expect(
      parseTemplateThemeBuild({ ...build, source: 'x'.repeat(MAX_TEMPLATE_BUILD_BYTES + 1) }),
    ).toBeNull()
    expect(
      parseTemplateThemeBuild({ ...build, manifest: { ...build.manifest, version: 'other' } }),
    ).toBeNull()
    expect(parseTemplateThemeBuild({ ...build, files: { '../escape.tpl': 'x' } })).toBeNull()
    expect(parseTemplateThemeBuild({ ...build, files: { 'a.tpl': 1 } })).toBeNull()
    // A structured theme's JSON is not a template build.
    expect(
      parseTemplateThemeBuild({ version: 1, settings: {}, layout: {}, templates: {} }),
    ).toBeNull()
  })

  test('refuses to push a theme larger than a theme row holds', () => {
    const big = compileTheme(
      { 'templates/index.tpl': `<p>${'x'.repeat(MAX_TEMPLATE_BUILD_BYTES)}</p>` },
      { limits: { maxFileBytes: MAX_TEMPLATE_BUILD_BYTES + 1_000 } },
    )
    expect(() => buildTemplateTheme(big, {}, { name: 'Big' })).toThrow(/theme row holds/)
  })

  test('carries only warnings, never errors, in a build', () => {
    const theme = compileTheme({ 'templates/index.tpl': `<p>x</p>` })
    const build = buildTemplateTheme(theme, FILES, { name: 'Warnings only' })
    expect(build.diagnostics.every((diagnostic) => diagnostic.severity === 'warning')).toBe(true)
  })
})
