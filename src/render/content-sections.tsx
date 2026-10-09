/**
 * Storytelling and shop-information sections: columns, a scrolling story, a
 * timeline, tables, icons with text, store locations and the chat buttons.
 */

import {
  AspectRatio,
  Box,
  Button,
  Card,
  Circle,
  Grid,
  Heading,
  HStack,
  Icon,
  Image,
  Link as ChakraLink,
  SimpleGrid,
  Stack,
  Table,
  Text,
} from '@chakra-ui/react'
import { useEffect, useRef, useState } from 'react'
import { FaWhatsapp } from 'react-icons/fa6'
import { LuClock, LuMail, LuMapPin, LuNavigation, LuPhone } from 'react-icons/lu'

import { StoreMap } from '@repo/geoapify/store-map'
import { externalMapUrl } from '@repo/geoapify/urls'
import { ImageWithFallback } from '@repo/theme'

import {
  readBoolean,
  readLink,
  readList,
  readRichText,
  readTable,
  readText,
  type FieldValues,
} from '../model/fields'
import { textElementKey } from '../model/element-style'
import { NO_LINK, type Link } from '../model/links'
import { STICKY_BELOW_HEADER } from './chrome'
import { useRenderEnvironment, type StorefrontRenderData } from './context'
import { useRenderText } from './copy'
import { featureIcon } from './icons'
import { Tilt } from './motion'
import { useMotionEffect } from './motion/engine'
import {
  EditableText,
  EmptyNotice,
  gridColumns,
  Paragraphs,
  SectionHeading,
  SmartLink,
  useCardStyle,
} from './primitives'
import { RichTextView } from './rich-text'
import { alignOf, useEmptyText, type SectionProps } from './sections'

function ratioOf(value: string, fallback = 4 / 3): number {
  const [width, height] = value.split('/').map(Number)
  return width && height ? width / height : fallback
}

/**
 * One to six columns: the phone choice (one or two, defaulting to the old
 * one-or-two-by-width rule), tablets up to three.
 */
function columnsOf(value: string, count: number, mobileColumns?: string) {
  const n = Math.min(6, Math.max(1, Number(value) || 3), Math.max(1, count))
  const base = mobileColumns === '1' ? 1 : mobileColumns === '2' ? 2 : n >= 4 ? 2 : 1
  return { base, md: Math.min(3, n), lg: n }
}

/* -------------------------------------------------------------------------- */
/* Columns                                                                    */
/* -------------------------------------------------------------------------- */

export function Multicolumn({ settings }: SectionProps) {
  const { imageUrl } = useRenderEnvironment()
  const { frame, flat } = useCardStyle()
  const empty = useEmptyText()
  const items = readList(settings, 'items')
  const align = alignOf(settings)
  const ratio = ratioOf(readText(settings, 'imageRatio'))

  return (
    <Stack as="section" gap="5">
      <SectionHeading align={align} field="heading">
        {readText(settings, 'heading')}
      </SectionHeading>
      {items.length === 0 ? (
        <EmptyNotice>{empty('items')}</EmptyNotice>
      ) : (
        <SimpleGrid
          columns={columnsOf(
            readText(settings, 'columns'),
            items.length,
            readText(settings, 'mobileColumns'),
          )}
          gap="5"
        >
          {items.map((item) => {
            const image = readText(item, 'image')
            const linkLabel = readText(item, 'linkLabel')
            return (
              <Tilt key={item.id}>
                <Card.Root
                  h="full"
                  bg="bg.panel"
                  rounded="l3"
                  overflow="hidden"
                  css={{
                    '&:hover img': { transform: 'scale(1.05)' },
                    '@media (prefers-reduced-motion: reduce)': {
                      '&:hover img': { transform: 'none' },
                    },
                  }}
                  {...frame}
                >
                  {image && (
                    <AspectRatio
                      ratio={ratio}
                      bg="bg.subtle"
                      rounded={flat ? 'l3' : undefined}
                      overflow="hidden"
                    >
                      <ImageWithFallback
                        src={
                          imageUrl(image, { width: 800, height: Math.round(800 / ratio) }) ??
                          undefined
                        }
                        alt=""
                        objectFit="cover"
                        loading="lazy"
                        transition="transform 600ms ease"
                      />
                    </AspectRatio>
                  )}
                  <Card.Body gap="2" textAlign={align} p={flat ? '2' : '5'} pt={flat ? '4' : '5'}>
                    {readText(item, 'title') && (
                      <Heading as="h3" size="md">
                        {readText(item, 'title')}
                      </Heading>
                    )}
                    <Paragraphs text={readText(item, 'text')} align={align} />
                    {linkLabel && (
                      <SmartLink
                        link={readLink(item, 'link')}
                        color="brand.fg"
                        fontWeight="semibold"
                        fontSize="sm"
                        mt="1"
                        data-sweep=""
                      >
                        {linkLabel} →
                      </SmartLink>
                    )}
                  </Card.Body>
                </Card.Root>
              </Tilt>
            )
          })}
        </SimpleGrid>
      )}
    </Stack>
  )
}

