/**
 * Ctrl/⌘+K: one search box for everything the editor can add or open.
 *
 * Three kinds of result, in this order: the sections already on the page (to
 * jump to one in a long page), the sections and presets that can be added,
 * and the blocks — saved ones first. The arrow keys move through them and
 * Enter picks one, so a seller who knows what they want never opens the
 * palette's categories at all.
 */

import { Box, Dialog, HStack, Icon, Input, Portal, Stack, Text } from '@chakra-ui/react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { LuCornerDownLeft, LuPlus, LuSearch } from 'react-icons/lu'

import { BLOCK_PRESETS } from '../model/block-presets'
import { registeredBlocks } from '../model/block-registry'
import type { SectionInstance } from '../model/content'
import {
  isSectionOffered,
  offeredPresets,
  sectionSchema,
  SECTION_SCHEMAS,
  type SectionPreset,
  type SectionSchema,
  type SectionScope,
  type SectionType,
} from '../model/sections'
import type { PaletteBlock } from './add-palette'
import { blockGlyph } from './block-icons'
import { useEditorText } from './messages'
import { paletteBlockOf, useSavedBlocks } from './saved-blocks'
import { sectionIcon } from './section-icons'

interface Command {
  key: string
  group: 'open' | 'section' | 'block'
  label: string
  detail: string
  icon: ReactNode
  run: () => void
}

/** Every word of the query, somewhere in the text: "prod list" finds "Product list". */
function matches(text: string, needle: string): boolean {
  if (!needle) return true
  const haystack = text.toLowerCase()
  return needle.split(/\s+/).every((word) => haystack.includes(word))
}

