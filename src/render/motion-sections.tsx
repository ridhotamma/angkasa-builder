/**
 * Motion-led sections: stacking cards, a pinned scroll stage and a
 * scroll-driven horizontal rail.
 *
 * Like everything else, they render their final state as plain HTML: panels
 * stack, rails scroll natively. GSAP and ScrollTrigger enhance on top — with
 * ScrollTrigger scoped to the element's own document, so the editor preview
 * animates inside its iframe exactly like the storefront — and every effect
 * stands down for reduced motion.
 */

import { AspectRatio, Box, Flex, Heading, Stack, Text } from '@chakra-ui/react'
import { useEffect, useRef, useState } from 'react'

import { ImageWithFallback } from '@repo/theme'

import {
  readBlocks,
  readLink,
  readList,
  readRichText,
  readText,
  type FieldValues,
} from '../model/fields'
import { isRichDocEmpty } from '../model/rich-text'
import { resolveScheme, schemeCssVars } from '../model/settings'
import { BlockChildren, BlockStrip, useDropTarget } from './blocks-section'
import { HEADER_HEIGHT_VAR } from './chrome'
import { SectionColumn } from './column'
import { useRenderEnvironment } from './context'
import { schemeCss } from './frame'
import { requestMotionRefresh, useMotionEffect } from './motion/engine'
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
 * the shrink is a ScrollTrigger scrub, so it works in every browser rather
 * than only where CSS scroll-driven animations do. Every top-level block is
 * one card; pages built before the pile took blocks keep their fixed cards.
 */
