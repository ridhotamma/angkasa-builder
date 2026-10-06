/** `@repo/page-builder/editor` — the editor both dashboards render. */

export { PageBuilder, type FrameDetails, type PageBuilderProps } from './builder'
export { BuilderDialog, type BuilderDialogProps } from './builder-dialog'
export { EditorMenu, EditorSettings, UnsavedIndicator, type EditorMenuItem } from './actions'
export { ColorInput, FieldsForm, LinkControl, NumberControl, SelectInput } from './controls'
export { FontSelect } from './font-select'
export { useHistoryKeys, useUndoableState, type EditorHistory } from './history'
export { TableControl } from './media-controls'
export { MenuEditor, type MenuPath } from './menu-editor'
export { useEditorText } from './messages'
export { LookPickerDialog } from './look-picker-dialog'
export { PaletteDots, PaletteStrip } from './palette-swatch'
export type { ArticleOption, CatalogueOption, EditorOption, EditorServices } from './services'
