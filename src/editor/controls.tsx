/**
 * One control per field kind, generated from a section's schema.
 *
 * Controlled and form-library-free on purpose: the editor's whole document is
 * one value held by the screen, every keystroke replaces it, and the preview
 * re-renders from it. A form library would add a second copy of the state to
 * keep in step for no gain.
 */

import {
  Badge,
  Box,
  Button,
  Collapsible,
  ColorPicker,
  createListCollection,
  Field,
  Flex,
  HStack,
  Icon,
  IconButton,
  Image,
  Input,
  InputGroup,
  Menu,
  NumberInput,
  parseColor,
  Popover,
  Portal,
  ScrollArea,
  SegmentGroup,
  Select,
  Slider,
  Stack,
  Switch,
  Text,
  Textarea,
} from '@chakra-ui/react'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  createContext,
  memo,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  LuArrowDown,
  LuArrowUp,
  LuChevronDown,
  LuChevronRight,
  LuFolderInput,
  LuGripVertical,
  LuImagePlus,
  LuInfo,
  LuMonitor,
  LuPencil,
  LuPlus,
  LuSearch,
  LuSmartphone,
  LuTrash2,
} from 'react-icons/lu'

import { IconTile, Tooltip } from '../ui'

import { readBlockDevices } from '../model/block-style'
import {
  blockContainers,
  canMoveBlockTo,
  findBlock,
  moveBlockTo,
  type BlockContainer,
} from '../model/blocks'
import { sectionDisplayName, sectionLinkTargets, type SectionInstance } from '../model/content'
import { sectionSchema } from '../model/sections'

import {
  canAddBlock,
  createBlock,
  defaultValues,
  isFieldShown,
  MAX_BLOCK_NAME,
  newId,
  parseCoordinates,
  readBlocks,
  readCoordinates,
  readPoint,
  readTable,
  readText,
  type BlockSchema,
  type BlockValue,
  type BlocksField,
  type CoordinatesValue,
  type Field as FieldSpec,
  type FieldValues,
  type JsonValue,
  type ListField,
} from '../model/fields'
import { NO_LINK, type Link, type LinkKind } from '../model/links'
import {
  isLocalizedText,
  isLocalizedValue,
  readLocalizedEntry,
  readLocalizedEntryOf,
  withLocalizedEntry,
  withLocalizedEntryOf,
  type Localized,
  type StorefrontLocale,
} from '../model/localized'
import { EMPTY_RICH_DOC, type RichDoc } from '../model/rich-text'
import { blockGlyph } from './block-icons'
import { ChoiceCards } from './choice-cards'
import { IconPicker } from './icon-picker'
import {
  DateTimeControl,
  PointControl,
  ProductControl,
  TableControl,
  VideoControl,
} from './media-controls'
import { flipElements, orderMoved, type SectionRects } from './reorder-flip'
import { MediaPickerDialog } from './media-picker'
import { cardLabel, optionPictures } from './option-pictures'
import { RichTextControl } from './rich-text-control'
import { useEditorText, type EditorMessage } from './messages'
import type { EditorServices } from './services'

/**
 * A field's label line: the name, then an ⓘ that holds the help. The help sits
 * in a tooltip so a panel of a dozen settings reads as a dozen names, not a
 * dozen paragraphs. The ⓘ flows with the text, so a label that wraps keeps it
 * at the end of its last line rather than in a column of its own.
 */
function FieldHeading({ label, help }: { label: string; help?: string }) {
  const { t } = useEditorText()
  return (
    <Field.Label fontSize="sm" m="0" minW="0" display="block" lineHeight="short">
      {label}
      {help && (
        <Tooltip content={help}>
          <Box
            as="span"
            tabIndex={0}
            aria-label={t('fieldHelp')}
            display="inline-flex"
            verticalAlign="-0.15em"
            ms="1"
            color="fg.subtle"
            cursor="help"
            rounded="full"
            _hover={{ color: 'fg.muted' }}
            _focusVisible={{ outline: '2px solid', outlineColor: 'colorPalette.focusRing' }}
            // A click on the hint opens the hint, not the control the label names.
            onClick={(event) => event.preventDefault()}
          >
            <Icon as={LuInfo} boxSize="3.5" />
          </Box>
        </Tooltip>
      )}
    </Field.Label>
  )
}

/**
 * A field: its label line above the control or, `inline`, beside it.
 *
 * Inline is for controls that are short whatever their value — a dropdown, a
 * number, a switch-sized segment — so a setting takes one row instead of two.
 * The row only forms when the field is wide enough for both halves; a narrow
 * panel stacks them again.
 */
export function Labeled({
  label,
  help,
  error,
  inline = false,
  children,
}: {
  label: string
  help?: string
  error?: string | null
  inline?: boolean
  children: ReactNode
}) {
  return (
    // `stretch`, not Chakra's default `flex-start`: a control inside a field —
    // a select, a link picker, a list — should be as wide as the panel, not
    // as wide as its current value.
    <Field.Root
      invalid={Boolean(error)}
      alignItems="stretch"
      // The field measures itself for the inline row, so the row follows the
      // panel's width rather than the window's. Only inline fields: a size
      // container cannot shrink-wrap its content, which a stacked field
      // inside a toolbar or a popover may need to.
      css={inline ? { containerType: 'inline-size' } : undefined}
    >
      <Box
        display="grid"
        gap="1.5"
        css={
          inline
            ? {
                '@container (min-width: 17rem)': {
                  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)',
                  alignItems: 'center',
                  columnGap: '0.75rem',
                },
              }
            : undefined
        }
      >
        <FieldHeading label={label} help={help} />
        <Box minW="0">{children}</Box>
      </Box>
      {error && <Field.ErrorText>{error}</Field.ErrorText>}
    </Field.Root>
  )
}

/**
 * How a select's options are best drawn. A handful of short answers become a
 * segmented row, so every answer is visible without opening anything: beside
 * the label when they are numbers or a couple of short words (the columns 2
 * to 6), on a row of their own when they are words (a grid or a slider). Any
 * more, or any longer, and a dropdown reads better.
 */
function selectShape(labels: readonly string[]): 'segment-inline' | 'segment' | 'dropdown' {
  if (labels.length < 2 || labels.length > 6) return 'dropdown'
  const total = labels.reduce((sum, label) => sum + label.length, 0)
  if (total <= 12 && labels.every((label) => label.length <= 6)) return 'segment-inline'
  if (total <= 24 && labels.every((label) => label.length <= 10)) return 'segment'
  return 'dropdown'
}

/**
 * Chakra's `Select`, reduced to the one-value case every field here needs.
 *
 * `clearable` is for fields where "nothing picked" is a real answer (a
 * collection picker whose empty value means "the first collection"): the
 * placeholder names that answer, and a clear button returns to it.
 */
