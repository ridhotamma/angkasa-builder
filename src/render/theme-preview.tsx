/**
 * A theme's home page, drawn small: header, sections and footer at a desktop
 * width, scaled down to fit a card. For the theme library, so a template is
 * judged by the page it makes — with the shop's own products — rather than
 * by its name.
 *
 * It renders only once scrolled near the viewport, never takes clicks or
 * focus, and is hidden from assistive tech: it is a picture of a page.
 * Scaling with a CSS transform also makes the transformed box the containing
 * block for `position: fixed`, so a see-through header stays in the card.
 *
 * While the page is not mounted yet a skeleton holds the card, so cards
 * entering together do not flash empty or shift around each other. The page
 * itself mounts hidden behind the skeleton and is only revealed once it has
 * painted: while it renders, the skeleton is the *only* thing on screen, so
 * the swap happens exactly once and never flickers back and forth.
 */

import { Box, Container, HStack, Icon, IconButton, Skeleton, Stack } from '@chakra-ui/react'
import { memo, useEffect, useRef, useState } from 'react'
import { LuSearch, LuShoppingBag, LuUser } from 'react-icons/lu'

import type { ThemeContent } from '../model/content'
import { googleFontsHref } from '../model/settings'
import { isHeaderTransparent, StoreFooter, StoreHeader } from './chrome'
import { RenderProvider, type RenderEnvironment, type StorefrontRenderData } from './context'
import { PAGE_WIDTH_CONTAINER } from './primitives'
import { drawnSections, pageEdges, SectionsRenderer, ThemeScope } from './renderer'

/**
 * The desktop width the page is laid out at before scaling — and the width a
 * server-side snapshot is captured at, so cards and snapshots agree.
 */
export const SNAPSHOT_WIDTH = 1280

export interface ThemePreviewProps {
  content: ThemeContent
  data: StorefrontRenderData
  imageUrl: RenderEnvironment['imageUrl']
  formatPrice: RenderEnvironment['formatPrice']
  videoUrl?: RenderEnvironment['videoUrl']
}

/**
 * The page itself, with no frame, scaling or loading behaviour: header, home
 * sections and footer at a fixed desktop width. `ThemePreview` draws it small
 * in a card; the server-side snapshot renderer (`@repo/page-builder/snapshot`)
 * draws the same component into static HTML for headless-Chrome capture, so a
 * stored snapshot can never drift from the live render.
 */
export function TemplateSnapshotPage({
  content,
  data,
  imageUrl,
  formatPrice,
  videoUrl,
}: ThemePreviewProps) {
  // The home page: what a shopper sees first, and what a theme is chosen by.
  const sections = content.templates.home
  const edges = pageEdges(drawnSections(sections, 'live', new Date()))
  const transparent = isHeaderTransparent(content.layout.header, edges)
  const shop = {
    name: data.shop.name,
    logoUrl: data.shop.logoUrl,
    description: data.shop.description,
    email: data.shop.email ?? null,
  }
  const env: RenderEnvironment = {
    data,
    settings: content.settings,
    mode: 'live',
    imageUrl,
    videoUrl,
    formatPrice,
  }
  const standIn = (icon: typeof LuSearch) => (
    <IconButton aria-hidden variant="ghost" size="sm" rounded="full" color="inherit" tabIndex={-1}>
      <Icon as={icon} boxSize="4.5" />
    </IconButton>
  )

  return (
    <Box w={`${SNAPSHOT_WIDTH}px`}>
      <RenderProvider value={env}>
        <ThemeScope settings={content.settings} display="flex" flexDirection="column">
          <StoreHeader
            header={content.layout.header}
            shop={shop}
            menu={[]}
            actions={
              <>
                {standIn(LuShoppingBag)}
                {standIn(LuUser)}
              </>
            }
            searchButton={standIn(LuSearch)}
            transparent={transparent}
          />
          <Box {...PAGE_WIDTH_CONTAINER}>
            <Container
              maxW="6xl"
              px="6"
              pt={edges.flushTop ? '0' : '10'}
              pb={edges.flushBottom ? '0' : '10'}
            >
              <SectionsRenderer sections={sections} env={env} />
            </Container>
          </Box>
          <StoreFooter
            footer={content.layout.footer}
            shop={shop}
            menu={[]}
            pages={[]}
            labels={{ information: '', followUs: '', links: '' }}
            flush={edges.flushBottom}
          />
        </ThemeScope>
      </RenderProvider>
    </Box>
  )
}

