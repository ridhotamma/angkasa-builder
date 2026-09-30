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
  Grid,
  HStack,
  Icon,
  IconButton,
  Portal,
  ScrollArea,
  SegmentGroup,
  Stack,
  Tabs,
  Text,
  useBreakpointValue,
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
  LuChevronLeft,
  LuEye,
  LuMonitor,
  LuRedo2,
  LuShoppingBag,
  LuSmartphone,
  LuTablet,
  LuUser,
  LuSearch,
  LuUndo2,
} from 'react-icons/lu'

import { Tooltip } from '@repo/theme'

import { TEMPLATE_KEYS, type SectionInstance, type TemplateKey } from '../model/content'
import type { FieldValues } from '../model/fields'
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
import { useBuilderDialogFooter } from './builder-dialog'
import { CatalogueProvider } from './catalogue'
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
  /** Rendered above the preview, e.g. save and publish buttons. */
  toolbar?: ReactNode
  /** Said above the preview before the "click a section" hint, e.g. which theme it uses. */
  previewNote?: string
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

/** The template switcher's label for each template a theme designs. */
const TEMPLATE_LABELS = {
  home: 'templateHome',
  product: 'templateProduct',
  article: 'templateArticle',
} as const satisfies Record<TemplateKey, string>

export function PageBuilder(props: PageBuilderProps) {
  return (
    <CatalogueProvider initial={props.data.products ?? []}>
      {(products) => <Builder {...props} products={products} />}
    </CatalogueProvider>
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
  previewNote,
  height = 'calc(100dvh - 9rem)',
  frame,
  products,
}: PageBuilderProps & { products: StorefrontRenderData['latest'] }) {
  const { t, l } = useEditorText()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<'sections' | 'theme'>('sections')
  const [sectionTab, setSectionTab] = useState<'content' | 'style' | 'visibility'>('content')
  const [device, setDevice] = useState<PreviewDevice>('desktop')
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // Below `lg` the panel takes the whole width, and the preview opens as a
  // full-screen sheet from a button pinned to the bottom instead.
  const compact = useBreakpointValue({ base: true, lg: false }, { ssr: false }) ?? false
  const [previewOpen, setPreviewOpen] = useState(false)
  const footerSlot = useBuilderDialogFooter()

  const editableLayout = Boolean(layout && onLayoutChange)
  const selected = sections.find((section) => section.id === selectedId) ?? null
  const schema = selected ? sectionSchema(selected.type) : null

  useHistoryKeys(
    history,
    useMemo(() => [globalThis.document ?? null, previewDoc], [previewDoc]),
  )

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
      getWindow: previewDoc?.defaultView ? () => previewDoc.defaultView! : undefined,
      editing: { onEditText },
    }),
    [envData, settings, services.imageUrl, services.videoUrl, formatPrice, previewDoc, onEditText],
  )

  // The footer's page list, compared by what it says: callers map it inline.
  const footerKey = JSON.stringify(footerPagesProp)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const footerPages = useMemo(() => footerPagesProp, [footerKey])

  const select = useCallback(
    (id: string, fromPreview = false) => {
      setSelectedId(id)
      setTab('sections')
      if (!fromPreview) {
        // Picked from the list: bring it into view in the preview.
        previewDoc
          ?.querySelector(`[data-section-id="${id}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
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
      view?.requestAnimationFrame(() =>
        previewDoc
          ?.querySelector(`[data-section-id="${id}"]`)
          ?.scrollIntoView({ block: 'nearest' }),
      )
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
              <ThemeSettingsPanel settings={settings} onChange={onSettingsChange} />
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
   * header/footer rows — drops the selection and returns to the list.
   * Bubble phase, so a click on a section reaches that section's own
   * capture-phase picker first and is left alone here.
   */
  const clickAway = useCallback((event: { target: EventTarget | null }) => {
    const target = event.target as HTMLElement | null
    if (typeof target?.closest !== 'function' || target.closest('[data-section-id]')) return
    setSelectedId(null)
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

  return (
    <Grid
      templateColumns={{ base: '1fr', lg: '20rem 1fr', '2xl': '24rem 1fr' }}
      gap="4"
      h={{ lg: height }}
      minH="0"
    >
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

      {compact ? (
        // In the dialog's footer strip, outside the scroll area, when there is
        // one; stuck to the bottom of the scrolling body otherwise.
        footerSlot ? (
          createPortal(previewButton, footerSlot)
        ) : (
          <Box position="sticky" bottom="0" zIndex="1" pt="2" pb="3" mt="-4" bg="bg.panel">
            {previewButton}
          </Box>
        )
      ) : (
        <Flex direction="column" gap="3" minH="0" minW="0">
          {previewBar}
          <Box
            flex="1"
            minH="0"
            rounded="lg"
            borderWidth="1px"
            borderColor="border.subtle"
            overflow="hidden"
          >
            {previewFrame}
          </Box>
        </Flex>
      )}

      {/* Only one preview is ever mounted: the frame is a portal into its own
          iframe, and a second one would fight the first over `previewDoc`. */}
      {compact && (
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
                  >
                    {previewOpen && previewFrame}
                  </Box>
                </Dialog.Body>
              </Dialog.Content>
            </Dialog.Positioner>
          </Portal>
        </Dialog.Root>
      )}
    </Grid>
  )
}
