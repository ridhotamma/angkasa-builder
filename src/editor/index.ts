/** `angkasa-builder/editor` — the editor both dashboards render. */

export { PageBuilder, type FrameDetails, type PageBuilderProps } from './builder'
export { BuilderDialog, useBuilderDialogFooter, type BuilderDialogProps } from './builder-dialog'
export { ChoiceCards, ToggleCards } from './choice-cards'
export { EditorMenu, EditorSettings, UnsavedIndicator, type EditorMenuItem } from './actions'
export {
  ColorInput,
  FieldsForm,
  Labeled,
  LinkControl,
  NumberControl,
  RangeInput,
  SegmentInput,
  SelectInput,
  ToggleField,
} from './controls'
export { FontSelect } from './font-select'
export { IconPicker } from './icon-picker'
export { useHistoryKeys, useUndoableState, type EditorHistory } from './history'
export { TableControl } from './media-controls'
export { MenuEditor, type MenuPath } from './menu-editor'
export { MediaPickerDialog } from './media-picker'
export { useEditorText } from './messages'
export { LookPickerDialog } from './look-picker-dialog'
export { PaletteDots, PaletteStrip } from './palette-swatch'
export { PropertyGroup } from './property-group'
export type {
  ArticleOption,
  CatalogueOption,
  EditorMediaItem,
  EditorOption,
  EditorServices,
} from './services'
export { LocaleProvider, useLocale, type Locale } from '../locale'
