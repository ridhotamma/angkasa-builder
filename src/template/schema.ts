/**
 * `{% schema %}` — the bridge between a compiled section and the visual
 * editor.
 *
 * A compiled section's fields are declared in the template file, as JSON,
 * and compiled into the same `SectionSchema` every shipped section uses.
 * That single decision keeps the two authoring worlds from diverging: the
 * seller keeps the generated form, the AI planner keeps its catalogue, the
 * server keeps one sanitiser — and the compiled section only ever reads
 * `section.settings` values that already went through it.
 *
 * The same walk produces the settings' type, which is what lets the checker
 * refuse `section.settings.headng` at publish.
 */

import { BLOCK_STYLE_FIELDS } from '../model/block-style'
import { BLOCK_TYPES } from '../model/blocks'
import {
  defaultValues,
  type Field,
  type FieldValues,
  type ItemField,
  type ListField,
} from '../model/fields'
import type { Localized } from '../model/localized'
import { SECTION_CATEGORIES, type SectionSchema } from '../model/sections'
import type { Diagnostic } from './diagnostics'
import { error, warning } from './diagnostics'
import { dropAny, dropBoolean, dropList, dropNumber, dropString, type DropType } from './drops'

/** The most settings one compiled section may declare. */
export const MAX_SECTION_SETTINGS = 40

/** The field kinds a `{% schema %}` may declare. */
export const SCHEMA_FIELD_KINDS = [
  'text',
  'textarea',
  'richtext',
  'number',
  'select',
  'boolean',
  'color',
  'image',
  'link',
  'product',
  'video',
  'datetime',
  'table',
  'list',
  'blocks',
] as const

export type SchemaFieldKind = (typeof SCHEMA_FIELD_KINDS)[number]

export interface CompiledSectionSchema {
  /** The schema the editor, the sanitiser and the AI catalogue read. */
  schema: SectionSchema
  /** The type of `section.settings`, for the checker. */
  settingsType: DropType
  /** A fresh section's settings, exactly as `defaultValues` computes them. */
  defaults: FieldValues
}

export interface CompileSectionSchemaOptions {
  /** The section's type — the file's base name. */
  type: string
  file?: string
}

/**
 * Compiles a `{% schema %}` block. `raw` is `null` for a section without one
 * — which is allowed: a compiled section may be pure markup.
 */
