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
 * Fully controlled: the screen owns the document and decides when to save.
 * This component only ever calls `onSectionsChange` / `onSettingsChange` /
 * `onLayoutChange` with a new value; undo and redo are the screen's too
 * (`useUndoableState`), handed in as `history`.
 */

import {
  Alert,
  Box,
  Button,
  Container,
  Flex,
  Grid,
  HStack,
  Icon,
  IconButton,
  ScrollArea,
  SegmentGroup,
  Stack,
  Tabs,
  Text,
} from '@chakra-ui/react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  LuChevronLeft,
  LuMonitor,
  LuRedo2,
  LuShoppingBag,
  LuSmartphone,
  LuTablet,
  LuUser,
  LuSearch,
  LuUndo2,
} from 'react-icons/lu'

import type { SectionInstance, TemplateKey } from '../model/content'
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
import { StoreFooter, StoreHeader } from '../render/chrome'
import {
  RenderProvider,
  type RenderEnvironment,
  type StorefrontRenderData,
} from '../render/context'
import { PAGE_WIDTH_CONTAINER } from '../render/primitives'
import { SectionsRenderer, ThemeScope } from '../render/renderer'
import { CatalogueProvider } from './catalogue'
import { FieldsForm, SelectInput } from './controls'
import { useHistoryKeys, type EditorHistory } from './history'
import { useEditorText } from './messages'
import { PreviewFrame, type PreviewDevice } from './preview-frame'
import { PinnedRow, SectionList } from './section-list'
import type { EditorServices } from './services'
import { ThemeSettingsPanel } from './theme-settings'

const STYLE_FIELDS = SECTION_STYLE_FIELDS.filter(
  (field) => !(VISIBILITY_STYLE_KEYS as readonly string[]).includes(field.key),
)
const VISIBILITY_FIELDS = SECTION_STYLE_FIELDS.filter((field) =>
  (VISIBILITY_STYLE_KEYS as readonly string[]).includes(field.key),
)

