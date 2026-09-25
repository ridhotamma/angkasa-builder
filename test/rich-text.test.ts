import { describe, expect, test } from 'bun:test'

import { richDocFromPlainText, richDocText, sanitizeRichDoc, sanitizeSections } from '../src'

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
