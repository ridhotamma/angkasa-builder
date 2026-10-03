/**
 * The ordered list of sections, and the picker that adds one.
 *
 * Reordering is drag-and-drop with a keyboard fallback (dnd-kit's keyboard
 * sensor: focus the handle, space, arrows, space). Every change is a new
 * array handed up — nothing here holds its own copy of the order.
 *
 * A theme's header and footer are pinned above and below the list: always
 * there, never moved or removed, but picked like any section to edit them.
 */

import {
  Badge,
  Box,
  Button,
  CloseButton,
  Dialog,
  HStack,
  Icon,
  IconButton,
  Input,
  InputGroup,
  Portal,
  SimpleGrid,
  Stack,
  Text,
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
import { useMemo, useState, type ReactNode } from 'react'
import {
  LuClipboardCopy,
  LuClipboardPaste,
  LuCopy,
  LuEye,
  LuEyeOff,
  LuGripVertical,
  LuLock,
  LuMonitor,
  LuPlus,
  LuSearch,
  LuSmartphone,
  LuTrash2,
  LuX,
} from 'react-icons/lu'

import { Tooltip } from '@repo/theme'

import {
  canDuplicateSection,
  createSection,
  duplicateSection,
  MAX_SECTIONS,
  sanitizeSections,
  type SectionInstance,
} from '../model/content'
import { newId, readText } from '../model/fields'
import { localize } from '../model/localized'
import { readSectionStyle, SCHEDULE_LABELS, scheduleState } from '../model/section-style'
import {
  isSectionOffered,
  offeredPresets,
  SECTION_CATEGORIES,
  SECTION_CATEGORY_LABELS,
  SECTION_SCHEMAS,
  sectionSchema,
  type SectionPreset,
  type SectionSchema,
  type SectionScope,
  type SectionType,
} from '../model/sections'
import { useEditorText } from './messages'
import { sectionIcon } from './section-icons'

/* -------------------------------------------------------------------------- */
/* Clipboard                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * One copied section, kept in this browser so it can be pasted into another
 * page or theme. Local storage, so it survives moving between editors; read
 * back through the sanitiser like any stored layout, and it may simply be
 * missing (a private window) — pasting is then just not offered.
 */
const CLIPBOARD_KEY = 'pesanle.page-builder.clipboard'

function readClipboard(scope: SectionScope): SectionInstance | null {
  try {
    const raw = window.localStorage.getItem(CLIPBOARD_KEY)
    if (!raw) return null
    const [section] = sanitizeSections([JSON.parse(raw)], scope)
    return section ?? null
  } catch {
    return null
  }
}

function clearClipboard() {
  try {
    window.localStorage.removeItem(CLIPBOARD_KEY)
  } catch {
    // Storage unavailable: there was nothing kept to clear.
  }
}

function writeClipboard(section: SectionInstance): boolean {
  try {
    window.localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(section))
    return true
  } catch {
    return false
  }
}

/** A section's icon on a small tile, as in the add-section dialog. */
function IconTile({ icon, selected }: { icon: string; selected: boolean }) {
  return (
    <Box
      boxSize="8"
      rounded="md"
      bg={selected ? 'bg.panel' : 'bg.muted'}
      color="fg.muted"
      display="flex"
      alignItems="center"
      justifyContent="center"
      flexShrink="0"
    >
      <Icon as={sectionIcon(icon)} boxSize="4" />
    </Box>
  )
}

/* -------------------------------------------------------------------------- */
/* Rows                                                                       */
/* -------------------------------------------------------------------------- */

/** What the row says under the section's name: its heading, when it has one. */
function rowDetail(section: SectionInstance): string {
  return readText(section.settings, 'heading') || readText(section.settings, 'text')
}

function RowBadges({ section }: { section: SectionInstance }) {
  const { t, locale } = useEditorText()
  const style = readSectionStyle(section.style)
  const schedule = scheduleState(style, new Date())
  return (
    <>
      {section.hidden && (
        <Badge size="xs" variant="subtle">
          {t('hidden')}
        </Badge>
      )}
      {style.visibility !== 'all' && (
        <Icon
          as={style.visibility === 'mobile' ? LuSmartphone : LuMonitor}
          boxSize="3.5"
          color="fg.muted"
          aria-label={t(style.visibility === 'mobile' ? 'onlyMobile' : 'onlyDesktop')}
        />
      )}
      {schedule !== 'always' && (
        <Badge
          size="xs"
          variant="subtle"
          colorPalette={schedule === 'live' ? 'green' : schedule === 'scheduled' ? 'blue' : 'gray'}
        >
          {localize(SCHEDULE_LABELS[schedule], locale)}
        </Badge>
      )}
    </>
  )
}

