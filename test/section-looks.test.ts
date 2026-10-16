/**
 * A section's fields must follow the look the seller picked.
 *
 * The quotes section is three sections wearing one name — `Testimonials`,
 * `VideoTestimonials` and `Press` — and each reads a different set of keys off
 * an item. Every field is stored whatever the look, so without `showWhen` the
 * editor drew all of them at once: press logos, video posters and customer
 * photos stacked under a plain quote. These tests pin what each look offers, by
 * interrogating the schema the way the editor does.
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
    expect(itemFields('quotes')).toEqual(['quote', 'author', 'avatar', 'role'])
  })

  test('a video quote asks for the video, not the press logo', () => {
    expect(itemFields('video')).toEqual(['quote', 'name', 'role', 'video', 'poster'])
  })

  test('press and awards asks for the source, logo and link', () => {
    expect(itemFields('press')).toEqual(['quote', 'source', 'logo', 'link'])
  })

  test('no look is offered a field it does not read', () => {
    // The bug as reported: every look showed every field.
    const offered = ['quotes', 'video', 'press'].flatMap(itemFields)
    for (const key of ['author', 'avatar', 'name', 'role', 'source', 'logo', 'video', 'poster']) {
      const looks = (['quotes', 'video', 'press'] as const).filter((look) =>
        itemFields(look).includes(key),
      )
      expect(offered).toContain(key)
      expect(looks.length).toBeGreaterThan(0)
      expect(looks.length).toBeLessThan(3)
    }
  })

  test('desktop columns belong to the video look alone', () => {
    // The other two fix their own grid, so the control would be a lie.
    expect(fieldsUnder('quotes', 'columns', 'variant', 'video', true)).toContain('columns')
    expect(fieldsUnder('quotes', 'columns', 'variant', 'quotes', true)).not.toContain('columns')
    expect(fieldsUnder('quotes', 'columns', 'variant', 'press', true)).not.toContain('columns')
  })
})

describe('the story section follows its style', () => {
  const itemFields = (style: string) => fieldsUnder('story', 'items', 'style', style, false)

  test('a chapter asks for its heading and body, a milestone for its date and title', () => {
    expect(itemFields('chapters')).toEqual(['image', 'heading', 'body'])
    expect(itemFields('timeline')).toEqual(['image', 'label', 'title', 'text'])
  })
})
