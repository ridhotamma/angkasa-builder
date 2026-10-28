/**
 * The whole editor as one JSON value: the page's sections with their undo
 * history, and the selection.
 *
 * `dispatchCommand` is the one way to change it. An htmx server keeps an
 * `EditorState` in the editing session, applies the command each request
 * stands for, and renders the result; a browser client can hold it in
 * `createEditorStore` instead. (The React editor keeps the same pieces in its
 * own state, since its host owns the document — see `PageBuilder`.)
 */

import type { SectionInstance } from '../model/content'
import type { StorefrontLocale } from '../model/localized'
import { applyCommand, type CommandResult, type EditorCommand } from './commands'
import {
  createHistory,
  pushHistory,
  redoHistory,
  replacePresent,
  undoHistory,
  type History,
} from './history'
import { NO_SELECTION, type EditorSelection } from './selection'

export interface EditorState {
  sections: History<SectionInstance[]>
  selection: EditorSelection
}

export function createEditorState(sections: SectionInstance[]): EditorState {
  return { sections: createHistory(sections), selection: NO_SELECTION }
}

/**
 * The commands that are typing: a burst of them is one undo step. Anything
 * else — a move, a copy, a removal — is always a step of its own, and the
 * typing after it starts a new one.
 */
const TYPING: ReadonlySet<EditorCommand['type']> = new Set([
  'set-section-settings',
  'set-section-style',
  'set-section-overrides',
  'set-block-settings',
  'set-block-style',
  'set-element',
  'rename-section',
  'rename-block',
  'edit-text',
  'edit-block-text',
])

export interface DispatchOptions {
  locale: StorefrontLocale
  /** The clock, for coalescing typing into one undo step. Defaults to `Date.now()`. */
  now?: number
}

/**
 * Apply a command. The new sections become an undo step — typing coalesced
 * with the last edit when it was moments ago, anything structural always a
 * step of its own; the result carries what the view should do next — reveal
 * a section, open a tree branch.
 */
export function dispatchCommand(
  state: EditorState,
  command: EditorCommand,
  options: DispatchOptions,
): { state: EditorState; result: CommandResult } {
  const result = applyCommand(state.sections.present, state.selection, command, {
    locale: options.locale,
  })
  const typing = TYPING.has(command.type)
  const sections =
    result.sections === state.sections.present
      ? state.sections
      : typing
        ? pushHistory(state.sections, result.sections, options.now ?? Date.now())
        : // Its own step, and a fresh start for whatever is typed next.
          {
            ...pushHistory({ ...state.sections, lastEditAt: 0 }, result.sections, 0),
            lastEditAt: 0,
          }
  const next =
    sections === state.sections && result.selection === state.selection
      ? state
      : { sections, selection: result.selection }
  return { state: next, result }
}

/**
 * A step back. A selection that pointed into something the undo removed is
 * dropped, so the panel never opens on a section that is no longer there.
 */
export function undoEditor(state: EditorState): EditorState {
  const sections = undoHistory(state.sections)
  return sections === state.sections
    ? state
    : { sections, selection: keepSelection(sections.present, state.selection) }
}

export function redoEditor(state: EditorState): EditorState {
  const sections = redoHistory(state.sections)
  return sections === state.sections
    ? state
    : { sections, selection: keepSelection(sections.present, state.selection) }
}

/** New sections from outside (a save's cleaned copy), without an undo step. */
export function replaceSections(state: EditorState, sections: SectionInstance[]): EditorState {
  const history = replacePresent(state.sections, sections)
  return history === state.sections
    ? state
    : { sections: history, selection: keepSelection(sections, state.selection) }
}

function keepSelection(
  sections: readonly SectionInstance[],
  selection: EditorSelection,
): EditorSelection {
  if (!selection.sectionId || selection.sectionId.includes(':')) return selection
  return sections.some((section) => section.id === selection.sectionId) ? selection : NO_SELECTION
}

export interface EditorStore {
  getState(): EditorState
  dispatch(command: EditorCommand): CommandResult
  undo(): void
  redo(): void
  /** Called after every change; returns the unsubscribe. */
  subscribe(listener: (state: EditorState) => void): () => void
}

/** `EditorState` in a box, for a browser client with no framework of its own. */
export function createEditorStore(
  initial: EditorState | SectionInstance[],
  options: { locale: StorefrontLocale; now?: () => number },
): EditorStore {
  let state = Array.isArray(initial) ? createEditorState(initial) : initial
  const listeners = new Set<(state: EditorState) => void>()
  const set = (next: EditorState) => {
    if (next === state) return
    state = next
    for (const listener of listeners) listener(state)
  }
  return {
    getState: () => state,
    dispatch(command) {
      const { state: next, result } = dispatchCommand(state, command, {
        locale: options.locale,
        now: options.now?.(),
      })
      set(next)
      return result
    },
    undo: () => set(undoEditor(state)),
    redo: () => set(redoEditor(state)),
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
