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
 * renders only the groups it finds in `fields`. Spacing and offsets draw as a
 * box with a value on each edge, and the CSS-shaped groups (positioning,
 * blending) stay behind "Advanced" until one of them is set.
 */

import { Button, HStack, Stack, Text } from '@chakra-ui/react'
import { useMemo } from 'react'

import { BLOCK_STYLE_GROUPS } from '../model/block-style'
import { defaultValues, type Field, type FieldValues } from '../model/fields'
import { FieldsForm } from './controls'
import { FieldGroups } from './field-groups'
import { useEditorText } from './messages'
import type { EditorServices } from './services'
import { SidesBox } from './sides-box'

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
        advanced: group.advanced,
        fields: group.fields.filter((field) => allowed.has(field.key)),
      })).filter((group) => group.fields.length > 0),
    [allowed],
  )
  if (groups.length === 0) return null
  const change = (next: FieldValues) => onChange(overridesOf(fields, next))
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
      <FieldGroups
        groups={groups}
        values={values}
        services={services}
        onChange={change}
        renderBody={(group) => {
          // Spacing and offsets are per-edge settings: drawn on a box, where
          // each one sits on the edge it moves.
          if (group.key === 'spacing') {
            return (
              <SidesBox
                fields={group.fields}
                values={values}
                onChange={change}
                outer={{
                  label: t('sidesOutside'),
                  sides: { top: 'marginTop', bottom: 'marginBottom' },
                }}
                inner={{
                  label: t('sidesInside'),
                  sides: {
                    top: 'paddingY',
                    bottom: 'paddingY',
                    left: 'paddingX',
                    right: 'paddingX',
                    center: 'padding',
                  },
                }}
              />
            )
          }
          if (group.key === 'position') {
            const offsets = new Set(['inset', 'top', 'right', 'bottom', 'left'])
            return (
              <>
                <FieldsForm
                  fields={group.fields.filter((field) => !offsets.has(field.key))}
                  values={values}
                  services={services}
                  onChange={change}
                />
                <SidesBox
                  fields={group.fields}
                  values={values}
                  onChange={change}
                  inner={{
                    label: t('sidesOffset'),
                    sides: {
                      top: 'top',
                      right: 'right',
                      bottom: 'bottom',
                      left: 'left',
                      center: 'inset',
                    },
                  }}
                />
              </>
            )
          }
          return undefined
        }}
      />
    </Stack>
  )
}
