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
import { useRenderEnvironment } from './context'
import { useRenderText } from './copy'
import { featureIcon } from './icons'
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

/** One to six columns: phones get one (or two for four or more), tablets up to three. */
function columnsOf(value: string, count: number) {
  const n = Math.min(6, Math.max(1, Number(value) || 3), Math.max(1, count))
  return { base: n >= 4 ? 2 : 1, md: Math.min(3, n), lg: n }
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
        <SimpleGrid columns={columnsOf(readText(settings, 'columns'), items.length)} gap="5">
          {items.map((item) => {
            const image = readText(item, 'image')
            const linkLabel = readText(item, 'linkLabel')
            return (
              <Card.Root key={item.id} bg="bg.panel" rounded="l3" overflow="hidden" {...frame}>
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
                    >
                      {linkLabel} →
                    </SmartLink>
                  )}
                </Card.Body>
              </Card.Root>
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
  const imageRight = readText(settings, 'imagePosition') === 'right'

  useEffect(() => {
    const first = refs.current.find(Boolean)
    const view = first?.ownerDocument.defaultView
    if (!first || !view || !('IntersectionObserver' in view)) return
    const observer = new view.IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const index = refs.current.indexOf(entry.target as HTMLDivElement)
          if (index >= 0) setActive(index)
        }
      },
      // A chapter is "the one being read" while it crosses the middle of the screen.
      { rootMargin: '-45% 0px -45% 0px' },
    )
    refs.current.forEach((element) => element && observer.observe(element))
    return () => observer.disconnect()
  }, [steps.length])

  if (steps.length === 0) return <EmptyNotice>{empty('items')}</EmptyNotice>

  const src = (step: FieldValues) => {
    const id = readText(step, 'image')
    return id ? imageUrl(id, { width: 1000, height: 1250 }) : null
  }

  return (
    <Stack as="section" gap="6">
      <SectionHeading field="heading">{readText(settings, 'heading')}</SectionHeading>
      <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={{ md: '12' }}>
        <Box hideBelow="md" order={imageRight ? 1 : 0}>
          <Box position="sticky" top="24">
            <AspectRatio ratio={4 / 5} rounded="l3" overflow="hidden" bg="bg.subtle">
              <Box>
                {steps.map((step, index) => (
                  <ImageWithFallback
                    key={step.id}
                    src={src(step) ?? undefined}
                    alt=""
                    position="absolute"
                    inset="0"
                    w="full"
                    h="full"
                    objectFit="cover"
                    opacity={index === active ? 1 : 0}
                    transform={index === active ? 'scale(1)' : 'scale(1.04)'}
                    transition="opacity 700ms ease, transform 1200ms ease"
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
              ref={(element: HTMLDivElement | null) => {
                refs.current[index] = element
              }}
              gap="4"
              minH={{ md: '70svh' }}
              justify="center"
              opacity={{ base: 1, md: index === active ? 1 : 0.35 }}
              transition="opacity 400ms ease"
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
        <RichTextView doc={readRichText(settings, 'body')} align={align} />
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
          columns={{ ...gridColumns(readText(settings, 'columns')), base: 2 }}
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

export function StoreLocations({ settings }: SectionProps) {
  const { imageUrl } = useRenderEnvironment()
  const { frame } = useCardStyle()
  const text = useRenderText()
  const empty = useEmptyText()
  const items = readList(settings, 'items').filter((item) => readText(item, 'name'))

  return (
    <Stack as="section" gap="5">
      <SectionHeading field="heading">{readText(settings, 'heading')}</SectionHeading>
      {items.length === 0 ? (
        <EmptyNotice>{empty('items')}</EmptyNotice>
      ) : (
        <SimpleGrid columns={columnsOf(readText(settings, 'columns'), items.length)} gap="4">
          {items.map((item) => {
            const image = readText(item, 'image')
            const tel = telHref(readText(item, 'phone'))
            const map = readLink(item, 'mapLink')
            return (
              <Card.Root key={item.id} bg="bg.panel" rounded="l3" overflow="hidden" {...frame}>
                {image && (
                  <AspectRatio ratio={16 / 9} bg="bg.subtle">
                    <ImageWithFallback
                      src={imageUrl(image, { width: 800, height: 450 }) ?? undefined}
                      alt=""
                      objectFit="cover"
                      loading="lazy"
                    />
                  </AspectRatio>
                )}
                <Card.Body gap="3">
                  <Heading as="h3" size="md">
                    {readText(item, 'name')}
                  </Heading>
                  {readText(item, 'address') && (
                    <HStack align="start" gap="2" color="fg.muted" fontSize="sm">
                      <Icon as={LuMapPin} mt="0.5" flexShrink="0" />
                      <Text whiteSpace="pre-line">{readText(item, 'address')}</Text>
                    </HStack>
                  )}
                  {readText(item, 'hours') && (
                    <HStack align="start" gap="2" color="fg.muted" fontSize="sm">
                      <Icon as={LuClock} mt="0.5" flexShrink="0" />
                      <Text whiteSpace="pre-line">{readText(item, 'hours')}</Text>
                    </HStack>
                  )}
                  <HStack gap="2" pt="1" wrap="wrap">
                    {map.kind !== 'none' && (
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        colorPalette="brand"
                        rounded="full"
                      >
                        <SmartLink link={map}>
                          <LuNavigation />
                          {text('directions')}
                        </SmartLink>
                      </Button>
                    )}
                    {tel && (
                      <Button asChild size="sm" variant="ghost" rounded="full">
                        <ChakraLink href={tel} unstyled>
                          <LuPhone />
                          {readText(item, 'phone')}
                        </ChakraLink>
                      </Button>
                    )}
                  </HStack>
                </Card.Body>
              </Card.Root>
            )
          })}
        </SimpleGrid>
      )}
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
  const wa = whatsappHref(readText(settings, 'whatsapp'), readText(settings, 'whatsappMessage'))
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
