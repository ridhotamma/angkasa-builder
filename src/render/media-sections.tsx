/**
 * Media sections: video, shoppable reels and looks, before-and-after, and
 * the two running strips (logos, words).
 */

import {
  AspectRatio,
  Box,
  Carousel,
  chakra,
  CloseButton,
  Dialog,
  Flex,
  Grid,
  HStack,
  IconButton,
  Image,
  Marquee,
  Popover,
  Portal,
  Stack,
  Text,
} from '@chakra-ui/react'
import { useState } from 'react'
import { LuChevronLeft, LuChevronRight, LuPlus } from 'react-icons/lu'

import { ImageWithFallback } from '@repo/theme'

import {
  readBoolean,
  readLink,
  readList,
  readNumber,
  readPoint,
  readRichText,
  readText,
  readVideo,
  type FieldValues,
} from '../model/fields'
import { textElementKey } from '../model/element-style'
import { SectionColumn } from './column'
import { findProductCard, useRenderEnvironment, type StorefrontProductCard } from './context'
import { useRenderText } from './copy'
import { useResponsive } from './hooks'
import { AmbientVideo, VideoFrame } from './media'
import { VelocityMarquee } from './motion'
import { EditableText, EmptyNotice, SectionHeading, SmartLink, useOverlayProps } from './primitives'
import { RichTextView } from './rich-text'
import { alignOf, useEmptyText, type SectionProps } from './sections'

/** Pixels per second for each running-strip speed; the same scale as the testimonials'. */
const SPEED = { slow: 25, normal: 45, fast: 80 } as const
const speedOf = (settings: FieldValues) =>
  SPEED[readText(settings, 'speed') as keyof typeof SPEED] ?? SPEED.normal

function ratioOf(value: string, fallback = 16 / 9): number {
  const [width, height] = value.split('/').map(Number)
  return width && height ? width / height : fallback
}

/* -------------------------------------------------------------------------- */
/* Video                                                                      */
/* -------------------------------------------------------------------------- */

export function VideoSection({ settings }: SectionProps) {
  const { imageUrl } = useRenderEnvironment()
  const text = useRenderText()
  const video = readVideo(settings, 'video')
  const align = alignOf(settings)
  const posterId = readText(settings, 'poster')
  const poster = posterId ? imageUrl(posterId, { width: 1600, height: 900 }) : null
  const ratio = ratioOf(readText(settings, 'ratio'))
  const vertical = ratio < 1

  return (
    <Stack as="section" gap="5" align={align === 'center' ? 'center' : 'stretch'}>
      {(readText(settings, 'heading') || readText(settings, 'subheading')) && (
        <SectionColumn>
          <Stack gap="2" textAlign={align} maxW="3xl" mx={align === 'center' ? 'auto' : undefined}>
            <SectionHeading align={align} field="heading">
              {readText(settings, 'heading')}
            </SectionHeading>
            <EditableText
              as="p"
              field="subheading"
              value={readText(settings, 'subheading')}
              color="fg.muted"
            />
          </Stack>
        </SectionColumn>
      )}
      {video ? (
        <Box w="full" maxW={vertical ? 'sm' : undefined} mx={vertical ? 'auto' : undefined}>
          <VideoFrame
            video={video}
            poster={poster}
            ratio={ratio}
            autoplay={readBoolean(settings, 'autoplay')}
            title={readText(settings, 'heading')}
          />
        </Box>
      ) : (
        <EmptyNotice>{text('pickVideo')}</EmptyNotice>
      )}
    </Stack>
  )
}

/* -------------------------------------------------------------------------- */
/* Shoppable reels                                                            */
/* -------------------------------------------------------------------------- */

