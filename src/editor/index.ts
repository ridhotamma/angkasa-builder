/** `@repo/page-builder/editor` — the editor both dashboards render. */

export { PageBuilder, type PageBuilderProps } from './builder'
export { BuilderDialog, type BuilderDialogProps } from './builder-dialog'
export { EditorMenu, EditorSettings, UnsavedIndicator, type EditorMenuItem } from './actions'
export { FieldsForm, LinkControl, NumberControl, SelectInput } from './controls'
export { useHistoryKeys, useUndoableState, type EditorHistory } from './history'
export { TableControl } from './media-controls'
export { MenuEditor, type MenuPath } from './menu-editor'
export { useEditorText } from './messages'
export type { ArticleOption, CatalogueOption, EditorOption, EditorServices } from './services'