export function StackedCards({ settings }: SectionProps) {
  const { imageUrl } = useRenderEnvironment()
  const { frame, flat } = useCardStyle()
  const empty = useEmptyText()
  const align = alignOf(settings)
  const custom = readText(settings, 'content') === 'blocks'
  const blocks = custom ? readBlocks(settings, 'blocks') : []
  const items = custom ? [] : readList(settings, 'items')
  const stack = useRef<HTMLDivElement>(null)
  const drop = useDropTarget(null, 'blocks')

  useMotionEffect(
    stack,
    ({ gsap }) => {
      const element = stack.current
      const scroller = element?.ownerDocument.documentElement
      if (!element || !scroller) return
      element.querySelectorAll<HTMLElement>('[data-stack-card]').forEach((card) => {
        gsap.fromTo(
          card,
          { scale: 1, filter: 'brightness(1)' },
          {
            scale: 0.93,
            filter: 'brightness(0.94)',
            ease: 'none',
            scrollTrigger: {
              trigger: card,
              scroller,
              start: 'top top',
              end: 'bottom top',
              scrub: true,
            },
          },
        )
      })
    },
    [blocks.length, items.length],
  )

  if (blocks.length === 0 && items.length === 0) {
    return <EmptyNotice>{empty('items')}</EmptyNotice>
  }

  return (
    <Stack gap="6">
      <SectionColumn>
        <SectionHeading align={align} field="heading">
          {readText(settings, 'heading')}
        </SectionHeading>
      </SectionColumn>
      <Stack ref={stack} gap="6" {...(custom ? drop : {})}>
        {blocks.length > 0
          ? blocks.map((block, index) => (
              <Box
                key={block.id}
                data-stack-card=""
                position="sticky"
                // Below the store header, each card a thumb lower than the last.
                top={`calc(var(${HEADER_HEIGHT_VAR}, 76px) + ${16 + index * 28}px)`}
              >
                <Box
                  rounded="l3"
                  overflow="hidden"
                  p={{ base: '5', md: '8' }}
                  {...frame}
                  // A pile only reads when a card hides the one under it. A flat
                  // theme would leave every card see-through and the whole stack
                  // would show its text at once, so the surface is forced opaque
                  // and flat gets an edge for the peeking strips.
                  bg="bg.panel"
                  {...(flat && { borderWidth: '1px', borderColor: 'border.subtle' })}
                >
                  <BlockChildren blocks={[block]} />
                </Box>
              </Box>
            ))
          : items.map((item, index) => {
              const fileId = readText(item, 'image')
              const src = fileId ? imageUrl(fileId, { width: 1000, height: 625 }) : null
              const title = readText(item, 'title')
              const linkLabel = readText(item, 'linkLabel')
              return (
                <Box
                  key={item.id}
                  data-stack-card=""
                  position="sticky"
                  // Below the store header, each card a thumb lower than the last.
                  top={`calc(var(${HEADER_HEIGHT_VAR}, 76px) + ${16 + index * 28}px)`}
                >
                  <Box
                    rounded="l3"
                    overflow="hidden"
                    p={{ base: '5', md: '8' }}
                    {...frame}
                    // A pile only reads when a card hides the one under it. A flat
                    // theme would leave every card see-through and the whole stack
                    // would show its text at once, so the surface is forced opaque
                    // and flat gets an edge for the peeking strips.
                    bg="bg.panel"
                    {...(flat && { borderWidth: '1px', borderColor: 'border.subtle' })}
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
          {/* Each panel is its own button, so its overrides get their own id. */}
          <ButtonRow settings={panel} elementKey={`panel.${readText(panel, 'id')}`} />
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
 * screen. The stage is native CSS sticky; an IntersectionObserver picks the
 * panel crossing the middle of the screen and a GSAP crossfade moves the
 * stage between them. Phones get the same panels as plain stacked cards —
 * no pinning, nothing hidden. A shopper who prefers less motion gets the
 * same panels, switching without the fade.
 */
export function PinnedScroll({ settings }: SectionProps) {
  const empty = useEmptyText()
  const panels = readList(settings, 'panels').filter(hasPanel)
  const room = scrollRoomHeight(readText(settings, 'scrollLength'))
  const [active, setActive] = useState(0)
  const sentinels = useRef<Array<HTMLDivElement | null>>([])
  const stage = useRef<HTMLDivElement>(null)
  const previous = useRef(0)

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

  // The crossfade: from wherever the previous panel left the stage, to the
  // one that owns it now. GSAP writes the inline styles; the attributes that
  // keep hidden panels out of the tab order are React's own.
  useMotionEffect(
    stage,
    ({ gsap }) => {
      const element = stage.current
      const view = element?.ownerDocument.defaultView
      if (!element || !view || view.innerWidth < 768) return
      const nodes = Array.from(element.querySelectorAll<HTMLElement>('[data-pinned-panel]'))
      if (nodes.length === 0) return
      const from = previous.current
      const at = (index: number, owner: number) => ({
        autoAlpha: index === owner ? 1 : 0,
        y: index === owner ? 0 : 24,
      })
      nodes.forEach((node, index) => {
        gsap.fromTo(node, at(index, from), {
          ...at(index, active),
          duration: 0.5,
          ease: 'power2.out',
          overwrite: 'auto',
        })
      })
      previous.current = active
    },
    [active],
  )

  if (panels.length === 0) return <EmptyNotice>{empty('items')}</EmptyNotice>

  return (
    <Stack gap="6">
      <SectionColumn>
        <SectionHeading field="heading">{readText(settings, 'heading')}</SectionHeading>
      </SectionColumn>
      <Box position="relative">
        {/* The pinned stage FIRST: it sticks at the top while the track below
            scrolls past, giving it one screen of stick range per panel.
            Desktop only. */}
        <Box
          ref={stage}
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
                data-pinned-panel=""
                position="absolute"
                insetX="0"
                mx="auto"
                maxW="4xl"
                px={{ md: '6' }}
                opacity={visible ? 1 : 0}
                transform={visible ? 'translateY(0)' : 'translateY(24px)'}
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

/** Page scroll paid per pixel of rail travel; a higher factor reads slower. */
export const RAIL_SPEEDS: Record<string, number> = { slow: 2.6, normal: 1.6, fast: 1 }

/** The pin distance multiplier the seller's speed choice asks for. */
export function railSpeed(settings: FieldValues): number {
  return RAIL_SPEEDS[readText(settings, 'speed')] ?? RAIL_SPEEDS.normal!
}

/** How wide one stop stands, by the section's width choice. */
const RAIL_STOP_WIDTHS: Record<string, { base: string; md: string }> = {
  sm: { base: '60vw', md: '260px' },
  md: { base: '70vw', md: '340px' },
  lg: { base: '84vw', md: '460px' },
}

/** How tall the pinned stage stands, as a share of the viewport. */
export const RAIL_HEIGHTS: Record<string, number> = { md: 0.7, lg: 0.85, screen: 1 }

/** The stage height the seller's choice asks for: a CSS length and its share. */
export function railHeight(settings: FieldValues): { css: string; fraction: number } {
  const fraction = RAIL_HEIGHTS[readText(settings, 'height')] ?? RAIL_HEIGHTS.screen!
  return { css: `${fraction * 100}svh`, fraction }
}

/**
 * A horizontal rail the page's vertical scroll drives: the stage pins for
 * exactly the rail's overflow, then releases — a ScrollTrigger scrub across
 * the section's own scroll room, with the stage held by native CSS sticky.
 * The track holds whatever the seller composed from blocks; pages built
 * before the rail took blocks keep their fixed cards. Phones and reduced
 * motion get the same content as a native swipeable strip.
 */
export function ScrollRail({ settings }: SectionProps) {
  const { imageUrl } = useRenderEnvironment()
  const empty = useEmptyText()
  const { frame } = useCardStyle()
  const custom = readText(settings, 'content') === 'blocks'
  const blocks = custom ? readBlocks(settings, 'blocks') : []
  const items = custom ? [] : readList(settings, 'items')
  const outer = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const [driving, setDriving] = useState(false)
  const speed = railSpeed(settings)
  const stage = railHeight(settings)
  const stopWidth = RAIL_STOP_WIDTHS[readText(settings, 'stopWidth')] ?? RAIL_STOP_WIDTHS.md!

  useMotionEffect(
    outer,
    ({ gsap }) => {
      const section = outer.current
      const rail = track.current
      const view = section?.ownerDocument.defaultView
      if (!section || !rail || !view) return
      const scroller = section.ownerDocument.documentElement

      const tween = gsap.to(rail, {
        x: () => -(rail.scrollWidth - section.clientWidth),
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          scroller,
          start: 'top top',
          // The tween must finish exactly when the sticky stage releases —
          // the overflow travel, whatever height the stage was given.
          end: () => `+=${(rail.scrollWidth - section.clientWidth) * speed}`,
          scrub: true,
          invalidateOnRefresh: true,
        },
      })
      const trigger = tween.scrollTrigger
      if (!trigger) return

      const motionQuery = view.matchMedia('(prefers-reduced-motion: reduce)')
      let isDriving = false
      const measure = () => {
        const next =
          !motionQuery.matches &&
          view.innerWidth >= 768 &&
          rail.scrollWidth - section.clientWidth > view.innerHeight * 0.1
        if (next) {
          // Scroll room for the overflow, scaled by the speed choice, plus
          // the stage's own height, so the sticky element releases only once
          // the last stop has rested in view. A slower speed means a longer,
          // calmer travel.
          section.style.height = `${
            (rail.scrollWidth - section.clientWidth) * speed + view.innerHeight * stage.fraction
          }px`
        } else {
          section.style.height = ''
          gsap.set(rail, { clearProps: 'transform' })
        }
        if (next !== isDriving) {
          isDriving = next
          setDriving(next)
        }
        if (next) trigger.enable()
        else trigger.disable(false)
        requestMotionRefresh()
      }
      measure()

      const resize = new view.ResizeObserver(measure)
      resize.observe(rail)
      view.addEventListener('resize', measure)
      void view.document.fonts?.ready.then(measure).catch(() => undefined)
      motionQuery.addEventListener('change', measure)

      return () => {
        resize.disconnect()
        view.removeEventListener('resize', measure)
        motionQuery.removeEventListener('change', measure)
        section.style.height = ''
      }
    },
    [blocks.length, items.length, speed, stage.fraction],
  )

  if (blocks.length === 0 && items.length === 0) {
    return <EmptyNotice>{empty('items')}</EmptyNotice>
  }

  return (
    <Box ref={outer} data-rail="section">
      <Box
        position={driving ? 'sticky' : 'static'}
        top="0"
        h={driving ? stage.css : 'auto'}
        display="flex"
        flexDirection="column"
        justifyContent="center"
        overflow="hidden"
        gap="6"
      >
        <SectionColumn>
          <SectionHeading field="heading">{readText(settings, 'heading')}</SectionHeading>
        </SectionColumn>
        <Box overflowX={driving ? 'hidden' : 'auto'} pb={driving ? '0' : '2'}>
          <Box ref={track} data-rail="track" w="max-content">
            {custom ? (
              <BlockStrip blocks={blocks} gap="5" width={stopWidth} />
            ) : (
              <Flex gap="5" w="max-content">
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
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
