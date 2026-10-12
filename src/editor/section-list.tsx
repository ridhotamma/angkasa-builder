/**
 * The page's outline: every section in order, and the palette that adds one.
 *
 * Reordering is drag-and-drop with a keyboard fallback (dnd-kit's keyboard
 * sensor: focus the handle, space, arrows, space). Every change is a new
 * array handed up — nothing here holds its own copy of the order.
 *
 * A row stays quiet until it is pointed at: the drag handle, the eye and the
 * "⋯" menu (copy, duplicate, remove) appear on hover or focus. A hidden
 * section keeps its eye showing, so it reads as hidden at a glance.
 *
 * Fixed rows — a theme's header and footer, a frame's details, the theme
 * settings — are `SidebarRow`s: picked like a section, never moved or removed.
 */

import { Badge, Box, Button, Flex, HStack, Icon, IconButton, Menu, Portal, Stack, Text } from '@chakra-ui/react'
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
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { IconType } from 'react-icons'
import {
  LuChevronRight,
  LuClipboardCopy,
  LuCopy,
  LuEllipsis,
  LuEye,
  LuEyeOff,
  LuGripVertical,
  LuLink,
  LuMonitor,
  LuPlus,
  LuSmartphone,
  LuTrash2,
} from 'react-icons/lu'

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
import { createStarterSection } from '../model/section-starters'
import { newId, readText } from '../model/fields'
import { localize } from '../model/localized'
import { readSectionStyle, SCHEDULE_LABELS, scheduleState } from '../model/section-style'
import { sectionSchema, type SectionScope } from '../model/sections'
import { AddPalette, type PaletteBlock } from './add-palette'
import { SECTION_LINKING_ENABLED } from './features'
import { useEditorText } from './messages'
import { flipElements, orderMoved, type SectionRects } from './reorder-flip'
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

/* -------------------------------------------------------------------------- */
/* Rows                                                                       */
/* -------------------------------------------------------------------------- */

/** The row's look, shared by sections and fixed rows so the list reads as one. */
const ROW_STYLE = {
  gap: '1',
  minH: '10',
  px: '1',
  rounded: 'md',
  className: 'group',
} as const

function rowColors(selected: boolean) {
  return {
    bg: selected ? 'colorPalette.subtle' : 'transparent',
    color: selected ? 'colorPalette.fg' : 'fg',
    _hover: { bg: selected ? 'colorPalette.subtle' : 'bg.muted' },
    colorPalette: 'brand',
  } as const
}

/** Appears with the row's hover or focus; always shown on a touch screen. */
const ON_HOVER = {
  opacity: { base: 1, lg: 0 },
  _groupHover: { opacity: 1 },
  _groupFocusWithin: { opacity: 1 },
} as const

/** The row's label: an icon, the name and, under it, what tells it apart. */
function RowLabel({
  icon,
  label,
  detail,
  badges,
  onSelect,
}: {
  icon: IconType
  label: string
  detail?: string
  badges?: ReactNode
  onSelect: () => void
}) {
  return (
    <Button
      variant="plain"
      size="sm"
      flex="1"
      minW="0"
      h="auto"
      px="1"
      py="1.5"
      justifyContent="start"
      gap="2.5"
      color="inherit"
      fontWeight="normal"
      onClick={onSelect}
    >
      <Icon as={icon} boxSize="4" flexShrink="0" opacity="0.7" />
      <Stack gap="0" minW="0" align="start" flex="1">
        <HStack gap="1.5" minW="0" maxW="full">
          <Text fontSize="sm" fontWeight="medium" truncate>
            {label}
          </Text>
          {badges}
        </HStack>
        {detail && (
          <Text fontSize="xs" color="fg.muted" truncate maxW="full">
            {detail}
          </Text>
        )}
      </Stack>
    </Button>
  )
}

