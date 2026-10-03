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
  Dialog,
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
  LuCopy,
  LuEye,
  LuMonitor,
  LuRedo2,
  LuShoppingBag,
  LuSmartphone,
  LuTablet,
  LuTrash2,
  LuUser,
  LuSearch,
  LuUndo2,
} from 'react-icons/lu'

import { Tooltip } from '@repo/theme'

import {
  duplicateBlock,
  findBlock,
  insertBlock,
  moveBlock,
  removeBlock,
  updateBlockSettings,
  updateBlockStyle,
  updateBlocksIn,
} from '../model/blocks'
import {
  createSection,
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
import { readBlocks, type FieldValues } from '../model/fields'
import {
  FOOTER_FIELDS,
  HEADER_FIELDS,
  LAYOUT_PART_DESCRIPTIONS,
  LAYOUT_PART_NAMES,
  type ThemeLayout,
} from '../model/layout'
import type { MenuItem } from '../model/menus'
import { SECTION_STYLE_FIELDS, VISIBILITY_STYLE_KEYS } from '../model/section-style'
import { sectionSchema, type SectionScope } from '../model/sections'
import { googleFontsHref, type ThemeSettings } from '../model/settings'
import { isHeaderTransparent, StoreFooter, StoreHeader } from '../render/chrome'
import {
  RenderProvider,
  type RenderEnvironment,
  type StorefrontRenderData,
} from '../render/context'
import { PAGE_WIDTH_CONTAINER } from '../render/primitives'
import { drawnSections, pageEdges, SectionsRenderer, ThemeScope } from '../render/renderer'
import { PaletteDragProvider, usePaletteDrag } from './add-palette'
import { useBuilderDialogFooter } from './builder-dialog'
import { BlockStylePanel } from './block-style-panel'
import { CatalogueProvider } from './catalogue'
import { DropOverlay, type DropTarget } from './preview-drop'
import { FieldsForm, SelectInput } from './controls'
import { useHistoryKeys, type EditorHistory } from './history'
import { useEditorText } from './messages'
import { PreviewFrame, type PreviewDevice } from './preview-frame'
import { PinnedRow, SectionList } from './section-list'
import { SectionToolbar } from './section-toolbar'
import type { EditorServices } from './services'
import { ThemeSettingsPanel } from './theme-settings'

const STYLE_FIELDS = SECTION_STYLE_FIELDS.filter(
  (field) => !(VISIBILITY_STYLE_KEYS as readonly string[]).includes(field.key),
)
const VISIBILITY_FIELDS = SECTION_STYLE_FIELDS.filter((field) =>
  (VISIBILITY_STYLE_KEYS as readonly string[]).includes(field.key),
)

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

const HEADER_ID = 'layout:header'
/** The frame's details (`frame.details`), picked like a section. */
const DETAILS_ID = 'frame:details'
const FOOTER_ID = 'layout:footer'

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
   * The section the canvas has picked, or null when nothing is. Lets a host
   * panel outside the builder follow the selection — the AI designer uses it
   * to aim a revision at one section.
   */
  onSelectionChange?: (id: string | null) => void
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
} as const satisfies Record<TemplateKey, string>

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
  const { t, l } = useEditorText()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // The block the canvas has selected inside the chosen section, if any. The
  // panel follows it; clicking the section again clears it.
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  // The button (or text element) the canvas has selected, keyed in the
  // section's `elements` map, and whether its panel is the button's or the
  // text's. A block selection wins when both are set.
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
  const [selectedElementKind, setSelectedElementKind] = useState<ElementKind>('button')
  const [tab, setTab] = useState<'sections' | 'theme'>(startWithLooks ? 'theme' : 'sections')
  const [sectionTab, setSectionTab] = useState<'content' | 'style' | 'visibility'>('content')
  const [device, setDevice] = useState<PreviewDevice>('desktop')
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // Below `lg` the panel takes the whole width, and the preview opens as a
  // full-screen sheet from a button pinned to the bottom instead.
  const compact = useBreakpointValue({ base: true, lg: false }, { ssr: false }) ?? false
  const { splitter, root: splitterRoot, reset: resetPanel } = usePanelSplitter()
  const [previewOpen, setPreviewOpen] = useState(false)
  const footerSlot = useBuilderDialogFooter()

  const editableLayout = Boolean(layout && onLayoutChange)
  const selected = sections.find((section) => section.id === selectedId) ?? null
  const schema = selected ? sectionSchema(selected.type) : null
  const selectedBlock =
    selected && schema && selectedBlockId
      ? findBlock(schema.fields, selected.settings, selectedBlockId)
      : null

  useHistoryKeys(
    history,
    useMemo(() => [globalThis.document ?? null, previewDoc], [previewDoc]),
  )

  // A host panel outside the builder follows what the canvas has picked.
  useEffect(() => {
    onSelectionChange?.(selectedId)
  }, [onSelectionChange, selectedId])

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
  useEffect(() => setSelectedId(null), [template?.value])

  // Opened from outside the builder. A count, so the same request twice opens
  // twice; the first render's value is where it starts, not a request.
  const openRequest = frame?.details?.openRequest ?? 0
  const lastOpenRequest = useRef(openRequest)
  useEffect(() => {
    if (openRequest === lastOpenRequest.current) return
    lastOpenRequest.current = openRequest
    setSelectedId(DETAILS_ID)
    setTab('sections')
  }, [openRequest])

  const updateSection = useCallback(
    (id: string, change: (section: SectionInstance) => SectionInstance) =>
      onSectionsChange(sections.map((section) => (section.id === id ? change(section) : section))),
    [sections, onSectionsChange],
  )

  // What the preview draws: a deferred copy, drawn after the input updates.
  const previewSections = useDeferredValue(sections)

  // Text typed into the preview edits the latest sections, read through refs
  // so the environment below does not change with every keystroke.
  const latest = useRef({ sections, onSectionsChange })
  latest.current = { sections, onSectionsChange }
  const onEditText = useCallback((sectionId: string, key: string, value: string) => {
    const { sections: current, onSectionsChange: change } = latest.current
    change(
      current.map((section) =>
        section.id === sectionId
          ? { ...section, settings: { ...section.settings, [key]: value } }
          : section,
      ),
    )
  }, [])

  // What the add palette is dragging, read through a ref so the drop handler
  // never closes over a stale item.
  const paletteDrag = usePaletteDrag()
  const dragRef = useRef(paletteDrag)
  dragRef.current = paletteDrag

  /**
   * A palette item dropped on the preview: a section lands between sections,
   * blocks land in the container the pointer named — or in a new Custom
   * section when dropped between sections instead.
   */
  const onPaletteDrop = useCallback((target: DropTarget) => {
    const { item, end } = dragRef.current
    end()
    if (!item) return
    const { sections: current, onSectionsChange: change } = latest.current
    const at = (index: number) => Math.max(0, Math.min(current.length, index))

    // Dropped, not selected: the detail panel opens when the seller clicks
    // the section or block, so the palette stays open for the next item.
    if (item.kind === 'section') {
      const section = createSection(item.type, item.preset?.settings, item.preset?.style)
      const next = [...current]
      next.splice(at(target.kind === 'sections' ? target.index : current.length), 0, section)
      change(next)
      return
    }

    const donor = createSection('custom', { blocks: item.blocks as never })
    const created = readBlocks(donor.settings, 'blocks')

    if (target.kind === 'blocks') {
      const host = current.find((section) => section.id === target.sectionId)
      const shape = host ? sectionSchema(host.type) : null
      if (host && shape && created.length > 0) {
        let values = host.settings
        let index = target.index
        for (const block of created) {
          const inserted = insertBlock(
            shape.fields,
            values,
            { parentId: target.parentId, fieldKey: target.fieldKey },
            index,
            block,
          )
          if (!inserted) break
          values = inserted
          index += 1
        }
        change(
          current.map((section) =>
            section.id === host.id ? { ...section, settings: values } : section,
          ),
        )
        return
      }
    }

    const next = [...current]
    next.splice(at(target.kind === 'sections' ? target.index : current.length), 0, donor)
    change(next)
  }, [])

  // A text typed into a block, however deep the block sits in the tree.
  const onEditBlockText = useCallback(
    (sectionId: string, blockId: string, key: string, value: string) => {
      const { sections: current, onSectionsChange: change } = latest.current
      change(
        current.map((section) => {
          if (section.id !== sectionId) return section
          const shape = sectionSchema(section.type)
          if (!shape) return section
          const settings = updateBlocksIn(
            shape.fields,
            section.settings,
            blockId,
            (blocks, index) =>
              blocks.map((block, at) =>
                at === index ? { ...block, settings: { ...block.settings, [key]: value } } : block,
              ),
          )
          return settings ? { ...section, settings } : section
        }),
      )
    },
    [],
  )

  // A block clicked on the canvas: highlight it and open its panel.
  const onSelectBlock = useCallback((sectionId: string, blockId: string) => {
    setSelectedId(sectionId)
    setSelectedBlockId(blockId)
    setSelectedElementId(null)
    setTab('sections')
  }, [])

  // A button or text element clicked on the canvas: same, through the
  // section's element map. The kind decides which panel opens.
  const onSelectElement = useCallback(
    (sectionId: string, elementId: string, kind: ElementKind = 'button') => {
      setSelectedId(sectionId)
      setSelectedElementId(elementId)
      setSelectedElementKind(kind)
      setSelectedBlockId(null)
      setTab('sections')
    },
    [],
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

  const select = useCallback(
    (id: string, fromPreview = false) => {
      setSelectedId(id)
      // Choosing a section drops any block or element of the previous one. A
      // block or button click runs after the section's own selection, so its
      // id lands here next.
      setSelectedBlockId(null)
      setSelectedElementId(null)
      setTab('sections')
      // Picked from the list: bring it into view in the preview, below the header.
      if (!fromPreview && previewDoc) revealSection(previewDoc, id, 'start')
    },
    [previewDoc],
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

  const back = (
    <Button size="xs" variant="ghost" alignSelf="start" ml="-2" onClick={() => setSelectedId(null)}>
      <Icon as={LuChevronLeft} />
      {t('back')}
    </Button>
  )

  const layoutPart =
    selectedId === HEADER_ID ? 'header' : selectedId === FOOTER_ID ? 'footer' : null

  // Actions on the canvas-selected block. Each rewrites the section's own
  // settings, so a click on a stale panel can never clobber a newer edit.
  const blockActions =
    selectedBlock && selected && schema
      ? {
          up: () =>
            updateSection(selected.id, (section) => {
              const next = moveBlock(schema.fields, section.settings, selectedBlock.block.id, -1)
              return next ? { ...section, settings: next } : section
            }),
          down: () =>
            updateSection(selected.id, (section) => {
              const next = moveBlock(schema.fields, section.settings, selectedBlock.block.id, 1)
              return next ? { ...section, settings: next } : section
            }),
          duplicate: () => {
            const result = duplicateBlock(schema.fields, selected.settings, selectedBlock.block.id)
            if (!result) return
            updateSection(selected.id, (section) => ({ ...section, settings: result.values }))
            setSelectedBlockId(result.copy.id)
          },
          remove: () => {
            updateSection(selected.id, (section) => {
              const next = removeBlock(schema.fields, section.settings, selectedBlock.block.id)
              return next ? { ...section, settings: next } : section
            })
            setSelectedBlockId(null)
          },
        }
      : null

  const details = frame?.details
  const panel =
    selectedId === DETAILS_ID && details ? (
      <Stack gap="4">
        {back}
        <Stack gap="1">
          <Text fontWeight="semibold">{details.label}</Text>
          {details.description && (
            <Text fontSize="xs" color="fg.muted">
              {details.description}
            </Text>
          )}
        </Stack>
        {details.content}
      </Stack>
    ) : layoutPart && layout && onLayoutChange ? (
      <Stack gap="4">
        {back}
        <Stack gap="1">
          <Text fontWeight="semibold">{l(LAYOUT_PART_NAMES[layoutPart])}</Text>
          <Text fontSize="xs" color="fg.muted">
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
        <Button
          size="xs"
          variant="ghost"
          alignSelf="start"
          ml="-2"
          onClick={() => setSelectedBlockId(null)}
        >
          <Icon as={LuChevronLeft} />
          {t('back')}
        </Button>
        <Stack gap="1">
          <Text fontWeight="semibold">{l(selectedBlock.schema.name)}</Text>
          {selectedBlock.schema.description && (
            <Text fontSize="xs" color="fg.muted">
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
        </HStack>
        <FieldsForm
          fields={selectedBlock.schema.fields}
          values={selectedBlock.block.settings}
          services={services}
          onChange={(values) => {
            updateSection(selected.id, (section) => {
              const settings = updateBlockSettings(
                schema.fields,
                section.settings,
                selectedBlock.block.id,
                values,
              )
              return settings ? { ...section, settings } : section
            })
          }}
        />
        {selectedBlock.field.styleFields && (
          <BlockStylePanel
            fields={selectedBlock.field.styleFields}
            values={selectedBlock.block.style ?? {}}
            services={services}
            onChange={(style) =>
              updateSection(selected.id, (section) => {
                const settings = updateBlockStyle(
                  schema.fields,
                  section.settings,
                  selectedBlock.block.id,
                  style,
                )
                return settings ? { ...section, settings } : section
              })
            }
          />
        )}
      </Stack>
    ) : selected && selectedElementId ? (
      <Stack gap="4">
        <Button
          size="xs"
          variant="ghost"
          alignSelf="start"
          ml="-2"
          onClick={() => setSelectedElementId(null)}
        >
          <Icon as={LuChevronLeft} />
          {t('back')}
        </Button>
        <Stack gap="1">
          <Text fontWeight="semibold">
            {selectedElementKind === 'text' ? t('textElement') : t('buttonElement')}
          </Text>
          <Text fontSize="xs" color="fg.muted">
            {selectedElementKind === 'text' ? t('textElementHelp') : t('buttonElementHelp')}
          </Text>
        </Stack>
        <FieldsForm
          fields={selectedElementKind === 'text' ? TEXT_ELEMENT_FIELDS : BUTTON_ELEMENT_FIELDS}
          values={
            selected.elements?.[selectedElementId] ??
            (selectedElementKind === 'text'
              ? { ...TEXT_ELEMENT_DEFAULTS }
              : { ...BUTTON_ELEMENT_DEFAULTS })
          }
          services={services}
          onChange={(values) =>
            updateSection(selected.id, (section) => ({
              ...section,
              elements: { ...(section.elements ?? {}), [selectedElementId]: values },
            }))
          }
        />
        <Button
          size="xs"
          variant="outline"
          alignSelf="start"
          onClick={() =>
            updateSection(selected.id, (section) => {
              const current = section.elements
              if (!current?.[selectedElementId]) return section
              const remaining = { ...current }
              delete remaining[selectedElementId]
              if (Object.keys(remaining).length === 0) {
                const { elements: _cleared, ...rest } = section
                return rest
              }
              return { ...section, elements: remaining }
            })
          }
        >
          {t('resetToTheme')}
        </Button>
      </Stack>
    ) : selected && schema ? (
      <Stack gap="4">
        {back}
        <Stack gap="1">
          <Text fontWeight="semibold">{l(schema.name)}</Text>
          <Text fontSize="xs" color="fg.muted">
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
                  onChange={(values) =>
                    updateSection(selected.id, (section) => ({ ...section, settings: values }))
                  }
                />
              )}
            </Stack>
          </Tabs.Content>
          <Tabs.Content value="style" p="0">
            <Stack gap="4">
              <FieldsForm
                fields={STYLE_FIELDS}
                values={selected.style}
                services={services}
                onChange={(style) =>
                  updateSection(selected.id, (section) => ({ ...section, style }))
                }
              />
            </Stack>
          </Tabs.Content>
          <Tabs.Content value="visibility" p="0">
            <Stack gap="4">
              <FieldsForm
                fields={VISIBILITY_FIELDS}
                values={selected.style}
                services={services}
                onChange={(style) =>
                  updateSection(selected.id, (section) => ({ ...section, style }))
                }
              />
            </Stack>
          </Tabs.Content>
        </Tabs.Root>
      </Stack>
    ) : (
      <Stack gap="4">
        {template && (
          <HStack gap="2">
            <Text fontSize="xs" color="fg.muted" flexShrink="0">
              {t('editingTemplate')}
            </Text>
            <SelectInput
              value={template.value}
              onChange={(value) => value && template.onChange(value as TemplateKey)}
              options={TEMPLATE_KEYS.map((key) => ({
                value: key,
                label: t(TEMPLATE_LABELS[key]),
              }))}
            />
          </HStack>
        )}
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
              <Tabs.Trigger value="sections">{t('sections')}</Tabs.Trigger>
              <Tabs.Trigger value="theme">{t('theme')}</Tabs.Trigger>
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
              />
            </Tabs.Content>
          </Tabs.Root>
        ) : (
          list()
        )}
      </Stack>
    )

  function list() {
    return (
      <SectionList
        sections={sections}
        onChange={onSectionsChange}
        selectedId={selectedId}
        onSelect={(id) => select(id)}
        scope={scope}
        onNotice={setNotice}
        before={
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
  const clickAway = useCallback((event: { target: EventTarget | null }) => {
    const target = event.target as HTMLElement | null
    if (typeof target?.closest !== 'function' || target.closest('[data-section-id]')) return
    setSelectedId(null)
    setSelectedBlockId(null)
    setSelectedElementId(null)
  }, [])

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
        actions={
          <>
            {standIn(LuShoppingBag, t('standInCart'))}
            {standIn(LuUser, t('standInAccount'))}
          </>
        }
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
              pages={footerPages}
              labels={{
                information: t('footerInformation'),
                followUs: t('footerFollowUs'),
                links: t('footerLinks'),
              }}
              bottom={t('poweredBy')}
              flush={edges.flushBottom}
            />,
          )
        : null,
    [layout, shop, menus.footer, footerPages, edges.flushBottom, pickable, t],
  )

  const edited = useMemo(
    () => (
      <SectionsRenderer
        sections={previewSections}
        env={env}
        selectedId={selectedId}
        onSelect={(id) => select(id, true)}
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
            onRemoved={() => setSelectedId(null)}
          />
        )}
      />
    ),
    [previewSections, env, selectedId, select, revealSoon, onSectionsChange],
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
        </ThemeScope>
      </RenderProvider>
    ),
    [env, settings, clickAway, header, edges.flushTop, edges.flushBottom, framed, edited, footer],
  )

  // The device switch, undo and redo, and the screen's own buttons: above the
  // preview beside the panel, or in the preview sheet on a narrow screen.
  // Its tooltips and segment group are not cheap; nothing in it changes as a section is typed into.
  const previewBar = useMemo(
    () => (
      <Flex justify="space-between" align="center" gap="3" wrap="wrap">
        <HStack gap="2" wrap="wrap">
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
          <Text fontSize="xs" color="fg.muted" hideBelow="xl">
            {previewNote ? `${previewNote} ` : ''}
            {t('inlineHint')}
          </Text>
        </HStack>
        {toolbar}
      </Flex>
    ),
    [device, history, previewNote, toolbar, t],
  )

  const previewButton = (
    <Button w="full" size="lg" colorPalette="brand" onClick={() => setPreviewOpen(true)}>
      <LuEye />
      {t('showPreview')}
    </Button>
  )

  const previewFrame = (
    <PreviewFrame device={device} fontHref={googleFontsHref(settings)} onDocument={setPreviewDoc}>
      {preview}
    </PreviewFrame>
  )

  const panelBox = panelOverride ? (
    // The host panel fills the same frame the section list gets, but without
    // the scroll area: a chat pins its composer and scrolls its own messages.
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
  ) : (
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
          {panel}
        </ScrollArea.Content>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar />
    </ScrollArea.Root>
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
          </Splitter.Panel>
        </Splitter.RootProvider>
      </Box>
    )
  }

  return (
    <Stack gap="4" minH="0">
      {panelBox}

      {/* In the dialog's footer strip, outside the scroll area, when there is
          one; stuck to the bottom of the scrolling body otherwise. */}
      {footerSlot ? (
        createPortal(previewButton, footerSlot)
      ) : (
        <Box position="sticky" bottom="0" zIndex="1" pt="2" pb="3" mt="-4" bg="bg.panel">
          {previewButton}
        </Box>
      )}

      {/* Only one preview is ever mounted: the frame is a portal into its own
          iframe, and a second one would fight the first over `previewDoc`. */}
      <Dialog.Root
        open={previewOpen}
        size="full"
        motionPreset="slide-in-bottom"
        onOpenChange={({ open }) => setPreviewOpen(open)}
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content rounded="none" display="flex" flexDirection="column" h="100dvh">
              <Dialog.Header px="3" py="2.5" gap="3" borderBottomWidth="1px">
                <Dialog.Title fontSize="md" flex="1">
                  {t('preview')}
                </Dialog.Title>
                <Dialog.CloseTrigger asChild position="static">
                  <CloseButton size="sm" aria-label={t('closePreview')} />
                </Dialog.CloseTrigger>
              </Dialog.Header>
              <Dialog.Body flex="1" minH="0" p="3" display="flex" flexDirection="column" gap="3">
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
                  {previewOpen && previewFrame}
                  {previewOpen && (
                    <DropOverlay
                      doc={previewDoc}
                      active={Boolean(paletteDrag.item)}
                      blocks={paletteDrag.item?.kind === 'blocks'}
                      sections={sections}
                      onDrop={onPaletteDrop}
                    />
                  )}
                </Box>
              </Dialog.Body>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Stack>
  )
}

