/**
 * Before / after — a comparison slider over two seller images.
 *
 * The reveal is a clip on the "before" layer, driven by a real `<input
 * type="range">` laid transparently over the frame: pointer drag, touch and
 * arrow keys all work through the browser's own control, with no custom
 * gesture code. A range input is also the one hidden control screen readers
 * know how to announce.
 */

import { Box, chakra, Text } from '@chakra-ui/react'
import { useState, type ChangeEvent } from 'react'

import { ImageWithFallback } from '@repo/theme'

import type { BlockSchema } from '../model/fields'
import { readNumber, readText } from '../model/fields'
import { registerWidget, type BlockRendererProps } from '../render/block-registry'
import { useRenderEnvironment } from '../render/context'

/** The transparent control over the frame; the browser's own slider drives both. */
const RangeInput = chakra('input')

/** Keep the divider on screen even for a rounded input. */
export function clampPosition(value: number): number {
  if (!Number.isFinite(value)) return 50
  return Math.min(100, Math.max(0, value))
}

export const beforeAfterSchema: BlockSchema = {
  type: 'widget-before-after',
  name: { en: 'Before / after', id: 'Sebelum / sesudah' },
  description: {
    en: 'Two photos with a draggable divider — a transformation visitors can scrub across.',
    id: 'Dua foto dengan pembatas yang bisa digeser — perubahan yang bisa ditelusuri pengunjung.',
  },
  fields: [
    {
      kind: 'image',
      key: 'beforeImage',
      label: { en: 'Before image', id: 'Gambar sebelum' },
    },
    {
      kind: 'image',
      key: 'afterImage',
      label: { en: 'After image', id: 'Gambar sesudah' },
    },
    {
      kind: 'text',
      key: 'beforeLabel',
      label: { en: 'Before label', id: 'Label sebelum' },
      max: 24,
      default: 'Before',
    },
    {
      kind: 'text',
      key: 'afterLabel',
      label: { en: 'After label', id: 'Label sesudah' },
      max: 24,
      default: 'After',
    },
    {
      kind: 'number',
      key: 'startPosition',
      label: { en: 'Start position (%)', id: 'Posisi awal (%)' },
      min: 0,
      max: 100,
      step: 1,
      default: 50,
    },
  ],
}

export function BeforeAfterWidget({ block }: BlockRendererProps) {
  const { imageUrl, mode } = useRenderEnvironment()
  const beforeId = readText(block.settings, 'beforeImage')
  const afterId = readText(block.settings, 'afterImage')
  const beforeSrc = beforeId ? imageUrl(beforeId, { width: 1200, height: 800 }) : null
  const afterSrc = afterId ? imageUrl(afterId, { width: 1200, height: 800 }) : null
  const beforeLabel = readText(block.settings, 'beforeLabel')
  const afterLabel = readText(block.settings, 'afterLabel')
  const [position, setPosition] = useState(() =>
    clampPosition(readNumber(block.settings, 'startPosition', 50)),
  )

  if (!beforeSrc || !afterSrc) {
    if (mode !== 'preview') return null
    return (
      <Box
        borderWidth="1px"
        borderStyle="dashed"
        borderColor="border"
        rounded="lg"
        minH="40"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Text fontSize="sm" color="fg.muted">
          Add a before and an after image.
        </Text>
      </Box>
    )
  }

  return (
    <Box
      data-widget="before-after"
      position="relative"
      aspectRatio="16/9"
      overflow="hidden"
      rounded="lg"
      bg="bg.subtle"
      _focusWithin={{ outline: '2px solid', outlineColor: 'brand.solid' }}
    >
      <ImageWithFallback
        src={afterSrc}
        alt={afterLabel || ''}
        position="absolute"
        inset="0"
        w="full"
        h="full"
        objectFit="cover"
        draggable={false}
      />
      <Box position="absolute" inset="0" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
        <ImageWithFallback
          src={beforeSrc}
          alt={beforeLabel || ''}
          w="full"
          h="full"
          objectFit="cover"
          draggable={false}
        />
      </Box>

      <Box
        position="absolute"
        top="0"
        bottom="0"
        left={`${position}%`}
        w="0.5"
        bg="white"
        boxShadow="0 0 0 1px rgba(0,0,0,0.25)"
        aria-hidden
      />

      {beforeLabel && (
        <Text
          position="absolute"
          top="3"
          left="3"
          px="2"
          py="1"
          rounded="md"
          bg="blackAlpha.600"
          color="white"
          fontSize="xs"
        >
          {beforeLabel}
        </Text>
      )}
      {afterLabel && (
        <Text
          position="absolute"
          top="3"
          right="3"
          px="2"
          py="1"
          rounded="md"
          bg="blackAlpha.600"
          color="white"
          fontSize="xs"
        >
          {afterLabel}
        </Text>
      )}

      <RangeInput
        type="range"
        min={0}
        max={100}
        step={1}
        value={position}
        aria-label={beforeLabel || afterLabel || 'Reveal'}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          setPosition(clampPosition(Number(event.target.value)))
        }
        position="absolute"
        inset="0"
        w="full"
        h="full"
        m="0"
        opacity="0"
        cursor="ew-resize"
      />
    </Box>
  )
}

/** Registers the schema and its renderer. Idempotent; see `./index`. */
export function registerBeforeAfter(): void {
  registerWidget(beforeAfterSchema, BeforeAfterWidget)
}
