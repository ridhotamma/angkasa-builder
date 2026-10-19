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
  Dialog,
  Drawer,
  Grid,
  Heading,
  HStack,
  Icon,
  IconButton,
  Portal,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react'
import { useState } from 'react'
// The brand marks come from the same set the footer's social links use, and
// the generic ones from Lucide — the same match the rest of the page makes.
import { FaFacebookF, FaWhatsapp, FaXTwitter } from 'react-icons/fa6'
import { LuCheck, LuForward, LuLink, LuMail, LuRuler, LuStar } from 'react-icons/lu'

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
import { STICKY_BELOW_HEADER } from './chrome'
import { previewProductDetail, useRenderEnvironment, type StorefrontProductDetail } from './context'
import { useRenderText } from './copy'
import { Slider } from './slider'
import { DataTable } from './content-sections'
import { FeatureIcon } from './icons'
import {
  EmptyNotice,
  Paragraphs,
  ProductList,
  SectionHeading,
  SmartLink,
  useOverlayProps,
  WishlistButton,
} from './primitives'
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
 *
 * The scale eases in and out, but the origin never does. It stays where the
 * pointer last was after the pointer leaves, so the photo shrinks back toward
 * the spot that was magnified. When the origin fell back to the centre on
 * exit, the photo lurched sideways mid-shrink. The origin is not eased either,
 * so while zoomed the photo pans with the pointer instead of trailing it.
 */
function ZoomImage({ src, alt, zoom }: { src: string | null; alt: string; zoom: boolean }) {
  const [origin, setOrigin] = useState('50% 50%')
  const [zoomed, setZoomed] = useState(false)
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
        setZoomed(true)
      }}
      onPointerLeave={() => setZoomed(false)}
    >
      <ImageWithFallback
        src={src ?? undefined}
        alt={alt}
        objectFit="cover"
        fallbackIconSize="12"
        transition="transform 0.12s ease-out"
        // Snaps instead for anyone who has asked their system for less motion.
        _motionReduce={{ transition: 'none' }}
        style={
          zoom
            ? { transform: zoomed ? 'scale(1.8)' : 'scale(1)', transformOrigin: origin }
            : undefined
        }
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
      <Box position="relative">
        <SimpleGrid columns={layout === 'grid' ? { base: 1, sm: 2 } : 1} gap="3">
          {images.map((image, index) => (
            <Box
              key={`${image.url}-${index}`}
              gridColumn={layout === 'grid' && index === 0 ? { sm: 'span 2' } : undefined}
            >
              <ZoomImage src={image.url} alt={index === 0 ? product.name : ''} zoom={zoom} />
            </Box>
          ))}
        </SimpleGrid>
        <GalleryActions product={product} />
      </Box>
    )
  }

  if (layout === 'mosaic') return <MosaicGallery product={product} images={images} zoom={zoom} />

  const cover = images[Math.min(active, images.length - 1)]!
  return (
    <Stack gap="3">
      <Box position="relative">
        <ZoomImage src={cover.url} alt={product.name} zoom={zoom} />
        <GalleryActions product={product} />
      </Box>
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
              <ImageWithFallback
                src={image.thumbUrl ?? undefined}
                alt=""
                objectFit="cover"
                loading="lazy"
                fallbackIconSize="5"
              />
            </AspectRatio>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  )
}

type GalleryImage = StorefrontProductDetail['images'][number]

/** White circles over a photo, so the two actions read on any picture. */
const PHOTO_ACTION = {
  rounded: 'full',
  size: 'md',
  variant: 'surface',
  bg: 'bg/85',
  shadow: 'md',
  _hover: { bg: 'bg' },
} as const

/**
 * Share and save, floating over the gallery's bottom corner — the pair a
 * marketplace listing puts on its photos. Share opens the same short list
 * wherever the gallery is: Facebook, Twitter, WhatsApp, email, or the link
 * copied. The heart is the shop's own wishlist, so it shows only where the
 * host has one (and the editor's preview set makes it visible on the canvas).
 *
 * Nothing here navigates in the editor's preview: `mode` gates every window
 * and the clipboard, so a click on the canvas can never take the seller away.
 */
