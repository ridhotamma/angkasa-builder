/**
 * The add palette: everything a page can hold, in one panel.
 *
 * Two modes, switched at the top: **Sections** lists the code sections and
 * their ready-made presets, **Blocks** lists the primitive building blocks and
 * the composed layouts. Either way an item can be clicked — it is added at the
 * end, or after the current selection — or dragged into the preview, where a
 * drop indicator shows exactly where it will land.
 *
 * The drag is the browser's native drag and drop: the item starts a drag, the
 * editor shows a transparent layer over the preview iframe, and the drop is
 * hit-tested against the iframe's own DOM (see `preview-drop`). That is what
 * lets one document drag into another.
 */

import {
  Box,
  Button,
  Flex,
  HStack,
  Icon,
  IconButton,
  Input,
  InputGroup,
  SegmentGroup,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type DragEvent,
  type ReactNode,
} from 'react'
import { LuChevronLeft, LuPlus, LuSearch, LuX } from 'react-icons/lu'

import { registeredBlocks } from '../model/block-registry'
import {
  isSectionOffered,
  offeredPresets,
  SECTION_CATEGORIES,
  SECTION_CATEGORY_LABELS,
  SECTION_SCHEMAS,
  type SectionPreset,
  type SectionSchema,
  type SectionScope,
  type SectionType,
} from '../model/sections'
import { blockGlyph } from './block-icons'
import { sectionIcon } from './section-icons'
import { useEditorText } from './messages'

/** A block as the palette hands it over: settings are filled in by the sanitiser. */
export interface PaletteBlock {
  type: string
  settings?: Record<string, unknown>
  style?: Record<string, unknown>
}

/** What a palette item adds, once dropped or clicked. */
export type PaletteItem =
  | { kind: 'section'; type: SectionType; preset: SectionPreset | null }
  | { kind: 'blocks'; blocks: readonly PaletteBlock[]; label: string }

interface PaletteDragState {
  item: PaletteItem | null
  start: (item: PaletteItem) => void
  end: () => void
}

const PaletteDragContext = createContext<PaletteDragState>({
  item: null,
  start: () => undefined,
  end: () => undefined,
})

/** Holds what is being dragged from the palette, for the preview's drop layer. */
export function PaletteDragProvider({ children }: { children: ReactNode }) {
  const [item, setItem] = useState<PaletteItem | null>(null)
  const value = useMemo<PaletteDragState>(
    () => ({ item, start: setItem, end: () => setItem(null) }),
    [item],
  )
  return <PaletteDragContext.Provider value={value}>{children}</PaletteDragContext.Provider>
}

export function usePaletteDrag(): PaletteDragState {
  return useContext(PaletteDragContext)
}

/** One draggable entry: a card that starts a drag, and adds when clicked. */
function PaletteCard({
  item,
  name,
  description,
  icon,
  disabled = false,
  onAdd,
}: {
  item: PaletteItem
  name: string
  description: string
  icon: ReactNode
  disabled?: boolean
  onAdd: () => void
}) {
  const drag = usePaletteDrag()

  const onDragStart = (event: DragEvent) => {
    if (disabled) {
      event.preventDefault()
      return
    }
    // Firefox needs data on the transfer or no drag starts at all.
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData('text/plain', name)
    drag.start(item)
  }

  return (
    <Button
      variant="outline"
      h="auto"
      p="3"
      justifyContent="start"
      alignItems="start"
      textAlign="left"
      whiteSpace="normal"
      gap="3"
      cursor={disabled ? 'not-allowed' : 'grab'}
      disabled={disabled}
      draggable={!disabled}
      onDragStart={onDragStart}
      onDragEnd={drag.end}
      onClick={() => {
        if (!disabled) onAdd()
      }}
    >
      <Box
        boxSize="9"
        rounded="md"
        bg="bg.muted"
        color="fg.muted"
        display="flex"
        alignItems="center"
        justifyContent="center"
        flexShrink="0"
      >
        {icon}
      </Box>
      <Stack gap="0.5" minW="0" flex="1" align="start">
        <Text fontSize="sm" fontWeight="medium">
          {name}
        </Text>
        {description && (
          <Text fontSize="xs" color="fg.muted" fontWeight="normal" lineHeight="short">
            {description}
          </Text>
        )}
      </Stack>
    </Button>
  )
}

