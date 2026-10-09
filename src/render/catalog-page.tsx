/**
 * The catalogue page's sections.
 *
 * One template serves every listing page — the whole catalogue (`/products`),
 * a category (`/c/<slug>`) and a collection (`/k/<slug>`) — because they are
 * the same screen with different server data. The host passes that data as
 * `env.data.listing`; the editor, which has no listing, gets `previewListing`.
 *
 * Two sections: `catalog-header` (title, description, result count and the
 * category filter) and `catalog-products` (the card grid and its pagination).
 * Both are required by the template's sanitiser, so a catalogue page always
 * has its heading and its products.
 */

import {
  Box,
  Breadcrumb,
  Button,
  chakra,
  Combobox,
  createListCollection,
  Flex,
  HStack,
  Icon,
  Portal,
  SimpleGrid,
  Stack,
  Text,
  type ButtonProps,
} from '@chakra-ui/react'
import { useMemo, useState, type MouseEvent, type ReactNode } from 'react'
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu'

import { readBoolean, readText } from '../model/fields'
import { HEADER_HEIGHT_VAR } from './chrome'
import { previewListing, useRenderEnvironment, type StorefrontListingData } from './context'
import { useRenderText } from './copy'
import { ProductCard, SmartLink } from './primitives'
import type { SectionProps } from './sections'

/** The listing a catalogue section draws: the host's, or the editor's sample. */
function useListing(): StorefrontListingData | null {
  const { data, mode } = useRenderEnvironment()
  if (data.listing) return data.listing
  return mode === 'preview' ? previewListing(data) : null
}

/** The host's pager URL builder; the plain catalogue's own URLs without one. */
function usePageHref(): (page: number) => string {
  const { pageHref } = useRenderEnvironment()
  return pageHref ?? ((page) => (page <= 1 ? '/products' : `/products?page=${page}`))
}

/** How far under the sticky store header a pinned filter row sits. */
const STICKY_UNDER_HEADER = `var(${HEADER_HEIGHT_VAR}, 76px)`

/** The classes a category filter row can wear. */
const FILTER_STYLES = ['chips', 'underline', 'select'] as const
type FilterStyle = (typeof FILTER_STYLES)[number]

function filterStyleOf(settings: SectionProps['settings']): FilterStyle {
  const value = readText(settings, 'filterStyle')
  return (FILTER_STYLES as readonly string[]).includes(value) ? (value as FilterStyle) : 'chips'
}

/** The category a listing page is showing, or `null` for the whole catalogue. */
function activeCategory(listing: StorefrontListingData): string | null {
  return listing.current?.kind === 'category' ? listing.current.slug : null
}

/**
 * What the filter row offers. The catalogue and a category page filter by the
 * shop's categories; a collection page filters by its sibling collections,
 * because "New Arrival next to Kaos" is a category jump the shopper did not
 * ask for.
 */
function filterMode(listing: StorefrontListingData): 'categories' | 'collections' {
  return listing.current?.kind === 'collection' ? 'collections' : 'categories'
}

/* -------------------------------------------------------------------------- */
/* Header                                                                     */
/* -------------------------------------------------------------------------- */