/** The product a video or a hotspot is tagged with, as a compact chip. */
function ProductChip({
  product,
  onDark = false,
}: {
  product: StorefrontProductCard
  onDark?: boolean
}) {
  const { data, formatPrice } = useRenderEnvironment()
  return (
    <SmartLink
      link={{ kind: 'product', slug: product.slug }}
      display="flex"
      alignItems="center"
      gap="2.5"
      p="1.5"
      pr="3"
      rounded="l2"
      bg={onDark ? 'blackAlpha.600' : 'bg.panel'}
      color={onDark ? 'white' : 'fg'}
      backdropFilter={onDark ? 'blur(8px)' : undefined}
      borderWidth={onDark ? '0' : '1px'}
      borderColor="border.subtle"
      minW="0"
      _hover={{ bg: onDark ? 'blackAlpha.700' : 'bg.subtle' }}
    >
      <Box boxSize="10" rounded="l1" overflow="hidden" flexShrink="0" bg="bg.muted">
        <ImageWithFallback
          src={product.imageUrl ?? undefined}
          alt=""
          w="full"
          h="full"
          objectFit="cover"
          fallbackIconSize="4"
        />
      </Box>
      <Box minW="0">
        <Text fontSize="sm" fontWeight="medium" truncate>
          {product.name}
        </Text>
        <Text fontSize="xs" opacity={0.85} fontVariantNumeric="tabular-nums">
          {formatPrice(product.price, data.shop.currency)}
        </Text>
      </Box>
    </SmartLink>
  )
}

export function VideoReels({ settings }: SectionProps) {
  const { data, imageUrl } = useRenderEnvironment()
  const empty = useEmptyText()
  const items = readList(settings, 'items').filter(
    (item) => readVideo(item, 'video') || readText(item, 'poster'),
  )
  const perPage = Math.min(useResponsive({ base: 2, md: 3, lg: 5 }), Math.max(1, items.length))
  const [open, setOpen] = useState<string | null>(null)
  const overlay = useOverlayProps()
  const active = items.find((item) => item.id === open) ?? null

  const poster = (item: FieldValues) => {
    const id = readText(item, 'poster')
    return id ? imageUrl(id, { width: 540, height: 960 }) : null
  }

  return (
    <Stack as="section" gap="4">
      <SectionColumn>
        <SectionHeading field="heading">{readText(settings, 'heading')}</SectionHeading>
      </SectionColumn>
      {items.length === 0 ? (
        <EmptyNotice>{empty('items')}</EmptyNotice>
      ) : (
        <Carousel.Root
          slideCount={items.length}
          slidesPerPage={perPage}
          spacing="12px"
          allowMouseDrag
          gap="3"
        >
          <Box position="relative">
            <Carousel.ItemGroup>
              {items.map((item, index) => {
                const video = readVideo(item, 'video')
                const product = findProductCard(data, readText(item, 'productId'))
                return (
                  <Carousel.Item key={item.id} index={index}>
                    <Box
                      position="relative"
                      rounded="l3"
                      overflow="hidden"
                      bg="gray.900"
                      cursor="pointer"
                      onClick={() => setOpen(item.id)}
                    >
                      <AspectRatio ratio={9 / 16}>
                        {video?.source === 'upload' ? (
                          <AmbientVideo fileId={video.id} poster={poster(item)} />
                        ) : (
                          <ImageWithFallback
                            src={poster(item) ?? undefined}
                            alt=""
                            objectFit="cover"
                          />
                        )}
                      </AspectRatio>
                      <Stack
                        position="absolute"
                        insetX="0"
                        bottom="0"
                        p="2.5"
                        gap="2"
                        bgGradient="to-t"
                        gradientFrom="blackAlpha.700"
                        gradientTo="transparent"
                        pt="10"
                      >
                        {readText(item, 'caption') && (
                          <Text color="white" fontSize="sm" fontWeight="medium" lineClamp={2}>
                            {readText(item, 'caption')}
                          </Text>
                        )}
                        {product && (
                          <Box onClick={(event) => event.stopPropagation()}>
                            <ProductChip product={product} onDark />
                          </Box>
                        )}
                      </Stack>
                    </Box>
                  </Carousel.Item>
                )
              })}
            </Carousel.ItemGroup>
            {items.length > perPage && (
              <>
                <Carousel.PrevTrigger asChild>
                  <IconButton
                    position="absolute"
                    top="50%"
                    left="2"
                    transform="translateY(-50%)"
                    zIndex="1"
                    rounded="full"
                    size="sm"
                    variant="subtle"
                    bg="bg/85"
                    shadow="md"
                    hideBelow="md"
                  >
                    <LuChevronLeft />
                  </IconButton>
                </Carousel.PrevTrigger>
                <Carousel.NextTrigger asChild>
                  <IconButton
                    position="absolute"
                    top="50%"
                    right="2"
                    transform="translateY(-50%)"
                    zIndex="1"
                    rounded="full"
                    size="sm"
                    variant="subtle"
                    bg="bg/85"
                    shadow="md"
                    hideBelow="md"
                  >
                    <LuChevronRight />
                  </IconButton>
                </Carousel.NextTrigger>
              </>
            )}
          </Box>
        </Carousel.Root>
      )}

      <Dialog.Root
        {...overlay}
        open={active !== null}
        onOpenChange={({ open: next }) => !next && setOpen(null)}
        size="sm"
        placement="center"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content bg="gray.950" overflow="hidden" maxW="min(26rem, calc(100vw - 2rem))">
              {active && <ReelPlayer item={active} poster={poster(active)} />}
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" color="white" top="2" right="2" />
              </Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Stack>
  )
}

