/**
 * Typing a date into Chakra's `DatePicker` input, the way people actually type.
 *
 * Out of the box the input is free text that Zag parses on blur, and it only
 * understands the locale's full pattern with separators: `18032026` is not a
 * date to it, and on blur it quietly swaps an unparseable entry for whatever
 * day the calendar had focused. So the operator types a date, tabs away, and
 * gets a different one.
 *
 * This fixes both halves, for every locale's own field order:
 *
 * - `onInputCapture` masks the text as it is typed — `18032026` becomes
 *   `18/03/2026`, and a separator typed after a single digit pads it, so
 *   `1/3/2026` becomes `01/03/2026`. It runs in the capture phase so the
 *   masked text is what Zag's own `onInput` reads.
 * - `parse` reads the same shapes back into a `CalendarDate`, and refuses a day
 *   the month does not have rather than rolling it over.
 */

import { CalendarDate, type DateValue } from '@internationalized/date'
import { useMemo, type FormEvent } from 'react'

type Segment = 'day' | 'month' | 'year'

interface DatePattern {
  /** The fields in the order this locale writes them. */
  order: Segment[]
  /** What goes between them — `/` for `id-ID` and `en-US`. */
  separator: string
}

const MAX_LENGTH: Record<Segment, number> = { day: 2, month: 2, year: 4 }

const patternCache = new Map<string, DatePattern>()

/** The field order and separator Zag's default `format` produces for `locale`. */
function patternFor(locale: string): DatePattern {
  const cached = patternCache.get(locale)
  if (cached) return cached

  const parts = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(new Date(2026, 0, 15))

  const order = parts
    .map((part) => part.type)
    .filter((type): type is Segment => type === 'day' || type === 'month' || type === 'year')
  const separator = parts.find((part) => part.type === 'literal')?.value ?? '/'

  const pattern: DatePattern =
    order.length === 3 ? { order, separator } : { order: ['day', 'month', 'year'], separator: '/' }
  patternCache.set(locale, pattern)
  return pattern
}

/**
 * Splits raw input into the locale's fields. Digits fill a field until it is
 * full; any other character closes the current field early, zero-padding a
 * one-digit day or month. `closed` says whether the text ended on such a
 * separator, so the mask can keep it rather than swallow what was just typed.
 */
function segmentsOf(raw: string, pattern: DatePattern): { values: string[]; closed: boolean } {
  const values = ['']
  let closed = false

  for (const char of raw) {
    const index = values.length - 1
    const segment = pattern.order[index]
    if (!segment) break

    if (/\d/.test(char)) {
      if (values[index]!.length === MAX_LENGTH[segment]) {
        if (index === pattern.order.length - 1) break
        values.push(char)
      } else {
        values[index] += char
      }
      closed = false
      continue
    }

    // A separator only means something after at least one digit, and nothing
    // comes after the last field.
    if (!values[index] || index === pattern.order.length - 1) continue
    if (segment !== 'year') values[index] = values[index]!.padStart(2, '0')
    values.push('')
    closed = true
  }

  if (values[values.length - 1] === '' && values.length > 1 && !closed) values.pop()
  return { values, closed }
}

function maskDate(raw: string, pattern: DatePattern): string {
  const { values, closed } = segmentsOf(raw, pattern)
  const filled = values.filter((value, index) => value || index < values.length - 1)
  const text = filled.join(pattern.separator)
  return closed && filled.length < pattern.order.length ? text + pattern.separator : text
}

function parseDate(raw: string, pattern: DatePattern): DateValue | undefined {
  const { values } = segmentsOf(raw.trim(), pattern)
  if (values.length !== 3) return undefined

  const field = (segment: Segment) => values[pattern.order.indexOf(segment)] ?? ''
  if (field('year').length !== 4 || !field('month') || !field('day')) return undefined

  const year = Number(field('year'))
  const month = Number(field('month'))
  const day = Number(field('day'))
  if (month < 1 || month > 12 || day < 1) return undefined

  // `CalendarDate` clamps an impossible day (31 Feb → 28 Feb) instead of
  // refusing it; a clamped result means the typed day did not exist.
  const date = new CalendarDate(year, month, day)
  return date.day === day ? date : undefined
}

/**
 * Props for `DatePicker.Root` (`parse`) and `DatePicker.Input`
 * (`onInputCapture`) that make typed dates work in `locale`'s own order.
 */
export function useDateInputMask(locale: string) {
  return useMemo(() => {
    const pattern = patternFor(locale)

    function onInputCapture(event: FormEvent<HTMLInputElement>) {
      const input = event.currentTarget
      const raw = input.value
      const masked = maskDate(raw, pattern)
      if (masked === raw) return

      // Keep the caret after the same number of digits it followed before, so
      // an edit mid-date does not throw it to the end.
      const caret = input.selectionStart ?? raw.length
      const atEnd = caret >= raw.length
      const digitsBefore = raw.slice(0, caret).replace(/\D/g, '').length

      input.value = masked

      if (atEnd) return
      let position = 0
      for (let seen = 0; position < masked.length && seen < digitsBefore; position++) {
        if (/\d/.test(masked[position]!)) seen++
      }
      input.setSelectionRange(position, position)
    }

    return {
      parse: (value: string) => parseDate(value, pattern),
      onInputCapture,
    }
  }, [locale])
}
