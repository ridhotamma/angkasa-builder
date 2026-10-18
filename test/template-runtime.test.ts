import { describe, expect, test } from 'bun:test'

import { createElement } from 'react'

import {
  activateTheme,
  activateThemeFactory,
  compileTheme,
  createTemplateRuntime,
  TEMPLATE_FRAGMENT,
  type ThemeModuleFactory,
} from '../src/template'
import { buildTemplateScope, dropNames } from '../src/template'
import { renderTemplate, testEnvironment } from './template-harness'

function runtime(overrides = {}) {
  return createTemplateRuntime((() => null) as never, testEnvironment(overrides), TEMPLATE_FRAGMENT)
}

describe('expressions and filters', () => {
  test('prints values, escapes text and nests elements', () => {
    expect(renderTemplate(`<h1>{{ shop.name }}</h1>`)).toBe('<h1>Test shop</h1>')
    expect(renderTemplate(`<p>{{ '<b>' }}</p>`)).toBe('<p>&lt;b&gt;</p>')
  })

  test('reads properties, indexes and list pseudo-properties', () => {
    expect(renderTemplate(`{{ latest[0].name }}`)).toContain('Signature tote')
    expect(renderTemplate(`{{ latest[1].name }}`)).toContain('Everyday tee')
    expect(renderTemplate(`{{ latest.first.name }}`)).toContain('Signature tote')
    expect(renderTemplate(`{{ latest.size }}`)).toBe(String(24))
    expect(renderTemplate(`{{ latest.last.slug }}`)).toContain('sample-29')
  })

  test('uses Liquid truthiness: only nil and false are falsy', () => {
    expect(renderTemplate(`{% if '' %}empty-is-truthy{% endif %}`)).toBe('empty-is-truthy')
    expect(renderTemplate(`{% if 0 %}zero-is-truthy{% endif %}`)).toBe('zero-is-truthy')
    expect(renderTemplate(`{% if false %}no{% else %}yes{% endif %}`)).toBe('yes')
    expect(renderTemplate(`{% if product %}no{% else %}yes{% endif %}`)).toBe('yes')
  })

  test('compares, negates and joins conditions', () => {
    expect(renderTemplate(`{% if shop.name contains 'Test' %}yes{% endif %}`)).toBe('yes')
    expect(renderTemplate(`{% if latest.size > 3 and latest.size < 100 %}yes{% endif %}`)).toBe(
      'yes',
    )
    expect(renderTemplate(`{% if not (latest.size == 0) %}yes{% endif %}`)).toBe('yes')
    expect(renderTemplate(`{% if shop.description != blank %}has{% endif %}`)).toBe('has')
    expect(renderTemplate(`{% unless shop.description == blank %}unless{% endunless %}`)).toBe(
      'unless',
    )
  })

  test('handles elsif chains and else branches', () => {
    const source = `{% if latest.size > 100 %}big{% elsif latest.size > 10 %}many{% else %}few{% endif %}`
    expect(renderTemplate(source)).toBe('many')
  })

  test('loops with forloop, limit, offset and reversed', () => {
    expect(
      renderTemplate(`{% for p in latest limit: 2 %}{{ forloop.index }}:{{ p.name }};{% endfor %}`),
    ).toContain('1:Signature tote;2:Everyday tee;')
    expect(
      renderTemplate(`{% for p in latest offset: 2 limit: 1 %}{{ p.name }}{% endfor %}`),
    ).toContain('Canvas cap')
    expect(
      renderTemplate(`{% for p in latest limit: 2 reversed %}{{ p.name }};{% endfor %}`),
    ).toContain('Everyday tee;Signature tote;')
    expect(
      renderTemplate(
        `{% for p in latest limit: 1 %}{{ forloop.first }}/{{ forloop.last }}/{{ forloop.length }}{% endfor %}`,
      ),
    ).toBe('true/true/1')
  })

  test('loops over ranges and empty lists', () => {
    expect(renderTemplate(`{% for i in (1..3) %}{{ i }}{% endfor %}`)).toBe('123')
    expect(renderTemplate(`{% for p in products %}{{ p.name }}{% else %}none{% endfor %}`)).toBe(
      'none',
    )
  })

  test('filters: string, list and number', () => {
    expect(renderTemplate(`{{ 'hello world' | upcase }}`)).toBe('HELLO WORLD')
    expect(renderTemplate(`{{ shop.name | append: '!' }}`)).toBe('Test shop!')
    expect(renderTemplate(`{{ shop.name | handleize }}`)).toBe('test-shop')
    expect(renderTemplate(`{{ latest | where: 'on_sale' | size }}`)).toBe('4')
    expect(renderTemplate(`{{ latest | map: 'slug' | first }}`)).toContain('sample-6')
    expect(renderTemplate(`{{ latest | first | json }}`)).toContain(
      '&quot;name&quot;:&quot;Signature tote&quot;',
    )
    expect(renderTemplate(`{{ 2 | times: 3 | plus: 1 }}`)).toBe('7')
    expect(renderTemplate(`{{ 5 | divided_by: 0 }}`)).toBe('0')
    expect(renderTemplate(`{{ 3.14159 | round: 2 }}`)).toBe('3.14')
    expect(renderTemplate(`{{ 'a,b,c' | split: ',' | join: ' + ' }}`)).toBe('a + b + c')
  })

  test('default and blank-aware fallbacks', () => {
    expect(renderTemplate(`{{ section.settings.subheading | default: 'Fallback' }}`)).toBe(
      'Fallback',
    )
    expect(
      renderTemplate(`{{ section.settings.heading | default: 'Fallback' }}`, {
        scope: { section: { id: 's1', settings: { heading: 'Real' } } },
      }),
    ).toBe('Real')
  })

  test('money uses the environment formatter and shop currency', () => {
    expect(renderTemplate(`{{ latest[0].price | money }}`)).toBe('IDR 125000')
    expect(
      renderTemplate(`{{ latest[0].price | money: 'USD' }}`, {
        env: { formatPrice: (amount, currency) => `${currency}:${amount / 100}` },
      }),
    ).toBe('USD:1250')
  })

  test('link_url builds storefront URLs from stored links', () => {
    const html = renderTemplate(`<a href="{{ section.settings.link | link_url }}">Go</a>`, {
      scope: { section: { id: 's1', settings: { link: { kind: 'product', slug: 'tote' } } } },
    })
    expect(html).toBe('<a href="/p/tote">Go</a>')
    expect(
      renderTemplate(`{{ section.settings.link | link_url }}`, {
        scope: { section: { id: 's1', settings: { link: { kind: 'url', href: 'javascript:x' } } } },
      }),
    ).toBe('')
  })

  test('image_url and video_url resolve media ids', () => {
    expect(renderTemplate(`{{ 'file-1' | image_url: 400, 300 }}`)).toBe(
      'https://cdn.test/file-1-400x300.jpg',
    )
    expect(renderTemplate(`{{ 'file-1' | image_url }}`)).toBe('https://cdn.test/file-1-800x800.jpg')
    expect(renderTemplate(`{{ 'clip-1' | video_url }}`)).toBe('https://cdn.test/video/clip-1.mp4')
    expect(renderTemplate(`{{ 'https://cdn.test/already.jpg' | image_url }}`)).toBe(
      'https://cdn.test/already.jpg',
    )
  })

  test('dates format deterministically in UTC', () => {
    expect(renderTemplate(`{{ '2026-01-12T12:30:00.000Z' | date: '%d %B %Y' }}`)).toBe(
      '12 January 2026',
    )
    expect(renderTemplate(`{{ 'not-a-date' | date: '%Y' }}`)).toBe('')
  })

  test('attributes: static, dynamic, style and boolean', () => {
    expect(renderTemplate(`<div class="a {{ 'b' }}">x</div>`)).toBe('<div class="a b">x</div>')
    expect(renderTemplate(`<div style="color: red; font-size: {{ 12 }}px">x</div>`)).toBe(
      '<div style="color:red;font-size:12px">x</div>',
    )
    expect(renderTemplate(`<input disabled>`)).toBe('<input disabled=""/>')
    expect(renderTemplate(`<label for="x">x</label>`)).toBe('<label for="x">x</label>')
  })

  test('runtime helpers behave as the language documents', () => {
    const rt = runtime()
    expect(rt.truthy('')).toBe(true)
    expect(rt.truthy(null)).toBe(false)
    expect(rt.and('', 'b')).toBe('b')
    expect(rt.or('', 'b')).toBe('')
    expect(rt.contains('hello', 'ell')).toBe(true)
    expect(rt.contains([1, 2], 2)).toBe(true)
    expect(rt.range(3, 1)).toEqual([3, 2, 1])
    expect(rt.iterate([1, 2, 3], null, 1, true)).toEqual([3, 2])
    expect(rt.forloop(1, 3)).toMatchObject({ index: 2, first: false, last: false, rindex: 2 })
    expect(rt.get([1, 2, 3], 'last')).toBe(3)
    expect(rt.isBlank('   ')).toBe(true)
    expect(rt.isEmpty('')).toBe(true)
  })

  test('the runtime scope and the checker schema expose the same root drops', () => {
    const env = testEnvironment()
    const scope = buildTemplateScope({ data: env.data, env })
    expect(Object.keys(scope).sort()).toEqual(dropNames().sort())
  })

  test('a slot draws the host-owned piece, function slots receive their settings', () => {
    expect(
      renderTemplate(`<div>{% slot 'productPurchase' %}</div>`, {
        env: { slots: { productPurchase: createElement('button', null, 'Add to cart') } },
      }),
    ).toBe('<div><button>Add to cart</button></div>')

    expect(
      renderTemplate(`{% slot 'orderTracking', settings: section.settings %}`, {
        env: {
          slots: {
            orderTracking: (settings) =>
              createElement('p', null, `Track ${(settings as { label: string }).label}`),
          },
        },
        scope: { section: { id: 's1', settings: { label: 'Order' } } },
      }),
    ).toBe('<p>Track Order</p>')

    // A host that passed no slot draws nothing rather than failing.
    expect(renderTemplate(`<div>{% slot 'productReviews' %}</div>`)).toBe('<div></div>')
  })

  test('page_url asks the host for a listing page and falls back to a query string', () => {
    expect(renderTemplate(`{{ 2 | page_url }}`)).toBe('?page=2')
    expect(
      renderTemplate(`{{ 3 | page_url }}`, {
        env: { pageHref: (page) => `/products?page=${page}` },
      }),
    ).toBe('/products?page=3')
  })

  test('form controls are emitted uncontrolled, as a template holds no state', () => {
    const calls: Array<[unknown, Record<string, unknown> | null]> = []
    const h = (type: unknown, props: Record<string, unknown> | null) => {
      calls.push([type, props])
      return null
    }
    const env = testEnvironment()
    const theme = compileTheme({
      'templates/index.tpl': `<input type="search" name="q" value="{{ search.query }}"><textarea value="notes"></textarea><option value="a">A</option>`,
    })
    const activated = activateTheme(
      theme,
      createTemplateRuntime(h as never, env, TEMPLATE_FRAGMENT),
    )
    activated.renderRoute('home', buildTemplateScope({ data: env.data, env }))

    expect(calls.find(([type]) => type === 'input')?.[1]).toMatchObject({
      type: 'search',
      defaultValue: '',
    })
    expect(calls.find(([type]) => type === 'textarea')?.[1]).toMatchObject({
      defaultValue: 'notes',
    })
    // An option's value is not a form control state: it stays `value`.
    expect(calls.find(([type]) => type === 'option')?.[1]).toMatchObject({ value: 'a' })
  })

  test('activates a theme from a shipped factory, with no source evaluation', () => {
    const theme = compileTheme({ 'templates/index.tpl': `<p>x</p>` })
    const factory: ThemeModuleFactory = () => ({
      routes: { home: () => 'home!' },
      bodies: { home: () => 'body!' },
      sections: {},
      layout: (scope, body) => `[${String(body?.(scope))}]`,
    })
    const activated = activateThemeFactory(
      theme,
      factory,
      createTemplateRuntime((() => null) as never, testEnvironment(), TEMPLATE_FRAGMENT),
    )
    expect(activated.renderRoute('home', {})).toBe('home!')
    expect(activated.renderTemplate('home', {})).toBe('body!')
    expect(activated.renderLayout({}, () => 'body!')).toBe('[body!]')
    expect(activated.renderSection('nope', {})).toBeNull()
    expect(activated.version).toBe(theme.version)
  })
})