const HEADER_ID = 'layout:header'
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
}

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
  menus = { main: [], footer: [] },
  footerPages = [],
  history,
  toolbar,
  previewNote,
  height = 'calc(100dvh - 9rem)',
  products,
}: PageBuilderProps & { products: StorefrontRenderData['latest'] }) {
  const { t, l } = useEditorText()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<'sections' | 'theme'>('sections')
  const [sectionTab, setSectionTab] = useState<'content' | 'style' | 'visibility'>('content')
  const [device, setDevice] = useState<PreviewDevice>('desktop')
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const editableLayout = Boolean(layout && onLayoutChange)
  const selected = sections.find((section) => section.id === selectedId) ?? null
  const schema = selected ? sectionSchema(selected.type) : null

  useHistoryKeys(history, useMemo(() => [globalThis.document ?? null, previewDoc], [previewDoc]))

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 3500)
    return () => clearTimeout(timer)
  }, [notice])

  // A template switch starts on its list, not on a section of the other one.
  useEffect(() => setSelectedId(null), [template?.value])

  const updateSection = useCallback(
    (id: string, change: (section: SectionInstance) => SectionInstance) =>
      onSectionsChange(sections.map((section) => (section.id === id ? change(section) : section))),
    [sections, onSectionsChange],
  )

  const env: RenderEnvironment = {
    data: { ...data, products },
    settings,
    mode: 'preview',
    imageUrl: services.imageUrl,
    videoUrl: services.videoUrl,
    formatPrice,
    getWindow: previewDoc?.defaultView ? () => previewDoc.defaultView! : undefined,
    editing: {
      onEditText: (sectionId, key, value) =>
        updateSection(sectionId, (section) => ({
          ...section,
          settings: { ...section.settings, [key]: value },
        })),
    },
  }

  function select(id: string, fromPreview = false) {
    setSelectedId(id)
    setTab('sections')
    if (!fromPreview) {
      // Picked from the list: bring it into view in the preview.
      previewDoc
        ?.querySelector(`[data-section-id="${id}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const back = (
    <Button size="xs" variant="ghost" alignSelf="start" ml="-2" onClick={() => setSelectedId(null)}>
      <Icon as={LuChevronLeft} />
      {t('back')}
    </Button>
  )

  const layoutPart = selectedId === HEADER_ID ? 'header' : selectedId === FOOTER_ID ? 'footer' : null

  const panel =
    layoutPart && layout && onLayoutChange ? (
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
                  onChange={(values) => updateSection(selected.id, (section) => ({ ...section, settings: values }))}
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
                onChange={(style) => updateSection(selected.id, (section) => ({ ...section, style }))}
              />
            </Stack>
          </Tabs.Content>
          <Tabs.Content value="visibility" p="0">
            <Stack gap="4">
              <FieldsForm
                fields={VISIBILITY_FIELDS}
                values={selected.style}
                services={services}
                onChange={(style) => updateSection(selected.id, (section) => ({ ...section, style }))}
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
              options={[
                { value: 'home', label: t('templateHome') },
                { value: 'product', label: t('templateProduct') },
              ]}
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
          editableLayout ? (
            <PinnedRow
              icon="header"
              label={l(LAYOUT_PART_NAMES.header)}
              selected={selectedId === HEADER_ID}
              onSelect={() => select(HEADER_ID)}
            />
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

  const shop = {
    name: data.shop.name,
    logoUrl: data.shop.logoUrl,
    description: data.shop.description,
    email: data.shop.email ?? null,
  }

  /** Stand-ins for the storefront's own search, cart and account controls. */
  const standIn = (icon: typeof LuSearch, label: string) => (
    <IconButton aria-label={label} variant="ghost" size="sm" rounded="full" color="inherit">
      <Icon as={icon} boxSize="4.5" />
    </IconButton>
  )

  const pickable = (id: string, content: ReactNode, sticky = false) =>
    editableLayout ? (
      <Box
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
    )

  const firstEdge = sections.find((section) => !section.hidden)?.style.width === 'edge'
  const transparent =
    scope === 'home' && Boolean(layout?.header.transparentOnHome) && firstEdge

  const preview = (
    <RenderProvider value={env}>
      <ThemeScope settings={settings} minH="100dvh" display="flex" flexDirection="column" {...PAGE_WIDTH_CONTAINER}>
        {layout &&
          pickable(
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
            Boolean(layout.header.sticky) || transparent,
          )}
        <Box flex="1" {...PAGE_WIDTH_CONTAINER}>
          <Container
            maxW="6xl"
            px={{ base: '4', md: '6' }}
            py={{ base: '6', md: '10' }}
            pt={transparent ? '0' : undefined}
          >
            <Box mt={transparent ? 'calc(-1 * var(--pb-header-height, 0px))' : undefined}>
              <SectionsRenderer
                sections={sections}
                env={env}
                selectedId={selectedId}
                onSelect={(id) => select(id, true)}
              />
            </Box>
          </Container>
        </Box>
        {layout &&
          pickable(
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
            />,
          )}
      </ThemeScope>
    </RenderProvider>
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
          <ScrollArea.Content p="4" style={{ minWidth: 0 }}>
            {panel}
          </ScrollArea.Content>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar />
      </ScrollArea.Root>

      <Flex direction="column" gap="3" minH="0" minW="0">
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
                <SegmentGroup.Item key={value} value={value} aria-label={t(label)} title={t(label)}>
                  <SegmentGroup.ItemText>
                    <Icon as={glyph} boxSize="3.5" />
                  </SegmentGroup.ItemText>
                  <SegmentGroup.ItemHiddenInput />
                </SegmentGroup.Item>
              ))}
            </SegmentGroup.Root>
            {history && (
              <HStack gap="0.5">
                <IconButton
                  aria-label={t('undo')}
                  title={`${t('undo')} (Ctrl+Z)`}
                  size="xs"
                  variant="ghost"
                  disabled={!history.canUndo}
                  onClick={history.undo}
                >
                  <LuUndo2 />
                </IconButton>
                <IconButton
                  aria-label={t('redo')}
                  title={`${t('redo')} (Ctrl+Shift+Z)`}
                  size="xs"
                  variant="ghost"
                  disabled={!history.canRedo}
                  onClick={history.redo}
                >
                  <LuRedo2 />
                </IconButton>
              </HStack>
            )}
            <Text fontSize="xs" color="fg.muted" hideBelow="xl">
              {previewNote ? `${previewNote} ` : ''}
              {t('inlineHint')}
            </Text>
          </HStack>
          {toolbar}
        </Flex>
        <Box
          flex="1"
          h={{ base: '36rem', lg: 'auto' }}
          minH="0"
          rounded="lg"
          borderWidth="1px"
          borderColor="border.subtle"
          overflow="hidden"
        >
          <PreviewFrame device={device} fontHref={googleFontsHref(settings)} onDocument={setPreviewDoc}>
            {preview}
          </PreviewFrame>
        </Box>
      </Flex>
    </Grid>
  )
}
