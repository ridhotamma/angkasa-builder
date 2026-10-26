/**
 * The phone sheet's drag: pull the handle up for the whole screen, down for
 * half, further down to close — the bottom sheet every phone app has.
 *
 * The sheet follows the finger while it moves, then settles on the nearest
 * stop when it lifts. A flick counts as much as a distance: a quick swipe up
 * opens it fully from anywhere, a quick swipe down steps it down one stop.
 */

import { useCallback, useRef, useState, type PointerEvent } from 'react'

export type SheetStop = 'half' | 'full'

/** The share of the screen each stop fills. */
export const SHEET_STOPS: Record<SheetStop, number> = { half: 0.6, full: 0.94 }

/** Below this share of the screen, letting go closes the sheet. */
const CLOSE_BELOW = 0.32
/** Faster than this (px per ms), a release is a flick, whatever its distance. */
const FLICK = 0.5
/** Shorter than this (px), a press is a tap on the handle, not a drag. */
const TAP = 6

/**
 * Where a released sheet comes to rest. `height` is where the finger left it,
 * `velocity` its speed when it lifted — negative going up — and `from` the stop
 * the drag began at.
 */
export function settleSheet({
  height,
  viewport,
  velocity,
  from,
}: {
  height: number
  viewport: number
  velocity: number
  from: SheetStop
}): SheetStop | 'closed' {
  if (velocity <= -FLICK) return 'full'
  if (velocity >= FLICK) return from === 'full' ? 'half' : 'closed'
  const share = height / viewport
  if (share < CLOSE_BELOW) return 'closed'
  const halfway = (SHEET_STOPS.half + SHEET_STOPS.full) / 2
  return share >= halfway ? 'full' : 'half'
}

function viewportHeight(): number {
  return globalThis.visualViewport?.height ?? globalThis.innerHeight ?? 800
}

export function useSheetDrag({ onClose }: { onClose: () => void }) {
  const [stop, setStop] = useState<SheetStop>('half')
  // The height while a finger holds the sheet; `null` at rest.
  const [dragHeight, setDragHeight] = useState<number | null>(null)
  const drag = useRef<{
    startY: number
    startHeight: number
    lastY: number
    lastTime: number
    velocity: number
    moved: boolean
  } | null>(null)

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      // The close button inside the handle row keeps its own click.
      if ((event.target as HTMLElement).closest('button')) return
      if (event.pointerType === 'mouse' && event.button !== 0) return
      event.currentTarget.setPointerCapture(event.pointerId)
      const height = SHEET_STOPS[stop] * viewportHeight()
      drag.current = {
        startY: event.clientY,
        startHeight: height,
        lastY: event.clientY,
        lastTime: event.timeStamp,
        velocity: 0,
        moved: false,
      }
    },
    [stop],
  )

  const onPointerMove = useCallback((event: PointerEvent<HTMLElement>) => {
    const state = drag.current
    if (!state) return
    if (!state.moved && Math.abs(event.clientY - state.startY) < TAP) return
    state.moved = true
    const elapsed = Math.max(1, event.timeStamp - state.lastTime)
    // Smoothed, so one jittery sample at the end does not decide the flick.
    state.velocity = state.velocity * 0.6 + ((event.clientY - state.lastY) / elapsed) * 0.4
    state.lastY = event.clientY
    state.lastTime = event.timeStamp
    const max = SHEET_STOPS.full * viewportHeight()
    setDragHeight(Math.min(max, Math.max(48, state.startHeight + (state.startY - event.clientY))))
  }, [])

  const finish = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const state = drag.current
      drag.current = null
      if (!state) return
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      // A tap on the handle toggles between half and the whole screen.
      if (!state.moved) {
        setStop((current) => (current === 'full' ? 'half' : 'full'))
        return
      }
      const height = state.startHeight + (state.startY - state.lastY)
      const next = settleSheet({
        height,
        viewport: viewportHeight(),
        velocity: state.velocity,
        from: stop,
      })
      setDragHeight(null)
      if (next === 'closed') {
        onClose()
        setStop('half')
      } else {
        setStop(next)
      }
    },
    [onClose, stop],
  )

  /** Back to half, for the next time the sheet opens. */
  const reset = useCallback(() => {
    drag.current = null
    setDragHeight(null)
    setStop('half')
  }, [])

  return {
    stop,
    dragging: dragHeight !== null,
    /** The sheet's height: the finger's while dragging, the stop's at rest. */
    height: dragHeight !== null ? `${dragHeight}px` : `${SHEET_STOPS[stop] * 100}dvh`,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: finish,
    },
    /** For the handle's keys: Enter toggles, the arrows pick a stop. */
    setStop,
    reset,
  }
}
