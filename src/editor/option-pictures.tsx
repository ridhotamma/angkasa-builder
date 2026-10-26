/**
 * Pictures for the section and block options a seller understands faster by
 * seeing: alignment, widths, aspect ratios, and the layouts a section can take
 * (a grid, a slider, a bento, a list…).
 *
 * Kept in the editor, keyed by the field's key and its options, so no schema
 * has to describe how it is drawn. A select becomes picture cards only when
 * every one of its options has a picture here; anything else keeps its
 * dropdown or segments, never half a set of pictures.
 */

import { Box, Flex, Grid, HStack, Stack } from '@chakra-ui/react'
import type { ReactNode } from 'react'

import type { SelectField } from '../model/fields'

/* -------------------------------------------------------------------------- */
/* Strokes                                                                    */
/* -------------------------------------------------------------------------- */

/** A line of text. */
function Line({ w = 'full', strong = false }: { w?: string; strong?: boolean }) {
  return (
    <Box
      h={strong ? '1.5' : '1'}
      w={w}
      rounded="full"
      bg="currentColor"
      opacity={strong ? 0.75 : 0.45}
      flexShrink="0"
    />
  )
}

/** A photo or a card. */
function Tile({ w, h, flex }: { w?: string; h?: string; flex?: string }) {
  return <Box w={w} h={h} flex={flex} minW="0" rounded="2px" bg="currentColor" opacity="0.3" />
}

/** The page the drawing sits on. */
function Frame({ children, p = '1' }: { children: ReactNode; p?: string }) {
  return (
    <Box
      w="14"
      h="10"
      p={p}
      rounded="sm"
      borderWidth="1.5px"
      borderColor="currentColor"
      opacity="0.9"
      overflow="hidden"
      display="flex"
      flexDirection="column"
      gap="1"
    >
      {children}
    </Box>
  )
}

/* -------------------------------------------------------------------------- */
/* Families                                                                   */
/* -------------------------------------------------------------------------- */

function TextAlign({ to }: { to: 'left' | 'center' | 'right' }) {
  const align = to === 'left' ? 'flex-start' : to === 'right' ? 'flex-end' : 'center'
  return (
    <Stack gap="1" w="12" align={align}>
      <Line w="100%" strong />
      <Line w="65%" />
      <Line w="85%" />
    </Stack>
  )
}

/** Two blocks of different heights, placed along the cross axis. */
function VerticalAlign({ to }: { to: 'start' | 'center' | 'end' | 'stretch' }) {
  const align = to === 'start' ? 'flex-start' : to === 'end' ? 'flex-end' : to
  return (
    <Frame>
      <HStack gap="1" h="full" align={align}>
        <Tile flex="1" h={to === 'stretch' ? 'full' : '60%'} />
        <Tile flex="1" h={to === 'stretch' ? 'full' : '35%'} />
      </HStack>
    </Frame>
  )
}

/** Dots along a line: where a row of things sits. */
function HorizontalAlign({ to }: { to: 'start' | 'center' | 'end' }) {
  const justify = to === 'start' ? 'flex-start' : to === 'end' ? 'flex-end' : 'center'
  return (
    <Frame>
      <Flex h="full" align="center" justify={justify} gap="1">
        {[0, 1, 2].map((index) => (
          <Box key={index} boxSize="2" rounded="sm" bg="currentColor" opacity="0.5" />
        ))}
      </Flex>
    </Frame>
  )
}

function Measure({ share }: { share: number }) {
  return (
    <Frame>
      <Stack gap="1" h="full" justify="center" align="center">
        <Line w={`${share}%`} strong />
        <Line w={`${share}%`} />
        <Line w={`${Math.round(share * 0.7)}%`} />
      </Stack>
    </Frame>
  )
}

/** A box of the given shape, fitted inside the picture area. */
function Ratio({ w, h }: { w: number; h: number }) {
  const max = { w: 44, h: 36 }
  const scale = Math.min(max.w / w, max.h / h)
  return (
    <Box
      rounded="2px"
      borderWidth="1.5px"
      borderColor="currentColor"
      bg="currentColor"
      style={{
        width: `${Math.round(w * scale)}px`,
        height: `${Math.round(h * scale)}px`,
        backgroundColor: 'color-mix(in srgb, currentColor 18%, transparent)',
      }}
    />
  )
}

function ratioOf(value: string): { w: number; h: number } | null {
  if (value === 'square') return { w: 1, h: 1 }
  const match = /^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/.exec(value)
  return match ? { w: Number(match[1]), h: Number(match[2]) } : null
}

