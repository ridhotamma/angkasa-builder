/**
 * Seller-authored localisation: a field is one string or one string per locale,
 * and a reader resolves it with a fallback chain.
 */

import { describe, expect, test } from 'bun:test'

import {
  isLocalizedText,
  readLocalizedEntry,
  readLocalizedText,
  STOREFRONT_LOCALES,
} from '../src/index'

describe('isLocalizedText', () => {
  test('accepts a map carrying a known locale', () => {
    expect(isLocalizedText({ id: 'Halo' })).toBe(true)
    expect(isLocalizedText({ en: 'Hello' })).toBe(true)
    expect(isLocalizedText({ id: 'Halo', en: 'Hello' })).toBe(true)
  })

  test('rejects a plain string, an empty map and anything else', () => {
    expect(isLocalizedText('Halo')).toBe(false)
    expect(isLocalizedText({})).toBe(false)
    expect(isLocalizedText(null)).toBe(false)
    expect(isLocalizedText(['id'])).toBe(false)
    expect(isLocalizedText({ fr: 'Bonjour' })).toBe(false)
  })
})

describe('readLocalizedText', () => {
  test('returns a plain string unchanged — nothing written before this changes', () => {
    expect(readLocalizedText('Halo', 'en')).toBe('Halo')
  })

  test('reads the reader’s locale', () => {
    expect(readLocalizedText({ id: 'Halo', en: 'Hello' }, 'en')).toBe('Hello')
    expect(readLocalizedText({ id: 'Halo', en: 'Hello' }, 'id')).toBe('Halo')
  })

  test('falls back to the shop language, then English', () => {
    // No `en` entry: the shop's language answers a reader asking for English.
    expect(readLocalizedText({ id: 'Halo' }, 'en')).toBe('Halo')
    // Only English: an `id` reader gets it rather than nothing.
    expect(readLocalizedText({ en: 'Hello' }, 'id')).toBe('Hello')
    // An explicit fallback wins over the default.
    expect(readLocalizedText({ id: 'Halo' }, 'en', 'id')).toBe('Halo')
  })

  test('an empty or missing value is the empty string, never undefined', () => {
    expect(readLocalizedText({}, 'id')).toBe('')
    expect(readLocalizedText(null, 'id')).toBe('')
    expect(readLocalizedText(undefined, 'id')).toBe('')
  })

  test('the default fallback is the first storefront locale', () => {
    expect(STOREFRONT_LOCALES[0]).toBe('id')
  })
})

describe('readLocalizedEntry', () => {
  test('a plain string is the value for every locale', () => {
    expect(readLocalizedEntry('Halo', 'en')).toBe('Halo')
    expect(readLocalizedEntry('Halo', 'id')).toBe('Halo')
  })

  test('reads one locale without falling back', () => {
    expect(readLocalizedEntry({ id: 'Halo', en: 'Hello' }, 'en')).toBe('Hello')
    expect(readLocalizedEntry({ id: 'Halo' }, 'en')).toBe('')
  })
})