/* -------------------------------------------------------------------------- */
/* Scrolling story                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Chapters beside one picture that stays on screen and changes to the
 * chapter being read. On a phone, where there is no room beside the text,
 * each chapter simply shows its own picture above it.
 */
export function ScrollingStory({ settings }: SectionProps) {
  const { imageUrl } = useRenderEnvironment()
  const empty = useEmptyText()
  const steps = readList(settings, 'steps')
  const [active, setActive] = useState(0)
  const refs = useRef<Array<HTMLDivElement | null>>([])
  const sectionRef = useRef<HTMLDivElement>(null)
  const previous = useRef(0)
  const imageRight = readText(settings, 'imagePosition') === 'right'

  useEffect(() => {
    const first = refs.current.find(Boolean)
    const view = first?.ownerDocument.defaultView
    if (!first || !view || !('IntersectionObserver' in view)) return
    const observer = new view.IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          // The chapter being read is the one crossing the middle of the
          // screen. A zero-height band there is unambiguous at every scroll
          // position — on a boundary it flips exactly once, either direction.
          const index = refs.current.indexOf(entry.target as HTMLDivElement)
          if (index >= 0) setActive(index)
        }
      },
      { rootMargin: '-50% 0px -50% 0px' },
    )
    refs.current.forEach((element) => element && observer.observe(element))
    return () => observer.disconnect()
  }, [steps.length])

  // The crossfade between chapters, tweened by GSAP from wherever the last
  // switch left the picture. Desktop only: below `md` each chapter shows its
  // own still, and the dimming is a desktop reading aid.
  useMotionEffect(
    sectionRef,
    ({ gsap }) => {
      const element = sectionRef.current
      const view = element?.ownerDocument.defaultView
      if (!element || !view || view.innerWidth < 768) return
      const images = element.querySelectorAll<HTMLElement>('[data-story-image]')
      const texts = element.querySelectorAll<HTMLElement>('[data-story-text]')
      const from = previous.current
      images.forEach((image, index) => {
        gsap.fromTo(
          image,
          { autoAlpha: index === from ? 1 : 0, scale: index === from ? 1 : 1.04 },
          {
            autoAlpha: index === active ? 1 : 0,
            scale: index === active ? 1 : 1.04,
            duration: index === active ? 0.7 : 0.5,
            ease: 'power2.out',
            overwrite: 'auto',
          },
        )
      })
      texts.forEach((text, index) => {
        gsap.to(text, {
          opacity: index === active ? 1 : 0.35,
          duration: 0.4,
          ease: 'power2.out',
          overwrite: 'auto',
        })
      })
      previous.current = active

      // Leaving the desktop layout must drop the inline styles: below `md`
      // every chapter is plain text, undimmed.
      const desktop = view.matchMedia('(min-width: 768px)')
      const onLayoutChange = () => {
        if (!desktop.matches) {
          gsap.set([...images, ...texts], { clearProps: 'opacity,visibility,transform' })
        }
      }
      desktop.addEventListener('change', onLayoutChange)
      return () => desktop.removeEventListener('change', onLayoutChange)
    },
    [active],
  )

  if (steps.length === 0) return <EmptyNotice>{empty('items')}</EmptyNotice>

  const src = (step: FieldValues) => {
    const id = readText(step, 'image')
    return id ? imageUrl(id, { width: 1000, height: 1250 }) : null
  }

  return (
    <Stack ref={sectionRef} as="section" gap="6">
      <SectionHeading field="heading">{readText(settings, 'heading')}</SectionHeading>
      <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={{ md: '12' }}>
        <Box hideBelow="md" order={imageRight ? 1 : 0}>
          <Box position="sticky" top={STICKY_BELOW_HEADER}>
            <AspectRatio ratio={4 / 5} rounded="l3" overflow="hidden" bg="bg.subtle">
              <Box>
                {steps.map((step, index) => (
                  <ImageWithFallback
                    key={step.id}
                    data-story-image=""
                    src={src(step) ?? undefined}
                    alt=""
                    position="absolute"
                    inset="0"
                    w="full"
                    h="full"
                    objectFit="cover"
                    opacity={index === active ? 1 : 0}
                    transform={index === active ? 'scale(1)' : 'scale(1.04)'}
                    loading={index === 0 ? 'eager' : 'lazy'}
                  />
                ))}
              </Box>
            </AspectRatio>
          </Box>
        </Box>
        <Stack gap={{ base: '10', md: '0' }}>
          {steps.map((step, index) => (
            <Stack
              key={step.id}
              data-story-text=""
              ref={(element: HTMLDivElement | null) => {
                refs.current[index] = element
              }}
              gap="4"
              minH={{ md: '70svh' }}
              justify="center"
              opacity={{ base: 1, md: index === active ? 1 : 0.35 }}
            >
              <AspectRatio
                ratio={4 / 5}
                rounded="l3"
                overflow="hidden"
                bg="bg.subtle"
                hideFrom="md"
              >
                <ImageWithFallback
                  src={src(step) ?? undefined}
                  alt=""
                  objectFit="cover"
                  loading="lazy"
                />
              </AspectRatio>
              <Text
                fontSize="sm"
                color="brand.fg"
                fontWeight="semibold"
                fontVariantNumeric="tabular-nums"
              >
                {String(index + 1).padStart(2, '0')}
              </Text>
              {readText(step, 'heading') && (
                <Heading as="h3" size={{ base: 'xl', md: '2xl' }} letterSpacing="-0.01em">
                  {readText(step, 'heading')}
                </Heading>
              )}
              <RichTextView doc={readRichText(step, 'body')} />
            </Stack>
          ))}
        </Stack>
      </Grid>
    </Stack>
  )
}

