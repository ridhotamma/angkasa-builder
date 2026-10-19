import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'

import { isStockPhoto } from '@repo/appwrite-config'
import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

import {
  createStarterSection,
  DEFAULT_THEME_SETTINGS,
  isSectionOffered,
  reseedSectionVariant,
  SECTION_SCHEMAS,
  SECTION_STARTERS,
  SAMPLE_PHOTOS,
  type SectionPreset,
  type SectionSchema,
  type SectionType,
} from '../src/index'
import { sampleStorefrontData, SectionsRenderer, type RenderEnvironment } from '../src/render/index'

const NOW = new Date('2026-10-09T00:00:00.000Z')

function env(overrides: Partial<RenderEnvironment> = {}): RenderEnvironment {
  return {
    data: sampleStorefrontData('Starter Shop'),
    settings: DEFAULT_THEME_SETTINGS,
    mode: 'live',
    imageUrl: (id) => (id ? `https://img/${id}` : null),
    formatPrice: (amount, currency) => `${amount} ${currency}`,
    now: NOW,
    ...overrides,
  }
}

function render(node: ReactNode): string {
  return renderToString(
    <ChakraProvider value={system}>
      <I18nProvider locale="en" resources={{}}>
        {node}
      </I18nProvider>
    </ChakraProvider>,
  )
}

/**
 * Every value a starter set must still be there after the sanitiser. Lists
 * gain generated item ids, so only the keys the starter named are compared.
 */
function expectKept(got: unknown, want: unknown, path: string): void {
  if (Array.isArray(want)) {
    expect(Array.isArray(got), path).toBe(true)
    expect((got as unknown[]).length, path).toBeGreaterThanOrEqual(want.length)
    want.forEach((value, index) =>
      expectKept((got as unknown[])[index], value, `${path}[${index}]`),
    )
    return
  }
  if (want && typeof want === 'object') {
    expect(got && typeof got === 'object', path).toBe(true)
    for (const [key, value] of Object.entries(want)) {
      expectKept((got as Record<string, unknown>)[key], value, `${path}.${key}`)
    }
    return
  }
  if (typeof want === 'string' && want !== '') {
    // A starter may set a rich-text `body` as a plain string; the sanitiser
    // turns it into a document, so the words are the thing to keep.
    if (got !== null && typeof got === 'object') {
      expect(JSON.stringify(got), path).toContain(want)
      return
    }
    expect(got, path).toBe(want)
  }
}

