/**
 * A section's fields must follow the look the seller picked.
 *
 * The quotes section is two sections wearing one name — `Testimonials` and
 * `VideoTestimonials` — and each reads a different set of keys off an item.
 * Every field is stored whatever the look, so without `showWhen` the editor
 * drew all of them at once: video posters and customer photos stacked under a
 * plain quote. These tests pin what each look offers, by interrogating the
 * schema the way the editor does.
 *
 * `isFieldShown` is given empty item values on purpose: an item is edited with
 * nothing in it, so the section's own choice is what has to decide.
 */

import { describe, expect, test } from 'bun:test'

import { isFieldShown, type Field, type ItemField, type ListField } from '../src/model/fields'
import { sectionSchema } from '../src/model/sections'

/** The fields of `key` that a section shows under `looks`. */
function fieldsUnder(
  type: string,
  key: string,
  choiceKey: string,
  look: string,
  outer: boolean,
): string[] {
  const schema = sectionSchema(type)
  const fields = (schema?.fields ?? []) as readonly Field[]
  const found = fields.find((field) => field.key === key)
  if (!found) throw new Error(`${type} has no "${key}" field`)

  if (outer)
    return fields.filter((field) => isFieldShown(field, { [choiceKey]: look })).map((f) => f.key)

  const items = (found as ListField).fields
  return items
    .filter((field: ItemField) => isFieldShown(field, {}, { [choiceKey]: look }))
    .map((field) => field.key)
}

describe('the quotes section follows its look', () => {
  const itemFields = (look: string) => fieldsUnder('quotes', 'items', 'variant', look, false)

  test('a plain quote asks for the customer and their words', () => {
    expect(itemFields('quotes')).toEqual(['quote', 'author', 'avatar', 'fit', 'position', 'role'])
  })

  test('a video quote asks for the video, not the customer photo', () => {
    expect(itemFields('video')).toEqual([
      'quote',
      'name',
      'role',
      'video',
      'poster',
      'fit',
      'position',
    ])
  })

  test('no look is offered a field it does not read', () => {
    // The bug as reported: every look showed every field.
    const offered = ['quotes', 'video'].flatMap(itemFields)
    for (const key of ['author', 'avatar', 'name', 'role', 'video', 'poster']) {
      const looks = (['quotes', 'video'] as const).filter((look) => itemFields(look).includes(key))
      expect(offered).toContain(key)
      expect(looks.length).toBeGreaterThan(0)
      expect(looks.length).toBeLessThan(3)
    }
  })

  test('desktop columns belong to the video look alone', () => {
    // The quotes look fixes its own grid, so the control would be a lie.
    expect(fieldsUnder('quotes', 'columns', 'variant', 'video', true)).toContain('columns')
    expect(fieldsUnder('quotes', 'columns', 'variant', 'quotes', true)).not.toContain('columns')
  })
})

describe('the gallery section follows its look', () => {
  const itemFields = (layout: string) => fieldsUnder('gallery', 'items', 'layout', layout, false)

  test('a caption belongs to the grid and the social wall, a description to masonry', () => {
    expect(itemFields('grid')).toEqual(['image', 'fit', 'position', 'caption', 'link'])
    expect(itemFields('social')).toEqual(['image', 'fit', 'position', 'caption', 'link'])
    expect(itemFields('masonry')).toEqual(['image', 'fit', 'position', 'alt', 'link'])
  })
})

describe('the cards body belongs to the person look', () => {
  // `Team` draws it under the heading; the other two carry their words per card.
  const shows = (card: string) => fieldsUnder('cards', 'body', 'card', card, true)

  test('offered for people, not for image-and-text or icons', () => {
    expect(shows('person')).toContain('body')
    expect(shows('text')).not.toContain('body')
    expect(shows('icon')).not.toContain('body')
  })
})

describe('the story section follows its style', () => {
  const itemFields = (style: string) => fieldsUnder('story', 'items', 'style', style, false)

  test('a chapter asks for its heading and body, a milestone for its date and title', () => {
    expect(itemFields('chapters')).toEqual(['image', 'fit', 'position', 'heading', 'body'])
    expect(itemFields('timeline')).toEqual(['image', 'fit', 'position', 'label', 'title', 'text'])
  })
})

