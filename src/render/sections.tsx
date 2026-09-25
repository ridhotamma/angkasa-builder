/**
 * One renderer per section type in `../model/sections`.
 *
 * Every renderer receives settings that `sanitizeValues` has already shaped,
 * and reads them through the typed `read*` helpers, so none of them needs to
 * defend against a missing or mistyped field. They never fetch: catalogue
 * sections draw from `StorefrontRenderData`.
 */

import {
  Accordion,
  AspectRatio,
  Avatar,
  Box,
  Card,
  Carousel,
  Container,
  Flex,
  Grid,
  GridItem,
  Heading,
  HStack,
  IconButton,
  Image,
  Marquee,
  SimpleGrid,
  Stack,
  Text,
  useBreakpointValue,
} from '@chakra-ui/react'
import type { ComponentType, ReactNode } from 'react'
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu'

import { ImageWithFallback } from '@repo/theme'
import { useLocale } from '@repo/i18n'

import {
  readBoolean,
  readLink,
  readList,
  readNumber,
  readRichText,
  readText,
  type FieldValues,
} from '../model/fields'
import type { SectionType } from '../model/sections'
import { useRenderEnvironment, type StorefrontCategoryData } from './context'
import { isPatternKey, patternStyle } from './patterns'
import { RichTextView } from './rich-text'
import {
  EmptyNotice,
  FullBleed,
  gridColumns,
  Paragraphs,
  ProductGrid,
  SectionHeading,
  SmartLink,
  ThemeButton,
  useCardStyle,
} from './primitives'

export interface SectionProps {
  settings: FieldValues
}

type Align = 'left' | 'center'
const alignOf = (settings: FieldValues): Align =>
  readText(settings, 'align') === 'center' ? 'center' : 'left'

const EMPTY = {
  collections: {
    en: 'This shop has no active collections yet.',
    id: 'Toko ini belum punya koleksi aktif.',
  },
  categories: {
    en: 'This shop has no active categories yet.',
    id: 'Toko ini belum punya kategori aktif.',
  },
  products: { en: 'No published products yet.', id: 'Belum ada produk yang terbit.' },
  items: { en: 'Add items in the section settings.', id: 'Tambahkan item di pengaturan bagian.' },
  image: { en: 'Pick an image in the section settings.', id: 'Pilih gambar di pengaturan bagian.' },
  slides: {
    en: 'Add a slide with an image in the section settings.',
    id: 'Tambahkan slide bergambar di pengaturan bagian.',
  },
}

function useEmptyText() {
  const { locale } = useLocale()
  return (key: keyof typeof EMPTY) => EMPTY[key][locale] || EMPTY[key].en
}

/* -------------------------------------------------------------------------- */

function AnnouncementBar({ settings }: SectionProps) {
  const text = readText(settings, 'text')
  if (!text) return null
  return (
    <SmartLink
      link={readLink(settings, 'link')}
      display="block"
      bg="brand.solid"
      color="brand.contrast"
      textAlign="center"
      fontSize="sm"
      fontWeight="medium"
      py="2.5"
      px="4"
      rounded="l2"
    >
      {text}
    </SmartLink>
  )
}

const HERO_HEIGHT = {
  sm: { base: '14rem', md: '18rem' },
  md: { base: '18rem', md: '26rem' },
  lg: { base: '24rem', md: '34rem' },
} as const