/** One reel, large, with sound and its product under it. */
function ReelPlayer({ item, poster }: { item: FieldValues; poster: string | null }) {
  const { data, videoUrl } = useRenderEnvironment()
  const video = readVideo(item, 'video')
  const product = findProductCard(data, readText(item, 'productId'))
  const src = video?.source === 'upload' ? (videoUrl?.(video.id) ?? null) : null

  return (
    <Stack gap="0">
      <AspectRatio ratio={9 / 16} maxH="75dvh">
        {src ? (
          <chakra.video
            src={src}
            poster={poster ?? undefined}
            autoPlay
            controls
            playsInline
            loop
            objectFit="contain"
            bg="black"
          />
        ) : (
          <ImageWithFallback src={poster ?? undefined} alt="" objectFit="contain" />
        )}
      </AspectRatio>
      {product && (
        <Box p="3">
          <ProductChip product={product} onDark />
        </Box>
      )}
    </Stack>
  )
}

/* -------------------------------------------------------------------------- */
/* Shop the look                                                              */
/* -------------------------------------------------------------------------- */

/** Keeps a hotspot's white ring visible on a pale photo. */
const DOT_RING_SHADOW = '0 1px 4px rgba(0, 0, 0, 0.35)'

export function Lookbook({ settings }: SectionProps) {
  const { data, imageUrl } = useRenderEnvironment()
  const empty = useEmptyText()
  const fileId = readText(settings, 'image')
  const src = fileId ? imageUrl(fileId, { width: 1400, height: 1400 }) : null
  const spots = readList(settings, 'hotspots')
    .map((spot) => ({ spot, product: findProductCard(data, readText(spot, 'productId')) }))
    .filter((entry): entry is { spot: typeof entry.spot; product: StorefrontProductCard } =>
      Boolean(entry.product),
    )
  const showList = readBoolean(settings, 'showList') && spots.length > 0
  const imageRight = readText(settings, 'imagePosition') === 'right'

  if (!src) return <EmptyNotice>{empty('image')}</EmptyNotice>

  const photo = (
    <Box position="relative" rounded="l3" overflow="hidden" bg="bg.subtle">
      <Image
        src={src}
        alt={readText(settings, 'heading')}
        w="full"
        display="block"
        loading="lazy"
      />
      {spots.map(({ spot, product }, index) => {
        const { x, y } = readPoint(spot, 'position')
        return (
          <Popover.Root key={spot.id} positioning={{ placement: 'top' }} lazyMount>
            <Popover.Trigger asChild>
              <IconButton
                aria-label={product.name}
                position="absolute"
                left={`${x}%`}
                top={`${y}%`}
                variant="plain"
                // The ring is the button itself — transparent, padded, with a
                // white border — and the disc sits inside it, so the two stay
                // concentric at any sub-pixel position. (A ring drawn as an
                // overlay outside the disc rounded differently and sat off-centre.)
                w="auto"
                h="auto"
                minW="0"
                p="1"
                rounded="full"
                borderWidth="2px"
                borderColor="white"
                shadow={DOT_RING_SHADOW}
                _hover={{ scale: '1.1' }}
                transition="scale 150ms"
                css={{
                  // Centred with the `translate` property, not `transform`. The
                  // browser applies `transform` first and `scale` after it, so
                  // the hover grow also scaled the centring shift and the dot
                  // slid as it grew; `translate` applies after `scale`, which
                  // then grows from the centre.
                  translate: '-50% -50%',
                  // A slow glow off the ring, so the dots read as tappable. A
                  // shadow follows the ring's own outline, so it cannot drift.
                  animation: 'pb-pulse 2.4s ease-out infinite',
                  animationDelay: `${index * 0.3}s`,
                  '@keyframes pb-pulse': {
                    '0%': { boxShadow: `0 0 0 0 rgba(255, 255, 255, 0.7), ${DOT_RING_SHADOW}` },
                    '100%': { boxShadow: `0 0 0 12px rgba(255, 255, 255, 0), ${DOT_RING_SHADOW}` },
                  },
                  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
                }}
              >
                <Flex
                  boxSize="7"
                  rounded="full"
                  bg="white"
                  color="gray.900"
                  align="center"
                  justify="center"
                  shadow="md"
                >
                  <LuPlus />
                </Flex>
              </IconButton>
            </Popover.Trigger>
            <Portal>
              <Popover.Positioner>
                <Popover.Content w="64" p="1.5">
                  <ProductChip product={product} />
                </Popover.Content>
              </Popover.Positioner>
            </Portal>
          </Popover.Root>
        )
      })}
    </Box>
  )

  const copy = (
    <Stack gap="4">
      <SectionHeading field="heading">{readText(settings, 'heading')}</SectionHeading>
      <RichTextView
        doc={readRichText(settings, 'body')}
        elementKey={textElementKey('body')}
        field="body"
      />
      {showList && (
        <Stack gap="2">
          {spots.map(({ spot, product }) => (
            <ProductChip key={spot.id} product={product} />
          ))}
        </Stack>
      )}
    </Stack>
  )

  if (!showList && !readText(settings, 'heading')) return <Box as="section">{photo}</Box>

  return (
    <SectionColumn>
      <Grid
        templateColumns={{ base: '1fr', md: imageRight ? '2fr 3fr' : '3fr 2fr' }}
        gap={{ base: '6', md: '10' }}
        alignItems="center"
      >
        <Box order={{ base: 0, md: imageRight ? 1 : 0 }}>{photo}</Box>
        {copy}
      </Grid>
    </SectionColumn>
  )
}