function GalleryActions({ product }: { product: StorefrontProductDetail }) {
  const text = useRenderText()
  const { href, mode, wishlist } = useRenderEnvironment()
  const overlay = useOverlayProps()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  /** The listing's address as the shopper's browser knows it — the page may
   * be on a custom domain — with the product's own title alongside it. */
  const address = (element: HTMLElement) => {
    const path = href({ kind: 'product', slug: product.slug })
    if (!path) return null
    const base = element.ownerDocument.defaultView?.location.href
    return new URL(path, base).toString()
  }

  const open_ = (element: HTMLElement, url: string) => {
    if (mode === 'preview') return
    element.ownerDocument.defaultView?.open(url, '_blank', 'noopener,noreferrer')
  }

  const targets = [
    {
      icon: FaFacebookF,
      label: text('shareFacebook'),
      url: (url: string) =>
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    },
    {
      icon: FaXTwitter,
      label: text('shareTwitter'),
      url: (url: string) =>
        `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(product.name)}`,
    },
    {
      icon: FaWhatsapp,
      label: text('shareWhatsapp'),
      url: (url: string) => `https://wa.me/?text=${encodeURIComponent(`${product.name} ${url}`)}`,
    },
    {
      icon: LuMail,
      label: text('shareEmail'),
      url: (url: string) =>
        `mailto:?subject=${encodeURIComponent(product.name)}&body=${encodeURIComponent(url)}`,
    },
  ]

  return (
    <Stack position="absolute" bottom="3" right="3" gap="2" zIndex="2">
      <Dialog.Root
        {...overlay}
        open={open}
        onOpenChange={({ open }) => setOpen(open)}
        lazyMount
        unmountOnExit
        size="xs"
        placement={{ base: 'bottom', md: 'center' }}
      >
        <Dialog.Trigger asChild>
          <IconButton {...PHOTO_ACTION} aria-label={text('share')}>
            <LuForward />
          </IconButton>
        </Dialog.Trigger>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content p="0" overflow="hidden" rounded={{ base: 't-xl', md: 'l3' }}>
              <Dialog.Body p="0">
                <Stack gap="0">
                  {targets.map((target, index) => (
                    <Button
                      key={target.label}
                      variant="ghost"
                      justifyContent="start"
                      gap="3"
                      rounded="0"
                      py="5"
                      px="4"
                      fontWeight="medium"
                      {...(index < targets.length - 1 && {
                        borderBottomWidth: '1px',
                        borderColor: 'border.subtle',
                      })}
                      onClick={(event) => {
                        const url = address(event.currentTarget)
                        if (url) open_(event.currentTarget, target.url(url))
                      }}
                    >
                      <target.icon />
                      {target.label}
                    </Button>
                  ))}
                  <Button
                    variant="ghost"
                    justifyContent="start"
                    gap="3"
                    rounded="0"
                    py="5"
                    px="4"
                    fontWeight="medium"
                    onClick={async (event) => {
                      if (mode === 'preview') return
                      const url = address(event.currentTarget)
                      if (!url) return
                      try {
                        await event.currentTarget.ownerDocument.defaultView?.navigator.clipboard.writeText(
                          url,
                        )
                        setCopied(true)
                        setTimeout(() => setCopied(false), 2000)
                      } catch {
                        // Clipboard refused (an old browser, an insecure
                        // page): the address bar still has the link.
                      }
                    }}
                  >
                    {copied ? <LuCheck /> : <LuLink />}
                    {copied ? text('linkCopied') : text('copyLink')}
                  </Button>
                </Stack>
                <Button
                  variant="ghost"
                  w="full"
                  rounded="0"
                  py="5"
                  borderTopWidth="1px"
                  borderColor="border"
                  fontWeight="medium"
                  onClick={() => setOpen(false)}
                >
                  {text('cancel')}
                </Button>
              </Dialog.Body>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
      {wishlist && (
        <WishlistButton
          {...PHOTO_ACTION}
          product={{
            id: product.id,
            name: product.name,
            slug: product.slug,
            price: product.price,
            compareAtPrice: product.compareAtPrice,
            imageUrl: product.images[0]?.url ?? null,
          }}
        />
      )}
    </Stack>
  )
}

/** How many photos the mosaic shows before its last tile turns into "+N". */
const MOSAIC_TILES = 5

/**
 * Where each photo after the cover sits in the mosaic's grid (three columns,
 * `2fr 1fr 1fr`, by two rows), keyed by how many photos show. The cover always
 * fills the wide left column; the rest share the right half, so three photos
 * stack two wide tiles and four put one wide tile over two small ones.
 */