function Hero({ settings }: SectionProps) {
  const { data, imageUrl } = useRenderEnvironment()
  const empty = useEmptyText()
  const fileId = readText(settings, 'image')
  const src =
    (fileId && imageUrl(fileId, { width: 1600, height: 700 })) ||
    (readBoolean(settings, 'useShopBanner') ? data.shop.bannerUrl : null)

  const heading = readText(settings, 'heading')
  const subheading = readText(settings, 'subheading')
  const button = readText(settings, 'buttonLabel')
  const align = alignOf(settings)
  const hasCopy = Boolean(heading || subheading || button)
  const height = HERO_HEIGHT[(readText(settings, 'height') as keyof typeof HERO_HEIGHT) || 'md']

  if (!src && !hasCopy) {
    return <EmptyNotice>{empty('image')}</EmptyNotice>
  }

  return (
    <Box position="relative" rounded="l3" overflow="hidden" minH={height} bg="brand.subtle">
      {src && (
        <Image src={src} alt="" position="absolute" inset="0" w="full" h="full" objectFit="cover" />
      )}
      {hasCopy && (
        <Flex
          position="relative"
          minH={height}
          align="end"
          justify={align === 'center' ? 'center' : 'start'}
          p={{ base: '6', md: '12' }}
          bgGradient={src ? 'to-t' : undefined}
          gradientFrom={src ? 'blackAlpha.700' : undefined}
          gradientTo={src ? 'transparent' : undefined}
        >
          <Stack
            gap="4"
            maxW="2xl"
            textAlign={align}
            align={align === 'center' ? 'center' : 'start'}
            color={src ? 'white' : 'fg'}
          >
            {heading && (
              <Heading as="h1" size={{ base: '2xl', md: '4xl' }} letterSpacing="-0.02em">
                {heading}
              </Heading>
            )}
            {subheading && (
              <Text fontSize={{ base: 'md', md: 'lg' }} opacity={0.9}>
                {subheading}
              </Text>
            )}
            <ThemeButton label={button} link={readLink(settings, 'buttonLink')} />
          </Stack>
        </Flex>
      )}
    </Box>
  )
}

/** Round arrows laid over the slider's edges; phones swipe instead. */
const OVERLAY_ARROW = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  zIndex: '1',
  rounded: 'full',
  size: { base: 'sm', md: 'md' },
  variant: 'subtle',
  bg: 'bg/85',
  shadow: 'md',
  _hover: { bg: 'bg' },
  hideBelow: 'md',
} as const

/**
 * Image banners in a row, each optionally a link. Swiped on a phone and
 * dragged with the mouse on a desktop, a whole page of `perPage` slides at a
 * time. A single slide is simply a still banner — there is nothing to slide to.
 *
 * Keep this on the same default `Carousel` setup as the testimonial slider.
 * Centring the active slide needs padding at both ends, which a finite row
 * shows as blank space, and Zag's snapping did not hold a centred position.
 */
function BannerSlider({ settings }: SectionProps) {
  const empty = useEmptyText()
  const slides = readList(settings, 'slides').filter((slide) => readText(slide, 'image'))
  const desktop = Number(readText(settings, 'perPage')) || 2
  const perPage = Math.min(useBreakpointValue({ base: 1, md: desktop }) ?? 1, slides.length)
  const ratio = ratioValue(readText(settings, 'ratio'))

  if (slides.length === 0) return <EmptyNotice>{empty('slides')}</EmptyNotice>
  if (slides.length === 1) {
    return (
      <Box as="section">
        <BannerSlide slide={slides[0]!} ratio={ratio} eager />
      </Box>
    )
  }

  const paged = slides.length > perPage

  return (
    <Carousel.Root
      as="section"
      slideCount={slides.length}
      slidesPerPage={perPage}
      spacing="12px"
      loop={readBoolean(settings, 'loop')}
      allowMouseDrag
      autoplay={readBoolean(settings, 'autoplay') ? { delay: 5000 } : false}
      gap="3"
    >
      {/* Positioned around the slides only, so the arrows centre on the
          images rather than on images plus dots. */}
      <Box position="relative">
        <Carousel.ItemGroup>
          {slides.map((slide, index) => (
            <Carousel.Item key={slide.id} index={index}>
              <BannerSlide slide={slide} ratio={ratio} eager={index === 0} />
            </Carousel.Item>
          ))}
        </Carousel.ItemGroup>

        {paged && (
          <>
            <Carousel.PrevTrigger asChild>
              <IconButton {...OVERLAY_ARROW} left="3">
                <LuChevronLeft />
              </IconButton>
            </Carousel.PrevTrigger>
            <Carousel.NextTrigger asChild>
              <IconButton {...OVERLAY_ARROW} right="3">
                <LuChevronRight />
              </IconButton>
            </Carousel.NextTrigger>
          </>
        )}
      </Box>
      {paged && <Carousel.Indicators justifyContent="center" />}
    </Carousel.Root>
  )
}