/* -------------------------------------------------------------------------- */
/* Before and after                                                           */
/* -------------------------------------------------------------------------- */

export function BeforeAfter({ settings }: SectionProps) {
  const { imageUrl } = useRenderEnvironment()
  const text = useRenderText()
  const [position, setPosition] = useState(readNumber(settings, 'start', 50))
  const before = readText(settings, 'before')
  const after = readText(settings, 'after')
  const beforeSrc = before ? imageUrl(before, { width: 1400, height: 1000 }) : null
  const afterSrc = after ? imageUrl(after, { width: 1400, height: 1000 }) : null

  const label = (value: string, side: 'left' | 'right') =>
    value && (
      <Text
        position="absolute"
        top="3"
        {...{ [side]: '3' }}
        px="2.5"
        py="1"
        rounded="l1"
        bg="blackAlpha.600"
        color="white"
        fontSize="xs"
        fontWeight="semibold"
        textTransform="uppercase"
        letterSpacing="wide"
        pointerEvents="none"
      >
        {value}
      </Text>
    )

  return (
    <Stack as="section" gap="5">
      {(readText(settings, 'heading') || readRichText(settings, 'body').content.length > 0) && (
        <SectionColumn>
          <Stack gap="2" maxW="3xl">
            <SectionHeading field="heading">{readText(settings, 'heading')}</SectionHeading>
            <RichTextView
              doc={readRichText(settings, 'body')}
              elementKey={textElementKey('body')}
              field="body"
            />
          </Stack>
        </SectionColumn>
      )}
      {beforeSrc && afterSrc ? (
        <Box position="relative" rounded="l3" overflow="hidden" userSelect="none">
          <Image src={afterSrc} alt="" w="full" display="block" loading="lazy" />
          <Image
            src={beforeSrc}
            alt=""
            position="absolute"
            inset="0"
            w="full"
            h="full"
            objectFit="cover"
            style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
          />
          {label(readText(settings, 'beforeLabel'), 'left')}
          {label(readText(settings, 'afterLabel'), 'right')}
          <Box
            position="absolute"
            top="0"
            bottom="0"
            w="2px"
            bg="white"
            shadow="0 0 0 1px rgba(0,0,0,0.15)"
            pointerEvents="none"
            style={{ left: `${position}%` }}
          >
            <Flex
              position="absolute"
              top="50%"
              left="50%"
              transform="translate(-50%, -50%)"
              boxSize="10"
              rounded="full"
              bg="white"
              color="gray.800"
              shadow="lg"
              align="center"
              justify="center"
            >
              <LuChevronLeft />
              <LuChevronRight />
            </Flex>
          </Box>
          {/* A real range input over the whole image: dragging anywhere works,
              and so do the keyboard and screen readers. */}
          <chakra.input
            type="range"
            min={0}
            max={100}
            step={0.5}
            value={position}
            aria-label={text('compareSlider')}
            onChange={(event) => setPosition(Number(event.currentTarget.value))}
            position="absolute"
            inset="0"
            w="full"
            h="full"
            opacity={0}
            cursor="ew-resize"
            m="0"
          />
        </Box>
      ) : (
        <EmptyNotice>{text('pickImages')}</EmptyNotice>
      )}
    </Stack>
  )
}

