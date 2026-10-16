/**
 * The pages a new shop opens with.
 *
 * Both creation paths — the dashboard's `createTenant` and `seed:demo` — store
 * whatever this returns, so what is pinned here is the contract they share: two
 * pages, published-ready content, and copy that survives the round trip through
 * the page editor's own sanitiser (a locale map the sanitiser dropped would
 * leave a shopper with an empty body in their language).
 */

import { describe, expect, test } from 'bun:test'

import {
  CONTENT_VERSION,
  parsePageContent,
  sanitizePageContent,
  serializeContent,
  starterPages,
} from '../src/index'

const pages = starterPages()

describe('the starter pages', () => {
  test('a terms page and a privacy page, by slug', () => {
    expect(pages.map((page) => page.slug)).toEqual(['syarat-ketentuan', 'kebijakan-privasi'])
    expect(pages.map((page) => page.title)).toEqual(['Syarat & Ketentuan', 'Kebijakan Privasi'])
  })

  test('each is one rich-text section, bilingual in heading and body', () => {
    for (const page of pages) {
      expect(page.content.version).toBe(CONTENT_VERSION)
      expect(page.content.sections).toHaveLength(1)

      const [section] = page.content.sections
      expect(section?.type).toBe('rich-text')

      for (const field of ['heading', 'body']) {
        const value = section?.settings[field] as Record<string, unknown> | undefined
        expect(Object.keys(value ?? {}).sort()).toEqual(['en', 'id'])
      }
    }
  })

  test('what is stored reads back the same, in both languages', () => {
    for (const page of pages) {
      const json = serializeContent(sanitizePageContent(page.content))
      const stored = parsePageContent(json)

      // No locale map was flattened on the way in or out.
      expect(stored).toEqual(sanitizePageContent(page.content))
      const [section] = stored.sections
      const heading = section?.settings.heading as { en?: string; id?: string }
      expect(heading?.id?.length).toBeGreaterThan(0)
      expect(heading?.en?.length).toBeGreaterThan(0)
    }
  })
})
