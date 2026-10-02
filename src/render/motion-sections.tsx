/**
 * Motion-led sections: animated stats, a pinned scroll stage and a
 * scroll-driven horizontal rail.
 *
 * Like everything else, they render their final state as plain HTML: counts
 * show their value, panels stack, rails scroll natively. Effects enhance on
 * top — `IntersectionObserver` and `requestAnimationFrame` on the element's
 * own document — and stand down for reduced motion.
 */

import { AspectRatio, Box, Flex, Heading, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import { useEffect, useRef, useState } from 'react'

import { ImageWithFallback } from '@repo/theme'

import {
  readLink,
  readList,
  readNumber,
  readRichText,
  readText,
  type FieldValues,
} from '../model/fields'
import { isRichDocEmpty } from '../model/rich-text'
import { resolveScheme, schemeCssVars } from '../model/settings'
import { useRenderEnvironment } from './context'
import { schemeCss } from './frame'
import { CountUp } from './motion'
import {
  ButtonRow,
  EmptyNotice,
  gridColumns,
  SectionHeading,
  SmartLink,
  useCardStyle,
} from './primitives'
import { RichTextView } from './rich-text'
import { alignOf, useEmptyText, type SectionProps } from './sections'

/* -------------------------------------------------------------------------- */
/* Stats                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Animated metrics — customers served, rating, years running. Each number
 * counts up as it enters; the final value is in the HTML either way.
 */
export function Stats({ settings }: SectionProps) {
  const empty = useEmptyText()
  const align = alignOf(settings)
  const items = readList(settings, 'items')
  if (items.length === 0) return <EmptyNotice>{empty('items')}</EmptyNotice>

  return (
    <Stack gap="6" textAlign={align}>
      <SectionHeading align={align} field="heading">
        {readText(settings, 'heading')}
      </SectionHeading>
      <SimpleGrid columns={gridColumns(readText(settings, 'columns'))} gap={{ base: '6', md: '8' }}>
        {items.map((item) => {
          const label = readText(item, 'label')
          return (
            <Stack key={item.id} gap="1" align={align === 'center' ? 'center' : 'start'}>
              <CountUp
                value={readNumber(item, 'value', 0)}
                decimals={Math.min(2, Math.max(0, Math.round(readNumber(item, 'decimals', 0))))}
                prefix={readText(item, 'prefix')}
                suffix={readText(item, 'suffix')}
                fontSize={{ base: '3xl', md: '4xl' }}
                fontWeight="bold"
                letterSpacing="tight"
              />
              {label && (
                <Text color="fg.muted" textWrap="balance">
                  {label}
                </Text>
              )}
            </Stack>
          )
        })}
      </SimpleGrid>
    </Stack>
  )
}

/* -------------------------------------------------------------------------- */
/* Pinned scroll                                                              */
/* -------------------------------------------------------------------------- */

/** A pinned panel's colours: the page, or one of the theme's dark/brand bands. */
function panelTone(tone: string) {
  return tone === 'dark' ? 'inverse' : tone === 'brand' ? 'brand' : null
}

/** Whether a panel has anything to show; empties never take up scroll room. */
function hasPanel(panel: FieldValues): boolean {
  return Boolean(
    readText(panel, 'heading') ||
      !isRichDocEmpty(readRichText(panel, 'body')) ||
      readText(panel, 'image'),
  )
}

function PinnedPanel({ panel }: { panel: FieldValues }) {
  const { settings, imageUrl } = useRenderEnvironment()
  const tone = panelTone(readText(panel, 'tone'))
  const vars = tone ? schemeCssVars(resolveScheme(settings, tone)) : null
  const fileId = readText(panel, 'image')
  const src = fileId ? imageUrl(fileId, { width: 1200, height: 900 }) : null

  return (
    <Box
      rounded="l3"
      overflow="hidden"
      p={{ base: '6', md: '10' }}
      {...(tone && vars
        ? { css: schemeCss(tone, vars), bg: 'bg', color: 'fg' }
        : { bg: 'bg.panel', borderWidth: '1px', borderColor: 'border.subtle' })}
    >
      <Flex
        direction={{ base: 'column', md: src ? 'row' : 'column' }}
        gap={{ base: '5', md: '8' }}
        align="center"
      >
        <Stack gap="3" flex="1" minW="0">
          {readText(panel, 'heading') && (
            <Heading as="h3" size={{ base: 'lg', md: 'xl' }} letterSpacing="-0.01em">
              {readText(panel, 'heading')}
            </Heading>
          )}
          <RichTextView doc={readRichText(panel, 'body')} />
          <ButtonRow settings={panel} />
        </Stack>
        {src && (
          <AspectRatio
            ratio={4 / 3}
            w="full"
            maxW={{ md: 'md' }}
            rounded="l2"
            overflow="hidden"
            bg="bg.subtle"
            flexShrink="0"
          >
            <ImageWithFallback src={src} alt="" objectFit="cover" loading="lazy" />
          </AspectRatio>
        )}
      </Flex>
    </Box>
  )
}

/**
 * A full-screen stage pinned while the page scrolls through one panel per
 * screen. Phones get the same panels as plain stacked cards — no pinning,
 * nothing hidden.
 */
export function PinnedScroll({ settings }: SectionProps) {
  const empty = useEmptyText()
  const panels = readList(settings, 'panels').filter(hasPanel)
  const [active, setActive] = useState(0)
  const sentinels = useRef<Array<HTMLDivElement | null>>([])

  useEffect(() => {
    const first = sentinels.current.find(Boolean)
    const view = first?.ownerDocument.defaultView
    if (!first || !view || !('IntersectionObserver' in view)) return
    const observer = new view.IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const index = sentinels.current.indexOf(entry.target as HTMLDivElement)
          if (index >= 0) setActive(index)
        }
      },
      // A panel owns the stage while it crosses the middle of the screen.
      { rootMargin: '-45% 0px -45% 0px' },
    )
    sentinels.current.forEach((element) => element && observer.observe(element))
    return () => observer.disconnect()
  }, [panels.length])

  if (panels.length === 0) return <EmptyNotice>{empty('items')}</EmptyNotice>

  return (
    <Stack gap="6">
      <SectionHeading field="heading">{readText(settings, 'heading')}</SectionHeading>
      <Box position="relative">
        {/* Scroll room: one screen per panel. The stage below pins through it. */}
        <Box hideFrom="md" aria-hidden="true">
          {panels.map((panel, index) => (
            <Box
              key={panel.id}
              ref={(element: HTMLDivElement | null) => {
                sentinels.current[index] = element
              }}
              h="100svh"
            />
          ))}
        </Box>
        {/* The pinned stage, desktop only: panels crossfade as each owns it. */}
        <Box
          hideBelow="md"
          position="sticky"
          top="0"
          h="100svh"
          display="flex"
          alignItems="center"
          justifyContent="center"
          pointerEvents="none"
        >
          {panels.map((panel, index) => {
            const visible = index === active
            return (
              <Box
                key={panel.id}
                position="absolute"
                insetX="0"
                mx="auto"
                maxW="4xl"
                px={{ md: '6' }}
                opacity={visible ? 1 : 0}
                transform={visible ? 'translateY(0)' : 'translateY(24px)'}
                transition="opacity 500ms ease, transform 500ms ease"
                css={{ '@media (prefers-reduced-motion: reduce)': { transition: 'none' } }}
                aria-hidden={!visible}
                inert={!visible}
                pointerEvents={visible ? 'auto' : 'none'}
              >
                <PinnedPanel panel={panel} />
              </Box>
            )
          })}
        </Box>
        {/* Phones: the same panels as cards, no pinning and nothing hidden. */}
        <Stack hideFrom="md" gap="5" mt="2">
          {panels.map((panel) => (
            <PinnedPanel key={panel.id} panel={panel} />
          ))}
        </Stack>
      </Box>
    </Stack>
  )
}

