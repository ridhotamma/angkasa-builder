/**
 * An icon on a small brand-tinted square — how a choice's icon is shown in
 * select triggers and option lists, so every picker reads the same.
 *
 * Colours come from the `brand` semantic tokens in `system.ts`: `brand.subtle`
 * behind, `brand.fg` for the glyph. In dark mode `brand.subtle` is a surface
 * grey, so the tile stays quiet there while the glyph keeps the brand colour.
 */

import { Center, Icon, type CenterProps } from '@chakra-ui/react'
import type { IconType } from 'react-icons'

const SIZES = {
  sm: { box: '6', icon: '3.5', radius: 'sm' },
  md: { box: '8', icon: '4', radius: 'md' },
} as const

export interface IconTileProps extends Omit<CenterProps, 'children'> {
  icon: IconType
  size?: keyof typeof SIZES
}

export function IconTile({ icon, size = 'sm', ...rest }: IconTileProps) {
  const { box, icon: iconSize, radius } = SIZES[size]
  return (
    <Center
      boxSize={box}
      rounded={radius}
      bg="brand.subtle"
      color="brand.fg"
      flexShrink="0"
      aria-hidden
      {...rest}
    >
      <Icon as={icon} boxSize={iconSize} />
    </Center>
  )
}