/**
 * A row that is picked but never moved: a theme's header or footer, a
 * frame's details, the theme settings. `chevron` marks a row that opens a
 * page of its own rather than a part of the preview.
 */
export function SidebarRow({
  icon,
  label,
  detail,
  selected,
  chevron,
  onSelect,
}: {
  icon: IconType
  label: string
  detail?: string
  selected: boolean
  chevron?: boolean
  onSelect: () => void
}) {
  return (
    <HStack {...ROW_STYLE} {...rowColors(selected)}>
      {/* Lines the icon up with the sections' icons, past their drag handle. */}
      <Box w="5" flexShrink="0" />
      <RowLabel icon={icon} label={label} detail={detail} onSelect={onSelect} />
      {chevron && <Icon as={LuChevronRight} boxSize="4" color="fg.subtle" me="1.5" />}
    </HStack>
  )
}

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
      {SECTION_LINKING_ENABLED && section.linkedTo && (
        <Badge size="xs" variant="subtle" colorPalette="brand">
          {t('linkedBadge')}
        </Badge>
      )}
      {style.visibility !== 'all' && (
        <Icon
          as={style.visibility === 'mobile' ? LuSmartphone : LuMonitor}
          boxSize="3"
          color="fg.muted"
          flexShrink="0"
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

interface RowActions {
  onToggleHidden: () => void
  onDuplicate: () => void
  onLinkedCopy: () => void
  onCopy: () => void
  onRemove: () => void
}

function SectionRow({
  section,
  selected,
  canDuplicate,
  onSelect,
  actions,
}: {
  section: SectionInstance
  selected: boolean
  canDuplicate: boolean
  onSelect: () => void
  actions: RowActions
}) {
  const { t, l } = useEditorText()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  })
  const schema = sectionSchema(section.type)
  const required = schema?.required === true

  return (
    <HStack
      ref={setNodeRef}
      data-section-row={section.id}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...ROW_STYLE}
      {...rowColors(selected)}
      position="relative"
      zIndex={isDragging ? 1 : undefined}
      shadow={isDragging ? 'md' : undefined}
      {...(isDragging && { bg: 'bg.panel' })}
    >
      <IconButton
        aria-label={t('dragToReorder')}
        size="2xs"
        variant="plain"
        minW="5"
        w="5"
        color="fg.subtle"
        cursor="grab"
        flexShrink="0"
        {...ON_HOVER}
        {...attributes}
        {...listeners}
      >
        <LuGripVertical />
      </IconButton>
      <Box flex="1" minW="0" display="flex" opacity={section.hidden ? 0.5 : 1}>
        <RowLabel
          icon={sectionIcon(schema?.icon ?? '')}
          label={schema ? l(schema.name) : section.type}
          detail={rowDetail(section)}
          badges={<RowBadges section={section} />}
          onSelect={onSelect}
        />
      </Box>
      <HStack gap="0" flexShrink="0">
        <IconButton
          aria-label={section.hidden ? t('show') : t('hide')}
          title={section.hidden ? t('show') : t('hide')}
          size="2xs"
          variant="ghost"
          color="fg.muted"
          {...(!section.hidden && ON_HOVER)}
          onClick={actions.onToggleHidden}
        >
          {section.hidden ? <LuEyeOff /> : <LuEye />}
        </IconButton>
        <Menu.Root
          positioning={{ placement: 'bottom-end' }}
          onSelect={({ value }) => {
            if (value === 'copy') actions.onCopy()
            else if (value === 'duplicate') actions.onDuplicate()
            else if (value === 'linked') actions.onLinkedCopy()
            else if (value === 'remove') actions.onRemove()
          }}
        >
          <Menu.Trigger asChild>
            <IconButton
              aria-label={t('moreActions')}
              size="2xs"
              variant="ghost"
              color="fg.muted"
              {...ON_HOVER}
              _open={{ opacity: 1 }}
            >
              <LuEllipsis />
            </IconButton>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content minW="44">
                <Menu.Item value="duplicate" disabled={!canDuplicate}>
                  <LuCopy />
                  {t('duplicate')}
                </Menu.Item>
                {SECTION_LINKING_ENABLED && (
                  <Menu.Item value="linked" disabled={!canDuplicate}>
                    <LuLink />
                    {t('linkedCopy')}
                  </Menu.Item>
                )}
                <Menu.Item value="copy">
                  <LuClipboardCopy />
                  {t('copySection')}
                </Menu.Item>
                <Menu.Separator />
                <Menu.Item
                  value="remove"
                  disabled={required}
                  color="danger.fg"
                  _hover={{ bg: 'danger.subtle', color: 'danger.fg' }}
                >
                  <LuTrash2 />
                  {required ? t('required') : t('remove')}
                </Menu.Item>
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      </HStack>
    </HStack>
  )
}

