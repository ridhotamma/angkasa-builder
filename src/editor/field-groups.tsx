/**
 * A long field list folded into named groups.
 *
 * Each group closes to its name and a one-line summary of what it is set to
 * ("Gradasi · Latar selebar layar"), so a tab of twenty settings opens as a
 * handful of rows the seller can read without opening any. Groups marked
 * `advanced` — positioning, blend modes — wait behind a toggle at the foot,
 * unless one of their settings is already in use, which never hides.
 */

import { Accordion, Badge, Button, Icon, Stack, Text } from '@chakra-ui/react'
import { useState, type ReactNode } from 'react'
import { LuChevronsDown, LuChevronsUp, LuRotateCcw } from 'react-icons/lu'

import {
  defaultValues,
  isFieldShown,
  type Field,
  type FieldValues,
  type JsonValue,
} from '../model/fields'
import type { Localized } from '../model/localized'
import { FieldsForm } from './controls'
import { useEditorText } from './messages'
import type { EditorServices } from './services'

export interface FieldGroup {
  key: string
  label: Localized
  fields: readonly Field[]
  advanced?: boolean
}

/** Whether a stored value differs from its field's default; a missing one does not. */
function isChanged(value: JsonValue | undefined, fallback: JsonValue | undefined): boolean {
  if (value === undefined) return false
  return JSON.stringify(value) !== JSON.stringify(fallback)
}

/** The fields of a group that are on screen and off their default. */
export function changedFields(group: FieldGroup, values: FieldValues): Field[] {
  const defaults = defaultValues(group.fields)
  return group.fields.filter(
    (field) => isFieldShown(field, values) && isChanged(values[field.key], defaults[field.key]),
  )
}

/** `values` with a group's changed settings put back to their defaults. */
export function resetGroup(group: FieldGroup, values: FieldValues): FieldValues {
  const defaults = defaultValues(group.fields)
  const next = { ...values }
  for (const field of changedFields(group, values)) {
    const fallback = defaults[field.key]
    if (fallback === undefined) delete next[field.key]
    else next[field.key] = fallback
  }
  return next
}

/** One changed setting, in a word or two: the picked option, or the field's own name. */
function describe(field: Field, value: JsonValue | undefined, l: (text: Localized) => string) {
  if (field.kind === 'select') {
    const option = field.options.find((candidate) => candidate.value === value)
    return option ? l(option.label) : l(field.label)
  }
  if (field.kind === 'number') return `${l(field.label)} ${String(value)}`
  if (field.kind === 'color' && typeof value === 'string') return value
  return l(field.label)
}

export function FieldGroups({
  groups,
  values,
  onChange,
  services,
  defaultOpen = [],
  renderBody,
}: {
  groups: readonly FieldGroup[]
  values: FieldValues
  onChange: (values: FieldValues) => void
  services: EditorServices
  /** The groups open when the panel first shows. */
  defaultOpen?: readonly string[]
  /** A group's own body in place of the generated form — a sides box, say. */
  renderBody?: (group: FieldGroup) => ReactNode | undefined
}) {
  const { t, l } = useEditorText()
  const [open, setOpen] = useState<string[]>(() => [...defaultOpen])
  const [showAdvanced, setShowAdvanced] = useState(false)

  const visible = groups.filter((group) => group.fields.length > 0)
  const advanced = visible.filter((group) => group.advanced)
  // A group with a setting in use stays on screen whatever the toggle says:
  // hiding it would hide why the block looks the way it does.
  const shown = visible.filter(
    (group) => !group.advanced || showAdvanced || changedFields(group, values).length > 0,
  )
  const hiddenCount = visible.length - shown.length

  return (
    <Stack gap="2">
      <Accordion.Root
        multiple
        collapsible
        value={open}
        onValueChange={({ value }) => setOpen(value)}
        variant="plain"
      >
        {shown.map((group) => {
          const changed = changedFields(group, values)
          const isOpen = open.includes(group.key)
          const summary =
            changed.length > 0
              ? changed.map((field) => describe(field, values[field.key], l)).join(' · ')
              : t('groupAtDefault')
          return (
            <Accordion.Item
              key={group.key}
              value={group.key}
              borderBottomWidth="1px"
              borderColor="border.subtle"
            >
              <Accordion.ItemTrigger py="2.5" gap="2" cursor="pointer">
                <Stack gap="0" flex="1" minW="0" align="stretch" textAlign="start">
                  <Text fontSize="sm" fontWeight="medium">
                    {l(group.label)}
                  </Text>
                  {!isOpen && (
                    <Text
                      fontSize="xs"
                      color={changed.length > 0 ? 'fg.muted' : 'fg.subtle'}
                      truncate
                    >
                      {summary}
                    </Text>
                  )}
                </Stack>
                {changed.length > 0 && (
                  <Badge size="xs" colorPalette="brand" variant="subtle">
                    {changed.length}
                  </Badge>
                )}
                <Accordion.ItemIndicator />
              </Accordion.ItemTrigger>
              <Accordion.ItemContent>
                <Accordion.ItemBody pt="1" pb="4">
                  <Stack gap="3">
                    {renderBody?.(group) ?? (
                      <FieldsForm
                        fields={group.fields}
                        values={values}
                        services={services}
                        onChange={onChange}
                      />
                    )}
                    {/* One way back per group, where the badge says something
                        changed — not a marker and a button on every row. */}
                    {changed.length > 0 && (
                      <Button
                        size="xs"
                        variant="ghost"
                        alignSelf="start"
                        ml="-2"
                        color="fg.muted"
                        onClick={() => onChange(resetGroup(group, values))}
                      >
                        <Icon as={LuRotateCcw} />
                        {t('groupReset')}
                      </Button>
                    )}
                  </Stack>
                </Accordion.ItemBody>
              </Accordion.ItemContent>
            </Accordion.Item>
          )
        })}
      </Accordion.Root>
      {advanced.length > 0 && (hiddenCount > 0 || showAdvanced) && (
        <Button
          size="xs"
          variant="ghost"
          alignSelf="start"
          color="fg.muted"
          onClick={() => setShowAdvanced((current) => !current)}
        >
          <Icon as={showAdvanced ? LuChevronsUp : LuChevronsDown} />
          {showAdvanced ? t('hideAdvanced') : `${t('showAdvanced')} (${hiddenCount})`}
        </Button>
      )}
    </Stack>
  )
}
