/**
 * A theme's home page as a fixed-width page: header, sections and footer at
 * a desktop width. The theme library shows stored snapshots of it instead of
 * rendering it live; the snapshot renderer draws this same component into
 * static HTML for headless-Chrome capture, so a stored snapshot can never
 * drift from the render.
 */

import { Box, Container, Icon, IconButton } from '@chakra-ui/react'
import { LuSearch, LuShoppingBag, LuUser } from 'react-icons/lu'

import type { ThemeContent } from '../model/content'
import { isHeaderTransparent, StoreFooter, StoreHeader } from './chrome'
import { RenderProvider, type RenderEnvironment, type StorefrontRenderData } from './context'
import { PAGE_WIDTH_CONTAINER } from './primitives'
import { drawnSections, pageEdges, SectionsRenderer, ThemeScope } from './renderer'

/**
 * The desktop width the page is laid out at before scaling — and the width a
 * server-side snapshot is captured at, so cards and snapshots agree.
 */
export const SNAPSHOT_WIDTH = 1280

export interface SnapshotPageProps {
  content: ThemeContent
  data: StorefrontRenderData
  imageUrl: RenderEnvironment['imageUrl']
  formatPrice: RenderEnvironment['formatPrice']
  videoUrl?: RenderEnvironment['videoUrl']
}

/**
 * The page itself, with no frame, scaling or loading behaviour: header, home
 * sections and footer at a fixed desktop width. The server-side snapshot
 * renderer (`angkasa-builder/snapshot`) draws this component into static
 * HTML for headless-Chrome capture.
 */
export function TemplateSnapshotPage({
  content,
  data,
  imageUrl,
  formatPrice,
  videoUrl,
}: SnapshotPageProps) {
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
            categories={data.categories}
            collections={data.collections}
            cart={standIn(LuShoppingBag)}
            account={standIn(LuUser)}
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
            categories={data.categories}
            collections={data.collections}
            pages={[]}
            labels={{ information: '', followUs: '', links: '', trackOrder: '' }}
            flush={edges.flushBottom}
          />
        </ThemeScope>
      </RenderProvider>
    </Box>
  )
}
