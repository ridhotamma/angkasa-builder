/**
 * Shared palette previews for the theme settings and the look picker.
 *
 * One place draws a palette's colours so the quick selector, the look cards,
 * the palette cards and the AI recommendation all show the same swatches.
 */

import { Box, Text } from '@chakra-ui/react'

import type { ThemeSettings } from '../model/settings'

/** The four colours as a segmented bar: background, brand, text, accent. */
export function PaletteStrip({ colors }: { colors: ThemeSettings['colors'] }) {
  return (
    <>
      <Box flex="2" h="100%" bg={colors.background} />
      <Box flex="2" h="100%" bg={colors.brand} />
      <Box flex="1" h="100%" bg={colors.text} />
      <Box flex="1" h="100%" bg={colors.accent} />
    </>
  )
}

/** The palette as dots, with an optional type sample in its own colours. */
export function PaletteDots({
  colors,
  sample = false,
  size = 'md',
}: {
  colors: ThemeSettings['colors']
  sample?: boolean
  size?: 'sm' | 'md'
}) {
  const dot = size === 'sm' ? '3' : '5'
  return (
    <>
      <Box boxSize={dot} rounded="full" bg={colors.brand} />
      <Box boxSize={dot} rounded="full" bg={colors.text} />
      <Box boxSize={dot} rounded="full" bg={colors.accent} />
      {sample && (
        <Text fontSize="xs" fontWeight="bold" ml="auto" color={colors.text}>
          Aa
        </Text>
      )}
    </>
  )
}