/** An image beside its words: a photo on one side, lines on the other. */
function ImageBeside({ side }: { side: 'left' | 'right' }) {
  return (
    <Frame>
      <HStack gap="1" h="full" flexDirection={side === 'left' ? 'row' : 'row-reverse'}>
        <Tile flex="1" h="full" />
        <Stack gap="1" flex="1" justify="center">
          <Line strong />
          <Line w="70%" />
        </Stack>
      </HStack>
    </Frame>
  )
}

/** Where words sit inside a box: at its top, middle or bottom. */
function ContentPosition({ at }: { at: 'top' | 'middle' | 'bottom' }) {
  const justify = at === 'top' ? 'flex-start' : at === 'bottom' ? 'flex-end' : 'center'
  return (
    <Box
      w="14"
      h="10"
      p="1.5"
      rounded="sm"
      bg="currentColor"
      style={{ backgroundColor: 'color-mix(in srgb, currentColor 22%, transparent)' }}
      display="flex"
      flexDirection="column"
      justifyContent={justify}
      gap="1"
    >
      <Line w="70%" strong />
      <Line w="45%" />
    </Box>
  )
}

function Columns({ split }: { split: [number, number] }) {
  return (
    <Frame>
      <HStack gap="1" h="full">
        <Tile flex={String(split[0])} h="full" />
        <Tile flex={String(split[1])} h="full" />
      </HStack>
    </Frame>
  )
}

function ButtonShape({ variant }: { variant: 'solid' | 'outline' | 'ghost' }) {
  return (
    <Box
      w="12"
      h="5"
      rounded="md"
      display="flex"
      alignItems="center"
      justifyContent="center"
      borderWidth={variant === 'outline' ? '1.5px' : '0'}
      borderColor="currentColor"
      bg={variant === 'solid' ? 'currentColor' : undefined}
    >
      <Box
        h="1"
        w="6"
        rounded="full"
        bg={variant === 'solid' ? 'bg.panel' : 'currentColor'}
        opacity={variant === 'ghost' ? 0.7 : 1}
      />
    </Box>
  )
}

/** The layouts a section's items can take, each as its arrangement. */
const LAYOUTS: Record<string, () => ReactNode> = {
  grid: () => (
    <Frame>
      <Grid templateColumns="repeat(3, 1fr)" gap="1" h="full">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <Tile key={index} h="full" />
        ))}
      </Grid>
    </Frame>
  ),
  slider: () => (
    <Frame>
      <HStack gap="1" h="full" overflow="hidden">
        <Tile w="40%" h="full" />
        <Tile w="40%" h="full" />
        <Tile w="25%" h="full" />
      </HStack>
    </Frame>
  ),
  bento: () => (
    <Frame>
      <Grid templateColumns="2fr 1fr" templateRows="1fr 1fr" gap="1" h="full">
        <Box gridRow="span 2" rounded="2px" bg="currentColor" opacity="0.3" />
        <Tile h="full" />
        <Tile h="full" />
      </Grid>
    </Frame>
  ),
  masonry: () => (
    <Frame>
      <HStack gap="1" h="full" align="stretch">
        {[
          ['60%', '40%'],
          ['35%', '65%'],
          ['50%', '50%'],
        ].map(([a, b], index) => (
          <Stack key={index} gap="1" flex="1">
            <Tile h={a} />
            <Tile h={b} />
          </Stack>
        ))}
      </HStack>
    </Frame>
  ),
  social: () => (
    <Frame>
      <HStack gap="1">
        <Box boxSize="1.5" rounded="full" bg="currentColor" opacity="0.6" />
        <Line w="40%" />
      </HStack>
      <Grid templateColumns="repeat(3, 1fr)" gap="0.5" flex="1">
        {[0, 1, 2].map((index) => (
          <Tile key={index} h="full" />
        ))}
      </Grid>
    </Frame>
  ),
  marquee: () => (
    <Frame>
      <HStack gap="1" h="full" ms="-2">
        {[0, 1, 2, 3].map((index) => (
          <Tile key={index} w="30%" h="70%" />
        ))}
      </HStack>
    </Frame>
  ),
  list: () => (
    <Frame>
      {[0, 1, 2].map((index) => (
        <HStack key={index} gap="1" flex="1">
          <Tile w="2.5" h="full" />
          <Line w="70%" />
        </HStack>
      ))}
    </Frame>
  ),
  tiles: () => (
    <Frame>
      <HStack gap="1" h="full">
        {[0, 1, 2].map((index) => (
          <Stack key={index} gap="0.5" flex="1" h="full">
            <Tile flex="1" />
            <Line w="80%" />
          </Stack>
        ))}
      </HStack>
    </Frame>
  ),
  contained: () => <ImageBeside side="left" />,
  split: () => (
    <Frame p="0">
      <HStack gap="1" h="full">
        <Box flex="1" h="full" bg="currentColor" opacity="0.3" />
        <Stack gap="1" flex="1" pe="1" justify="center">
          <Line strong />
          <Line w="70%" />
        </Stack>
      </HStack>
    </Frame>
  ),
  full: () => (
    <Frame p="0">
      <Box
        h="full"
        p="1.5"
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        gap="1"
        style={{ backgroundColor: 'color-mix(in srgb, currentColor 25%, transparent)' }}
      >
        <Line w="70%" strong />
        <Line w="50%" />
      </Box>
    </Frame>
  ),
  row: () => (
    <Frame>
      <HStack gap="1" h="full" justify="center">
        {[0, 1, 2, 3].map((index) => (
          <Box key={index} w="2" h="2" rounded="sm" bg="currentColor" opacity="0.5" />
        ))}
      </HStack>
    </Frame>
  ),
  locator: () => (
    <Frame>
      <HStack gap="1" h="full">
        <Stack gap="1" flex="1" justify="center">
          <Line />
          <Line />
          <Line />
        </Stack>
        <Tile flex="1" h="full" />
      </HStack>
    </Frame>
  ),
}

