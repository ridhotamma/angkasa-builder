/**
 * Undo and redo, as plain data.
 *
 * A history is the present value with what came before and after it. Every
 * function returns a new history and leaves the old one alone, so it can live
 * in React state, in a server session between htmx requests, or anywhere a
 * JSON value can.
 *
 * Typing is coalesced: edits closer together than `COALESCE_MS` are one step,
 * so undo takes back a word or a change, not a letter. The caller passes the
 * clock, which keeps these functions pure (and testable).
 */

/** Edits closer together than this are one step. */
export const COALESCE_MS = 600
/** How many steps back are kept. */
export const HISTORY_LIMIT = 100

export interface History<T> {
  past: T[]
  present: T
  future: T[]
  /** When the last edit landed (ms), or 0 when the next edit must start a new step. */
  lastEditAt: number
}

/** A new starting point — loading a document, or a save's result — with no history. */
export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], lastEditAt: 0 }
}

/**
 * An edit. The present goes onto the past, unless this edit continues the
 * last one (within `COALESCE_MS`); the future is dropped. The same value
 * again is no step at all.
 */
export function pushHistory<T>(history: History<T>, next: T, now: number): History<T> {
  if (Object.is(next, history.present)) return history
  const continues = history.lastEditAt > 0 && now - history.lastEditAt < COALESCE_MS
  return {
    past:
      continues && history.past.length > 0
        ? history.past
        : [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
    lastEditAt: now,
  }
}

/** Replace the present without making it a step, e.g. the server's cleaned copy after a save. */
export function replacePresent<T>(history: History<T>, next: T): History<T> {
  return Object.is(next, history.present) ? history : { ...history, present: next }
}

export function undoHistory<T>(history: History<T>): History<T> {
  const previous = history.past[history.past.length - 1]
  if (previous === undefined) return history
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
    lastEditAt: 0,
  }
}

export function redoHistory<T>(history: History<T>): History<T> {
  const [next, ...rest] = history.future
  if (next === undefined) return history
  return {
    past: [...history.past, history.present],
    present: next,
    future: rest,
    lastEditAt: 0,
  }
}

export function canUndo(history: History<unknown>): boolean {
  return history.past.length > 0
}

export function canRedo(history: History<unknown>): boolean {
  return history.future.length > 0
}