describe('section starters', () => {
  test('every starter survives the sanitiser intact', () => {
    for (const [type, starter] of Object.entries(SECTION_STARTERS)) {
      const section = createStarterSection(type as SectionType, null, NOW)
      expect(section.type, type).toBe(type)
      expectKept(section.settings, starter(NOW), String(type))
    }
  })

  test('every offered content section has a starter', () => {
    // Catalogue sections and the product/article/catalogue page sections draw
    // from real data, and hidden sections are not offered — their content is
    // not the seller's to place.
    const isDataDriven = (schema: SectionSchema) =>
      schema.usesCatalogue === true ||
      schema.hidden === true ||
      schema.category === 'product-page' ||
      schema.category === 'article-page' ||
      schema.category === 'catalog-page'

    for (const schema of SECTION_SCHEMAS as readonly SectionSchema[]) {
      if (!isSectionOffered(schema, 'home') || isDataDriven(schema)) continue
      expect(SECTION_STARTERS[schema.type as SectionType], schema.type).toBeDefined()
    }
  })

  test('every sample photo is a hotlinked stock photo with a credit', () => {
    for (const [name, value] of Object.entries(SAMPLE_PHOTOS)) {
      expect(isStockPhoto(value), name).toBe(true)
    }
  })

  test('the stacking cards ship wide pictures, so a pinned card keeps its words in view', () => {
    const section = createStarterSection('stacked-cards', null, NOW)
    const columns = (section.settings.blocks ?? []) as Array<{
      settings?: { blocks?: Array<{ type?: string; settings?: { ratio?: string } }> }
    }>
    const ratios = columns.flatMap((column) =>
      (column.settings?.blocks ?? [])
        .filter((block) => block.type === 'image')
        .map((block) => block.settings?.ratio),
    )
    // One picture per card, each wide enough that the heading and text below
    // it still fit under the header once the card pins.
    expect(ratios).toHaveLength(3)
    for (const ratio of ratios) expect(ratio).toBe('16/9')
  })

  test('a preset wins over the starter, key by key', () => {
    const preset: SectionPreset = {
      key: 'test',
      name: { en: 'Test', id: 'Uji' },
      description: { en: 'Test', id: 'Uji' },
      settings: { heading: 'From the preset' },
    }
    const section = createStarterSection('banner', preset, NOW)
    expect(section.settings.heading).toBe('From the preset')
    // The starter's subheading is not dragged in beside a preset.
    expect(section.settings.subheading).toBe('')
  })

  test('every starter paints something rather than an empty notice', () => {
    const notices = [
      'Add items in the section settings.',
      'Pick an image in the section settings.',
      'Add a slide with an image in the section settings.',
      'No published products yet.',
    ]
    for (const type of Object.keys(SECTION_STARTERS)) {
      const html = render(
        <SectionsRenderer
          sections={[createStarterSection(type as SectionType, null, NOW)]}
          env={env()}
        />,
      )
      for (const notice of notices) expect(html, type).not.toContain(notice)
      expect(html.length, type).toBeGreaterThan(200)
    }
  })
})

describe('reseedSectionVariant', () => {
  /** A gallery exactly as the picker adds it: sanitised, with list ids. */
  const gallery = () => createStarterSection('gallery', null, NOW).settings
  const captionsOf = (settings: Record<string, unknown>) =>
    (settings.items as Array<{ caption?: string }>).map((item) => item.caption ?? '')

  test('an untouched gallery takes the new look’s own photos', () => {
    const grid = gallery()
    const next = reseedSectionVariant('gallery', grid, { ...grid, layout: 'masonry' })
    expect(next.layout).toBe('masonry')
    // Masonry is a wall of pictures: the grid's captions are gone.
    expect(captionsOf(next).every((caption) => caption === '')).toBe(true)
    expect((next.items as unknown[]).length).toBeGreaterThan((grid.items as unknown[]).length)
  })

  test('a social wall gets its handle and feed seeded', () => {
    const grid = gallery()
    const next = reseedSectionVariant('gallery', grid, { ...grid, layout: 'social' })
    expect(next.handle).toBe('@yourshop')
    expect(captionsOf(next).some((caption) => caption !== '')).toBe(true)
  })

  test('every swapped-in photo keeps a list id, so the editor can key on it', () => {
    const grid = gallery()
    const next = reseedSectionVariant('gallery', grid, { ...grid, layout: 'masonry' })
    for (const item of next.items as Array<{ id?: string }>) expect(item.id).toBeTruthy()
  })

  test('once the seller edits the photos, a look change leaves them alone', () => {
    const grid = gallery()
    const items = (grid.items as Array<Record<string, unknown>>).map((item, index) =>
      index === 0 ? { ...item, caption: 'Our own photo' } : item,
    )
    const edited = { ...grid, items }
    const next = reseedSectionVariant('gallery', edited, { ...edited, layout: 'masonry' })
    expect(next.items).toEqual(items)
  })

  test('changing a field that does not drive the content does nothing', () => {
    const grid = gallery()
    const next = reseedSectionVariant('gallery', grid, { ...grid, heading: 'A new heading' })
    expect(next.items).toEqual(grid.items)
  })

  test('a section with no variant starters is returned untouched', () => {
    const settings = createStarterSection('banner', null, NOW).settings
    const next = { ...settings, heading: 'X' }
    expect(reseedSectionVariant('banner', settings, next)).toBe(next)
  })
})
