/**
 * `angkasa-builder/editor-core` — the editor's logic, with no UI.
 *
 * Everything the React editor (`./editor`) decides, as plain functions over
 * JSON values: what a command does to the page (`applyCommand`), what a
 * selection opens in the panel (`inspectSelection`), the forms each panel
 * screen holds and how a submitted one applies (`panelForms`,
 * `formCommand`), and undo history. An htmx editor builds on the same core:
 * keep an `EditorState` in the session, turn each request into a command,
 * and render the result with `angkasa-builder/html`.
 *
 * See docs/PAGE-BUILDER.md ("Editor core").
 */

export {
  applyCommand,
  editTargetId,
  type CommandContext,
  type CommandResult,
  type DropTarget,
  type EditorCommand,
  type NewBlock,
  type PresetRef,
} from './commands'
export {
  describeFields,
  readFormInput,
  type FormField,
  type FormInput,
  type FormOptions,
} from './forms'
export {
  canRedo,
  canUndo,
  COALESCE_MS,
  createHistory,
  HISTORY_LIMIT,
  pushHistory,
  redoHistory,
  replacePresent,
  undoHistory,
  type History,
} from './history'
export {
  inspectSelection,
  type Crumb,
  type InspectOptions,
  type Inspection,
  type PanelView,
} from './inspect'
export {
  formCommand,
  layoutForm,
  panelForms,
  readLayoutForm,
  STYLE_FIELDS,
  STYLE_GROUPS,
  VISIBILITY_FIELDS,
  type FieldGroupDefinition,
  type PanelForm,
  type PanelFormId,
} from './panels'
export {
  DETAILS_ID,
  FOOTER_ID,
  HEADER_ID,
  NO_SELECTION,
  sameSelection,
  sectionSelection,
  type EditorSelection,
} from './selection'
export {
  createEditorState,
  createEditorStore,
  dispatchCommand,
  redoEditor,
  replaceSections,
  undoEditor,
  type DispatchOptions,
  type EditorState,
  type EditorStore,
} from './state'
