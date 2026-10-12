/**
 * The editor: the page's sections on the left, the live preview in the
 * middle, and the properties of whatever is picked on the right.
 *
 * The left sidebar is the page's outline and never goes away: every section
 * in order (plus a theme's header and footer, and its theme settings), with
 * a way to add more. Picking a row — or clicking a section in the preview —
 * opens its properties in the inspector on the right (see `Inspector`);
 * clicking a block or button inside it opens that instead, and clicking a
 * heading types straight into it.
 *
 * Three layouts, by the room there is:
 * - `split` (xl and up): sidebar, preview and inspector side by side.
 * - `stacked` (lg): one panel beside the preview, showing the list, or the
 *   inspector with a step back to it while something is picked.
 * - `sheet` (below lg): that same panel takes the width, and the preview
 *   opens as a full-screen sheet from a button pinned to the bottom.
 *
 * The preview is an iframe the width of the chosen device (see
 * `PreviewFrame`), so a phone preview is laid out as a phone.
 *
 * With `frame`, the sections being edited are drawn inside a template's
 * sections — an article's body inside the theme's article template — so the
 * seller writes in the frame shoppers will see. The frame is read-only here:
 * it is the theme's, and the theme editor is where it changes.
 *
 * Typing stays light however long the page is. The panels follow every
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
  Stack,
  Text,
  useBreakpointValue,
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
import { LuEye, LuFileText, LuPalette, LuSearch, LuShoppingBag, LuUser } from 'react-icons/lu'

import { insertBlock, updateBlocksIn } from '../model/blocks'
import {
  createSection,
  setBlockOverrides,
  setSectionOverrides,
  TEMPLATE_KEYS,
  type SectionInstance,
  type TemplateKey,
} from '../model/content'
import type { ElementKind } from '../model/element-style'
import { readBlocks } from '../model/fields'
import { LAYOUT_PART_NAMES, type ThemeLayout } from '../model/layout'
import type { MenuItem } from '../model/menus'
import { createStarterSection } from '../model/section-starters'
import { sectionSchema, type SectionScope } from '../model/sections'
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
import { PaletteDragProvider, usePaletteDrag } from './add-palette'
import { useBuilderDialogFooter } from './builder-dialog'
import { CatalogueProvider } from './catalogue'
import { SectionLinkProvider, SelectInput } from './controls'
import { useHistoryKeys, type EditorHistory } from './history'
import { editTargetId, Inspector } from './inspector'
import { useEditorText } from './messages'
import { Panel } from './panel'
import { DropOverlay, type DropTarget } from './preview-drop'
import { PreviewFrame, type PreviewDevice } from './preview-frame'
import { revealSection } from './preview-scroll'
import { PreviewToolbar } from './preview-toolbar'
import { flipElements, orderMoved, type SectionRects } from './reorder-flip'
import { sectionIcon } from './section-icons'
import { SectionList, SidebarRow } from './section-list'
import { SectionToolbar } from './section-toolbar'
import {
  DETAILS_ID,
  FOOTER_ID,
  HEADER_ID,
  isPseudoId,
  NOTHING_SELECTED,
  selectId,
  THEME_ID,
  type Selection,
} from './selection'
import type { EditorServices } from './services'

/** No menus yet: one object, so a default does not look like a change on every render. */
const NO_MENUS: { main: MenuItem[]; footer: MenuItem[] } = { main: [], footer: [] }
const NO_PAGES: Array<{ title: string; slug: string }> = []

/** The side columns' widths: the sidebar is a list, the inspector holds forms. */
const SIDEBAR_WIDTH = { base: '17rem', '2xl': '18rem' }
const INSPECTOR_WIDTH = { base: '20rem', '2xl': '22rem' }
/** The one panel of the `stacked` layout holds forms too. */
const STACKED_WIDTH = '20rem'

