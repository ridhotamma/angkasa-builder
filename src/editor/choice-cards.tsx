/**
 * Options as pictures: a grid of cards, each a small drawing of what the
 * option does and its name under it — a rounded corner, an outlined button, a
 * wide page. For a choice a seller understands faster by seeing it than by
 * reading it; a dropdown hides every answer but the current one.
 *
 * One answer (`value`) is a radio group: arrow keys move between cards, as a
 * native radio group's do. Several (`values`) is a set of toggles.
 */

import { Box, chakra, SimpleGrid, Text } from '@chakra-ui/react'
import { useRef, type KeyboardEvent, type ReactNode } from 'react'

export interface Choice<T extends string> {
  value: T
  label: string
  /** The drawing: sized to fill the card's picture area. */
  preview: ReactNode
  /** The option's full description, when the label is its short name. */
  hint?: string
}

function ChoiceCard({
  label,
  hint,
  preview,
  checked,
  role,
  tabbable,
  disabled = false,
  onPick,
  onKeyDown,
  cardRef,
}: {
  label: string
  hint?: string
  preview: ReactNode
  checked: boolean
  role: 'radio' | 'checkbox'
  tabbable: boolean
  disabled?: boolean
  onPick: () => void
  onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void
  cardRef?: (node: HTMLButtonElement | null) => void
}) {
  return (
    <chakra.button
      ref={cardRef}
      type="button"
      role={role}
      aria-checked={checked}
      aria-label={hint ?? label}
      title={hint}
      tabIndex={tabbable ? 0 : -1}
      disabled={disabled}
      onClick={onPick}
      onKeyDown={onKeyDown}
      display="flex"
      flexDirection="column"
      alignItems="center"
      gap="1.5"
      minW="0"
      p="2"
      pb="1.5"
      rounded="lg"
      // The pick is a ring, not a fill: a tinted card with tinted text reads
      // as a warning. A second px of ring is drawn as a shadow, so the card
      // does not shift when it is picked.
      borderWidth="1px"
      borderColor={checked ? 'brand.solid' : 'border'}
      boxShadow={checked ? '0 0 0 1px var(--chakra-colors-brand-solid)' : undefined}
      bg="bg.panel"
      // The drawing follows `currentColor`: the brand when picked, quiet otherwise.
      color={checked ? 'brand.solid' : 'fg.subtle'}
      cursor={disabled ? 'default' : 'pointer'}
      opacity={disabled ? 0.55 : 1}
      transition="border-color 120ms, box-shadow 120ms, background 120ms"
      _hover={
        disabled || checked ? undefined : { borderColor: 'border.emphasized', bg: 'bg.subtle' }
      }
      _focusVisible={{
        outline: '2px solid',
        outlineColor: 'brand.focusRing',
        outlineOffset: '1px',
      }}
    >
      <Box
        w="full"
        h="12"
        display="flex"
        alignItems="center"
        justifyContent="center"
        pointerEvents="none"
      >
        {preview}
      </Box>
      <Text
        fontSize="xs"
        fontWeight={checked ? 'semibold' : 'medium'}
        lineClamp="2"
        lineHeight="short"
        textAlign="center"
        color={checked ? 'fg' : 'fg.muted'}
      >
        {label}
      </Text>
    </chakra.button>
  )
}

/** One answer from a few, as picture cards. */
export function ChoiceCards<T extends string>({
  label,
  value,
  onChange,
  choices,
  columns = 2,
  disabled = false,
}: {
  /** Names the group for assistive tech; the visible label is the caller's. */
  label: string
  value: T
  onChange: (value: T) => void
  choices: readonly Choice<T>[]
  columns?: number
  disabled?: boolean
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const current = Math.max(
    0,
    choices.findIndex((choice) => choice.value === value),
  )

  // A radio group's keys: the arrows move the choice along, wrapping.
  const onKeyDown = (index: number) => (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0
    if (!step) return
    event.preventDefault()
    const next = (index + step + choices.length) % choices.length
    onChange(choices[next]!.value)
    refs.current[next]?.focus()
  }

  return (
    <SimpleGrid columns={columns} gap="2" role="radiogroup" aria-label={label}>
      {choices.map((choice, index) => (
        <ChoiceCard
          key={choice.value}
          label={choice.label}
          hint={choice.hint}
          preview={choice.preview}
          checked={choice.value === value}
          role="radio"
          tabbable={index === current}
          disabled={disabled}
          onPick={() => onChange(choice.value)}
          onKeyDown={onKeyDown(index)}
          cardRef={(node) => {
            refs.current[index] = node
          }}
        />
      ))}
    </SimpleGrid>
  )
}

/** Any number of a few, as picture cards that toggle. */
export function ToggleCards<T extends string>({
  label,
  values,
  onChange,
  choices,
  columns = 3,
  disabled = false,
}: {
  label: string
  values: readonly T[]
  /** The new selection, in the order `choices` lists them. */
  onChange: (values: T[]) => void
  choices: readonly Choice<T>[]
  columns?: number
  disabled?: boolean
}) {
  return (
    <SimpleGrid columns={columns} gap="2" role="group" aria-label={label}>
      {choices.map((choice) => {
        const checked = values.includes(choice.value)
        return (
          <ChoiceCard
            key={choice.value}
            label={choice.label}
            hint={choice.hint}
            preview={choice.preview}
            checked={checked}
            role="checkbox"
            tabbable={!disabled}
            disabled={disabled}
            onPick={() =>
              onChange(
                choices
                  .map((candidate) => candidate.value)
                  .filter((candidate) =>
                    candidate === choice.value ? !checked : values.includes(candidate),
                  ),
              )
            }
          />
        )
      })}
    </SimpleGrid>
  )
}