/** Where the seller's panel width is kept: this browser only, a matter of taste. */
const PANEL_WIDTH_KEY = 'pesanle:page-builder:panel-width'

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

  const root = useRef<HTMLDivElement | null>(null)
  // A reset resizes too; that resize is the default, not a width to remember.
  const resetting = useRef(false)
  const splitter = useSplitter({
    panels: [
      { id: 'panel', minSize: '18rem', maxSize: '40rem', resizeBehavior: 'preserve-pixel-size' },
      { id: 'preview', minSize: '50%' },
    ],
    // Initial only: the persisted width is applied after mount (see below),
    // since storage cannot be read on the first render. One entry is enough —
    // the preview takes the remainder. A css length (`rem`/`px`) is a valid
    // `PanelSize`; `onResizeEnd` reports `%`, converted back to px for storage.
    defaultSize: [fallback],
    onResizeEnd: ({ size }) => {
      if (resetting.current) {
        resetting.current = false
        return
      }
      const width = root.current?.getBoundingClientRect().width
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
  // mount, and zag only takes `defaultSize` on init. Apply it once via
  // `setSizes`, which takes the same `PanelSize` strings. In a frame so the
  // splitter root has a width — `px` resolves against it, and a 0-width root
  // would drop the size. Re-saving the same value in `onResizeEnd` is harmless.
  const applied = useRef(false)
  useEffect(() => {
    if (applied.current) return
    applied.current = true
    let stored: number | null = null
    try {
      const value = Number(globalThis.localStorage?.getItem(PANEL_WIDTH_KEY))
      if (Number.isFinite(value) && value > 0) stored = value
    } catch {
      // Storage refused (a private window, blocked site data): the default it is.
    }
    if (stored == null) return
    const size = `${stored}px`
    requestAnimationFrame(() => splitter.setSizes([size]))
  }, [splitter])

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
