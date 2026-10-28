/**
 * The forms each panel screen holds, and what a submitted one does.
 *
 * `panelForms` lists the forms for the current selection — a section's
 * content, style and visibility; a block's settings and style; an element's
 * look; a linked copy's own content — each described with `describeFields`.
 * `formCommand` reads one of them back from a submission into the command
 * that applies it. Between the two an htmx editor needs no knowledge of the
 * schema: draw the forms, post one, apply the command, re-render.
 */

import { overridableFields, type SectionInstance } from '../model/content'
import {
  BUTTON_ELEMENT_DEFAULTS,
  BUTTON_ELEMENT_FIELDS,
  TEXT_ELEMENT_DEFAULTS,
  TEXT_ELEMENT_FIELDS,
} from '../model/element-style'
import type { Field, FieldValues } from '../model/fields'
import { FOOTER_FIELDS, HEADER_FIELDS, type ThemeLayout } from '../model/layout'
import { localize, type Localized, type StorefrontLocale } from '../model/localized'
import {
  SECTION_STYLE_FIELDS,
  SECTION_STYLE_GROUPS,
  SWITCHED_OFF_STYLE_KEYS,
  VISIBILITY_STYLE_KEYS,
} from '../model/section-style'
import type { EditorCommand } from './commands'
import { describeFields, readFormInput, type FormField, type FormInput } from './forms'
import { inspectSelection, type Inspection } from './inspect'
import type { EditorSelection } from './selection'

/** The Style tab's fields: everything but visibility and the switched-off features. */
export const STYLE_FIELDS: readonly Field[] = SECTION_STYLE_FIELDS.filter(
  (field) =>
    !(VISIBILITY_STYLE_KEYS as readonly string[]).includes(field.key) &&
    // Built-but-switched-off features are not offered; the model and the
    // renderer keep reading a stored value. See `SWITCHED_OFF_STYLE_KEYS`.
    !SWITCHED_OFF_STYLE_KEYS.includes(field.key),
)

/** One fold of the Style tab. */
export interface FieldGroupDefinition {
  key: string
  label: Localized
  fields: Field[]
}

/** The Style tab's folds, each holding the offered fields it names. */
export const STYLE_GROUPS: FieldGroupDefinition[] = SECTION_STYLE_GROUPS.map((group) => ({
  key: group.key,
  label: group.label,
  fields: STYLE_FIELDS.filter((field) => group.keys.includes(field.key)),
}))

/** The Visibility tab's fields. */
export const VISIBILITY_FIELDS: readonly Field[] = SECTION_STYLE_FIELDS.filter((field) =>
  (VISIBILITY_STYLE_KEYS as readonly string[]).includes(field.key),
)

/** Which form on the panel a submission is for. */
export type PanelFormId =
  | 'section-content'
  | 'section-style'
  | 'section-visibility'
  | 'section-overrides'
  | 'block'
  | 'block-style'
  | 'element'

export interface PanelForm {
  id: PanelFormId
  /** For the Style tab: its folds, each with its fields. */
  groups?: Array<{ key: string; label: string; fields: FormField[] }>
  fields: FormField[]
}

interface PanelFormSpec {
  id: PanelFormId
  fields: readonly Field[]
  values: FieldValues
  groups?: FieldGroupDefinition[]
}

