/**
 * Per-side settings drawn where they apply: a box with a value on each edge,
 * the way Figma and Webflow show spacing. "Space above" sits above the box,
 * "padding, sides" on its left and right, instead of five dropdowns in a
 * column whose names the seller has to map to edges in their head.
 *
 * Each value is still one of its field's options — the chip opens a menu of
 * them — so the stored style is exactly what the plain form would write. A key
 * may sit on two edges (padding, top and bottom), and both chips move together.
 */

import { Box, chakra, Menu, Portal, Text } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { LuCheck } from 'react-icons/lu'

import type { Field, FieldValues } from '../model/fields'
import { useEditorText } from './messages'

type Side = 'top' | 'right' | 'bottom' | 'left' | 'center'

export interface SidesLayer {
  /** Named in the box's corner: "Space outside", "Padding". */
  label: string
  /** The field key each edge edits; an edge without one is left blank. */
  sides: Partial<Record<Side, string>>
}

function SideChip({
  field,
  value,
  onChange,
}: {
  field: Field
  value: unknown
  onChange: (value: string) => void
}) {
  const { l } = useEditorText()
  if (field.kind !== 'select') return null
  const current = typeof value === 'string' ? value : field.default
  const option = field.options.find((candidate) => candidate.value === current)
  const atDefault = current === field.default
  const name = l(field.label)
  const text = option ? l(option.label) : current

  return (
    <Menu.Root onSelect={({ value: next }) => onChange(next)} positioning={{ placement: 'bottom' }}>
      <Menu.Trigger asChild>
        <chakra.button
          type="button"
          aria-label={`${name}: ${text}`}
          title={`${name}: ${text}`}
          maxW="full"
          minW="8"
          px="1.5"
          h="6"
          rounded="sm"
          fontSize="xs"
          fontVariantNumeric="tabular-nums"
          borderWidth="1px"
          borderStyle={atDefault ? 'dashed' : 'solid'}
          borderColor={atDefault ? 'border.emphasized' : 'transparent'}
          bg={atDefault ? 'bg.panel' : 'brand.subtle'}
          color={atDefault ? 'fg.subtle' : 'brand.fg'}
          fontWeight={atDefault ? 'normal' : 'medium'}
          cursor="pointer"
          _hover={{ bg: atDefault ? 'bg.muted' : 'brand.muted' }}
          _focusVisible={{ outline: '2px solid', outlineColor: 'brand.focusRing' }}
        >
          <Text as="span" truncate display="block">
            {/* A dash, not "Default" on every edge: the box reads as empty
                until something is set. */}
            {atDefault ? '–' : text}
          </Text>
        </chakra.button>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW="40" maxH="72" overflowY="auto">
            <Text px="2" pt="1" pb="1.5" fontSize="xs" color="fg.muted" fontWeight="medium">
              {name}
            </Text>
            {field.options.map((candidate) => (
              <Menu.Item key={candidate.value} value={candidate.value}>
                <Text flex="1">{l(candidate.label)}</Text>
                {candidate.value === current && <LuCheck />}
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  )
}

/** One ring of the box: its edges' chips around whatever sits inside. */
function Ring({
  layer,
  fields,
  values,
  onChange,
  inner,
  solid,
}: {
  layer: SidesLayer
  fields: readonly Field[]
  values: FieldValues
  onChange: (values: FieldValues) => void
  inner?: ReactNode
  solid?: boolean
}) {
  const chip = (side: Side) => {
    const key = layer.sides[side]
    const field = key ? fields.find((candidate) => candidate.key === key) : undefined
    if (!field) return null
    return (
      <SideChip
        field={field}
        value={values[field.key]}
        onChange={(next) => onChange({ ...values, [field.key]: next })}
      />
    )
  }

  return (
    <Box
      position="relative"
      display="grid"
      gridTemplateColumns="minmax(2.5rem, auto) minmax(0, 1fr) minmax(2.5rem, auto)"
      gridTemplateRows="auto auto auto"
      gridTemplateAreas={`". top ." "left middle right" ". bottom ."`}
      alignItems="center"
      justifyItems="center"
      gap="1"
      p="1.5"
      pt="5"
      rounded="md"
      borderWidth="1px"
      borderStyle={solid ? 'solid' : 'dashed'}
      borderColor="border.emphasized"
      bg={solid ? 'bg.panel' : 'bg.subtle'}
    >
      <Text
        position="absolute"
        top="1"
        left="2"
        fontSize="2xs"
        color="fg.subtle"
        textTransform="uppercase"
        letterSpacing="wider"
        pointerEvents="none"
      >
        {layer.label}
      </Text>
      <Box gridArea="top">{chip('top')}</Box>
      <Box gridArea="left">{chip('left')}</Box>
      <Box gridArea="middle" w="full" display="flex" justifyContent="center">
        {inner ?? (
          <Box
            minW="16"
            minH="8"
            px="2"
            rounded="sm"
            borderWidth="1px"
            borderColor="border.subtle"
            bg="bg.muted"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            {chip('center')}
          </Box>
        )}
      </Box>
      <Box gridArea="right">{chip('right')}</Box>
      <Box gridArea="bottom">{chip('bottom')}</Box>
    </Box>
  )
}

/**
 * The box itself: `outer` (when given) wraps `inner`, so margin reads around
 * padding as it does on the page.
 */
export function SidesBox({
  fields,
  values,
  onChange,
  outer,
  inner,
}: {
  fields: readonly Field[]
  values: FieldValues
  onChange: (values: FieldValues) => void
  outer?: SidesLayer
  inner: SidesLayer
}) {
  const innerRing = (
    <Ring layer={inner} fields={fields} values={values} onChange={onChange} solid />
  )
  if (!outer) return innerRing
  return (
    <Ring
      layer={outer}
      fields={fields}
      values={values}
      onChange={onChange}
      inner={<Box w="full">{innerRing}</Box>}
    />
  )
}