/* -------------------------------------------------------------------------- */
/* Scroll rail                                                                */
/* -------------------------------------------------------------------------- */

/**
 * A horizontal gallery the page's vertical scroll drives: the stage pins for
 * exactly the rail's overflow, then releases. Phones, reduced motion and
 * no-JS get the same cards as a native swipeable strip.
 */
export function ScrollRail({ settings }: SectionProps) {
  const { imageUrl } = useRenderEnvironment()
  const empty = useEmptyText()
  const { frame } = useCardStyle()
  const items = readList(settings, 'items')
  const outerRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  // Drive mode (pinned, translated) only once measured; otherwise native.
  const [driveHeight, setDriveHeight] = useState<string | null>(null)

  useEffect(() => {
    const outer = outerRef.current
    const track = trackRef.current
    const view = outer?.ownerDocument.defaultView
    if (!outer || !track || !view) return
    if (view.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (view.innerWidth < 768) return
    if (track.scrollWidth - outer.clientWidth <= 0) return

    // Scroll room for exactly the overflow, plus most of a screen so the
    // last card rests in view before the stage releases. Recomputed every
    // frame, so a resize re-lays-out instead of mis-driving.
    const layout = () => {
      const overflow = track.scrollWidth - outer.clientWidth
      if (overflow > 0) outer.style.height = `${overflow + view.innerHeight * 0.9}px`
      return Math.max(0, overflow)
    }
    layout()
    setDriveHeight(outer.style.height || null)

    let raf = 0
    const update = () => {
      raf = 0
      const overflow = layout()
      const rect = outer.getBoundingClientRect()
      const total = outer.offsetHeight - view.innerHeight
      const progress =
        total > 0 ? Math.min(1, Math.max(0, (view.innerHeight - rect.top) / total)) : 0
      track.style.transform = `translate3d(${(-progress * overflow).toFixed(1)}px, 0, 0)`
    }
    const kick = () => {
      if (!raf) raf = view.requestAnimationFrame(update)
    }
    update()
    view.addEventListener('scroll', kick, { passive: true })
    view.addEventListener('resize', kick)
    return () => {
      view.removeEventListener('scroll', kick)
      view.removeEventListener('resize', kick)
      if (raf) view.cancelAnimationFrame(raf)
      outer.style.height = ''
      track.style.transform = ''
    }
  }, [items.length])

  if (items.length === 0) return <EmptyNotice>{empty('items')}</EmptyNotice>
  const driving = driveHeight !== null

  return (
    <Box ref={outerRef}>
      <Box
        position={driving ? 'sticky' : 'static'}
        top="0"
        h={driving ? '100svh' : 'auto'}
        display="flex"
        flexDirection="column"
        justifyContent="center"
        overflow="hidden"
        gap="6"
      >
        <SectionHeading field="heading">{readText(settings, 'heading')}</SectionHeading>
        <Box overflowX={driving ? 'hidden' : 'auto'} pb={driving ? '0' : '2'}>
          <Flex ref={trackRef} gap="5" w="max-content">
            {items.map((item) => {
              const fileId = readText(item, 'image')
              const src = fileId ? imageUrl(fileId, { width: 800, height: 600 }) : null
              const title = readText(item, 'title')
              const text = readText(item, 'text')
              return (
                <Box
                  key={item.id}
                  w={{ base: '70vw', md: '320px' }}
                  flexShrink="0"
                  rounded="l3"
                  overflow="hidden"
                  bg="bg.panel"
                  transition="transform 200ms ease, border-color 200ms ease"
                  _hover={{ transform: 'translateY(-4px)' }}
                  css={{
                    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                  }}
                  {...frame}
                >
                  <SmartLink link={readLink(item, 'link')} display="block" h="full">
                    {src && (
                      <AspectRatio ratio={4 / 3} bg="bg.subtle">
                        <ImageWithFallback
                          src={src}
                          alt={title}
                          objectFit="cover"
                          loading="lazy"
                        />
                      </AspectRatio>
                    )}
                    {(title || text) && (
                      <Stack gap="1" p="4">
                        {title && (
                          <Text fontWeight="semibold" lineClamp={2}>
                            {title}
                          </Text>
                        )}
                        {text && (
                          <Text fontSize="sm" color="fg.muted" lineClamp={3}>
                            {text}
                          </Text>
                        )}
                      </Stack>
                    )}
                  </SmartLink>
                </Box>
              )
            })}
          </Flex>
        </Box>
      </Box>
    </Box>
  )
}
