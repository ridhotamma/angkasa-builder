import { describe, expect, test } from 'bun:test'
import { createElement, Fragment, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { compileSectionSchema } from '../src/template'
import {
  activateTheme,
  buildTemplateScope,
  compileTheme,
  contentHash,
  createTemplateRuntime,
  hasErrors,
  type TemplateH,
  type TemplateScope,
} from '../src/template'
import { sanitizeValues } from '../src'
import { sampleStorefrontData } from '../src/render'
import { renderTheme, testEnvironment } from './template-harness'

const HERO = `<section class="hero"><p class="note">Free shipping</p><h1>{{ section.settings.heading }}</h1></section>{% schema %}{"name":"Hero","settings":[{"key":"heading","kind":"text","max":80,"default":"Hello"}]}{% endschema %}`

describe('theme compiler', () => {
  test('composes the layout around a route and renders snippets', () => {
    const { html } = renderTheme({
      'layout/theme.tpl': `<div id="shell"><header>{{ shop.name }}</header><main>{{ content_for_layout }}</main></div>`,
      'templates/index.tpl': `<h1>{{ page.title }}</h1>{% render 'price', product: latest[0] %}`,
      'snippets/price.tpl': `<span class="price">{{ product.price | money }}</span>`,
    })
    expect(html).toContain('id="shell"')
    expect(html).toContain('<header>Test shop</header>')
    expect(html).toContain('<h1>Test shop</h1>')
    expect(html).toContain('<span class="price">IDR 125000</span>')
  })

  test('renders a route without a layout as-is', () => {
    const { html } = renderTheme({ 'templates/index.tpl': `<p>plain</p>` })
    expect(html).toBe('<p>plain</p>')
  })

  test('exposes the layout separately, for a shell that owns every page', () => {
    const env = testEnvironment()
    const runtime = createTemplateRuntime(createElement as unknown as TemplateH, env, Fragment)
    const theme = activateTheme(
      compileTheme({
        'layout/theme.tpl': `<div id="shell">{{ content_for_layout }}</div>`,
        'templates/index.tpl': `<h1>Home</h1>`,
      }),
      runtime,
    )
    const scope = buildTemplateScope({ data: env.data, env })

    const body = theme.renderTemplate('home', scope)
    expect(renderToStaticMarkup(body as ReactNode)).toBe('<h1>Home</h1>')

    const wrapped = theme.renderLayout(scope, () => body)
    expect(renderToStaticMarkup(wrapped as ReactNode)).toBe('<div id="shell"><h1>Home</h1></div>')

    // A theme without a layout hands the body back unchanged.
    const bare = activateTheme(compileTheme({ 'templates/index.tpl': `<p>x</p>` }), runtime)
    expect(renderToStaticMarkup(bare.renderLayout(scope, () => body) as ReactNode)).toBe(
      '<h1>Home</h1>',
    )
    expect(bare.renderTemplate('product', scope)).toBeNull()
  })

  test('theme-authored pages draw their own slugs', () => {
    const env = testEnvironment()
    const runtime = createTemplateRuntime(createElement as unknown as TemplateH, env, Fragment)
    const files = {
      'templates/index.tpl': `<p>home</p>`,
      'templates/pages/about.tpl': `<h1>{{ page.title }}</h1><p>Our story</p>`,
    }
    const theme = compileTheme(files)
    expect(theme.manifest.pages.about).toBeDefined()
    expect(theme.manifest.pages.about?.uses).toContain('page')

    const activated = activateTheme(theme, runtime)
    const scope = buildTemplateScope({
      data: { ...env.data, page: { title: 'About us' } },
      env,
      route: 'page',
    })
    expect(renderToStaticMarkup(activated.renderPage('about', scope) as ReactNode)).toBe(
      '<h1>About us</h1><p>Our story</p>',
    )
    expect(activated.renderPage('nope', scope)).toBeNull()
  })

  test('a custom page template wraps the seller’s own content in a slot', () => {
    const base = sampleStorefrontData('Page shop')
    const { html } = renderTheme(
      {
        'layout/theme.tpl': `<main>{{ content_for_layout }}</main>`,
        'templates/index.tpl': `<p>home</p>`,
        'templates/page.tpl': `<h1>{{ page.title }}</h1><div class="body">{% slot 'pageBody' %}</div>`,
      },
      {
        route: 'page',
        env: {
          data: { ...base, page: { title: 'Tentang kami' } },
          slots: { pageBody: createElement('p', null, 'Seller content') },
        },
      },
    )
    expect(html).toContain('<main>')
    expect(html).toContain('<h1>Tentang kami</h1>')
    expect(html).toContain('<div class="body"><p>Seller content</p></div>')
  })

  test('a missing route template is a warning, and rendering it returns null', () => {
    const theme = compileTheme({ 'templates/index.tpl': `<p>x</p>` })
    expect(hasErrors(theme.diagnostics)).toBe(false)
    expect(
      theme.diagnostics.every((diagnostic) => diagnostic.code === 'missing-route-template'),
    ).toBe(true)
    const env = testEnvironment()
    const activated = activateTheme(
      theme,
      createTemplateRuntime(createElement as unknown as TemplateH, env, Fragment),
    )
    const scope = buildTemplateScope({ data: env.data, env })
    expect(activated.renderRoute('product', scope)).toBeNull()
    expect(activated.renderSection('hero', scope)).toBeNull()
  })

  test('routes may name the page kind and product pages read their drop', () => {
    const { html } = renderTheme(
      {
        'templates/product.tpl': `<h1>{{ product.title }}</h1><p>{{ product.price | money }}</p>`,
      },
      { route: 'product' },
    )
    expect(html).toContain('<h1>Signature tote</h1>')
    expect(html).toContain('IDR 125000')
  })

  test('compiles a section schema into the editor shape, with defaults', () => {
    const theme = compileTheme({
      'templates/index.tpl': `<p>x</p>`,
      'sections/hero.tpl': HERO,
    })
    expect(hasErrors(theme.diagnostics)).toBe(false)
    const schema = theme.manifest.sections.hero!.schema!
    expect(schema.type).toBe('hero')
    expect(schema.name.en).toBe('Hero')
    expect(schema.fields).toHaveLength(1)
    expect(schema.fields[0]).toMatchObject({ kind: 'text', key: 'heading', max: 80 })

    const compiled = compileSectionSchema(
      `{"settings":[{"key":"heading","kind":"text","default":"Hi"}]}`,
      {
        type: 'hero',
      },
    )
    expect(compiled.compiled!.defaults).toEqual({ heading: 'Hi' })
  })

  test('the compiled schema sanitises stored settings, defaults included', () => {
    const theme = compileTheme({
      'templates/index.tpl': `<p>x</p>`,
      'sections/hero.tpl': HERO,
    })
    const schema = theme.manifest.sections.hero!.schema!
    expect(sanitizeValues(schema.fields, { heading: 'From the seller', nope: 'dropped' })).toEqual({
      heading: 'From the seller',
    })
    expect(sanitizeValues(schema.fields, {})).toEqual({ heading: 'Hello' })
    expect(sanitizeValues(schema.fields, null)).toEqual({ heading: 'Hello' })
  })

  test('a compiled section renders from its settings and hoists static markup', () => {
    const env = testEnvironment()
    const theme = compileTheme({
      'templates/index.tpl': `<p>x</p>`,
      'sections/hero.tpl': HERO,
    })
    expect(hasErrors(theme.diagnostics)).toBe(false)
    const activated = activateTheme(
      theme,
      createTemplateRuntime(createElement as unknown as TemplateH, env, Fragment),
    )
    const scope = (heading: string): TemplateScope =>
      buildTemplateScope({
        data: env.data,
        env,
        section: { id: 's1', settings: { heading } },
      })

    const first = activated.renderSection('hero', scope('First')) as {
      props: { children: ReactNode[] }
    }
    const second = activated.renderSection('hero', scope('Second')) as {
      props: { children: ReactNode[] }
    }
    expect(renderToStaticMarkup(first as ReactNode)).toContain('<h1>First</h1>')
    expect(renderToStaticMarkup(second as ReactNode)).toContain('<h1>Second</h1>')
    // The static <p> is one hoisted constant: the same React element object on
    // every render, while the dynamic heading is rebuilt.
    expect(first.props.children[0]).toBe(second.props.children[0])
    expect(first.props.children[1]).not.toBe(second.props.children[1])
    expect(theme.manifest.hoisted).toBeGreaterThan(0)
  })

  test('infers the drops each route needs, through snippets', () => {
    const theme = compileTheme({
      'templates/index.tpl': `{% render 'shelf', collection: collections[0] %}`,
      'templates/product.tpl': `<h1>{{ product.title }}</h1>{% render 'shelf', collection: collection %}`,
      'snippets/shelf.tpl': `{% for p in collection.products limit: 4 %}{{ p.name | upcase }}{% endfor %}{{ shop.name }}`,
    })
    expect(hasErrors(theme.diagnostics)).toBe(false)
    expect(theme.manifest.routes.home?.uses.sort()).toEqual(['collections', 'shop'])
    expect(theme.manifest.routes.product?.uses.sort()).toEqual(['collection', 'product', 'shop'])
    expect(theme.manifest.snippets).toEqual(['shelf'])
  })

  test("a route's drop list includes the layout's drops", () => {
    const theme = compileTheme({
      'layout/theme.tpl': `<header>{{ shop.name }} {{ routes.home }}</header>{{ content_for_layout }}`,
      'templates/index.tpl': `<h1>{{ page.title }}</h1>`,
    })
    expect(hasErrors(theme.diagnostics)).toBe(false)
    expect(theme.manifest.routes.home?.uses.sort()).toEqual(['page', 'routes', 'shop'])
  })

  test('quotes, backticks and template syntax in text survive codegen', () => {
    const source = `<p data-note='say "hi"'>a 'quote', a "quote", a \`tick\`, \${not-a-template}</p>`
    const { html } = renderTheme({ 'templates/index.tpl': source })
    expect(html).toContain('&#x27;quote&#x27;')
    expect(html).toContain('`tick`')
    expect(html).toContain('${not-a-template}')
    expect(html).toContain('data-note="say &quot;hi&quot;"')
  })

  test('the version is content-addressed and changes with any file', () => {
    const base = {
      'templates/index.tpl': `<p>v1</p>`,
      'assets/theme.css': `.hero { color: red }`,
    }
    const one = compileTheme(base)
    const two = compileTheme({ ...base })
    const three = compileTheme({ ...base, 'templates/index.tpl': `<p>v2</p>` })
    const four = compileTheme({ ...base, 'assets/theme.css': `.hero { color: blue }` })
    expect(one.version).toBe(two.version)
    expect(one.version).not.toBe(three.version)
    expect(one.version).not.toBe(four.version)
    expect(contentHash('abc')).toBe(contentHash('abc'))
    expect(contentHash('abc')).not.toBe(contentHash('abd'))
    expect(one.manifest.assets).toEqual(['assets/theme.css'])
  })

  test('bounds a theme that is too big', () => {
    const big = compileTheme(
      {
        'templates/index.tpl': 'x'.repeat(200),
      },
      { limits: { maxFileBytes: 100 } },
    )
    expect(big.diagnostics.some((diagnostic) => diagnostic.code === 'file-too-large')).toBe(true)

    const many = compileTheme(
      Object.fromEntries(
        Array.from({ length: 5 }, (_, index) => [`templates/page-${index}.tpl`, 'x']),
      ),
      { limits: { maxFiles: 2 } },
    )
    expect(many.diagnostics.some((diagnostic) => diagnostic.code === 'too-many-files')).toBe(true)
  })

  test('refuses to activate a theme with errors', () => {
    const theme = compileTheme({
      'templates/index.tpl': `{{ shop.nope }}`,
    })
    expect(hasErrors(theme.diagnostics)).toBe(true)
    const env = testEnvironment()
    expect(() =>
      activateTheme(
        theme,
        createTemplateRuntime(createElement as unknown as TemplateH, env, Fragment),
      ),
    ).toThrow(/compile errors/)
  })

  test('for-else, ranges and snippet arguments inside snippets', () => {
    const { html } = renderTheme({
      'templates/index.tpl': `{% render 'list', items: products %}`,
      'snippets/list.tpl': `{% for item in items %}{{ forloop.index }}{% else %}empty{% endfor %}{% for i in (1..2) %}{{ i }}{% endfor %}`,
    })
    expect(html).toContain('empty')
    expect(html).toContain('12')
  })

  test('the layout sees snippets and route templates do not see content_for_layout', () => {
    const theme = compileTheme({
      'layout/theme.tpl': `{% render 'chrome' %}{{ content_for_layout }}`,
      'snippets/chrome.tpl': `<nav>{{ shop.name }}</nav>`,
      'templates/index.tpl': `{{ content_for_layout }}`,
    })
    const found = theme.diagnostics.map((diagnostic) => diagnostic.code)
    expect(found).toContain('content-for-layout-outside-layout')
  })
})