export function compileSectionSchema(
  raw: string | null,
  options: CompileSectionSchemaOptions,
): { compiled: CompiledSectionSchema | null; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = []
  const { type, file } = options

  if (!raw || !raw.trim()) {
    return { compiled: null, diagnostics }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (cause) {
    diagnostics.push(
      error('invalid-schema', `{% schema %} is not valid JSON: ${describeError(cause)}`, file),
    )
    return { compiled: null, diagnostics }
  }
  if (!isRecord(parsed)) {
    diagnostics.push(error('invalid-schema', '{% schema %} must be a JSON object.', file))
    return { compiled: null, diagnostics }
  }

  const settingsInput = parsed.settings ?? []
  if (!Array.isArray(settingsInput)) {
    diagnostics.push(error('invalid-schema', 'The schema\'s "settings" must be an array.', file))
    return { compiled: null, diagnostics }
  }
  if (settingsInput.length > MAX_SECTION_SETTINGS) {
    diagnostics.push(
      error(
        'invalid-schema',
        `A section may declare at most ${MAX_SECTION_SETTINGS} settings; got ${settingsInput.length}.`,
        file,
      ),
    )
    return { compiled: null, diagnostics }
  }

  const fields: Field[] = []
  const settingsFields: Record<string, DropType> = {}
  const seen = new Set<string>()

  for (const [index, input] of settingsInput.entries()) {
    if (!isRecord(input)) {
      diagnostics.push(error('invalid-schema', `Setting ${index + 1} must be an object.`, file))
      continue
    }
    const key = typeof input.key === 'string' ? input.key : ''
    if (!/^[a-z][a-zA-Z0-9_]*$/.test(key)) {
      diagnostics.push(
        error(
          'invalid-schema',
          `Setting ${index + 1} has an invalid key "${key}"; keys are lower_snake_case.`,
          file,
        ),
      )
      continue
    }
    if (seen.has(key)) {
      diagnostics.push(error('invalid-schema', `Setting "${key}" is declared twice.`, file))
      continue
    }
    const kind = input.kind
    if (typeof kind !== 'string' || !(SCHEMA_FIELD_KINDS as readonly string[]).includes(kind)) {
      diagnostics.push(
        error(
          'invalid-schema',
          `Setting "${key}" has an unknown kind "${String(kind)}". Allowed: ${SCHEMA_FIELD_KINDS.join(', ')}.`,
          file,
        ),
      )
      continue
    }
    seen.add(key)
    const built = buildField(key, kind as SchemaFieldKind, input, file, diagnostics)
    if (!built) continue
    fields.push(built.field)
    settingsFields[key] = built.type
    for (const extra of built.warnings) diagnostics.push(extra)
  }

  const name = typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : type
  const description =
    typeof parsed.description === 'string' && parsed.description.trim()
      ? parsed.description.trim()
      : 'A compiled section.'
  const categoryInput = typeof parsed.category === 'string' ? parsed.category : 'layout'
  const category = (SECTION_CATEGORIES as readonly string[]).includes(categoryInput)
    ? (categoryInput as SectionSchema['category'])
    : 'layout'
  if (category !== categoryInput) {
    diagnostics.push(
      warning('invalid-schema', `Unknown category "${categoryInput}"; using "layout".`, file),
    )
  }
  const icon = typeof parsed.icon === 'string' && parsed.icon ? parsed.icon : 'blocks'

  const schema: SectionSchema = {
    type,
    name: localized(name),
    description: localized(description),
    category,
    icon,
    fields,
  }
  const compiled: CompiledSectionSchema = {
    schema,
    settingsType: { kind: 'record', fields: settingsFields },
    defaults: defaultValues(fields),
  }
  return { compiled, diagnostics }
}

/* -------------------------------------------------------------------------- */

function buildField(
  key: string,
  kind: SchemaFieldKind,
  input: Record<string, unknown>,
  file: string | undefined,
  diagnostics: Diagnostic[],
): { field: Field; type: DropType; warnings: Diagnostic[] } | null {
  const label = labelOf(input, key)
  const help = typeof input.help === 'string' && input.help ? localized(input.help) : undefined
  const base = { key, label, ...(help ? { help } : {}) }
  const warnings: Diagnostic[] = []

  switch (kind) {
    case 'text':
      return {
        field: {
          ...base,
          kind: 'text',
          max: bounded(input.max, 255, 1, 10_000),
          default: text(input.default),
        },
        type: dropString,
        warnings,
      }
    case 'textarea':
      return {
        field: {
          ...base,
          kind: 'textarea',
          max: bounded(input.max, 2000, 1, 20_000),
          default: text(input.default),
          rows: bounded(input.rows, 3, 2, 12),
        },
        type: dropString,
        warnings,
      }
    case 'richtext':
      return {
        field: {
          ...base,
          kind: 'richtext',
          max: bounded(input.max, 5000, 1, 20_000),
          default: text(input.default),
        },
        type: dropString,
        warnings,
      }
    case 'number':
      return {
        field: {
          ...base,
          kind: 'number',
          min: number(input.min, 0),
          max: number(input.max, 100),
          default: number(input.default, 0),
          ...(typeof input.step === 'number' ? { step: input.step } : {}),
        },
        type: dropNumber,
        warnings,
      }
    case 'select': {
      const optionsInput = Array.isArray(input.options) ? input.options : []
      const options = optionsInput
        .slice(0, 50)
        .map((option) => {
          if (typeof option === 'string')
            return { value: option, label: localized(humanize(option)) }
          if (isRecord(option) && typeof option.value === 'string') {
            return {
              value: option.value,
              label: localized(
                typeof option.label === 'string' && option.label
                  ? option.label
                  : humanize(option.value),
              ),
            }
          }
          return null
        })
        .filter((option): option is { value: string; label: Localized } => option !== null)
      if (!options.length) {
        diagnostics.push(
          error('invalid-schema', `Select "${key}" needs at least one option.`, file),
        )
        return null
      }
      const fallback = options[0]!.value
      const chosen = text(input.default)
      return {
        field: {
          ...base,
          kind: 'select',
          options,
          default: options.some((option) => option.value === chosen) ? chosen : fallback,
          ...(input.segment === true ? { segment: true } : {}),
        },
        type: dropString,
        warnings,
      }
    }
    case 'boolean':
      return {
        field: { ...base, kind: 'boolean', default: input.default === true },
        type: dropBoolean,
        warnings,
      }
    case 'color':
      return {
        field: {
          ...base,
          kind: 'color',
          default: /^#[0-9a-f]{6}$/i.test(text(input.default)) ? text(input.default) : '#000000',
        },
        type: dropString,
        warnings,
      }
    case 'image':
      return { field: { ...base, kind: 'image' }, type: dropString, warnings }
    case 'link':
      return { field: { ...base, kind: 'link' }, type: dropAny, warnings }
    case 'product':
      return { field: { ...base, kind: 'product' }, type: dropString, warnings }
    case 'video':
      return {
        field: {
          ...base,
          kind: 'video',
          ...(input.uploadOnly === true ? { uploadOnly: true } : {}),
        },
        type: dropAny,
        warnings,
      }
    case 'datetime':
      return { field: { ...base, kind: 'datetime' }, type: dropString, warnings }
    case 'table':
      return {
        field: {
          ...base,
          kind: 'table',
          maxColumns: bounded(input.maxColumns, 6, 1, 12),
          maxRows: bounded(input.maxRows, 20, 1, 100),
        },
        type: dropAny,
        warnings,
      }
    case 'list': {
      const itemInput = Array.isArray(input.fields) ? input.fields : []
      const itemFields: ItemField[] = []
      const itemTypes: Record<string, DropType> = {}
      for (const [index, raw] of itemInput.entries()) {
        if (!isRecord(raw) || typeof raw.key !== 'string' || typeof raw.kind !== 'string') {
          diagnostics.push(
            error(
              'invalid-schema',
              `List "${key}" item field ${index + 1} needs a key and a kind.`,
              file,
            ),
          )
          continue
        }
        if (raw.kind === 'list' || raw.kind === 'blocks') {
          diagnostics.push(
            error('invalid-schema', `List "${key}" cannot nest a "${raw.kind}" field.`, file),
          )
          continue
        }
        if (!(SCHEMA_FIELD_KINDS as readonly string[]).includes(raw.kind)) {
          diagnostics.push(
            error(
              'invalid-schema',
              `List "${key}" item field "${raw.key}" has an unknown kind "${raw.kind}".`,
              file,
            ),
          )
          continue
        }
        const built = buildField(raw.key, raw.kind as SchemaFieldKind, raw, file, diagnostics)
        if (!built) continue
        itemFields.push(built.field as ItemField)
        itemTypes[raw.key] = built.type
      }
      if (!itemFields.length) {
        diagnostics.push(
          error('invalid-schema', `List "${key}" needs at least one item field.`, file),
        )
        return null
      }
      const list: ListField = {
        ...base,
        kind: 'list',
        itemLabel: localized(text(input.itemLabel) || humanize(key)),
        titleKey:
          typeof input.titleKey === 'string' && input.titleKey
            ? input.titleKey
            : itemFields[0]!.key,
        max: bounded(input.max, 12, 1, 50),
        fields: itemFields,
      }
      return { field: list, type: dropList({ kind: 'record', fields: itemTypes }), warnings }
    }
    case 'blocks':
      return {
        field: {
          ...base,
          kind: 'blocks',
          max: bounded(input.max, 32, 1, 64),
          blocks: BLOCK_TYPES,
          styleFields: BLOCK_STYLE_FIELDS,
        },
        type: dropList(dropAny),
        warnings,
      }
  }
}

/* -------------------------------------------------------------------------- */

function labelOf(input: Record<string, unknown>, key: string): Localized {
  return localized(text(input.label) || humanize(key))
}

function localized(value: string): Localized {
  return { en: value, id: value }
}

function humanize(key: string): string {
  const words = key.replace(/[_-]+/g, ' ').trim()
  return words ? words[0]!.toUpperCase() + words.slice(1) : key
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function number(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function bounded(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = number(value, fallback)
  return Math.min(max, Math.max(min, Math.trunc(parsed)))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function describeError(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}
