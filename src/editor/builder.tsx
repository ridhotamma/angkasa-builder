/**
 * The editor: section list and settings on the left, live preview beside it.
 *
 * Shopify-shaped. The left panel is either the list of sections (plus the
 * theme tab, when the thing being edited is a theme) or, once a section is
 * picked, that section's settings with a way back. Clicking a section in the
 * preview picks it too, and clicking a heading there types straight into it.
 *
 * The preview is an iframe the width of the chosen device (see
 * `PreviewFrame`), so a phone preview is laid out as a phone.
 *
 * With `frame`, the sections being edited are drawn inside a template's
 * sections — an article's body inside the theme's article template — so the
 * seller writes in the frame shoppers will see. The frame is read-only here:
 * it is the theme's, and the theme editor is where it changes.
 *
 * Typing stays light however long the page is. The panel follows every
 * keystroke; the preview follows a deferred copy of the sections
 * (`useDeferredValue`), so React draws it in an interruptible pass after the
 * input has updated, and the preview element is memoized on that copy so a
 * keystroke's own render skips it entirely. Inside it, the render environment
 * stays the same object between keystrokes and every section is memoized (see
 * `SectionsRenderer`), so only the section being edited is drawn again — not
 * the header, the footer, a template's frame or the other sections.
 *
 * Fully controlled: the screen owns the document and decides when to save.
 * This component only ever calls `onSectionsChange` / `onSettingsChange` /
 * `onLayoutChange` with a new value; undo and redo are the screen's too
 * (`useUndoableState`), handed in as `history`.
 */

