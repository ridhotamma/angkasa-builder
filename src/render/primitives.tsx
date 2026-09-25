/**
 * The small pieces every section is built from.
 *
 * Each one reads the theme settings, so a button is solid, outlined or a pill
 * and a card has a border, a shadow or neither — decided once here rather than
 * in every section.
 */

import {
  AspectRatio,
  Box,
  Button,
  Card,
  Heading,
  Link as ChakraLink,
  SimpleGrid,
  Stack,
  Text,
  type BoxProps,
  type LinkProps,
} from '@chakra-ui/react'
import type { MouseEvent, ReactNode } from 'react'

import { ImageWithFallback } from '@repo/theme'

import type { Link } from '../model/links'
import type { ButtonStyle, CardStyle } from '../model/settings'
import { useRenderEnvironment, type StorefrontProductCard } from './context'

/** The anchor props a link needs: where it goes, and whether it opens a new tab. */
function useAnchor(link: Link) {
  const { href, mode, navigate } = useRenderEnvironment()
  const url = href(link)
  if (!url) return null
  const external = link.kind === 'url'
  return {
    href: url,
    ...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
    onClick: (event: MouseEvent<HTMLElement>) => {
      // A preview shows where a link goes without going there.
      if (mode === 'preview') return event.preventDefault()
      // Inside the shop, hand the click to the host's router instead of
      // reloading the whole document. Modified clicks (new tab, new window)
      // keep the browser's own behaviour.
      if (external || !navigate || event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      event.preventDefault()
      navigate(url)
    },
  }
}

/** Chakra's `Link`, unstyled so it takes on whatever it wraps; a plain box when there is no link. */
export function SmartLink({
  link,
  children,
  ...props
}: { link: Link; children: ReactNode } & Omit<LinkProps, 'href' | 'onClick'>) {
  const anchor = useAnchor(link)
  if (!anchor) return <Box {...(props as BoxProps)}>{children}</Box>
  return (
    <ChakraLink unstyled {...props} {...anchor}>
      {children}
    </ChakraLink>
  )
}

/**
 * Both branches — plain button and link — must size the same way, so neither
 * sets its own alignment: the section's container decides (`align` on the
 * surrounding `Stack`). A container that leaves the default `stretch` gets a
 * full-width button whether or not a link is chosen.
 */
/**
 * What a theme's button style means for a primary button. Shared with the
 * storefront's own pages (checkout, order status), so a theme's buttons look
 * the same inside page-builder sections and out of them.
 */
export function buttonLook(style: ButtonStyle): {
  variant: 'solid' | 'outline'
  rounded: 'full' | 'l2'
} {
  return {
    variant: style === 'outline' ? 'outline' : 'solid',
    rounded: style === 'pill' ? 'full' : 'l2',
  }
}

/** What a theme's card style means for a card's frame. Shared like `buttonLook`. */
export function cardFrame(style: CardStyle): BoxProps {
  switch (style) {
    case 'shadow':
      return { borderWidth: '0', shadow: 'md' }
    case 'flat':
      return { borderWidth: '0', shadow: 'none', bg: 'transparent' }
    case 'border':
      return { borderWidth: '1px', borderColor: 'border.subtle' }
  }
}

export function ThemeButton({ label, link }: { label: string; link: Link }) {
  const { settings } = useRenderEnvironment()
  const anchor = useAnchor(link)
  if (!label) return null

  const { variant, rounded } = buttonLook(settings.buttonStyle)

  if (!anchor) {
    return (
      <Button colorPalette="brand" variant={variant} rounded={rounded} size="lg">
        {label}
      </Button>
    )
  }

  return (
    <Button asChild colorPalette="brand" variant={variant} rounded={rounded} size="lg">
      <ChakraLink unstyled {...anchor}>
        {label}
      </ChakraLink>
    </Button>
  )
}

export function SectionHeading({
  children,
  align = 'left',
}: {
  children: ReactNode
  align?: 'left' | 'center'
}) {
  if (!children) return null
  return (
    <Heading as="h2" size={{ base: 'lg', md: 'xl' }} textAlign={align} letterSpacing="-0.01em">
      {children}
    </Heading>
  )
}

/** Plain text with blank lines as paragraph breaks. Never HTML. */
export function Paragraphs({ text, align = 'left' }: { text: string; align?: 'left' | 'center' }) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
  if (paragraphs.length === 0) return null

  return (
    <Stack gap="3" textAlign={align}>
      {paragraphs.map((paragraph, index) => (
        <Text key={index} color="fg.muted" whiteSpace="pre-line" lineHeight="tall">
          {paragraph}
        </Text>
      ))}
    </Stack>
  )
}

