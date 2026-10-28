/**
 * A calendar day plus a time of day, side by side as one control.
 *
 * Chakra's `DatePicker` only ever picks a day — there is no time segment to
 * turn on — so a moment that needs both, like a courier pickup window, is
 * naturally two controls. This pairs the calendar with `TimePicker` in a
 * single row so a caller reaches for one component instead of assembling the
 * pairing (and its layout pitfalls — see the note on `minW` below) itself
 * each time.
 *
 * The value stays split into `date` (`YYYY-MM-DD`) and `time` (`HH:mm`)
 * rather than merged into one string: callers that only need the day for
 * validation (`!value.date` disables a submit button, say) do not have to
 * parse a combined value back apart, and the two already match what
 * `DatePicker` and `TimePicker` produce on their own.
 */

import { Box, Flex } from '@chakra-ui/react'

import { DatePicker } from './date-picker'
import { TimePicker, type TimePickerProps } from './time-picker'

type ControlSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export interface DateTimePickerValue {
  /** `YYYY-MM-DD`, or an empty string. */
  date: string
  /** `HH:mm`. */
  time: string
}

export interface DateTimePickerProps {
  value: DateTimePickerValue
  onChange: (value: DateTimePickerValue) => void
  /** BCP-47 tag (`en-US`, `id-ID`, …) — orders the calendar and formats its input the way this locale writes a date. Same value `DatePicker` takes as `locale`. */
  locale?: string
  size?: ControlSize
  disabled?: boolean
  datePlaceholder?: string
  timeClearable?: boolean
  timeClearLabel?: string
  /** `YYYY-MM-DD` — days before this cannot be picked. A courier pickup scheduled in the past makes no sense, so callers like the shipping panel pass today. */
  minDate?: string
  /**
   * Caps the row's width so the pair reads as one compact control rather
   * than stretching across whatever grid cell it was handed.
   *
   * Both children are flex items with `minW="0"`/`flexShrink="0"` set for
   * exactly this reason: a bare `Flex` of a flexible calendar input next to a
   * fixed-width time input, dropped into an equal-width grid column, will
   * happily size itself past that column's edge (CSS Grid's `1fr` tracks
   * don't shrink below a child's content width on their own) and visually
   * bleed into whatever sits beside it.
   */
  maxW?: string | Record<string, string>
}

/**
 * Controlled and free of react-hook-form, matching `TimePicker` and
 * `PhoneInput` — usable from a plain `useState` pair as well as a form.
 */
export function DateTimePicker({
  value,
  onChange,
  locale = 'en-US',
  size = 'md',
  disabled,
  datePlaceholder,
  timeClearable,
  timeClearLabel,
  minDate,
  maxW,
}: DateTimePickerProps) {
  return (
    <Flex gap="2" direction={{ base: 'column', sm: 'row' }} maxW={maxW}>
      <Box flex="1" minW="0">
        <DatePicker
          value={value.date}
          onChange={(date) => onChange({ ...value, date })}
          locale={locale}
          size={size}
          disabled={disabled}
          placeholder={datePlaceholder}
          min={minDate}
        />
      </Box>

      <TimeSlot
        value={value.time}
        onChange={(time) => onChange({ ...value, time })}
        size={size}
        disabled={disabled}
        clearable={timeClearable}
        clearLabel={timeClearLabel}
      />
    </Flex>
  )
}

/** `TimePicker` fixed to the width this pairing wants and never allowed to shrink under the calendar's flex. */
function TimeSlot(props: Omit<TimePickerProps, 'w' | 'flexShrink'>) {
  return <TimePicker {...props} w={{ base: 'full', sm: '28' }} flexShrink="0" />
}