import {
  Alert,
  Box,
  Button,
  CloseButton,
  Container,
  Drawer,
  Flex,
  HStack,
  Icon,
  IconButton,
  Portal,
  ScrollArea,
  SegmentGroup,
  Splitter,
  Stack,
  Tabs,
  Text,
  useBreakpointValue,
  useSplitter,
} from '@chakra-ui/react'
import {
  createContext,
  useCallback,
  useContext,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import {
  LuArrowDown,
  LuArrowUp,
  LuChevronLeft,
  LuChevronRight,
  LuCopy,
  LuPencil,
  LuPlus,
  LuLink,
  LuMonitor,
  LuLayers,
  LuMoon,
  LuPalette,
  LuRedo2,
  LuShoppingBag,
  LuSmartphone,
  LuSun,
  LuTablet,
  LuTrash2,
  LuUnlink,
  LuUser,
  LuSearch,
  LuUndo2,
  LuX,
} from 'react-icons/lu'

import { SECTION_LINKING_ENABLED } from '@repo/appwrite-config'
import { Tooltip } from '@repo/theme'

import { findBlock } from '../model/blocks'
import {
  overridableFields,
  sectionDisplayName,
  TEMPLATE_KEYS,
  type SectionInstance,
  type TemplateKey,
} from '../model/content'
import {
  BUTTON_ELEMENT_DEFAULTS,
  BUTTON_ELEMENT_FIELDS,
  TEXT_ELEMENT_DEFAULTS,
  TEXT_ELEMENT_FIELDS,
  type ElementKind,
} from '../model/element-style'
import type { FieldValues } from '../model/fields'
import {
  FOOTER_FIELDS,
  HEADER_FIELDS,
  LAYOUT_PART_DESCRIPTIONS,
  LAYOUT_PART_NAMES,
  type ThemeLayout,
} from '../model/layout'
import type { MenuItem } from '../model/menus'
import {
  sectionSchema,
  type SectionPreset,
  type SectionScope,
  type SectionType,
} from '../model/sections'
import { googleFontsHref, themeDesignedForDark, type ThemeSettings } from '../model/settings'
import {
  hasTabBar,
  isHeaderTransparent,
  StoreFooter,
  StoreHeader,
  StoreTab,
  StoreTabBar,
} from '../render/chrome'
import {
  RenderProvider,
  type RenderEnvironment,
  type StorefrontRenderData,
} from '../render/context'
import { PAGE_WIDTH_CONTAINER } from '../render/primitives'
import { drawnSections, pageEdges, SectionsRenderer, ThemeScope } from '../render/renderer'
import { PaletteDragProvider, usePaletteDrag, type PaletteBlock } from './add-palette'
import { useBuilderDialogFooter } from './builder-dialog'
import { BlockStylePanel } from './block-style-panel'
import { CatalogueProvider } from './catalogue'
import { CommandPalette } from './command-palette'
import { DropOverlay, type DropTarget } from './preview-drop'
import {
  BlockEditorProvider,
  BlockMoveMenu,
  BlockNamePopover,
  FieldsForm,
  SectionLinkProvider,
  SelectInput,
} from './controls'
import { useHistoryKeys, type EditorHistory } from './history'
import { useEditorText } from './messages'
import { FieldGroups, type FieldGroup } from './field-groups'
import { PanelSlide } from './panel-slide'
import { SaveBlockPopover } from './save-block-popover'
import { useSheetDrag } from './sheet-drag'
import { canSaveBlock } from './saved-blocks'
import { PreviewFrame, type PreviewDevice } from './preview-frame'
import { flipElements, orderMoved, type SectionRects } from './reorder-flip'
import { PinnedRow, SectionList } from './section-list'
import { SectionToolbar } from './section-toolbar'
import type { EditorServices } from './services'
import { ThemeSettingsPanel } from './theme-settings'
import {
  applyCommand,
  DETAILS_ID,
  FOOTER_ID,
  HEADER_ID,
  inspectSelection,
  NO_SELECTION,
  STYLE_GROUPS as CORE_STYLE_GROUPS,
  VISIBILITY_FIELDS,
  type EditorCommand,
  type EditorSelection,
  type NewBlock,
} from '../editor-core'

/** The Style tab's folds, each holding the offered fields it names (see the core). */
const STYLE_GROUPS: FieldGroup[] = CORE_STYLE_GROUPS

/** No menus yet: one object, so a default does not look like a change on every render. */
const NO_MENUS: { main: MenuItem[]; footer: MenuItem[] } = { main: [], footer: [] }
const NO_PAGES: Array<{ title: string; slug: string }> = []

/**
 * The edited sections, for a frame's slot. The frame's environment holds a
 * stable `<EditedOutlet />` rather than the sections themselves, so a keystroke
 * re-draws the outlet and not the frame around it.
 */
const EditedContext = createContext<ReactNode>(null)

function EditedOutlet() {
  return <>{useContext(EditedContext)}</>
}

export interface PageBuilderProps {
  sections: SectionInstance[]
  onSectionsChange: (sections: SectionInstance[]) => void
  settings: ThemeSettings
  /** Omit to edit sections only, e.g. a page previewed under the shop's theme. */
  onSettingsChange?: (settings: ThemeSettings) => void
  data: StorefrontRenderData
  services: EditorServices
  formatPrice: RenderEnvironment['formatPrice']
  /** Which kind of page the sections are for; decides which sections can be added. */
  scope?: SectionScope
  /** A theme's templates: which one is open, and switching between them. */
  template?: { value: TemplateKey; onChange: (key: TemplateKey) => void }
  /**
   * The header and footer. With `onLayoutChange` they are editable (a theme);
   * without it they only frame the preview (a page, under the live theme).
   */
  layout?: ThemeLayout
  onLayoutChange?: (layout: ThemeLayout) => void
  /** The shop's navigation, for the preview's header and footer. */
  menus?: { main: MenuItem[]; footer: MenuItem[] }
  /** Published pages the footer lists while its menu is empty. */
  footerPages?: Array<{ title: string; slug: string }>
  /** Undo and redo, from the screen's `useUndoableState`. */
  history?: EditorHistory
  /**
   * Start on the theme tab — a blank theme just created, or a template just
   * installed. `priorityKeys` are the installed template's suggested looks,
   * shown first when the seller opens the look picker; the picker itself
   * never opens on its own.
   */
  startWithLooks?: { priorityKeys?: readonly string[] }
  /** Rendered above the preview, e.g. save and publish buttons. */
  toolbar?: ReactNode
  /**
   * What the canvas has picked. Lets a host panel outside the builder follow
   * the selection — the AI designer aims a revision at the chosen block, or
   * at the section when no block is. `blockId` is always inside `sectionId`.
   */
  onSelectionChange?: (selection: { sectionId: string | null; blockId: string | null }) => void
  /** Said above the preview before the "click a section" hint, e.g. which theme it uses. */
  previewNote?: string
  /**
   * Replaces the left panel — the section list and theme settings — with the
   * host's own content, e.g. the AI designer's chat. The preview, the
   * selection and both responsive layouts stay exactly as they are; the host
   * closes it to hand the editor panel back. A host panel owns its own
   * scrolling and height.
   */
  panelOverride?: ReactNode
  /** The height the editor fills (a length or `100%`); panels scroll inside it. */
  height?: string
  /**
   * Draw the sections inside a template's own, read-only: the template's
   * sections render around them, and the edited sections go into the
   * template's `slot` — for an article, the `article-content` section's
   * `articleBody`. Page edges are then the template's.
   */
  frame?: {
    template: readonly SectionInstance[]
    slot: keyof NonNullable<RenderEnvironment['slots']>
    /**
     * What the frame draws from the thing being edited — an article's cover,
     * title, date and tags — as something the seller picks like a section:
     * a pinned row at the top of the list, and the frame sections of
     * `sectionTypes` clickable in the preview. Either opens `content` (the
     * screen's own form) in the panel.
     */
    details?: FrameDetails
  }
}

export interface FrameDetails {
  /** Frame section types that stand for the details, e.g. `['article-header']`. */
  sectionTypes: readonly string[]
  label: string
  /** Under the label in the panel. */
  description?: string
  /** Under the label in the list, e.g. the article's title. */
  detail?: string
  /** The form, drawn in the panel while the details are picked. */
  content: ReactNode
  /**
   * Bumped by the screen to open the details from outside the builder — a
   * header button, a save refused over one of their fields.
   */
  openRequest?: number
}

/**
 * Room kept above a revealed section, past the header: the outline stands 6px
 * off it, and a selected section's toolbar sits on top of the outline.
 */
const REVEAL_GAP = 48

/**
 * The editor preview's wishlist: an empty, write-less set so product cards
 * draw the heart they draw on the storefront without pretending to save.
 */
const PREVIEW_WISHLIST: NonNullable<RenderEnvironment['wishlist']> = {
  ids: new Set(),
  onToggle: () => undefined,
}

/**
 * Scroll the preview so section `id` is in view below the header, not under
 * it. `start` brings its top to just under the header (a section picked from
 * the list); `nearest` only nudges it on screen if it went off (a section
 * moved or copied). The header's height is measured the moment it is needed,
 * since `scrollIntoView` knows nothing of it.
 */
function revealSection(doc: Document, id: string, how: 'start' | 'nearest') {
  const view = doc.defaultView
  const element = doc.querySelector<HTMLElement>(`[data-section-id="${id}"]`)
  if (!view || !element) return
  const rect = element.getBoundingClientRect()
  const covered = stickyHeaderHeight(doc)
  const top = Math.max(0, view.scrollY + rect.top - covered - REVEAL_GAP)
  if (how === 'start') {
    view.scrollTo({ top, behavior: 'smooth' })
    return
  }
  if (rect.top < covered + REVEAL_GAP) view.scrollTo({ top })
  else if (rect.bottom > view.innerHeight) {
    // Bottom on screen, but never at the price of pushing the top under the header.
    view.scrollTo({ top: Math.min(top, view.scrollY + rect.bottom - view.innerHeight + 16) })
  }
}

/**
 * How much of the preview's top the store header covers once the page
 * scrolls: a sticky or fixed one — see-through or not — stays over whatever
 * passes under it, and covers its own height. Measured from the page as
 * drawn, so an announcement strip, a two-row layout or a phone-width menu
 * all count.
 *
 * Only the store header counts: article and section bodies also render
 * `<header>` elements (e.g. `article-header`), deeper in the page, and those
 * must never offset the reveal. The store header is the preview's top-level
 * one — the `[data-section-id]` wrapper when the layout is editable, or a
 * bare `<header>` straight under the preview root in a read-only preview.
 */
function stickyHeaderHeight(doc: Document): number {
  const view = doc.defaultView
  if (!view) return 0
  const root = doc.body.firstElementChild as HTMLElement | null
  const framed =
    root?.querySelector<HTMLElement>(`:scope > [data-section-id="${HEADER_ID}"]`) ??
    doc.querySelector<HTMLElement>(`[data-section-id="${HEADER_ID}"]`)
  const candidates: HTMLElement[] = []
  if (framed) {
    candidates.push(framed)
    const inner = framed.querySelector<HTMLElement>('header')
    if (inner) candidates.push(inner)
  } else if (root) {
    for (const child of root.children) {
      if (child instanceof HTMLElement && child.tagName.toLowerCase() === 'header') {
        candidates.push(child)
      }
    }
    if (candidates.length === 0) {
      const top = root.querySelector<HTMLElement>(':scope > header')
      if (top) candidates.push(top)
    }
  }
  let height = 0
  for (const element of candidates) {
    const { position } = view.getComputedStyle(element)
    if (position === 'sticky' || position === 'fixed') {
      height = Math.max(height, element.getBoundingClientRect().height)
    }
  }
  return height
}

/** The template switcher's label for each template a theme designs. */
const TEMPLATE_LABELS = {
  home: 'templateHome',
  product: 'templateProduct',
  article: 'templateArticle',
  catalog: 'templateCatalog',
  orderTracking: 'templateOrderTracking',
} as const satisfies Record<TemplateKey, string>

/**
 * What the add search was opened for. One object instead of three booleans:
 * the target section a "+ Add block" belongs to cannot be lost when another
 * flag changes, and the dialog's mode is always unambiguous.
 */
type AddDialogState =
  | { mode: 'all' }
  | { mode: 'insert'; insertAt: number }
  | { mode: 'blocks'; targetSectionId: string }

export function PageBuilder(props: PageBuilderProps) {
  return (
    <PaletteDragProvider>
      <CatalogueProvider initial={props.data.products ?? []}>
        {(products) => <Builder {...props} products={products} />}
      </CatalogueProvider>
    </PaletteDragProvider>
  )
}

function Builder({
  sections,
  onSectionsChange,
  settings,
  onSettingsChange,
  data,
  services,
  formatPrice,
  scope = 'home',
  template,
  layout,
  onLayoutChange,
  menus = NO_MENUS,
  footerPages: footerPagesProp = NO_PAGES,
  history,
  toolbar,
  onSelectionChange,
  previewNote,
  panelOverride,
  height = 'calc(100dvh - 9rem)',
  frame,
  startWithLooks,
  products,
}: PageBuilderProps & { products: StorefrontRenderData['latest'] }) {
  const { t, l, locale } = useEditorText()
  // What is picked: a section, maybe a block in it or a button / text element
  // in its element map (see `EditorSelection`). Every change to it, and to the
  // sections, goes through the core's commands (`run`, below).
  const [selection, setSelection] = useState<EditorSelection>(NO_SELECTION)
  const {
    sectionId: selectedId,
    blockId: selectedBlockId,
    elementId: selectedElementId,
    elementKind: selectedElementKind,
  } = selection
  const [tab, setTab] = useState<'sections' | 'theme'>(startWithLooks ? 'theme' : 'sections')
  const [sectionTab, setSectionTab] = useState<'content' | 'style' | 'visibility'>('content')
  const [device, setDevice] = useState<PreviewDevice>('desktop')
  // The preview's colour mode. `null` follows the theme's designed mode until
  // the seller flips the toolbar switch; the live site's own switch is the
  // shopper's, so this only ever paints the preview.
  const [previewMode, setPreviewMode] = useState<'light' | 'dark' | null>(null)
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null)
  const designedMode: 'light' | 'dark' = themeDesignedForDark(settings) ? 'dark' : 'light'
  const previewColorMode = previewMode ?? designedMode
  const [notice, setNotice] = useState<string | null>(null)
  // Below `lg` the panel takes the whole width, and the preview opens as a
  // full-screen sheet from a button pinned to the bottom instead.
  const compact = useBreakpointValue({ base: true, lg: false }, { ssr: false }) ?? false
  const { splitter, root: splitterRoot, reset: resetPanel } = usePanelSplitter()
  const [addDialog, setAddDialog] = useState<AddDialogState | null>(null)
  // The tree's open sections, kept here: the list unmounts while a section's
  // settings are open, and the way back should find it as it was.
  const [treeExpanded, setTreeExpanded] = useState<ReadonlySet<string>>(() => new Set())
  const closeAddDialog = useCallback(() => setAddDialog(null), [])
  // The phone's sheet: the sections, the theme or the selection's settings.
  const [sheetOpen, setSheetOpen] = useState(false)
  const closeSheet = useCallback(() => setSheetOpen(false), [])
  // Dragged by its handle: up for the whole screen, down for half or closed.
  const sheet = useSheetDrag({ onClose: closeSheet })
  const footerSlot = useBuilderDialogFooter()

  const editableLayout = Boolean(layout && onLayoutChange)
  const details = frame?.details
  // What the selection means for the panel (see `inspectSelection`). A linked
  // copy edits through its original for structure and through its own
  // overrides for content: `source` is the original (schema and master
  // values), `resolvedSelected` is what the copy actually draws.
  const inspection = inspectSelection(sections, selection, {
    locale,
    editableLayout,
    details: Boolean(details),
  })
  const { selected, source, schema, block: selectedBlock } = inspection
  const resolvedSelected = inspection.resolved

  useHistoryKeys(
    history,
    useMemo(() => [globalThis.document ?? null, previewDoc], [previewDoc]),
  )

  // A host panel outside the builder follows what the canvas has picked,
  // block included — the AI chat aims its next edit at it.
  useEffect(() => {
    onSelectionChange?.({ sectionId: selectedId, blockId: selectedBlockId })
  }, [onSelectionChange, selectedId, selectedBlockId])

  // On a phone the sheet opens on the phone layout; a desktop one would be
  // shrunk to a third of its size.
  useEffect(() => {
    if (compact) setDevice('mobile')
  }, [compact])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 3500)
    return () => clearTimeout(timer)
  }, [notice])

  // A template switch starts on its list, not on a section of the other one.
  useEffect(() => setSelection(NO_SELECTION), [template?.value])

  // Opened from outside the builder. A count, so the same request twice opens
  // twice; the first render's value is where it starts, not a request.
  const openRequest = frame?.details?.openRequest ?? 0
  const lastOpenRequest = useRef(openRequest)
  useEffect(() => {
    if (openRequest === lastOpenRequest.current) return
    lastOpenRequest.current = openRequest
    setSelection({ ...NO_SELECTION, sectionId: DETAILS_ID })
    setTab('sections')
  }, [openRequest])

  // What the preview draws: a deferred copy, drawn after the input updates.
  const previewSections = useDeferredValue(sections)

  // The preview slides too, read from the iframe's own document: a reorder in
  // the list or a move from the toolbar both land here, and only the sections
  // that changed places animate.
  const previewRects = useRef<SectionRects>(new Map())
  const previewIndexes = useRef<Map<string, number>>(new Map())

  useLayoutEffect(() => {
    const ids = previewSections.map((section) => section.id)
    previewRects.current = flipElements(previewDoc, ids, previewRects.current, {
      attribute: 'data-section-id',
      animate: orderMoved(ids, previewIndexes.current),
    })
    previewIndexes.current = new Map(ids.map((id, index) => [id, index]))
  }, [previewDoc, previewSections])

  /**
   * Run one of the core's commands (see `editor-core/commands`) on the latest
   * sections and selection: the host gets the new sections, the panel the new
   * selection, and the preview scrolls to what the command points at. Read
   * through refs, so every handler below keeps one identity and the memoized
   * preview is not drawn again on each keystroke. Returns whether the command
   * did anything — the keyboard's cue to swallow the key.
   */
  const latest = useRef({ sections, onSectionsChange, selection, previewDoc, locale })
  latest.current = { sections, onSectionsChange, selection, previewDoc, locale }
  const run = useCallback((command: EditorCommand): boolean => {
    const current = latest.current
    const result = applyCommand(current.sections, current.selection, command, {
      locale: current.locale,
    })
    if (result.sections !== current.sections) {
      // Two commands in one event read what the first one wrote.
      current.sections = result.sections
      current.onSectionsChange(result.sections)
    }
    if (result.selection !== current.selection) {
      current.selection = result.selection
      setSelection(result.selection)
      // Anything picked is on the sections tab.
      if (result.selection.sectionId) setTab('sections')
    }
    if (result.expand) {
      const id = result.expand
      // The way back to the tree shows the branch the block sits in.
      setTreeExpanded((open) => (open.has(id) ? open : new Set([...open, id])))
    }
    const doc = current.previewDoc
    if (result.reveal && doc) {
      const { id, how } = result.reveal
      // Picked from the list: into view now. Moved or copied: once the preview
      // has re-rendered, and only a nudge if it went off-screen.
      if (how === 'start') revealSection(doc, id, 'start')
      else doc.defaultView?.requestAnimationFrame(() => revealSection(doc, id, 'nearest'))
    }
    return result.handled
  }, [])

  // Text typed into the preview, however deep the block sits in the tree.
  const onEditText = useCallback(
    (sectionId: string, key: string, value: string) =>
      void run({ type: 'edit-text', sectionId, key, value }),
    [run],
  )
  const onEditBlockText = useCallback(
    (sectionId: string, blockId: string, key: string, value: string) =>
      void run({ type: 'edit-block-text', sectionId, blockId, key, value }),
    [run],
  )

  // What the add palette is dragging, read through a ref so the drop handler
  // never closes over a stale item.
  const paletteDrag = usePaletteDrag()
  const dragRef = useRef(paletteDrag)
  dragRef.current = paletteDrag

  /**
   * A palette item dropped on the preview: a section lands between sections,
   * blocks land in the container the pointer named — or in a new Custom
   * section when dropped between sections instead. Dropped, not selected: the
   * palette stays open for the next item.
   */
  const onPaletteDrop = useCallback(
    (target: DropTarget) => {
      const { item, end } = dragRef.current
      end()
      if (!item) return
      run({
        type: 'drop',
        target,
        item:
          item.kind === 'section'
            ? { kind: 'section', sectionType: item.type, preset: item.preset }
            : { kind: 'blocks', blocks: item.blocks as readonly NewBlock[] },
      })
    },
    [run],
  )

  // A block clicked on the canvas: highlight it and open its panel.
  const onSelectBlock = useCallback(
    (sectionId: string, blockId: string) => void run({ type: 'select-block', sectionId, blockId }),
    [run],
  )

  // A block row clicked in the panel: the same selection, without re-picking
  // the section or moving it into view.
  const onSelectBlockInPanel = useCallback(
    (blockId: string) => void run({ type: 'select-block-in-panel', blockId }),
    [run],
  )

  // A button or text element clicked on the canvas: same, through the
  // section's element map. The kind decides which panel opens.
  const onSelectElement = useCallback(
    (sectionId: string, elementId: string, kind: ElementKind = 'button') =>
      void run({ type: 'select-element', sectionId, elementId, kind }),
    [run],
  )

  // Callers build `data` inline (`{ ...context.data, products }`); its parts
  // are what stay the same between renders, so they are what is compared.
  const envData = useMemo<StorefrontRenderData>(
    () => ({ ...data, products }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      data.shop,
      data.categories,
      data.collections,
      data.latest,
      data.vouchers,
      data.product,
      data.article,
      products,
    ],
  )

  const env = useMemo<RenderEnvironment>(
    () => ({
      data: envData,
      settings,
      mode: 'preview',
      imageUrl: services.imageUrl,
      videoUrl: services.videoUrl,
      formatPrice,
      // Drawn on the canvas exactly as the storefront draws it, but there is
      // no shopper to save for: the heart is a preview, not a control.
      wishlist: PREVIEW_WISHLIST,
      getWindow: previewDoc?.defaultView ? () => previewDoc.defaultView! : undefined,
      editing: {
        onEditText,
        onEditBlockText,
        onSelectBlock,
        selectedBlockId,
        onSelectElement,
        selectedElementId,
      },
    }),
    [
      envData,
      settings,
      services.imageUrl,
      services.videoUrl,
      formatPrice,
      previewDoc,
      onEditText,
      onEditBlockText,
      onSelectBlock,
      selectedBlockId,
      onSelectElement,
      selectedElementId,
    ],
  )

  // The footer's page list, compared by what it says: callers map it inline.
  const footerKey = JSON.stringify(footerPagesProp)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const footerPages = useMemo(() => footerPagesProp, [footerKey])

  // A section picked: from the list it scrolls into view; from the preview
  // it is already there. Any block or element of the previous one is dropped.
  const select = useCallback(
    (id: string, fromPreview = false) => void run({ type: 'select', sectionId: id, fromPreview }),
    [run],
  )

  /**
   * After the preview re-renders — a section moved or was copied — keep it in
   * view. `nearest` and no smooth scroll: a nudge only when it went off-screen.
   */
  const revealSoon = useCallback(
    (id: string) => {
      const view = previewDoc?.defaultView
      view?.requestAnimationFrame(() => previewDoc && revealSection(previewDoc, id, 'nearest'))
    },
    [previewDoc],
  )

  const clearSelection = () => void run({ type: 'clear-selection' })

  const layoutPart =
    selectedId === HEADER_ID ? 'header' : selectedId === FOOTER_ID ? 'footer' : null

  // Actions on the canvas-selected block. Each is a command on the latest
  // sections, so a click on a stale panel can never clobber a newer edit.
  const blockActions =
    selectedBlock && selected && schema
      ? {
          up: () =>
            void run({
              type: 'move-block',
              sectionId: selected.id,
              blockId: selectedBlock.block.id,
              by: -1,
            }),
          down: () =>
            void run({
              type: 'move-block',
              sectionId: selected.id,
              blockId: selectedBlock.block.id,
              by: 1,
            }),
          duplicate: () =>
            void run({
              type: 'duplicate-block',
              sectionId: selected.id,
              blockId: selectedBlock.block.id,
            }),
          remove: () =>
            void run({
              type: 'remove-block',
              sectionId: selected.id,
              blockId: selectedBlock.block.id,
            }),
        }
      : null

  // Which screen the panel shows, and how deep it sits in the stack. The
  // slide between screens reads the depth: deeper is forward, shallower back.
  // Picking another section at the same depth is lateral, and slides forward.
  const panelView = { view: inspection.panel.key, depth: inspection.panel.depth }

  /**
   * A section added from the add search: at the "+" it came from, or after
   * the selected section as Ctrl+K always did.
   */
  const addDialogIndex = () => {
    if (addDialog?.mode === 'insert') {
      return Math.max(0, Math.min(sections.length, addDialog.insertAt))
    }
    const after = selected ? sections.findIndex((other) => other.id === selected.id) + 1 : 0
    return after > 0 ? after : sections.length
  }

  const addSectionFromCommand = (type: SectionType, preset: SectionPreset | null) =>
    void run({ type: 'add-section', sectionType: type, preset, index: addDialogIndex() })

  /**
   * Blocks added from the add search. "+ Add block" targets the section it
   * was opened from and appends there; Ctrl+K goes into the selected Custom
   * blocks section, after the selected block when there is one. Anywhere else
   * they start a new section.
   */
  const addBlocksFromCommand = (blocks: readonly PaletteBlock[]) =>
    void run({
      type: 'add-blocks',
      blocks: blocks as readonly NewBlock[],
      index: addDialogIndex(),
      into:
        addDialog?.mode === 'blocks'
          ? { sectionId: addDialog.targetSectionId }
          : addDialog?.mode === 'all' && selected && schema?.type === 'blocks' && !selected.linkedTo
            ? { sectionId: selected.id, afterBlockId: selectedBlock?.block.id ?? null }
            : null,
    })

  /**
   * The editor's keys, attached once: Delete removes the selection, Ctrl/⌘+D
   * duplicates it, Alt+↑/↓ moves it, and — in the preview — Escape steps out
   * to its parent. Ctrl/⌘+K opens the command palette from anywhere, a text
   * field included. Each is a command on whatever is selected.
   */
  const shortcuts = useRef({
    remove: () => run({ type: 'remove-selection' }),
    duplicate: () => run({ type: 'duplicate-selection' }),
    move: (by: -1 | 1) => run({ type: 'move-selection', by }),
    escape: () => run({ type: 'step-out' }),
  })

  useEffect(() => {
    const docs = [globalThis.document ?? null, previewDoc].filter(
      (doc): doc is Document => doc !== null,
    )
    const listeners = docs.map((doc) => {
      const inPreview = doc === previewDoc
      const onKey = (event: KeyboardEvent) => {
        const mod = event.ctrlKey || event.metaKey
        const key = event.key.toLowerCase()
        if (mod && !event.shiftKey && !event.altKey && key === 'k') {
          event.preventDefault()
          setAddDialog((current) => (current ? null : { mode: 'all' }))
          return
        }
        if (event.defaultPrevented) return
        const target = event.target as HTMLElement | null
        // Typing, a menu or a listbox own their keys.
        if (
          typeof target?.closest === 'function' &&
          target.closest(
            'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="menu"], [role="listbox"], [role="option"]',
          )
        )
          return
        const run = (action: () => boolean) => {
          if (action()) event.preventDefault()
        }
        if ((key === 'delete' || key === 'backspace') && !mod && !event.altKey) {
          run(shortcuts.current.remove)
        } else if (mod && key === 'd') {
          run(shortcuts.current.duplicate)
        } else if (event.altKey && (key === 'arrowup' || key === 'arrowdown')) {
          run(() => shortcuts.current.move(key === 'arrowup' ? -1 : 1))
        } else if (key === 'escape' && inPreview) {
          // Only in the preview: on the page, Escape belongs to the dialog the
          // editor may be open in.
          run(shortcuts.current.escape)
        }
      }
      doc.addEventListener('keydown', onKey)
      return () => doc.removeEventListener('keydown', onKey)
    })
    return () => listeners.forEach((remove) => remove())
  }, [previewDoc])

  const commandCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const section of sections) map.set(section.type, (map.get(section.type) ?? 0) + 1)
    return map
  }, [sections])

  // The way back from the open screen, as a trail of its parents: all
  // sections, the section, then each block the selection sits in. Every step
  // is a link, so a nested block is one click from any level above it.
  // The section wears the seller's own name when it has one, like its blocks.
  const crumbs: Crumb[] = inspection.crumbs.map((crumb) => ({
    label: crumb.kind === 'list' ? t('back') : crumb.label,
    onClick: () => void run(crumb.command),
  }))
  const trail = <PanelTrail crumbs={crumbs} />

  const inspector =
    selectedId === DETAILS_ID && details ? (
      <Stack gap="4">
        {trail}
        <Stack gap="1">
          <Text fontWeight="semibold">{details.label}</Text>
          {details.description && (
            <Text textStyle="xs" color="fg.muted">
              {details.description}
            </Text>
          )}
        </Stack>
        {details.content}
      </Stack>
    ) : layoutPart && layout && onLayoutChange ? (
      <Stack gap="4">
        {trail}
        <Stack gap="1">
          <Text fontWeight="semibold">{l(LAYOUT_PART_NAMES[layoutPart])}</Text>
          <Text textStyle="xs" color="fg.muted">
            {l(LAYOUT_PART_DESCRIPTIONS[layoutPart])}
          </Text>
        </Stack>
        <FieldsForm
          fields={layoutPart === 'header' ? HEADER_FIELDS : FOOTER_FIELDS}
          values={layout[layoutPart]}
          services={services}
          onChange={(values: FieldValues) => onLayoutChange({ ...layout, [layoutPart]: values })}
        />
      </Stack>
    ) : selected && schema && selectedBlock && blockActions ? (
      <Stack gap="4">
        {trail}
        <Stack gap="1">
          <HStack gap="1.5" minW="0">
            <Text fontWeight="semibold" truncate minW="0">
              {schema.type === 'blocks' && selectedBlock.block.name?.trim()
                ? selectedBlock.block.name.trim()
                : l(selectedBlock.schema.name)}
            </Text>
            {!selected.linkedTo && schema.type === 'blocks' && (
              <BlockNamePopover
                value={selectedBlock.block.name ?? ''}
                fallback={l(selectedBlock.schema.name)}
                onChange={(name) =>
                  void run({
                    type: 'rename-block',
                    sectionId: selected.id,
                    blockId: selectedBlock.block.id,
                    name,
                  })
                }
              />
            )}
          </HStack>
          {selectedBlock.schema.description && (
            <Text textStyle="xs" color="fg.muted">
              {l(selectedBlock.schema.description)}
            </Text>
          )}
        </Stack>
        <HStack gap="1">
          <IconButton
            aria-label={t('moveUp')}
            size="xs"
            variant="outline"
            disabled={selectedBlock.index === 0}
            onClick={blockActions.up}
          >
            <LuArrowUp />
          </IconButton>
          <IconButton
            aria-label={t('moveDown')}
            size="xs"
            variant="outline"
            disabled={selectedBlock.index >= selectedBlock.count - 1}
            onClick={blockActions.down}
          >
            <LuArrowDown />
          </IconButton>
          <IconButton
            aria-label={t('duplicate')}
            size="xs"
            variant="outline"
            disabled={selectedBlock.count >= selectedBlock.field.max}
            onClick={blockActions.duplicate}
          >
            <LuCopy />
          </IconButton>
          <IconButton
            aria-label={t('remove')}
            size="xs"
            variant="outline"
            colorPalette="danger"
            onClick={blockActions.remove}
          >
            <LuTrash2 />
          </IconButton>
          {!selected.linkedTo && canSaveBlock(selectedBlock.block) && (
            <SaveBlockPopover
              block={selectedBlock.block}
              fallbackName={l(selectedBlock.schema.name)}
            />
          )}
          {!selected.linkedTo && schema.type === 'blocks' && (
            <BlockMoveMenu
              fields={schema.fields}
              values={selected.settings}
              blockId={selectedBlock.block.id}
              onChange={(settings) =>
                void run({
                  type: 'set-section-settings',
                  id: selected.id,
                  values: settings,
                  reseed: false,
                })
              }
            />
          )}
        </HStack>
        <FieldsForm
          fields={selectedBlock.schema.fields}
          values={selectedBlock.block.settings}
          services={services}
          // A linked copy's block content is its own override; the command routes it.
          onChange={(values) =>
            void run({
              type: 'set-block-settings',
              sectionId: selected.id,
              blockId: selectedBlock.block.id,
              values,
            })
          }
        />
        {selectedBlock.field.styleFields && (
          <BlockStylePanel
            fields={selectedBlock.field.styleFields}
            values={selectedBlock.block.style ?? {}}
            services={services}
            onChange={(style) =>
              void run({
                type: 'set-block-style',
                sectionId: selected.id,
                blockId: selectedBlock.block.id,
                style,
              })
            }
          />
        )}
      </Stack>
    ) : selected && selectedElementId ? (
      <Stack gap="4">
        {trail}
        <Stack gap="1">
          <Text fontWeight="semibold">
            {selectedElementKind === 'text' ? t('textElement') : t('buttonElement')}
          </Text>
          <Text textStyle="xs" color="fg.muted">
            {selectedElementKind === 'text' ? t('textElementHelp') : t('buttonElementHelp')}
          </Text>
        </Stack>
        <FieldsForm
          fields={selectedElementKind === 'text' ? TEXT_ELEMENT_FIELDS : BUTTON_ELEMENT_FIELDS}
          values={
            source?.elements?.[selectedElementId] ??
            (selectedElementKind === 'text'
              ? { ...TEXT_ELEMENT_DEFAULTS }
              : { ...BUTTON_ELEMENT_DEFAULTS })
          }
          services={services}
          onChange={(values) =>
            void run({
              type: 'set-element',
              sectionId: selected.id,
              elementId: selectedElementId,
              values,
            })
          }
        />
        <Button
          size="xs"
          variant="outline"
          alignSelf="start"
          onClick={() =>
            void run({
              type: 'reset-element',
              sectionId: selected.id,
              elementId: selectedElementId,
            })
          }
        >
          {t('resetToTheme')}
        </Button>
      </Stack>
    ) : selected && schema && SECTION_LINKING_ENABLED && selected.linkedTo ? (
      <Stack gap="4">
        {trail}
        <Stack gap="1">
          <HStack gap="2">
            <Icon as={LuLink} color="brand.solid" />
            <Text fontWeight="semibold">
              {sectionDisplayName(selected, sections, l(schema.name))}
            </Text>
          </HStack>
          <Text textStyle="xs" color="fg.muted">
            {t('linkedHelp')}
          </Text>
        </Stack>
        {overridableFields(schema.fields).length > 0 && (
          <FieldsForm
            fields={overridableFields(schema.fields)}
            values={resolvedSelected?.settings ?? selected.settings}
            services={services}
            onChange={(values) =>
              void run({ type: 'set-section-overrides', id: selected.id, values })
            }
          />
        )}
        {selected.overrides && (
          <Stack gap="1" borderTopWidth="1px" borderColor="border.subtle" pt="3">
            <Text fontSize="xs" fontWeight="semibold">
              {t('overridesTitle')}
            </Text>
            {Object.keys(selected.overrides.fields ?? {}).map((key) => {
              const field = overridableFields(schema.fields).find((entry) => entry.key === key)
              return (
                <HStack key={key} gap="2" justify="space-between">
                  <Text fontSize="xs" color="fg.muted" truncate>
                    {field ? l(field.label) : key}
                  </Text>
                  <IconButton
                    aria-label={t('resetOverride')}
                    size="2xs"
                    variant="ghost"
                    onClick={() =>
                      void run({ type: 'clear-overrides', id: selected.id, field: key })
                    }
                  >
                    <LuX />
                  </IconButton>
                </HStack>
              )
            })}
            {Object.keys(selected.overrides.blocks ?? {}).map((blockId) => {
              const found = source ? findBlock(schema.fields, source.settings, blockId) : null
              return (
                <HStack key={blockId} gap="2" justify="space-between">
                  <Text fontSize="xs" color="fg.muted" truncate>
                    {found ? found.block.name?.trim() || l(found.schema.name) : blockId}
                  </Text>
                  <IconButton
                    aria-label={t('resetOverride')}
                    size="2xs"
                    variant="ghost"
                    onClick={() => void run({ type: 'clear-overrides', id: selected.id, blockId })}
                  >
                    <LuX />
                  </IconButton>
                </HStack>
              )
            })}
          </Stack>
        )}
        <HStack gap="2" wrap="wrap">
          {sections.some((section) => section.id === selected.linkedTo) && (
            <Button size="xs" variant="outline" onClick={() => select(selected.linkedTo!, true)}>
              <Icon as={LuLink} />
              {t('editMaster')}
            </Button>
          )}
          <Button
            size="xs"
            variant="outline"
            onClick={() => void run({ type: 'detach-section', id: selected.id })}
          >
            <Icon as={LuUnlink} />
            {t('detach')}
          </Button>
          {selected.overrides && (
            <Button
              size="xs"
              variant="ghost"
              colorPalette="danger"
              onClick={() => void run({ type: 'clear-overrides', id: selected.id })}
            >
              {t('resetAll')}
            </Button>
          )}
        </HStack>
      </Stack>
    ) : selected && schema ? (
      <Stack gap="4">
        {trail}
        <Stack gap="1">
          <HStack gap="1.5" minW="0">
            <Text fontWeight="semibold" truncate minW="0">
              {sectionDisplayName(selected, sections, l(schema.name))}
            </Text>
            {!selected.linkedTo && schema.type === 'blocks' && (
              <BlockNamePopover
                value={selected.name ?? ''}
                fallback={l(schema.name)}
                renameMessage="renameSection"
                nameMessage="sectionName"
                onChange={(name) => void run({ type: 'rename-section', id: selected.id, name })}
              />
            )}
          </HStack>
          <Text textStyle="xs" color="fg.muted">
            {l(schema.description)}
          </Text>
        </Stack>
        <Tabs.Root
          value={sectionTab}
          onValueChange={({ value }) => setSectionTab(value as typeof sectionTab)}
          size="sm"
          variant="line"
          fitted
        >
          <Tabs.List mb="4">
            <Tabs.Trigger value="content">{t('sectionContent')}</Tabs.Trigger>
            <Tabs.Trigger value="style">{t('sectionStyle')}</Tabs.Trigger>
            <Tabs.Trigger value="visibility">{t('sectionVisibility')}</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="content" p="0">
            <Stack gap="4">
              {schema.fields.length === 0 ? (
                <Text fontSize="sm" color="fg.muted">
                  {l(schema.description)}
                </Text>
              ) : (
                <FieldsForm
                  fields={schema.fields}
                  values={selected.settings}
                  services={services}
                  // A changed choice may re-seed the content that goes with it —
                  // the gallery's look trades its sample photos — but only while
                  // the seller has not made that content their own (see
                  // `reseedSectionVariant`); the command does that.
                  onChange={(values) =>
                    void run({ type: 'set-section-settings', id: selected.id, values })
                  }
                />
              )}
            </Stack>
          </Tabs.Content>
          <Tabs.Content value="style" p="0">
            <FieldGroups
              groups={STYLE_GROUPS}
              values={selected.style}
              services={services}
              defaultOpen={['surface']}
              onChange={(style) => void run({ type: 'set-section-style', id: selected.id, style })}
            />
          </Tabs.Content>
          <Tabs.Content value="visibility" p="0">
            <Stack gap="4">
              <FieldsForm
                fields={VISIBILITY_FIELDS}
                values={selected.style}
                services={services}
                onChange={(style) =>
                  void run({ type: 'set-section-style', id: selected.id, style })
                }
              />
            </Stack>
          </Tabs.Content>
        </Tabs.Root>
      </Stack>
    ) : null

  const listView = (
    <Stack gap="4">
      {notice && (
        <Alert.Root status="success" size="sm">
          <Alert.Indicator />
          <Alert.Description>{notice}</Alert.Description>
        </Alert.Root>
      )}
      {onSettingsChange ? (
        <Tabs.Root
          value={tab}
          onValueChange={({ value }) => setTab(value as 'sections' | 'theme')}
          size="sm"
          variant="line"
          fitted
        >
          <Tabs.List mb="4">
            <Tabs.Trigger value="sections">
              <Icon as={LuLayers} />
              {t('sections')}
            </Tabs.Trigger>
            <Tabs.Trigger value="theme">
              <Icon as={LuPalette} />
              {t('theme')}
            </Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="sections" p="0">
            {list()}
          </Tabs.Content>
          <Tabs.Content value="theme" p="0">
            <ThemeSettingsPanel
              settings={settings}
              onChange={onSettingsChange}
              shop={{ name: data.shop.name, logoUrl: data.shop.logoUrl }}
              priorityLookKeys={startWithLooks?.priorityKeys}
              sections={sections}
              onSectionsChange={onSectionsChange}
              onTranslate={services.translate}
            />
          </Tabs.Content>
        </Tabs.Root>
      ) : (
        list()
      )}
    </Stack>
  )
  const panel = inspector ?? listView

  function list() {
    return (
      <SectionList
        sections={sections}
        onChange={onSectionsChange}
        selectedId={selectedId}
        onSelect={(id) => select(id)}
        scope={scope}
        onNotice={setNotice}
        selectedBlockId={selectedBlockId}
        onSelectBlock={onSelectBlock}
        expanded={treeExpanded}
        onExpandedChange={setTreeExpanded}
        onAddBlock={(sectionId) => {
          // Do not change the selection just to open the picker. The target
          // section is carried by the dialog state; the new block selects it
          // once it has actually been inserted.
          setAddDialog({ mode: 'blocks', targetSectionId: sectionId })
        }}
        before={
          details || editableLayout ? (
            <>
              {details && (
                <PinnedRow
                  icon="header"
                  label={details.label}
                  detail={details.detail}
                  selected={selectedId === DETAILS_ID}
                  onSelect={() => select(DETAILS_ID)}
                />
              )}
              {editableLayout && (
                <PinnedRow
                  icon="header"
                  label={l(LAYOUT_PART_NAMES.header)}
                  selected={selectedId === HEADER_ID}
                  onSelect={() => select(HEADER_ID)}
                />
              )}
            </>
          ) : null
        }
        after={
          editableLayout ? (
            <PinnedRow
              icon="footer"
              label={l(LAYOUT_PART_NAMES.footer)}
              selected={selectedId === FOOTER_ID}
              onSelect={() => select(FOOTER_ID)}
            />
          ) : null
        }
      />
    )
  }

  const shop = useMemo(
    () => ({
      name: data.shop.name,
      logoUrl: data.shop.logoUrl,
      description: data.shop.description,
      email: data.shop.email ?? null,
    }),
    [data.shop],
  )

  // The same rules the storefront applies, from the same helpers, so the
  // preview's banner meets the header exactly as the live one does.
  const edges = useMemo(
    () => pageEdges(drawnSections(frame?.template ?? previewSections, 'preview', new Date())),
    [frame?.template, previewSections],
  )
  const transparent = scope === 'home' && !!layout && isHeaderTransparent(layout.header, edges)

  /**
   * Clicking the preview's empty space — outside every section and the
   * header/footer rows — drops the whole selection, the block or element
   * included, and returns to the list. Bubble phase, so a click on a section
   * reaches that section's own capture-phase picker first and is left alone
   * here.
   */
  const clickAway = useCallback(
    (event: { target: EventTarget | null }) => {
      const target = event.target as HTMLElement | null
      if (typeof target?.closest !== 'function' || target.closest('[data-section-id]')) return
      void run({ type: 'clear-selection' })
    },
    [run],
  )

  const pickable = useCallback(
    (id: string, content: ReactNode, sticky = false) =>
      editableLayout ? (
        <Box
          data-section-id={id}
          // A sticky header can only stick inside its parent: the wrapper sticks instead.
          {...(sticky && { position: 'sticky', top: '0', zIndex: 'docked' })}
          cursor="pointer"
          outline="2px solid"
          outlineColor={selectedId === id ? 'brand.solid' : 'transparent'}
          outlineOffset="-2px"
          _hover={{ outlineColor: selectedId === id ? 'brand.solid' : 'brand.muted' }}
          onClickCapture={(event) => {
            event.preventDefault()
            select(id, true)
          }}
        >
          {content}
        </Box>
      ) : (
        content
      ),
    [editableLayout, selectedId, select],
  )

  // The header and footer, drawn again only when they change — never for a
  // keystroke in a section.
  const header = useMemo(() => {
    if (!layout) return null
    /** Stand-ins for the storefront's own search, cart and account controls. */
    const standIn = (icon: typeof LuSearch, label: string) => (
      <IconButton aria-label={label} variant="ghost" size="sm" rounded="full" color="inherit">
        <Icon as={icon} boxSize="4.5" />
      </IconButton>
    )
    return pickable(
      HEADER_ID,
      <StoreHeader
        header={layout.header}
        shop={shop}
        menu={menus.main}
        categories={data.categories}
        collections={data.collections}
        searchField={
          <Box
            h="8"
            rounded="full"
            bg="bg.subtle"
            display="flex"
            alignItems="center"
            gap="2"
            px="3"
            color="fg.subtle"
            fontSize="sm"
          >
            <Icon as={LuSearch} boxSize="4" />
          </Box>
        }
        searchButton={standIn(LuSearch, t('standInSearch'))}
        cart={standIn(LuShoppingBag, t('standInCart'))}
        account={standIn(LuUser, t('standInAccount'))}
        transparent={transparent}
      />,
      // A see-through header is fixed itself; only an in-flow one needs its
      // wrapper to stick.
      Boolean(layout.header.sticky) && !transparent,
    )
  }, [layout, shop, menus.main, transparent, pickable, t])

  const footer = useMemo(
    () =>
      layout
        ? pickable(
            FOOTER_ID,
            <StoreFooter
              footer={layout.footer}
              shop={shop}
              menu={menus.footer}
              categories={data.categories}
              collections={data.collections}
              pages={footerPages}
              labels={{
                information: t('footerInformation'),
                followUs: t('footerFollowUs'),
                links: t('footerLinks'),
                trackOrder: t('footerTrackOrder'),
              }}
              bottom={t('poweredBy')}
              flush={edges.flushBottom}
            />,
          )
        : null,
    [layout, shop, menus.footer, footerPages, edges.flushBottom, pickable, t],
  )

  // The phone's tab bar, when the header asks for one. Picking it opens the
  // header's settings, where the choice lives. The tabs are stand-ins for the
  // storefront's own, like the header's icons; the catalogue tab and the
  // header's menu button are the chrome's own and need no stand-in.
  const tabBar = useMemo(() => {
    if (!layout || !hasTabBar(layout.header)) return null
    return pickable(
      HEADER_ID,
      <StoreTabBar
        header={layout.header}
        homeActive={scope === 'home'}
        cart={<StoreTab icon={LuShoppingBag} label={t('standInCart')} />}
        account={<StoreTab icon={LuUser} label={t('standInAccount')} />}
      />,
    )
  }, [layout, scope, pickable, t])

  // The preview's "+": open the add palette in the list, aimed between two
  // sections. The selection is dropped so the list is on screen to take it.
  // The preview's "+": the add search opens over the preview, where the
  // seller is looking, aimed at that spot — not in the list off to one side,
  // which a narrow screen or the AI panel may not even show.
  const onInsert = useCallback((sectionId: string, place: 'before' | 'after') => {
    const found = latest.current.sections.findIndex((section) => section.id === sectionId)
    if (found < 0) return
    setAddDialog({ mode: 'insert', insertAt: place === 'before' ? found : found + 1 })
  }, [])
  const sectionLabel = useCallback(
    (section: SectionInstance) => {
      const shape = sectionSchema(section.type)
      // The sections through a ref: the label must not change identity on
      // every keystroke, or the memoized preview would draw again for each.
      return shape
        ? sectionDisplayName(section, latest.current.sections, l(shape.name))
        : section.type
    },
    [l],
  )
  const insertLabel = t('addSectionHere')

  const edited = useMemo(
    () => (
      <SectionsRenderer
        sections={previewSections}
        env={env}
        selectedId={selectedId}
        onSelect={(id) => select(id, true)}
        label={sectionLabel}
        onInsert={onInsert}
        insertLabel={insertLabel}
        toolbar={(section) => (
          <SectionToolbar
            section={section}
            sections={latest.current.sections}
            onChange={onSectionsChange}
            onSelect={(id) => {
              select(id, true)
              revealSoon(id)
            }}
            onMoved={revealSoon}
            onRemoved={() => void run({ type: 'clear-selection' })}
          />
        )}
      />
    ),
    [
      previewSections,
      env,
      selectedId,
      select,
      revealSoon,
      onSectionsChange,
      sectionLabel,
      onInsert,
      insertLabel,
    ],
  )

  // The frame gets no `editing` — its headings are the theme's, and typing
  // into one here would edit nothing — and its slot is the stable outlet.
  // Keyed on the frame's parts: callers pass `frame` as an inline object.
  const frameTemplate = frame?.template
  const frameSlot = frame?.slot
  const frameEnv = useMemo<RenderEnvironment | null>(
    () =>
      frameSlot
        ? { ...env, editing: undefined, slots: { ...env.slots, [frameSlot]: <EditedOutlet /> } }
        : null,
    [env, frameSlot],
  )
  // The frame sections that stand for the details, picked as the details.
  const detailTypes = frame?.details?.sectionTypes.join('|') ?? ''
  const detailsSelected = selectedId === DETAILS_ID
  const framed = useMemo(() => {
    if (!frameTemplate || !frameEnv) return null
    if (!detailTypes) return <SectionsRenderer sections={frameTemplate} env={frameEnv} />
    const types = detailTypes.split('|')
    const stands = frameTemplate.find((section) => types.includes(section.type))
    return (
      <SectionsRenderer
        sections={frameTemplate}
        env={frameEnv}
        pickable={(section) => types.includes(section.type)}
        selectedId={detailsSelected ? (stands?.id ?? null) : null}
        onSelect={() => select(DETAILS_ID, true)}
      />
    )
  }, [frameTemplate, frameEnv, detailTypes, detailsSelected, select])

  const preview = useMemo(
    () => (
      <RenderProvider value={env}>
        {/* No size container here: it would become the containing block of the
            see-through header, which is `position: fixed` to the preview's own
            window. The page's width container is the box around the sections. */}
        <ThemeScope
          settings={settings}
          mode={previewColorMode}
          minH="100dvh"
          display="flex"
          flexDirection="column"
          onClick={clickAway}
        >
          {header}
          <Box flex="1" {...PAGE_WIDTH_CONTAINER}>
            <Container
              maxW="6xl"
              px={{ base: '4', md: '6' }}
              pt={edges.flushTop ? '0' : { base: '6', md: '10' }}
              pb={edges.flushBottom ? '0' : { base: '6', md: '10' }}
            >
              {framed ? (
                <EditedContext.Provider value={edited}>{framed}</EditedContext.Provider>
              ) : (
                edited
              )}
            </Container>
          </Box>
          {footer}
          {tabBar}
        </ThemeScope>
      </RenderProvider>
    ),
    [
      env,
      settings,
      previewColorMode,
      clickAway,
      header,
      edges.flushTop,
      edges.flushBottom,
      framed,
      edited,
      footer,
      tabBar,
    ],
  )

  // The device switch, undo and redo, and the screen's own buttons: above the
  // preview beside the panel, or in the preview sheet on a narrow screen.
  // Its tooltips and segment group are not cheap; nothing in it changes as a section is typed into.
  const previewBar = useMemo(
    () => (
      <Flex justify="space-between" align="center" gap="3" wrap="wrap">
        <HStack gap="2" wrap="wrap">
          {/* Which template is open, as Shopify's top bar has it: beside the
              preview it changes, not above the section list. */}
          {template && (
            <Box w="44" aria-label={t('editingTemplate')}>
              <SelectInput
                size="xs"
                value={template.value}
                onChange={(value) => value && template.onChange(value as TemplateKey)}
                options={TEMPLATE_KEYS.map((key) => ({
                  value: key,
                  label: t(TEMPLATE_LABELS[key]),
                }))}
              />
            </Box>
          )}
          {/* A phone previews as a phone: there is no room to show a desktop. */}
          {!compact && (
            <SegmentGroup.Root
              size="xs"
              value={device}
              onValueChange={({ value }) => value && setDevice(value as PreviewDevice)}
            >
              <SegmentGroup.Indicator />
              {(
                [
                  ['desktop', LuMonitor, 'deviceDesktop'],
                  ['tablet', LuTablet, 'deviceTablet'],
                  ['mobile', LuSmartphone, 'deviceMobile'],
                ] as const
              ).map(([value, glyph, label]) => (
                <Tooltip key={value} content={t(label)}>
                  <SegmentGroup.Item value={value} aria-label={t(label)}>
                    <SegmentGroup.ItemText>
                      <Icon as={glyph} boxSize="3.5" />
                    </SegmentGroup.ItemText>
                    <SegmentGroup.ItemHiddenInput />
                  </SegmentGroup.Item>
                </Tooltip>
              ))}
            </SegmentGroup.Root>
          )}
          {history && (
            <HStack gap="0.5">
              <Tooltip content={`${t('undo')} (Ctrl+Z)`} wrap>
                <IconButton
                  aria-label={t('undo')}
                  size="xs"
                  variant="ghost"
                  disabled={!history.canUndo}
                  onClick={history.undo}
                >
                  <LuUndo2 />
                </IconButton>
              </Tooltip>
              <Tooltip content={`${t('redo')} (Ctrl+Shift+Z)`} wrap>
                <IconButton
                  aria-label={t('redo')}
                  size="xs"
                  variant="ghost"
                  disabled={!history.canRedo}
                  onClick={history.redo}
                >
                  <LuRedo2 />
                </IconButton>
              </Tooltip>
            </HStack>
          )}
          <Tooltip
            content={previewColorMode === 'dark' ? t('previewLight') : t('previewDark')}
            wrap
          >
            <IconButton
              aria-label={previewColorMode === 'dark' ? t('previewLight') : t('previewDark')}
              size="xs"
              variant="ghost"
              onClick={() => setPreviewMode(previewColorMode === 'dark' ? 'light' : 'dark')}
            >
              <Icon as={previewColorMode === 'dark' ? LuSun : LuMoon} />
            </IconButton>
          </Tooltip>
          <Tooltip content={t('commandButton')} wrap>
            <IconButton
              aria-label={t('commandButton')}
              size="xs"
              variant="ghost"
              onClick={() => setAddDialog({ mode: 'all' })}
            >
              <LuSearch />
            </IconButton>
          </Tooltip>
          <Text fontSize="xs" color="fg.muted" hideBelow="xl">
            {previewNote ? `${previewNote} ` : ''}
            {t('inlineHint')}
          </Text>
        </HStack>
        {toolbar}
      </Flex>
    ),
    [device, history, previewNote, toolbar, t, previewColorMode, template, compact],
  )

  const previewFrame = (
    <PreviewFrame
      device={device}
      mode={previewColorMode}
      fontHref={googleFontsHref(settings)}
      onDocument={setPreviewDoc}
    >
      {preview}
    </PreviewFrame>
  )

  /** A column of the editor: bordered, scrolling on its own. */
  const scrollPanel = (children: ReactNode) => (
    <ScrollArea.Root
      size="xs"
      h={{ lg: 'full' }}
      minH="0"
      minW="0"
      borderWidth="1px"
      borderColor="border.subtle"
      rounded="lg"
      bg="bg.panel"
    >
      <ScrollArea.Viewport>
        {/* Zag gives the content an inline `min-width: fit-content`, which
            lets one long line — a help text, a long caption typed into an
            input — push the whole panel wider than its column and clip the
            controls. The panel only ever scrolls vertically. */}
        <ScrollArea.Content px="4" pb="4" style={{ minWidth: 0 }}>
          {children}
        </ScrollArea.Content>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar />
    </ScrollArea.Root>
  )

  // The host panel fills the same frame the section list gets, but without
  // the scroll area: a chat pins its composer and scrolls its own messages.
  const overrideBox = panelOverride ? (
    <Box
      h={{ lg: 'full' }}
      minH="0"
      minW="0"
      borderWidth="1px"
      borderColor="border.subtle"
      rounded="lg"
      bg="bg.panel"
      overflow="hidden"
    >
      {panelOverride}
    </Box>
  ) : null

  const panelBody =
    overrideBox ??
    scrollPanel(
      <PanelSlide view={panelView.view} depth={panelView.depth}>
        {panel}
      </PanelSlide>,
    )

  // The panel's link controls can point at any section on the page being
  // edited, so the list is offered to them here rather than through the host's
  // services (which know the catalogue, not the layout). The section being
  // edited is named too, so no section can be offered a link to itself.
  const withProviders = (children: ReactNode) => (
    <SectionLinkProvider sections={sections} currentSectionId={selected?.id ?? null}>
      <BlockEditorProvider
        fields={schema?.fields ?? []}
        values={resolvedSelected?.settings ?? {}}
        onChange={(values) => {
          if (!selected || selected.linkedTo) return
          void run({ type: 'set-section-settings', id: selected.id, values, reseed: false })
        }}
        editable={Boolean(selected && !selected.linkedTo)}
        custom={schema?.type === 'blocks'}
        selectedId={selectedBlockId}
        onSelect={onSelectBlockInPanel}
      >
        {children}
      </BlockEditorProvider>
    </SectionLinkProvider>
  )
  const panelBox = withProviders(panelBody)

  // The add search floats over the preview, where the seller is looking — so
  // it lives beside the panel, not inside it. On a narrow screen the panel is
  // a closed sheet most of the time, and a palette mounted only in the sheet
  // never opens until the sheet does (the Tambah button's own bug).
  const palette = (
    <CommandPalette
      open={addDialog !== null}
      onClose={closeAddDialog}
      addOnly={addDialog?.mode === 'insert' || addDialog?.mode === 'blocks'}
      blocksOnly={addDialog?.mode === 'blocks'}
      sections={sections}
      scope={scope}
      counts={commandCounts}
      onOpenSection={(id) => select(id)}
      onAddSection={addSectionFromCommand}
      onAddBlocks={addBlocksFromCommand}
    />
  )

  // The preview with its bar above it, as it sits beside the panels.
  const canvas = (
    <Flex direction="column" gap="3" minH="0" minW="0" flex="1">
      {previewBar}
      <Box
        flex="1"
        minH="0"
        rounded="lg"
        borderWidth="1px"
        borderColor="border.subtle"
        overflow="hidden"
        position="relative"
      >
        {previewFrame}
        <DropOverlay
          doc={previewDoc}
          active={Boolean(paletteDrag.item)}
          blocks={paletteDrag.item?.kind === 'blocks'}
          sections={sections}
          onDrop={onPaletteDrop}
        />
      </Box>
    </Flex>
  )

  if (!compact) {
    // Side by side, with the line between them draggable (see `usePanelSplitter`).
    return (
      // The height is on a box around the splitter: zag writes `height: 100%`
      // inline on its root, which beats a style prop there.
      <Box h={height} minH="0">
        <Splitter.RootProvider ref={splitterRoot} value={splitter}>
          <Splitter.Panel id="panel" pe="2" minW="0">
            {panelBox}
          </Splitter.Panel>
          <Splitter.ResizeTrigger
            id="panel:preview"
            // Here, not on the root: a palette cascades, and on the root it
            // turned every button and tab in the panel brand-coloured.
            colorPalette="brand"
            aria-label={t('resizePanel')}
            title={t('resizePanel')}
            onDoubleClick={resetPanel}
          >
            <Splitter.ResizeTriggerSeparator />
            <Splitter.ResizeTriggerIndicator />
          </Splitter.ResizeTrigger>
          <Splitter.Panel id="preview" ps="2" minW="0" display="flex">
            {canvas}
          </Splitter.Panel>
        </Splitter.RootProvider>
        {palette}
      </Box>
    )
  }

  // A phone: the preview is the page, and everything else is a tap away on
  // the bar under it — the sections, adding one, the theme, and the open
  // selection's settings. Those open in a sheet over the lower part of the
  // preview, so an edit and its effect are on screen together.
  const selectionName =
    selectedBlock && schema
      ? selectedBlock.block.name?.trim() || l(selectedBlock.schema.name)
      : selected && schema
        ? sectionDisplayName(selected, sections, l(schema.name))
        : layoutPart
          ? l(LAYOUT_PART_NAMES[layoutPart])
          : null
  const openSheet = (view: 'sections' | 'theme' | 'selection') => {
    if (view !== 'selection') {
      clearSelection()
      setTab(view)
    }
    if (!sheetOpen) sheet.reset()
    setSheetOpen(true)
  }
  const bottomBar = (
    <HStack
      gap="1"
      justify="space-around"
      px="2"
      pt="1.5"
      pb="calc(0.375rem + env(safe-area-inset-bottom))"
      borderTopWidth="1px"
      borderColor="border.subtle"
      bg="bg.panel"
      w="full"
    >
      {(
        [
          ['sections', LuLayers, t('sections'), () => openSheet('sections')],
          [
            'add',
            LuPlus,
            t('mobileAdd'),
            () => {
              const after = selected ? sections.findIndex((other) => other.id === selected.id) : -1
              setAddDialog({
                mode: 'insert',
                insertAt: after >= 0 ? after + 1 : sections.length,
              })
            },
          ],
          ...(onSettingsChange
            ? ([['theme', LuPalette, t('theme'), () => openSheet('theme')]] as const)
            : []),
          ['edit', LuPencil, selectionName ?? t('mobileEdit'), () => openSheet('selection')],
        ] as const
      ).map(([key, glyph, label, onClick]) => {
        const disabled = key === 'edit' && !selectionName
        const prominent = key === 'add'
        return (
          <Button
            key={key}
            variant="ghost"
            size="xs"
            h="auto"
            py="1"
            px="1"
            flex="1"
            minW="0"
            flexDirection="column"
            gap="0.5"
            fontWeight="medium"
            disabled={disabled}
            color={prominent ? 'brand.fg' : key === 'edit' && selectionName ? 'fg' : 'fg.muted'}
            onClick={onClick}
          >
            <Box
              boxSize="8"
              rounded="full"
              display="flex"
              alignItems="center"
              justifyContent="center"
              bg={prominent ? 'brand.solid' : undefined}
              color={prominent ? 'brand.contrast' : undefined}
            >
              <Icon as={glyph} boxSize="4.5" />
            </Box>
            <Text as="span" fontSize="2xs" truncate maxW="full">
              {label}
            </Text>
          </Button>
        )
      })}
    </HStack>
  )

  return (
    <Flex direction="column" h={height} minH="0" gap="2">
      {previewBar}
      {/* Only one preview is ever mounted: the frame is a portal into its own
          iframe, and a second one would fight the first over `previewDoc`. */}
      <Box
        flex="1"
        minH="0"
        rounded="lg"
        borderWidth="1px"
        borderColor="border.subtle"
        overflow="hidden"
        position="relative"
      >
        {previewFrame}
      </Box>

      {/* In the dialog's footer strip when there is one, so it sits at the
          very bottom of the screen; under the preview otherwise. */}
      {footerSlot ? createPortal(bottomBar, footerSlot) : bottomBar}

      {/* Beside the sheet, not in it: the sheet unmounts while closed, and
          the palette must open from the Tambah button with it closed. */}
      {palette}

      <Drawer.Root
        open={sheetOpen}
        placement="bottom"
        // Not modal: the preview above the sheet stays live and tappable, so
        // picking another section there swaps what the sheet shows.
        modal={false}
        closeOnInteractOutside={false}
        onOpenChange={({ open }) => {
          setSheetOpen(open)
          if (!open) sheet.reset()
        }}
      >
        <Portal>
          <Drawer.Positioner pointerEvents="none">
            <Drawer.Content
              pointerEvents="auto"
              roundedTop={sheet.stop === 'full' && !sheet.dragging ? 'lg' : 'xl'}
              maxH="none"
              shadow="0 -8px 24px rgba(0,0,0,0.12)"
              style={{
                height: sheet.height,
                // The finger leads while dragging; letting go eases to the stop.
                transition: sheet.dragging ? 'none' : 'height 240ms cubic-bezier(0.2, 0.8, 0.2, 1)',
              }}
            >
              {/* The handle row: drag it, tap it, or use its keys. Not the
                  sheet's body, which scrolls its own settings. */}
              <HStack
                px="3"
                pt="2"
                pb="1"
                minH="10"
                position="relative"
                justify="flex-end"
                flexShrink="0"
                cursor={sheet.dragging ? 'grabbing' : 'grab'}
                touchAction="none"
                userSelect="none"
                role="button"
                tabIndex={0}
                aria-label={sheet.stop === 'full' ? t('sheetShrink') : t('sheetExpand')}
                aria-expanded={sheet.stop === 'full'}
                {...sheet.handleProps}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    sheet.setStop(sheet.stop === 'full' ? 'half' : 'full')
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    sheet.setStop('full')
                  } else if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    if (sheet.stop === 'full') sheet.setStop('half')
                    else closeSheet()
                  }
                }}
                _focusVisible={{ outline: '2px solid', outlineColor: 'brand.focusRing' }}
              >
                <Box
                  position="absolute"
                  left="50%"
                  top="2.5"
                  transform="translateX(-50%)"
                  h="1.5"
                  w="12"
                  rounded="full"
                  bg={sheet.dragging ? 'fg.muted' : 'border.emphasized'}
                  transition="background 120ms"
                  pointerEvents="none"
                />
                <Drawer.CloseTrigger asChild position="static">
                  <CloseButton size="sm" aria-label={t('closeSheet')} />
                </Drawer.CloseTrigger>
              </HStack>
              <Drawer.Body
                px="0"
                pt="0"
                pb="4"
                flex="1"
                minH="0"
                overflowY="auto"
                overscrollBehavior="contain"
              >
                {panelBox}
              </Drawer.Body>
            </Drawer.Content>
          </Drawer.Positioner>
        </Portal>
      </Drawer.Root>
    </Flex>
  )
}

