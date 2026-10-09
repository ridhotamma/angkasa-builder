/**
 * The premium sections' renderers (docs/PREMIUM-VISUALS.md, Tier 3 and the
 * local Tier 4 pieces).
 *
 * Every one receives already-sanitised settings, draws its final state on the
 * server, and stands down for reduced motion. Media plays only when the
 * shopper asks (a dialog), or ambiently and muted with a poster fallback.
 */

import {
  AspectRatio,
  Box,
  CloseButton,
  Dialog,
  Flex,
  Grid,
  Heading,
  IconButton,
  Portal,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react'
import { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from 'react'
import { createPortal } from 'react-dom'
import { FaWhatsapp } from 'react-icons/fa6'
import { LuArrowUp, LuMail, LuPlay, LuRotate3D } from 'react-icons/lu'

import { ImageWithFallback } from '@repo/theme'

import {
  readBoolean,
  readLink,
  readList,
  readRichText,
  readText,
  readVideo,
  type FieldValues,
  type VideoRef,
} from '../model/fields'
import type { SectionType } from '../model/sections'
import { resolveScheme, schemeCssVars, themeCssVarGroups } from '../model/settings'
import { textElementKey } from '../model/element-style'
import { TABBAR_HEIGHT_VAR } from './chrome'
import { SectionColumn } from './column'
import { whatsappHref } from './content-sections'
import { useRenderEnvironment } from './context'
import { schemeCss, useSectionLayout } from './frame'
import { usePrefersReducedMotion } from './hooks'
import { BackgroundVideo, VideoFrame } from './media'
import {
  ButtonRow,
  EmptyNotice,
  PageColumn,
  SectionHeading,
  SmartLink,
  ThemeText,
  useCardStyle,
  useOverlayProps,
} from './primitives'
import { RichTextView } from './rich-text'
import { alignOf, heroHeight, overlayProps, useEmptyText, type SectionProps } from './sections'

const COLUMNS: Record<string, number> = { '2': 2, '3': 3, '4': 4, '6': 6 }

function readColumns(settings: FieldValues, fallback: number, fallbackKey = '3'): number {
  return COLUMNS[readText(settings, 'columns') || fallbackKey] ?? fallback
}

/** The phone choice a columns field stores: one, or two. */
function readMobileColumns(settings: FieldValues): number {
  return readText(settings, 'mobileColumns') === '2' ? 2 : 1
}

/* -------------------------------------------------------------------------- */
/* Newsletter                                                                 */
/* -------------------------------------------------------------------------- */

/** A links-first signup invitation: the form lives wherever the seller links. */
export function Newsletter({ settings }: SectionProps) {
  const align = alignOf(settings)
  const note = readText(settings, 'note')
  return (
    <Stack
      gap="4"
      maxW="2xl"
      mx="auto"
      textAlign={align}
      align={align === 'center' ? 'center' : 'flex-start'}
    >
      <SectionHeading align={align} field="heading">
        {readText(settings, 'heading')}
      </SectionHeading>
      <RichTextView
        doc={readRichText(settings, 'body')}
        elementKey={textElementKey('body')}
        field="body"
      />
      <ButtonRow settings={settings} align={align} />
      {note && (
        <ThemeText
          as="p"
          elementKey={textElementKey('note')}
          field="note"
          value={note}
          fontSize="sm"
          color="fg.muted"
        />
      )}
    </Stack>
  )
}

/* -------------------------------------------------------------------------- */
/* Background video                                                           */
/* -------------------------------------------------------------------------- */

const BAND_POSITION: Record<string, 'flex-start' | 'center' | 'flex-end'> = {
  top: 'flex-start',
  middle: 'center',
  bottom: 'flex-end',
}

export function BackgroundVideoSection({ settings }: SectionProps) {
  const { imageUrl } = useRenderEnvironment()
  const { width, contentWidth } = useSectionLayout()
  const video = readVideo(settings, 'video')
  const posterId = readText(settings, 'poster')
  const poster = posterId ? imageUrl(posterId, { width: 1920, height: 1080 }) : null
  const height = heroHeight(settings)
  const align = alignOf(settings)
  const middle = readText(settings, 'contentPosition') === 'middle'
  const edge = width === 'edge'

  const copy = (
    <Stack
      gap="4"
      maxW="3xl"
      textAlign={align}
      align={align === 'center' ? 'center' : 'flex-start'}
      color="white"
    >
      {readText(settings, 'heading') && (
        <ThemeText
          as="h2"
          elementKey={textElementKey('heading')}
          field="heading"
          value={readText(settings, 'heading')}
          fontSize={{ base: '3xl', md: '5xl' }}
          letterSpacing="-0.025em"
        />
      )}
      {readText(settings, 'subheading') && (
        <ThemeText
          as="p"
          elementKey={textElementKey('subheading')}
          field="subheading"
          value={readText(settings, 'subheading')}
          fontSize={{ base: 'md', md: 'xl' }}
          opacity={0.92}
        />
      )}
      <RichTextView
        doc={readRichText(settings, 'body')}
        elementKey={textElementKey('body')}
        field="body"
        inheritColor
      />
      {!middle && <ButtonRow settings={settings} align={align} onImage />}
    </Stack>
  )

  return (
    <Box
      position="relative"
      rounded={edge ? 'none' : 'l3'}
      overflow="hidden"
      minH={height}
      bg="gray.900"
    >
      <BackgroundVideo video={video} poster={poster} />
      <Flex
        position="relative"
        minH={height}
        align={BAND_POSITION[readText(settings, 'contentPosition')] ?? 'flex-end'}
        justify={align === 'center' ? 'center' : 'start'}
        px={edge ? '0' : { base: '6', md: '12' }}
        py={{ base: '6', md: '12' }}
        {...overlayProps(readText(settings, 'overlay'))}
      >
        {edge ? (
          <PageColumn maxW={contentWidth}>
            <Flex w="full" justify={align === 'center' ? 'center' : 'start'}>
              {copy}
            </Flex>
          </PageColumn>
        ) : (
          copy
        )}
        {middle && <Box />}
      </Flex>
    </Box>
  )
}

/* -------------------------------------------------------------------------- */
/* Masonry gallery + lightbox                                                 */
/* -------------------------------------------------------------------------- */

export function MasonryGallery({ settings }: SectionProps) {
  const { imageUrl } = useRenderEnvironment()
  const empty = useEmptyText()
  const overlay = useOverlayProps()
  const items = readList(settings, 'items').filter((item) => readText(item, 'image'))
  const [active, setActive] = useState<number | null>(null)
  if (items.length === 0) return <EmptyNotice>{empty('items')}</EmptyNotice>
  const activeItem = active === null ? null : items[active]
  const activeSrc = activeItem
    ? imageUrl(readText(activeItem, 'image'), { width: 1800, height: 1400 })
    : null

  return (
    <Stack gap="6">
      <SectionColumn>
        <SectionHeading field="heading">{readText(settings, 'heading')}</SectionHeading>
      </SectionColumn>
      <Box
        columns={{ base: readMobileColumns(settings), sm: 2, md: readColumns(settings, 3) }}
        columnGap="4"
        css={{ '& > *': { breakInside: 'avoid', mb: '4' } }}
      >
        {items.map((item, index) => {
          const src = imageUrl(readText(item, 'image'), { width: 900, height: 1100 })
          if (!src) return null
          const link = readLink(item, 'link')
          return (
            <Box key={item.id} as="div" position="relative">
              <IconButton
                aria-label={readText(item, 'alt') || 'Open photo'}
                variant="plain"
                display="block"
                w="full"
                h="auto"
                p="0"
                rounded="l2"
                overflow="hidden"
                cursor="zoom-in"
                onClick={() => setActive(index)}
                _hover={{ opacity: 0.92 }}
              >
                <ImageWithFallback
                  src={src}
                  alt={readText(item, 'alt')}
                  w="full"
                  objectFit="cover"
                  loading="lazy"
                />
              </IconButton>
              {link.kind !== 'none' && (
                <SmartLink
                  link={link}
                  position="absolute"
                  bottom="2"
                  right="2"
                  bg="blackAlpha.600"
                  color="white"
                  rounded="full"
                  px="2.5"
                  py="1"
                  fontSize="xs"
                >
                  {readText(item, 'alt') || 'View'}
                </SmartLink>
              )}
            </Box>
          )
        })}
      </Box>

      <Dialog.Root
        {...overlay}
        open={active !== null}
        onOpenChange={({ open: next }) => !next && setActive(null)}
        size="xl"
        placement="center"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content bg="gray.950" overflow="hidden">
              {activeSrc && (
                <ImageWithFallback
                  src={activeSrc}
                  alt={activeItem ? readText(activeItem, 'alt') : ''}
                  w="full"
                  maxH="82dvh"
                  objectFit="contain"
                />
              )}
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

/* -------------------------------------------------------------------------- */
/* Video testimonials                                                         */
/* -------------------------------------------------------------------------- */

/**
 * A poster for a testimonial: the seller's own image, or the video's own
 * still. YouTube exposes one at a stable, id-only URL; Vimeo's needs an API
 * call, so an upload or a Vimeo clip without a poster shows the plain frame.
 */
function videoPoster(video: VideoRef | null, poster: string | null): string | null {
  if (poster) return poster
  return video?.source === 'youtube' ? `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg` : null
}

export function VideoTestimonials({ settings }: SectionProps) {
  const { imageUrl } = useRenderEnvironment()
  const empty = useEmptyText()
  const overlay = useOverlayProps()
  const { frame } = useCardStyle()
  const items = readList(settings, 'items').filter(
    (item) => readText(item, 'name') || readText(item, 'quote') || readVideo(item, 'video'),
  )
  const [active, setActive] = useState<FieldValues | null>(null)
  const video = active ? readVideo(active, 'video') : null
  const activePoster = active
    ? videoPoster(
        video,
        (() => {
          const id = readText(active, 'poster')
          return id ? imageUrl(id, { width: 1280, height: 720 }) : null
        })(),
      )
    : null

  if (items.length === 0) return <EmptyNotice>{empty('items')}</EmptyNotice>

  return (
    <Stack gap="6">
      <SectionColumn>
        <SectionHeading field="heading">{readText(settings, 'heading')}</SectionHeading>
      </SectionColumn>
      <SimpleGrid
        columns={{ base: readMobileColumns(settings), md: readColumns(settings, 3) }}
        gap="5"
      >
        {items.map((item) => {
          const itemVideo = readVideo(item, 'video')
          const posterId = readText(item, 'poster')
          const poster = videoPoster(
            itemVideo,
            posterId ? imageUrl(posterId, { width: 800, height: 450 }) : null,
          )
          return (
            <Box key={item.id} bg="bg.panel" rounded="l3" overflow="hidden" {...frame}>
              <Stack gap="3">
                <Box position="relative" bg="bg.subtle">
                  <AspectRatio ratio={16 / 9}>
                    {poster ? (
                      <ImageWithFallback src={poster} alt="" objectFit="cover" loading="lazy" />
                    ) : (
                      <Box />
                    )}
                  </AspectRatio>
                  {itemVideo && (
                    <IconButton
                      aria-label="Play testimonial"
                      position="absolute"
                      inset="0"
                      m="auto"
                      boxSize="12"
                      rounded="full"
                      colorPalette="brand"
                      onClick={() => setActive(item)}
                    >
                      <LuPlay />
                    </IconButton>
                  )}
                </Box>
                <Stack gap="1.5" p="4" pt="0">
                  {readText(item, 'quote') && (
                    <Text color="fg.muted" lineHeight="tall">
                      “{readText(item, 'quote')}”
                    </Text>
                  )}
                  <Text fontWeight="semibold">{readText(item, 'name')}</Text>
                  {readText(item, 'role') && (
                    <Text fontSize="sm" color="fg.muted">
                      {readText(item, 'role')}
                    </Text>
                  )}
                </Stack>
              </Stack>
            </Box>
          )
        })}
      </SimpleGrid>

      <Dialog.Root
        {...overlay}
        open={active !== null}
        onOpenChange={({ open: next }) => !next && setActive(null)}
        size="lg"
        placement="center"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content bg="gray.950" overflow="hidden" p="0">
              {video && (
                <VideoFrame
                  video={video}
                  poster={activePoster}
                  ratio={16 / 9}
                  autoplay
                  title={active ? readText(active, 'name') : 'Testimonial'}
                />
              )}
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

/* -------------------------------------------------------------------------- */
/* Team                                                                       */
/* -------------------------------------------------------------------------- */

export function Team({ settings }: SectionProps) {
  const { imageUrl } = useRenderEnvironment()
  const empty = useEmptyText()
  const { frame, flat } = useCardStyle()
  const align = alignOf(settings)
  const items = readList(settings, 'items').filter(
    (item) => readText(item, 'name') || readText(item, 'photo'),
  )
  if (items.length === 0) return <EmptyNotice>{empty('items')}</EmptyNotice>

  return (
    <Stack gap="6">
      <SectionColumn>
        <SectionHeading align={align} field="heading">
          {readText(settings, 'heading')}
        </SectionHeading>
        <RichTextView
          doc={readRichText(settings, 'body')}
          elementKey={textElementKey('body')}
          field="body"
        />
      </SectionColumn>
      <SimpleGrid
        columns={{ base: readMobileColumns(settings), sm: 2, md: readColumns(settings, 3) }}
        gap="5"
      >
        {items.map((item) => {
          const photo = readText(item, 'photo')
          const src = photo ? imageUrl(photo, { width: 700, height: 900 }) : null
          const link = readLink(item, 'link')
          const inner = (
            <Stack gap="3" align={align === 'center' ? 'center' : 'flex-start'}>
              {src && (
                <AspectRatio
                  ratio={3 / 4}
                  w="full"
                  rounded={flat ? 'l3' : 'l2'}
                  overflow="hidden"
                  bg="bg.subtle"
                >
                  <ImageWithFallback src={src} alt="" objectFit="cover" loading="lazy" />
                </AspectRatio>
              )}
              <Stack gap="0.5" textAlign={align} w="full">
                <Text fontWeight="semibold">{readText(item, 'name')}</Text>
                {readText(item, 'role') && (
                  <Text fontSize="sm" color="fg.muted">
                    {readText(item, 'role')}
                  </Text>
                )}
              </Stack>
            </Stack>
          )
          return (
            <Box key={item.id} bg="bg.panel" rounded="l3" p="4" {...frame}>
              {link.kind === 'none' ? inner : <SmartLink link={link}>{inner}</SmartLink>}
            </Box>
          )
        })}
      </SimpleGrid>
    </Stack>
  )
}

/* -------------------------------------------------------------------------- */
/* Press & awards                                                             */
/* -------------------------------------------------------------------------- */

export function Press({ settings }: SectionProps) {
  const { imageUrl } = useRenderEnvironment()
  const empty = useEmptyText()
  const { frame } = useCardStyle()
  const items = readList(settings, 'items').filter(
    (item) => readText(item, 'source') || readText(item, 'quote') || readText(item, 'logo'),
  )
  if (items.length === 0) return <EmptyNotice>{empty('items')}</EmptyNotice>
  const list = readText(settings, 'layout') === 'list'

  const card = (item: FieldValues & { id: string }) => {
    const logoId = readText(item, 'logo')
    const logo = logoId ? imageUrl(logoId, { width: 360, height: 180 }) : null
    const link = readLink(item, 'link')
    const inner = (
      <Stack gap="3" h="full" justify="space-between">
        {readText(item, 'quote') && (
          <Text fontSize="lg" lineHeight="tall" color="fg.muted">
            “{readText(item, 'quote')}”
          </Text>
        )}
        <Stack gap="2">
          {logo && (
            <ImageWithFallback
              src={logo}
              alt={readText(item, 'source')}
              maxH="8"
              maxW="32"
              objectFit="contain"
              loading="lazy"
            />
          )}
          {readText(item, 'source') && (
            <Text fontSize="sm" fontWeight="semibold">
              {readText(item, 'source')}
            </Text>
          )}
        </Stack>
      </Stack>
    )
    return (
      <Box key={item.id} bg="bg.panel" rounded="l3" p="5" {...frame}>
        {link.kind === 'none' ? inner : <SmartLink link={link}>{inner}</SmartLink>}
      </Box>
    )
  }

  return (
    <Stack gap="6">
      <SectionColumn>
        <SectionHeading field="heading">{readText(settings, 'heading')}</SectionHeading>
      </SectionColumn>
      {list ? (
        <Stack gap="3">{items.map(card)}</Stack>
      ) : (
        <SimpleGrid columns={{ base: 1, sm: 2, md: Math.min(3, items.length) }} gap="5">
          {items.map(card)}
        </SimpleGrid>
      )}
    </Stack>
  )
}

/* -------------------------------------------------------------------------- */
/* Editorial statement                                                        */
/* -------------------------------------------------------------------------- */

export function EditorialStatement({ settings }: SectionProps) {
  const { imageUrl, mode } = useRenderEnvironment()
  const { width, contentWidth } = useSectionLayout()
  const align = alignOf(settings)
  const fileId = readText(settings, 'image')
  const src = fileId ? imageUrl(fileId, { width: 1920, height: 1200 }) : null
  const eyebrow = readText(settings, 'eyebrow')
  const heading = readText(settings, 'heading')
  const edge = width === 'edge'

  const copy = (
    <Stack
      gap="4"
      maxW="4xl"
      textAlign={align}
      align={align === 'center' ? 'center' : 'flex-start'}
      color={src ? 'white' : 'fg'}
    >
      {(eyebrow || mode === 'preview') && (
        <ThemeText
          elementKey={textElementKey('eyebrow')}
          field="eyebrow"
          value={eyebrow}
          fontSize="sm"
          fontWeight="semibold"
          letterSpacing="0.14em"
          textTransform="uppercase"
          opacity={0.85}
        />
      )}
      {(heading || mode === 'preview') && (
        <ThemeText
          as="h2"
          elementKey={textElementKey('heading')}
          field="heading"
          value={heading}
          fontSize={{ base: '3xl', md: '5xl' }}
          letterSpacing="-0.03em"
          lineHeight="1.02"
          textWrap="balance"
        />
      )}
      <RichTextView
        doc={readRichText(settings, 'body')}
        elementKey={textElementKey('body')}
        field="body"
        inheritColor={Boolean(src)}
      />
      <ButtonRow settings={settings} align={align} onImage={Boolean(src)} />
    </Stack>
  )

  return (
    <Box position="relative" overflow="hidden" rounded={edge ? 'none' : 'l3'}>
      {src && (
        <Box position="absolute" inset={0}>
          <ImageWithFallback src={src} alt="" w="full" h="full" objectFit="cover" loading="lazy" />
        </Box>
      )}
      <Flex
        position="relative"
        minH={{ base: '24rem', md: '34rem' }}
        align="center"
        justify={align === 'center' ? 'center' : 'flex-start'}
        px={edge ? '0' : { base: '6', md: '14' }}
        py={{ base: '6', md: '14' }}
        {...overlayProps(src ? readText(settings, 'overlay') : 'none')}
      >
        {edge ? (
          <PageColumn maxW={contentWidth}>
            <Flex w="full" justify={align === 'center' ? 'center' : 'flex-start'}>
              {copy}
            </Flex>
          </PageColumn>
        ) : (
          copy
        )}
      </Flex>
    </Box>
  )
}

/* -------------------------------------------------------------------------- */
/* Split screen                                                               */
/* -------------------------------------------------------------------------- */

const SPLIT_MIN_H = { md: '22rem', lg: '32rem', screen: '100svh' } as const

export function SplitScreen({ settings }: SectionProps) {
  const { settings: theme, imageUrl } = useRenderEnvironment()
  const { contentWidth } = useSectionLayout()
  const fileId = readText(settings, 'image')
  const src = fileId ? imageUrl(fileId, { width: 1400, height: 1400 }) : null
  const imageRight = readText(settings, 'imagePosition') === 'right'
  const tone = readText(settings, 'tone')
  const scheme =
    tone === 'subtle' || tone === 'inverse' || tone === 'brand' ? resolveScheme(theme, tone) : null
  const minH = SPLIT_MIN_H[(readText(settings, 'minHeight') as keyof typeof SPLIT_MIN_H) ?? 'lg']

  return (
    <Box
      position="relative"
      minH={{ md: minH }}
      bg="bg"
      color="fg"
      css={
        scheme
          ? schemeCss(tone as 'subtle' | 'inverse' | 'brand', schemeCssVars(scheme))
          : undefined
      }
    >
      {/* The photo half runs to the viewport edge... */}
      <Box
        position={{ base: 'relative', md: 'absolute' }}
        insetBlock={{ md: 0 }}
        {...(imageRight ? { insetInlineEnd: { md: 0 } } : { insetInlineStart: { md: 0 } })}
        w={{ base: 'full', md: '50cqw' }}
        h={{ base: '18rem', md: 'auto' }}
        minH={{ base: '18rem', md: minH }}
        bg="bg.subtle"
        overflow="hidden"
      >
        {src && (
          <ImageWithFallback src={src} alt="" w="full" h="full" objectFit="cover" loading="lazy" />
        )}
      </Box>

      {/* ...while the words stay in the page column, in the half the photo
          does not occupy. The page column is centred, so its midpoint is the
          viewport's: text and photo always meet exactly on the fold. */}
      <PageColumn maxW={contentWidth} position="relative">
        <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} minH={{ md: minH }}>
          <Flex
            gridColumn={{ md: imageRight ? '1' : '2' }}
            align="center"
            py={{ base: '6', md: '12' }}
            pe={{ base: '0', md: imageRight ? '10' : '0' }}
            ps={{ base: '0', md: imageRight ? '0' : '10' }}
          >
            <Stack gap="4" maxW="xl">
              <SectionHeading field="heading">{readText(settings, 'heading')}</SectionHeading>
              <RichTextView
                doc={readRichText(settings, 'body')}
                elementKey={textElementKey('body')}
                field="body"
              />
              <ButtonRow settings={settings} align="left" />
            </Stack>
          </Flex>
        </Grid>
      </PageColumn>
    </Box>
  )
}

/* -------------------------------------------------------------------------- */
/* Social wall                                                                */
/* -------------------------------------------------------------------------- */

export function SocialWall({ settings }: SectionProps) {
  const { imageUrl } = useRenderEnvironment()
  const empty = useEmptyText()
  const items = readList(settings, 'items').filter((item) => readText(item, 'image'))
  if (items.length === 0) return <EmptyNotice>{empty('items')}</EmptyNotice>
  const handle = readText(settings, 'handle')

  return (
    <Stack gap="6">
      <SectionColumn>
        <Stack gap="1" textAlign="center" align="center">
          <SectionHeading field="heading">{readText(settings, 'heading')}</SectionHeading>
          {handle && (
            <Text color="fg.muted" fontWeight="medium">
              {handle}
            </Text>
          )}
        </Stack>
      </SectionColumn>
      <SimpleGrid
        columns={{ base: readMobileColumns(settings), md: readColumns(settings, 4, '4') }}
        gap="2"
      >
        {items.map((item) => {
          const src = imageUrl(readText(item, 'image'), { width: 600, height: 600 })
          if (!src) return null
          const link = readLink(item, 'link')
          const tile = (
            <Box position="relative" rounded="l1" overflow="hidden" bg="bg.subtle">
              <AspectRatio ratio={1}>
                <ImageWithFallback src={src} alt="" objectFit="cover" loading="lazy" />
              </AspectRatio>
              {readText(item, 'caption') && (
                <Text
                  position="absolute"
                  insetX="0"
                  bottom="0"
                  p="2"
                  fontSize="xs"
                  color="white"
                  bgGradient="to-t"
                  gradientFrom="blackAlpha.700"
                  gradientTo="transparent"
                  lineClamp={2}
                >
                  {readText(item, 'caption')}
                </Text>
              )}
            </Box>
          )
          return link.kind === 'none' ? (
            <Box key={item.id}>{tile}</Box>
          ) : (
            <SmartLink key={item.id} link={link}>
              {tile}
            </SmartLink>
          )
        })}
      </SimpleGrid>
    </Stack>
  )
}

/* -------------------------------------------------------------------------- */
/* Floating contact                                                           */
/* -------------------------------------------------------------------------- */

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/**
 * A corner cluster that stays put while the page scrolls.
 *
 * It must live outside the page's size container (`container-type` makes
 * that element the containing block of a `position: fixed` descendant) and
 * outside the section's GSAP entrance transform for the same reason, so
 * after mount it is portalled to the document body — the storefront's, or the
 * editor preview's iframe. The first render keeps it in place, matching the
 * server HTML, and the layout effect moves it before the browser paints.
 */
export function FloatingContact({ settings: section }: SectionProps) {
  const { data, getWindow, settings } = useRenderEnvironment()
  const reduced = usePrefersReducedMotion()
  const [host, setHost] = useState<HTMLElement | null>(null)
  // Shop settings fill in whatever the section leaves blank.
  const wa = whatsappHref(
    readText(section, 'whatsapp') || data.shop.phone || '',
    readText(section, 'whatsappMessage'),
  )
  const email = readText(section, 'email') || data.shop.email || ''
  const mail = email.includes('@') ? `mailto:${email}` : null
  const showTop = readBoolean(section, 'showTop')
  const side = readText(section, 'position') === 'left' ? { left: '4' } : { right: '4' }
  // Portalled out of the theme's scope, the cluster must carry the theme's
  // variables itself — otherwise `brand.solid` falls back to Pesanle's orange
  // in the editor preview. Light-mode surfaces only, exactly like the root.
  const theme = themeCssVarGroups(settings)

  useIsoLayoutEffect(() => {
    const view = getWindow?.() ?? globalThis.window
    setHost(view?.document.body ?? null)
  }, [getWindow])

  if (!wa && !mail && !showTop) return null

  const toTop = () => {
    const view = host?.ownerDocument.defaultView ?? globalThis.window
    view?.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
  }

  const cluster = (
    <Box
      data-floating-contact=""
      position="fixed"
      // Above a phone's tab bar, when the theme has one.
      bottom={`calc(var(${TABBAR_HEIGHT_VAR}, 0px) + var(--chakra-spacing-4))`}
      zIndex="docked"
      css={{ ...theme.always, 'html:not(.dark) &': theme.surfaces }}
      {...side}
    >
      <Stack gap="2" align="flex-end">
        {showTop && (
          <IconButton
            aria-label="Back to top"
            rounded="full"
            colorPalette="brand"
            size="sm"
            shadow="md"
            onClick={toTop}
          >
            <LuArrowUp />
          </IconButton>
        )}
        {wa && (
          <IconButton
            aria-label="Chat on WhatsApp"
            rounded="full"
            colorPalette="brand"
            shadow="md"
            asChild
          >
            <a href={wa} target="_blank" rel="noopener noreferrer">
              <FaWhatsapp />
            </a>
          </IconButton>
        )}
        {mail && (
          <IconButton
            aria-label="Send an email"
            rounded="full"
            variant="surface"
            shadow="md"
            asChild
          >
            <a href={mail}>
              <LuMail />
            </a>
          </IconButton>
        )}
      </Stack>
    </Box>
  )

  return host ? createPortal(cluster, host) : cluster
}

/* -------------------------------------------------------------------------- */
/* 360° spin                                                                  */
/* -------------------------------------------------------------------------- */

/** One full automatic turn, in milliseconds. */
const SPIN_AUTO_TURN_MS = 6000
/** How long after the shopper lets go before the automatic turn picks up again. */
const SPIN_AUTO_RESUME_MS = 5000

/**
 * How many frames a horizontal drag of `dx` across `width` should turn: a drag
 * the width of the photo turns it once, for any number of frames.
 */
export function spinStep(dx: number, width: number, count: number): number {
  if (width <= 0 || count <= 0) return 0
  return Math.round((dx / width) * count)
}

export function Spin360({ settings }: SectionProps) {
  const { imageUrl } = useRenderEnvironment()
  const empty = useEmptyText()
  const reduced = usePrefersReducedMotion()
  const frames = readList(settings, 'frames').filter((frame) => readText(frame, 'image'))
  const sources = frames.map((frame) =>
    imageUrl(readText(frame, 'image'), { width: 1200, height: 1200 }),
  )
  const count = frames.length
  const [index, setIndex] = useState(0)
  const [touched, setTouched] = useState(false)
  const [paused, setPaused] = useState(false)
  const drag = useRef<{ x: number; width: number; index: number } | null>(null)
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const auto = readBoolean(settings, 'autoSpin') && !reduced

  // Load every frame once, up front: swapping in an image the browser still
  // has to fetch is what makes a spin look like a flicker.
  const sourceKey = sources.join('\n')
  useEffect(() => {
    for (const source of sourceKey.split('\n')) {
      if (!source) continue
      const preload = new window.Image()
      preload.src = source
    }
  }, [sourceKey])

  // A constant turn, not a constant frame rate: a full turn takes the same
  // time whether the seller uploaded 4 frames or 36.
  useEffect(() => {
    if (!auto || paused || count < 2) return
    const step = Math.max(80, Math.round(SPIN_AUTO_TURN_MS / count))
    const timer = setInterval(() => setIndex((current) => (current + 1) % count), step)
    return () => clearInterval(timer)
  }, [auto, paused, count])

  useEffect(
    () => () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current)
    },
    [],
  )

  const release = () => {
    if (!drag.current) return
    drag.current = null
    if (resumeTimer.current) clearTimeout(resumeTimer.current)
    resumeTimer.current = setTimeout(() => setPaused(false), SPIN_AUTO_RESUME_MS)
  }

  if (count === 0) return <EmptyNotice>{empty('items')}</EmptyNotice>
  const active = frames[index % count]!
  const src = sources[index % count] ?? null
  const hint = readText(settings, 'caption')
  const spinnable = count > 1

  return (
    <Stack gap="4" align="center">
      <SectionHeading align="center" field="heading">
        {readText(settings, 'heading')}
      </SectionHeading>
      <Box
        data-spin-360=""
        position="relative"
        w="full"
        maxW="xl"
        rounded="l3"
        overflow="hidden"
        bg="bg.subtle"
        cursor={spinnable ? 'grab' : 'default'}
        userSelect="none"
        _active={spinnable ? { cursor: 'grabbing' } : undefined}
        style={{ touchAction: 'pan-y' }}
        onDragStart={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          if (!spinnable) return
          drag.current = { x: event.clientX, width: event.currentTarget.clientWidth, index }
          setPaused(true)
          try {
            event.currentTarget.setPointerCapture(event.pointerId)
          } catch {
            // A pointer the browser has already released; dragging still works.
          }
        }}
        onPointerMove={(event) => {
          const current = drag.current
          if (!current) return
          const step = spinStep(event.clientX - current.x, current.width, count)
          if (step !== 0) setTouched(true)
          setIndex((((current.index + step) % count) + count) % count)
        }}
        onPointerUp={(event) => {
          try {
            event.currentTarget.releasePointerCapture(event.pointerId)
          } catch {
            // Never captured (see pointerdown); nothing to release.
          }
          release()
        }}
        onPointerCancel={release}
        onLostPointerCapture={release}
      >
        <AspectRatio ratio={1}>
          {src ? (
            <ImageWithFallback
              src={src}
              alt={readText(active, 'alt')}
              objectFit="cover"
              loading="eager"
              draggable={false}
            />
          ) : (
            <Box />
          )}
        </AspectRatio>
        {spinnable && hint && !touched && (
          <Flex
            position="absolute"
            insetX="0"
            bottom="0"
            justify="center"
            p="3"
            pointerEvents="none"
          >
            <Flex
              align="center"
              gap="2"
              bg="blackAlpha.700"
              color="white"
              rounded="full"
              px="3"
              py="1.5"
              fontSize="sm"
            >
              <LuRotate3D />
              {hint}
            </Flex>
          </Flex>
        )}
      </Box>
    </Stack>
  )
}

/** The premium sections, keyed by the same `type` as their schemas. */
export const PREMIUM_SECTION_RENDERERS = {
  newsletter: Newsletter,
  'background-video': BackgroundVideoSection,
  'masonry-gallery': MasonryGallery,
  'video-testimonials': VideoTestimonials,
  team: Team,
  press: Press,
  'editorial-statement': EditorialStatement,
  'split-screen': SplitScreen,
  'social-wall': SocialWall,
  'floating-contact': FloatingContact,
  'spin-360': Spin360,
} satisfies Partial<Record<SectionType, ComponentType<SectionProps>>>