/** The FAQ's dividers: boxed items, lines between them, or none. */
const ITEM_DIVIDERS: Record<string, () => ReactNode> = {
  enclosed: () => (
    <Stack gap="1" w="12">
      {[0, 1].map((index) => (
        <Box key={index} p="1" rounded="sm" borderWidth="1.5px" borderColor="currentColor">
          <Line w="70%" />
        </Box>
      ))}
    </Stack>
  ),
  outline: () => (
    <Stack gap="1.5" w="12">
      {[0, 1].map((index) => (
        <Stack key={index} gap="1">
          <Line w="70%" />
          <Box h="1px" bg="currentColor" opacity="0.6" />
        </Stack>
      ))}
    </Stack>
  ),
  plain: () => (
    <Stack gap="2" w="12">
      <Line w="70%" />
      <Line w="55%" />
    </Stack>
  ),
}

/** Two option sets read as the same values; this is the one picture per value. */
function pictureFor(field: SelectField, value: string): ReactNode | null {
  const values = field.options.map((option) => option.value)
  const has = (...wanted: string[]) =>
    wanted.length === values.length && wanted.every((entry) => values.includes(entry))

  switch (field.key) {
    case 'align':
    case 'paginationAlign':
      if (has('left', 'center', 'right') || has('left', 'center')) {
        return <TextAlign to={value as 'left' | 'center' | 'right'} />
      }
      if (has('start', 'center', 'end', 'stretch')) {
        return <VerticalAlign to={value as 'start' | 'center' | 'end' | 'stretch'} />
      }
      if (has('start', 'center', 'end')) {
        return <HorizontalAlign to={value as 'start' | 'center' | 'end'} />
      }
      return null
    case 'width': {
      const share: Record<string, number> = {
        full: 95,
        wide: 85,
        medium: 65,
        narrow: 45,
        auto: 40,
      }
      return share[value] !== undefined ? <Measure share={share[value]!} /> : null
    }
    case 'ratio':
    case 'ratioMobile':
    case 'imageRatio': {
      if (value === 'auto') return <Ratio w={3} h={2} />
      const ratio = ratioOf(value)
      return ratio ? <Ratio {...ratio} /> : null
    }
    case 'layout':
      return LAYOUTS[value]?.() ?? null
    case 'widths':
      return value === 'equal' ? (
        <Columns split={[1, 1]} />
      ) : value === 'leftWide' ? (
        <Columns split={[3, 2]} />
      ) : value === 'rightWide' ? (
        <Columns split={[2, 3]} />
      ) : null
    case 'imagePosition':
      return value === 'left' || value === 'right' ? <ImageBeside side={value} /> : null
    case 'contentPosition':
      return value === 'top' || value === 'middle' || value === 'bottom' ? (
        <ContentPosition at={value} />
      ) : null
    case 'variant':
      if (has('solid', 'outline', 'ghost')) {
        return <ButtonShape variant={value as 'solid' | 'outline' | 'ghost'} />
      }
      return ITEM_DIVIDERS[value]?.() ?? null
    default:
      return null
  }
}

/** The carousel is the slider's twin; it is drawn the same way. */
LAYOUTS.carousel = LAYOUTS.slider!

/**
 * The picture for each of a select's options, in order — or `null` when any
 * option has none, so the field keeps its usual control.
 */
export function optionPictures(field: SelectField): ReactNode[] | null {
  const pictures = field.options.map((option) => pictureFor(field, option.value))
  return pictures.every((picture) => picture !== null) ? pictures : null
}

/** "Slider (geser)" → "Slider": the card names it, its tooltip says the rest. */
export function cardLabel(label: string): string {
  return label.split(' — ')[0]!.split(' (')[0]!
}
