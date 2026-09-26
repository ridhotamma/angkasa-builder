/** `@repo/page-builder/editor` — the editor both dashboards render. */

export { PageBuilder, type PageBuilderProps } from './builder'
export { BuilderDialog, type BuilderDialogProps } from './builder-dialog'
export { EditorMenu, UnsavedIndicator, type EditorMenuItem } from './actions'
export { FieldsForm, LinkControl, NumberControl, SelectInput } from './controls'
export { useHistoryKeys, useUndoableState, type EditorHistory } from './history'
export { TableControl } from './media-controls'
export { MenuEditor } from './menu-editor'
export { useEditorText } from './messages'
export type { CatalogueOption, EditorOption, EditorServices } from './services'