/** The forms' fields and the values they edit, for the screen a selection opens. */
function formSpecs(inspection: Inspection): PanelFormSpec[] {
  const { panel, selected, source, resolved, schema, block } = inspection
  if (!selected || !schema) return []
  switch (panel.view) {
    case 'section':
      if (panel.linked) {
        const fields = overridableFields(schema.fields)
        return fields.length > 0
          ? [{ id: 'section-overrides', fields, values: resolved?.settings ?? selected.settings }]
          : []
      }
      return [
        { id: 'section-content', fields: schema.fields, values: selected.settings },
        { id: 'section-style', fields: STYLE_FIELDS, values: selected.style, groups: STYLE_GROUPS },
        { id: 'section-visibility', fields: VISIBILITY_FIELDS, values: selected.style },
      ]
    case 'block': {
      if (!block) return []
      const forms: PanelFormSpec[] = [
        { id: 'block', fields: block.schema.fields, values: block.block.settings },
      ]
      if (block.field.styleFields) {
        forms.push({
          id: 'block-style',
          fields: block.field.styleFields,
          values: block.block.style ?? {},
        })
      }
      return forms
    }
    case 'element': {
      const text = panel.kind === 'text'
      return [
        {
          id: 'element',
          fields: text ? TEXT_ELEMENT_FIELDS : BUTTON_ELEMENT_FIELDS,
          values:
            (source?.elements?.[panel.elementId] as FieldValues | undefined) ??
            ((text
              ? { ...TEXT_ELEMENT_DEFAULTS }
              : { ...BUTTON_ELEMENT_DEFAULTS }) as unknown as FieldValues),
        },
      ]
    }
    default:
      return []
  }
}

/** The forms the panel shows for this selection, ready to draw. */
export function panelForms(
  sections: readonly SectionInstance[],
  selection: EditorSelection,
  options: { locale: StorefrontLocale },
): PanelForm[] {
  const inspection = inspectSelection(sections, selection, { locale: options.locale })
  return formSpecs(inspection).map((spec) => ({
    id: spec.id,
    fields: describeFields(spec.fields, spec.values, { locale: options.locale }),
    groups: spec.groups?.map((group) => ({
      key: group.key,
      label: localize(group.label, options.locale),
      fields: describeFields(group.fields, spec.values, { locale: options.locale }),
    })),
  }))
}

/**
 * The command a submitted panel form stands for, or `null` when the form
 * does not belong to the current selection (a stale page, say).
 */
export function formCommand(
  sections: readonly SectionInstance[],
  selection: EditorSelection,
  form: PanelFormId,
  input: FormInput,
  options: { locale: StorefrontLocale },
): EditorCommand | null {
  const inspection = inspectSelection(sections, selection, { locale: options.locale })
  const spec = formSpecs(inspection).find((candidate) => candidate.id === form)
  const { selected, block } = inspection
  if (!spec || !selected) return null
  const values = readFormInput(spec.fields, spec.values, input, { locale: options.locale })
  switch (form) {
    case 'section-content':
      return { type: 'set-section-settings', id: selected.id, values }
    case 'section-style':
    case 'section-visibility':
      return { type: 'set-section-style', id: selected.id, style: values }
    case 'section-overrides':
      return { type: 'set-section-overrides', id: selected.id, values }
    case 'block':
      return block
        ? { type: 'set-block-settings', sectionId: selected.id, blockId: block.block.id, values }
        : null
    case 'block-style':
      return block
        ? {
            type: 'set-block-style',
            sectionId: selected.id,
            blockId: block.block.id,
            style: values,
          }
        : null
    case 'element':
      return selection.elementId
        ? { type: 'set-element', sectionId: selected.id, elementId: selection.elementId, values }
        : null
  }
}

/** The header's or footer's form, ready to draw. */
export function layoutForm(
  layout: ThemeLayout,
  part: 'header' | 'footer',
  options: { locale: StorefrontLocale },
): FormField[] {
  return describeFields(part === 'header' ? HEADER_FIELDS : FOOTER_FIELDS, layout[part], options)
}

/** The layout with a submitted header or footer form applied. */
export function readLayoutForm(
  layout: ThemeLayout,
  part: 'header' | 'footer',
  input: FormInput,
  options: { locale: StorefrontLocale },
): ThemeLayout {
  const fields = part === 'header' ? HEADER_FIELDS : FOOTER_FIELDS
  return { ...layout, [part]: readFormInput(fields, layout[part], input, options) }
}
