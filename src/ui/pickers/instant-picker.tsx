/**
 * A moment in time — a calendar day beside a time of day — as an ISO instant
 * (`''` when empty).
 *
 * `DateTimePicker` yields wall-clock parts with no zone. Joining them here,
 * where the viewer's time zone is known, gives the server an unambiguous
 * instant — parsing `2026-10-03 09:00` on a UTC server would start a Jakarta
 * seller's sale seven hours late.
 *
 * The picker stays empty until mount: the server renders in its own time
 * zone, so parts computed there would be wrong and would not hydrate. A time
 * picked before any day is kept locally until the day arrives; a day picked
 * with no time means midnight, which is what the time wheel already shows.
 */

import { useEffect, useState } from 'react'

import {
  DateTimePicker,
  type DateTimePickerProps,
  type DateTimePickerValue,
} from './date-time-picker'

/** An ISO instant split into the local day and time `DateTimePicker` shows. */
function toLocalParts(iso: string): DateTimePickerValue {
  const at = new Date(iso)
  if (!iso || Number.isNaN(at.getTime())) return { date: '', time: '' }
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    date: `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`,
    time: `${pad(at.getHours())}:${pad(at.getMinutes())}`,
  }
}

export interface InstantPickerProps extends Omit<DateTimePickerProps, 'value' | 'onChange'> {
  /** An ISO instant, or `''`. */
  value: string
  onChange: (iso: string) => void
  /** Called after a day is picked — a form's "touched". */
  onCommit?: () => void
}

export function InstantPicker({ value, onChange, onCommit, ...props }: InstantPickerProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const [pendingTime, setPendingTime] = useState('')

  const parts = mounted ? toLocalParts(value) : null
  const shown: DateTimePickerValue = parts && parts.date ? parts : { date: '', time: pendingTime }

  return (
    <DateTimePicker
      {...props}
      value={shown}
      onChange={(next) => {
        if (!next.date) {
          setPendingTime(next.time)
          onChange('')
          return
        }
        const at = new Date(`${next.date}T${next.time || '00:00'}`)
        onChange(Number.isNaN(at.getTime()) ? '' : at.toISOString())
        onCommit?.()
      }}
    />
  )
}
