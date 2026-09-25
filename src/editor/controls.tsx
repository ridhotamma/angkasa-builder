/**
 * One control per field kind, generated from a section's schema.
 *
 * Controlled and form-library-free on purpose: the editor's whole document is
 * one value held by the screen, every keystroke replaces it, and the preview
 * re-renders from it. A form library would add a second copy of the state to
 * keep in step for no gain.
 */

import {
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
import { useMemo, useState, type ReactNode } from 'react'
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
  defaultValues,
  isFieldShown,
  newId,
  readRichText,
  readText,
  type Field as FieldSpec,
  type FieldValues,
  type JsonValue,
  type ListField,
} from '../model/fields'
import { NO_LINK, type Link, type LinkKind } from '../model/links'
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

const LINK_KIND_LABELS: Record<LinkKind, EditorMessage> = {
  none: 'linkNone',
  home: 'linkHome',
  page: 'linkPage',
  product: 'linkProduct',
  collection: 'linkCollection',
  category: 'linkCategory',
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
    case 'search':
      return { kind, query: '' }
    case 'url':
      return { kind, href: 'https://' }
  }
}

function LinkControl({
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
    link.kind === 'collection'
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
        <SelectInput
          value={link.slug}
          placeholder={t('choose')}
          clearable
          onChange={(slug) => onChange({ ...link, slug })}
          options={slugOptions.map((option) => ({ value: option.slug, label: option.name }))}
        />
      )}
      {link.kind === 'product' && (
        <Input
          size="sm"
          placeholder={t('productSlug')}
          value={link.slug}
          onChange={(event) =>
            onChange({ kind: 'product', slug: event.currentTarget.value.trim().toLowerCase() })
          }
        />
      )}
      {link.kind === 'search' && (
        <Input
          size="sm"
          placeholder={t('searchQuery')}
          value={link.query}
          maxLength={120}
          onChange={(event) => onChange({ kind: 'search', query: event.currentTarget.value })}
        />
      )}
      {link.kind === 'url' && (
        <Stack gap="1">
          <Input
            size="sm"
            type="url"
            value={link.href}
            maxLength={2000}
            onChange={(event) => onChange({ kind: 'url', href: event.currentTarget.value.trim() })}
          />
          <Text fontSize="xs" color="fg.muted">
            {t('urlHelp')}
          </Text>
        </Stack>
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
}: {
  field: ListField
  value: unknown
  onChange: (items: FieldValues[]) => void
  services: EditorServices
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
        const title = readText(item, field.titleKey) || `${l(field.itemLabel)} ${index + 1}`
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

/**
 * Chakra's `ColorPicker`, in hex. Opaque only: stored colours have no alpha,
 * and `toString('hex')` keeps them in the `#rrggbb` shape both the theme and
 * the section sanitisers accept.
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
  const color = useMemo(() => parseColor(value), [value])

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
}: {
  field: FieldSpec
  value: unknown
  onChange: (value: unknown) => void
  services: EditorServices
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
    case 'category': {
      const options = field.kind === 'collection' ? services.collections : services.categories
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
          <ListControl field={field} value={value} onChange={onChange} services={services} />
        </Labeled>
      )
  }
}

export function FieldsForm({
  fields,
  values,
  onChange,
  services,
}: {
  fields: readonly FieldSpec[]
  values: FieldValues
  onChange: (values: FieldValues) => void
  services: EditorServices
}) {
  return (
    <>
      {fields
        .filter((field) => isFieldShown(field, values))
        .map((field) => (
          <FieldControl
            key={field.key}
            field={field}
            value={values[field.key]}
            services={services}
            onChange={(value) => onChange({ ...values, [field.key]: value as JsonValue })}
          />
        ))}
    </>
  )
}