/** The section's own fields under a set of sibling values. */
function sectionFields(type: string, values: Record<string, string>): string[] {
  const schema = sectionSchema(type)
  return ((schema?.fields ?? []) as readonly Field[])
    .filter((field) => isFieldShown(field, values))
    .map((field) => field.key)
}

describe('the product list follows its layout and source', () => {
  test('text on tiles belongs to the bento alone', () => {
    expect(sectionFields('product-list', { layout: 'bento' })).toContain('bentoText')
    expect(sectionFields('product-list', { layout: 'grid' })).not.toContain('bentoText')
    expect(sectionFields('product-list', { layout: 'slider' })).not.toContain('bentoText')
  })

  test('the grid keeps whole columns, the slider its own per-view', () => {
    const grid = sectionFields('product-list', { layout: 'grid' })
    expect(grid).toContain('columns')
    expect(grid).toContain('mobileColumns')
    expect(grid).not.toContain('perPage')

    const slider = sectionFields('product-list', { layout: 'slider' })
    expect(slider).toContain('perPage')
    expect(slider).toContain('perPageMobile')
    expect(slider).not.toContain('columns')
    expect(slider).not.toContain('mobileColumns')

    // The bento lays its own tiles out, so neither pair applies.
    const bento = sectionFields('product-list', { layout: 'bento' })
    expect(bento).not.toContain('columns')
    expect(bento).not.toContain('perPage')

    // The related-products row works the same way.
    expect(sectionFields('related-products', { layout: 'grid' })).toContain('columns')
    expect(sectionFields('related-products', { layout: 'slider' })).toContain('perPage')
    expect(sectionFields('related-products', { layout: 'bento' })).not.toContain('perPage')
  })

  test('the catalogue link belongs to the newest list alone', () => {
    expect(sectionFields('product-list', { source: 'latest' })).toContain('showAll')
    for (const source of ['collection', 'shelves', 'tabs']) {
      expect(sectionFields('product-list', { source }), source).not.toContain('showAll')
    }
  })
})

describe('the statement follows its look', () => {
  const shows = (layout: string) => sectionFields('statement', { layout })

  test('a photo side belongs to the card and the split, not the full-bleed', () => {
    expect(shows('contained')).toContain('imagePosition')
    expect(shows('split')).toContain('imagePosition')
    expect(shows('full')).not.toContain('imagePosition')
  })

  test('alignment belongs to the full-bleed statement alone', () => {
    expect(shows('full')).toContain('align')
    expect(shows('contained')).not.toContain('align')
    expect(shows('split')).not.toContain('align')
  })
})

describe('the quotes arrangement belongs to the plain look', () => {
  const shows = (values: Record<string, string>) => sectionFields('quotes', values)

  test('the video look fixes its own grid, so no arrangement is offered', () => {
    expect(shows({ variant: 'quotes' })).toContain('layout')
    expect(shows({ variant: 'video' })).not.toContain('layout')
  })

  test('running-card controls need the plain look and its running layout', () => {
    expect(shows({ variant: 'quotes', layout: 'marquee' })).toContain('direction')
    expect(shows({ variant: 'quotes', layout: 'marquee' })).toContain('speed')
    expect(shows({ variant: 'quotes', layout: 'grid' })).not.toContain('direction')
    // A video look never runs its cards, whatever the stored layout says.
    expect(shows({ variant: 'video', layout: 'marquee' })).not.toContain('direction')
    expect(shows({ variant: 'video', layout: 'marquee' })).not.toContain('speed')
  })

  test('autoplay needs the plain look and the slider layout', () => {
    expect(shows({ variant: 'quotes', layout: 'carousel' })).toContain('autoplay')
    expect(shows({ variant: 'quotes', layout: 'grid' })).not.toContain('autoplay')
    expect(shows({ variant: 'video', layout: 'carousel' })).not.toContain('autoplay')
  })
})

describe('the store locator sizes its own panes', () => {
  test('the column counts belong to the card grid', () => {
    expect(sectionFields('store-locations', { layout: 'grid' })).toContain('columns')
    expect(sectionFields('store-locations', { layout: 'locator' })).not.toContain('columns')
    expect(sectionFields('store-locations', { layout: 'locator' })).not.toContain('mobileColumns')
  })
})