type Layout = 'sheet' | 'stacked' | 'split'

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
   * Start on the theme settings — a blank theme just created, or a template
   * just installed. `priorityKeys` are the installed template's suggested
   * looks, shown first when the seller opens the look picker; the picker
   * itself never opens on its own.
   */
  startWithLooks?: { priorityKeys?: readonly string[] }
  /** Rendered at the end of the preview's bar. */
  toolbar?: ReactNode
  /**
   * What the canvas has picked. Lets a host panel outside the builder follow
   * the selection — the AI designer aims a revision at the chosen block, or
   * at the section when no block is. `blockId` is always inside `sectionId`.
   */
  onSelectionChange?: (selection: { sectionId: string | null; blockId: string | null }) => void
  /** Said in the preview's bar in place of the "click a section" hint. */
  previewNote?: string
  /**
   * Takes the inspector's place with the host's own content, e.g. the AI
   * designer's chat. The section list stays beside it, so sections can
   * still be picked for it to aim at; where the list and the inspector share
   * one panel (narrower screens) it takes that panel. The host closes it to
   * hand the inspector back. A host panel owns its own scrolling and height.
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
     * screen's own form) in the inspector.
     */
    details?: FrameDetails
  }
}

export interface FrameDetails {
  /** Frame section types that stand for the details, e.g. `['article-header']`. */
  sectionTypes: readonly string[]
  label: string
  /** Under the label in the inspector. */
  description?: string
  /** Under the label in the list, e.g. the article's title. */
  detail?: string
  /** The form, drawn in the inspector while the details are picked. */
  content: ReactNode
  /**
   * Bumped by the screen to open the details from outside the builder — a
   * header button, a save refused over one of their fields.
   */
  openRequest?: number
}

/**
 * The editor preview's wishlist: an empty, write-less set so product cards
 * draw the heart they draw on the storefront without pretending to save.
 */
const PREVIEW_WISHLIST: NonNullable<RenderEnvironment['wishlist']> = {
  ids: new Set(),
  onToggle: () => undefined,
}