/**
 * The page's width, for a section that runs edge to edge.
 *
 * Put on the element that spans the whole page (the storefront shell, the
 * editor's preview) so a section inside the centred column can size itself
 * against it. Container units rather than `100vw`: the viewport is wrong in
 * the editor, where the preview is narrower than the window, and on the
 * storefront it includes the scrollbar, which makes the page scroll sideways.
 */
export const PAGE_WIDTH_CONTAINER = { containerType: 'inline-size' } as const

/** Runs edge to edge across the page, from inside the centred column. */
export function FullBleed(props: BoxProps) {
  return <Box w="100cqw" marginInline="calc(50% - 50cqw)" {...props} />
}

/** Shown in a preview where the live storefront would render nothing. */
export function EmptyNotice({ children }: { children: ReactNode }) {
  const { mode } = useRenderEnvironment()
  if (mode === 'live') return null
  return (
    <Box
      borderWidth="1px"
      borderStyle="dashed"
      borderColor="border"
      rounded="l3"
      p="6"
      textAlign="center"
      color="fg.muted"
      fontSize="sm"
    >
      {children}
    </Box>
  )
}

/** A card's frame under the theme's card style; `flat` drops the frame entirely. */
export function useCardStyle(): { frame: BoxProps; flat: boolean } {
  const { settings } = useRenderEnvironment()
  return { frame: cardFrame(settings.cardStyle), flat: settings.cardStyle === 'flat' }
}

export function ProductCard({ product }: { product: StorefrontProductCard }) {
  const { data, formatPrice } = useRenderEnvironment()
  const { frame, flat } = useCardStyle()

  return (
    <Card.Root
      h="full"
      bg="bg.panel"
      rounded="l3"
      overflow="hidden"
      transition="border-color 150ms"
      _hover={{ borderColor: 'brand.emphasized' }}
      {...frame}
    >
      <SmartLink
        link={{ kind: 'product', slug: product.slug }}
        display="flex"
        flexDirection="column"
        h="full"
      >
        <AspectRatio
          ratio={1}
          bg="bg.subtle"
          flexShrink="0"
          rounded={flat ? 'l3' : undefined}
          overflow="hidden"
        >
          <ImageWithFallback
            src={product.imageUrl ?? undefined}
            alt={product.name}
            objectFit="cover"
            loading="lazy"
          />
        </AspectRatio>
        <Stack gap="1.5" p={flat ? '2' : { base: '3', sm: '3.5' }} flex="1">
          <Text fontSize={{ base: 'sm', sm: 'md' }} fontWeight="medium" lineClamp={2}>
            {product.name}
          </Text>
          <Stack direction="row" gap="1.5" align="baseline" wrap="wrap">
            <Text fontWeight="bold" fontVariantNumeric="tabular-nums">
              {formatPrice(product.price, data.shop.currency)}
            </Text>
            {product.compareAtPrice !== null && (
              <Text fontSize="sm" color="fg.subtle" textDecoration="line-through">
                {formatPrice(product.compareAtPrice, data.shop.currency)}
              </Text>
            )}
          </Stack>
        </Stack>
      </SmartLink>
    </Card.Root>
  )
}

export function gridColumns(columns: string): { base: number; md: number; lg: number } {
  const n = Math.min(6, Math.max(2, Number(columns) || 4))
  return { base: 2, md: Math.min(3, n), lg: n }
}

export function ProductGrid({
  products,
  columns = '4',
}: {
  products: StorefrontProductCard[]
  columns?: string
}) {
  return (
    <SimpleGrid columns={gridColumns(columns)} gap={{ base: '3', md: '5' }}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </SimpleGrid>
  )
}