/* -------------------------------------------------------------------------- */
/* Running strips                                                             */
/* -------------------------------------------------------------------------- */

export function LogoList({ settings }: SectionProps) {
  const { imageUrl } = useRenderEnvironment()
  const empty = useEmptyText()
  const items = readList(settings, 'items').filter((item) => readText(item, 'image'))
  const grey = readBoolean(settings, 'grayscale')

  const logo = (item: FieldValues & { id: string }) => (
    <SmartLink
      key={item.id}
      link={readLink(item, 'link')}
      display="flex"
      alignItems="center"
      justifyContent="center"
      h={{ base: '10', md: '14' }}
      px={{ base: '3', md: '5' }}
      filter={grey ? 'grayscale(1)' : undefined}
      opacity={grey ? 0.7 : 1}
      transition="filter 200ms, opacity 200ms"
      _hover={{ filter: 'none', opacity: 1 }}
    >
      <Image
        src={imageUrl(readText(item, 'image'), { width: 320, height: 160 }) ?? undefined}
        alt={readText(item, 'alt')}
        maxH="full"
        maxW={{ base: '28', md: '40' }}
        objectFit="contain"
        loading="lazy"
      />
    </SmartLink>
  )

  return (
    <Stack as="section" gap="5">
      <SectionColumn>
        <SectionHeading align="center" field="heading">
          {readText(settings, 'heading')}
        </SectionHeading>
      </SectionColumn>
      {items.length === 0 ? (
        <EmptyNotice>{empty('items')}</EmptyNotice>
      ) : readText(settings, 'layout') === 'marquee' ? (
        <Marquee.Root
          speed={speedOf(settings)}
          spacing="2rem"
          autoFill
          pauseOnInteraction
          w="full"
          minW="0"
          overflow="hidden"
        >
          <Marquee.Edge side="start" />
          <Marquee.Viewport>
            <Marquee.Content>
              {items.map((item) => (
                <Marquee.Item key={item.id}>{logo(item)}</Marquee.Item>
              ))}
            </Marquee.Content>
          </Marquee.Viewport>
          <Marquee.Edge side="end" />
        </Marquee.Root>
      ) : (
        <Flex wrap="wrap" justify="center" align="center" gap={{ base: '2', md: '4' }}>
          {items.map(logo)}
        </Flex>
      )}
    </Stack>
  )
}

