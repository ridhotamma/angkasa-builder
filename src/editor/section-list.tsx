/**
 * The ordered list of sections, and the menu that adds one.
 *
 * Reordering is drag-and-drop with a keyboard fallback (dnd-kit's keyboard
 * sensor: focus the handle, space, arrows, space). Every change is a new
 * array handed up — nothing here holds its own copy of the order.
 */

import {
  Badge,
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
import { LuCopy, LuEye, LuEyeOff, LuGripVertical, LuPlus, LuTrash2 } from 'react-icons/lu'

import { createSection, MAX_SECTIONS, type SectionInstance } from '../model/content'
import { newId } from '../model/fields'
import { SECTION_SCHEMAS, sectionSchema, type SectionType } from '../model/sections'
import { useEditorText } from './messages'

function Row({
  section,
  selected,
  onSelect,
  onToggleHidden,
  onDuplicate,
  onRemove,
  canDuplicate,
}: {
  section: SectionInstance
  selected: boolean
  onSelect: () => void
  onToggleHidden: () => void
  onDuplicate: () => void
  onRemove: () => void
  canDuplicate: boolean
}) {
  const { t, l } = useEditorText()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  })
  const schema = sectionSchema(section.type)

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
        <Text fontSize="sm" fontWeight="medium" truncate>
          {schema ? l(schema.name) : section.type}
        </Text>
        {section.hidden && (
          <Badge size="xs" variant="subtle">
            {t('hidden')}
          </Badge>
        )}
      </Button>
      <IconButton
        aria-label={section.hidden ? t('show') : t('hide')}
        size="2xs"
        variant="ghost"
        onClick={onToggleHidden}
      >
        {section.hidden ? <LuEyeOff /> : <LuEye />}
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
  )
}

export function AddSectionMenu({
  onAdd,
  disabled,
}: {
  onAdd: (type: SectionType) => void
  disabled?: boolean
}) {
  const { t, l } = useEditorText()
  return (
    <Menu.Root
      onSelect={({ value }) => onAdd(value as SectionType)}
      positioning={{ placement: 'bottom-start' }}
    >
      <Menu.Trigger asChild>
        <Button size="sm" variant="outline" w="full" disabled={disabled}>
          <Icon as={LuPlus} />
          {t('addSection')}
        </Button>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content maxH="96" overflowY="auto" minW="72">
            {SECTION_SCHEMAS.map((schema) => (
              <Menu.Item key={schema.type} value={schema.type} py="2">
                <Stack gap="0.5">
                  <Text fontSize="sm" fontWeight="medium">
                    {l(schema.name)}
                  </Text>
                  <Text fontSize="xs" color="fg.muted">
                    {l(schema.description)}
                  </Text>
                </Stack>
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  )
}

export function SectionList({
  sections,
  onChange,
  selectedId,
  onSelect,
}: {
  sections: SectionInstance[]
  onChange: (sections: SectionInstance[]) => void
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const { t } = useEditorText()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const full = sections.length >= MAX_SECTIONS

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const from = sections.findIndex((section) => section.id === active.id)
    const to = sections.findIndex((section) => section.id === over.id)
    if (from < 0 || to < 0) return
    onChange(arrayMove(sections, from, to))
  }

  function add(type: SectionType) {
    const section = createSection(type)
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
                  canDuplicate={!full}
                  onSelect={() => onSelect(section.id)}
                  onToggleHidden={() =>
                    onChange(
                      sections.map((other) =>
                        other.id === section.id ? { ...other, hidden: !other.hidden } : other,
                      ),
                    )
                  }
                  onDuplicate={() => {
                    const index = sections.findIndex((other) => other.id === section.id)
                    const copy = { ...structuredClone(section), id: newId() }
                    const next = [...sections]
                    next.splice(index + 1, 0, copy)
                    onChange(next)
                  }}
                  onRemove={() => onChange(sections.filter((other) => other.id !== section.id))}
                />
              ))}
            </Stack>
          </SortableContext>
        </DndContext>
      )}
      <AddSectionMenu onAdd={add} disabled={full} />
    </Stack>
  )
}