/** The template switcher's label for each template a theme designs. */
const TEMPLATE_LABELS = {
  home: 'templateHome',
  product: 'templateProduct',
  article: 'templateArticle',
  catalog: 'templateCatalog',
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
  const [selection, setSelection] = useState<Selection>(() =>
    startWithLooks && onSettingsChange ? selectId(THEME_ID) : NOTHING_SELECTED,
  )
  const selectedId = selection.id
  const selectedBlockId = selection.blockId
  const selectedElementId = selection.element?.id ?? null
  const [device, setDevice] = useState<PreviewDevice>('desktop')
  // The preview's colour mode. `null` follows the theme's designed mode until
  // the seller flips the toolbar switch; the live site's own switch is the
  // shopper's, so this only ever paints the preview.
  const [previewMode, setPreviewMode] = useState<'light' | 'dark' | null>(null)
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null)
  const designedMode: 'light' | 'dark' = themeDesignedForDark(settings) ? 'dark' : 'light'
  const previewColorMode = previewMode ?? designedMode
  const [notice, setNotice] = useState<string | null>(null)
  const shape: Layout =
    useBreakpointValue<Layout>({ base: 'sheet', lg: 'stacked', xl: 'split' }, { ssr: false }) ??
    'sheet'
  const compact = shape === 'sheet'
  const [previewOpen, setPreviewOpen] = useState(false)
  const footerSlot = useBuilderDialogFooter()

  const editableLayout = Boolean(layout && onLayoutChange)

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
  // The theme settings are the same in every template, so they stay open.
  useEffect(
    () => setSelection((current) => (current.id === THEME_ID ? current : NOTHING_SELECTED)),
    [template?.value],
  )

  // A picked section that is gone — removed from the list or the preview,
  // undone away — leaves nothing picked rather than an inspector for nothing.
  useEffect(() => {
    if (!selectedId || isPseudoId(selectedId)) return
    if (!sections.some((section) => section.id === selectedId)) setSelection(NOTHING_SELECTED)
  }, [sections, selectedId])

  // Opened from outside the builder. A count, so the same request twice opens
  // twice; the first render's value is where it starts, not a request.
  const openRequest = frame?.details?.openRequest ?? 0
  const lastOpenRequest = useRef(openRequest)
  useEffect(() => {
    if (openRequest === lastOpenRequest.current) return
    lastOpenRequest.current = openRequest
    setSelection(selectId(DETAILS_ID))
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

  // Text typed into the preview edits the latest sections, read through refs
  // so the environment below does not change with every keystroke.
  const latest = useRef({ sections, onSectionsChange })
  latest.current = { sections, onSectionsChange }
  const onEditText = useCallback((sectionId: string, key: string, value: string) => {
    const { sections: current, onSectionsChange: change } = latest.current
    // A linked copy's words are its own override; the original keeps its own.
    if (current.find((section) => section.id === sectionId)?.linkedTo) {
      change(setSectionOverrides(current, sectionId, { [key]: value }))
      return
    }
    const target = editTargetId(current, sectionId)
    change(
      current.map((section) =>
        section.id === target
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

    // Dropped, not selected: the palette stays open for the next item. An
    // item added by click opens its settings instead (see `insert`).
    if (item.kind === 'section') {
      const section = createStarterSection(item.type, item.preset)
      const next = [...current]
      next.splice(at(target.kind === 'sections' ? target.index : current.length), 0, section)
      change(next)
      return
    }

    const donor = createSection('custom', { blocks: item.blocks as never })
    const created = readBlocks(donor.settings, 'blocks')

    if (target.kind === 'blocks') {
      const host = current.find((section) => section.id === editTargetId(current, target.sectionId))
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
      // A linked copy's block words are its own override.
      if (current.find((section) => section.id === sectionId)?.linkedTo) {
        change(setBlockOverrides(current, sectionId, blockId, { [key]: value }))
        return
      }
      const target = editTargetId(current, sectionId)
      change(
        current.map((section) => {
          if (section.id !== target) return section
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

  // A block clicked on the canvas: highlight it and open its properties. It
  // runs after the section's own selection, so it lands last and wins.
  const onSelectBlock = useCallback((sectionId: string, blockId: string) => {
    setSelection({ id: sectionId, blockId, element: null })
  }, [])

  // A button or text element clicked on the canvas: same, through the
  // section's element map. The kind decides which properties open.
  const onSelectElement = useCallback(
    (sectionId: string, elementId: string, kind: ElementKind = 'button') => {
      setSelection({ id: sectionId, blockId: null, element: { id: elementId, kind } })
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

  /**
   * Picks a section (or a fixed row), dropping any block or element of the
   * previous one. Picked from the list, it is also brought into view in the
   * preview, below the header.
   */
  const select = useCallback(
    (id: string, fromPreview = false) => {
      setSelection(selectId(id))
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
   * included. Bubble phase, so a click on a section reaches that section's
   * own capture-phase picker first and is left alone here.
   */
  const clickAway = useCallback((event: { target: EventTarget | null }) => {
    const target = event.target as HTMLElement | null
    if (typeof target?.closest !== 'function' || target.closest('[data-section-id]')) return
    setSelection(NOTHING_SELECTED)
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
            onRemoved={() => setSelection(NOTHING_SELECTED)}
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

  const previewBar = useMemo(
    () => (
      <PreviewToolbar
        device={device}
        onDeviceChange={setDevice}
        mode={previewColorMode}
        onModeChange={setPreviewMode}
        history={history}
        note={previewNote}
        toolbar={toolbar}
      />
    ),
    [device, previewColorMode, history, previewNote, toolbar],
  )

  /** The preview itself, with the layer that takes drops from the add palette. */
  const canvas = (
    <Box position="relative" flex="1" minH="0" minW="0">
      <PreviewFrame
        device={device}
        mode={previewColorMode}
        fontHref={googleFontsHref(settings)}
        onDocument={setPreviewDoc}
      >
        {preview}
      </PreviewFrame>
      <DropOverlay
        doc={previewDoc}
        active={Boolean(paletteDrag.item)}
        blocks={paletteDrag.item?.kind === 'blocks'}
        sections={sections}
        onDrop={onPaletteDrop}
      />
    </Box>
  )

  /* ------------------------------------------------------------------------ */
  /* Panels                                                                   */
  /* ------------------------------------------------------------------------ */

  const fill = !compact
  const details = frame?.details

  const sidebar = (
    <Panel
      fill={fill}
      header={
        template && (
          <HStack gap="2" px="3" py="2.5" borderBottomWidth="1px" borderColor="border.subtle">
            <Text fontSize="xs" color="fg.muted" flexShrink="0" ps="1">
              {t('editingTemplate')}
            </Text>
            <Box flex="1" minW="0">
              <SelectInput
                value={template.value}
                onChange={(value) => value && template.onChange(value as TemplateKey)}
                options={TEMPLATE_KEYS.map((key) => ({
                  value: key,
                  label: t(TEMPLATE_LABELS[key]),
                }))}
              />
            </Box>
          </HStack>
        )
      }
      footer={
        onSettingsChange && (
          <Box p="2">
            <SidebarRow
              icon={LuPalette}
              label={t('themeSettings')}
              selected={selectedId === THEME_ID}
              chevron
              onSelect={() => select(THEME_ID)}
            />
          </Box>
        )
      }
    >
      <Stack gap="3">
        {notice && (
          <Alert.Root status="success" size="sm">
            <Alert.Indicator />
            <Alert.Description>{notice}</Alert.Description>
          </Alert.Root>
        )}
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
                <SidebarRow
                  icon={LuFileText}
                  label={details.label}
                  detail={details.detail}
                  selected={selectedId === DETAILS_ID}
                  onSelect={() => select(DETAILS_ID)}
                />
              )}
              {editableLayout && (
                <SidebarRow
                  icon={sectionIcon('header')}
                  label={l(LAYOUT_PART_NAMES.header)}
                  selected={selectedId === HEADER_ID}
                  onSelect={() => select(HEADER_ID)}
                />
              )}
            </>
          }
          after={
            editableLayout && (
              <SidebarRow
                icon={sectionIcon('footer')}
                label={l(LAYOUT_PART_NAMES.footer)}
                selected={selectedId === FOOTER_ID}
                onSelect={() => select(FOOTER_ID)}
              />
            )
          }
        />
      </Stack>
    </Panel>
  )

  const inspector = (
    <Inspector
      selection={selection}
      onSelectionChange={setSelection}
      exit={shape === 'split' ? 'close' : 'back'}
      fill={fill}
      sections={sections}
      onSectionsChange={onSectionsChange}
      services={services}
      layout={layout}
      onLayoutChange={onLayoutChange}
      details={details}
      theme={
        onSettingsChange && {
          settings,
          onChange: onSettingsChange,
          shop: { name: data.shop.name, logoUrl: data.shop.logoUrl },
          priorityLookKeys: startWithLooks?.priorityKeys,
        }
      }
    />
  )

  /** Where the list and the inspector share one panel, the picked thing wins it. */
  const shared = panelOverride ?? (selectedId ? inspector : sidebar)

  // The panels' link controls can point at any section on the page being
  // edited, so the list is offered to them here rather than through the
  // host's services (which know the catalogue, not the layout). The section
  // being edited is named too, so no section can be offered a link to itself.
  const linkScope = (children: ReactNode) => (
    <SectionLinkProvider
      sections={sections}
      currentSectionId={selectedId && !isPseudoId(selectedId) ? selectedId : null}
    >
      {children}
    </SectionLinkProvider>
  )

  if (!compact) {
    const split = shape === 'split'
    // The preview keeps its place in the tree across `stacked` and `split`,
    // so a window resized between them does not reload it.
    return linkScope(
      <Flex h={height} minH="0" bg="bg.panel">
        <Box
          as="aside"
          w={split ? SIDEBAR_WIDTH : STACKED_WIDTH}
          flexShrink="0"
          minH="0"
          borderEndWidth="1px"
          borderColor="border.subtle"
        >
          {split ? sidebar : shared}
        </Box>
        <Flex as="main" direction="column" flex="1" minW="0" minH="0">
          <Box px="3" py="2" borderBottomWidth="1px" borderColor="border.subtle">
            {previewBar}
          </Box>
          {canvas}
        </Flex>
        {split && (
          <Box
            as="aside"
            w={INSPECTOR_WIDTH}
            flexShrink="0"
            minH="0"
            borderStartWidth="1px"
            borderColor="border.subtle"
          >
            {panelOverride ?? inspector}
          </Box>
        )}
      </Flex>,
    )
  }

  const previewButton = (
    <Button w="full" size="lg" colorPalette="brand" onClick={() => setPreviewOpen(true)}>
      <LuEye />
      {t('showPreview')}
    </Button>
  )

  return linkScope(
    <Stack gap="4" minH="0">
      <Box borderWidth="1px" borderColor="border.subtle" rounded="lg" bg="bg.panel" overflow="hidden">
        {shared}
      </Box>

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
              <Dialog.Body flex="1" minH="0" p="0" display="flex" flexDirection="column">
                <Box px="3" py="2" borderBottomWidth="1px" borderColor="border.subtle">
                  {previewBar}
                </Box>
                {previewOpen && canvas}
              </Dialog.Body>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Stack>,
  )
}
