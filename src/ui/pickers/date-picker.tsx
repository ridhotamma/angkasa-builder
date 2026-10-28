/**
 * A calendar day, chosen on Chakra's DatePicker, as a plain controlled value.
 *
 * The value is a `YYYY-MM-DD` string — the shape a native date input produced
 * and the shape the apps' schemas validate — so swapping a native input for
 * this changes the picking, not the data: a calendar that cannot offer the
 * 31st of February, next to an input whose segments the locale orders rather
 * than the browser.
 *
 * The popup offers day, month and year views, so a date from last year is
 * three clicks rather than twelve pages. Form bindings (react-hook-form and
 * the like) wrap this; it knows nothing about them.
 */

import { DatePicker as ChakraDatePicker, Icon, Portal } from '@chakra-ui/react'
import { parseDate, type CalendarDate } from '@internationalized/date'
import { useMemo, type Ref } from 'react'
import { LuCalendar } from 'react-icons/lu'

import { useDateInputMask } from './date-input-mask'

type ControlSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export interface DatePickerProps {
  /** `YYYY-MM-DD`, or an empty string. An ISO stamp is read by its day. */
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  /** BCP-47 tag (`en-US`, `id-ID`, …): orders the calendar and the input's segments. */
  locale?: string
  size?: ControlSize
  disabled?: boolean
  invalid?: boolean
  placeholder?: string
  /** `YYYY-MM-DD` — days before this cannot be picked. */
  min?: string
  /** `YYYY-MM-DD` — days after this cannot be picked. */
  max?: string
  name?: string
  /** The input, for a form library to focus on error. */
  inputRef?: Ref<HTMLInputElement>
  /** The DatePicker does not pick up `Field.Root`'s label wiring yet, so the label is passed here too. */
  ariaLabel?: string
  /** Shows a clear button once a day is set. On by default. */
  clearable?: boolean
}

/** A `YYYY-MM-DD` (or ISO stamp) as a `CalendarDate`, or `null` when it is not a real day. */
function toCalendarDate(raw: string | undefined): CalendarDate | null {
  const day = raw && /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : ''
  if (!day) return null
  try {
    // `parseDate` throws on anything that is not a real calendar day.
    return parseDate(day)
  } catch {
    return null
  }
}

export function DatePicker({
  value,
  onChange,
  onBlur,
  locale = 'en-US',
  size = 'md',
  disabled,
  invalid,
  placeholder,
  min,
  max,
  name,
  inputRef,
  ariaLabel,
  clearable = true,
}: DatePickerProps) {
  const mask = useDateInputMask(locale)
  const selected = useMemo(() => {
    const day = toCalendarDate(value)
    return day ? [day] : []
  }, [value])
  const minValue = useMemo(() => toCalendarDate(min) ?? undefined, [min])
  const maxValue = useMemo(() => toCalendarDate(max) ?? undefined, [max])

  return (
    <ChakraDatePicker.Root
      name={name}
      locale={locale}
      parse={mask.parse}
      // Clicking the field opens the calendar; typing still works.
      openOnClick
      value={selected}
      min={minValue}
      max={maxValue}
      invalid={invalid}
      disabled={disabled}
      size={size}
      // `valueAsString` is locale-formatted (`14 Sep 2026` in `id-ID`), not
      // `YYYY-MM-DD`. A `CalendarDate` stringifies to `YYYY-MM-DD` in every
      // locale, which is exactly the value's shape.
      onValueChange={(details) => onChange(details.value[0]?.toString() ?? '')}
    >
      <ChakraDatePicker.Control>
        <ChakraDatePicker.Input
          ref={inputRef}
          onBlur={onBlur}
          onInputCapture={mask.onInputCapture}
          aria-label={ariaLabel}
          placeholder={placeholder}
        />
        <ChakraDatePicker.IndicatorGroup>
          {clearable && selected.length > 0 && <ChakraDatePicker.ClearTrigger />}
          <ChakraDatePicker.Trigger>
            <Icon as={LuCalendar} />
          </ChakraDatePicker.Trigger>
        </ChakraDatePicker.IndicatorGroup>
      </ChakraDatePicker.Control>
      <Portal>
        <ChakraDatePicker.Positioner>
          <ChakraDatePicker.Content>
            <ChakraDatePicker.View view="day">
              <ChakraDatePicker.Header />
              <ChakraDatePicker.DayTable />
            </ChakraDatePicker.View>
            <ChakraDatePicker.View view="month">
              <ChakraDatePicker.Header />
              <ChakraDatePicker.MonthTable />
            </ChakraDatePicker.View>
            <ChakraDatePicker.View view="year">
              <ChakraDatePicker.Header />
              <ChakraDatePicker.YearTable />
            </ChakraDatePicker.View>
          </ChakraDatePicker.Content>
        </ChakraDatePicker.Positioner>
      </Portal>
    </ChakraDatePicker.Root>
  )
}
