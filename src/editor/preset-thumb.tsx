/**
 * A layout preset's thumbnail, drawn from its own block tree: a grid becomes
 * columns, a photo a filled box, a heading a dark bar, text two light ones, a
 * button a pill. Built from the data rather than shipped as a picture, so the
 * thumbnail can never drift from what the preset actually adds.
 */

import { Box, Grid, Stack } from '@chakra-ui/react'
import type { ReactNode } from 'react'

import type { PresetBlock } from '../model/block-presets'

function children(block: PresetBlock): PresetBlock[] {
  const nested = block.settings?.blocks
  return Array.isArray(nested) ? (nested as PresetBlock[]) : []
}

function Part({ block }: { block: PresetBlock }): ReactNode {
  const align = block.settings?.align === 'center' ? 'center' : 'stretch'
  switch (block.type) {
    case 'grid':
    case 'row': {
      const count = Math.min(4, Number(block.settings?.columns) || children(block).length || 2)
      return (
        <Grid
          templateColumns={`repeat(${count}, minmax(0, 1fr))`}
          gap="1"
          alignItems={block.settings?.align === 'center' ? 'center' : 'start'}
        >
          {children(block).map((child, index) => (
            <Part key={index} block={child} />
          ))}
        </Grid>
      )
    }
    case 'column':
      return (
        <Stack gap="0.5" align={align}>
          {children(block).map((child, index) => (
            <Part key={index} block={child} />
          ))}
        </Stack>
      )
    case 'image':
      return (
        <Box
          w="full"
          rounded="2px"
          bg="fg.subtle"
          opacity="0.35"
          aspectRatio={block.settings?.ratio === '1/1' ? '1' : '4 / 3'}
        />
      )
    case 'heading':
      return <Box h="1.5" w="70%" rounded="full" bg="fg.muted" />
    case 'richtext':
      return (
        <Stack gap="0.5" w="full" align={align}>
          <Box h="1" w="90%" rounded="full" bg="fg.subtle" opacity="0.5" />
          <Box h="1" w="60%" rounded="full" bg="fg.subtle" opacity="0.5" />
        </Stack>
      )
    case 'button':
      return <Box h="2" w="8" mt="0.5" rounded="full" bg="brand.solid" opacity="0.8" />
    case 'icon':
      return <Box boxSize="2.5" rounded="full" bg="brand.solid" opacity="0.6" />
    default:
      return null
  }
}

export function PresetThumb({ blocks }: { blocks: readonly PresetBlock[] }) {
  return (
    <Box w="full" p="2" rounded="md" bg="bg.subtle" aria-hidden="true">
      <Stack gap="1">
        {blocks.map((block, index) => (
          <Part key={index} block={block} />
        ))}
      </Stack>
    </Box>
  )
}