export function SelectInput({
  value,
  onChange,
  options,
  placeholder,
  clearable = false,
  size = 'sm',
  portalled = true,
}: {
  value: string
  onChange: (value: string) => void
  options: ReadonlyArray<{ value: string; label: string }>
  placeholder?: string
  clearable?: boolean
  size?: 'xs' | 'sm' | 'md'
  /** `false` inside a dialog, where a portalled list would open behind it. */
  portalled?: boolean
}) {
  const collection = useMemo(
    () => createListCollection({ items: options.map(({ value, label }) => ({ value, label })) }),
    [options],
  )

  return (
    <Select.Root
      collection={collection}
      size={size}
      width="full"
      value={value ? [value] : []}
      onValueChange={({ value: next }) => onChange(next[0] ?? '')}
      positioning={{ sameWidth: true }}
    >
      <Select.HiddenSelect />
      <Select.Control>
        <Select.Trigger>
          <Select.ValueText placeholder={placeholder} />
        </Select.Trigger>
        <Select.IndicatorGroup>
          {clearable && value && <Select.ClearTrigger />}
          <Select.Indicator />
        </Select.IndicatorGroup>
      </Select.Control>
      <Portal disabled={!portalled}>
        <Select.Positioner>
          {/* An overlay scrollbar rather than the content's own `overflow:
              auto`, as the builder's panels use: the native bar is a grey
              gutter beside a long list like the fonts. The root is only
              capped, so a short list keeps its natural height. */}
          <Select.Content p="0" maxH="none" overflow="hidden">
            <ScrollArea.Root size="xs" maxH="xs">
              <ScrollArea.Viewport style={{ overscrollBehavior: 'contain' }}>
                <ScrollArea.Content p="1">
                  {collection.items.map((item) => (
                    <Select.Item item={item} key={item.value}>
                      {item.label}
                      <Select.ItemIndicator />
                    </Select.Item>
                  ))}
                </ScrollArea.Content>
              </ScrollArea.Viewport>
              <ScrollArea.Scrollbar />
            </ScrollArea.Root>
          </Select.Content>
        </Select.Positioner>
      </Portal>
    </Select.Root>
  )
}

/**
 * A two-way field as a segmented control: both answers stay visible, so the
 * seller sees what the other choice is — cards or custom blocks.
 */
export function SegmentInput<T extends string>({
  value,
  onChange,
  options,
  disabled = false,
}: {
  value: T
  onChange: (value: T) => void
  options: ReadonlyArray<{ value: T; label: string }>
  disabled?: boolean
}) {
  return (
    <SegmentGroup.Root
      size="sm"
      w="full"
      value={value}
      disabled={disabled}
      onValueChange={({ value: next }) => next && onChange(next as T)}
    >
      <SegmentGroup.Indicator />
      {options.map((option) => (
        <SegmentGroup.Item key={option.value} value={option.value} flex="1" minW="0" px="1.5">
          <SegmentGroup.ItemText truncate>{option.label}</SegmentGroup.ItemText>
          <SegmentGroup.ItemHiddenInput />
        </SegmentGroup.Item>
      ))}
    </SegmentGroup.Root>
  )
}

/**
 * A slider with its value at the end of the label line — the print designers'
 * size controls, drawn with the same label and help affordances as the rest of
 * the builder's fields.
 */
export function RangeInput({
  label,
  help,
  value,
  min,
  max,
  step,
  unit,
  disabled = false,
  onChange,
}: {
  label: string
  help?: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  disabled?: boolean
  onChange: (value: number) => void
}) {
  const shown = Number.isInteger(value) ? value : value.toFixed(1)

  return (
    <Field.Root>
      <Stack gap="1.5" w="full">
        <Flex justify="space-between" align="baseline" gap="3">
          <FieldHeading label={label} help={help} />
          <Text fontSize="sm" fontWeight="semibold" fontVariantNumeric="tabular-nums">
            {shown} {unit}
          </Text>
        </Flex>
        <Slider.Root
          size="sm"
          min={min}
          max={max}
          step={step}
          value={[value]}
          disabled={disabled}
          onValueChange={({ value: next }) => onChange(next[0] ?? value)}
        >
          <Slider.Control>
            <Slider.Track>
              <Slider.Range />
            </Slider.Track>
            <Slider.Thumb index={0} aria-label={label} />
          </Slider.Control>
        </Slider.Root>
      </Stack>
    </Field.Root>
  )
}

/** A labelled switch, the same row the builder's boolean fields use. */
export function ToggleField({
  label,
  help,
  checked,
  disabled = false,
  onChange,
}: {
  label: string
  help?: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <Field.Root>
      <HStack justify="space-between" w="full" gap="3">
        <Box flex="1" minW="0">
          <FieldHeading label={label} help={help} />
        </Box>
        <Switch.Root
          size="sm"
          colorPalette="brand"
          checked={checked}
          disabled={disabled}
          onCheckedChange={({ checked: next }) => onChange(next)}
        >
          <Switch.HiddenInput aria-label={label} />
          <Switch.Control />
        </Switch.Root>
      </HStack>
    </Field.Root>
  )
}

/** Chakra's `NumberInput`, clamped to the field's range. */
export function NumberControl({
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
}) {
  return (
    <NumberInput.Root
      size="sm"
      width="full"
      value={String(value)}
      min={min}
      max={max}
      step={step}
      onValueChange={({ valueAsNumber }) => {
        if (Number.isFinite(valueAsNumber)) onChange(Math.min(max, Math.max(min, valueAsNumber)))
      }}
    >
      <NumberInput.Control />
      <NumberInput.Input />
    </NumberInput.Root>
  )
}

/**
 * One pin, as one box. Google Maps copies a spot as "lat, lng" in a single
 * string, so the seller pastes once instead of splitting the pair by hand.
 * Half-typed text stays in the box untouched — the stored pin only moves once
 * the pair parses — and an empty box clears it.
 */
function CoordinatesControl({
  label,
  help,
  placeholder,
  value,
  onChange,
}: {
  label: string
  help?: string
  placeholder?: string
  value: unknown
  onChange: (value: CoordinatesValue | null) => void
}) {
  const { t } = useEditorText()
  const stored = readCoordinates({ value: value as JsonValue }, 'value')
  const canonical = stored ? `${stored.latitude}, ${stored.longitude}` : ''
  // The draft follows the stored value when it changes from outside — another
  // block, another section — while a keystroke's own commit leaves the text
  // exactly as typed. Updating state during render is React's own pattern for
  // exactly this: state that mirrors a prop.
  const [draft, setDraft] = useState({ value, text: canonical })
  if (value !== draft.value) setDraft({ value, text: canonical })
  const [invalid, setInvalid] = useState(false)

  function change(text: string) {
    if (text.trim() === '') {
      setDraft({ value: null, text })
      setInvalid(false)
      onChange(null)
      return
    }
    const parsed = parseCoordinates(text)
    if (!parsed) {
      setDraft({ value: draft.value, text })
      setInvalid(true)
      return
    }
    setDraft({ value: parsed, text })
    setInvalid(false)
    onChange(parsed)
  }

  return (
    <Labeled label={label} help={help} error={invalid ? t('coordinatesInvalid') : undefined}>
      <Input
        size="sm"
        placeholder={placeholder}
        value={draft.text}
        onChange={(event) => change(event.currentTarget.value)}
      />
    </Labeled>
  )
}

/* -------------------------------------------------------------------------- */
/* Image                                                                      */
/* -------------------------------------------------------------------------- */

function ImageControl({
  value,
  onChange,
  services,
}: {
  value: string
  onChange: (fileId: string) => void
  services: EditorServices
}) {
  const { t } = useEditorText()
  const [pickerOpen, setPickerOpen] = useState(false)
  const src = value ? services.imageUrl(value, { width: 480, height: 320 }) : null

  return (
    <Stack gap="2">
      <Box
        rounded="md"
        overflow="hidden"
        borderWidth="1px"
        borderColor="border.subtle"
        bg="bg.subtle"
        h="28"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        {src ? (
          <Image src={src} alt="" w="full" h="full" objectFit="cover" />
        ) : (
          <Text fontSize="xs" color="fg.muted">
            {t('noImage')}
          </Text>
        )}
      </Box>
      <HStack gap="2" wrap="wrap">
        <Button size="xs" variant="outline" onClick={() => setPickerOpen(true)}>
          <Icon as={LuImagePlus} />
          {value ? t('replace') : t('upload')}
        </Button>
        {value && (
          <Button size="xs" variant="ghost" colorPalette="danger" onClick={() => onChange('')}>
            {t('remove')}
          </Button>
        )}
      </HStack>
      <MediaPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={onChange}
        selectedId={value}
        services={services}
      />
    </Stack>
  )
}