export function CatalogHeader({ settings }: SectionProps) {
  const listing = useListing()
  const text = useRenderText()
  const centered = readText(settings, 'align') === 'center'
  if (!listing) return null

  const mode = filterMode(listing)
  const entries = mode === 'collections' ? (listing.collections ?? []) : listing.categories
  const showFilters = readBoolean(settings, 'showFilters') && entries.length > 0
  // The listing's own words win on a category or collection page. On the plain
  // catalogue the seller's copy is what they typed, falling back to the
  // localized default while they have not written one.
  const description = listing.current
    ? listing.description
    : listing.description || readText(settings, 'description') || text('allProductsDescription')

  return (
    <Stack as="section" gap="4">
      {readBoolean(settings, 'breadcrumbs') && (
        <Breadcrumb.Root size="sm">
          <Breadcrumb.List color="fg.muted" flexWrap="wrap">
            <Breadcrumb.Item>
              <Breadcrumb.Link asChild>
                <SmartLink link={{ kind: 'home' }}>{text('home')}</SmartLink>
              </Breadcrumb.Link>
            </Breadcrumb.Item>
            <Breadcrumb.Separator />
            <Breadcrumb.Item>
              {listing.current ? (
                <Breadcrumb.Link asChild>
                  <SmartLink link={{ kind: 'catalog' }}>{text('allProducts')}</SmartLink>
                </Breadcrumb.Link>
              ) : (
                <Breadcrumb.CurrentLink color="fg">{text('allProducts')}</Breadcrumb.CurrentLink>
              )}
            </Breadcrumb.Item>
            {listing.current && (
              <>
                <Breadcrumb.Separator />
                <Breadcrumb.Item>
                  <Breadcrumb.CurrentLink color="fg">{listing.current.name}</Breadcrumb.CurrentLink>
                </Breadcrumb.Item>
              </>
            )}
          </Breadcrumb.List>
        </Breadcrumb.Root>
      )}

      {(readBoolean(settings, 'showTitle') ||
        readBoolean(settings, 'showDescription') ||
        readBoolean(settings, 'showCount')) && (
        <Stack as="header" gap="2" textAlign={centered ? 'center' : 'start'}>
          {readBoolean(settings, 'showTitle') && (
            <Text
              as="h1"
              fontFamily="heading"
              fontWeight="semibold"
              letterSpacing="-0.02em"
              fontSize={{ base: '2xl', md: '3xl' }}
            >
              {listing.title}
            </Text>
          )}
          {readBoolean(settings, 'showDescription') && description && (
            <Text color="fg.muted" maxW="2xl" mx={centered ? 'auto' : undefined}>
              {description}
            </Text>
          )}
          {readBoolean(settings, 'showCount') && listing.total > 0 && (
            <Text fontSize="sm" color="fg.subtle">
              {text('results', { n: listing.total })}
            </Text>
          )}
        </Stack>
      )}

      {showFilters && (
        <CatalogFilter listing={listing} settings={settings} mode={mode} entries={entries} />
      )}
    </Stack>
  )
}

interface FilterEntry {
  id: string
  name: string
  slug: string
}

/**
 * The shop's categories — or a collection page's sibling collections — as a
 * filter over the catalogue. The chosen style is per section; the sticky
 * choice keeps the row under the store header while the products scroll, on
 * phones only or at every width.
 */
