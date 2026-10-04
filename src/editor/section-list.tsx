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

import { Badge, Box, Button, HStack, Icon, IconButton, Stack, Text } from '@chakra-ui/react'
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
  LuCopy,
  LuEye,
  LuEyeOff,
  LuGripVertical,
  LuLink,
  LuLock,
  LuMonitor,
  LuPlus,
  LuSmartphone,
  LuTrash2,
} from 'react-icons/lu'

import { Tooltip } from '@repo/theme'

import {
  canDuplicateSection,
  createSection,
  duplicateLinkedSection,
  duplicateSection,
  MAX_SECTIONS,
  removeSection,
  sanitizeSections,
  type SectionInstance,
} from '../model/content'
import { newId, readText } from '../model/fields'
import { localize } from '../model/localized'
import { readSectionStyle, SCHEDULE_LABELS, scheduleState } from '../model/section-style'
import { sectionSchema, type SectionScope } from '../model/sections'
import { AddPalette, type PaletteBlock } from './add-palette'
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
      {section.linkedTo && (
        <Badge size="xs" variant="subtle" colorPalette="brand">
          {t('linkedBadge')}
        </Badge>
      )}
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
  onLinkedCopy,
  onCopy,
  onRemove,
  canDuplicate,
}: {
  section: SectionInstance
  selected: boolean
  onSelect: () => void
  onToggleHidden: () => void
  onDuplicate: () => void
  onLinkedCopy: () => void
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
          aria-label={t('linkedCopy')}
          size="2xs"
          variant="ghost"
          disabled={!canDuplicate}
          onClick={onLinkedCopy}
        >
          <LuLink />
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
  const { t, l } = useEditorText()
  const [adding, setAdding] = useState(false)
  const [copied, setCopied] = useState<SectionInstance | null>(null)
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
    // Added, not selected: the detail panel opens when the seller clicks the
    // section, so the palette stays open for the next item.
    onChange(next)
  }

  // The palette takes over the panel while it is open, so dragging from it
  // into the preview never has to share space with the section list.
  if (adding) {
    return (
      <AddPalette
        scope={scope}
        counts={counts}
        copiedLabel={copied ? l(sectionSchema(copied.type)!.name) : null}
        onClearCopied={() => {
          clearClipboard()
          setCopied(null)
        }}
        onAddSection={(type, preset) =>
          insert(createSection(type, preset?.settings, preset?.style))
        }
        onAddBlocks={(blocks: readonly PaletteBlock[]) =>
          insert(createSection('custom', { blocks }))
        }
        onPaste={() => {
          if (!copied) return
          const schema = sectionSchema(copied.type)
          if (schema?.max !== undefined && (counts.get(copied.type) ?? 0) >= schema.max) return
          insert({ ...copied, id: newId() })
        }}
        onClose={() => setAdding(false)}
      />
    )
  }

  return (
    <Stack gap="3">
      <Button
        size="sm"
        variant="outline"
        w="full"
        disabled={full}
        onClick={() => {
          setCopied(readClipboard(scope))
          setAdding(true)
        }}
      >
        <Icon as={LuPlus} />
        {t('addSection')}
      </Button>
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
                  onLinkedCopy={() => {
                    const result = duplicateLinkedSection(sections, section.id)
                    if (result) onChange(result.sections)
                  }}
                  onCopy={() => {
                    if (writeClipboard(section)) onNotice?.(t('sectionCopied'))
                  }}
                  onRemove={() => onChange(removeSection(sections, section.id))}
                />
              ))}
            </Stack>
          </SortableContext>
        </DndContext>
      )}
      {after}
    </Stack>
  )
}