const MOSAIC_PLACEMENT: Record<number, Array<{ gridColumn: string; gridRow: string }>> = {
  2: [{ gridColumn: '2 / 4', gridRow: '1 / 3' }],
  3: [
    { gridColumn: '2 / 4', gridRow: '1' },
    { gridColumn: '2 / 4', gridRow: '2' },
  ],
  4: [
    { gridColumn: '2 / 4', gridRow: '1' },
    { gridColumn: '2', gridRow: '2' },
    { gridColumn: '3', gridRow: '2' },
  ],
  5: [
    { gridColumn: '2', gridRow: '1' },
    { gridColumn: '3', gridRow: '1' },
    { gridColumn: '2', gridRow: '2' },
    { gridColumn: '3', gridRow: '2' },
  ],
}

/**
 * A large cover beside a block of smaller photos, like a marketplace listing:
 * several photos in view at once, and a "+N" on the last tile when there are
 * more than fit. Any tile opens the whole set in a viewer at that photo, where
 * hover zoom applies. A phone is too narrow for the tiles to show anything, so
 * there it swipes one photo at a time. Both are in the markup and CSS picks
 * one, so the server render already matches the screen.
 */
function MosaicGallery({
  product,
  images,
  zoom,
}: {
  product: StorefrontProductDetail
  images: GalleryImage[]
  zoom: boolean
}) {
  const text = useRenderText()
  const overlay = useOverlayProps()
  // Open and start photo are separate so closing only flips `open`: the photo
  // stays on screen through the exit animation instead of vanishing first.
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewing, setViewingIndex] = useState(0)
  const setViewing = (index: number) => {
    setViewingIndex(index)
    setViewerOpen(true)
  }
  const shown = images.slice(0, MOSAIC_TILES)
  const hidden = images.length - shown.length
  const placement = MOSAIC_PLACEMENT[shown.length] ?? []

  const tile = (image: GalleryImage, index: number, overflow: number) => (
    <Box
      as="button"
      position="relative"
      overflow="hidden"
      bg="bg.subtle"
      cursor="zoom-in"
      aria-label={overflow > 0 ? text('viewAllPhotos') : undefined}
      onClick={() => setViewing(index)}
      css={{ '& img': { transition: 'opacity 0.15s' }, '&:hover img': { opacity: 0.9 } }}
    >
      <ImageWithFallback
        src={image.url ?? undefined}
        alt={index === 0 ? product.name : ''}
        objectFit="cover"
        w="full"
        h="full"
        loading={index === 0 ? undefined : 'lazy'}
        fallbackIconSize={index === 0 ? '12' : '6'}
      />
      {overflow > 0 && (
        <Box
          position="absolute"
          inset="0"
          display="flex"
          alignItems="center"
          justifyContent="center"
          bg="blackAlpha.500"
          color="white"
          fontSize="2xl"
          fontWeight="semibold"
          fontVariantNumeric="tabular-nums"
        >
          +{overflow}
        </Box>
      )}
    </Box>
  )

  return (
    <Box position="relative">
      <Grid
        hideBelow="md"
        aspectRatio="3 / 2"
        templateColumns={shown.length === 1 ? '1fr' : '2fr 1fr 1fr'}
        templateRows="repeat(2, minmax(0, 1fr))"
        gap="1"
        rounded="l3"
        overflow="hidden"
      >
        {/* A CSS aspect ratio, not `AspectRatio`: that one makes its child a
            flex box, which would undo the grid. */}
        <Box gridColumn="1" gridRow="1 / 3" display="grid" minW="0" minH="0">
          {tile(shown[0]!, 0, 0)}
        </Box>
        {shown.slice(1).map((image, offset) => (
          <Box
            key={`${image.url}-${offset}`}
            {...placement[offset]}
            display="grid"
            minW="0"
            minH="0"
          >
            {tile(image, offset + 1, offset === shown.length - 2 ? hidden : 0)}
          </Box>
        ))}
      </Grid>

      <Box hideFrom="md">
        <PhotoCarousel images={images} name={product.name} onOpen={setViewing} />
      </Box>

      <GalleryActions product={product} />

      <Dialog.Root
        {...overlay}
        open={viewerOpen}
        onOpenChange={({ open }) => setViewerOpen(open)}
        // Mounted on open and removed once the exit animation has finished,
        // so each opening starts the carousel on the photo that was tapped.
        lazyMount
        unmountOnExit
        size="lg"
        placement="center"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content p={{ base: '3', md: '4' }} pt="12">
              <PhotoCarousel
                images={images}
                name={product.name}
                start={viewing}
                zoom={zoom}
                arrows
              />
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" top="2" right="2" aria-label={text('close')} />
              </Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Box>
  )
}

/**
 * Every photo, one per page, on the shared slider — arrows on a desktop,
 * finger swipes and the pill dots over the photo's own bottom edge
 * everywhere. `onOpen` makes a tap on a photo open the viewer.
 */
