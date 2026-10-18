import { describe, expect, test } from 'bun:test'

import { checkTemplate, compileTheme, parseTemplate, type Diagnostic } from '../src/template'

function check(source: string, options: Parameters<typeof checkTemplate>[1] = {}): Diagnostic[] {
  const parsed = parseTemplate(source, { file: 'x.tpl' })
  return [...parsed.diagnostics, ...checkTemplate(parsed.nodes, options).diagnostics]
}

function messages(diagnostics: readonly Diagnostic[]): string[] {
  return diagnostics.map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`)
}

describe('template checker', () => {
  test('accepts a well-formed template and reports the drops it reads', () => {
    const parsed = parseTemplate(
      `<h1>{{ shop.name }}</h1>{% for p in latest limit: 2 %}{{ p.name | upcase }}{% endfor %}`,
      { file: 'x.tpl' },
    )
    const result = checkTemplate(parsed.nodes, { file: 'x.tpl' })
    expect(result.diagnostics).toEqual([])
    expect(result.uses).toEqual(['shop', 'latest'])
  })

  test('suggests a filter for a near miss, and names the argument count', () => {
    expect(messages(check(`{{ shop.name | upcse }}`))).toEqual([
      expect.stringContaining('unknown-filter'),
    ])
    expect(messages(check(`{{ shop.name | upcse }}`))[0]).toContain('upcase')
    expect(messages(check(`{{ shop.name | append }}`))[0]).toContain('takes 1 argument')
    expect(messages(check(`{{ shop.name | upcase: 1 }}`))[0]).toContain('takes 0 arguments')
  })

  test('refuses an unknown property with a suggestion', () => {
    const found = messages(check(`{{ shop.nmae }}`))
    expect(found[0]).toContain('unknown-property')
    expect(found[0]).toContain('name')
    expect(messages(check(`{{ product.nope }}`))[0]).toContain('unknown-property')
  })

  test('refuses an unknown root name', () => {
    const found = messages(check(`{{ produc.title }}`))
    expect(found[0]).toContain('unknown-variable')
    expect(found[0]).toContain('product')
  })

  test('knows lists, their items and their pseudo-properties', () => {
    expect(check(`{{ latest.first.name }}{{ latest.size }}{{ latest | size }}`)).toEqual([])
    expect(messages(check(`{% for p in shop %}{{ p }}{% endfor %}`))[0]).toContain('not-a-list')
    expect(messages(check(`{{ latest.nope }}`))[0]).toContain('unknown-property')
    // The loop variable is typed by the list's items.
    expect(messages(check(`{% for p in latest %}{{ p.nope }}{% endfor %}`))[0]).toContain(
      'unknown-property',
    )
  })

  test('content_for_layout is only legal in the layout shell', () => {
    expect(messages(check(`{{ content_for_layout }}`))[0]).toContain(
      'content-for-layout-outside-layout',
    )
    const parsed = parseTemplate(`<main>{{ content_for_layout }}</main>`, {
      file: 'layout/theme.tpl',
    })
    expect(
      checkTemplate(parsed.nodes, { file: 'layout/theme.tpl', isLayout: true }).diagnostics,
    ).toEqual([])
  })

  test('narrows section.settings with the compiled {% schema %}', () => {
    const files = {
      'templates/index.tpl': `<h1>{{ shop.name }}</h1>`,
      'sections/hero.tpl': `<h1>{{ section.settings.heading }}</h1>{{ section.settings.nope }}{% schema %}{"settings":[{"key":"heading","kind":"text","max":80}]}{% endschema %}`,
    }
    const theme = compileTheme(files)
    const found = messages(theme.diagnostics)
    expect(found.some((message) => message.includes('unknown-property'))).toBe(true)
    expect(found.some((message) => message.includes('"nope"'))).toBe(true)
  })

  test('reports a missing snippet at its call site', () => {
    const theme = compileTheme({
      'templates/index.tpl': `{% render 'missing', product: latest[0] %}`,
    })
    expect(messages(theme.diagnostics).some((message) => message.includes('unknown-snippet'))).toBe(
      true,
    )
  })

  test('a snippet sees its arguments, typed by the drop of the same name', () => {
    const theme = compileTheme({
      'templates/index.tpl': `{% render 'price', product: latest[0] %}`,
      'snippets/price.tpl': `<p>{{ product.title }} {{ product.nope }}</p>`,
    })
    const found = messages(theme.diagnostics)
    expect(found.some((message) => message.includes('unknown-property'))).toBe(true)
    expect(found.some((message) => message.includes('unknown-variable'))).toBe(false)
  })

  test('an argument the snippet never declares is still visible as a name', () => {
    const theme = compileTheme({
      'templates/index.tpl': `{% render 'note', heading: shop.name, tone: 'dark' %}`,
      'snippets/note.tpl': `<p class="{{ tone }}">{{ heading }}</p>`,
    })
    expect(messages(theme.diagnostics).filter((message) => message.includes('unknown'))).toEqual([])
  })

  test('rejects a comparison typo and an empty if', () => {
    expect(messages(check(`{% if shop.name = 'x' %}a{% endif %}`))[0]).toContain(
      'invalid-expression',
    )
  })

  test('collects uses through snippets, for one-batch loading', () => {
    const theme = compileTheme({
      'templates/index.tpl': `{% render 'card', product: product %}`,
      'snippets/card.tpl': `<a href="{{ shop.url }}">{{ product.title }}</a>`,
    })
    expect(theme.manifest.routes.home?.uses.sort()).toEqual(['product', 'shop'])
  })

  test('validates the schema itself', () => {
    const bad = compileTheme({
      'templates/index.tpl': `<h1>x</h1>`,
      'sections/bad.tpl': `{% schema %}{"settings":[{"key":"Bad Key","kind":"text"}]}{% endschema %}`,
    })
    expect(messages(bad.diagnostics).some((message) => message.includes('invalid key'))).toBe(true)

    const json = compileTheme({
      'templates/index.tpl': `<h1>x</h1>`,
      'sections/bad.tpl': `{% schema %}{oops{% endschema %}`,
    })
    expect(messages(json.diagnostics).some((message) => message.includes('not valid JSON'))).toBe(
      true,
    )

    const kind = compileTheme({
      'templates/index.tpl': `<h1>x</h1>`,
      'sections/bad.tpl': `{% schema %}{"settings":[{"key":"x","kind":"wizard"}]}{% endschema %}`,
    })
    expect(messages(kind.diagnostics).some((message) => message.includes('unknown kind'))).toBe(
      true,
    )
  })
})
