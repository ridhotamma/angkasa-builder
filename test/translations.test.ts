/**
 * The translation table: listing a layout's translatable copy, and writing one
 * back without touching the other language.
 */

import { describe, expect, test } from 'bun:test'

import {
  applyTranslationEntry,
  collectTranslationEntries,
  collectTranslationFields,
  CONTENT_VERSION,
  createSection,
  type PageContent,
} from '../src/index'

function page(): PageContent {
  return {
    version: CONTENT_VERSION,
    sections: [
      createSection('testimonials', {
        heading: { id: 'Halo', en: 'Hello' },
        items: [{ quote: { id: 'Bagus', en: 'Good' }, author: 'Sari' }],
      }),
    ],
  }
}

describe('collectTranslationEntries', () => {
  test('lists translated copy with its source and target', () => {
    const heading = collectTranslationEntries(page().sections, 'en').find(
      (e) => e.key === 'heading',
    )
    expect(heading?.source).toBe('Halo')
    expect(heading?.target).toBe('Hello')
    expect(heading?.section).toBeDefined()
    expect(heading?.field).toBeDefined()
  })

  test('lists copy inside a list item, carrying its list path', () => {
    const quote = collectTranslationEntries(page().sections, 'en').find(
      (entry) => entry.listKey === 'items' && entry.key === 'quote',
    )
    expect(quote?.source).toBe('Bagus')
    expect(quote?.target).toBe('Good')
    expect(typeof quote?.itemId).toBe('string')
  })
})

describe('collectTranslationFields — what is actually translated', () => {
  test('a plain string reads in every column but is stored for none', () => {
    const section = createSection('testimonials', { heading: 'Halo' })
    const field = collectTranslationFields([section]).find((entry) => entry.key === 'heading')!
    // Shown in both columns (the fallback), but nothing of its own is stored —
    // so the manager does not count it translated and the AI may fill `en`.
    expect(field.values.id).toBe('Halo')
    expect(field.values.en).toBe('Halo')
    expect(field.translated).toEqual([])
  })

  test('a locale map reports exactly the locales it stores', () => {
    const section = createSection('testimonials', { heading: { id: 'Halo' } })
    const field = collectTranslationFields([section]).find((entry) => entry.key === 'heading')!
    expect(field.translated).toEqual(['id'])
    expect(field.values.en ?? '').toBe('')
  })

  test('counts copy inside a list item too', () => {
    const section = createSection('testimonials', {
      items: [{ quote: { id: 'Bagus' }, author: 'Sari' }],
    })
    const fields = collectTranslationFields([section])
    expect(
      fields.find((entry) => entry.listKey === 'items' && entry.key === 'quote')?.translated,
    ).toEqual(['id'])
    const author = fields.find((entry) => entry.listKey === 'items' && entry.key === 'author')!
    expect(author.translated).toEqual([])
    expect(author.values.id).toBe('Sari')
  })
})

describe('applyTranslationEntry', () => {
  test('writes one locale without disturbing the other', () => {
    const content = page()
    const heading = collectTranslationEntries(content.sections, 'en').find(
      (entry) => entry.key === 'heading',
    )!
    const next = applyTranslationEntry(content, heading, 'en', 'Hi')
    const stored = next.sections[0]!.settings.heading as Record<string, string>
    expect(stored.en).toBe('Hi')
    expect(stored.id).toBe('Halo')
  })

  test('writes copy inside a list item', () => {
    const content = page()
    const quote = collectTranslationEntries(content.sections, 'en').find(
      (entry) => entry.listKey === 'items',
    )!
    const next = applyTranslationEntry(content, quote, 'en', 'Great')
    const items = next.sections[0]!.settings.items as Array<Record<string, unknown>>
    expect((items[0]!.quote as Record<string, string>).en).toBe('Great')
  })

  test('a path that matches nothing returns the same content object', () => {
    const content = page()
    const next = applyTranslationEntry(content, { sectionId: 'nope', key: 'heading' }, 'en', 'x')
    expect(next).toBe(content)
  })
})