export function CommandPalette({
  open,
  onClose,
  sections,
  scope,
  counts,
  onOpenSection,
  onAddSection,
  onAddBlocks,
  addOnly = false,
  blocksOnly = false,
}: {
  open: boolean
  onClose: () => void
  sections: readonly SectionInstance[]
  scope: SectionScope
  counts: ReadonlyMap<string, number>
  onOpenSection: (id: string) => void
  onAddSection: (type: SectionType, preset: SectionPreset | null) => void
  onAddBlocks: (blocks: readonly PaletteBlock[], label: string) => void
  /** Opened by a "+" between sections: only what can be added, not the page's own. */
  addOnly?: boolean
  /** Opened by "+ Add block" in the tree: blocks only, for that section. */
  blocksOnly?: boolean
}) {
  const { t, l } = useEditorText()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const saved = useSavedBlocks()

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActive(0)
  }, [open])

  const commands = useMemo<Command[]>(() => {
    const out: Command[] = []
    for (const section of addOnly ? [] : sections) {
      const schema = sectionSchema(section.type)
      if (!schema) continue
      const heading = typeof section.settings.heading === 'string' ? section.settings.heading : ''
      out.push({
        key: `open:${section.id}`,
        group: 'open',
        label: l(schema.name),
        detail: heading,
        icon: <Icon as={sectionIcon(schema.icon)} />,
        run: () => onOpenSection(section.id),
      })
    }
    for (const schema of blocksOnly ? [] : (SECTION_SCHEMAS as readonly SectionSchema[])) {
      if (schema.category === 'layout' || !isSectionOffered(schema, scope)) continue
      if (schema.max !== undefined && (counts.get(schema.type) ?? 0) >= schema.max) continue
      const entries: Array<SectionPreset | null> = [null, ...offeredPresets(schema)]
      for (const preset of entries) {
        out.push({
          key: `section:${schema.type}:${preset?.key ?? ''}`,
          group: 'section',
          label: l(preset?.name ?? schema.name),
          detail: preset ? l(schema.name) : l(schema.description),
          icon: <Icon as={sectionIcon(schema.icon)} />,
          run: () => onAddSection(schema.type as SectionType, preset),
        })
      }
    }
    for (const preset of BLOCK_PRESETS) {
      out.push({
        key: `preset:${preset.key}`,
        group: 'block',
        label: l(preset.name),
        detail: l(preset.description),
        icon: <Icon as={blockGlyph(preset.glyph) ?? LuPlus} />,
        run: () => onAddBlocks(preset.blocks, l(preset.name)),
      })
    }
    for (const entry of saved) {
      out.push({
        key: `saved:${entry.id}`,
        group: 'block',
        label: entry.name,
        detail: t('paletteSaved'),
        icon: <Icon as={blockGlyph(entry.block.type) ?? LuPlus} />,
        run: () => onAddBlocks([paletteBlockOf(entry)], entry.name),
      })
    }
    for (const schema of registeredBlocks()) {
      out.push({
        key: `block:${schema.type}`,
        group: 'block',
        label: l(schema.name),
        detail: schema.description ? l(schema.description) : '',
        icon: <Icon as={blockGlyph(schema.type) ?? LuPlus} />,
        run: () => onAddBlocks([{ type: schema.type }], l(schema.name)),
      })
    }
    return out
  }, [
    sections,
    scope,
    counts,
    saved,
    l,
    t,
    onOpenSection,
    onAddSection,
    onAddBlocks,
    addOnly,
    blocksOnly,
  ])

  const needle = query.trim().toLowerCase()
  const results = commands.filter((command) =>
    matches(`${command.label} ${command.detail}`, needle),
  )
  const current = Math.min(active, Math.max(0, results.length - 1))

  // Keep the highlighted row in view as the arrows move it.
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-command-index="${current}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [current])

  function pick(command: Command | undefined) {
    if (!command) return
    onClose()
    command.run()
  }

  const groupLabel = {
    open: t('commandOpen'),
    section: t('commandAddSection'),
    block: t('commandAddBlock'),
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={({ open: next }) => {
        if (!next) onClose()
      }}
      placement="top"
      size="md"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content mt="16" overflow="hidden" aria-label={t('commandTitle')}>
            <HStack px="4" py="3" gap="3" borderBottomWidth="1px" borderColor="border.subtle">
              <Icon as={LuSearch} color="fg.subtle" />
              <Input
                autoFocus
                variant="subtle"
                bg="transparent"
                border="0"
                size="md"
                px="0"
                _focusVisible={{ outline: 'none', boxShadow: 'none' }}
                placeholder={
                  blocksOnly
                    ? t('commandPlaceholderBlock')
                    : addOnly
                      ? t('commandPlaceholderAdd')
                      : t('commandPlaceholder')
                }
                value={query}
                onChange={(event) => {
                  setQuery(event.currentTarget.value)
                  setActive(0)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    setActive(Math.min(results.length - 1, current + 1))
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    setActive(Math.max(0, current - 1))
                  } else if (event.key === 'Enter') {
                    event.preventDefault()
                    pick(results[current])
                  }
                }}
                aria-activedescendant={results[current] ? `command-${current}` : undefined}
                aria-controls="command-results"
              />
            </HStack>
            <Box
              ref={listRef}
              id="command-results"
              role="listbox"
              maxH="min(26rem, 60dvh)"
              overflowY="auto"
              p="1.5"
              style={{ overscrollBehavior: 'contain' }}
            >
              {results.length === 0 && (
                <Text px="3" py="8" textAlign="center" fontSize="sm" color="fg.muted">
                  {t('commandNoResults')}
                </Text>
              )}
              {results.map((command, index) => {
                const heading =
                  index === 0 || results[index - 1]!.group !== command.group
                    ? groupLabel[command.group]
                    : null
                const isActive = index === current
                return (
                  <Box key={command.key}>
                    {heading && (
                      <Text
                        px="2.5"
                        pt={index === 0 ? '1' : '3'}
                        pb="1"
                        fontSize="xs"
                        fontWeight="semibold"
                        color="fg.muted"
                      >
                        {heading}
                      </Text>
                    )}
                    <HStack
                      id={`command-${index}`}
                      data-command-index={index}
                      role="option"
                      aria-selected={isActive}
                      gap="3"
                      px="2.5"
                      py="2"
                      rounded="md"
                      cursor="pointer"
                      bg={isActive ? 'bg.muted' : undefined}
                      onMouseMove={() => {
                        if (!isActive) setActive(index)
                      }}
                      onClick={() => pick(command)}
                    >
                      <Box
                        boxSize="7"
                        rounded="md"
                        bg={isActive ? 'bg.panel' : 'bg.muted'}
                        color="fg.muted"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        flexShrink="0"
                      >
                        {command.icon}
                      </Box>
                      <Stack gap="0" minW="0" flex="1">
                        <Text fontSize="sm" fontWeight="medium" truncate>
                          {command.label}
                        </Text>
                        {command.detail && (
                          <Text fontSize="xs" color="fg.muted" truncate>
                            {command.detail}
                          </Text>
                        )}
                      </Stack>
                      {isActive && <Icon as={LuCornerDownLeft} color="fg.subtle" />}
                    </HStack>
                  </Box>
                )
              })}
            </Box>
            <Text
              px="4"
              py="2"
              fontSize="xs"
              color="fg.subtle"
              borderTopWidth="1px"
              borderColor="border.subtle"
            >
              {t('commandHint')}
            </Text>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
