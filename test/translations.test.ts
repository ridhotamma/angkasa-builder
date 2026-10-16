/**
 * The translation table: listing a layout's translatable copy, and writing one
 * back without touching the other language.
 */

import { describe, expect, test } from 'bun:test'

import {
  applyTranslationEntry,
  collectTranslationEntries,
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
