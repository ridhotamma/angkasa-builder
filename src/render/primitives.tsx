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
  SimpleGrid,
  Stack,
  Text,
  type BoxProps,
} from '@chakra-ui/react'
import type { ReactNode } from 'react'

import { ImageWithFallback } from '@repo/theme'

import type { Link } from '../model/links'
import { useRenderEnvironment, type StorefrontProductCard } from './context'

/** An anchor that does not navigate in a preview. */
export function SmartLink({
  link,
  children,
  ...props
}: { link: Link; children: ReactNode } & Omit<BoxProps, 'as'>) {
  const { href, mode } = useRenderEnvironment()
  const url = href(link)
  if (!url) return <Box {...props}>{children}</Box>

  const external = link.kind === 'url'
  return (
    <Box
      asChild
      {...props}
      onClick={mode === 'preview' ? (event) => event.preventDefault() : undefined}
    >
      <a href={url} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        {children}
      </a>
    </Box>
  )
}

export function ThemeButton({ label, link }: { label: string; link: Link }) {
  const { settings, href, mode } = useRenderEnvironment()
  const url = href(link)
  if (!label) return null

  const variant = settings.buttonStyle === 'outline' ? 'outline' : 'solid'
  const rounded = settings.buttonStyle === 'pill' ? 'full' : 'l2'

  const button = (
    <Button colorPalette="brand" variant={variant} rounded={rounded} size="lg" alignSelf="start">
      {label}
    </Button>
  )
  if (!url) return button

  return (
    <Button asChild colorPalette="brand" variant={variant} rounded={rounded} size="lg">
      <a
        href={url}
        onClick={mode === 'preview' ? (event) => event.preventDefault() : undefined}
        {...(link.kind === 'url' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {label}
      </a>
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
  switch (settings.cardStyle) {
    case 'shadow':
      return { frame: { borderWidth: '0', shadow: 'md' }, flat: false }
    case 'flat':
      return { frame: { borderWidth: '0', shadow: 'none', bg: 'transparent' }, flat: true }
    case 'border':
      return { frame: { borderWidth: '1px', borderColor: 'border.subtle' }, flat: false }
  }
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