function BannerSlide({
  slide,
  ratio,
  eager,
}: {
  slide: FieldValues
  ratio: number
  eager: boolean
}) {
  const { imageUrl } = useRenderEnvironment()

  return (
    <SmartLink link={readLink(slide, 'link')} display="block" draggable={false}>
      <AspectRatio ratio={ratio} rounded="l3" overflow="hidden" bg="bg.subtle">
        <ImageWithFallback
          src={imageUrl(readText(slide, 'image'), { width: 1200, height: 800 }) ?? undefined}
          alt={readText(slide, 'alt')}
          objectFit="cover"
          loading={eager ? 'eager' : 'lazy'}
          // A native image drag would steal the gesture from the slider.
          draggable={false}
        />
      </AspectRatio>
    </SmartLink>
  )
}

/** `'16/9'` as the number `AspectRatio` wants. */
function ratioValue(ratio: string): number {
  const [width, height] = ratio.split('/').map(Number)
  return width && height ? width / height : 16 / 9
}

/** The band behind the shop's introduction; the logo overlaps its bottom edge. */
const INTRO_BAND_HEIGHT = { base: '8rem', md: '12rem' } as const

function ShopIntro({ settings }: SectionProps) {
  const { data } = useRenderEnvironment()
  const align = alignOf(settings)
  const { shop } = data
  const band = readText(settings, 'background')
  const hasBand = band === 'pattern' || band === 'image'
  const showLogo = readBoolean(settings, 'showLogo')

  return (
    <Stack as="section" gap="0">
      {hasBand && <IntroBand settings={settings} />}
      <Stack
        gap="3"
        align={align === 'center' ? 'center' : 'start'}
        textAlign={align}
        // Over a band, the logo is pulled up by half its height to sit on the
        // band's edge; without a logo the name simply starts below it.
        mt={hasBand ? (showLogo ? { base: '-10', md: '-12' } : '5') : '0'}
        position="relative"
      >
        {showLogo && (
          // A shop without a logo still gets its square, with its initials, so
          // switching the logo on never leaves the band's edge empty.
          <Avatar.Root
            shape="rounded"
            rounded="l2"
            boxSize={hasBand ? { base: '20', md: '24' } : '16'}
            fontSize={hasBand ? { base: '2xl', md: '3xl' } : 'xl'}
            colorPalette="brand"
            variant="solid"
            // A ring in the page colour separates the logo from the band.
            {...(hasBand && { borderWidth: '4px', borderColor: 'bg', shadow: 'md' })}
          >
            <Avatar.Fallback name={shop.name} />
            {shop.logoUrl && <Avatar.Image src={shop.logoUrl} alt="" objectFit="cover" />}
          </Avatar.Root>
        )}
        <Heading as="h1" size={{ base: 'xl', md: '2xl' }} letterSpacing="-0.02em">
          {shop.name}
        </Heading>
        {readBoolean(settings, 'showDescription') && shop.description && (
          <Text color="fg.muted" maxW="2xl">
            {shop.description}
          </Text>
        )}
      </Stack>
    </Stack>
  )
}

