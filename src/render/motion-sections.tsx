/**
 * Motion-led sections: stacking cards, a pinned scroll stage and a
 * scroll-driven horizontal rail.
 *
 * Like everything else, they render their final state as plain HTML: panels
 * stack, rails scroll natively. Effects enhance on top —
 * `IntersectionObserver` and `requestAnimationFrame` on the element's own
 * document — and stand down for reduced motion.
 */

import { AspectRatio, Box, Flex, Heading, Stack, Text } from '@chakra-ui/react'
import { useEffect, useRef, useState } from 'react'

import { ImageWithFallback } from '@repo/theme'

import {
  readLink,
  readList,
  readRichText,
  readText,
  type FieldValues,
} from '../model/fields'
import { isRichDocEmpty } from '../model/rich-text'
import { resolveScheme, schemeCssVars } from '../model/settings'
import { HEADER_HEIGHT_VAR } from './chrome'
import { useRenderEnvironment } from './context'
import { schemeCss } from './frame'
import {
  ButtonRow,
  EmptyNotice,
  Paragraphs,
  SectionHeading,
  SmartLink,
  useCardStyle,
} from './primitives'
import { RichTextView } from './rich-text'
import { alignOf, useEmptyText, type SectionProps } from './sections'

/* -------------------------------------------------------------------------- */
/* Stacked cards                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Cards pinning one over another as the page scrolls, each peeking from
 * under the next and shrinking into the pile. Pinning is plain CSS sticky;
 * the shrink is a scroll-driven animation where supported, stillness
 * otherwise — and nothing anywhere without it.
 */
