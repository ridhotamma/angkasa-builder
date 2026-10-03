/**
 * Countdown — days, hours, minutes and seconds to a moment.
 *
 * The same hydration rule the countdown section follows: the server renders
 * dashes, and the digits appear once the page is live, so the first paint the
 * browser hydrates is exactly the one the server sent. The widget works inside
 * any custom layout, where the section cannot go.
 */

import { Box, HStack, Stack, Text } from '@chakra-ui/react'

import type { BlockSchema } from '../model/fields'
import { readDate, readText } from '../model/fields'
import { registerWidget, type BlockRendererProps } from '../render/block-registry'
import { useRenderEnvironment } from '../render/context'
import { useMounted, useNow } from '../render/hooks'

export interface CountdownParts {
  days: number
  hours: number
  minutes: number
  seconds: number
}

/** A duration split into whole units; never negative. */
export function splitRemaining(ms: number): CountdownParts {
  const total = Math.max(0, Math.floor(ms / 1000))
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  }
}

export const countdownSchema: BlockSchema = {
  type: 'widget-countdown',
  name: { en: 'Countdown', id: 'Hitung mundur' },
  description: {
    en: 'Time left until a moment — a launch, a flash sale, a closing date.',
    id: 'Waktu tersisa menuju momen — peluncuran, promo kilat, tanggal tutup.',
  },
  fields: [
    {
      kind: 'datetime',
      key: 'endsAt',
      label: { en: 'Ends at', id: 'Berakhir pada' },
    },
    {
      kind: 'text',
      key: 'heading',
      label: { en: 'Heading', id: 'Judul' },
      max: 80,
      default: '',
    },
    {
      kind: 'text',
      key: 'endedText',
      label: { en: 'Text after it ends', id: 'Teks setelah berakhir' },
      max: 120,
      default: 'This offer has ended.',
    },
  ],
}

export function CountdownWidget({ block }: BlockRendererProps) {
  const { mode } = useRenderEnvironment()
  const mounted = useMounted()
  const now = useNow(1000)
  const end = readDate(block.settings, 'endsAt')
  const heading = readText(block.settings, 'heading')
  const endedText = readText(block.settings, 'endedText')

  if (!end) {
    if (mode !== 'preview') return null
    return (
      <Box
        data-widget="countdown"
        borderWidth="1px"
        borderStyle="dashed"
        borderColor="border"
        rounded="lg"
        minH="24"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Text fontSize="sm" color="fg.muted">
          Pick the moment this countdown ends.
        </Text>
      </Box>
    )
  }

  const left = end.getTime() - now.getTime()
  const parts = splitRemaining(left)
  const units = [
    { value: parts.days, label: 'Days' },
    { value: parts.hours, label: 'Hours' },
    { value: parts.minutes, label: 'Minutes' },
    { value: parts.seconds, label: 'Seconds' },
  ]

  return (
    <Stack gap="3" data-widget="countdown" align="start">
      {heading && <Text fontWeight="semibold">{heading}</Text>}
      {left <= 0 ? (
        <Text color="fg.muted">{endedText}</Text>
      ) : (
        <HStack gap={{ base: '2', md: '3' }} role="timer" aria-live="off">
          {units.map((unit) => (
            <Stack
              key={unit.label}
              gap="1"
              align="center"
              minW={{ base: '14', md: '18' }}
              py={{ base: '2', md: '3' }}
              rounded="lg"
              bg="bg.subtle"
              borderWidth="1px"
              borderColor="border.subtle"
            >
              <Text
                fontFamily="heading"
                fontSize={{ base: 'xl', md: '3xl' }}
                fontWeight="bold"
                lineHeight="1"
                fontVariantNumeric="tabular-nums"
              >
                {mounted ? String(unit.value).padStart(2, '0') : '––'}
              </Text>
              <Text fontSize="xs" color="fg.muted" textTransform="uppercase" letterSpacing="wide">
                {unit.label}
              </Text>
            </Stack>
          ))}
        </HStack>
      )}
    </Stack>
  )
}

/** Registers the schema and its renderer. Idempotent; see `./index`. */
export function registerCountdown(): void {
  registerWidget(countdownSchema, CountdownWidget)
}
