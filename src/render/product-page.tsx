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
  Flex,
  Grid,
  Heading,
  HStack,
  Icon,
  IconButton,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react'
import { useState } from 'react'
// The brand marks come from the same set the footer's social links use, and
// the generic ones from Lucide — the same match the rest of the page makes.
import { FaFacebookF, FaWhatsapp, FaXTwitter } from 'react-icons/fa6'
import {
  LuCheck,
  LuForward,
  LuLink,
  LuMail,
  LuMinus,
  LuPlus,
  LuRuler,
  LuShoppingBag,
  LuStar,
  LuX,
} from 'react-icons/lu'

import { ImageWithFallback } from '../ui'

import {
  readBlocks,
  readBoolean,
  readList,
  readNumber,
  readRichText,
  readText,
  type BlockValue,
} from '../model/fields'
import { RenderPortal, useMountProps } from './target'
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
 * A photo in the gallery: a square frame, cropped to fill it — and, where the
 * seller asked for it, one that magnifies under the pointer on a desktop. The
 * image scales up with its origin following the cursor, so the part being
 * pointed at is the part that grows. Touch screens pinch instead, and keep the
 * plain photo.
 *
 * The scale eases in and out, but the origin never does. It stays where the
 * pointer last was after the pointer leaves, so the photo shrinks back toward
 * the spot that was magnified. When the origin fell back to the centre on
 * exit, the photo lurched sideways mid-shrink. The origin is not eased either,
 * so while zoomed the photo pans with the pointer instead of trailing it.
 */
