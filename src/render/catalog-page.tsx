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
  Flex,
  HStack,
  Icon,
  NativeSelect,
  SimpleGrid,
  Stack,
  Text,
  type ButtonProps,
} from '@chakra-ui/react'
import type { MouseEvent, ReactNode } from 'react'
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

/* -------------------------------------------------------------------------- */
/* Header                                                                     */
/* -------------------------------------------------------------------------- */

export function CatalogHeader({ settings }: SectionProps) {
  const listing = useListing()
  const text = useRenderText()
  const centered = readText(settings, 'align') === 'center'
  if (!listing) return null

  const active = activeCategory(listing)
  const showFilters = readBoolean(settings, 'showFilters') && listing.categories.length > 0

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
          {readBoolean(settings, 'showDescription') && listing.description && (
            <Text color="fg.muted" maxW="2xl" mx={centered ? 'auto' : undefined}>
              {listing.description}
            </Text>
          )}
          {readBoolean(settings, 'showCount') && listing.total > 0 && (
            <Text fontSize="sm" color="fg.subtle">
              {text('results', { n: listing.total })}
            </Text>
          )}
        </Stack>
      )}

      {showFilters && <CategoryFilter listing={listing} settings={settings} active={active} />}
    </Stack>
  )
}

/**
 * The shop's categories as a filter over the catalogue. The chosen style is
 * per section; the sticky choice keeps the row under the store header while
 * the products scroll, on phones only or at every width.
 */
function CategoryFilter({
  listing,
  settings,
  active,
}: {
  listing: StorefrontListingData
  settings: SectionProps['settings']
  active: string | null
}) {
  const text = useRenderText()
  const { href, mode, navigate } = useRenderEnvironment()
  const style = filterStyleOf(settings)
  const sticky = readText(settings, 'filterSticky') || 'none'
  const pinned = sticky === 'always' || sticky === 'mobile'

  const follow = (event: MouseEvent<HTMLElement>, link: Parameters<typeof href>[0]) => {
    const url = href(link)
    if (!url) return
    if (mode === 'preview') return event.preventDefault()
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
      rounded={style === 'underline' ? 'none' : 'full'}
      flexShrink="0"
      variant={isActive ? (style === 'underline' ? 'ghost' : 'solid') : 'outline'}
      colorPalette={isActive ? 'brand' : 'gray'}
      borderBottomWidth={style === 'underline' ? '2px' : undefined}
      borderColor={style === 'underline' && isActive ? 'brand.solid' : 'transparent'}
      _hover={{ textDecoration: 'none' }}
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
      aria-label={text('filters')}
      gap={style === 'underline' ? '5' : '2'}
      overflowX="auto"
      pb="1"
      flexWrap={{ base: 'nowrap', md: style === 'underline' ? 'nowrap' : 'wrap' }}
      css={{ scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}
    >
      {chip(text('allCategories'), { kind: 'catalog' }, active === null && !listing.current)}
      {listing.categories.map((category) =>
        chip(category.name, { kind: 'catalog', category: category.slug }, active === category.slug),
      )}
    </HStack>
  )

  const select = (
    <NativeSelect.Root size="sm" maxW="xs" aria-label={text('filters')}>
      <NativeSelect.Field
        value={active ?? ''}
        rounded="l2"
        onChange={(event) => {
          const slug = event.currentTarget.value
          const link = slug
            ? { kind: 'catalog' as const, category: slug }
            : { kind: 'catalog' as const }
          const url = href(link)
          if (url && mode === 'live' && navigate) navigate(url)
        }}
      >
        <option value="">{text('allCategories')}</option>
        {listing.categories.map((category) => (
          <option key={category.id} value={category.slug}>
            {category.name}
          </option>
        ))}
      </NativeSelect.Field>
      <NativeSelect.Indicator />
    </NativeSelect.Root>
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