function Row({
  section,
  selected,
  onSelect,
  onToggleHidden,
  onDuplicate,
  onCopy,
  onRemove,
  canDuplicate,
}: {
  section: SectionInstance
  selected: boolean
  onSelect: () => void
  onToggleHidden: () => void
  onDuplicate: () => void
  onCopy: () => void
  onRemove: () => void
  canDuplicate: boolean
}) {
  const { t, l } = useEditorText()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  })
  const schema = sectionSchema(section.type)
  const detail = rowDetail(section)
  const required = schema?.required === true

  return (
    <HStack
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      gap="1"
      px="1.5"
      py="1"
      rounded="md"
      borderWidth="1px"
      borderColor={selected ? 'brand.solid' : 'border.subtle'}
      bg={isDragging ? 'bg.muted' : selected ? 'brand.subtle' : 'bg.panel'}
      zIndex={isDragging ? 1 : undefined}
      opacity={section.hidden ? 0.6 : 1}
      className="group"
    >
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
        onClick={onSelect}
      >
        <IconTile icon={schema?.icon ?? ''} selected={selected} />
        <Stack gap="0" minW="0" align="start" flex="1">
          <HStack gap="1.5" minW="0" maxW="full">
            <Text fontSize="sm" fontWeight="medium" truncate>
              {schema ? l(schema.name) : section.type}
            </Text>
            <RowBadges section={section} />
          </HStack>
          {detail && (
            <Text fontSize="xs" color="fg.muted" fontWeight="normal" truncate maxW="full">
              {detail}
            </Text>
          )}
        </Stack>
      </Button>
      <IconButton
        aria-label={section.hidden ? t('show') : t('hide')}
        size="2xs"
        variant="ghost"
        onClick={onToggleHidden}
      >
        {section.hidden ? <LuEyeOff /> : <LuEye />}
      </IconButton>
      {/* The rarer actions appear on hover or focus, so the list stays calm. */}
      <HStack
        gap="0"
        opacity={{ base: 1, lg: 0 }}
        _groupHover={{ opacity: 1 }}
        _groupFocusWithin={{ opacity: 1 }}
      >
        <IconButton aria-label={t('copySection')} size="2xs" variant="ghost" onClick={onCopy}>
          <LuClipboardCopy />
        </IconButton>
        <IconButton
          aria-label={t('duplicate')}
          size="2xs"
          variant="ghost"
          disabled={!canDuplicate}
          onClick={onDuplicate}
        >
          <LuCopy />
        </IconButton>
        {required ? (
          <Tooltip content={t('required')} wrap>
            <IconButton aria-label={t('required')} size="2xs" variant="ghost" disabled>
              <LuLock />
            </IconButton>
          </Tooltip>
        ) : (
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
    </HStack>
  )
}

/** The header or footer: in the list, not of it. */
export function PinnedRow({
  icon,
  label,
  detail,
  selected,
  onSelect,
}: {
  icon: string
  label: string
  detail?: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <Button
      variant="plain"
      h="auto"
      px="3"
      py="2"
      rounded="md"
      borderWidth="1px"
      borderStyle="dashed"
      borderColor={selected ? 'brand.solid' : 'border'}
      bg={selected ? 'brand.subtle' : 'bg.subtle'}
      justifyContent="start"
      gap="2"
      onClick={onSelect}
    >
      <IconTile icon={icon} selected={selected} />
      <Stack gap="0" align="start" minW="0">
        <Text fontSize="sm" fontWeight="medium">
          {label}
        </Text>
        {detail && (
          <Text fontSize="xs" color="fg.muted" fontWeight="normal" truncate maxW="full">
            {detail}
          </Text>
        )}
      </Stack>
    </Button>
  )
}

/* -------------------------------------------------------------------------- */
/* Picker                                                                     */
/* -------------------------------------------------------------------------- */

interface PickerEntry {
  key: string
  schema: SectionSchema
  preset: SectionPreset | null
  name: string
  description: string
}

/**
 * Every section this page can hold, by category, with the ready-made
 * variants beside the plain ones and a search across both.
 */
function AddSectionDialog({
  scope,
  counts,
  disabled,
  onAdd,
  onPaste,
}: {
  scope: SectionScope
  counts: Map<string, number>
  disabled: boolean
  onAdd: (type: SectionType, preset: SectionPreset | null) => void
  onPaste: (section: SectionInstance) => void
}) {
  const { t, l } = useEditorText()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState<SectionInstance | null>(null)

  const entries = useMemo(() => {
    const out: PickerEntry[] = []
    for (const schema of SECTION_SCHEMAS as readonly SectionSchema[]) {
      if (!isSectionOffered(schema, scope)) continue
      out.push({
        key: schema.type,
        schema,
        preset: null,
        name: l(schema.name),
        description: l(schema.description),
      })
      for (const preset of offeredPresets(schema)) {
        out.push({
          key: `${schema.type}:${preset.key}`,
          schema,
          preset,
          name: l(preset.name),
          description: l(preset.description),
        })
      }
    }
    return out
  }, [scope, l])

  const needle = query.trim().toLowerCase()
  const shown = needle
    ? entries.filter((entry) => `${entry.name} ${entry.description}`.toLowerCase().includes(needle))
    : entries

  const full = (schema: SectionSchema) =>
    schema.max !== undefined && (counts.get(schema.type) ?? 0) >= schema.max

  return (
    <Dialog.Root
      open={open}
      onOpenChange={({ open: next }) => {
        setOpen(next)
        if (next) {
          setQuery('')
          setCopied(readClipboard(scope))
        }
      }}
      size="lg"
      scrollBehavior="inside"
    >
      <Dialog.Trigger asChild>
        <Button size="sm" variant="outline" w="full" disabled={disabled}>
          <Icon as={LuPlus} />
          {t('addSection')}
        </Button>
      </Dialog.Trigger>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxH="min(44rem, calc(100dvh - 4rem))">
            <Dialog.Header flexDirection="column" alignItems="stretch" gap="3">
              <Dialog.Title>{t('addSection')}</Dialog.Title>
              <InputGroup startElement={<Icon as={LuSearch} color="fg.subtle" />}>
                <Input
                  size="sm"
                  autoFocus
                  placeholder={t('searchSections')}
                  value={query}
                  onChange={(event) => setQuery(event.currentTarget.value)}
                />
              </InputGroup>
              {/* The copy stays after pasting, like a clipboard, so it can go on
                  several pages; the cross forgets it. */}
              {copied && (
                <HStack gap="1">
                  <Button
                    size="sm"
                    variant="subtle"
                    colorPalette="brand"
                    justifyContent="start"
                    flex="1"
                    minW="0"
                    onClick={() => {
                      onPaste(copied)
                      setOpen(false)
                    }}
                  >
                    <LuClipboardPaste />
                    <Text truncate>
                      {t('pasteSection')} — {l(sectionSchema(copied.type)!.name)}
                    </Text>
                  </Button>
                  <Tooltip content={t('clearCopied')}>
                    <IconButton
                      aria-label={t('clearCopied')}
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        clearClipboard()
                        setCopied(null)
                      }}
                    >
                      <LuX />
                    </IconButton>
                  </Tooltip>
                </HStack>
              )}
            </Dialog.Header>
            <Dialog.Body pt="0">
              {shown.length === 0 ? (
                <Text fontSize="sm" color="fg.muted" py="6" textAlign="center">
                  {t('noSectionsMatch')}
                </Text>
              ) : (
                <Stack gap="5">
                  {SECTION_CATEGORIES.map((category) => {
                    const inCategory = shown.filter((entry) => entry.schema.category === category)
                    if (inCategory.length === 0) return null
                    return (
                      <Stack key={category} gap="2">
                        <Text
                          fontSize="xs"
                          fontWeight="semibold"
                          textTransform="uppercase"
                          letterSpacing="wide"
                          color="fg.muted"
                        >
                          {l(SECTION_CATEGORY_LABELS[category])}
                        </Text>
                        <SimpleGrid columns={{ base: 1, sm: 2 }} gap="2">
                          {inCategory.map((entry) => (
                            <Button
                              key={entry.key}
                              variant="outline"
                              h="auto"
                              p="3"
                              justifyContent="start"
                              alignItems="start"
                              textAlign="left"
                              whiteSpace="normal"
                              gap="3"
                              disabled={full(entry.schema)}
                              onClick={() => {
                                onAdd(entry.schema.type as SectionType, entry.preset)
                                setOpen(false)
                              }}
                            >
                              <Box
                                boxSize="9"
                                rounded="md"
                                bg={entry.preset ? 'brand.subtle' : 'bg.muted'}
                                color={entry.preset ? 'brand.fg' : 'fg.muted'}
                                display="flex"
                                alignItems="center"
                                justifyContent="center"
                                flexShrink="0"
                              >
                                <Icon as={sectionIcon(entry.schema.icon)} boxSize="4.5" />
                              </Box>
                              {/* The badge goes under the description, not beside
                                  the name, so a long name keeps the card's width. */}
                              <Stack gap="0.5" minW="0" flex="1" align="start">
                                <Text fontSize="sm" fontWeight="medium">
                                  {entry.name}
                                </Text>
                                <Text
                                  fontSize="xs"
                                  color="fg.muted"
                                  fontWeight="normal"
                                  lineHeight="short"
                                >
                                  {entry.description}
                                </Text>
                                {entry.preset && (
                                  <Badge size="xs" colorPalette="brand" variant="subtle" mt="1">
                                    {t('preset')}
                                  </Badge>
                                )}
                              </Stack>
                            </Button>
                          ))}
                        </SimpleGrid>
                      </Stack>
                    )
                  })}
                </Stack>
              )}
            </Dialog.Body>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}