/** A small, quiet heading over a group of rows. */
export function SidebarHeading({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <Flex align="center" justify="space-between" gap="2" ps="2" minH="7">
      <Text fontSize="xs" fontWeight="semibold" color="fg.muted">
        {children}
      </Text>
      {action}
    </Flex>
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

  // The rows slide to their new places whenever the order changes, whichever
  // control asked for it — a drag, the preview's move buttons, a paste.
  const rowsRef = useRef<HTMLDivElement>(null)
  const rowRects = useRef<SectionRects>(new Map())
  const rowIndexes = useRef<Map<string, number>>(new Map())

  useLayoutEffect(() => {
    const ids = sections.map((section) => section.id)
    rowRects.current = flipElements(rowsRef.current, ids, rowRects.current, {
      attribute: 'data-section-row',
      animate: orderMoved(ids, rowIndexes.current),
    })
    rowIndexes.current = new Map(ids.map((id, index) => [id, index]))
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
    // Added by click: open its settings straight away so they can be filled
    // in. A drop from the palette only adds it (see `onPaletteDrop`), so the
    // palette stays open for the next item.
    onChange(next)
    onSelect(section.id)
  }

  function rowActions(section: SectionInstance): RowActions {
    return {
      onToggleHidden: () =>
        onChange(
          sections.map((other) =>
            other.id === section.id ? { ...other, hidden: !other.hidden } : other,
          ),
        ),
      onDuplicate: () => {
        const result = duplicateSection(sections, section.id)
        if (result) onChange(result.sections)
      },
      onLinkedCopy: () => {
        const result = duplicateLinkedSection(sections, section.id)
        if (result) onChange(result.sections)
      },
      onCopy: () => {
        if (writeClipboard(section)) onNotice?.(t('sectionCopied'))
      },
      onRemove: () => onChange(removeSection(sections, section.id)),
    }
  }

  // The palette takes over the list while it is open, so dragging from it
  // into the preview never has to share space with the rows.
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
        onAddSection={(type, preset) => insert(createStarterSection(type, preset))}
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

  // Pulled out to the panel's edges: a row's own padding lines it up.
  return (
    <Stack gap="1" mx="-2" mt="-2">
      <SidebarHeading
        action={
          <Button
            size="xs"
            variant="ghost"
            colorPalette="brand"
            disabled={full}
            onClick={() => {
              setCopied(readClipboard(scope))
              setAdding(true)
            }}
          >
            <LuPlus />
            {t('addSection')}
          </Button>
        }
      >
        {t('sections')}
      </SidebarHeading>
      {before}
      {sections.length === 0 ? (
        <Text fontSize="xs" color="fg.muted" px="2" py="3">
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
            <Stack ref={rowsRef} gap="0.5">
              {sections.map((section) => (
                <SectionRow
                  key={section.id}
                  section={section}
                  selected={section.id === selectedId}
                  canDuplicate={canDuplicateSection(sections, section.id)}
                  onSelect={() => onSelect(section.id)}
                  actions={rowActions(section)}
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
