/**
 * The selected block's style overrides, in the settings panel.
 *
 * Every property is generated from the same `Field` list the sanitiser uses
 * (`model/block-style.ts`), grouped so the panel stays short. Only what was
 * overridden is stored: setting a control back to "Default" drops the key
 * instead of writing a no-op, and "Clear overrides" returns the block to
 * exactly what its section draws.
 *
 * A custom `blocks` field may allow a subset of the properties; the panel
 * renders only the groups it finds in `fields`.
 */

import { Accordion, Badge, Button, HStack, Stack, Text } from '@chakra-ui/react'
import { useMemo } from 'react'

import { BLOCK_STYLE_GROUPS } from '../model/block-style'
import { defaultValues, type Field, type FieldValues } from '../model/fields'
import { FieldsForm } from './controls'
import { useEditorText } from './messages'
import type { EditorServices } from './services'

/** `values` with defaults and empty entries dropped; `undefined` when nothing is left. */
function overridesOf(fields: readonly Field[], values: FieldValues): FieldValues | undefined {
  const defaults = defaultValues(fields)
  const out: FieldValues = {}
  for (const field of fields) {
    const value = values[field.key]
    if (value === undefined) continue
    if (JSON.stringify(value) === JSON.stringify(defaults[field.key])) continue
    out[field.key] = value
  }
  return Object.keys(out).length > 0 ? out : undefined
}

export function BlockStylePanel({
  fields,
  values,
  onChange,
  services,
}: {
  /** The properties this block's field allows; an empty list renders nothing. */
  fields: readonly Field[]
  /** The stored overrides; an empty object when there are none. */
  values: FieldValues
  /** `undefined` clears every override. */
  onChange: (values: FieldValues | undefined) => void
  services: EditorServices
}) {
  const { t, l } = useEditorText()
  const allowed = useMemo(() => new Set(fields.map((field) => field.key)), [fields])
  const groups = useMemo(
    () =>
      BLOCK_STYLE_GROUPS.map((group) => ({
        key: group.key,
        label: group.label,
        fields: group.fields.filter((field) => allowed.has(field.key)),
      })).filter((group) => group.fields.length > 0),
    [allowed],
  )
  if (groups.length === 0) return null
  const overridden = Object.keys(values).length

  return (
    <Stack gap="3" borderTopWidth="1px" borderColor="border.subtle" pt="4">
      <HStack justify="space-between" gap="2">
        <Text fontWeight="semibold" fontSize="sm">
          {t('blockStyle')}
        </Text>
        {overridden > 0 && (
          <Button
            size="2xs"
            variant="ghost"
            colorPalette="danger"
            onClick={() => onChange(undefined)}
          >
            {t('blockStyleReset')}
          </Button>
        )}
      </HStack>
      <Text fontSize="xs" color="fg.muted">
        {t('blockStyleHelp')}
      </Text>
      <Accordion.Root multiple>
        {groups.map((group) => {
          const count = group.fields.filter((field) => values[field.key] !== undefined).length
          return (
            <Accordion.Item key={group.key} value={group.key}>
              <Accordion.ItemTrigger>
                <Text flex="1" fontSize="sm">
                  {l(group.label)}
                </Text>
                {count > 0 && (
                  <Badge size="xs" colorPalette="brand">
                    {count}
                  </Badge>
                )}
                <Accordion.ItemIndicator />
              </Accordion.ItemTrigger>
              <Accordion.ItemContent>
                <Accordion.ItemBody pb="2">
                  <Stack gap="3">
                    <FieldsForm
                      fields={group.fields}
                      values={values}
                      services={services}
                      onChange={(next) => onChange(overridesOf(fields, next))}
                    />
                  </Stack>
                </Accordion.ItemBody>
              </Accordion.ItemContent>
            </Accordion.Item>
          )
        })}
      </Accordion.Root>
    </Stack>
  )
}