function PhotoCarousel({
  images,
  name,
  start = 0,
  zoom = false,
  arrows = false,
  onOpen,
}: {
  images: GalleryImage[]
  name: string
  start?: number
  zoom?: boolean
  arrows?: boolean
  onOpen?: (index: number) => void
}) {
  return (
    <Slider
      count={images.length}
      perPage={1}
      start={start}
      arrows={arrows}
      dots="inside"
      slideProps={{ display: 'flex', justifyContent: 'center' }}
    >
      {images.map((image, index) => (
        <Box
          key={`${image.url}-${index}`}
          w="full"
          onClick={onOpen ? () => onOpen(index) : undefined}
        >
          <ZoomImage src={image.url} alt={index === 0 ? name : ''} zoom={zoom} />
        </Box>
      ))}
    </Slider>
  )
}

/* -------------------------------------------------------------------------- */
/* Blocks                                                                     */
/* -------------------------------------------------------------------------- */

function Stars({ rating }: { rating: number }) {
  // Yellow like every other rating on the storefront (product cards,
  // `RatingStars`), so one product never shows two star colours at once.
  return (
    <HStack gap="0.5" color="yellow.solid" aria-hidden>
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
  const overlay = useOverlayProps()
  if (!guide)
    return mode === 'preview' ? <EmptyNotice>{text('sizeGuideMissing')}</EmptyNotice> : null

  return (
    <Drawer.Root {...overlay} size={{ base: 'full', sm: 'md' }} placement="end">
      <Drawer.Trigger asChild>
        <Button
          variant="plain"
          size="sm"
          px="0"
          alignSelf="start"
          color="fg"
          textDecoration="underline"
          textUnderlineOffset="3px"
        >
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
      {/* One action per line, the primary on top — the same arrangement the
          storefront's own buy buttons use. */}
      <Stack gap="3">
        <Button size="lg" colorPalette="brand" w="full">
          {text('buyNow')}
        </Button>
        <Button size="lg" variant="outline" colorPalette="brand" w="full">
          {text('addToCart')}
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
          size={
            readText(settings, 'size') === 'lg'
              ? { base: '2xl', md: '4xl' }
              : { base: 'xl', md: '2xl' }
          }
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
          <Text
            fontSize={{ base: 'xl', md: '2xl' }}
            fontWeight="bold"
            fontVariantNumeric="tabular-nums"
          >
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
              <FeatureIcon
                name={readText(item, 'icon')}
                boxSize="4.5"
                color="brand.fg"
                flexShrink="0"
              />
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
  return (
    block.type === 'collapsible' ||
    (block.type === 'description' && readBoolean(block.settings, 'collapsible'))
  )
}

/**
 * The blocks in order, with every run of neighbouring tabs drawn as one
 * accordion — separate accordions would stack two borders between each tab.
 */
function BlockList({
  blocks,
  product,
}: {
  blocks: BlockValue[]
  product: StorefrontProductDetail
}) {
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
        if ('block' in group)
          return <Block key={group.block.id} block={group.block} product={product} />
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
              <Accordion.Item
                key={tab.id}
                value={tab.id}
                borderBottomWidth="1px"
                borderColor="border"
              >
                <Accordion.ItemTrigger fontWeight="medium" py="4">
                  <Box flex="1">
                    {tab.type === 'description'
                      ? text('description')
                      : readText(tab.settings, 'heading')}
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
  const gallery = readText(settings, 'gallery')

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
      <Grid
        // The mosaic packs up to five photos into its column, so it takes two
        // thirds of the row — the width a photo-led product page wants. The
        // actions under the details stack full width, so the narrower details
        // column costs nothing there.
        templateColumns={{
          base: '1fr',
          lg: gallery === 'mosaic' ? 'minmax(0, 2fr) minmax(0, 1fr)' : '1.1fr 1fr',
        }}
        gap={{ base: '8', lg: '12' }}
        alignItems="start"
      >
        <Gallery product={product} layout={gallery} zoom={readBoolean(settings, 'zoom')} />
        <Box position={{ lg: sticky ? 'sticky' : 'static' }} top={{ lg: STICKY_BELOW_HEADER }}>
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
      <ProductList
        products={related}
        layout={readText(settings, 'layout')}
        textReveal={readText(settings, 'bentoText') === 'hover'}
        columns={readText(settings, 'columns')}
        mobileColumns={readText(settings, 'mobileColumns')}
      />
    </Stack>
  )
}