/* -------------------------------------------------------------------------- */
/* The list                                                                   */
/* -------------------------------------------------------------------------- */

export function SectionList({
  sections,
  onChange,
  selectedId,
  onSelect,
  scope = 'home',
  before,
  after,
  onNotice,
}: {
  sections: SectionInstance[]
  onChange: (sections: SectionInstance[]) => void
  selectedId: string | null
  onSelect: (id: string) => void
  /** Which page the list is for; decides which sections can be added. */
  scope?: SectionScope
  /** Pinned above the sections — a theme's header. */
  before?: ReactNode
  /** Pinned below them — a theme's footer. */
  after?: ReactNode
  /** Says something short to the seller, e.g. that a section was copied. */
  onNotice?: (message: string) => void
}) {
  const { t } = useEditorText()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const full = sections.length >= MAX_SECTIONS
  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const section of sections) map.set(section.type, (map.get(section.type) ?? 0) + 1)
    return map
  }, [sections])

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const from = sections.findIndex((section) => section.id === active.id)
    const to = sections.findIndex((section) => section.id === over.id)
    if (from < 0 || to < 0) return
    onChange(arrayMove(sections, from, to))
  }

  function insert(section: SectionInstance) {
    const at = selectedId
      ? sections.findIndex((other) => other.id === selectedId) + 1
      : sections.length
    const next = [...sections]
    next.splice(at > 0 ? at : sections.length, 0, section)
    onChange(next)
    onSelect(section.id)
  }

  return (
    <Stack gap="3">
      {before}
      {sections.length === 0 ? (
        <Text fontSize="sm" color="fg.muted">
          {t('noSections')}
        </Text>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sections.map((section) => section.id)}
            strategy={verticalListSortingStrategy}
          >
            <Stack gap="1.5">
              {sections.map((section) => (
                <Row
                  key={section.id}
                  section={section}
                  selected={section.id === selectedId}
                  canDuplicate={canDuplicateSection(sections, section.id)}
                  onSelect={() => onSelect(section.id)}
                  onToggleHidden={() =>
                    onChange(
                      sections.map((other) =>
                        other.id === section.id ? { ...other, hidden: !other.hidden } : other,
                      ),
                    )
                  }
                  onDuplicate={() => {
                    const result = duplicateSection(sections, section.id)
                    if (result) onChange(result.sections)
                  }}
                  onCopy={() => {
                    if (writeClipboard(section)) onNotice?.(t('sectionCopied'))
                  }}
                  onRemove={() => onChange(sections.filter((other) => other.id !== section.id))}
                />
              ))}
            </Stack>
          </SortableContext>
        </DndContext>
      )}
      <AddSectionDialog
        scope={scope}
        counts={counts}
        disabled={full}
        onAdd={(type, preset) => insert(createSection(type, preset?.settings, preset?.style))}
        onPaste={(section) => {
          const schema = sectionSchema(section.type)
          if (schema?.max !== undefined && (counts.get(section.type) ?? 0) >= schema.max) return
          insert({ ...section, id: newId() })
        }}
      />
      {after}
    </Stack>
  )
}
