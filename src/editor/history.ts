/**
 * Undo and redo for the editor's document.
 *
 * The screen owns the document (see `PageBuilder`), so history lives with it:
 * `useUndoableState` is a drop-in for the screen's `useState` that remembers
 * what came before. Typing is coalesced — a burst of keystrokes into one field
 * is one step — so undo takes back a word or a change, not a letter.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  createHistory,
  pushHistory,
  redoHistory,
  replacePresent,
  undoHistory,
  type History,
} from '../editor-core/history'

export interface EditorHistory {
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
}

/** The core's history (`editor-core/history`) in React state. */
export function useUndoableState<T>(initial: T) {
  const [state, setState] = useState<History<T>>(() => createHistory(initial))

  /** An edit: pushes the current value onto the past, unless it continues the last edit. */
  const set = useCallback((next: T) => {
    const now = Date.now()
    setState((current) => pushHistory(current, next, now))
  }, [])

  /** A new starting point — loading a document, or a save's result — with no history. */
  const reset = useCallback((next: T) => setState(createHistory(next)), [])

  /** Replace the present without making it a step, e.g. the server's cleaned copy after a save. */
  const replace = useCallback((next: T) => setState((current) => replacePresent(current, next)), [])

  const undo = useCallback(() => setState(undoHistory), [])
  const redo = useCallback(() => setState(redoHistory), [])

  // The same object until undo or redo becomes (un)available, so the editor
  // can memoize the bar that draws the buttons.
  const canUndo = state.past.length > 0
  const canRedo = state.future.length > 0
  const history = useMemo<EditorHistory>(
    () => ({ canUndo, canRedo, undo, redo }),
    [canUndo, canRedo, undo, redo],
  )

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