function GalleryPhoto({ src, alt, zoom }: { src: string | null; alt: string; zoom: boolean }) {
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

/**
 * The photos as the seller arranged them: `thumbnails` is a cover with a strip
 * under it, `mosaic` a marketplace's block of tiles, and `grid` and `stacked`
 * the two plain ways to list them. Where a shape does not fit a phone — the
 * mosaic's tiles cannot show at all there, and a grid or a stack is a long
 * scroll — the phone gets one photo per page, swiped, instead. Both are in the
 * markup and CSS picks one, so the server render already matches the screen.
 */
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
  // The viewer belongs to the layouts whose phone view is a slider; the
  // cover-and-thumbnails layout below never opens one.
  const viewer = usePhotoViewer(images, product.name)

  if (layout === 'grid' || layout === 'stacked') {
    return (
      <Box position="relative">
        <Box hideBelow="md">
          <SimpleGrid columns={layout === 'grid' ? 2 : 1} gap="3">
            {images.map((image, index) => (
              <Box
                key={`${image.url}-${index}`}
                gridColumn={layout === 'grid' && index === 0 ? 'span 2' : undefined}
              >
                <GalleryPhoto src={image.url} alt={index === 0 ? product.name : ''} zoom={zoom} />
              </Box>
            ))}
          </SimpleGrid>
        </Box>
        <Box hideFrom="md">
          <PhotoCarousel images={images} name={product.name} onOpen={viewer.view} />
        </Box>
        <GalleryActions product={product} />
        {viewer.dialog}
      </Box>
    )
  }

  if (layout === 'mosaic') return <MosaicGallery product={product} images={images} />

  const cover = images[Math.min(active, images.length - 1)]!
  return (
    <Stack gap="3">
      <Box position="relative">
        <GalleryPhoto src={cover.url} alt={product.name} zoom={zoom} />
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
 * The viewer's own buttons: the shop's ink at a glass' transparency over the
 * photo, with the shop's canvas for the glyph — so the close and the arrows
 * read on any picture without a colour of their own. The pair stays on a
 * phone, unlike the overlay pair over a band: a fullscreen photo shows no
 * edge of the next one, so the buttons are the only sign the set continues.
 */
const VIEWER_ACTION = {
  variant: 'plain',
  bg: 'ink/60',
  color: 'canvas',
  _hover: { bg: 'ink/75' },
  hideBelow: undefined,
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
  const mount = useMountProps({ lazyMount: true, unmountOnExit: true })
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
        {...mount}
        size="xs"
        placement={{ base: 'bottom', md: 'center' }}
      >
        <Dialog.Trigger asChild>
          <IconButton {...PHOTO_ACTION} aria-label={text('share')}>
            <LuForward />
          </IconButton>
        </Dialog.Trigger>
        <RenderPortal>
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
        </RenderPortal>
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
 * Opening one of the photos up: the state and the fullscreen dialog both
 * layouts that show a phone slider share — the mosaic always, and the grid and
 * stacked layouts on a phone. Opening and start are kept apart so closing only
 * flips `open`: the photo stays on screen through the exit animation instead
 * of vanishing first.
 */
function usePhotoViewer(images: GalleryImage[], name: string) {
  const text = useRenderText()
  const overlay = useOverlayProps()
  const [open, setOpen] = useState(false)
  const [start, setStart] = useState(0)

  const dialog = (
    <Dialog.Root
      {...overlay}
      open={open}
      onOpenChange={({ open: next }) => setOpen(next)}
      // Mounted on open and removed once the exit animation has finished,
      // so each opening starts the viewer on the photo that was tapped.
      lazyMount
      unmountOnExit
      size="full"
      placement="center"
    >
      <RenderPortal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          {/* Fullscreen: the photo is the screen, so the viewer is the
              whole viewport rather than a card inside it — and nothing
              pads it top or bottom. The shop's ink is the ground the
              blurred photo copy sits on. */}
          <Dialog.Content
            p="0"
            rounded="0"
            h="100dvh"
            maxH="100dvh"
            bg="ink"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <Dialog.Body p="0" h="full" w="full" display="flex">
              <PhotoViewer images={images} name={name} start={start} />
            </Dialog.Body>
            <Dialog.CloseTrigger asChild>
              <IconButton
                {...VIEWER_ACTION}
                position="absolute"
                top="3"
                right="3"
                zIndex="2"
                rounded="full"
                size="md"
                aria-label={text('close')}
              >
                <LuX />
              </IconButton>
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </RenderPortal>
    </Dialog.Root>
  )

  return {
    /** Open the set at one photo. */
    view: (index: number) => {
      setStart(index)
      setOpen(true)
    },
    dialog,
  }
}

/**
 * A large cover beside a block of smaller photos, like a marketplace listing:
 * several photos in view at once, and a "+N" on the last tile when there are
 * more than fit. Any tile opens the whole set in the viewer at that photo. A
 * phone is too narrow for the tiles to show anything, so there it swipes one
 * photo at a time.
 */
function MosaicGallery({
  product,
  images,
}: {
  product: StorefrontProductDetail
  images: GalleryImage[]
}) {
  const text = useRenderText()
  const viewer = usePhotoViewer(images, product.name)
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
      onClick={() => viewer.view(index)}
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
          bg="ink/60"
          color="canvas"
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
        <PhotoCarousel images={images} name={product.name} onOpen={viewer.view} />
      </Box>

      <GalleryActions product={product} />

      {viewer.dialog}
    </Box>
  )
}

/**
 * The whole set, one photo per screen, the way a marketplace viewer shows it:
 * the photo is contained rather than cropped and centred on the screen, over
 * a blurred, zoomed copy of itself so the frame never reads as empty. The
 * arrows pair up at the bottom centre — on phones too — and the close button
 * floats in the corner; both drawn in the shop's own ink and canvas.
 *
 * The pair never disables and never rewinds: the slider loops seamlessly, so
 * stepping past the last photo glides on into the first and stepping back
 * from the first lands on the last — the way a marketplace viewer cycles.
 */
function PhotoViewer({
  images,
  name,
  start,
}: {
  images: GalleryImage[]
  name: string
  start: number
}) {
  const [current, setCurrent] = useState(start)
  const resting = images[Math.min(current, Math.max(0, images.length - 1))]
  return (
    <Box position="relative" w="full" h="full">
      {resting?.url && (
        // The backdrop is the photo itself, blown up and blurred — the same
        // picture, so it always agrees with what is in front of it.
        <Box position="absolute" inset="0" overflow="hidden" aria-hidden="true">
          <ImageWithFallback
            src={resting.url}
            alt=""
            objectFit="cover"
            w="full"
            h="full"
            filter="blur(48px)"
            transform="scale(1.2)"
          />
        </Box>
      )}
      <Slider
        count={images.length}
        perPage={1}
        loop
        start={start}
        arrows
        arrowPlacement="bottom"
        dots="none"
        onIndexChange={setCurrent}
        rootProps={{ h: 'full' }}
        bandProps={{ flex: '1' }}
        arrowProps={VIEWER_ACTION}
      >
        {images.map((image, index) => (
          <Box
            key={`${image.url}-${index}`}
            display="flex"
            alignItems="center"
            justifyContent="center"
            h="full"
            w="full"
          >
            <ImageWithFallback
              src={image.url ?? undefined}
              alt={index === 0 ? name : ''}
              objectFit="contain"
              maxH="full"
              maxW="full"
              fallbackIconSize="12"
            />
          </Box>
        ))}
      </Slider>
    </Box>
  )
}

/**
 * The gallery as a phone sees it: one photo per page, swiped, with the pill
 * dots over the photo's own bottom edge. A tap opens the fullscreen viewer.
 */
function PhotoCarousel({
  images,
  name,
  onOpen,
}: {
  images: GalleryImage[]
  name: string
  onOpen: (index: number) => void
}) {
  return (
    <Slider count={images.length} perPage={1} dots="inside">
      {images.map((image, index) => (
        <Box key={`${image.url}-${index}`} w="full" onClick={() => onOpen(index)}>
          <GalleryPhoto src={image.url} alt={index === 0 ? name : ''} zoom={false} />
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
      <RenderPortal>
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
      </RenderPortal>
    </Drawer.Root>
  )
}

/**
 * What the editor shows where the storefront's variant picker and buy buttons
 * go: the same rows in the same order the storefront draws them — the stock
 * line, a sample size axis, the rule, the quantity row and the two actions —
 * so the seller lays the page out over the box shoppers will actually meet.
 * Only the note at the end is the editor's own.
 */
function PurchaseStandIn({
  product,
  narrowColumn,
}: {
  product: StorefrontProductDetail
  narrowColumn: boolean
}) {
  const text = useRenderText()
  // The same three sentences the storefront's own picker says, off the same
  // fact: a product the shop does not count (`available` is null) is simply
  // in stock.
  const stock =
    product.available === null
      ? text('inStockUnlimited')
      : product.available > 0
        ? text('inStock', { count: product.available })
        : text('soldOut')

  return (
    <Stack gap="4">
      <Stack gap="5">
        <Text fontSize="sm" color={product.available === 0 ? 'danger.fg' : 'fg.muted'}>
          {stock}
        </Text>
        <Stack gap="2">
          <Text fontSize="sm" fontWeight="medium">
            {text('size')}
            <Text as="span" color="fg.muted" fontWeight="normal">
              {' '}
              — M
            </Text>
          </Text>
          <HStack gap="2" wrap="wrap">
            {['S', 'M', 'L', 'XL'].map((size) => (
              <Button
                key={size}
                size="sm"
                rounded="pill"
                variant={size === 'M' ? 'solid' : 'outline'}
                colorPalette={size === 'M' ? 'brand' : undefined}
              >
                {size}
              </Button>
            ))}
          </HStack>
        </Stack>
      </Stack>

      {/* The quantity and the actions sit under the rule in the storefront's
          own box, and the pair shares one line wherever the details column has
          the room — the mosaic leaves it narrow, and there they stack, as on
          a phone. */}
      <Stack gap="4" pt="4" borderTopWidth="1px" borderColor="border">
        <HStack gap="3" justify="space-between">
          <Text fontSize="sm" fontWeight="medium" color="fg.muted">
            {text('quantity')}
          </Text>
          <HStack gap="1" borderWidth="1px" borderColor="border" rounded="md" p="1">
            <IconButton
              aria-label={text('decreaseQuantity')}
              size={{ base: 'sm', md: 'xs' }}
              variant="ghost"
              // One is the least a shopper may take, exactly as the
              // storefront's own stepper starts.
              disabled
            >
              <Icon as={LuMinus} boxSize={{ base: '4', md: '3' }} />
            </IconButton>
            <Text
              px={{ base: '4', md: '3' }}
              fontSize={{ base: 'md', md: 'sm' }}
              fontWeight="medium"
              fontVariantNumeric="tabular-nums"
            >
              1
            </Text>
            <IconButton
              aria-label={text('increaseQuantity')}
              size={{ base: 'sm', md: 'xs' }}
              variant="ghost"
            >
              <Icon as={LuPlus} boxSize={{ base: '4', md: '3' }} />
            </IconButton>
          </HStack>
        </HStack>

        <Flex direction={{ base: 'column', sm: narrowColumn ? 'column' : 'row' }} gap="3" w="full">
          <Button minH={{ base: '14', md: '12' }} fontWeight="bold" colorPalette="brand" flex="1">
            {text('buyNow')}
          </Button>
          <Button
            minH={{ base: '14', md: '12' }}
            fontWeight="bold"
            colorPalette="brand"
            variant="outline"
            flex="1"
          >
            <Icon as={LuShoppingBag} boxSize="5" />
            {text('addToCart')}
          </Button>
        </Flex>
      </Stack>

      <Text fontSize="xs" color="fg.muted">
        {text('purchasePreview')}
      </Text>
    </Stack>
  )
}

function Block({
  block,
  product,
  narrowColumn,
}: {
  block: BlockValue
  product: StorefrontProductDetail
  narrowColumn: boolean
}) {
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
      return (
        <>
          {slots?.productPurchase?.({ narrowColumn }) ?? (
            <PurchaseStandIn product={product} narrowColumn={narrowColumn} />
          )}
        </>
      )
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
  narrowColumn,
}: {
  blocks: BlockValue[]
  product: StorefrontProductDetail
  narrowColumn: boolean
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
          return (
            <Block
              key={group.block.id}
              block={group.block}
              product={product}
              narrowColumn={narrowColumn}
            />
          )
        // A folded description of a product with none would be an empty tab.
        const tabs = group.tabs.filter((tab) => tab.type !== 'description' || product.description)
        if (tabs.length === 0) return null
        const open = tabs.filter((tab) => readBoolean(tab.settings, 'open')).map((tab) => tab.id)
        return (
          <Accordion.Root
            key={`tabs-${index}`}
            multiple
            data-pb-multiple=""
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
        // thirds of the row — the width a photo-led product page wants. What
        // that leaves on the details side is narrow: the buy box is told so,
        // and stacks its actions there rather than squeezing them into a row.
        templateColumns={{
          base: '1fr',
          lg: gallery === 'mosaic' ? 'minmax(0, 2fr) minmax(0, 1fr)' : '1.1fr 1fr',
        }}
        gap={{ base: '8', lg: '12' }}
        alignItems="start"
      >
        <Gallery product={product} layout={gallery} zoom={readBoolean(settings, 'zoom')} />
        <Box position={{ lg: sticky ? 'sticky' : 'static' }} top={{ lg: STICKY_BELOW_HEADER }}>
          <BlockList
            blocks={readBlocks(settings, 'blocks')}
            product={product}
            narrowColumn={gallery === 'mosaic'}
          />
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
        perPage={readText(settings, 'perPage')}
        perPageMobile={readText(settings, 'perPageMobile')}
      />
    </Stack>
  )
}