/* -------------------------------------------------------------------------- */
/* Link                                                                       */
/* -------------------------------------------------------------------------- */

export const LINK_KIND_LABELS: Record<LinkKind, EditorMessage> = {
  none: 'linkNone',
  home: 'linkHome',
  page: 'linkPage',
  product: 'linkProduct',
  collection: 'linkCollection',
  category: 'linkCategory',
  catalog: 'linkCatalog',
  blog: 'linkBlog',
  article: 'linkArticle',
  search: 'linkSearch',
  orderTracking: 'linkOrderTracking',
  section: 'linkSection',
  url: 'linkUrl',
}

function emptyLink(kind: LinkKind): Link {
  switch (kind) {
    case 'none':
    case 'home':
    case 'catalog':
    case 'orderTracking':
      return { kind }
    case 'page':
    case 'product':
    case 'collection':
    case 'category':
      return { kind, slug: '' }
    case 'blog':
      return { kind, blogHandle: '' }
    case 'article':
      return { kind, blogHandle: '', slug: '' }
    case 'search':
      return { kind, query: '' }
    case 'section':
      return { kind, sectionId: '' }
    case 'url':
      return { kind, href: 'https://' }
  }
}

/**
 * The sections a link can point at, supplied by the builder's panel.
 *
 * `null` outside the builder — the menu editor, say — where a same-page
 * anchor is not a link target; the kind is then absent from the picker rather
 * than offered and unusable.
 */
interface SectionLinkOptions {
  sections: readonly SectionInstance[]
  /** The section being edited: a link may not point at the section it sits in. */
  currentSectionId: string | null
}

const SectionLinkContext = createContext<SectionLinkOptions | null>(null)

export function SectionLinkProvider({
  sections,
  currentSectionId = null,
  children,
}: {
  sections: readonly SectionInstance[]
  currentSectionId?: string | null
  children: ReactNode
}) {
  const value = useMemo(() => ({ sections, currentSectionId }), [sections, currentSectionId])
  return <SectionLinkContext.Provider value={value}>{children}</SectionLinkContext.Provider>
}

/**
 * A control that needs its own field context.
 *
 * A link is edited with more than one control — the kind select, then a
 * product, collection or blog picker — and sits in one `Labeled` field. Ark
 * hands the field's ids to every control inside it, so two pickers in one
 * field shared ids, and each found the other's elements under its own: the
 * product combobox took a click on its own input for a click outside and
 * closed as it opened. Each extra control gets a field of its own.
 */
function OwnField({ children }: { children: ReactNode }) {
  return (
    <Field.Root alignItems="stretch" gap="0">
      {children}
    </Field.Root>
  )
}

export function LinkControl({
  value,
  onChange,
  services,
}: {
  value: Link
  onChange: (link: Link) => void
  services: EditorServices
}) {
  const { t, l } = useEditorText()
  const link = value ?? NO_LINK
  const sectionLinks = useContext(SectionLinkContext)

  // The page's own sections, named the way the section list names them: the
  // section type, then its first line of copy so two heroes are tellable
  // apart. The section being edited is left out — a button cannot scroll to
  // the section it is already in.
  const sectionOptions = useMemo(
    () =>
      sectionLinkTargets(sectionLinks?.sections ?? [], sectionLinks?.currentSectionId ?? null).map(
        (section, index) => {
          const schema = sectionSchema(section.type)
          const detail = readText(section.settings, 'heading') || readText(section.settings, 'text')
          const name = schema
            ? sectionDisplayName(section, sectionLinks?.sections ?? [], l(schema.name))
            : section.type
          return {
            value: section.id,
            label: detail ? `${name} — ${detail.slice(0, 40)}` : `${name} ${index + 1}`,
          }
        },
      ),
    [sectionLinks, l],
  )

  const kindOptions = (Object.keys(LINK_KIND_LABELS) as LinkKind[]).filter(
    // Offered only where there is a page to point into.
    (kind) => kind !== 'section' || sectionOptions.length > 0,
  )

  const slugOptions =
    // An article is picked from its own list below: its slug alone is not unique.
    link.kind === 'article'
      ? null
      : link.kind === 'collection'
        ? services.collections
        : link.kind === 'category'
          ? services.categories
          : link.kind === 'page'
            ? services.pages
            : null

  return (
    <Stack gap="2">
      <SelectInput
        value={link.kind}
        onChange={(kind) => onChange(emptyLink(kind as LinkKind))}
        options={kindOptions.map((kind) => ({
          value: kind,
          label: t(LINK_KIND_LABELS[kind]),
        }))}
      />
      {link.kind === 'section' && (
        <OwnField>
          <SelectInput
            value={link.sectionId}
            placeholder={t('linkSectionPlaceholder')}
            clearable
            onChange={(sectionId) => onChange({ kind: 'section', sectionId })}
            options={sectionOptions}
          />
        </OwnField>
      )}
      {slugOptions && 'slug' in link && (
        <OwnField>
          <SelectInput
            value={link.slug}
            placeholder={t('choose')}
            clearable
            onChange={(slug) => onChange({ ...link, slug })}
            options={slugOptions.map((option) => ({ value: option.slug, label: option.name }))}
          />
        </OwnField>
      )}
      {link.kind === 'catalog' && (
        // Optional: left empty, the catalogue opens on every category.
        <OwnField>
          <SelectInput
            value={link.category ?? ''}
            placeholder={t('linkCatalogAll')}
            clearable
            onChange={(category) =>
              onChange(category ? { kind: 'catalog', category } : { kind: 'catalog' })
            }
            options={services.categories.map((option) => ({
              value: option.slug,
              label: option.name,
            }))}
          />
        </OwnField>
      )}
      {link.kind === 'blog' && (
        <>
          <OwnField>
            <SelectInput
              value={link.blogHandle}
              placeholder={t('choose')}
              clearable
              onChange={(blogHandle) => onChange({ ...link, blogHandle })}
              options={(services.blogs ?? []).map((blog) => ({
                value: blog.slug,
                label: blog.name,
              }))}
            />
          </OwnField>
          <OwnField>
            <Input
              size="sm"
              placeholder={t('blogTag')}
              value={link.tag ?? ''}
              maxLength={30}
              onChange={(event) =>
                onChange({ ...link, tag: event.currentTarget.value.toLowerCase() || undefined })
              }
            />
          </OwnField>
        </>
      )}
      {link.kind === 'article' && (
        <OwnField>
          <SelectInput
            value={link.slug ? `${link.blogHandle}/${link.slug}` : ''}
            placeholder={t('choose')}
            clearable
            onChange={(value) => {
              const [blogHandle = '', slug = ''] = value.split('/')
              onChange({ kind: 'article', blogHandle, slug })
            }}
            options={(services.articles ?? []).map((article) => ({
              value: `${article.blogHandle}/${article.slug}`,
              label: article.name,
            }))}
          />
        </OwnField>
      )}
      {link.kind === 'product' && (
        // Picked from the shop's own products, by name — never a slug typed by hand.
        <OwnField>
          <ProductControl
            by="slug"
            value={link.slug}
            onChange={(slug) => onChange({ kind: 'product', slug })}
            services={services}
          />
        </OwnField>
      )}
      {link.kind === 'search' && (
        <OwnField>
          <Input
            size="sm"
            placeholder={t('searchQuery')}
            value={link.query}
            maxLength={120}
            onChange={(event) => onChange({ kind: 'search', query: event.currentTarget.value })}
          />
        </OwnField>
      )}
      {link.kind === 'url' && (
        <OwnField>
          <Stack gap="1">
            <Input
              size="sm"
              type="url"
              value={link.href}
              maxLength={2000}
              onChange={(event) =>
                onChange({ kind: 'url', href: event.currentTarget.value.trim() })
              }
            />
            <Text fontSize="xs" color="fg.muted">
              {t('urlHelp')}
            </Text>
          </Stack>
        </OwnField>
      )}
    </Stack>
  )
}