/** Where the palette's mode is kept: this browser only, a matter of habit. */
const ADD_MODE_KEY = 'pesanle.page-builder.add-mode'

function readAddMode(): 'sections' | 'blocks' {
  try {
    return globalThis.localStorage?.getItem(ADD_MODE_KEY) === 'blocks' ? 'blocks' : 'sections'
  } catch {
    // Storage refused (a private window): the default mode it is.
    return 'sections'
  }
}

function writeAddMode(mode: 'sections' | 'blocks') {
  try {
    globalThis.localStorage?.setItem(ADD_MODE_KEY, mode)
  } catch {
    // As above: the choice just is not remembered.
  }
}

function GroupHeading({ children }: { children: ReactNode }) {
  return (
    <Text
      fontSize="xs"
      fontWeight="semibold"
      textTransform="uppercase"
      letterSpacing="wide"
      color="fg.muted"
    >
      {children}
    </Text>
  )
}

export function AddPalette({
  scope,
  counts,
  copiedLabel,
  onClearCopied,
  onAddSection,
  onAddBlocks,
  onPaste,
  onClose,
}: {
  scope: SectionScope
  counts: ReadonlyMap<string, number>
  /** The copied section's name, or `null` when the clipboard is empty. */
  copiedLabel: string | null
  onClearCopied: () => void
  onAddSection: (type: SectionType, preset: SectionPreset | null) => void
  onAddBlocks: (blocks: readonly PaletteBlock[], label: string) => void
  onPaste: () => void
  onClose: () => void
}) {
  const { t, l } = useEditorText()
  const [mode, setMode] = useState<'sections' | 'blocks'>('sections')
  const [query, setQuery] = useState('')

  // Read after mount, not during render: storage cannot be read on the server,
  // and a mismatch between the two would be a hydration error.
  useEffect(() => setMode(readAddMode()), [])

  const sectionEntries = useMemo(() => {
    const out: Array<{ key: string; schema: SectionSchema; preset: SectionPreset | null }> = []
    for (const schema of SECTION_SCHEMAS as readonly SectionSchema[]) {
      // The layout composers live in the palette's "Custom blocks" mode, not
      // in the preset list.
      if (schema.category === 'layout') continue
      if (!isSectionOffered(schema, scope)) continue
      out.push({ key: schema.type, schema, preset: null })
      for (const preset of offeredPresets(schema)) {
        out.push({ key: `${schema.type}:${preset.key}`, schema, preset })
      }
    }
    return out
  }, [scope])

  const blockSchemas = useMemo(() => registeredBlocks(), [])

  const needle = query.trim().toLowerCase()
  const match = (name: string, description: string) =>
    needle.length === 0 || `${name} ${description}`.toLowerCase().includes(needle)

  const full = (schema: SectionSchema) =>
    schema.max !== undefined && (counts.get(schema.type) ?? 0) >= schema.max

  const matching = {
    sections: sectionEntries.filter((entry) =>
      match(l(entry.preset?.name ?? entry.schema.name), ''),
    ).length,
    blocks: blockSchemas.filter((schema) =>
      match(l(schema.name), schema.description ? l(schema.description) : ''),
    ).length,
  }
  const nothing = matching[mode] === 0

  return (
    <Stack gap="3">
      {/* The back button and the mode switch share a row; on a narrow panel
          the switch wraps onto its own row. */}
      <Flex wrap="wrap" align="center" justify="space-between" gap="2">
        <Button
          size="xs"
          variant="ghost"
          ml="-2"
          flexShrink="0"
          fontWeight="semibold"
          onClick={onClose}
        >
          <Icon as={LuChevronLeft} />
          {t('addSection')}
        </Button>
        <SegmentGroup.Root
          size="xs"
          value={mode}
          // Hug the two labels: a fixed minimum stretched the indicator past
          // the text on a narrow panel.
          w="fit-content"
          flexShrink="0"
          onValueChange={({ value }) => {
            if (value !== 'sections' && value !== 'blocks') return
            setMode(value)
            writeAddMode(value)
          }}
        >
          <SegmentGroup.Indicator />
          {(
            [
              ['sections', t('paletteSections')],
              ['blocks', t('paletteBlocks')],
            ] as const
          ).map(([value, label]) => (
            <SegmentGroup.Item key={value} value={value}>
              <SegmentGroup.ItemText>{label}</SegmentGroup.ItemText>
              <SegmentGroup.ItemHiddenInput />
            </SegmentGroup.Item>
          ))}
        </SegmentGroup.Root>
      </Flex>

      <InputGroup startElement={<Icon as={LuSearch} color="fg.subtle" />}>
        <Input
          size="sm"
          placeholder={t('searchSections')}
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      </InputGroup>

      <Text fontSize="xs" color="fg.muted">
        {t('paletteDragHint')}
      </Text>

      {mode === 'sections' && copiedLabel && (
        <HStack gap="1">
          <Button
            size="sm"
            variant="subtle"
            colorPalette="brand"
            flex="1"
            minW="0"
            onClick={onPaste}
          >
            <Text truncate>
              {t('pasteSection')} — {copiedLabel}
            </Text>
          </Button>
          <IconButton
            aria-label={t('clearCopied')}
            size="sm"
            variant="ghost"
            onClick={onClearCopied}
          >
            <LuX />
          </IconButton>
        </HStack>
      )}

      {nothing && (
        <Text fontSize="sm" color="fg.muted" py="6" textAlign="center">
          {t('noSectionsMatch')}
        </Text>
      )}

      {mode === 'sections' ? (
        <Stack gap="5">
          {SECTION_CATEGORIES.map((category) => {
            const inCategory = sectionEntries.filter(
              (entry) =>
                entry.schema.category === category &&
                match(l(entry.preset?.name ?? entry.schema.name), ''),
            )
            if (inCategory.length === 0) return null
            return (
              <Stack key={category} gap="2">
                <GroupHeading>{l(SECTION_CATEGORY_LABELS[category])}</GroupHeading>
                <SimpleGrid columns={1} gap="2">
                  {inCategory.map((entry) => (
                    <PaletteCard
                      key={entry.key}
                      item={{
                        kind: 'section',
                        type: entry.schema.type as SectionType,
                        preset: entry.preset,
                      }}
                      name={l(entry.preset?.name ?? entry.schema.name)}
                      description={l(entry.preset?.description ?? entry.schema.description)}
                      icon={<Icon as={sectionIcon(entry.schema.icon)} boxSize="4.5" />}
                      disabled={full(entry.schema)}
                      onAdd={() => onAddSection(entry.schema.type as SectionType, entry.preset)}
                    />
                  ))}
                </SimpleGrid>
              </Stack>
            )
          })}
        </Stack>
      ) : (
        <Stack gap="5">
          <Stack gap="2">
            <GroupHeading>{t('palettePrimitives')}</GroupHeading>
            <SimpleGrid columns={1} gap="2">
              {blockSchemas
                .filter((schema) =>
                  match(l(schema.name), schema.description ? l(schema.description) : ''),
                )
                .map((schema) => (
                  <PaletteCard
                    key={schema.type}
                    item={{
                      kind: 'blocks',
                      blocks: [{ type: schema.type }],
                      label: l(schema.name),
                    }}
                    name={l(schema.name)}
                    description={schema.description ? l(schema.description) : ''}
                    icon={<Icon as={blockGlyph(schema.type) ?? LuPlus} boxSize="4.5" />}
                    onAdd={() => onAddBlocks([{ type: schema.type }], l(schema.name))}
                  />
                ))}
            </SimpleGrid>
          </Stack>
        </Stack>
      )}
    </Stack>
  )
}