function CatalogFilter({
  listing,
  settings,
  mode,
  entries,
}: {
  listing: StorefrontListingData
  settings: SectionProps['settings']
  mode: 'categories' | 'collections'
  entries: readonly FilterEntry[]
}) {
  const text = useRenderText()
  const { href, mode: renderMode, navigate } = useRenderEnvironment()
  const style = filterStyleOf(settings)
  const sticky = readText(settings, 'filterSticky') || 'none'
  const pinned = sticky === 'always' || sticky === 'mobile'
  const underline = style === 'underline'
  const byCollections = mode === 'collections'
  const [query, setQuery] = useState('')

  const active = byCollections
    ? listing.current?.kind === 'collection'
      ? listing.current.slug
      : null
    : activeCategory(listing)
  const allLabel = text('allCategories')
  const activeName = entries.find((entry) => entry.slug === active)?.name ?? allLabel
  const label = byCollections ? text('filtersCollections') : text('filters')

  /** The link a filter choice points at: catalog + category, or one collection. */
  const linkFor = (slug: string | null) =>
    byCollections
      ? slug
        ? ({ kind: 'collection', slug } as const)
        : ({ kind: 'catalog' } as const)
      : slug
        ? ({ kind: 'catalog', category: slug } as const)
        : ({ kind: 'catalog' } as const)

  const collection = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const items = [
      { value: '', label: allLabel },
      ...entries.map((entry) => ({ value: entry.slug, label: entry.name })),
    ].filter((item) => item.value === '' || !needle || item.label.toLowerCase().includes(needle))
    return createListCollection({ items })
  }, [entries, allLabel, query])

  const follow = (event: MouseEvent<HTMLElement>, link: Parameters<typeof href>[0]) => {
    const url = href(link)
    if (!url) return
    if (renderMode === 'preview') return event.preventDefault()
    if (!navigate || event.defaultPrevented || event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    navigate(url)
  }

  const chip = (label: string, link: Parameters<typeof href>[0], isActive: boolean) => (
    <Button
      key={label}
      asChild
      size="sm"
      rounded={underline ? 'none' : 'full'}
      flexShrink="0"
      variant={underline ? 'ghost' : isActive ? 'solid' : 'outline'}
      colorPalette={isActive ? 'brand' : 'gray'}
      // Underline tabs sit flush: no gap between them, the padding gives each
      // its room. Pill chips keep the gap that reads as separate controls.
      px={underline ? '3' : undefined}
      borderBottomWidth={underline ? '2px' : undefined}
      borderColor={underline ? (isActive ? 'brand.solid' : 'transparent') : undefined}
      _hover={{ textDecoration: 'none', ...(underline ? { color: 'fg' } : {}) }}
    >
      <chakra.a
        href={href(link) ?? undefined}
        aria-current={isActive ? 'page' : undefined}
        onClick={(event) => follow(event, link)}
      >
        {label}
      </chakra.a>
    </Button>
  )

  const row = (
    <HStack
      as="nav"
      aria-label={label}
      gap={underline ? '0' : '2'}
      overflowX="auto"
      pb="1"
      flexWrap={{ base: 'nowrap', md: underline ? 'nowrap' : 'wrap' }}
      css={{ scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}
    >
      {chip(allLabel, linkFor(null), listing.current === null)}
      {entries.map((entry) => chip(entry.name, linkFor(entry.slug), active === entry.slug))}
    </HStack>
  )

  // The dropdown is a combobox, not a native select: a shop with fifty
  // collections needs to type four letters, not scroll a system menu.
  const select = (
    <Combobox.Root
      // Remount when the page changes, so the input shows the new choice.
      key={active ?? 'all'}
      collection={collection}
      size="sm"
      maxW="xs"
      width="full"
      openOnClick
      defaultInputValue={activeName}
      onInputValueChange={({ inputValue }) => setQuery(inputValue)}
      onValueChange={({ value }) => {
        const slug = value[0] ?? ''
        const url = href(linkFor(slug || null))
        if (url && renderMode === 'live' && navigate) navigate(url)
      }}
      positioning={{ sameWidth: true }}
    >
      <Combobox.Control>
        <Combobox.Input placeholder={allLabel} aria-label={label} />
        <Combobox.IndicatorGroup>
          <Combobox.Trigger />
        </Combobox.IndicatorGroup>
      </Combobox.Control>
      <Portal>
        <Combobox.Positioner>
          <Combobox.Content>
            <Combobox.Empty>{text('noMatches')}</Combobox.Empty>
            {collection.items.map((item) => (
              <Combobox.Item item={item} key={item.value}>
                {item.label}
                <Combobox.ItemIndicator />
              </Combobox.Item>
            ))}
          </Combobox.Content>
        </Combobox.Positioner>
      </Portal>
    </Combobox.Root>
  )

  const content = style === 'select' ? select : row

  if (!pinned) return content

  return (
    <Box
      position={sticky === 'mobile' ? { base: 'sticky', md: 'static' } : 'sticky'}
      top={{ base: STICKY_UNDER_HEADER, md: sticky === 'always' ? STICKY_UNDER_HEADER : undefined }}
      zIndex={{ base: 1, md: sticky === 'always' ? 1 : undefined }}
      bg={{ base: 'bg/90', md: sticky === 'always' ? 'bg/90' : undefined }}
      backdropFilter={{ base: 'blur(8px)', md: sticky === 'always' ? 'blur(8px)' : undefined }}
      py={{ base: '2', md: sticky === 'always' ? '2' : undefined }}
    >
      {content}
    </Box>
  )
}

/* -------------------------------------------------------------------------- */
/* Products and pagination                                                    */
/* -------------------------------------------------------------------------- */

const GAPS = {
  tight: { base: '2', md: '3' },
  cozy: { base: '3', md: '5' },
  airy: { base: '4', md: '7' },
} as const

const ALIGN = { start: 'flex-start', center: 'center', end: 'flex-end' } as const

export function CatalogProducts({ settings }: SectionProps) {
  const listing = useListing()
  const pageHref = usePageHref()
  const text = useRenderText()
  if (!listing) return null

  const desktop = Number(readText(settings, 'columns')) || 4
  const tablet = Number(readText(settings, 'tabletColumns')) || 3
  const mobile = readText(settings, 'mobileColumns') === '1' ? 1 : 2
  const gap = GAPS[(readText(settings, 'gap') as keyof typeof GAPS) || 'cozy'] ?? GAPS.cozy
  const pagination = readText(settings, 'pagination') || 'numbers'
  const align = ALIGN[(readText(settings, 'paginationAlign') as keyof typeof ALIGN) || 'center']

  return (
    <Stack as="section" gap="0">
      {listing.products.length === 0 ? (
        <Text color="fg.muted" py="8" textAlign="center">
          {text('noProducts')}
        </Text>
      ) : (
        <SimpleGrid
          data-product-layout="catalog"
          columns={{ base: mobile, md: tablet, lg: desktop }}
          gap={gap}
        >
          {listing.products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </SimpleGrid>
      )}

      {pagination !== 'none' && listing.pages > 1 && (
        <CatalogPagination
          listing={listing}
          pageHref={pageHref}
          style={pagination}
          justify={align}
        />
      )}
    </Stack>
  )
}

/** The page numbers a `numbers` pager draws: first, last, and the current one's neighbours. */
export function pageItems(page: number, pages: number): Array<number | 'gap'> {
  const wanted = new Set<number>([1, pages, page - 1, page, page + 1])
  const numbers = [...wanted].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b)
  const items: Array<number | 'gap'> = []
  let previous = 0
  for (const n of numbers) {
    if (n - previous > 1) items.push('gap')
    items.push(n)
    previous = n
  }
  return items
}

/** An anchor that pages the listing through the host's router, not a reload. */
function PageLink({
  href,
  children,
  ...props
}: { href: string; children: ReactNode } & Omit<ButtonProps, 'children'>) {
  const { mode, navigate } = useRenderEnvironment()
  return (
    <Button asChild size="sm" {...props}>
      <chakra.a
        href={href}
        onClick={(event) => {
          if (mode === 'preview') return event.preventDefault()
          if (!navigate || event.defaultPrevented || event.button !== 0) return
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
          event.preventDefault()
          navigate(href)
        }}
      >
        {children}
      </chakra.a>
    </Button>
  )
}

function CatalogPagination({
  listing,
  pageHref,
  style,
  justify,
}: {
  listing: StorefrontListingData
  pageHref: (page: number) => string
  style: string
  justify: string
}) {
  const text = useRenderText()
  const { page, pages } = listing
  const to = (target: number) => pageHref(target)

  if (style === 'compact') {
    return (
      <Flex justify={justify} align="center" gap="3" pt="6">
        {page > 1 && (
          <PageLink href={to(page - 1)} aria-label={text('previousPage')} variant="outline">
            <Icon as={LuChevronLeft} />
          </PageLink>
        )}
        <Text fontSize="sm" color="fg.muted" fontVariantNumeric="tabular-nums">
          {text('pageOf', { page, pages })}
        </Text>
        {page < pages && (
          <PageLink href={to(page + 1)} aria-label={text('nextPage')} variant="outline">
            <Icon as={LuChevronRight} />
          </PageLink>
        )}
      </Flex>
    )
  }

  if (style === 'simple') {
    return (
      <Flex justify={justify} align="center" gap="3" pt="6">
        <PageLink
          href={to(page - 1)}
          variant="outline"
          disabled={page <= 1}
          pointerEvents={page <= 1 ? 'none' : undefined}
          opacity={page <= 1 ? 0.5 : undefined}
        >
          {text('previousPage')}
        </PageLink>
        <Text fontSize="sm" color="fg.muted" fontVariantNumeric="tabular-nums">
          {text('pageOf', { page, pages })}
        </Text>
        <PageLink
          href={to(page + 1)}
          variant="outline"
          disabled={page >= pages}
          pointerEvents={page >= pages ? 'none' : undefined}
          opacity={page >= pages ? 0.5 : undefined}
        >
          {text('nextPage')}
        </PageLink>
      </Flex>
    )
  }

  return (
    <Flex justify={justify} align="center" gap="1" pt="6" wrap="wrap">
      {page > 1 && (
        <PageLink href={to(page - 1)} aria-label={text('previousPage')} variant="ghost">
          <Icon as={LuChevronLeft} />
        </PageLink>
      )}
      {pageItems(page, pages).map((item, index) =>
        item === 'gap' ? (
          <Text key={`gap-${index}`} px="1" color="fg.subtle">
            …
          </Text>
        ) : item === page ? (
          <Button key={item} size="sm" colorPalette="brand" variant="solid" aria-current="page">
            {item}
          </Button>
        ) : (
          <PageLink key={item} href={to(item)} variant="ghost">
            {item}
          </PageLink>
        ),
      )}
      {page < pages && (
        <PageLink href={to(page + 1)} aria-label={text('nextPage')} variant="ghost">
          <Icon as={LuChevronRight} />
        </PageLink>
      )}
    </Flex>
  )
}