/** Where the seller's panel width is kept: this browser only, a matter of taste. */
const PANEL_WIDTH_KEY = 'pesanle:page-builder:panel-width'

/** One step of the panel's trail back to the section list. */
interface Crumb {
  label: string
  onClick: () => void
}

/**
 * The open screen's parents, each a link: "All sections › Product list ›
 * Card". It replaces a single back button, which could only ever go up one
 * level and never said where it went.
 */
function PanelTrail({ crumbs }: { crumbs: readonly Crumb[] }) {
  return (
    <Flex as="nav" align="center" gap="0.5" wrap="wrap" ml="-2" minW="0">
      {crumbs.map((crumb, index) => (
        <HStack key={`${index}:${crumb.label}`} gap="0.5" minW="0">
          {index > 0 && <Icon as={LuChevronRight} boxSize="3" color="fg.subtle" flexShrink="0" />}
          <Button
            size="xs"
            variant="ghost"
            px="2"
            minW="0"
            maxW="44"
            color={index === crumbs.length - 1 ? 'fg' : 'fg.muted'}
            onClick={crumb.onClick}
          >
            {index === 0 && <Icon as={LuChevronLeft} />}
            <Text as="span" truncate>
              {crumb.label}
            </Text>
          </Button>
        </HStack>
      ))}
    </Flex>
  )
}