/* -------------------------------------------------------------------------- */
/* List                                                                       */
/* -------------------------------------------------------------------------- */

function ListControl({
  field,
  value,
  onChange,
  services,
  parent,
}: {
  field: ListField
  value: unknown
  onChange: (items: FieldValues[]) => void
  services: EditorServices
  /** The values the list sits in, for item fields that read a sibling of the list. */
  parent: FieldValues
}) {
  const { t, l } = useEditorText()
  const items = Array.isArray(value) ? (value as Array<FieldValues & { id: string }>) : []
  const [open, setOpen] = useState<string | null>(null)

  // Rows slide to their new places on every reorder, the same way the section
  // list does — the panel gives feedback even when two rows read alike.
  const rowsRef = useRef<HTMLDivElement>(null)
  const rowRects = useRef<SectionRects>(new Map())
  const rowIndexes = useRef<Map<string, number>>(new Map())

  useLayoutEffect(() => {
    const ids = items.map((item) => item.id)
    rowRects.current = flipElements(rowsRef.current, ids, rowRects.current, {
      attribute: 'data-list-row',
      animate: orderMoved(ids, rowIndexes.current),
    })
    rowIndexes.current = new Map(ids.map((id, index) => [id, index]))
  }, [items])

  function move(index: number, by: number) {
    const next = [...items]
    const [item] = next.splice(index, 1)
    next.splice(index + by, 0, item!)
    onChange(next)
  }

  return (
    <Stack ref={rowsRef} gap="2">
      {items.map((item, index) => {
        const voucherId = readText(item, 'voucherId')
        const itemVoucher = voucherId
          ? services.vouchers?.find((v) => v.id === voucherId)
          : undefined
        const title =
          readText(item, field.titleKey) ||
          (itemVoucher ? `${itemVoucher.code} — ${itemVoucher.name}` : '') ||
          `${l(field.itemLabel)} ${index + 1}`
        // An item that carries a picture shows it, so two untitled rows are
        // still tellable apart — and a move is visible even when the labels
        // are only their positions.
        const imageField = field.fields.find((candidate) => candidate.kind === 'image')
        const imageId = imageField ? readText(item, imageField.key) : ''
        const thumbnail = imageId ? services.imageUrl(imageId, { width: 64, height: 64 }) : null
        const expanded = open === item.id
        return (
          <Collapsible.Root
            key={item.id}
            open={expanded}
            onOpenChange={({ open: next }) => setOpen(next ? item.id : null)}
          >
            <Box data-list-row={item.id} borderWidth="1px" borderColor="border.subtle" rounded="md">
              <HStack gap="1" px="2" py="1.5">
                <Collapsible.Trigger asChild>
                  <Button variant="ghost" size="xs" flex="1" justifyContent="start" minW="0">
                    <Icon as={expanded ? LuChevronDown : LuChevronRight} />
                    {thumbnail && (
                      <Image
                        src={thumbnail}
                        alt=""
                        boxSize="8"
                        rounded="md"
                        objectFit="cover"
                        flexShrink="0"
                      />
                    )}
                    <Text truncate>{title}</Text>
                  </Button>
                </Collapsible.Trigger>
                <IconButton
                  aria-label={t('moveUp')}
                  size="2xs"
                  variant="ghost"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <LuArrowUp />
                </IconButton>
                <IconButton
                  aria-label={t('moveDown')}
                  size="2xs"
                  variant="ghost"
                  disabled={index === items.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <LuArrowDown />
                </IconButton>
                <IconButton
                  aria-label={t('remove')}
                  size="2xs"
                  variant="ghost"
                  colorPalette="danger"
                  onClick={() => onChange(items.filter((other) => other.id !== item.id))}
                >
                  <LuTrash2 />
                </IconButton>
              </HStack>
              <Collapsible.Content>
                <Stack gap="3" px="3" pb="3">
                  <FieldsForm
                    fields={field.fields}
                    values={item}
                    services={services}
                    parent={parent}
                    onChange={(values) =>
                      onChange(
                        items.map((other) =>
                          other.id === item.id ? { ...values, id: item.id } : other,
                        ),
                      )
                    }
                  />
                </Stack>
              </Collapsible.Content>
            </Box>
          </Collapsible.Root>
        )
      })}
      <Button
        size="xs"
        variant="outline"
        alignSelf="start"
        disabled={items.length >= field.max}
        onClick={() => {
          const item = { id: newId(), ...defaultValues(field.fields) }
          onChange([...items, item])
          setOpen(item.id)
        }}
      >
        <Icon as={LuPlus} />
        {t('addItem')} {l(field.itemLabel).toLowerCase()}
      </Button>
    </Stack>
  )
}

/** A stored colour, or `undefined` when the field is empty — never parse `''`. */
function parseHex(value: string) {
  if (!/^#[0-9a-f]{6}$/i.test(value)) return undefined
  try {
    return parseColor(value)
  } catch {
    return undefined
  }
}

/**
 * Chakra's `ColorPicker`, in hex. Opaque only: stored colours have no alpha,
 * and `toString('hex')` keeps them in the `#rrggbb` shape both the theme and
 * the section sanitisers accept.
 *
 * Empty is a real value — "no colour overridden yet" — so the picker starts
 * with no value rather than throwing on an unparseable string.
 */
export function ColorInput({
  label,
  value,
  onChange,
}: {
  /** Omitted when a surrounding `Labeled` already names the field. */
  label?: string
  value: string
  onChange: (value: string) => void
}) {
  const color = useMemo(() => parseHex(value), [value])

  return (
    <ColorPicker.Root
      size="sm"
      value={color}
      onValueChange={({ value: next }) => onChange(next.toString('hex').toLowerCase())}
    >
      <ColorPicker.HiddenInput />
      {label && <ColorPicker.Label fontSize="sm">{label}</ColorPicker.Label>}
      <ColorPicker.Control>
        <ColorPicker.Input fontFamily="mono" />
        <ColorPicker.Trigger />
      </ColorPicker.Control>
      <Portal>
        <ColorPicker.Positioner>
          <ColorPicker.Content>
            <ColorPicker.Area />
            <HStack>
              <ColorPicker.EyeDropper size="xs" variant="outline" />
              <ColorPicker.ChannelSlider channel="hue" flex="1" />
            </HStack>
          </ColorPicker.Content>
        </ColorPicker.Positioner>
      </Portal>
    </ColorPicker.Root>
  )
}

/* -------------------------------------------------------------------------- */
/* Dispatch                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The text a text field shows: the current locale's entry of a translated
 * field, or the plain string. The seller edits the language they are working in.
 */
function controlText(value: unknown, locale: StorefrontLocale): string {
  if (isLocalizedText(value)) return readLocalizedEntry(value, locale)
  return typeof value === 'string' ? value : ''
}

/**
 * What a text field stores on edit. A field that is already translated stays a
 * locale map — the keystroke changes only the locale being viewed, and the other
 * language is left untouched — while an untranslated field keeps writing one
 * plain string, exactly as before translations existed.
 */
function writeControlText(value: unknown, locale: StorefrontLocale, text: string): unknown {
  if (isLocalizedText(value)) return withLocalizedEntry(value, locale, text)
  return text
}

function isDocValue(value: unknown): value is RichDoc {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (value as { type?: unknown }).type === 'doc'
  )
}

/** The rich body for the locale being viewed: its document, or the empty one. */
function controlDoc(value: unknown, locale: StorefrontLocale): RichDoc {
  const doc: unknown = readLocalizedEntryOf(value, locale, isDocValue) ?? EMPTY_RICH_DOC
  return doc as RichDoc
}

/**
 * What a rich body stores on edit — the doc-typed twin of `writeControlText`.
 * A translated body stays a locale map and the edit changes only the locale
 * being viewed; an untranslated one keeps storing a single document.
 */
function writeControlDoc(value: unknown, locale: StorefrontLocale, doc: RichDoc): unknown {
  if (isDocValue(value)) return doc
  if (isLocalizedValue(value, isDocValue))
    return withLocalizedEntryOf(value, locale, doc, isDocValue)
  return doc
}

function FieldControl({
  field,
  value,
  onChange,
  services,
  values,
  parent,
}: {
  field: FieldSpec
  value: unknown
  onChange: (value: unknown) => void
  services: EditorServices
  /** The field's siblings. */
  values: FieldValues
  /** The values the siblings sit in, when they are a list item. */
  parent?: FieldValues
}) {
  const { t, l, locale } = useEditorText()
  const help = field.help ? l(field.help) : undefined
  const label = l(field.label)

  switch (field.kind) {
    case 'text':
      return (
        <Labeled label={label} help={help}>
          <Input
            size="sm"
            value={controlText(value, locale)}
            maxLength={field.max}
            placeholder={field.placeholder ? l(field.placeholder) : undefined}
            onChange={(event) =>
              onChange(writeControlText(value, locale, event.currentTarget.value))
            }
          />
        </Labeled>
      )
    case 'richtext':
      return (
        <Labeled label={label} help={help}>
          <RichTextControl
            value={controlDoc(value, locale)}
            onChange={(doc) => onChange(writeControlDoc(value, locale, doc))}
          />
        </Labeled>
      )
    case 'textarea':
      return (
        <Labeled label={label} help={help}>
          <Textarea
            size="sm"
            rows={field.rows ?? 4}
            value={controlText(value, locale)}
            maxLength={field.max}
            onChange={(event) =>
              onChange(writeControlText(value, locale, event.currentTarget.value))
            }
          />
        </Labeled>
      )
    case 'number':
      return (
        <Labeled label={label} help={help} inline>
          <NumberControl
            value={typeof value === 'number' ? value : field.default}
            min={field.min}
            max={field.max}
            step={field.step}
            onChange={onChange}
          />
        </Labeled>
      )
    case 'coordinates':
      return (
        <CoordinatesControl
          label={label}
          help={help}
          placeholder={field.placeholder ? l(field.placeholder) : undefined}
          value={value}
          onChange={onChange}
        />
      )
    case 'select': {
      const current = typeof value === 'string' ? value : field.default
      const options = field.options.map((option) => ({
        value: option.value,
        label: l(option.label),
      }))
      // A choice that reads better as a picture — a layout, an alignment, a
      // shape — is a row of picture cards (see `option-pictures`).
      const pictures = optionPictures(field)
      if (pictures) {
        return (
          <Labeled label={label} help={help}>
            <ChoiceCards
              label={label}
              columns={options.length <= 4 ? options.length : 3}
              value={current}
              onChange={onChange}
              choices={options.map((option, index) => ({
                value: option.value,
                label: cardLabel(option.label),
                hint: cardLabel(option.label) === option.label ? undefined : option.label,
                preview: pictures[index],
              }))}
            />
          </Labeled>
        )
      }
      // A schema's own `segment` is a wide two-way choice and keeps the whole
      // row, whatever its labels.
      const shape = field.segment ? 'segment' : selectShape(options.map((option) => option.label))
      const segment = shape !== 'dropdown'
      return (
        <Labeled label={label} help={help} inline={shape !== 'segment'}>
          {segment ? (
            <SegmentInput value={current} onChange={onChange} options={options} />
          ) : (
            <SelectInput value={current} onChange={onChange} options={options} />
          )}
        </Labeled>
      )
    }
    case 'boolean': {
      return <ToggleField label={label} help={help} checked={value === true} onChange={onChange} />
    }
    case 'icon':
      return (
        <Labeled label={label} help={help}>
          <IconPicker
            value={typeof value === 'string' ? value : field.default}
            onChange={onChange}
          />
        </Labeled>
      )
    case 'color':
      return (
        <Labeled label={label} help={help} inline>
          <ColorInput
            value={typeof value === 'string' ? value : field.default}
            onChange={onChange}
          />
        </Labeled>
      )
    case 'image':
      return (
        <Labeled label={label} help={help}>
          <ImageControl
            value={typeof value === 'string' ? value : ''}
            onChange={onChange}
            services={services}
          />
        </Labeled>
      )
    case 'collection':
    case 'category':
    case 'voucher': {
      const options =
        field.kind === 'collection'
          ? services.collections
          : field.kind === 'category'
            ? services.categories
            : (services.vouchers ?? []).map((v) => ({ id: v.id, name: `${v.code} — ${v.name}` }))
      return (
        <Labeled label={label} help={help}>
          <SelectInput
            value={typeof value === 'string' ? value : ''}
            onChange={onChange}
            placeholder={field.emptyLabel ? l(field.emptyLabel) : t('choose')}
            clearable
            options={options.map((option) => ({ value: option.id, label: option.name }))}
          />
        </Labeled>
      )
    }
    case 'link':
      return (
        <Labeled label={label} help={help}>
          <LinkControl value={value as Link} onChange={onChange} services={services} />
        </Labeled>
      )
    case 'list':
      return (
        <Labeled label={label} help={help}>
          <ListControl
            field={field}
            value={value}
            onChange={onChange}
            services={services}
            parent={values}
          />
        </Labeled>
      )
    case 'video':
      return (
        <Labeled label={label} help={help}>
          <VideoControl
            value={value}
            onChange={onChange}
            services={services}
            uploadOnly={field.uploadOnly === true}
          />
        </Labeled>
      )
    case 'product':
      return (
        <Labeled label={label} help={help}>
          <ProductControl
            value={typeof value === 'string' ? value : ''}
            onChange={onChange}
            services={services}
          />
        </Labeled>
      )
    case 'datetime':
      return (
        <Labeled label={label} help={help}>
          <DateTimeControl value={typeof value === 'string' ? value : ''} onChange={onChange} />
        </Labeled>
      )
    case 'table':
      return (
        <Labeled label={label} help={help}>
          <TableControl
            value={readTable({ value: value as JsonValue }, 'value')}
            onChange={onChange}
            maxColumns={field.maxColumns}
            maxRows={field.maxRows}
          />
        </Labeled>
      )
    case 'point':
      return (
        <Labeled label={label} help={help}>
          <PointControl
            value={readPoint({ value: value as JsonValue }, 'value')}
            onChange={onChange}
            imageId={readText(parent ?? values, field.imageKey)}
            services={services}
          />
        </Labeled>
      )
    case 'blocks':
      return (
        <Labeled label={label} help={help}>
          <BlocksControl field={field} value={value} onChange={onChange} services={services} />
        </Labeled>
      )
  }
}

/* -------------------------------------------------------------------------- */
/* Blocks                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The block tree the editor is working in: the whole section's fields and
 * settings, so a row can be moved between containers even when the list it
 * sits in only knows its own siblings. Provided by the builder around the
 * panel; a standalone list falls back to itself.
 */
interface BlockTree {
  fields: readonly FieldSpec[]
  values: FieldValues
  onChange: (values: FieldValues) => void
  /** Whether order, parents and removal may change — false on a linked copy. */
  editable: boolean
  /**
   * Whether this is a Custom blocks section, where a block opens its own panel.
   * Preset sections keep their inline accordion instead.
   */
  custom: boolean
}

/**
 * The block whose details the panel is showing. A row asks for its own block
 * to be opened; the panel then replaces this list with that block's settings,
 * the way the section list opens a section.
 */
interface BlockSelection {
  selectedId: string | null
  onSelect: (blockId: string) => void
}

const BlockTreeContext = createContext<BlockTree | null>(null)
const BlockSelectionContext = createContext<BlockSelection | null>(null)

/**
 * Hands the block fields in a panel the section's whole tree and the block
 * selection they act on. Without it a list still works, but can only reorder
 * its own siblings.
 */
export function BlockEditorProvider({
  fields,
  values,
  onChange,
  editable,
  custom,
  selectedId,
  onSelect,
  children,
}: {
  fields: readonly FieldSpec[]
  values: FieldValues
  onChange: (values: FieldValues) => void
  editable: boolean
  custom: boolean
  selectedId: string | null
  onSelect: (blockId: string) => void
  children: ReactNode
}) {
  const tree = useMemo(
    () => ({ fields, values, onChange, editable, custom }),
    [fields, values, onChange, editable, custom],
  )
  const selection = useMemo(() => ({ selectedId, onSelect }), [selectedId, onSelect])
  return (
    <BlockTreeContext.Provider value={tree}>
      <BlockSelectionContext.Provider value={selection}>{children}</BlockSelectionContext.Provider>
    </BlockTreeContext.Provider>
  )
}

/**
 * A pencil beside a block's title. It opens a small popover to give the block
 * an editor-only name, keeping the settings panel free of a permanent field.
 * Sections reuse it for the same — a Custom blocks section renamed like the
 * blocks inside it.
 */
export function BlockNamePopover({
  value,
  fallback,
  onChange,
  renameMessage = 'renameBlock',
  nameMessage = 'blockName',
}: {
  value: string
  /** The schema's own name, used as the placeholder. */
  fallback: string
  onChange: (name: string) => void
  /** Message keys for the trigger and the field, so sections reuse the popover. */
  renameMessage?: EditorMessage
  nameMessage?: EditorMessage
}) {
  const { t } = useEditorText()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)

  const save = () => {
    onChange(draft)
    setOpen(false)
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={({ open: next }) => {
        if (next) setDraft(value)
        setOpen(next)
      }}
      positioning={{ placement: 'bottom-start' }}
    >
      <Popover.Trigger asChild>
        <IconButton
          aria-label={t(renameMessage)}
          title={t(renameMessage)}
          size="2xs"
          variant="ghost"
          color="fg.muted"
          flexShrink="0"
        >
          <LuPencil />
        </IconButton>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content w="64" maxW="calc(100vw - 2rem)">
            <Popover.Body p="3">
              <Stack gap="2">
                <Input
                  size="sm"
                  autoFocus
                  value={draft}
                  maxLength={MAX_BLOCK_NAME}
                  placeholder={fallback}
                  aria-label={t(nameMessage)}
                  onChange={(event) => setDraft(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      save()
                    }
                  }}
                />
                <HStack justify="flex-end">
                  <Button size="xs" variant="ghost" onClick={() => setOpen(false)}>
                    {t('cancel')}
                  </Button>
                  <Button size="xs" colorPalette="brand" onClick={save}>
                    {t('save')}
                  </Button>
                </HStack>
              </Stack>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  )
}

