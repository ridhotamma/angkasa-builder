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
 */

import { Box, Container, Icon, IconButton } from '@chakra-ui/react'
import { useEffect, useRef, useState } from 'react'
import { LuSearch, LuShoppingBag, LuUser } from 'react-icons/lu'

import type { ThemeContent } from '../model/content'
import { googleFontsHref } from '../model/settings'
import { isHeaderTransparent, StoreFooter, StoreHeader } from './chrome'
import { RenderProvider, type RenderEnvironment, type StorefrontRenderData } from './context'
import { PAGE_WIDTH_CONTAINER } from './primitives'
import { drawnSections, pageEdges, SectionsRenderer, ThemeScope } from './renderer'

/** The desktop width the page is laid out at before scaling. */
const PAGE_WIDTH = 1280

export interface ThemePreviewProps {
  content: ThemeContent
  data: StorefrontRenderData
  imageUrl: RenderEnvironment['imageUrl']
  formatPrice: RenderEnvironment['formatPrice']
  videoUrl?: RenderEnvironment['videoUrl']
}

export function ThemePreview({
  content,
  data,
  imageUrl,
  formatPrice,
  videoUrl,
}: ThemePreviewProps) {
  const frame = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [near, setNear] = useState(false)

  // Scale to the card, and wait until the card is near the screen: a library
  // of full pages rendered at once would be a heavy first paint.
  useEffect(() => {
    const node = frame.current
    if (!node) return
    const resize = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0))
    resize.observe(node)
    const visible = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setNear(true)
          visible.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    visible.observe(node)
    return () => {
      resize.disconnect()
      visible.disconnect()
    }
  }, [])

  const scale = width / PAGE_WIDTH
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
  const fonts = googleFontsHref(content.settings)

  return (
    <Box ref={frame} position="relative" w="full" h="full" overflow="hidden" aria-hidden>
      {near && width > 0 && (
        <Box
          // `inert`: nothing inside is clickable or reachable by Tab.
          {...{ inert: true }}
          position="absolute"
          top="0"
          left="0"
          w={`${PAGE_WIDTH}px`}
          transformOrigin="top left"
          pointerEvents="none"
          userSelect="none"
          style={{ transform: `scale(${scale})` }}
        >
          {fonts && <link rel="stylesheet" href={fonts} precedence="default" />}
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
      )}
    </Box>
  )
}