/**
 * The line between the panel and the preview, draggable (Chakra's `Splitter`).
 *
 * The panel keeps its width in pixels when the window changes, and is held
 * between 18rem — what its controls need — and 40rem; the preview never gets
 * less than half the editor, so it stays a preview. The width a seller drags
 * to is remembered in this browser; a double-click puts back the default.
 */
function usePanelSplitter() {
  const fallback = useBreakpointValue({ base: '20rem', '2xl': '24rem' }, { ssr: false }) ?? '20rem'

  const rootRef = useRef<HTMLDivElement | null>(null)
  // The root mounts only while the side-by-side layout is on screen, so the
  // stored width is applied when it appears rather than on the first render.
  const [rootElement, setRootElement] = useState<HTMLDivElement | null>(null)
  const root = useCallback((element: HTMLDivElement | null) => {
    rootRef.current = element
    setRootElement(element)
  }, [])
  // A reset resizes too; that resize is the default, not a width to remember.
  const resetting = useRef(false)
  const splitter = useSplitter({
    panels: [
      { id: 'panel', minSize: '18rem', maxSize: '40rem', resizeBehavior: 'preserve-pixel-size' },
      { id: 'preview', minSize: '50%' },
    ],
    // Initial only: the persisted width is applied once the root is on screen
    // (see below), since storage cannot be read on the first render. One entry
    // is enough — the preview takes the remainder. A css length (`rem`/`px`)
    // is a valid `PanelSize`; `onResizeEnd` reports `%`, converted back to px
    // for storage.
    defaultSize: [fallback],
    onResizeEnd: ({ size }) => {
      if (resetting.current) {
        resetting.current = false
        return
      }
      const width = rootRef.current?.getBoundingClientRect().width
      const share = size[0]
      if (!width || share == null) return
      try {
        globalThis.localStorage?.setItem(PANEL_WIDTH_KEY, String(Math.round((share / 100) * width)))
      } catch {
        // As above: the width just is not remembered.
      }
    },
  })

  // The persisted width cannot drive `defaultSize`: storage is read after
  // mount, and zag only takes `defaultSize` on init. Apply it via `setSizes`
  // in a frame, so the splitter root has a width — `px` resolves against it,
  // and a 0-width root would drop the size. Re-saving the same value in
  // `onResizeEnd` is harmless.
  useEffect(() => {
    if (!rootElement) return
    let stored: number | null = null
    try {
      const value = Number(globalThis.localStorage?.getItem(PANEL_WIDTH_KEY))
      if (Number.isFinite(value) && value > 0) stored = value
    } catch {
      // Storage refused (a private window, blocked site data): the default it is.
    }
    if (stored == null) return
    const size = `${stored}px`
    const frame = requestAnimationFrame(() => splitter.setSizes([size]))
    return () => cancelAnimationFrame(frame)
    // `splitter` is a new object every render; the element is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootElement])

  const reset = useCallback(() => {
    try {
      globalThis.localStorage?.removeItem(PANEL_WIDTH_KEY)
    } catch {
      // Nothing was stored to clear.
    }
    resetting.current = true
    // Same units as `defaultSize`: a css length is valid here, and the preview
    // again takes the remainder.
    splitter.setSizes([fallback])
    // A programmatic set fires `onResizeEnd` (swallowed above) — unless the
    // size is already the default, in which case nothing fires. Clear anyway
    // so the next drag is still remembered.
    queueMicrotask(() => {
      resetting.current = false
    })
  }, [splitter, fallback])

  return { splitter, root, reset }
}