/** The readable path to a container: "Highlighted cards › Column 2". */
function containerLabel(container: BlockContainer, l: (text: Localized) => string, top: string) {
  if (container.path.length === 0) return top
  const path = container.path
    .map((step) => {
      const name = step.block.name?.trim() || l(step.schema.name)
      // Two columns with the same schema name need a number to be told apart.
      return step.siblings > 1 ? `${name} ${step.ordinal}` : name
    })
    .join(' › ')
  return container.field.key === 'blocks' ? path : `${path} › ${l(container.field.label)}`
}

/**
 * "Move to" for one block: a menu of every container in its section — the
 * top level, then each column, row, grid or custom layout — with the current
 * parent marked and full or too-deep destinations disabled. The block moves
 * to the end of the chosen container; up/down then place it precisely.
 *
 * The trigger is an icon button in both places — a ghost one in a list row,
 * an outlined one beside the block's other actions — and stays, disabled,
 * when the block has nowhere else to go, so rows keep their shape instead of
 * shifting as the menu comes and goes.
 */
export function BlockMoveMenu({
  fields,
  values,
  blockId,
  onChange,
  compact = false,
}: {
  fields: readonly FieldSpec[]
  values: FieldValues
  blockId: string
  onChange: (values: FieldValues) => void
  /** A ghost button for a list row, instead of the outlined panel one. */
  compact?: boolean
}) {
  const { t, l } = useEditorText()
  const source = findBlock(fields, values, blockId)
  if (!source) return null

  const targets = blockContainers(fields, values).map((container) => {
    const current =
      source.parentId === container.parentId && source.field.key === container.fieldKey
    return {
      container,
      current,
      canMove: !current && canMoveBlockTo(fields, values, blockId, container),
      label: containerLabel(container, l, t('topLevel')),
    }
  })
  const disabled = targets.every((target) => !target.canMove)

  return (
    <Menu.Root
      onSelect={({ value }) => {
        const target = targets[Number(value)]
        if (!target || !target.canMove) return
        const next = moveBlockTo(fields, values, blockId, target.container)
        if (next) onChange(next)
      }}
    >
      <Menu.Trigger asChild>
        {compact ? (
          <IconButton
            aria-label={t('moveTo')}
            title={t('moveTo')}
            size="2xs"
            variant="ghost"
            disabled={disabled}
          >
            <LuFolderInput />
          </IconButton>
        ) : (
          <IconButton
            aria-label={t('moveTo')}
            title={t('moveTo')}
            size="xs"
            variant="outline"
            disabled={disabled}
          >
            <LuFolderInput />
          </IconButton>
        )}
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content maxH="72" overflowY="auto" minW="64">
            {targets.map((target, index) => (
              <Menu.Item
                key={`${target.container.parentId ?? ''}:${target.container.fieldKey}:${index}`}
                value={String(index)}
                disabled={!target.canMove}
              >
                <IconTile icon={LuFolderInput} size="sm" bg="bg.muted" color="fg" />
                <Stack gap="0" flex="1" minW="0" align="stretch">
                  <Text truncate fontSize="sm">
                    {target.label}
                  </Text>
                  <Text fontSize="2xs" color="fg.muted">
                    {target.container.count}/{target.container.field.max}
                  </Text>
                </Stack>
                {target.current && (
                  <Badge size="xs" colorPalette="brand" flexShrink="0">
                    {t('currentParent')}
                  </Badge>
                )}
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  )
}

/**
 * One block row: drag it to reorder, click it to open its own settings in the
 * panel. The row never expands in place, so drilling in never stacks several
 * levels of open forms on top of each other.
 */
function SortableBlockRow({
  block,
  schema,
  selected,
  onRemove,
}: {
  block: BlockValue
  schema: BlockSchema
  selected: boolean
  onRemove: () => void
}) {
  const { t, l } = useEditorText()
  const tree = useContext(BlockTreeContext)
  const selection = useContext(BlockSelectionContext)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  })
  const editable = tree?.editable !== false
  const label = block.name?.trim() || l(schema.name)
  // A block narrowed to one kind of screen is missing from the other's
  // preview; the row says so, the way a section's row does.
  const devices = readBlockDevices(block.style)
  const devicesIcon =
    devices === 'all' ? null : (
      <Icon
        as={devices === 'mobile' ? LuSmartphone : LuMonitor}
        boxSize="3.5"
        color="fg.muted"
        flexShrink="0"
        aria-label={t(devices === 'mobile' ? 'onlyMobile' : 'onlyDesktop')}
      />
    )

  return (
    <HStack
      ref={setNodeRef}
      data-block-row={block.id}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      gap="1"
      px="1.5"
      py="1"
      rounded="md"
      borderWidth="1px"
      borderColor={selected ? 'brand.solid' : 'border.subtle'}
      bg={isDragging ? 'bg.muted' : selected ? 'brand.subtle' : 'bg.panel'}
      zIndex={isDragging ? 1 : undefined}
    >
      {editable && (
        <IconButton
          aria-label={t('dragToReorder')}
          size="2xs"
          variant="ghost"
          cursor="grab"
          {...attributes}
          {...listeners}
        >
          <LuGripVertical />
        </IconButton>
      )}
      <Button
        variant="plain"
        size="sm"
        flex="1"
        minW="0"
        h="auto"
        px="1"
        py="1"
        justifyContent="start"
        gap="2"
        onClick={() => selection?.onSelect(block.id)}
      >
        <IconTile
          icon={blockGlyph(schema.type) ?? LuPlus}
          size="md"
          bg={selected ? 'bg.panel' : 'bg.muted'}
          color="fg.muted"
        />
        <Stack gap="0" minW="0" align="start" flex="1">
          <HStack gap="1.5" minW="0" maxW="full">
            <Text fontSize="sm" fontWeight="medium" truncate>
              {label}
            </Text>
            {devicesIcon}
          </HStack>
          {block.name?.trim() && (
            <Text fontSize="xs" color="fg.muted" fontWeight="normal" truncate maxW="full">
              {l(schema.name)}
            </Text>
          )}
        </Stack>
      </Button>
      {editable && tree && (
        <BlockMoveMenu
          fields={tree.fields}
          values={tree.values}
          blockId={block.id}
          onChange={tree.onChange}
          compact
        />
      )}
      {editable && (
        <IconButton
          aria-label={t('remove')}
          size="2xs"
          variant="ghost"
          colorPalette="danger"
          onClick={onRemove}
        >
          <LuTrash2 />
        </IconButton>
      )}
    </HStack>
  )
}

/**
 * A block row inside a preset section. Presets keep the original inline
 * accordion: the block's own fields open under the row, with arrows for the
 * order. Only a Custom blocks section gets the drill-in list above.
 */
function PresetBlockRow({
  block,
  schema,
  expanded,
  canMoveUp,
  canMoveDown,
  onToggle,
  onMoveUp,
  onMoveDown,
  onRemove,
  onChangeSettings,
  services,
}: {
  block: BlockValue
  schema: BlockSchema
  expanded: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onToggle: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
  onChangeSettings: (settings: FieldValues) => void
  services: EditorServices
}) {
  const { t, l } = useEditorText()
  const hasFields = schema.fields.length > 0
  // A block narrowed to one kind of screen is missing from the other's
  // preview; the row says so, the way a section's row does.
  const devices = readBlockDevices(block.style)
  const devicesIcon =
    devices === 'all' ? null : (
      <Icon
        as={devices === 'mobile' ? LuSmartphone : LuMonitor}
        boxSize="3.5"
        color="fg.muted"
        flexShrink="0"
        aria-label={t(devices === 'mobile' ? 'onlyMobile' : 'onlyDesktop')}
      />
    )

  return (
    <Collapsible.Root
      open={expanded}
      onOpenChange={({ open: next }) => {
        if (next !== expanded) onToggle()
      }}
    >
      <Box data-block-row={block.id} borderWidth="1px" borderColor="border.subtle" rounded="md">
        <HStack gap="1" px="2" py="1.5">
          {hasFields ? (
            <Collapsible.Trigger asChild>
              <Button variant="ghost" size="xs" flex="1" justifyContent="start" minW="0">
                <Icon as={expanded ? LuChevronDown : LuChevronRight} />
                <Text truncate>{l(schema.name)}</Text>
                {devicesIcon}
              </Button>
            </Collapsible.Trigger>
          ) : (
            // Nothing to set: a label, not a button that opens nothing.
            <HStack flex="1" minW="0" gap="1.5" px="2.5">
              <Text truncate fontSize="xs" fontWeight="medium">
                {l(schema.name)}
              </Text>
              {devicesIcon}
            </HStack>
          )}
          <IconButton
            aria-label={t('moveUp')}
            size="2xs"
            variant="ghost"
            disabled={!canMoveUp}
            onClick={onMoveUp}
          >
            <LuArrowUp />
          </IconButton>
          <IconButton
            aria-label={t('moveDown')}
            size="2xs"
            variant="ghost"
            disabled={!canMoveDown}
            onClick={onMoveDown}
          >
            <LuArrowDown />
          </IconButton>
          <IconButton
            aria-label={t('remove')}
            size="2xs"
            variant="ghost"
            colorPalette="danger"
            onClick={onRemove}
          >
            <LuTrash2 />
          </IconButton>
        </HStack>
        {hasFields && (
          <Collapsible.Content>
            <Stack gap="3" px="3" pb="3">
              <FieldsForm
                fields={schema.fields}
                values={block.settings}
                services={services}
                onChange={onChangeSettings}
              />
            </Stack>
          </Collapsible.Content>
        )}
      </Box>
    </Collapsible.Root>
  )
}

/**
 * The blocks inside a section: the seller's rows, in order. A row opens the
 * block's settings in the panel, like the section list opens a section; the
 * handle on its left reorders it among its siblings. The menu below adds a
 * block of any type that still fits.
 */
function BlocksControl({
  field,
  value,
  onChange,
  services,
}: {
  field: BlocksField
  value: unknown
  onChange: (blocks: BlockValue[]) => void
  services: EditorServices
}) {
  const { t, l } = useEditorText()
  const blocks = Array.isArray(value) ? (value as BlockValue[]) : []
  const [open, setOpen] = useState<string | null>(null)
  const [blockQuery, setBlockQuery] = useState('')
  const selection = useContext(BlockSelectionContext)
  // A nested list inherits the panel's whole tree; a standalone list can only
  // name its own siblings.
  const inherited = useContext(BlockTreeContext)
  const tree: BlockTree = inherited ?? {
    fields: [field],
    values: { [field.key]: blocks as unknown as JsonValue },
    onChange: (next) => onChange(readBlocks(next, field.key)),
    editable: true,
    custom: false,
  }
  const custom = tree.custom

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Rows slide to their new places on every reorder — see `SectionList`.
  const rowsRef = useRef<HTMLDivElement>(null)
  const rowRects = useRef<SectionRects>(new Map())
  const rowIndexes = useRef<Map<string, number>>(new Map())

  useLayoutEffect(() => {
    const ids = blocks.map((block) => block.id)
    rowRects.current = flipElements(rowsRef.current, ids, rowRects.current, {
      attribute: 'data-block-row',
      animate: orderMoved(ids, rowIndexes.current),
    })
    rowIndexes.current = new Map(ids.map((id, index) => [id, index]))
  }, [blocks])

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const from = blocks.findIndex((block) => block.id === active.id)
    const to = blocks.findIndex((block) => block.id === over.id)
    if (from < 0 || to < 0) return
    onChange(arrayMove(blocks, from, to))
  }

  function move(index: number, by: number) {
    const next = [...blocks]
    const [block] = next.splice(index, 1)
    next.splice(index + by, 0, block!)
    onChange(next)
  }

  const needle = blockQuery.trim().toLowerCase()
  const blockChoices = field.blocks.filter((schema) => {
    if (!needle) return true
    const haystack = `${l(schema.name)} ${schema.description ? l(schema.description) : ''}`
    return haystack.toLowerCase().includes(needle)
  })

  return (
    <BlockTreeContext.Provider value={tree}>
      <Stack ref={rowsRef} gap={custom ? '1.5' : '2'}>
        {custom ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={blocks.map((block) => block.id)}
              strategy={verticalListSortingStrategy}
            >
              {blocks.map((block) => {
                const schema = field.blocks.find((candidate) => candidate.type === block.type)
                if (!schema) return null
                return (
                  <SortableBlockRow
                    key={block.id}
                    block={block}
                    schema={schema}
                    selected={selection?.selectedId === block.id}
                    onRemove={() => onChange(blocks.filter((other) => other.id !== block.id))}
                  />
                )
              })}
            </SortableContext>
          </DndContext>
        ) : (
          blocks.map((block, index) => {
            const schema = field.blocks.find((candidate) => candidate.type === block.type)
            if (!schema) return null
            return (
              <PresetBlockRow
                key={block.id}
                block={block}
                schema={schema}
                expanded={open === block.id}
                canMoveUp={index > 0}
                canMoveDown={index < blocks.length - 1}
                onToggle={() => setOpen((current) => (current === block.id ? null : block.id))}
                onMoveUp={() => move(index, -1)}
                onMoveDown={() => move(index, 1)}
                onRemove={() => onChange(blocks.filter((other) => other.id !== block.id))}
                onChangeSettings={(settings) =>
                  onChange(
                    blocks.map((other) => (other.id === block.id ? { ...other, settings } : other)),
                  )
                }
                services={services}
              />
            )
          })
        )}
        {custom ? (
          <Menu.Root
            onOpenChange={({ open: next }) => {
              if (!next) setBlockQuery('')
            }}
            onSelect={({ value: type }) => {
              const block = createBlock(field, type)
              if (!block) return
              onChange([...blocks, block])
              // Open the new block straight away, as the old accordion did.
              selection?.onSelect(block.id)
            }}
            positioning={{ placement: 'bottom-start' }}
          >
            <Menu.Trigger asChild>
              <Button
                size="xs"
                variant="outline"
                alignSelf="start"
                disabled={!tree.editable || blocks.length >= field.max}
              >
                <Icon as={LuPlus} />
                {t('addBlock')}
              </Button>
            </Menu.Trigger>
            <Portal>
              <Menu.Positioner>
                <Menu.Content minW="64" maxH="72" overflowY="auto">
                  <Box position="sticky" top="0" zIndex="1" bg="bg.panel" px="2" pt="2" pb="1">
                    <InputGroup startElement={<Icon as={LuSearch} color="fg.subtle" />}>
                      <Input
                        size="xs"
                        autoFocus
                        placeholder={t('searchBlocks')}
                        value={blockQuery}
                        onChange={(event) => setBlockQuery(event.currentTarget.value)}
                        // The menu's own typeahead must not eat the letters;
                        // Escape, Tab and the arrow keys still reach the menu.
                        onKeyDown={(event) => {
                          if (
                            event.key !== 'Escape' &&
                            event.key !== 'Tab' &&
                            event.key !== 'ArrowDown' &&
                            event.key !== 'ArrowUp'
                          ) {
                            event.stopPropagation()
                          }
                        }}
                      />
                    </InputGroup>
                  </Box>
                  {blockChoices.map((schema) => (
                    <Menu.Item
                      key={schema.type}
                      value={schema.type}
                      disabled={!canAddBlock(field, blocks, schema.type)}
                    >
                      <IconTile
                        icon={blockGlyph(schema.type) ?? LuPlus}
                        size="sm"
                        bg="bg.muted"
                        color="fg"
                      />
                      <Text flex="1" minW="0" truncate>
                        {l(schema.name)}
                      </Text>
                      {schema.max === 1 && blocks.some((block) => block.type === schema.type) && (
                        <Badge size="xs" ml="auto">
                          ✓
                        </Badge>
                      )}
                    </Menu.Item>
                  ))}
                  {blockChoices.length === 0 && (
                    <Text px="2" py="3" fontSize="sm" color="fg.muted">
                      {t('noBlocksMatch')}
                    </Text>
                  )}
                </Menu.Content>
              </Menu.Positioner>
            </Portal>
          </Menu.Root>
        ) : (
          <Menu.Root
            onSelect={({ value: type }) => {
              const block = createBlock(field, type)
              if (!block) return
              onChange([...blocks, block])
              setOpen(block.id)
            }}
            positioning={{ placement: 'bottom-start' }}
          >
            <Menu.Trigger asChild>
              <Button
                size="xs"
                variant="outline"
                alignSelf="start"
                disabled={!tree.editable || blocks.length >= field.max}
              >
                <Icon as={LuPlus} />
                {t('addBlock')}
              </Button>
            </Menu.Trigger>
            <Portal>
              <Menu.Positioner>
                <Menu.Content>
                  {field.blocks.map((schema) => (
                    <Menu.Item
                      key={schema.type}
                      value={schema.type}
                      disabled={!canAddBlock(field, blocks, schema.type)}
                    >
                      {l(schema.name)}
                      {schema.max === 1 && blocks.some((block) => block.type === schema.type) && (
                        <Badge size="xs" ml="auto">
                          ✓
                        </Badge>
                      )}
                    </Menu.Item>
                  ))}
                </Menu.Content>
              </Menu.Positioner>
            </Portal>
          </Menu.Root>
        )}
      </Stack>
    </BlockTreeContext.Provider>
  )
}