/* -------------------------------------------------------------------------- */
/* Timeline                                                                   */
/* -------------------------------------------------------------------------- */

export function Timeline({ settings }: SectionProps) {
  const { imageUrl } = useRenderEnvironment()
  const empty = useEmptyText()
  const items = readList(settings, 'items')

  return (
    <Stack as="section" gap="8">
      <SectionHeading align="center" field="heading">
        {readText(settings, 'heading')}
      </SectionHeading>
      {items.length === 0 ? (
        <EmptyNotice>{empty('items')}</EmptyNotice>
      ) : (
        <Box position="relative">
          {/* The spine: down the left on a phone, down the middle on a desktop —
              the centre of the dot column either way (half of 1.5rem, or 50%),
              pulled back by half its width so it runs through the dots' centres. */}
          <Box
            position="absolute"
            top="2"
            bottom="2"
            left={{ base: '3', md: '50%' }}
            w="2px"
            bg="border"
            transform="translateX(-1px)"
            zIndex="0"
          />
          <Stack gap={{ base: '8', md: '12' }}>
            {items.map((item, index) => {
              const image = readText(item, 'image')
              const right = index % 2 === 1
              return (
                // Every piece is placed by column, in one row. (Ordering them
                // instead put a left-hand milestone's text in the 3rem middle
                // track, one word per line.) Phones: dot | text. Desktop:
                // text | dot | — then — | dot | text, alternating.
                <Grid
                  key={item.id}
                  templateColumns={{
                    base: '1.5rem minmax(0, 1fr)',
                    md: 'minmax(0, 1fr) 3rem minmax(0, 1fr)',
                  }}
                  columnGap={{ base: '4', md: '0' }}
                  alignItems="start"
                >
                  <Box
                    gridRow="1"
                    gridColumn={{ base: '1', md: '2' }}
                    display="flex"
                    justifyContent="center"
                    pt="1"
                    // Positioned, so it paints above the (absolutely placed) spine.
                    position="relative"
                    zIndex="1"
                  >
                    <Circle
                      size="4"
                      bg="brand.solid"
                      borderWidth="3px"
                      borderColor="bg"
                      shadow="0 0 0 2px var(--chakra-colors-brand-solid)"
                    />
                  </Box>
                  <Stack
                    gap="2"
                    gridRow="1"
                    gridColumn={{ base: '2', md: right ? '3' : '1' }}
                    textAlign={{ base: 'left', md: right ? 'left' : 'right' }}
                    align={{ base: 'start', md: right ? 'start' : 'end' }}
                    px={{ md: '6' }}
                  >
                    {readText(item, 'label') && (
                      <Text fontSize="sm" fontWeight="bold" color="brand.fg" letterSpacing="wide">
                        {readText(item, 'label')}
                      </Text>
                    )}
                    {readText(item, 'title') && (
                      <Heading as="h3" size="lg">
                        {readText(item, 'title')}
                      </Heading>
                    )}
                    {/* Plain text rather than `Paragraphs`, which sets its own
                        left alignment: a milestone on the left reads right-aligned. */}
                    {readText(item, 'text') && (
                      <Text color="fg.muted" whiteSpace="pre-line" lineHeight="tall">
                        {readText(item, 'text')}
                      </Text>
                    )}
                    {image && (
                      <Image
                        src={imageUrl(image, { width: 640, height: 420 }) ?? undefined}
                        alt=""
                        rounded="l2"
                        maxW="xs"
                        w="full"
                        aspectRatio={3 / 2}
                        objectFit="cover"
                        loading="lazy"
                      />
                    )}
                  </Stack>
                </Grid>
              )
            })}
          </Stack>
        </Box>
      )}
    </Stack>
  )
}

