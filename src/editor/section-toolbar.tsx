/**
 * The quick actions on the selected section in the preview — move up, move
 * down, duplicate, remove — so the common edits need no trip to the list.
 * They follow the list's own rules: a one-per-page section cannot be
 * duplicated, and a required one shows a lock where remove would be.
 */

import { Box, HStack, IconButton } from '@chakra-ui/react'
import { LuArrowDown, LuArrowUp, LuCopy, LuLock, LuTrash2 } from 'react-icons/lu'

import { Tooltip } from '@repo/theme'

import {
  canDuplicateSection,
  duplicateSection,
  moveSection,
  type SectionInstance,
} from '../model/content'
import { sectionSchema } from '../model/sections'
import { useEditorText } from './messages'

export function SectionToolbar({
  section,
  sections,
  onChange,
  onSelect,
  onMoved,
  onRemoved,
}: {
  section: SectionInstance
  sections: SectionInstance[]
  onChange: (sections: SectionInstance[]) => void
  /** Picks a section — the copy, after a duplicate. */
  onSelect: (id: string) => void
  /** The section changed places; the editor keeps it in view. */
  onMoved: (id: string) => void
  /** The section is gone; the editor drops the selection. */
  onRemoved: () => void
}) {
  const { t } = useEditorText()
  const index = sections.findIndex((other) => other.id === section.id)
  const required = sectionSchema(section.type)?.required === true

  const button = {
    size: 'xs',
    variant: 'ghost',
    color: 'fg.inverted',
    _hover: { bg: 'whiteAlpha.200' },
    _disabled: { opacity: 0.35 },
  } as const

  return (
    <HStack
      gap="0.5"
      p="0.5"
      rounded="md"
      bg="brand.solid"
      shadow="md"
      // The toolbar's clicks are its own, kept from the preview's handlers
      // further out. (The section's own click-to-select runs first, in the
      // capture phase, and just re-picks the section it is on.)
      onClick={(event) => event.stopPropagation()}
    >
      <Tooltip content={t('moveUp')} wrap>
        <IconButton
          {...button}
          aria-label={t('moveUp')}
          disabled={index <= 0}
          onClick={() => {
            onChange(moveSection(sections, section.id, -1))
            onMoved(section.id)
          }}
        >
          <LuArrowUp />
        </IconButton>
      </Tooltip>
      <Tooltip content={t('moveDown')} wrap>
        <IconButton
          {...button}
          aria-label={t('moveDown')}
          disabled={index < 0 || index >= sections.length - 1}
          onClick={() => {
            onChange(moveSection(sections, section.id, 1))
            onMoved(section.id)
          }}
        >
          <LuArrowDown />
        </IconButton>
      </Tooltip>
      <Box w="1px" h="4" bg="whiteAlpha.400" mx="0.5" />
      <Tooltip content={t('duplicate')} wrap>
        <IconButton
          {...button}
          aria-label={t('duplicate')}
          disabled={!canDuplicateSection(sections, section.id)}
          onClick={() => {
            const result = duplicateSection(sections, section.id)
            if (!result) return
            onChange(result.sections)
            onSelect(result.copy.id)
          }}
        >
          <LuCopy />
        </IconButton>
      </Tooltip>
      {required ? (
        <Tooltip content={t('required')} wrap>
          <IconButton {...button} aria-label={t('required')} disabled>
            <LuLock />
          </IconButton>
        </Tooltip>
      ) : (
        <Tooltip content={t('remove')}>
          <IconButton
            {...button}
            aria-label={t('remove')}
            onClick={() => {
              onRemoved()
              onChange(sections.filter((other) => other.id !== section.id))
            }}
          >
            <LuTrash2 />
          </IconButton>
        </Tooltip>
      )}
    </HStack>
  )
}
