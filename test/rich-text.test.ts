import { describe, expect, test } from 'bun:test'

import {
  richDocFromHtml,
  richDocToHtml,
  richDocFromPlainText,
  richDocText,
  sanitizeRichDoc,
  sanitizeSections,
} from '../src'

const MAX = 5000

describe('rich text', () => {
  test('text saved before formatting existed becomes paragraphs', () => {
    expect(sanitizeRichDoc('First line\nsame paragraph\n\nSecond', MAX)).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'First line' },
            { type: 'hardBreak' },
            { type: 'text', text: 'same paragraph' },
          ],
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'Second' }] },
      ],
    })
  })

  test('keeps the allowed vocabulary exactly, and is idempotent', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Care' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Wash ', marks: [{ type: 'bold' }, { type: 'italic' }] },
            {
              type: 'text',
              text: 'cold',
              marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
            },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'One' }] }],
            },
          ],
        },
        {
          type: 'blockquote',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Quoted' }] }],
        },
        { type: 'paragraph' },
      ],
    }
    const once = sanitizeRichDoc(doc, MAX)
    expect(once).toEqual(doc as never)
    expect(sanitizeRichDoc(once, MAX)).toEqual(once)
  })

  test('drops unknown nodes, marks and attributes', () => {
    const doc = sanitizeRichDoc(
      {
        type: 'doc',
        content: [
          { type: 'codeBlock', content: [{ type: 'text', text: 'x' }] },
          { type: 'iframe', attrs: { src: 'https://evil.test' } },
          {
            type: 'paragraph',
            attrs: { style: 'color:red' },
            content: [
              { type: 'text', text: 'hi', marks: [{ type: 'textStyle', attrs: { color: 'red' } }] },
              { type: 'image', attrs: { src: 'x' } },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 1, onclick: 'x' },
            content: [{ type: 'text', text: 'H' }],
          },
        ],
      },
      MAX,
    )
    expect(doc).toEqual({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'hi' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'H' }] },
      ],
    })
  })

  test('refuses links that are not safe to follow', () => {
    const linkOf = (href: string) =>
      sanitizeRichDoc(
        {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href } }] }],
            },
          ],
        },
        MAX,
      ).content[0]
    for (const bad of [
      'javascript:alert(1)',
      'data:text/html,x',
      '//evil.test',
      'vbscript:x',
      'not a url',
    ]) {
      expect(linkOf(bad)).toEqual({ type: 'paragraph', content: [{ type: 'text', text: 'x' }] })
    }
    for (const good of ['https://a.test', 'mailto:a@b.test', 'tel:+62812', '/pages/about']) {
      expect(linkOf(good)).toEqual({
        type: 'paragraph',
        content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: good } }] }],
      })
    }
  })

  test('caps the text at the field limit', () => {
    const doc = sanitizeRichDoc(richDocFromPlainText('abcdef\n\nghijkl'), 8)
    expect(richDocText(doc)).toBe('abcdef\n\ngh')
  })

  test('garbage becomes an empty document', () => {
    for (const bad of [null, 42, [], { type: 'nope' }, { type: 'doc', content: 'x' }]) {
      expect(sanitizeRichDoc(bad, MAX)).toEqual({ type: 'doc', content: [] })
    }
  })

  test('a Text section saved with a plain string body reads as a document', () => {
    const [section] = sanitizeSections([
      { id: 't', type: 'rich-text', settings: { heading: 'Our story', body: 'Hello\n\nWorld' } },
    ])
    expect(richDocText(section!.settings.body as never)).toBe('Hello\n\nWorld')
  })
})

describe('HTML answers from a model', () => {
  test('paragraphs, headings and inline marks parse into the vocabulary', () => {
    const doc = sanitizeRichDoc(
      '<h2>Care</h2><p>Wash <strong>cold</strong> and <em>gentle</em></p>',
      MAX,
    )
    expect(doc).toEqual({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Care' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Wash ' },
            { type: 'text', text: 'cold', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' and ' },
            { type: 'text', text: 'gentle', marks: [{ type: 'italic' }] },
          ],
        },
      ],
    })
  })

  test('lists, quotes and line breaks survive; script contents do not', () => {
    const doc = richDocFromHtml(
      '<ul><li>One</li><li>Two</li></ul><blockquote><p>Q</p></blockquote><p>a<br>b<script>alert(1)</script></p>',
    )
    expect(doc.content.map((block) => block.type)).toEqual([
      'bulletList',
      'blockquote',
      'paragraph',
    ])
    expect(JSON.stringify(doc)).not.toContain('alert')
    expect(richDocText(doc)).toContain('a\nb')
  })

  test('an unsafe link keeps its words and loses the href', () => {
    const doc = richDocFromHtml('<p><a href="javascript:alert(1)">x</a></p>')
    expect(doc.content[0]).toEqual({ type: 'paragraph', content: [{ type: 'text', text: 'x' }] })
  })

  test('a stored document whose paragraph holds tags is repaired on read', () => {
    const stored = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '<p>Hello <strong>world</strong></p>' }],
        },
      ],
    }
    const doc = sanitizeRichDoc(stored, MAX)
    expect(richDocText(doc)).toBe('Hello world')
    expect(JSON.stringify(doc)).not.toContain('<p>')
    expect(doc.content[0]).toEqual({
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Hello ' },
        { type: 'text', text: 'world', marks: [{ type: 'bold' }] },
      ],
    })
  })

  test('plain text with angle brackets is not mistaken for HTML', () => {
    expect(richDocText(sanitizeRichDoc('5 < 6 and 7 > 2', MAX))).toBe('5 < 6 and 7 > 2')
  })
})

describe('richDocToHtml', () => {
  test('writes what the parser reads back, losslessly', () => {
    const doc = sanitizeRichDoc(
      '<h2>Choosing the fish</h2><p>Pick <strong>firm</strong> flesh &amp; <a href="/products/x">clear eyes</a>.<br>Ask the seller.</p><h3>At the market</h3><ol><li><p>Smell it</p></li></ol><ul><li><p>Salt</p></li></ul><blockquote><p>Fresh is best.</p></blockquote>',
      5000,
    )
    const html = richDocToHtml(doc)
    expect(html).toContain('<h2>Choosing the fish</h2>')
    expect(html).toContain('flesh &amp; <a href="/products/x">clear eyes</a>')
    expect(sanitizeRichDoc(html, 5000)).toEqual(doc)
  })

  test('escapes text, so stored words never turn into markup', () => {
    const html = richDocToHtml({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a < b & "c" > d' }] }],
    })
    expect(html).toBe('<p>a &lt; b &amp; &quot;c&quot; &gt; d</p>')
    expect(richDocText(sanitizeRichDoc(html, 100))).toBe('a < b & "c" > d')
  })
})
