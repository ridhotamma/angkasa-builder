/**
 * Undo and redo for the editor's document.
 *
 * The screen owns the document (see `PageBuilder`), so history lives with it:
 * `useUndoableState` is a drop-in for the screen's `useState` that remembers
 * what came before. Typing is coalesced — a burst of keystrokes into one field
 * is one step — so undo takes back a word or a change, not a letter.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

/** Edits closer together than this are one step. */
const COALESCE_MS = 600
const LIMIT = 100

export interface EditorHistory {
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
}

export function useUndoableState<T>(initial: T) {
  const [state, setState] = useState<{ past: T[]; present: T; future: T[] }>({
    past: [],
    present: initial,
    future: [],
  })
  const lastEdit = useRef(0)

  /** An edit: pushes the current value onto the past, unless it continues the last edit. */
  const set = useCallback((next: T) => {
    const now = Date.now()
    const continues = now - lastEdit.current < COALESCE_MS
    lastEdit.current = now
    setState((current) => {
      if (Object.is(next, current.present)) return current
      return {
        past:
          continues && current.past.length > 0
            ? current.past
            : [...current.past, current.present].slice(-LIMIT),
        present: next,
        future: [],
      }
    })
  }, [])

  /** A new starting point — loading a document, or a save's result — with no history. */
  const reset = useCallback((next: T) => {
    lastEdit.current = 0
    setState({ past: [], present: next, future: [] })
  }, [])

  /** Replace the present without making it a step, e.g. the server's cleaned copy after a save. */
  const replace = useCallback((next: T) => {
    setState((current) => ({ ...current, present: next }))
  }, [])

  const undo = useCallback(() => {
    lastEdit.current = 0
    setState((current) => {
      const previous = current.past[current.past.length - 1]
      if (previous === undefined) return current
      return {
        past: current.past.slice(0, -1),
        present: previous,
        future: [current.present, ...current.future],
      }
    })
  }, [])

  const redo = useCallback(() => {
    lastEdit.current = 0
    setState((current) => {
      const [next, ...rest] = current.future
      if (next === undefined) return current
      return { past: [...current.past, current.present], present: next, future: rest }
    })
  }, [])

  const history: EditorHistory = {
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    undo,
    redo,
  }

  return { value: state.present, set, reset, replace, history }
}

/**
 * Ctrl/⌘+Z and Ctrl/⌘+Shift+Z (or Ctrl+Y), except while typing in a field —
 * there the browser's own undo of the text is what the seller means.
 */
export function useHistoryKeys(
  history: EditorHistory | undefined,
  documents: Array<Document | null>,
) {
  const ref = useRef(history)
  ref.current = history

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const current = ref.current
      if (!current || !(event.ctrlKey || event.metaKey)) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable]')) return
      const key = event.key.toLowerCase()
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault()
        current.undo()
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault()
        current.redo()
      }
    }
    const targets = documents.filter((doc): doc is Document => doc !== null)
    targets.forEach((doc) => doc.addEventListener('keydown', onKey))
    return () => targets.forEach((doc) => doc.removeEventListener('keydown', onKey))
  }, [documents])
}
