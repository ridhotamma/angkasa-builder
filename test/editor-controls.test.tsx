import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'

import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

import { ChoiceCards, ToggleCards } from '../src/editor/choice-cards'
import { ColorInput, FieldsForm } from '../src/editor/controls'
import { FieldGroups, resetGroup } from '../src/editor/field-groups'
import { optionPictures } from '../src/editor/option-pictures'
import { BLOCK_STYLE_GROUPS } from '../src/model/block-style'
import { sectionSchema } from '../src/model/sections'
import type { EditorServices } from '../src/editor/services'
import type { Field as FieldSpec, FieldValues } from '../src/model/fields'
import {
  SECTION_STYLE_FIELDS,
  SECTION_STYLE_GROUPS,
  SWITCHED_OFF_STYLE_KEYS,
  VISIBILITY_STYLE_KEYS,
} from '../src/model/section-style'

function render(node: ReactNode): string {
  return renderToString(<ChakraProvider value={system}>{node}</ChakraProvider>)
}

/**
 * Regression: a colour field with an empty default — "nothing overridden yet"
 * — must render rather than hand `parseColor` an empty string and throw.
 */
describe('ColorInput', () => {
  test('an empty value renders an empty picker', () => {
    expect(() => render(<ColorInput value="" onChange={() => undefined} />)).not.toThrow()
  })

  test('a stored hex renders through', () => {
    const html = render(<ColorInput value="#ff0000" onChange={() => undefined} />)
    expect(html).toContain('color-picker')
    expect(html.toLowerCase()).toContain('ff0000')
  })

  test('an unparseable value degrades to empty instead of throwing', () => {
    expect(() =>
      render(<ColorInput value="not-a-colour" onChange={() => undefined} />),
    ).not.toThrow()
  })
})

/**
 * What the Styles tab offers, and how much it says.
 *
 * The panel is a column of short controls: a hint that runs to a paragraph is
 * the wall of text this pins against. Switched-off features (`sticky`,
 * `textShadow`, `stagger`) stay in the schema — the sanitiser and the renderer
 * keep reading them — but must not appear here.
 */
describe('the Styles tab fields', () => {
  const offered = SECTION_STYLE_FIELDS.map((field) => field.key).filter(
    (key) =>
      !(VISIBILITY_STYLE_KEYS as readonly string[]).includes(key) &&
      !SWITCHED_OFF_STYLE_KEYS.includes(key),
  )

  test('never offers a field whose feature is switched off', () => {
    for (const key of SWITCHED_OFF_STYLE_KEYS) {
      expect(offered, key).not.toContain(key)
      expect(
        SECTION_STYLE_FIELDS.map((field) => field.key),
        key,
      ).toContain(key)
    }
  })

  test('keeps every hint to a short line', () => {
    for (const field of SECTION_STYLE_FIELDS) {
      if (field.help) {
        expect(field.help.en.length, `${field.key} (en)`).toBeLessThanOrEqual(80)
        expect(field.help.id.length, `${field.key} (id)`).toBeLessThanOrEqual(90)
      }
    }
  })
})

/**
 * The inspector's compact controls: a short choice shows every answer as a
 * segment, a long one stays a dropdown, help waits behind an ⓘ, and a value
 * off its default carries a reset.
 */
describe('FieldsForm controls', () => {
  const services = {} as EditorServices
  const form = (fields: readonly FieldSpec[], values: FieldValues = {}) =>
    render(
      <I18nProvider locale="en" resources={{}}>
        <FieldsForm fields={fields} values={values} services={services} onChange={() => {}} />
      </I18nProvider>,
    )
  const select = (labels: string[], extra: Partial<FieldSpec> = {}): FieldSpec =>
    ({
      kind: 'select',
      key: 'choice',
      label: { en: 'Choice', id: 'Pilihan' },
      options: labels.map((label, index) => ({
        value: String(index),
        label: { en: label, id: label },
      })),
      default: '0',
      ...extra,
    }) as FieldSpec

  test('a handful of short options become a segmented row', () => {
    const html = form([select(['2', '3', '4', '5', '6'])])
    expect(html).toContain('segment-group')
    expect(html).not.toContain('data-scope="select"')
  })

  test('long or many options stay a dropdown', () => {
    expect(form([select(['All devices', 'Phones only', 'Tablets and desktops only'])])).toContain(
      'data-scope="select"',
    )
    expect(form([select(['a', 'b', 'c', 'd', 'e', 'f', 'g'])])).toContain('data-scope="select"')
  })

  test('help sits behind an info hint, not under the field', () => {
    const html = form([select(['Grid', 'Slider'], { help: { en: 'Pick one', id: 'Pilih satu' } })])
    expect(html).toMatch(/About this setting/)
    expect(html).not.toContain('Pick one')
  })

  test('a changed value carries no per-row marker or reset', () => {
    const html = form([select(['Grid', 'Slider'])], { choice: '1' })
    expect(html).not.toMatch(/Reset to default/)
  })
})

