/**
 * A time of day, picked on two scrolling wheels — hours and minutes — instead
 * of the browser's own `<input type="time">` control.
 *
 * The native control was tried first and worked, but its own picker overlay
 * (Chromium's scrolling wheel, opened by `showPicker()`) is themed by the OS
 * and cannot be restyled to match a Chakra surface, and every browser's
 * segment-editing UI looks and behaves a little differently. Building the
 * wheel ourselves out of two plain, scrollable `Box`es trades that
 * inconsistency for full control: same look in every browser, dark mode for
 * free, and a click on any value that glides it to the centre — the row a
 * "selected" reading sits on — rather than jumping there.
 *
 * The field itself stays a real (read-only) `<input>` so it still submits
 * with a form and takes a label the normal way; only the value comes from the
 * wheels now; there is nothing to type.
 */

import { Box, HStack, Icon, IconButton, Input, InputGroup, Popover, Portal } from '@chakra-ui/react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { LuClock, LuX } from 'react-icons/lu'

type ControlSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

/** Height of one row and how many rows show at once — kept odd so a row sits exactly on the centre line. */
const ITEM_HEIGHT = 32
const VISIBLE_ROWS = 5
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS
/** Blank space above the first row and below the last, so they can reach the centre line too. */
const WHEEL_PADDING = (ITEM_HEIGHT * (VISIBLE_ROWS - 1)) / 2

export interface TimePickerProps {
  /** `HH:mm`, or an empty string. */
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  name?: string
  size?: ControlSize
  disabled?: boolean
  required?: boolean
  invalid?: boolean
  /** Shows a clear button once a value is set. Off by default: most callers treat "no time" as a real gap, not a state worth a dedicated control. */
  clearable?: boolean
  clearLabel?: string
  w?: string | Record<string, string>
  flexShrink?: string | number
}

/**
 * Controlled and deliberately free of react-hook-form, matching `PhoneInput`
 * — the parts of the app that hold state in `useState` (like an inline
 * booking panel) can use it without a form context.
 */
export function TimePicker({
  value,
  onChange,
  onBlur,
  name,
  size = 'md',
  disabled,
  required,
  invalid,
  clearable = false,
  clearLabel = 'Clear',
  w,
  flexShrink,
}: TimePickerProps) {
  const [open, setOpen] = useState(false)

  const parts = value ? value.split(':') : ['00', '00']
  const hour = parts[0] ?? '00'
  const minute = parts[1] ?? '00'

  function commit(next: { hour: string; minute: string }) {
    onChange(`${next.hour}:${next.minute}`)
  }

  return (
    <Popover.Root
      open={!disabled && open}
      onOpenChange={(details) => setOpen(details.open)}
      positioning={{ placement: 'bottom-start' }}
      autoFocus={false}
    >
      <Popover.Anchor asChild>
        <InputGroup
          w={w}
          flexShrink={flexShrink}
          endElement={
            <>
              {clearable && value && (
                <IconButton
                  aria-label={clearLabel}
                  variant="ghost"
                  size="xs"
                  tabIndex={-1}
                  onClick={() => onChange('')}
                >
                  <Icon as={LuX} boxSize="3.5" />
                </IconButton>
              )}
              <Icon
                as={LuClock}
                color="fg.muted"
                boxSize="4"
                cursor={disabled ? undefined : 'pointer'}
                onClick={disabled ? undefined : () => setOpen((prev) => !prev)}
              />
            </>
          }
        >
          <Input
            readOnly
            name={name}
            value={value}
            placeholder="--:--"
            onClick={disabled ? undefined : () => setOpen((prev) => !prev)}
            onKeyDown={(event) => {
              if (disabled) return
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                setOpen((prev) => !prev)
              }
            }}
            onBlur={onBlur}
            disabled={disabled}
            required={required}
            aria-invalid={invalid || undefined}
            size={size}
            pe={clearable && value ? '16' : '10'}
            css={{ caretColor: 'transparent' }}
            cursor={disabled ? undefined : 'pointer'}
          />
        </InputGroup>
      </Popover.Anchor>

      <Portal>
        <Popover.Positioner>
          <Popover.Content w="auto" p="1" rounded="lg">
            {/*
             * Only mounted while open, rather than left in the tree and
             * hidden by the popover's own presence styling: each wheel
             * centres itself on mount, and the popover keeps its content
             * mounted (just visually hidden) between opens, so a wheel that
             * was created once would never get a second mount to re-run that
             * on reopening.
             */}
            {open && (
              <Box position="relative">
                {/* The row a value "counts" as selected on — purely visual,
                    sits behind the wheels and never intercepts a click. */}
                <Box
                  position="absolute"
                  insetInline="1"
                  top="50%"
                  h={`${ITEM_HEIGHT}px`}
                  transform="translateY(-50%)"
                  bg="bg.subtle"
                  rounded="md"
                  pointerEvents="none"
                />
                <HStack gap="0" position="relative">
                  <TimeWheel
                    items={HOURS}
                    value={hour}
                    onChange={(next) => commit({ hour: next, minute })}
                    ariaLabel="Hour"
                  />
                  <Box w="1px" alignSelf="stretch" bg="border" />
                  <TimeWheel
                    items={MINUTES}
                    value={minute}
                    onChange={(next) => commit({ hour, minute: next })}
                    ariaLabel="Minute"
                  />
                </HStack>
              </Box>
            )}
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  )
}

