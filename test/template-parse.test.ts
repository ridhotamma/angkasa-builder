import { describe, expect, test } from 'bun:test'

import { parseTemplate } from '../src/template'
import type { Diagnostic } from '../src/template'

function codes(diagnostics: readonly Diagnostic[]): string[] {
  return diagnostics.map((diagnostic) => diagnostic.code)
}

describe('template parser', () => {
  test('parses text, output and nested elements', () => {
    const parsed = parseTemplate(
      `<section class="hero"><h1>{{ shop.name }}</h1><p>Hello</p></section>`,
      { file: 'sections/hero.tpl' },
    )
    expect(parsed.diagnostics).toEqual([])
    expect(parsed.nodes).toHaveLength(1)
    const section = parsed.nodes[0]!
    expect(section.kind).toBe('element')
    if (section.kind !== 'element') throw new Error('unreachable')
    expect(section.tag).toBe('section')
    expect(section.attributes).toEqual([{ name: 'class', value: [{ text: 'hero' }] }])
    expect(section.children.map((child) => child.kind)).toEqual(['element', 'element'])
  })

  test('parses if / elsif / else and keeps branches in order', () => {
    const parsed = parseTemplate(`{% if a %}A{% elsif b %}B{% else %}C{% endif %}`, {
      file: 'x.tpl',
    })
    expect(parsed.diagnostics).toEqual([])
    const node = parsed.nodes[0]!
    expect(node.kind).toBe('if')
    if (node.kind !== 'if') throw new Error('unreachable')
    expect(node.branches).toHaveLength(2)
    expect(node.elseChildren).toHaveLength(1)
  })

  test('parses for options in any order, including a filtered iterable', () => {
    const parsed = parseTemplate(
      `{% for p in products | where: "on_sale", true limit: 2 offset: 1 reversed %}{{ p.name }}{% endfor %}`,
      { file: 'x.tpl' },
    )
    expect(parsed.diagnostics).toEqual([])
    const node = parsed.nodes[0]!
    expect(node.kind).toBe('for')
    if (node.kind !== 'for') throw new Error('unreachable')
    expect(node.variable).toBe('p')
    expect(node.reversed).toBe(true)
    expect(node.limit?.kind).toBe('literal')
    expect(node.offset?.kind).toBe('literal')
    expect(node.iterable.kind).toBe('filter')
  })

  test('parses render arguments and the include alias', () => {
    const parsed = parseTemplate(
      `{% render 'price', product: product, compact: true %}{% include "note" %}`,
      { file: 'x.tpl' },
    )
    expect(parsed.diagnostics).toEqual([])
    const [render, include] = parsed.nodes as Array<{
      kind: string
      snippet: string
      args: unknown[]
    }>
    expect(render).toMatchObject({ kind: 'render', snippet: 'price' })
    expect(render!.args).toHaveLength(2)
    expect(include).toMatchObject({ kind: 'render', snippet: 'note', args: [] })
  })

  test('captures {% schema %} raw and renders nothing for it', () => {
    const parsed = parseTemplate(
      `<h1>Hi</h1>{% schema %}{ "name": "Hero", "settings": [] }{% endschema %}`,
      { file: 'sections/hero.tpl' },
    )
    expect(parsed.diagnostics).toEqual([])
    expect(parsed.nodes).toHaveLength(1)
    expect(JSON.parse(parsed.schema!)).toEqual({ name: 'Hero', settings: [] })
  })

  test('drops comments and HTML comments', () => {
    const parsed = parseTemplate(`a{% comment %}secret{% endcomment %}b<!-- note -->c`, {
      file: 'x.tpl',
    })
    expect(parsed.diagnostics).toEqual([])
    expect(parsed.nodes.map((node) => (node.kind === 'text' ? node.value : node.kind))).toEqual([
      'a',
      'b',
      'c',
    ])
  })

  test('honours whitespace control', () => {
    const parsed = parseTemplate(`<p>\n  {%- if a -%}\n  yes\n  {%- endif -%}\n</p>`, {
      file: 'x.tpl',
    })
    expect(parsed.diagnostics).toEqual([])
    const p = parsed.nodes[0]!
    if (p.kind !== 'element') throw new Error('unreachable')
    expect(p.children[0]).toMatchObject({ kind: 'if' })
  })

  test('parses dynamic attributes into literal and expression parts', () => {
    const parsed = parseTemplate(`<a href="{{ link | link_url }}" class="btn {{ tone }}">x</a>`, {
      file: 'x.tpl',
    })
    expect(parsed.diagnostics).toEqual([])
    const anchor = parsed.nodes[0]!
    if (anchor.kind !== 'element') throw new Error('unreachable')
    expect(anchor.attributes[0]!.value).not.toBe(true)
    expect(anchor.attributes[1]!.value).toMatchObject([
      { text: 'btn ' },
      { expression: { kind: 'variable', name: 'tone' } },
    ])
  })

  test('reports unclosed and mismatched elements with positions', () => {
    const unclosed = parseTemplate(`<div><p>oops</div>`, { file: 'x.tpl' })
    expect(codes(unclosed.diagnostics)).toContain('unclosed-element')

    const mismatched = parseTemplate(`<div><span>x</div></span>`, { file: 'x.tpl' })
    expect(codes(mismatched.diagnostics)).toContain('mismatched-element')
  })

  test('reports unknown and unclosed directives', () => {
    expect(codes(parseTemplate(`{% assign x = 1 %}`, { file: 'x.tpl' }).diagnostics)).toContain(
      'unknown-tag',
    )
    expect(codes(parseTemplate(`{% if a %}x`, { file: 'x.tpl' }).diagnostics)).toContain(
      'unclosed-tag',
    )
    expect(codes(parseTemplate(`{{ product.title`, { file: 'x.tpl' }).diagnostics)).toContain(
      'unterminated-tag',
    )
  })

  test('refuses script, style and event handlers', () => {
    const parsed = parseTemplate(
      `<div onclick="steal()"><script>alert(1)</script><style>p{}</style><p>safe</p></div>`,
      { file: 'x.tpl' },
    )
    expect(codes(parsed.diagnostics)).toEqual(
      expect.arrayContaining(['disallowed-attribute', 'disallowed-element']),
    )
    const div = parsed.nodes[0]!
    if (div.kind !== 'element') throw new Error('unreachable')
    // The script and style are dropped whole; the paragraph survives.
    expect(
      div.children.map((child) => (child.kind === 'element' ? child.tag : child.kind)),
    ).toEqual(['p'])
  })

  test('refuses javascript: URLs but allows data: images', () => {
    expect(
      codes(parseTemplate(`<a href="javascript:alert(1)">x</a>`, { file: 'x.tpl' }).diagnostics),
    ).toContain('unsafe-url')
    expect(
      parseTemplate(`<img src="data:image/png;base64,AAAA" alt="dot">`, { file: 'x.tpl' })
        .diagnostics,
    ).toEqual([])
  })
})