export const ThemePreview = memo(function ThemePreview(props: ThemePreviewProps) {
  const { content } = props
  const frame = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  // Mounted once the card is near the screen and an idle slot opens; revealed
  // once the mounted page has painted. Both only ever flip false -> true, so
  // the skeleton can never come back after the preview appears.
  const [mounted, setMounted] = useState(false)
  const [painted, setPainted] = useState(false)

  // Scale to the card, and wait until the card is near the screen: a library
  // of full pages rendered at once would be a heavy first paint. The page
  // then mounts on an idle slot, so cards entering together do not all render
  // in the same frame.
  useEffect(() => {
    const node = frame.current
    if (!node) return
    let raf = 0
    const resize = new ResizeObserver(([entry]) => {
      const next = Math.round(entry?.contentRect.width ?? 0)
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setWidth((previous) => (previous === next ? previous : next)))
    })
    resize.observe(node)
    let cancelScheduled: (() => void) | undefined
    const visible = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        visible.disconnect()
        const view = node.ownerDocument.defaultView ?? window
        if (typeof view.requestIdleCallback === 'function') {
          const id = view.requestIdleCallback(() => setMounted(true), { timeout: 1500 })
          cancelScheduled = () => view.cancelIdleCallback(id)
        } else {
          const id = view.setTimeout(() => setMounted(true), 0)
          cancelScheduled = () => view.clearTimeout(id)
        }
      },
      { rootMargin: '200px' },
    )
    visible.observe(node)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      resize.disconnect()
      visible.disconnect()
      cancelScheduled?.()
    }
  }, [])

  // Reveal only after the mounted page has produced a frame: two animation
  // frames past mount, so the skeleton covers the whole heavy first render.
  useEffect(() => {
    if (!mounted || width === 0 || painted) return
    let first = 0
    let second = 0
    first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setPainted(true))
    })
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [mounted, width, painted])

  const scale = width / SNAPSHOT_WIDTH
  const loaded = mounted && width > 0
  const fonts = googleFontsHref(content.settings)

  return (
    <Box ref={frame} position="relative" w="full" h="full" overflow="hidden" aria-hidden>
      {!painted && <PreviewSkeleton />}
      {loaded && (
        <Box
          // `inert`: nothing inside is clickable or reachable by Tab.
          {...{ inert: true }}
          position="absolute"
          top="0"
          left="0"
          w={`${SNAPSHOT_WIDTH}px`}
          transformOrigin="top left"
          pointerEvents="none"
          userSelect="none"
          // Hidden until painted: the skeleton above is the only visible
          // thing while the page renders underneath it.
          visibility={painted ? 'visible' : 'hidden'}
          style={{ transform: `scale(${scale})` }}
        >
          {fonts && <link rel="stylesheet" href={fonts} precedence="default" />}
          <TemplateSnapshotPage {...props} />
        </Box>
      )}
    </Box>
  )
})

/** Holds the card while its page renders: header, hero and rows in miniature. */
function PreviewSkeleton() {
  return (
    <Stack position="absolute" inset="0" p="4" gap="3" aria-hidden>
      <HStack gap="3" align="center">
        <Skeleton boxSize="8" rounded="full" />
        <Skeleton h="4" flex="1" rounded="full" />
        <Skeleton boxSize="8" rounded="full" />
        <Skeleton boxSize="8" rounded="full" />
      </HStack>
      <Skeleton flex="2" rounded="lg" />
      <HStack gap="3" flex="1">
        <Skeleton flex="1" rounded="lg" />
        <Skeleton flex="1" rounded="lg" />
        <Skeleton flex="1" rounded="lg" />
      </HStack>
      <Skeleton h="5" rounded="full" />
    </Stack>
  )
}
