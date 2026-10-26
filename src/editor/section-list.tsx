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
  HStack,
  Icon,
  IconButton,
  Menu,
  Portal,
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
import { useLayoutEffect, useMemo, useRef, useState, type ElementType, type ReactNode } from 'react'
import {
  LuChevronRight,
  LuCirclePlus,
  LuClipboardCopy,
  LuCopy,
  LuEllipsis,
  LuEye,
  LuEyeOff,
  LuGripVertical,
  LuLink,
  LuLock,
  LuMonitor,
  LuSmartphone,
  LuSquare,
  LuTrash2,
} from 'react-icons/lu'

import { SECTION_LINKING_ENABLED } from '@repo/appwrite-config'

import {
  canDuplicateSection,
  createSection,
  duplicateLinkedSection,
  duplicateSection,
  MAX_SECTIONS,
  removeSection,
  sanitizeSections,
  sectionDisplayName,
  type SectionInstance,
} from '../model/content'
import { createStarterSection } from '../model/section-starters'
import {
  newId,
  readBlocks,
  type BlockSchema,
  type BlockValue,
  type Field,
  type FieldValues,
} from '../model/fields'
import { localize } from '../model/localized'
import { readSectionStyle, SCHEDULE_LABELS, scheduleState } from '../model/section-style'
import { sectionSchema, type SectionScope } from '../model/sections'
import { AddPalette, type PaletteBlock } from './add-palette'
import { blockGlyph } from './block-icons'
import { useEditorText } from './messages'
import { PanelSlide } from './panel-slide'
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