/**
 * The Style tab's folds must cover what it offers: a field in no group would
 * vanish from the editor, and one in two would draw twice.
 */
describe('the Style tab groups', () => {
  test('hold every offered style field exactly once', () => {
    const offered = SECTION_STYLE_FIELDS.map((field) => field.key).filter(
      (key) => !(VISIBILITY_STYLE_KEYS as readonly string[]).includes(key),
    )
    const grouped = SECTION_STYLE_GROUPS.flatMap((group) => group.keys)
    expect(new Set(grouped).size).toBe(grouped.length)
    expect([...grouped].sort()).toEqual([...offered].sort())
  })
})

describe('FieldGroups', () => {
  const services = {} as EditorServices
  const fields: FieldSpec[] = [
    {
      kind: 'select',
      key: 'width',
      label: { en: 'Width', id: 'Lebar' },
      options: [
        { value: 'contained', label: { en: 'Page width', id: 'Selebar halaman' } },
        { value: 'edge', label: { en: 'Edge to edge', id: 'Tepi ke tepi' } },
      ],
      default: 'contained',
    },
  ]
  const groups = (advanced = false) => [
    { key: 'size', label: { en: 'Size', id: 'Ukuran' }, fields, advanced },
  ]
  const draw = (values: FieldValues, advanced = false) =>
    render(
      <I18nProvider locale="en" resources={{}}>
        <FieldGroups groups={groups(advanced)} values={values} services={services} onChange={() => {}} />
      </I18nProvider>,
    )

  test('a closed group summarises what it is set to', () => {
    expect(draw({ width: 'edge' })).toContain('Edge to edge')
    expect(draw({ width: 'contained' })).toContain('Default')
  })

  test('an open group with changes offers one reset; an unchanged one none', () => {
    const open = (values: FieldValues) =>
      render(
        <I18nProvider locale="en" resources={{}}>
          <FieldGroups
            groups={groups()}
            values={values}
            services={services}
            defaultOpen={['size']}
            onChange={() => {}}
          />
        </I18nProvider>,
      )
    expect(open({ width: 'edge' }).match(/Reset to default/g)).toHaveLength(1)
    expect(open({ width: 'contained' })).not.toContain('Reset to default')
  })

  test('a group resets only its own changed settings', () => {
    const [group] = groups()
    expect(resetGroup(group!, { width: 'edge', other: 'kept' })).toEqual({
      width: 'contained',
      other: 'kept',
    })
  })

  test('an advanced group waits behind the toggle until it is set', () => {
    expect(draw({}, true)).not.toContain('Size')
    expect(draw({}, true)).toContain('Show advanced settings')
    expect(draw({ width: 'edge' }, true)).toContain('Size')
  })
})

describe('ChoiceCards', () => {
  const choices = [
    { value: 'sm', label: 'Small', preview: null },
    { value: 'lg', label: 'Large', preview: null, hint: 'Large — roomy' },
  ] as const

  test('is a radio group with the current answer checked', () => {
    const html = render(
      <ChoiceCards label="Corners" value="lg" onChange={() => {}} choices={choices} />,
    )
    expect(html).toContain('role="radiogroup"')
    expect(html).toMatch(/aria-checked="true"[^>]*aria-label="Large — roomy"/)
    expect(html).toMatch(/aria-checked="false"[^>]*aria-label="Small"/)
  })

  test('toggle cards check every picked answer', () => {
    const html = render(
      <ToggleCards label="Hover" values={['sm', 'lg']} onChange={() => {}} choices={choices} />,
    )
    expect(html.match(/role="checkbox"/g)).toHaveLength(2)
    expect(html.match(/aria-checked="true"/g)).toHaveLength(2)
  })
})

describe('option pictures', () => {
  const field = (type: string, key: string) => {
    const schema = sectionSchema(type)!
    return schema.fields.find((candidate) => candidate.key === key) as never
  }

  test('layouts, ratios and alignments are drawn', () => {
    expect(optionPictures(field('product-list', 'layout'))).toHaveLength(3)
    expect(optionPictures(field('gallery', 'layout'))).toHaveLength(3)
    expect(optionPictures(field('cards', 'imageRatio'))).toHaveLength(3)
    expect(optionPictures(field('cards', 'align'))).toHaveLength(2)
  })

  test('a select with an option nothing draws keeps its usual control', () => {
    const custom = {
      kind: 'select',
      key: 'layout',
      label: { en: 'Layout', id: 'Tata letak' },
      options: [
        { value: 'grid', label: { en: 'Grid', id: 'Kisi' } },
        { value: 'spiral', label: { en: 'Spiral', id: 'Spiral' } },
      ],
      default: 'grid',
    } as const
    expect(optionPictures(custom)).toBeNull()
  })

  test('block style overrides, which start at "Default", are never pictures', () => {
    for (const group of BLOCK_STYLE_GROUPS) {
      for (const styleField of group.fields) {
        if (styleField.kind === 'select') expect(optionPictures(styleField), styleField.key).toBeNull()
      }
    }
  })
})
