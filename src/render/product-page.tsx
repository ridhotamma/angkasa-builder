/**
 * The product page's sections.
 *
 * The page is a template like the home page, so a seller can put a video, a
 * size table or a testimonial strip under the product. Its one required
 * section, `product-info`, draws the photos and whichever blocks the seller
 * arranged beside them. The two parts that need the storefront's own state —
 * the variant picker with the buy buttons (the cart) and the reviews (the
 * shopper's session) — arrive as `env.slots`; the editor has neither, and
 * shows stand-ins of the same size.
 */

import {
  Accordion,
  AspectRatio,
  Badge,
  Box,
  Breadcrumb,
  Button,
  CloseButton,
  Drawer,
  Grid,
  Heading,
  HStack,
  Icon,
  Portal,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react'
import { useState } from 'react'
import { LuRuler, LuStar } from 'react-icons/lu'

import { ImageWithFallback } from '@repo/theme'

import {
  readBlocks,
  readBoolean,
  readList,
  readNumber,
  readRichText,
  readText,
  type BlockValue,
} from '../model/fields'
import {
  previewProductDetail,
  useRenderEnvironment,
  type StorefrontProductDetail,
} from './context'
import { useRenderText } from './copy'
import { DataTable } from './content-sections'
import { featureIcon } from './icons'
import { EmptyNotice, Paragraphs, ProductGrid, SectionHeading, SmartLink } from './primitives'
import { RichTextView } from './rich-text'
import type { SectionProps } from './sections'

function useProduct(): StorefrontProductDetail | null {
  const { data, mode } = useRenderEnvironment()
  if (data.product) return data.product
  return mode === 'preview' ? previewProductDetail(data) : null
}

/* -------------------------------------------------------------------------- */
/* Gallery                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A photo that magnifies under the pointer on a desktop: the image scales up
 * with its origin following the cursor, so the part being pointed at is the
 * part that grows. Touch screens pinch instead, and keep the plain photo.
 */
function ZoomImage({ src, alt, zoom }: { src: string | null; alt: string; zoom: boolean }) {
  const [origin, setOrigin] = useState<string | null>(null)
  return (
    <AspectRatio
      ratio={1}
      rounded="l3"
      overflow="hidden"
      bg="bg.subtle"
      cursor={zoom ? 'zoom-in' : undefined}
      onPointerMove={(event) => {
        if (!zoom || event.pointerType !== 'mouse') return
        const rect = event.currentTarget.getBoundingClientRect()
        const x = ((event.clientX - rect.left) / rect.width) * 100
        const y = ((event.clientY - rect.top) / rect.height) * 100
        setOrigin(`${x}% ${y}%`)
      }}
      onPointerLeave={() => setOrigin(null)}
    >
      <ImageWithFallback
        src={src ?? undefined}
        alt={alt}
        objectFit="cover"
        fallbackIconSize="12"
        transition="transform 250ms ease"
        style={origin ? { transform: 'scale(1.8)', transformOrigin: origin } : undefined}
      />
    </AspectRatio>
  )
}

function Gallery({
  product,
  layout,
  zoom,
}: {
  product: StorefrontProductDetail
  layout: string
  zoom: boolean
}) {
  const [active, setActive] = useState(0)
  const images = product.images.length > 0 ? product.images : [{ url: null, thumbUrl: null }]

  if (layout === 'grid' || layout === 'stacked') {
    return (
      <SimpleGrid columns={layout === 'grid' ? { base: 1, sm: 2 } : 1} gap="3">
        {images.map((image, index) => (
          <Box key={`${image.url}-${index}`} gridColumn={layout === 'grid' && index === 0 ? { sm: 'span 2' } : undefined}>
            <ZoomImage src={image.url} alt={index === 0 ? product.name : ''} zoom={zoom} />
          </Box>
        ))}
      </SimpleGrid>
    )
  }

  const cover = images[Math.min(active, images.length - 1)]!
  return (
    <Stack gap="3">
      <ZoomImage src={cover.url} alt={product.name} zoom={zoom} />
      {images.length > 1 && (
        <SimpleGrid columns={{ base: 5, md: 6 }} gap="2">
          {images.map((image, index) => (
            <AspectRatio
              key={`${image.thumbUrl}-${index}`}
              ratio={1}
              rounded="l2"
              overflow="hidden"
              borderWidth="2px"
              borderColor={index === active ? 'brand.solid' : 'transparent'}
              cursor="pointer"
              onClick={() => setActive(index)}
            >
              <ImageWithFallback src={image.thumbUrl ?? undefined} alt="" objectFit="cover" loading="lazy" fallbackIconSize="5" />
            </AspectRatio>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  )
}

/* -------------------------------------------------------------------------- */
/* Blocks                                                                     */
/* -------------------------------------------------------------------------- */

function Stars({ rating }: { rating: number }) {
  return (
    <HStack gap="0.5" color="orange.400" aria-hidden>
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon
          key={n}
          as={LuStar}
          boxSize="4"
          fill={rating >= n - 0.25 ? 'currentColor' : 'none'}
          opacity={rating >= n - 0.75 ? 1 : 0.35}
        />
      ))}
    </HStack>
  )
}

function SizeGuideDrawer({ product, label }: { product: StorefrontProductDetail; label: string }) {
  const text = useRenderText()
  const guide = product.sizeGuide
  const { mode } = useRenderEnvironment()
  if (!guide) return mode === 'preview' ? <EmptyNotice>{text('sizeGuideMissing')}</EmptyNotice> : null

  return (
    <Drawer.Root size={{ base: 'full', sm: 'md' }} placement="end">
      <Drawer.Trigger asChild>
        <Button variant="plain" size="sm" px="0" alignSelf="start" color="fg" textDecoration="underline" textUnderlineOffset="3px">
          <LuRuler />
          {label || guide.name}
        </Button>
      </Drawer.Trigger>
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content>
            <Drawer.Header>
              <Drawer.Title>{guide.name}</Drawer.Title>
            </Drawer.Header>
            <Drawer.Body>
              <Stack gap="4">
                <DataTable table={guide.table} />
                {guide.note && <Paragraphs text={guide.note} />}
              </Stack>
            </Drawer.Body>
            <Drawer.CloseTrigger asChild>
              <CloseButton size="sm" aria-label={text('close')} />
            </Drawer.CloseTrigger>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  )
}

/** What the editor shows where the storefront's variant picker and buy buttons go. */
function PurchaseStandIn() {
  const text = useRenderText()
  return (
    <Stack gap="4" pt="4" borderTopWidth="1px" borderColor="border">
      <HStack gap="2" wrap="wrap">
        {['S', 'M', 'L', 'XL'].map((size, index) => (
          <Box
            key={size}
            px="4"
            py="2"
            rounded="l2"
            borderWidth="1px"
            borderColor={index === 1 ? 'brand.solid' : 'border'}
            fontSize="sm"
            fontWeight="medium"
          >
            {size}
          </Box>
        ))}
      </HStack>
      <Stack direction={{ base: 'column', sm: 'row' }} gap="3">
        <Button flex="1" size="lg" variant="outline" colorPalette="brand">
          {text('addToCart')}
        </Button>
        <Button flex="1" size="lg" colorPalette="brand">
          {text('buyNow')}
        </Button>
      </Stack>
      <Text fontSize="xs" color="fg.muted">
        {text('purchasePreview')}
      </Text>
    </Stack>
  )
}

function Block({ block, product }: { block: BlockValue; product: StorefrontProductDetail }) {
  const { data, formatPrice, slots } = useRenderEnvironment()
  const text = useRenderText()
  const settings = block.settings

  switch (block.type) {
    case 'title':
      return (
        <Heading
          as="h1"
          size={readText(settings, 'size') === 'lg' ? { base: '2xl', md: '4xl' } : { base: 'xl', md: '2xl' }}
          letterSpacing="-0.02em"
        >
          {product.name}
        </Heading>
      )
    case 'rating':
      if (!product.rating || product.ratingCount === 0) return null
      return (
        <HStack gap="2" fontSize="sm">
          <Stars rating={product.rating} />
          <Text fontWeight="medium">{product.rating.toFixed(1)}</Text>
          <Text color="fg.muted">({text('reviews', { n: product.ratingCount })})</Text>
        </HStack>
      )
    case 'price': {
      const saving =
        product.compareAtPrice && product.compareAtPrice > product.price
          ? Math.round((1 - product.price / product.compareAtPrice) * 100)
          : 0
      return (
        <HStack gap="3" align="baseline" wrap="wrap">
          <Text fontSize={{ base: 'xl', md: '2xl' }} fontWeight="bold" fontVariantNumeric="tabular-nums">
            {formatPrice(product.price, data.shop.currency)}
          </Text>
          {saving > 0 && (
            <>
              <Text color="fg.subtle" textDecoration="line-through">
                {formatPrice(product.compareAtPrice!, data.shop.currency)}
              </Text>
              {readBoolean(settings, 'showSaving') && (
                <Badge colorPalette="red" variant="solid">
                  {text('save', { n: saving })}
                </Badge>
              )}
            </>
          )}
        </HStack>
      )
    }
    case 'purchase':
      return <>{slots?.productPurchase ?? <PurchaseStandIn />}</>
    case 'stock': {
      const threshold = readNumber(settings, 'threshold', 5)
      if (product.available === null || product.available <= 0 || product.available > threshold) {
        return null
      }
      return (
        <HStack gap="2" color="orange.fg" fontSize="sm" fontWeight="medium">
          <Box
            boxSize="2"
            rounded="full"
            bg="orange.solid"
            css={{
              animation: 'pb-blink 1.6s ease-in-out infinite',
              '@keyframes pb-blink': { '50%': { opacity: 0.3 } },
              '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
            }}
          />
          {text('lowStock', { n: product.available })}
        </HStack>
      )
    }
    case 'description':
      // A folded description is drawn with the tabs around it; see `BlockList`.
      return product.description ? <Paragraphs text={product.description} /> : null
    case 'size-guide':
      return <SizeGuideDrawer product={product} label={readText(settings, 'label')} />
    case 'badges': {
      const items = readList(settings, 'items').filter((item) => readText(item, 'text'))
      if (items.length === 0) return null
      return (
        <SimpleGrid columns={2} gap="2">
          {items.map((item) => (
            <HStack key={item.id} gap="2.5" p="2.5" rounded="l2" bg="bg.subtle" fontSize="sm">
              <Icon as={featureIcon(readText(item, 'icon'))} boxSize="4.5" color="brand.fg" flexShrink="0" />
              <Text lineClamp={2}>{readText(item, 'text')}</Text>
            </HStack>
          ))}
        </SimpleGrid>
      )
    }
    case 'text':
      return <RichTextView doc={readRichText(settings, 'body')} />
    default:
      return null
  }
}

/** Whether a block is one of the folded tabs, drawn together as one accordion. */
function isTab(block: BlockValue): boolean {
  return block.type === 'collapsible' || (block.type === 'description' && readBoolean(block.settings, 'collapsible'))
}

/**
 * The blocks in order, with every run of neighbouring tabs drawn as one
 * accordion — separate accordions would stack two borders between each tab.
 */
function BlockList({ blocks, product }: { blocks: BlockValue[]; product: StorefrontProductDetail }) {
  const text = useRenderText()
  const groups: Array<{ tabs: BlockValue[] } | { block: BlockValue }> = []
  for (const block of blocks) {
    const last = groups[groups.length - 1]
    if (isTab(block)) {
      if (last && 'tabs' in last) last.tabs.push(block)
      else groups.push({ tabs: [block] })
    } else groups.push({ block })
  }

  return (
    <Stack gap="5">
      {groups.map((group, index) => {
        if ('block' in group) return <Block key={group.block.id} block={group.block} product={product} />
        // A folded description of a product with none would be an empty tab.
        const tabs = group.tabs.filter((tab) => tab.type !== 'description' || product.description)
        if (tabs.length === 0) return null
        const open = tabs.filter((tab) => readBoolean(tab.settings, 'open')).map((tab) => tab.id)
        return (
          <Accordion.Root
            key={`tabs-${index}`}
            multiple
            defaultValue={open}
            variant="plain"
            borderTopWidth="1px"
            borderColor="border"
          >
            {tabs.map((tab) => (
              <Accordion.Item key={tab.id} value={tab.id} borderBottomWidth="1px" borderColor="border">
                <Accordion.ItemTrigger fontWeight="medium" py="4">
                  <Box flex="1">
                    {tab.type === 'description' ? text('description') : readText(tab.settings, 'heading')}
                  </Box>
                  <Accordion.ItemIndicator />
                </Accordion.ItemTrigger>
                <Accordion.ItemContent>
                  <Accordion.ItemBody pt="0">
                    {tab.type === 'description' ? (
                      <Paragraphs text={product.description} />
                    ) : (
                      <RichTextView doc={readRichText(tab.settings, 'body')} />
                    )}
                  </Accordion.ItemBody>
                </Accordion.ItemContent>
              </Accordion.Item>
            ))}
          </Accordion.Root>
        )
      })}
    </Stack>
  )
}

/* -------------------------------------------------------------------------- */
/* Sections                                                                   */
/* -------------------------------------------------------------------------- */

export function ProductInfo({ settings }: SectionProps) {
  const product = useProduct()
  const text = useRenderText()
  if (!product) return null

  const sticky = readBoolean(settings, 'stickyInfo')

  return (
    <Stack as="section" gap="6">
      {readBoolean(settings, 'breadcrumbs') && (
        <Breadcrumb.Root size="sm">
          <Breadcrumb.List color="fg.muted" flexWrap="wrap">
            <Breadcrumb.Item>
              <Breadcrumb.Link asChild>
                <SmartLink link={{ kind: 'home' }}>{text('home')}</SmartLink>
              </Breadcrumb.Link>
            </Breadcrumb.Item>
            {product.category && (
              <>
                <Breadcrumb.Separator />
                <Breadcrumb.Item>
                  <Breadcrumb.Link asChild>
                    <SmartLink link={{ kind: 'category', slug: product.category.slug }}>
                      {product.category.name}
                    </SmartLink>
                  </Breadcrumb.Link>
                </Breadcrumb.Item>
              </>
            )}
            <Breadcrumb.Separator />
            <Breadcrumb.Item>
              <Breadcrumb.CurrentLink color="fg">{product.name}</Breadcrumb.CurrentLink>
            </Breadcrumb.Item>
          </Breadcrumb.List>
        </Breadcrumb.Root>
      )}
      <Grid templateColumns={{ base: '1fr', lg: '1.1fr 1fr' }} gap={{ base: '8', lg: '12' }} alignItems="start">
        <Gallery product={product} layout={readText(settings, 'gallery')} zoom={readBoolean(settings, 'zoom')} />
        <Box position={{ lg: sticky ? 'sticky' : 'static' }} top={{ lg: '24' }}>
          <BlockList blocks={readBlocks(settings, 'blocks')} product={product} />
        </Box>
      </Grid>
    </Stack>
  )
}

export function ProductReviews() {
  const { slots, mode } = useRenderEnvironment()
  const text = useRenderText()
  if (slots?.productReviews) return <>{slots.productReviews}</>
  return mode === 'preview' ? <EmptyNotice>{text('reviewsPreview')}</EmptyNotice> : null
}

export function RelatedProducts({ settings }: SectionProps) {
  const product = useProduct()
  const text = useRenderText()
  const related = product?.related.slice(0, readNumber(settings, 'limit', 4)) ?? []

  if (related.length === 0) return <EmptyNotice>{text('noRelated')}</EmptyNotice>

  return (
    <Stack as="section" gap="4">
      <SectionHeading field="heading">{readText(settings, 'heading')}</SectionHeading>
      <ProductGrid products={related} columns={readText(settings, 'columns')} />
    </Stack>
  )
}