function RowBadges({ section }: { section: SectionInstance }) {
  const { t, locale } = useEditorText()
  const style = readSectionStyle(section.style)
  const schedule = scheduleState(style, new Date())
  return (
    <>
      {SECTION_LINKING_ENABLED && section.linkedTo && (
        <Icon as={LuLink} boxSize="3" color="brand.fg" aria-label={t('linkedBadge')} />
      )}
      {style.visibility !== 'all' && (
        <Icon
          as={style.visibility === 'mobile' ? LuSmartphone : LuMonitor}
          boxSize="3"
          color="fg.subtle"
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

/**
 * One line of the tree: a chevron when it holds children, its glyph and name,
 * and — on hover, focus, or always on a touch screen — its actions. The look
 * of a file tree, so the page reads as a structure rather than a deck of cards.
 */
function TreeLine({
  depth = 0,
  icon,
  label,
  selected,
  dimmed = false,
  expanded,
  onToggle,
  onSelect,
  badges,
  actions,
  lineRef,
  lineProps,
}: {
  depth?: number
  icon: ElementType
  label: string
  selected: boolean
  dimmed?: boolean
  /** `undefined` when the line has nothing to expand. */
  expanded?: boolean
  onToggle?: () => void
  onSelect: () => void
  badges?: ReactNode
  actions?: ReactNode
  lineRef?: (node: HTMLElement | null) => void
  lineProps?: Record<string, unknown>
}) {
  const { t } = useEditorText()
  return (
    <HStack
      ref={lineRef}
      gap="0.5"
      h="8"
      pe="1"
      ps={`calc(${depth} * 0.875rem)`}
      rounded="md"
      bg={selected ? 'bg.emphasized' : undefined}
      _hover={{ bg: selected ? 'bg.emphasized' : 'bg.muted' }}
      opacity={dimmed ? 0.55 : 1}
      className="group"
      {...lineProps}
    >
      {expanded === undefined ? (
        <Box w="5" flexShrink="0" />
      ) : (
        <IconButton
          aria-label={expanded ? t('collapse') : t('expand')}
          aria-expanded={expanded}
          size="2xs"
          variant="ghost"
          minW="5"
          w="5"
          color="fg.muted"
          onClick={onToggle}
        >
          <Icon
            as={LuChevronRight}
            transition="transform 120ms"
            transform={expanded ? 'rotate(90deg)' : undefined}
          />
        </IconButton>
      )}
      <Button
        variant="plain"
        size="sm"
        flex="1"
        minW="0"
        h="full"
        px="1"
        justifyContent="start"
        gap="2"
        fontWeight={selected ? 'semibold' : 'normal'}
        onClick={onSelect}
      >
        <Icon as={icon} boxSize="4" color="fg.muted" flexShrink="0" />
        <Text fontSize="sm" truncate>
          {label}
        </Text>
        {badges}
      </Button>
      {actions && (
        <HStack
          gap="0"
          flexShrink="0"
          opacity="0"
          _groupHover={{ opacity: 1 }}
          _groupFocusWithin={{ opacity: 1 }}
          css={{ '@media (hover: none)': { opacity: 1 } }}
        >
          {actions}
        </HStack>
      )}
    </HStack>
  )
}

/** A section's blocks, as indented lines under it — nested ones under their parent. */
function BlockLines({
  fields,
  values,
  depth,
  sectionId,
  selectedBlockId,
  onSelectBlock,
}: {
  fields: readonly Field[]
  values: FieldValues
  depth: number
  sectionId: string
  selectedBlockId: string | null
  onSelectBlock: (sectionId: string, blockId: string) => void
}) {
  return (
    <>
      {fields.map((field) =>
        field.kind !== 'blocks'
          ? null
          : readBlocks(values, field.key).map((block) => {
              const schema = field.blocks.find((candidate) => candidate.type === block.type)
              if (!schema) return null
              return (
                <BlockLine
                  key={block.id}
                  block={block}
                  schema={schema}
                  depth={depth}
                  sectionId={sectionId}
                  selectedBlockId={selectedBlockId}
                  onSelectBlock={onSelectBlock}
                />
              )
            }),
      )}
    </>
  )
}

/** Whether `id` is `block` or sits anywhere inside it. */
function holds(fields: readonly Field[], values: FieldValues, id: string): boolean {
  return fields.some(
    (field) =>
      field.kind === 'blocks' &&
      readBlocks(values, field.key).some((block) => {
        if (block.id === id) return true
        const schema = field.blocks.find((candidate) => candidate.type === block.type)
        return schema ? holds(schema.fields, block.settings, id) : false
      }),
  )
}

function hasBlocks(fields: readonly Field[], values: FieldValues): boolean {
  return fields.some((field) => field.kind === 'blocks' && readBlocks(values, field.key).length > 0)
}

function BlockLine({
  block,
  schema,
  depth,
  sectionId,
  selectedBlockId,
  onSelectBlock,
}: {
  block: BlockValue
  schema: BlockSchema
  depth: number
  sectionId: string
  selectedBlockId: string | null
  onSelectBlock: (sectionId: string, blockId: string) => void
}) {
  const { l } = useEditorText()
  const nested = hasBlocks(schema.fields, block.settings)
  const [open, setOpen] = useState(true)
  // A selection deeper inside always shows: picking a block on the canvas
  // opens the branch it sits in.
  const forced =
    selectedBlockId !== null &&
    selectedBlockId !== block.id &&
    holds(schema.fields, block.settings, selectedBlockId)
  const expanded = nested ? open || forced : undefined
  return (
    <>
      <TreeLine
        depth={depth}
        icon={blockGlyph(block.type) ?? LuSquare}
        label={block.name?.trim() || l(schema.name)}
        selected={selectedBlockId === block.id}
        expanded={expanded}
        onToggle={() => setOpen(!expanded)}
        onSelect={() => onSelectBlock(sectionId, block.id)}
      />
      {expanded && (
        <BlockLines
          fields={schema.fields}
          values={block.settings}
          depth={depth + 1}
          sectionId={sectionId}
          selectedBlockId={selectedBlockId}
          onSelectBlock={onSelectBlock}
        />
      )}
    </>
  )
}

function Row({
  section,
  sections,
  selected,
  selectedBlockId,
  expanded,
  onToggle,
  onSelect,
  onSelectBlock,
  onAddBlock,
  onToggleHidden,
  onDuplicate,
  onLinkedCopy,
  onCopy,
  onRemove,
  canDuplicate,
}: {
  section: SectionInstance
  /** The whole list, so a linked copy can wear its original's name. */
  sections: readonly SectionInstance[]
  selected: boolean
  selectedBlockId: string | null
  expanded: boolean
  onToggle: () => void
  onSelect: () => void
  onSelectBlock: (sectionId: string, blockId: string) => void
  /** Present for a Custom blocks section: "+ Add block" under its blocks. */
  onAddBlock?: () => void
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
  const required = schema?.required === true
  const expandable = Boolean(schema && (hasBlocks(schema.fields, section.settings) || onAddBlock))
  const open = expandable && expanded

  return (
    <Box
      ref={setNodeRef}
      data-section-row={section.id}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      zIndex={isDragging ? 1 : undefined}
      bg={isDragging ? 'bg.panel' : undefined}
      shadow={isDragging ? 'md' : undefined}
      rounded="md"
    >
      <TreeLine
        icon={sectionIcon(schema?.icon ?? '')}
        label={schema ? sectionDisplayName(section, sections, l(schema.name)) : section.type}
        selected={selected && selectedBlockId === null}
        dimmed={section.hidden}
        expanded={expandable ? open : undefined}
        onToggle={onToggle}
        onSelect={onSelect}
        badges={<RowBadges section={section} />}
        actions={
          <>
            <IconButton
              aria-label={section.hidden ? t('show') : t('hide')}
              title={section.hidden ? t('show') : t('hide')}
              size="2xs"
              variant="ghost"
              color="fg.muted"
              onClick={onToggleHidden}
            >
              {section.hidden ? <LuEyeOff /> : <LuEye />}
            </IconButton>
            <Menu.Root positioning={{ placement: 'bottom-end' }}>
              <Menu.Trigger asChild>
                <IconButton
                  aria-label={t('moreActions')}
                  title={t('moreActions')}
                  size="2xs"
                  variant="ghost"
                  color="fg.muted"
                >
                  <LuEllipsis />
                </IconButton>
              </Menu.Trigger>
              <Portal>
                <Menu.Positioner>
                  <Menu.Content minW="44">
                    <Menu.Item value="duplicate" disabled={!canDuplicate} onClick={onDuplicate}>
                      <LuCopy />
                      {t('duplicate')}
                    </Menu.Item>
                    {SECTION_LINKING_ENABLED && (
                      <Menu.Item value="linked" disabled={!canDuplicate} onClick={onLinkedCopy}>
                        <LuLink />
                        {t('linkedCopy')}
                      </Menu.Item>
                    )}
                    <Menu.Item value="copy" onClick={onCopy}>
                      <LuClipboardCopy />
                      {t('copySection')}
                    </Menu.Item>
                    <Menu.Separator />
                    {required ? (
                      <Menu.Item value="required" disabled>
                        <LuLock />
                        {t('required')}
                      </Menu.Item>
                    ) : (
                      <Menu.Item
                        value="remove"
                        color="fg.error"
                        _hover={{ bg: 'bg.error', color: 'fg.error' }}
                        onClick={onRemove}
                      >
                        <LuTrash2 />
                        {t('remove')}
                      </Menu.Item>
                    )}
                  </Menu.Content>
                </Menu.Positioner>
              </Portal>
            </Menu.Root>
            <IconButton
              aria-label={t('dragToReorder')}
              title={t('dragToReorder')}
              size="2xs"
              variant="ghost"
              color="fg.muted"
              cursor="grab"
              {...attributes}
              {...listeners}
            >
              <LuGripVertical />
            </IconButton>
          </>
        }
      />
      {open && schema && (
        <>
          <BlockLines
            fields={schema.fields}
            values={section.settings}
            depth={1}
            sectionId={section.id}
            selectedBlockId={selected ? selectedBlockId : null}
            onSelectBlock={onSelectBlock}
          />
          {onAddBlock && <AddLine depth={1} label={t('addBlock')} onClick={onAddBlock} />}
        </>
      )}
    </Box>
  )
}

/** "+ Add section" / "+ Add block": a quiet link at the end of its group. */
function AddLine({
  depth = 0,
  label,
  disabled,
  onClick,
}: {
  depth?: number
  label: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <Button
      variant="plain"
      size="sm"
      h="8"
      justifyContent="start"
      gap="2"
      ps={`calc(${depth} * 0.875rem + 1.5rem)`}
      color="brand.fg"
      fontWeight="medium"
      disabled={disabled}
      _hover={{ bg: 'bg.muted' }}
      rounded="md"
      onClick={onClick}
    >
      <Icon as={LuCirclePlus} boxSize="4" />
      {label}
    </Button>
  )
}

/** A named part of the page — Header, Template, Footer — and its lines. */
function TreeGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack gap="0.5">
      <Text px="1" pb="1" fontSize="xs" fontWeight="semibold" color="fg.muted">
        {label}
      </Text>
      {children}
    </Stack>
  )
}

/** The header or footer: in the tree, but never moved or removed. */
export function PinnedRow({
  icon,
  label,
  selected,
  onSelect,
}: {
  icon: string
  label: string
  /** Kept for callers; the tree shows names only. */
  detail?: string
  selected: boolean
  onSelect: () => void
}) {
  return <TreeLine icon={sectionIcon(icon)} label={label} selected={selected} onSelect={onSelect} />
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
  selectedBlockId = null,
  onSelectBlock,
  onAddBlock,
  expanded: expandedProp,
  onExpandedChange,
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
  /** The block picked inside the selected section, highlighted in its branch. */
  selectedBlockId?: string | null
  /** A block line clicked: open that block's settings. */
  onSelectBlock?: (sectionId: string, blockId: string) => void
  /** "+ Add block" under a Custom blocks section. */
  onAddBlock?: (sectionId: string) => void
  /**
   * Which sections show their blocks, when the caller keeps it: the list is
   * unmounted while a section's settings are open, and coming back should
   * find the tree as it was left.
   */
  expanded?: ReadonlySet<string>
  onExpandedChange?: (expanded: ReadonlySet<string>) => void
}) {
  const { t, l } = useEditorText()
  const [adding, setAdding] = useState(false)
  const [copied, setCopied] = useState<SectionInstance | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const full = sections.length >= MAX_SECTIONS
  // Which sections show their blocks. The selected one always does, so a
  // block picked on the canvas is visible in the tree.
  const [ownExpanded, setOwnExpanded] = useState<ReadonlySet<string>>(() => new Set())
  const expanded = expandedProp ?? ownExpanded
  const toggle = (id: string, open: boolean) => {
    const next = new Set(expanded)
    if (open) next.add(id)
    else next.delete(id)
    if (onExpandedChange) onExpandedChange(next)
    else setOwnExpanded(next)
  }
  const openPalette = () => {
    setCopied(readClipboard(scope))
    setAdding(true)
  }
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
    // in, and return to the list, where the new row now sits. A drop from the
    // palette only adds it (see `onPaletteDrop`), so the palette stays open
    // for the next item.
    onChange(next)
    onSelect(section.id)
    setAdding(false)
  }

  // The palette takes over the panel while it is open, so dragging from it
  // into the preview never has to share space with the section list. The swap
  // slides, so opening it reads as a step deeper into the list.
  return (
    <PanelSlide view={adding ? 'palette' : 'list'} depth={adding ? 1 : 0}>
      {adding ? (
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
            insert(createSection('blocks', { blocks }))
          }
          onPaste={() => {
            if (!copied) return
            const schema = sectionSchema(copied.type)
            if (schema?.max !== undefined && (counts.get(copied.type) ?? 0) >= schema.max) return
            insert({ ...copied, id: newId() })
          }}
          onClose={() => setAdding(false)}
        />
      ) : (
        <Stack gap="5">
          {before && <TreeGroup label={t('groupHeader')}>{before}</TreeGroup>}
          <TreeGroup label={t('groupTemplate')}>
            {sections.length === 0 && (
              <Text px="1" py="2" fontSize="sm" color="fg.muted">
                {t('noSections')}
              </Text>
            )}
            {sections.length > 0 && (
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
                    {sections.map((section) => {
                      const selected = section.id === selectedId
                      const open =
                        expanded.has(section.id) || (selected && selectedBlockId !== null)
                      return (
                        <Row
                          key={section.id}
                          section={section}
                          sections={sections}
                          selected={selected}
                          selectedBlockId={selected ? selectedBlockId : null}
                          expanded={open}
                          onToggle={() => toggle(section.id, !open)}
                          canDuplicate={canDuplicateSection(sections, section.id)}
                          onSelect={() => onSelect(section.id)}
                          onSelectBlock={(sectionId, blockId) =>
                            onSelectBlock?.(sectionId, blockId)
                          }
                          onAddBlock={
                            onAddBlock && section.type === 'blocks' && !section.linkedTo
                              ? () => {
                                  toggle(section.id, true)
                                  onAddBlock(section.id)
                                }
                              : undefined
                          }
                          onToggleHidden={() =>
                            onChange(
                              sections.map((other) =>
                                other.id === section.id
                                  ? { ...other, hidden: !other.hidden }
                                  : other,
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
                      )
                    })}
                  </Stack>
                </SortableContext>
              </DndContext>
            )}
            <AddLine label={t('addSection')} disabled={full} onClick={openPalette} />
          </TreeGroup>
          {after && <TreeGroup label={t('groupFooter')}>{after}</TreeGroup>}
        </Stack>
      )}
    </PanelSlide>
  )
}