function IntroBand({ settings }: { settings: FieldValues }) {
  const { imageUrl } = useRenderEnvironment()

  if (readText(settings, 'background') === 'image') {
    const fileId = readText(settings, 'backgroundImage')
    const src = fileId ? imageUrl(fileId, { width: 1920, height: 480 }) : null
    return (
      <FullBleed h={INTRO_BAND_HEIGHT} overflow="hidden" bg="bg.subtle">
        {src && <Image src={src} alt="" w="full" h="full" objectFit="cover" />}
      </FullBleed>
    )
  }

  const pattern = readText(settings, 'pattern')
  return (
    <FullBleed
      h={INTRO_BAND_HEIGHT}
      css={patternStyle(
        isPatternKey(pattern) ? pattern : 'dots',
        readText(settings, 'patternColor'),
        readText(settings, 'patternBackground'),
      )}
    />
  )
}

function CategoryRail({ settings }: SectionProps) {
  const { data } = useRenderEnvironment()
  const { frame } = useCardStyle()
  const empty = useEmptyText()
  const categories = data.categories.slice(0, readNumber(settings, 'limit', 12))

  return (
    <Stack as="section" gap="4">
      <SectionHeading>{readText(settings, 'heading')}</SectionHeading>
      {categories.length === 0 ? (
        <EmptyNotice>{empty('categories')}</EmptyNotice>
      ) : readText(settings, 'layout') === 'bento' ? (
        <CategoryBento categories={categories} />
      ) : (
        <SimpleGrid columns={{ base: 3, md: 5, lg: 6 }} gap="3">
          {categories.map((category) => (
            <Card.Root key={category.id} bg="bg.panel" rounded="l3" overflow="hidden" {...frame}>
              <SmartLink link={{ kind: 'category', slug: category.slug }} display="block">
                <AspectRatio ratio={1} bg="bg.subtle">
                  <ImageWithFallback
                    src={category.imageUrl ?? undefined}
                    alt=""
                    objectFit="cover"
                    loading="lazy"
                    fallbackIconSize="6"
                  />
                </AspectRatio>
                <Box p="2.5">
                  <Text fontSize="sm" fontWeight="medium" textAlign="center" lineClamp={2}>
                    {category.name}
                  </Text>
                </Box>
              </SmartLink>
            </Card.Root>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  )
}

/**
 * A tile's place in the desktop bento, repeating every eight: a big square,
 * two small ones and a wide one, then the same mirrored. Auto-placement puts
 * each group of four into exactly two rows of the four-column grid.
 */
const BENTO_PATTERN = ['big', 'small', 'small', 'wide', 'small', 'small', 'big', 'wide'] as const

type BentoShape = (typeof BENTO_PATTERN)[number] | 'full'

/**
 * The desktop shape of tile `index` of `count`. A last group short of four
 * would leave holes beside its big square, so it is laid out as one full row
 * instead: one tile across, two halves, or a half and two quarters.
 */
function bentoShape(index: number, count: number): BentoShape {
  const groupStart = index - (index % 4)
  const inGroup = count - groupStart
  if (inGroup >= 4) return BENTO_PATTERN[index % BENTO_PATTERN.length]!
  if (inGroup === 1) return 'full'
  if (inGroup === 2) return 'wide'
  return index === groupStart ? 'wide' : 'small'
}

const BENTO_COLUMNS: Record<BentoShape, number> = { big: 2, wide: 2, small: 1, full: 4 }

/**
 * Phones repeat a full-width tile then two halves. A last pair would leave its
 * second half alone, so a short final group of two is laid out as two halves.
 */
function bentoPhoneColumns(index: number, count: number): number {
  const groupStart = index - (index % 3)
  return index === groupStart && count - groupStart !== 2 ? 2 : 1
}

function CategoryBento({ categories }: { categories: StorefrontCategoryData[] }) {
  const { frame } = useCardStyle()

  return (
    <Grid
      templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }}
      autoRows={{ base: '8.5rem', md: '11rem' }}
      autoFlow="dense"
      gap="3"
    >
      {categories.map((category, index) => {
        const shape = bentoShape(index, categories.length)
        return (
          <GridItem
            key={category.id}
            colSpan={{
              base: bentoPhoneColumns(index, categories.length),
              md: BENTO_COLUMNS[shape],
            }}
            rowSpan={{ base: 1, md: shape === 'big' ? 2 : 1 }}
            rounded="l3"
            overflow="hidden"
            bg="bg.subtle"
            {...frame}
          >
            <SmartLink
              link={{ kind: 'category', slug: category.slug }}
              display="block"
              position="relative"
              h="full"
              className="group"
            >
              <Box
                position="absolute"
                inset="0"
                transition="transform 0.4s ease"
                _groupHover={{ transform: 'scale(1.05)' }}
              >
                <ImageWithFallback
                  src={category.imageUrl ?? undefined}
                  alt=""
                  w="full"
                  h="full"
                  objectFit="cover"
                  loading="lazy"
                  fallbackIconSize="6"
                />
              </Box>
              {/* Darkest at the bottom where the name sits, so it reads on
                  any photo while the rest of the image stays visible. */}
              <Box
                position="absolute"
                inset="0"
                bgGradient="to-t"
                gradientFrom="blackAlpha.700"
                gradientTo="transparent"
              />
              <Text
                position="absolute"
                insetX="0"
                bottom="0"
                p={{ base: '3', md: '4' }}
                color="white"
                fontWeight="semibold"
                fontSize={shape === 'big' ? { base: 'md', md: 'xl' } : 'md'}
                lineClamp={2}
              >
                {category.name}
              </Text>
            </SmartLink>
          </GridItem>
        )
      })}
    </Grid>
  )
}

function ShelfHeader({
  title,
  description,
  slug,
}: {
  title: string
  description?: string | null
  slug: string
}) {
  const { locale } = useLocale()
  return (
    <Flex justify="space-between" align="baseline" gap="4">
      <Stack gap="1">
        <SectionHeading>{title}</SectionHeading>
        {description && (
          <Text fontSize="sm" color="fg.muted">
            {description}
          </Text>
        )}
      </Stack>
      <SmartLink
        link={{ kind: 'collection', slug }}
        fontSize="sm"
        flexShrink="0"
        color="brand.fg"
        fontWeight="medium"
      >
        {locale === 'id' ? 'Lihat semua' : 'See all'}
      </SmartLink>
    </Flex>
  )
}

function FeaturedCollection({ settings }: SectionProps) {
  const { data } = useRenderEnvironment()
  const empty = useEmptyText()
  const picked = readText(settings, 'collectionId')
  const shelf =
    (picked && data.collections.find((collection) => collection.id === picked)) ||
    data.collections[0]

  if (!shelf) return <EmptyNotice>{empty('collections')}</EmptyNotice>

  const products = shelf.products.slice(0, readNumber(settings, 'limit', 8))

  return (
    <Stack as="section" gap="4">
      <ShelfHeader
        title={readText(settings, 'heading') || shelf.name}
        description={shelf.description}
        slug={shelf.slug}
      />
      {products.length === 0 ? (
        <EmptyNotice>{empty('products')}</EmptyNotice>
      ) : (
        <ProductGrid products={products} columns={readText(settings, 'columns')} />
      )}
    </Stack>
  )
}

function CollectionShelves({ settings }: SectionProps) {
  const { data } = useRenderEnvironment()
  const empty = useEmptyText()
  const limit = readNumber(settings, 'limit', 8)
  const shelves = data.collections.filter((collection) => collection.products.length > 0)

  if (shelves.length === 0) return <EmptyNotice>{empty('collections')}</EmptyNotice>

  return (
    <Stack gap="12">
      {shelves.map((shelf) => (
        <Stack as="section" key={shelf.id} gap="4">
          <ShelfHeader title={shelf.name} description={shelf.description} slug={shelf.slug} />
          <ProductGrid
            products={shelf.products.slice(0, limit)}
            columns={readText(settings, 'columns')}
          />
        </Stack>
      ))}
    </Stack>
  )
}

function LatestProducts({ settings }: SectionProps) {
  const { data } = useRenderEnvironment()
  const empty = useEmptyText()
  const products = data.latest.slice(0, readNumber(settings, 'limit', 12))

  return (
    <Stack as="section" gap="4">
      <SectionHeading>{readText(settings, 'heading')}</SectionHeading>
      {products.length === 0 ? (
        <EmptyNotice>{empty('products')}</EmptyNotice>
      ) : (
        <ProductGrid products={products} columns={readText(settings, 'columns')} />
      )}
    </Stack>
  )
}

/**
 * A column of reading width, placed by the section's `width` and `align`
 * settings. `narrow`/`wide` are the widths that setting means for this
 * section — a paragraph reads best narrower than a list of questions does.
 */
function TextColumn({
  settings,
  narrow,
  wide,
  children,
}: {
  settings: FieldValues
  narrow: string
  wide: string
  children: ReactNode
}) {
  return (
    <Container
      as="section"
      maxW={readText(settings, 'width') === 'wide' ? wide : narrow}
      px="0"
      mx={alignOf(settings) === 'center' ? 'auto' : '0'}
    >
      <Stack gap="4">{children}</Stack>
    </Container>
  )
}

function RichText({ settings }: SectionProps) {
  const align = alignOf(settings)
  return (
    <TextColumn settings={settings} narrow="2xl" wide="5xl">
      <SectionHeading align={align}>{readText(settings, 'heading')}</SectionHeading>
      <RichTextView doc={readRichText(settings, 'body')} align={align} />
    </TextColumn>
  )
}

function ImageWithText({ settings }: SectionProps) {
  const { imageUrl } = useRenderEnvironment()
  const fileId = readText(settings, 'image')
  const src = fileId ? imageUrl(fileId, { width: 900, height: 900 }) : null
  const imageRight = readText(settings, 'imagePosition') === 'right'

  return (
    <SimpleGrid
      as="section"
      columns={{ base: 1, md: 2 }}
      gap={{ base: '6', md: '12' }}
      alignItems="center"
    >
      <AspectRatio
        ratio={4 / 3}
        rounded="l3"
        overflow="hidden"
        bg="bg.subtle"
        order={{ base: 0, md: imageRight ? 1 : 0 }}
      >
        <ImageWithFallback src={src ?? undefined} alt="" objectFit="cover" loading="lazy" />
      </AspectRatio>
      {/* `start` rather than the default stretch, so the button keeps its own
          width with or without a link. */}
      <Stack gap="4" align="start">
        <SectionHeading>{readText(settings, 'heading')}</SectionHeading>
        <RichTextView doc={readRichText(settings, 'body')} />
        <ThemeButton
          label={readText(settings, 'buttonLabel')}
          link={readLink(settings, 'buttonLink')}
        />
      </Stack>
    </SimpleGrid>
  )
}

function ImageGallery({ settings }: SectionProps) {
  const { imageUrl } = useRenderEnvironment()
  const empty = useEmptyText()
  const items = readList(settings, 'items')

  return (
    <Stack as="section" gap="4">
      <SectionHeading>{readText(settings, 'heading')}</SectionHeading>
      {items.length === 0 ? (
        <EmptyNotice>{empty('items')}</EmptyNotice>
      ) : (
        <SimpleGrid columns={gridColumns(readText(settings, 'columns'))} gap="3">
          {items.map((item) => {
            const fileId = readText(item, 'image')
            const caption = readText(item, 'caption')
            return (
              <SmartLink key={item.id} link={readLink(item, 'link')} display="block">
                <Stack gap="2">
                  <AspectRatio ratio={1} rounded="l3" overflow="hidden" bg="bg.subtle">
                    <ImageWithFallback
                      src={(fileId && imageUrl(fileId, { width: 600, height: 600 })) || undefined}
                      alt={caption}
                      objectFit="cover"
                      loading="lazy"
                    />
                  </AspectRatio>
                  {caption && (
                    <Text fontSize="sm" color="fg.muted">
                      {caption}
                    </Text>
                  )}
                </Stack>
              </SmartLink>
            )
          })}
        </SimpleGrid>
      )}
    </Stack>
  )
}

function Faq({ settings }: SectionProps) {
  const empty = useEmptyText()
  const items = readList(settings, 'items').filter((item) => readText(item, 'question'))

  // Only the heading follows the alignment: questions and answers stay
  // left-aligned inside the box, where a centred paragraph would be hard to read.
  return (
    <TextColumn settings={settings} narrow="3xl" wide="6xl">
      <SectionHeading align={alignOf(settings)}>{readText(settings, 'heading')}</SectionHeading>
      {items.length === 0 ? (
        <EmptyNotice>{empty('items')}</EmptyNotice>
      ) : (
        <Accordion.Root collapsible variant="enclosed" rounded="l3">
          {items.map((item) => (
            <Accordion.Item key={item.id} value={item.id}>
              <Accordion.ItemTrigger fontWeight="medium">
                <Box flex="1">{readText(item, 'question')}</Box>
                <Accordion.ItemIndicator />
              </Accordion.ItemTrigger>
              <Accordion.ItemContent>
                <Accordion.ItemBody>
                  <Paragraphs text={readText(item, 'answer')} />
                </Accordion.ItemBody>
              </Accordion.ItemContent>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      )}
    </TextColumn>
  )
}

type TestimonialItem = FieldValues & { id: string }

/** Pixels per second for each of the running-cards speeds. */
const MARQUEE_SPEED = { slow: 25, normal: 45, fast: 80 } as const

function Testimonials({ settings }: SectionProps) {
  const empty = useEmptyText()
  const items = readList(settings, 'items').filter((item) => readText(item, 'quote'))
  const layout = readText(settings, 'layout')

  return (
    <Stack as="section" gap="4">
      <SectionHeading>{readText(settings, 'heading')}</SectionHeading>
      {items.length === 0 ? (
        <EmptyNotice>{empty('items')}</EmptyNotice>
      ) : layout === 'marquee' ? (
        <TestimonialMarquee items={items} settings={settings} />
      ) : layout === 'carousel' ? (
        <TestimonialCarousel items={items} autoplay={readBoolean(settings, 'autoplay')} />
      ) : (
        <SimpleGrid columns={{ base: 1, md: Math.min(3, items.length) }} gap="4">
          {items.map((item) => (
            <TestimonialCard key={item.id} item={item} />
          ))}
        </SimpleGrid>
      )}
    </Stack>
  )
}

/**
 * Cards that drift across the section without stopping, and pause while
 * hovered or focused so a quote can actually be read. `autoFill` repeats the
 * set when a shop has only a few, so the strip never runs out mid-screen.
 */
function TestimonialMarquee({
  items,
  settings,
}: {
  items: TestimonialItem[]
  settings: FieldValues
}) {
  const speed = readText(settings, 'speed') as keyof typeof MARQUEE_SPEED

  return (
    <Marquee.Root
      // `start` scrolls towards the start edge — right to left in an LTR page.
      side={readText(settings, 'direction') === 'right' ? 'end' : 'start'}
      speed={MARQUEE_SPEED[speed] ?? MARQUEE_SPEED.normal}
      spacing="1rem"
      autoFill
      pauseOnInteraction
      // The strip's natural width is every card end to end. Pinned to its
      // container and clipped, so it can never widen the section — or the
      // page — around it.
      w="full"
      minW="0"
      overflow="hidden"
    >
      <Marquee.Edge side="start" />
      <Marquee.Viewport>
        <Marquee.Content>
          {items.map((item) => (
            <Marquee.Item key={item.id} w={{ base: '72', md: 'sm' }} alignSelf="stretch">
              <TestimonialCard item={item} />
            </Marquee.Item>
          ))}
        </Marquee.Content>
      </Marquee.Viewport>
      <Marquee.Edge side="end" />
    </Marquee.Root>
  )
}

/**
 * One page of cards at a time — one on a phone, up to three on a desktop —
 * moved by the arrows, the dots, a swipe, or a drag with the mouse.
 */
function TestimonialCarousel({ items, autoplay }: { items: TestimonialItem[]; autoplay: boolean }) {
  const perPage = Math.min(useBreakpointValue({ base: 1, md: 2, lg: 3 }) ?? 1, items.length)

  return (
    <Carousel.Root
      slideCount={items.length}
      slidesPerPage={perPage}
      spacing="1rem"
      loop
      allowMouseDrag
      autoplay={autoplay ? { delay: 5000 } : false}
      gap="4"
    >
      <Carousel.ItemGroup>
        {items.map((item, index) => (
          <Carousel.Item key={item.id} index={index} display="flex">
            <TestimonialCard item={item} />
          </Carousel.Item>
        ))}
      </Carousel.ItemGroup>

      {items.length > perPage && (
        <Carousel.Control justifyContent="center" gap="4">
          <Carousel.PrevTrigger asChild>
            <IconButton size="xs" variant="outline" rounded="full">
              <LuChevronLeft />
            </IconButton>
          </Carousel.PrevTrigger>
          <Carousel.Indicators />
          <Carousel.NextTrigger asChild>
            <IconButton size="xs" variant="outline" rounded="full">
              <LuChevronRight />
            </IconButton>
          </Carousel.NextTrigger>
        </Carousel.Control>
      )}
    </Carousel.Root>
  )
}

/** The quote, then who said it — with their photo, or their initials without one. */
function TestimonialCard({ item }: { item: TestimonialItem }) {
  const { frame } = useCardStyle()
  const { imageUrl } = useRenderEnvironment()
  const author = readText(item, 'author')
  const role = readText(item, 'role')
  const avatar = readText(item, 'avatar')
  const src = avatar ? imageUrl(avatar, { width: 96, height: 96 }) : null

  return (
    <Card.Root bg="bg.subtle" rounded="l3" w="full" h="full" {...frame}>
      <Card.Body gap="4" justifyContent="space-between">
        <Text fontSize="lg" lineHeight="tall">
          “{readText(item, 'quote')}”
        </Text>
        {(author || src) && (
          <HStack gap="3">
            <Avatar.Root size="md" flexShrink="0">
              <Avatar.Fallback name={author || undefined} />
              {src && <Avatar.Image src={src} alt="" loading="lazy" />}
            </Avatar.Root>
            <Box minW="0">
              <Text fontWeight="semibold" truncate>
                {author}
              </Text>
              {role && (
                <Text fontSize="sm" color="fg.muted" truncate>
                  {role}
                </Text>
              )}
            </Box>
          </HStack>
        )}
      </Card.Body>
    </Card.Root>
  )
}

/**
 * Every section type's renderer. `satisfies Record<SectionType, …>` is what
 * makes a schema without a renderer a compile error.
 */
export const SECTION_RENDERERS = {
  'announcement-bar': AnnouncementBar,
  hero: Hero,
  'banner-slider': BannerSlider,
  'shop-intro': ShopIntro,
  'category-rail': CategoryRail,
  'featured-collection': FeaturedCollection,
  'collection-shelves': CollectionShelves,
  'latest-products': LatestProducts,
  'rich-text': RichText,
  'image-with-text': ImageWithText,
  'image-gallery': ImageGallery,
  faq: Faq,
  testimonials: Testimonials,
} satisfies Record<SectionType, ComponentType<SectionProps>>