const SEPARATORS: Record<string, string> = { star: '✦', dot: '•', none: '' }

const TEXT_SIZES = {
  md: { base: 'xl', md: '2xl' },
  lg: { base: '2xl', md: '4xl' },
  xl: { base: '4xl', md: '7xl' },
} as const

const CHIP_HEIGHTS = {
  md: { base: '7', md: '8' },
  lg: { base: '8', md: '10' },
  xl: { base: '10', md: '12' },
} as const

/**
 * Big words — and now image and product chips — running across the page. The
 * loop quickens with the shopper's scroll velocity and eases back to its
 * resting pace; reduced motion gets the same row standing still.
 */
export function ScrollingText({ settings }: SectionProps) {
  const { data, imageUrl } = useRenderEnvironment()
  const empty = useEmptyText()
  const items = readList(settings, 'items').filter(
    (item) => readText(item, 'text') || readText(item, 'image') || readText(item, 'productId'),
  )
  const separator = SEPARATORS[readText(settings, 'separator')] ?? ''
  const sizeKey = readText(settings, 'size') as keyof typeof TEXT_SIZES
  const size = TEXT_SIZES[sizeKey] ?? TEXT_SIZES.lg
  const uppercase = readBoolean(settings, 'uppercase')

  if (items.length === 0) return <EmptyNotice>{empty('items')}</EmptyNotice>

  return (
    <VelocityMarquee
      speed={speedOf(settings)}
      direction={readText(settings, 'direction') === 'right' ? 'right' : 'left'}
      gap="0"
      py={{ base: '3', md: '5' }}
    >
      {items.map((item) => {
        const product = findProductCard(data, readText(item, 'productId'))
        const fileId = readText(item, 'image')
        const text = readText(item, 'text')
        return (
          <HStack key={item.id} gap={{ base: '4', md: '8' }} px={{ base: '2', md: '4' }}>
            {product ? (
              <ProductChip product={product} />
            ) : (
              <>
                {fileId && (
                  <Image
                    src={imageUrl(fileId, { width: 320, height: 320 }) ?? undefined}
                    alt={text}
                    h={CHIP_HEIGHTS[sizeKey] ?? CHIP_HEIGHTS.lg}
                    w="auto"
                    objectFit="contain"
                    loading="lazy"
                    flexShrink="0"
                  />
                )}
                {text && (
                  <Text
                    fontFamily="heading"
                    fontWeight="semibold"
                    fontSize={size}
                    lineHeight="1"
                    whiteSpace="nowrap"
                    letterSpacing={uppercase ? '0.02em' : '-0.02em'}
                    textTransform={uppercase ? 'uppercase' : undefined}
                  >
                    {text}
                  </Text>
                )}
              </>
            )}
            {separator && (
              <Text fontSize={size} lineHeight="1" color="brand.fg" aria-hidden>
                {separator}
              </Text>
            )}
          </HStack>
        )
      })}
    </VelocityMarquee>
  )
}

export { ProductChip }
