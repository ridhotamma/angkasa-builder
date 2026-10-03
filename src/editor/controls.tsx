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
  FileUpload,
  HStack,
  Icon,
  IconButton,
  Image,
  Input,
  Menu,
  NumberInput,
  parseColor,
  Portal,
  ScrollArea,
  Select,
  Spinner,
  Stack,
  Switch,
  Text,
  Textarea,
} from '@chakra-ui/react'
import { memo, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  LuArrowDown,
  LuArrowUp,
  LuChevronDown,
  LuChevronRight,
  LuImagePlus,
  LuPlus,
  LuTrash2,
} from 'react-icons/lu'

import {
  canAddBlock,
  createBlock,
  defaultValues,
  isFieldShown,
  newId,
  readPoint,
  readRichText,
  readTable,
  readText,
  type BlockValue,
  type BlocksField,
  type Field as FieldSpec,
  type FieldValues,
  type JsonValue,
  type ListField,
} from '../model/fields'
import { NO_LINK, type Link, type LinkKind } from '../model/links'
import {
  DateTimeControl,
  PointControl,
  ProductControl,
  TableControl,
  VideoControl,
} from './media-controls'
import { RichTextControl } from './rich-text-control'
import { useEditorText, type EditorMessage } from './messages'
import type { EditorServices } from './services'

export function Labeled({
  label,
  help,
  error,
  children,
}: {
  label: string
  help?: string
  error?: string | null
  children: ReactNode
}) {
  return (
    // `stretch`, not Chakra's default `flex-start`: a control inside a field —
    // a select, a link picker, a list — should be as wide as the panel, not
    // as wide as its current value.
    <Field.Root invalid={Boolean(error)} alignItems="stretch">
      <Field.Label fontSize="sm">{label}</Field.Label>
      {children}
      {error ? (
        <Field.ErrorText>{error}</Field.ErrorText>
      ) : (
        help && <Field.HelperText>{help}</Field.HelperText>
      )}
    </Field.Root>
  )
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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Bumped after every upload so the picker forgets the file it just took and
  // accepts the next one, rather than refusing it as one file too many.
  const [attempt, setAttempt] = useState(0)
  const src = value ? services.imageUrl(value, { width: 480, height: 320 }) : null

  async function upload(file: File) {
    setBusy(true)
    setError(null)
    try {
      onChange(await services.uploadImage(file))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
      setAttempt((n) => n + 1)
    }
  }

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
        {busy ? (
          <Spinner size="sm" />
        ) : src ? (
          <Image src={src} alt="" w="full" h="full" objectFit="cover" />
        ) : (
          <Text fontSize="xs" color="fg.muted">
            {t('noImage')}
          </Text>
        )}
      </Box>
      <HStack gap="2">
        <FileUpload.Root
          key={attempt}
          accept="image/*"
          maxFiles={1}
          disabled={busy}
          w="auto"
          onFileAccept={({ files }) => {
            const [file] = files
            if (file) void upload(file)
          }}
        >
          <FileUpload.HiddenInput />
          <FileUpload.Trigger asChild>
            <Button size="xs" variant="outline" loading={busy} loadingText={t('uploading')}>
              <Icon as={LuImagePlus} />
              {value ? t('replace') : t('upload')}
            </Button>
          </FileUpload.Trigger>
        </FileUpload.Root>
        {value && (
          <Button size="xs" variant="ghost" colorPalette="danger" onClick={() => onChange('')}>
            {t('remove')}
          </Button>
        )}
      </HStack>
      {error && (
        <Text fontSize="xs" color="danger.fg">
          {error}
        </Text>
      )}
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
  blog: 'linkBlog',
  article: 'linkArticle',
  search: 'linkSearch',
  url: 'linkUrl',
}

