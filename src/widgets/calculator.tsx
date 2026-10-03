/**
 * Calculator — a custom block that keeps its own state.
 *
 * The working part is a pure reducer (`pressCalculator`) so the arithmetic is
 * tested without a DOM; the component is a thin keypad over it. The schema is
 * a custom `BlockSchema`, registered in `./index`, so the editor's settings
 * form, the sanitiser and the AI planner treat it like any built-in block.
 */

import { Box, SimpleGrid, Stack, Text, Button } from '@chakra-ui/react'
import { useState } from 'react'

import type { BlockSchema } from '../model/fields'
import { readText } from '../model/fields'
import { registerWidget, type BlockRendererProps } from '../render/block-registry'

export type CalculatorOperator = '+' | '-' | '×' | '÷'

export type CalculatorKey =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '.'
  | 'C'
  | '±'
  | '%'
  | CalculatorOperator
  | '='

export interface CalculatorState {
  /** What the screen shows. */
  display: string
  /** The left operand of a pending operation. */
  accumulator: number | null
  operator: CalculatorOperator | null
  /** True right after an operator or `=`, so the next digit starts fresh. */
  fresh: boolean
}

export const INITIAL_CALCULATOR: CalculatorState = {
  display: '0',
  accumulator: null,
  operator: null,
  fresh: true,
}

/** Digits shown before a number is abbreviated. */
const MAX_DIGITS = 12

/**
 * A float as a short display string: `0.30000000000000004` reads `0.3`, and
 * anything past the digit budget becomes scientific notation rather than a
 * screen-wide number.
 */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return 'Error'
  const rounded = Number(value.toPrecision(12))
  const text = String(rounded)
  return text.length > MAX_DIGITS + 2 ? value.toExponential(6) : text
}

function operate(
  left: number,
  right: number,
  operator: CalculatorOperator,
): number {
  switch (operator) {
    case '+':
      return left + right
    case '-':
      return left - right
    case '×':
      return left * right
    case '÷':
      return right === 0 ? Number.POSITIVE_INFINITY : left / right
  }
}

/** The next state after pressing one key. Total: every key is handled. */
export function pressCalculator(state: CalculatorState, key: CalculatorKey): CalculatorState {
  // An error clears on the next digit, not on the next operator.
  if (state.display === 'Error') {
    if (key === 'C') return INITIAL_CALCULATOR
    if (key === '+' || key === '-' || key === '×' || key === '÷' || key === '=') return state
    return pressCalculator(INITIAL_CALCULATOR, key)
  }

  switch (key) {
    case 'C':
      return INITIAL_CALCULATOR
    case '±':
      return { ...state, display: formatNumber(-Number(state.display)) }
    case '%':
      return { ...state, display: formatNumber(Number(state.display) / 100) }
    case '.':
      if (state.fresh) return { ...state, display: '0.', fresh: false }
      return state.display.includes('.') ? state : { ...state, display: `${state.display}.` }
    case '=': {
      if (state.operator === null || state.accumulator === null) {
        return { ...state, fresh: true }
      }
      const result = operate(state.accumulator, Number(state.display), state.operator)
      return { ...INITIAL_CALCULATOR, display: formatNumber(result) }
    }
    case '+':
    case '-':
    case '×':
    case '÷': {
      // Pressing an operator chains: apply whatever was pending first.
      const accumulator =
        state.operator !== null && state.accumulator !== null && !state.fresh
          ? operate(state.accumulator, Number(state.display), state.operator)
          : (state.accumulator ?? Number(state.display))
      return {
        display: formatNumber(accumulator),
        accumulator,
        operator: key,
        fresh: true,
      }
    }
    default: {
      if (state.fresh) return { ...state, display: key, fresh: false }
      if (state.display.replace(/[-.]/g, '').length >= MAX_DIGITS) return state
      return {
        ...state,
        display: state.display === '0' ? key : state.display + key,
      }
    }
  }
}

/** The keypad, in reading order; `=` spans the last two cells. */
const KEYS: readonly CalculatorKey[] = [
  'C',
  '±',
  '%',
  '÷',
  '7',
  '8',
  '9',
  '×',
  '4',
  '5',
  '6',
  '-',
  '1',
  '2',
  '3',
  '+',
  '0',
  '.',
  '=',
]

const OPERATORS: readonly string[] = ['÷', '×', '-', '+', '=']
const FUNCTIONS: readonly string[] = ['C', '±', '%']

export const calculatorSchema: BlockSchema = {
  type: 'widget-calculator',
  name: { en: 'Calculator', id: 'Kalkulator' },
  description: {
    en: 'A working calculator visitors can use, on the page or in a popup.',
    id: 'Kalkulator yang bisa dipakai pengunjung, di halaman atau popup.',
  },
  fields: [
    {
      kind: 'text',
      key: 'title',
      label: { en: 'Title', id: 'Judul' },
      help: { en: 'Optional, shown above the keypad.', id: 'Opsional, tampil di atas tombol.' },
      max: 60,
      default: '',
    },
  ],
}

export function Calculator({ block }: BlockRendererProps) {
  const title = readText(block.settings, 'title')
  const [state, setState] = useState<CalculatorState>(INITIAL_CALCULATOR)

  return (
    <Stack gap="3" data-widget="calculator" maxW="xs">
      {title && (
        <Text fontWeight="semibold" fontSize="sm">
          {title}
        </Text>
      )}
      <Box
        bg="bg.subtle"
        rounded="l2"
        px="4"
        py="3"
        textAlign="right"
        fontSize="2xl"
        fontVariantNumeric="tabular-nums"
        overflow="hidden"
        aria-live="polite"
      >
        {state.display}
      </Box>
      <SimpleGrid columns={4} gap="2">
        {KEYS.map((key) => (
          <Button
            key={key}
            size="sm"
            variant={OPERATORS.includes(key) ? 'solid' : FUNCTIONS.includes(key) ? 'subtle' : 'outline'}
            colorPalette={OPERATORS.includes(key) ? 'brand' : 'gray'}
            gridColumn={key === '=' ? 'span 2' : undefined}
            onClick={() => setState((current) => pressCalculator(current, key))}
          >
            {key}
          </Button>
        ))}
      </SimpleGrid>
    </Stack>
  )
}

/** Registers the schema and its renderer. Idempotent; see `./index`. */
export function registerCalculator(): void {
  registerWidget(calculatorSchema, Calculator)
}