/* -------------------------------------------------------------------------- */
/* Table                                                                      */
/* -------------------------------------------------------------------------- */

/** A comparison or size table. Shared with the product page's size guide. */
export function DataTable({
  table,
  highlightFirstColumn = true,
  striped = true,
}: {
  table: ReturnType<typeof readTable>
  highlightFirstColumn?: boolean
  striped?: boolean
}) {
  return (
    <Table.ScrollArea borderWidth="1px" borderColor="border.subtle" rounded="l3">
      <Table.Root size="sm" striped={striped} interactive={false}>
        <Table.Header>
          <Table.Row bg="bg.muted">
            {table.columns.map((column, index) => (
              <Table.ColumnHeader key={index} fontWeight="semibold" color="fg" whiteSpace="nowrap">
                {column}
              </Table.ColumnHeader>
            ))}
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {table.rows.map((row, rowIndex) => (
            <Table.Row key={rowIndex} bg="transparent">
              {row.map((cell, cellIndex) => (
                <Table.Cell
                  key={cellIndex}
                  fontWeight={highlightFirstColumn && cellIndex === 0 ? 'semibold' : undefined}
                  fontVariantNumeric="tabular-nums"
                >
                  {cell}
                </Table.Cell>
              ))}
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </Table.ScrollArea>
  )
}

export function TableSection({ settings }: SectionProps) {
  const empty = useEmptyText()
  const table = readTable(settings, 'table')
  const align = alignOf(settings)
  const hasCells = table.columns.some(Boolean) || table.rows.some((row) => row.some(Boolean))

  return (
    <Box
      as="section"
      maxW={readText(settings, 'width') === 'wide' ? '5xl' : '3xl'}
      mx={align === 'center' ? 'auto' : undefined}
    >
      <Stack gap="4">
        <SectionHeading align={align} field="heading">
          {readText(settings, 'heading')}
        </SectionHeading>
        <RichTextView
          doc={readRichText(settings, 'body')}
          align={align}
          elementKey={textElementKey('body')}
          field="body"
        />
        {hasCells ? (
          <DataTable
            table={table}
            highlightFirstColumn={readBoolean(settings, 'highlightFirstColumn')}
            striped={readBoolean(settings, 'striped')}
          />
        ) : (
          <EmptyNotice>{empty('items')}</EmptyNotice>
        )}
      </Stack>
    </Box>
  )
}

/* -------------------------------------------------------------------------- */
/* Icons with text                                                            */
/* -------------------------------------------------------------------------- */

export function IconFeatures({ settings }: SectionProps) {
  const empty = useEmptyText()
  const items = readList(settings, 'items').filter(
    (item) => readText(item, 'title') || readText(item, 'text'),
  )
  const align = alignOf(settings)
  const circle = readText(settings, 'iconStyle') !== 'plain'

  return (
    <Stack as="section" gap="6">
      <SectionHeading align={align} field="heading">
        {readText(settings, 'heading')}
      </SectionHeading>
      {items.length === 0 ? (
        <EmptyNotice>{empty('items')}</EmptyNotice>
      ) : (
        <SimpleGrid
          columns={gridColumns(readText(settings, 'columns'), readText(settings, 'mobileColumns'))}
          gap={{ base: '6', md: '8' }}
        >
          {items.map((item) => (
            <Stack
              key={item.id}
              gap="3"
              align={align === 'center' ? 'center' : 'start'}
              textAlign={align}
            >
              {circle ? (
                <Circle size={{ base: '12', md: '14' }} bg="brand.subtle" color="brand.fg">
                  <Icon as={featureIcon(readText(item, 'icon'))} boxSize={{ base: '5', md: '6' }} />
                </Circle>
              ) : (
                <Icon as={featureIcon(readText(item, 'icon'))} boxSize="8" color="brand.fg" />
              )}
              <Stack gap="1">
                {readText(item, 'title') && (
                  <Text fontWeight="semibold" fontSize={{ base: 'sm', md: 'md' }}>
                    {readText(item, 'title')}
                  </Text>
                )}
                {readText(item, 'text') && (
                  <Text fontSize="sm" color="fg.muted">
                    {readText(item, 'text')}
                  </Text>
                )}
              </Stack>
            </Stack>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  )
}

/* -------------------------------------------------------------------------- */
/* Store locations                                                            */
/* -------------------------------------------------------------------------- */

/** A phone number as a `tel:` URL: digits and a leading plus only, so nothing else can ride along. */
function telHref(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '')
  return digits.length >= 6 ? `tel:${digits}` : null
}

/** One store location, however it was sourced. */
interface StoreLocationEntry {
  id: string
  name: string
  address: string
  hours: string
  phone: string
  /** A media file id, when the seller gave one (branches have no photo). */
  image: string
  /** The seller's own directions link, when they set one. */
  link: Link
  latitude: number | null
  longitude: number | null
}

/** A number from a text field, or `null` when it is blank or out of range. */
function readCoordinate(value: string, max: number): number | null {
  const parsed = Number(value.trim())
  return value.trim() !== '' && Number.isFinite(parsed) && Math.abs(parsed) <= max ? parsed : null
}

function mapsSearchHref(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}

/** Where "directions" goes: the seller's own link, or the pin/address. */
function directionsFor(entry: StoreLocationEntry): Link {
  if (entry.link.kind !== 'none') return entry.link
  if (entry.latitude !== null && entry.longitude !== null) {
    return {
      kind: 'url',
      href: externalMapUrl({ latitude: entry.latitude, longitude: entry.longitude }),
    }
  }
  return entry.address ? { kind: 'url', href: mapsSearchHref(entry.address) } : NO_LINK
}

/**
 * The stores a location section draws, best source first: the shop's real
 * branches, then the seller's own list, then the shop's single address. A shop
 * with branches never shows the stale list it typed before branches existed.
 */
function locationsFor(settings: FieldValues, data: StorefrontRenderData): StoreLocationEntry[] {
  const branches = data.branches ?? []
  if (branches.length > 0) {
    return branches.map((branch) => ({
      id: branch.id,
      name: branch.name,
      address: branch.address,
      hours: '',
      phone: branch.phone ?? '',
      image: '',
      link: NO_LINK,
      latitude: Number.isFinite(branch.latitude) ? branch.latitude : null,
      longitude: Number.isFinite(branch.longitude) ? branch.longitude : null,
    }))
  }

  const items = readList(settings, 'items').filter((item) => readText(item, 'name'))
  if (items.length > 0) {
    return items.map((item) => ({
      id: item.id,
      name: readText(item, 'name'),
      address: readText(item, 'address'),
      hours: readText(item, 'hours'),
      phone: readText(item, 'phone'),
      image: readText(item, 'image'),
      link: readLink(item, 'mapLink'),
      latitude: readCoordinate(readText(item, 'latitude'), 90),
      longitude: readCoordinate(readText(item, 'longitude'), 180),
    }))
  }

  const address = data.shop.address?.trim()
  if (address) {
    return [
      {
        id: 'shop',
        name: data.shop.name,
        address,
        hours: '',
        phone: data.shop.phone ?? '',
        image: '',
        link: NO_LINK,
        latitude: Number.isFinite(data.shop.latitude) ? (data.shop.latitude ?? null) : null,
        longitude: Number.isFinite(data.shop.longitude) ? (data.shop.longitude ?? null) : null,
      },
    ]
  }

  return []
}

function hasPin(entry: StoreLocationEntry): boolean {
  return entry.latitude !== null && entry.longitude !== null
}

/** The address, hours and phone rows every location shows. */
function LocationDetails({ entry }: { entry: StoreLocationEntry }) {
  return (
    <>
      {entry.address && (
        <HStack align="start" gap="2" color="fg.muted" fontSize="sm">
          <Icon as={LuMapPin} mt="0.5" flexShrink="0" />
          <Text whiteSpace="pre-line">{entry.address}</Text>
        </HStack>
      )}
      {entry.hours && (
        <HStack align="start" gap="2" color="fg.muted" fontSize="sm">
          <Icon as={LuClock} mt="0.5" flexShrink="0" />
          <Text whiteSpace="pre-line">{entry.hours}</Text>
        </HStack>
      )}
    </>
  )
}

/** Directions and call links, shared by the grid and the locator list. */
function LocationActions({ entry, directions }: { entry: StoreLocationEntry; directions: Link }) {
  const text = useRenderText()
  const tel = telHref(entry.phone)
  return (
    <HStack gap="2" pt="1" wrap="wrap">
      {directions.kind !== 'none' && (
        <Button asChild size="sm" variant="outline" colorPalette="brand" rounded="full">
          <SmartLink link={directions}>
            <LuNavigation />
            {text('directions')}
          </SmartLink>
        </Button>
      )}
      {tel && (
        <Button asChild size="sm" variant="ghost" rounded="full">
          <ChakraLink href={tel} unstyled>
            <LuPhone />
            {entry.phone}
          </ChakraLink>
        </Button>
      )}
    </HStack>
  )
}

export function StoreLocations({ settings }: SectionProps) {
  const { data, imageUrl } = useRenderEnvironment()
  const { frame } = useCardStyle()
  const empty = useEmptyText()
  const entries = locationsFor(settings, data)
  const locator = readText(settings, 'layout') === 'locator'
  const showMap = readBoolean(settings, 'showMap')
  const points = entries.filter(hasPin).map((entry) => ({
    id: entry.id,
    latitude: entry.latitude!,
    longitude: entry.longitude!,
    label: entry.name,
  }))

  // The locator's selection: the first pinned store until the shopper picks
  // another, falling back if the entries change under it.
  const [picked, setPicked] = useState<string | null>(() => points[0]?.id ?? null)
  const selected = points.some((point) => point.id === picked) ? picked : (points[0]?.id ?? null)

  if (entries.length === 0) {
    return (
      <Stack as="section" gap="5">
        <SectionHeading field="heading">{readText(settings, 'heading')}</SectionHeading>
        <EmptyNotice>{empty('items')}</EmptyNotice>
      </Stack>
    )
  }

  if (locator) {
    return (
      <Stack as="section" gap="5">
        <SectionHeading field="heading">{readText(settings, 'heading')}</SectionHeading>
        <Grid
          // Without a single pin the map column has nothing to hold, so the
          // list takes the full width instead of leaving a blank half.
          templateColumns={
            points.length > 0 ? { base: '1fr', lg: 'minmax(0, 2fr) minmax(0, 3fr)' } : '1fr'
          }
          gap={{ base: '5', lg: '8' }}
          alignItems="start"
        >
          {/* On phones and tablets the map comes first, so a tap on a store
              flies a map that is already on screen; on a computer the list
              stays on the left, the classic locator. */}
          <Stack order={{ base: 1, lg: 0 }} gap="3">
            {entries.map((entry) => {
              const active = entry.id === selected
              const directions = directionsFor(entry)
              return (
                <Box
                  key={entry.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={active}
                  cursor="pointer"
                  textAlign="left"
                  rounded="l3"
                  p={{ base: '4', md: '5' }}
                  bg={active ? 'brand.subtle' : 'bg.panel'}
                  borderWidth="1px"
                  borderColor={active ? 'brand.solid' : 'border.subtle'}
                  transition="border-color 150ms ease, background-color 150ms ease"
                  onClick={() => setPicked(entry.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setPicked(entry.id)
                    }
                  }}
                  _focusVisible={{ outlineWidth: '2px', outlineColor: 'brand.solid' }}
                >
                  <Stack gap="3">
                    <Heading as="h3" size="md">
                      {entry.name}
                    </Heading>
                    <LocationDetails entry={entry} />
                    {/* The links keep their own click; selecting the card is
                        not what a tap on "directions" asked for. */}
                    <Box onClick={(event) => event.stopPropagation()}>
                      <LocationActions entry={entry} directions={directions} />
                    </Box>
                  </Stack>
                </Box>
              )
            })}
          </Stack>

          {points.length > 0 && (
            <Box
              order={{ base: 0, lg: 1 }}
              position={{ base: 'relative', lg: 'sticky' }}
              top={{ lg: STICKY_BELOW_HEADER }}
            >
              <StoreMap
                points={points}
                selectedId={selected}
                height={{ base: '16rem', md: '22rem', lg: '30rem' }}
              />
            </Box>
          )}
        </Grid>
      </Stack>
    )
  }

  return (
    <Stack as="section" gap="5">
      <SectionHeading field="heading">{readText(settings, 'heading')}</SectionHeading>
      {showMap && points.length > 0 && (
        <StoreMap points={points} height={{ base: '14rem', md: '20rem' }} />
      )}
      <SimpleGrid
        columns={columnsOf(
          readText(settings, 'columns'),
          entries.length,
          readText(settings, 'mobileColumns'),
        )}
        gap="4"
      >
        {entries.map((entry) => {
          const directions = directionsFor(entry)
          return (
            <Card.Root key={entry.id} bg="bg.panel" rounded="l3" overflow="hidden" {...frame}>
              {entry.image && (
                <AspectRatio ratio={16 / 9} bg="bg.subtle">
                  <ImageWithFallback
                    src={imageUrl(entry.image, { width: 800, height: 450 }) ?? undefined}
                    alt=""
                    objectFit="cover"
                    loading="lazy"
                  />
                </AspectRatio>
              )}
              <Card.Body gap="3">
                <Heading as="h3" size="md">
                  {entry.name}
                </Heading>
                <LocationDetails entry={entry} />
                <LocationActions entry={entry} directions={directions} />
              </Card.Body>
            </Card.Root>
          )
        })}
      </SimpleGrid>
    </Stack>
  )
}

/* -------------------------------------------------------------------------- */
/* Chat with us                                                               */
/* -------------------------------------------------------------------------- */

/**
 * A WhatsApp number as a wa.me link. Indonesian numbers are written with a
 * leading 0 or +62; wa.me wants the country code and digits only.
 */
export function whatsappHref(number: string, message: string): string | null {
  let digits = number.replace(/\D/g, '')
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`
  if (digits.length < 8 || digits.length > 15) return null
  const text = message.trim()
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

const EMAIL = /^[^\s@<>()"']+@[^\s@<>()"']+\.[a-z]{2,}$/i

export function ContactCta({ settings }: SectionProps) {
  const { data, mode } = useRenderEnvironment()
  const text = useRenderText()
  const align = alignOf(settings)
  // The section's own words win; a shop that never filled them still reaches
  // the number and inbox saved in shop settings.
  const wa = whatsappHref(
    readText(settings, 'whatsapp') || data.shop.phone || '',
    readText(settings, 'whatsappMessage'),
  )
  const email = readText(settings, 'email') || data.shop.email || ''
  const mail = EMAIL.test(email) ? `mailto:${email}` : null
  const stop = (event: { preventDefault: () => void }) =>
    mode === 'preview' && event.preventDefault()

  return (
    <Stack
      as="section"
      gap="5"
      align={align === 'center' ? 'center' : 'start'}
      textAlign={align}
      maxW="3xl"
      mx={align === 'center' ? 'auto' : undefined}
    >
      <SectionHeading align={align} field="heading">
        {readText(settings, 'heading')}
      </SectionHeading>
      <EditableText
        as="p"
        field="subheading"
        value={readText(settings, 'subheading')}
        color="fg.muted"
        fontSize="lg"
      />
      <HStack gap="3" wrap="wrap" justify={align === 'center' ? 'center' : 'start'}>
        {wa && (
          <Button
            asChild
            size="lg"
            rounded="full"
            bg="#25D366"
            color="white"
            _hover={{ bg: '#1ebe5b' }}
          >
            <ChakraLink href={wa} target="_blank" rel="noopener noreferrer" unstyled onClick={stop}>
              <FaWhatsapp />
              {readText(settings, 'whatsappLabel')}
            </ChakraLink>
          </Button>
        )}
        {mail && (
          <Button asChild size="lg" rounded="full" variant="outline" colorPalette="brand">
            <ChakraLink href={mail} unstyled onClick={stop}>
              <LuMail />
              {readText(settings, 'emailLabel')}
            </ChakraLink>
          </Button>
        )}
      </HStack>
      {!wa && !mail && <EmptyNotice>{text('contactMissing')}</EmptyNotice>}
    </Stack>
  )
}
