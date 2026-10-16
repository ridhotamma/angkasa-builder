/**
 * Resolving a section's copy for one locale: a translated field renders per
 * reader, copy inside list items too, and everything else is left alone.
 */

import { describe, expect, test } from 'bun:test'

import { createSection, resolveLocalizedSettings } from '../src/index'

describe('resolveLocalizedSettings', () => {
  test('a single-language section keeps its settings identity', () => {
    const section = createSection('testimonials', { heading: 'Halo' })
    const resolved = resolveLocalizedSettings('testimonials', section.settings, 'en')
    // Nothing was translated, so the very same object comes back — no re-render.
    expect(resolved).toBe(section.settings)
    expect(resolved.heading).toBe('Halo')
  })

  test('the sanitizer keeps a locale map instead of flattening it', () => {
    const section = createSection('testimonials', { heading: { id: 'Halo', en: 'Hello' } })
    expect(section.settings.heading).toEqual({ id: 'Halo', en: 'Hello' })
  })

  test('a translated heading resolves per reader, then falls back', () => {
    const section = createSection('testimonials', { heading: { id: 'Halo', en: 'Hello' } })
    const settings = section.settings
    expect(resolveLocalizedSettings('testimonials', settings, 'en').heading).toBe('Hello')
    expect(resolveLocalizedSettings('testimonials', settings, 'id').heading).toBe('Halo')
    // An unknown reader locale falls back to the shop language (id), then English.
    expect(resolveLocalizedSettings('testimonials', settings, 'fr').heading).toBe('Halo')
  })

  test('copy inside a list item is resolved; its other data is untouched', () => {
    const section = createSection('testimonials', {
      items: [{ id: 'item-1', quote: { id: 'Bagus sekali', en: 'Very good' }, author: 'Sari' }],
    })
    const items = resolveLocalizedSettings('testimonials', section.settings, 'en').items as Array<
      Record<string, unknown>
    >
    expect(items[0]?.quote).toBe('Very good')
    // `author` is plain, `id` is data — neither is treated as a translation.
    expect(items[0]?.author).toBe('Sari')
    expect(items[0]?.id).toBe('item-1')
  })

  test('an unknown section type is returned untouched', () => {
    const settings = { heading: { id: 'Halo', en: 'Hello' } }
    // @ts-expect-error — a type that is not in the catalogue.
    expect(resolveLocalizedSettings('nope', settings, 'en')).toBe(settings)
  })
})