export function FieldsForm({
  fields,
  values,
  onChange,
  services,
  parent,
}: {
  fields: readonly FieldSpec[]
  values: FieldValues
  onChange: (values: FieldValues) => void
  services: EditorServices
  /** The values these sit in, when they are a list item. */
  parent?: FieldValues
}) {
  // One handler per field for the form's life, reading the latest values
  // through a ref — so a keystroke in one field leaves every other field's
  // props as they were, and `MemoFieldControl` skips them.
  const latest = useRef({ values, onChange })
  latest.current = { values, onChange }
  const handlers = useRef(new Map<string, (value: unknown) => void>())
  const handlerFor = (key: string) => {
    let handler = handlers.current.get(key)
    if (!handler) {
      handler = (value) => {
        const { values: current, onChange: change } = latest.current
        change({ ...current, [key]: value as JsonValue })
      }
      handlers.current.set(key, handler)
    }
    return handler
  }

  return (
    <>
      {fields
        // `parent` is the settings a list item sits in, so an item's field can
        // follow the section's own choice (the quotes' look, a card's type).
        .filter((field) => isFieldShown(field, values, parent))
        .map((field) => (
          <MemoFieldControl
            key={field.key}
            field={field}
            value={values[field.key]}
            values={values}
            parent={parent}
            services={services}
            onChange={handlerFor(field.key)}
          />
        ))}
    </>
  )
}

/** Whether a control reads its siblings: a list (as their parent), or a field that reads a sibling image. */
function readsSiblings(field: FieldSpec): boolean {
  return field.kind === 'list' || 'imageKey' in field
}

/**
 * A field's control, drawn again only when its own value changes. The
 * settings panel holds a dozen of these — selects, switches, a rich-text
 * editor — and re-drawing all of them on every keystroke in one was what
 * made typing in the builder lag.
 */
const MemoFieldControl = memo(
  FieldControl,
  (before, after) =>
    before.field === after.field &&
    before.value === after.value &&
    before.onChange === after.onChange &&
    before.services === after.services &&
    before.parent === after.parent &&
    (!readsSiblings(after.field) || before.values === after.values),
)