export function StackedCards({ settings }: SectionProps) {
  const { imageUrl } = useRenderEnvironment()
  const { frame, flat } = useCardStyle()
  const empty = useEmptyText()
  const align = alignOf(settings)
  const items = readList(settings, 'items')
  if (items.length === 0) return <EmptyNotice>{empty('items')}</EmptyNotice>

  return (
    <Stack gap="6">
      <SectionHeading align={align} field="heading">
        {readText(settings, 'heading')}
      </SectionHeading>
      <Stack gap="6">
        {items.map((item, index) => {
          const fileId = readText(item, 'image')
          const src = fileId ? imageUrl(fileId, { width: 1000, height: 625 }) : null
          const title = readText(item, 'title')
          const linkLabel = readText(item, 'linkLabel')
          return (
            <Box
              key={item.id}
              position="sticky"
              // Below the store header, each card a thumb lower than the last.
              top={`calc(var(${HEADER_HEIGHT_VAR}, 76px) + ${16 + index * 28}px)`}
              css={{
                '@supports (animation-timeline: view())': {
                  '@media (prefers-reduced-motion: no-preference)': {
                    animation: 'pb-stack-cover linear both',
                    animationTimeline: 'view()',
                    animationRange: 'exit 0% exit 100%',
                  },
                },
                '@keyframes pb-stack-cover': {
                  from: { transform: 'scale(1)', filter: 'brightness(1)' },
                  to: { transform: 'scale(0.93)', filter: 'brightness(0.94)' },
                },
              }}
            >
              <Box
                bg="bg.panel"
                rounded="l3"
                overflow="hidden"
                p={{ base: '5', md: '8' }}
                {...frame}
              >
                <Flex
                  direction={{ base: 'column', md: src ? 'row' : 'column' }}
                  gap={{ base: '5', md: '8' }}
                  align="center"
                >
                  <Stack gap="2.5" flex="1" minW="0" textAlign={align}>
                    <Text
                      fontSize="sm"
                      fontWeight="bold"
                      color="brand.fg"
                      fontVariantNumeric="tabular-nums"
                    >
                      {String(index + 1).padStart(2, '0')}
                    </Text>
                    {title && (
                      <Heading as="h3" size={{ base: 'lg', md: 'xl' }} letterSpacing="-0.01em">
                        {title}
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
                  </Stack>
                  {src && (
                    <AspectRatio
                      ratio={16 / 10}
                      w="full"
                      maxW={{ md: 'md' }}
                      rounded="l2"
                      overflow="hidden"
                      bg="bg.subtle"
                      flexShrink="0"
                    >
                      <ImageWithFallback
                        src={src}
                        alt={title}
                        objectFit="cover"
                        loading="lazy"
                      />
                    </AspectRatio>
                  )}
                </Flex>
              </Box>
            </Box>
          )
        })}
      </Stack>
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

/** Scroll room per panel, as viewport heights. */
export function scrollRoomHeight(value: string): string {
  switch (value) {
    case 'compact':
      return '60svh'
    case 'roomy':
      return '110svh'
    default:
      return '80svh'
  }
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
  const room = scrollRoomHeight(readText(settings, 'scrollLength'))
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
        {/* The pinned stage FIRST: it sticks at the top while the track below
            scrolls past, giving it one screen of stick range per panel.
            Desktop only. */}
        <Box
          data-pinned="stage"
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
        {/* Scroll room AFTER the stage: scroll room per panel, driving which
            panel owns the stage. Desktop only. */}
        <Box data-pinned="track" hideBelow="md" aria-hidden="true">
          {panels.map((panel, index) => (
            <Box
              key={panel.id}
              ref={(element: HTMLDivElement | null) => {
                sentinels.current[index] = element
              }}
              h={room}
            />
          ))}
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
 * How far the rail has travelled, 0 to 1: the stage enters with its top at
 * the viewport's bottom edge and releases with its bottom there.
 */
export function railProgress(rectTop: number, outerHeight: number, viewHeight: number): number {
  const total = outerHeight - viewHeight
  if (!(total > 0)) return 0
  return Math.min(1, Math.max(0, (viewHeight - rectTop) / total))
}

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
  const [driving, setDriving] = useState(false)

  useEffect(() => {
    const outer = outerRef.current
    const track = trackRef.current
    const view = outer?.ownerDocument.defaultView
    if (!outer || !track || !view) return

    let raf = 0
    let visible = false
    let written = ''
    let lastMeasure = 0
    const motionQuery = view.matchMedia('(prefers-reduced-motion: reduce)')
    // Re-evaluated, never decided once: a device switch, a resize, a
    // reduced-motion toggle or a content edit engages or releases drive
    // mode instead of stranding the last decision.
    const measure = (): boolean => {
      const ok =
        !motionQuery.matches &&
        view.innerWidth >= 768 &&
        track.scrollWidth - outer.clientWidth > view.innerHeight * 0.1
      setDriving((was) => {
        if (was === ok) return was
        if (!ok) {
          outer.style.height = ''
          track.style.transform = ''
          written = ''
        }
        return ok
      })
      if (ok) {
        // Scroll room for exactly the overflow, plus most of a screen so the
        // last card rests in view before the stage releases.
        const overflow = track.scrollWidth - outer.clientWidth
        outer.style.height = `${overflow + view.innerHeight * 0.9}px`
      }
      return ok
    }

    const update = (now: number) => {
      raf = 0
      if (!visible) return
      // Engagement is re-checked a few times a second; the transform itself
      // follows every frame from the rect, so no scroll listener can go
      // missing — the loop only needs animation frames.
      if (now - lastMeasure > 500) {
        lastMeasure = now
        if (!measure()) return
      }
      const rect = outer.getBoundingClientRect()
      const progress = railProgress(rect.top, outer.offsetHeight, view.innerHeight)
      const overflow = track.scrollWidth - outer.clientWidth
      const next = `translate3d(${(-progress * overflow).toFixed(1)}px, 0, 0)`
      // Unchanged transforms are not rewritten: without this the compositor
      // never rests while the section is on screen.
      if (next !== written) {
        track.style.transform = next
        written = next
      }
      raf = view.requestAnimationFrame(update)
    }
    const kick = () => {
      if (!raf) raf = view.requestAnimationFrame(update)
    }
    const onResize = () => {
      lastMeasure = view.performance.now()
      measure()
      kick()
    }

    const observer =
      'IntersectionObserver' in view
        ? new view.IntersectionObserver(
            ([entry]) => {
              visible = Boolean(entry?.isIntersecting)
              kick()
            },
            // Any sliver on screen keeps the loop alive; the work itself is
            // one rect read and, usually, no write at all.
            { threshold: 0 },
          )
        : null
    if (observer) observer.observe(outer)
    else kick()
    view.addEventListener('resize', onResize)
    const onMotionChange = () => {
      lastMeasure = 0
      if (measure()) kick()
    }
    motionQuery.addEventListener('change', onMotionChange)
    return () => {
      view.removeEventListener('resize', onResize)
      motionQuery.removeEventListener('change', onMotionChange)
      observer?.disconnect()
      if (raf) view.cancelAnimationFrame(raf)
      outer.style.height = ''
      track.style.transform = ''
    }
  }, [items.length])

  if (items.length === 0) return <EmptyNotice>{empty('items')}</EmptyNotice>

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