/**
 * One scrolling column of two-digit values.
 *
 * Position is kept purely as a scroll offset — `index * ITEM_HEIGHT` — rather
 * than measuring each row's DOM position, because the row height is fixed and
 * known up front; that keeps both centring a click and reading back the
 * nearest row after a free scroll down to arithmetic instead of layout
 * measurement.
 */
function TimeWheel({
  items,
  value,
  onChange,
  ariaLabel,
}: {
  items: readonly string[]
  value: string
  onChange: (value: string) => void
  ariaLabel: string
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const scrollEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** The index this wheel is currently resting on, so a value handed back down after this wheel just set it doesn't re-trigger its own re-centring. */
  const settledIndex = useRef(-1)

  // Runs once, right as this wheel mounts — which is exactly once per time
  // the popover opens, since the parent only renders it while open.
  //
  // Not a plain `scrollTo` on mount: the popover this wheel lives in only
  // removes its own `hidden` state — the thing that gives this container real
  // layout — a render cycle after `open` becomes true and this wheel mounts,
  // so on the very first pass `clientHeight` is still `0` and scrolling it is
  // a no-op. Polling one animation frame at a time picks up the exact frame
  // it becomes real, however many frames that takes.
  useLayoutEffect(() => {
    let rafId = 0
    let cancelled = false

    const tryApply = () => {
      if (cancelled) return
      const container = containerRef.current
      if (!container) return
      if (container.clientHeight === 0) {
        rafId = requestAnimationFrame(tryApply)
        return
      }
      const index = items.indexOf(value)
      if (index === -1) return
      settledIndex.current = index
      container.scrollTop = index * ITEM_HEIGHT
    }

    tryApply()
    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
    }
    // Deliberately mount-only: re-centring on every `value` change here would
    // fight the smooth glide `selectIndex` already plays for that same change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function selectIndex(index: number, behavior: ScrollBehavior) {
    const clamped = Math.min(Math.max(index, 0), items.length - 1)
    settledIndex.current = clamped
    containerRef.current?.scrollTo({ top: clamped * ITEM_HEIGHT, behavior })
    const next = items[clamped]
    if (next !== undefined && next !== value) onChange(next)
  }

  // A free scroll (drag, wheel, momentum) never lands exactly on a row
  // boundary, so once it settles — no further `scroll` events for a beat —
  // the nearest row snaps to the centre, the same as a click would.
  function handleScroll() {
    if (scrollEndTimer.current) clearTimeout(scrollEndTimer.current)
    scrollEndTimer.current = setTimeout(() => {
      const container = containerRef.current
      if (!container) return
      selectIndex(Math.round(container.scrollTop / ITEM_HEIGHT), 'smooth')
    }, 120)
  }

  useEffect(
    () => () => {
      if (scrollEndTimer.current) clearTimeout(scrollEndTimer.current)
    },
    [],
  )

  return (
    <Box
      ref={containerRef}
      onScroll={handleScroll}
      role="listbox"
      aria-label={ariaLabel}
      overflowY="auto"
      h={`${WHEEL_HEIGHT}px`}
      w="14"
      css={{
        scrollSnapType: 'y mandatory',
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
      }}
    >
      <Box h={`${WHEEL_PADDING}px`} />
      {items.map((item, index) => {
        const selected = item === value
        return (
          <Box
            key={item}
            role="option"
            aria-selected={selected}
            h={`${ITEM_HEIGHT}px`}
            display="flex"
            alignItems="center"
            justifyContent="center"
            cursor="pointer"
            fontWeight={selected ? 'semibold' : 'normal'}
            color={selected ? 'fg' : 'fg.subtle'}
            css={{ scrollSnapAlign: 'center' }}
            onClick={() => selectIndex(index, 'smooth')}
          >
            {item}
          </Box>
        )
      })}
      <Box h={`${WHEEL_PADDING}px`} />
    </Box>
  )
}