function emptyLink(kind: LinkKind): Link {
  switch (kind) {
    case 'none':
    case 'home':
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
    case 'url':
      return { kind, href: 'https://' }
  }
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
  const { t } = useEditorText()
  const link = value ?? NO_LINK

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
        options={(Object.keys(LINK_KIND_LABELS) as LinkKind[]).map((kind) => ({
          value: kind,
          label: t(LINK_KIND_LABELS[kind]),
        }))}
      />
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

  function move(index: number, by: number) {
    const next = [...items]
    const [item] = next.splice(index, 1)
    next.splice(index + by, 0, item!)
    onChange(next)
  }

  return (
    <Stack gap="2">
      {items.map((item, index) => {
        const voucherId = readText(item, 'voucherId')
        const itemVoucher = voucherId
          ? services.vouchers?.find((v) => v.id === voucherId)
          : undefined
        const title =
          readText(item, field.titleKey) ||
          (itemVoucher ? `${itemVoucher.code} — ${itemVoucher.name}` : '') ||
          `${l(field.itemLabel)} ${index + 1}`
        const expanded = open === item.id
        return (
          <Collapsible.Root
            key={item.id}
            open={expanded}
            onOpenChange={({ open: next }) => setOpen(next ? item.id : null)}
          >
            <Box borderWidth="1px" borderColor="border.subtle" rounded="md">
              <HStack gap="1" px="2" py="1.5">
                <Collapsible.Trigger asChild>
                  <Button variant="ghost" size="xs" flex="1" justifyContent="start" minW="0">
                    <Icon as={expanded ? LuChevronDown : LuChevronRight} />
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
  const { t, l } = useEditorText()
  const help = field.help ? l(field.help) : undefined
  const label = l(field.label)

  switch (field.kind) {
    case 'text':
      return (
        <Labeled label={label} help={help}>
          <Input
            size="sm"
            value={typeof value === 'string' ? value : ''}
            maxLength={field.max}
            placeholder={field.placeholder ? l(field.placeholder) : undefined}
            onChange={(event) => onChange(event.currentTarget.value)}
          />
        </Labeled>
      )
    case 'richtext':
      return (
        <Labeled label={label} help={help}>
          <RichTextControl
            value={readRichText({ value: value as JsonValue }, 'value')}
            onChange={onChange}
          />
        </Labeled>
      )
    case 'textarea':
      return (
        <Labeled label={label} help={help}>
          <Textarea
            size="sm"
            rows={field.rows ?? 4}
            value={typeof value === 'string' ? value : ''}
            maxLength={field.max}
            onChange={(event) => onChange(event.currentTarget.value)}
          />
        </Labeled>
      )
    case 'number':
      return (
        <Labeled label={label} help={help}>
          <NumberControl
            value={typeof value === 'number' ? value : field.default}
            min={field.min}
            max={field.max}
            step={field.step}
            onChange={onChange}
          />
        </Labeled>
      )
    case 'select':
      return (
        <Labeled label={label} help={help}>
          <SelectInput
            value={typeof value === 'string' ? value : field.default}
            onChange={onChange}
            options={field.options.map((option) => ({
              value: option.value,
              label: l(option.label),
            }))}
          />
        </Labeled>
      )
    case 'boolean':
      return (
        <Field.Root>
          <HStack justify="space-between" w="full" align="flex-start" gap="4">
            <Box>
              <Field.Label fontSize="sm">{label}</Field.Label>
              {help && <Field.HelperText>{help}</Field.HelperText>}
            </Box>
            <Switch.Root
              size="sm"
              colorPalette="brand"
              checked={value === true}
              onCheckedChange={({ checked }) => onChange(checked)}
            >
              <Switch.HiddenInput />
              <Switch.Control />
            </Switch.Root>
          </HStack>
        </Field.Root>
      )
    case 'color':
      return (
        <Labeled label={label} help={help}>
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
 * The blocks inside a section: reorderable rows, each opening its own
 * settings, and a menu of the block types that still fit.
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

  function move(index: number, by: number) {
    const next = [...blocks]
    const [block] = next.splice(index, 1)
    next.splice(index + by, 0, block!)
    onChange(next)
  }

  return (
    <Stack gap="1.5">
      {blocks.map((block, index) => {
        const schema = field.blocks.find((candidate) => candidate.type === block.type)
        if (!schema) return null
        const hasFields = schema.fields.length > 0
        const expanded = open === block.id && hasFields
        return (
          <Collapsible.Root
            key={block.id}
            open={expanded}
            onOpenChange={({ open: next }) => setOpen(next ? block.id : null)}
          >
            <Box
              borderWidth="1px"
              borderColor={expanded ? 'brand.muted' : 'border.subtle'}
              rounded="md"
            >
              <HStack gap="1" px="2" py="1">
                {hasFields ? (
                  <Collapsible.Trigger asChild>
                    <Button variant="ghost" size="xs" flex="1" justifyContent="start" minW="0">
                      <Icon as={expanded ? LuChevronDown : LuChevronRight} />
                      <Text truncate>{l(schema.name)}</Text>
                    </Button>
                  </Collapsible.Trigger>
                ) : (
                  // Nothing to set: a label, not a button that opens nothing.
                  <Text flex="1" minW="0" truncate fontSize="xs" fontWeight="medium" px="2.5">
                    {l(schema.name)}
                  </Text>
                )}
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
                  disabled={index === blocks.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <LuArrowDown />
                </IconButton>
                <IconButton
                  aria-label={t('remove')}
                  size="2xs"
                  variant="ghost"
                  colorPalette="danger"
                  onClick={() => onChange(blocks.filter((other) => other.id !== block.id))}
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
                      onChange={(settings) =>
                        onChange(
                          blocks.map((other) =>
                            other.id === block.id ? { ...other, settings } : other,
                          ),
                        )
                      }
                    />
                  </Stack>
                </Collapsible.Content>
              )}
            </Box>
          </Collapsible.Root>
        )
      })}
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
            disabled={blocks.length >= field.max}
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
    </Stack>
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
        .filter((field) => isFieldShown(field, values))
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
