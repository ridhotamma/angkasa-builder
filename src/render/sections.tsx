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
  Container,
  Flex,
  Grid,
  GridItem,
  Heading,
  HStack,
  Icon,
  Marquee,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  type BoxProps,
} from '@chakra-ui/react'
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { LuMinus, LuPlus } from 'react-icons/lu'

import { Image, ImageWithFallback } from '@repo/theme'
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
import { CATEGORY_PREVIEW_PRODUCTS } from '../model/content'
import { readToken, textElementKey } from '../model/element-style'
import { PHOTO_FIT_VALUES, PHOTO_POSITION_VALUES } from '../model/section-style'
import type { Link } from '../model/links'
import { isRichDocEmpty } from '../model/rich-text'
import type { SectionType } from '../model/sections'
import { HEADER_HEIGHT_VAR, TABBAR_HEIGHT_VAR } from './chrome'
import { useRenderEnvironment, type StorefrontCategoryData } from './context'
import { useRenderText } from './copy'
import { useSectionLayout } from './frame'
import { useResponsive } from './hooks'
import { SplitText, useMarqueePause } from './motion'
import { Slider } from './slider'
import { isPatternKey, patternStyle } from './patterns'
import { RichTextView } from './rich-text'
import {
  BENTO_COLUMNS,
  bentoPhoneColumns,
  bentoReveal,
  bentoShape,
  ButtonRow,
  EditableText,
  EmptyNotice,
  FullBleed,
  gridColumns,
  PageColumn,
  Paragraphs,
  ProductList,
  SectionHeading,
  SmartLink,
  ThemeButton,
  useCard,
} from './primitives'

export interface SectionProps {
  settings: FieldValues
}

export type Align = 'left' | 'center'
export const alignOf = (settings: FieldValues): Align =>
  readText(settings, 'align') === 'center' ? 'center' : 'left'

export const EMPTY = {
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

export function useEmptyText() {
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

export const HERO_HEIGHT = {
  sm: { base: '14rem', md: '18rem' },
  md: { base: '18rem', md: '26rem' },
  lg: { base: '24rem', md: '34rem' },
  // Small-viewport units, so the address bar never hides the buttons; in the
  // editor's iframe that is one screen of the previewed device. The header's
  // height comes off the top: its measured height, or nothing when it floats
  // over the banner (`StoreHeader` keeps the variable current). The fallbacks
  // are the classic header's height, for the server's HTML. A phone's tab bar
  // comes off the bottom the same way.
  screen: {
    base: `calc(100svh - var(${HEADER_HEIGHT_VAR}, 4rem) - var(${TABBAR_HEIGHT_VAR}, 0px))`,
    md: `calc(100svh - var(${HEADER_HEIGHT_VAR}, 4.5rem))`,
  },
} as const

export function heroHeight(settings: FieldValues) {
  const key = readText(settings, 'height') as keyof typeof HERO_HEIGHT
  return HERO_HEIGHT[key] ?? HERO_HEIGHT.md
}

/** The shade between a photo and the white text on it. */
export function overlayProps(
  overlay: string,
): Pick<BoxProps, 'bg' | 'bgGradient' | 'gradientFrom' | 'gradientTo'> {
  switch (overlay) {
    case 'none':
      return {}
    case 'light':
      return { bg: 'blackAlpha.300' }
    case 'dark':
      return { bg: 'blackAlpha.600' }
    default:
      return { bgGradient: 'to-t', gradientFrom: 'blackAlpha.700', gradientTo: 'transparent' }
  }
}

/**
 * A banner's words and buttons, over whatever the banner shows behind them.
 * Shared by the image, video and parallax banners so all three read alike.
 */
export function BannerCopy({ settings, onImage }: { settings: FieldValues; onImage: boolean }) {
  const { mode } = useRenderEnvironment()
  const { headline, width: sectionWidth, contentWidth, banded } = useSectionLayout()
  const heading = readText(settings, 'heading')
  const subheading = readText(settings, 'subheading')
  const align = alignOf(settings)
  // Top, middle or bottom — the three the schemas offer. Anything else keeps
  // the historic bottom.
  const position = readText(settings, 'contentPosition')
  const place = position === 'top' ? 'start' : position === 'middle' ? 'center' : 'end'
  const height = heroHeight(settings)
  // The hero's words rise on the storefront; the preview keeps editable text.
  const animatedHeading = headline === 'rise' && mode === 'live'
  // An edge-to-edge banner keeps its background across the page, but its copy
  // lines up with the header and the sections around it — the page column,
  // not the viewport edges. A "full-width background" frame already supplies
  // that column; a contained panel keeps its own inner padding.
  const edge = sectionWidth === 'edge'
  const pageColumn = edge || (sectionWidth === 'full' && banded)

  const copy = (
    <Stack
      gap="4"
      maxW="3xl"
      textAlign={align}
      align={align === 'center' ? 'center' : 'start'}
      color={onImage ? 'white' : 'fg'}
    >
      {/* The preview keeps an empty heading mounted so clearing the text does
          not unmount the caret; the live storefront hides it as before. */}
      {(heading || mode === 'preview') && (
        <Heading
          as="h1"
          size={{ base: '3xl', md: '5xl' }}
          letterSpacing="-0.025em"
          lineHeight="1.05"
          textWrap="balance"
        >
          {animatedHeading ? (
            <SplitText text={heading} />
          ) : (
            <EditableText field="heading" value={heading} />
          )}
        </Heading>
      )}
      {(subheading || mode === 'preview') && (
        <Text fontSize={{ base: 'md', md: 'xl' }} opacity={0.9} textWrap="pretty">
          <EditableText field="subheading" value={subheading} />
        </Text>
      )}
      <ButtonRow settings={settings} align={align} onImage={onImage} />
    </Stack>
  )

  return (
    <Flex
      data-banner-copy=""
      position="relative"
      minH={height}
      align={place}
      justify={align === 'center' ? 'center' : 'start'}
      px={pageColumn ? '0' : { base: '6', md: '12' }}
      py={{ base: '6', md: '12' }}
      {...(onImage ? overlayProps(readText(settings, 'overlay')) : {})}
    >
      {edge ? (
        // The page's own column, so the words start where the header's logo
        // and the sections below do.
        <PageColumn maxW={contentWidth}>
          <Flex w="full" justify={align === 'center' ? 'center' : 'start'}>
            {copy}
          </Flex>
        </PageColumn>
      ) : (
        copy
      )}
    </Flex>
  )
}

function Hero({ settings }: SectionProps) {
  const { data, imageUrl } = useRenderEnvironment()
  const { width } = useSectionLayout()
  const empty = useEmptyText()
  const fileId = readText(settings, 'image')
  const src =
    (fileId && imageUrl(fileId, { width: 1920, height: 1080 })) ||
    (readBoolean(settings, 'useShopBanner') ? data.shop.bannerUrl : null)

  const hasCopy = Boolean(
    readText(settings, 'heading') ||
    readText(settings, 'subheading') ||
    readText(settings, 'buttonLabel') ||
    readText(settings, 'secondaryButtonLabel'),
  )
  const height = heroHeight(settings)
  const fit = readToken(settings, 'fit', PHOTO_FIT_VALUES, 'cover')

  if (!src && !hasCopy) {
    return <EmptyNotice>{empty('image')}</EmptyNotice>
  }

  return (
    <Box
      position="relative"
      rounded={width === 'edge' ? 'none' : 'l3'}
      overflow="hidden"
      minH={height}
      bg="brand.subtle"
    >
      {src && (
        <Image
          src={src}
          alt=""
          position="absolute"
          inset="0"
          w="full"
          h="full"
          objectFit={fit}
          objectPosition={readToken(settings, 'position', PHOTO_POSITION_VALUES, 'center')}
          fetchPriority="high"
        />
      )}
      {hasCopy && <BannerCopy settings={settings} onImage={Boolean(src)} />}
    </Box>
  )
}

/**
 * Image banners in a row, each optionally a link — a whole page of `perPage`
 * at a time, with the shared slider's arrows, finger drag and pill dots. A
 * single slide is simply a still banner: there is nothing to slide to. Until
 * the images have settled a skeleton of the same shape stands in, so the swap
 * moves nothing below it.
 *
 * The band is the **Banner shape** the seller picked, and its height never
 * follows the number of visible slides — switching 1 → 2 → 3 changes the
 * crop, not the page. See `slider.tsx` for the track itself.
 */
function BannerSlider({ settings }: SectionProps) {
  const empty = useEmptyText()
  const { imageUrl } = useRenderEnvironment()
  const slides = readList(settings, 'slides').filter((slide) => readText(slide, 'image'))
  const desktop = Number(readText(settings, 'perPage')) || 2
  const perPage = Math.min(useResponsive({ base: 1, md: desktop }), slides.length)
  const ratio = ratioValue(readText(settings, 'ratio'))
  const ready = useImagesSettled(
    slides.length > 1 ? slides.map((slide) => bannerImageUrl(imageUrl, slide)) : [],
  )

  if (slides.length === 0) return <EmptyNotice>{empty('slides')}</EmptyNotice>
  if (slides.length === 1) {
    return (
      <AspectRatio as="section" ratio={ratio}>
        <BannerSlide slide={slides[0]!} eager />
      </AspectRatio>
    )
  }

  if (!ready) {
    // The skeleton is the slider's own shape, so nothing below moves when the
    // real one swaps in. The dots live inside the band, so the band is all
    // there is to draw.
    const columns = Math.min(Math.ceil(desktop), slides.length)
    return (
      <AspectRatio as="section" ratio={ratio} aria-busy>
        <Flex gap="12px">
          {Array.from({ length: columns }, (_, index) => (
            <Skeleton
              key={index}
              flex="1"
              rounded="l3"
              h="full"
              hideBelow={index > 0 ? 'md' : undefined}
            />
          ))}
        </Flex>
      </AspectRatio>
    )
  }

  return (
    <Slider
      as="section"
      ratio={ratio}
      count={slides.length}
      perPage={perPage}
      loop={readBoolean(settings, 'loop')}
      autoplay={readBoolean(settings, 'autoplay')}
      dots="inside"
    >
      {slides.map((slide, position) => (
        <BannerSlide key={String(slide.id)} slide={slide} eager={position === 0} />
      ))}
    </Slider>
  )
}

/**
 * One slide: the photo fills the band's whole box, cropped by the slide's own
 * size and position. Shared by the slider and the single-slide case.
 */
function BannerSlide({ slide, eager }: { slide: FieldValues; eager: boolean }) {
  const { imageUrl } = useRenderEnvironment()

  return (
    <SmartLink link={readLink(slide, 'link')} display="block" h="full" draggable={false}>
      <ImageWithFallback
        src={bannerImageUrl(imageUrl, slide) ?? undefined}
        alt={readText(slide, 'alt')}
        w="full"
        h="full"
        objectFit={readToken(slide, 'fit', PHOTO_FIT_VALUES, 'cover')}
        objectPosition={readToken(slide, 'position', PHOTO_POSITION_VALUES, 'center')}
        rounded="l3"
        overflow="hidden"
        bg="bg.subtle"
        loading={eager ? 'eager' : 'lazy'}
        // A native image drag would steal the gesture from the slider.
        draggable={false}
      />
    </SmartLink>
  )
}

/** One URL per slide, shared by the preload and the `<img>` so the second hits the cache. */
function bannerImageUrl(
  imageUrl: ReturnType<typeof useRenderEnvironment>['imageUrl'],
  slide: FieldValues,
): string | null {
  return imageUrl(readText(slide, 'image'), { width: 1200, height: 800 }) ?? null
}

/** Longest the slider waits on its images before showing anyway. */
const IMAGE_SETTLE_TIMEOUT_MS = 10_000

/**
 * `true` once the page has hydrated and every URL has loaded or failed.
 *
 * `false` on the server and on the first client render — an effect is what
 * says the script is running. Once `true` it stays `true`: adding a slide in
 * the editor should not blank the whole slider while one more image loads.
 * A failed image counts as settled, since `ImageWithFallback` has a
 * placeholder for it, and the timeout keeps one stalled request from hiding
 * the slider indefinitely.
 */
function useImagesSettled(urls: (string | null)[]): boolean {
  const [settled, setSettled] = useState(false)
  const key = urls.filter(Boolean).join('\n')

  useEffect(() => {
    if (settled) return
    let cancelled = false
    const pending = key
      ? key.split('\n').map(
          (url) =>
            new Promise<void>((resolve) => {
              const image = new window.Image()
              image.onload = image.onerror = () => resolve()
              image.src = url
            }),
        )
      : []
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, IMAGE_SETTLE_TIMEOUT_MS))
    void Promise.race([Promise.all(pending), timeout]).then(() => {
      if (!cancelled) setSettled(true)
    })
    return () => {
      cancelled = true
    }
  }, [key, settled])

  return settled
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
            {/* A plain image over the initials rather than `Avatar.Image`,
                which stays hidden until its script runs — on a slow
                connection that is seconds of initials on every page load,
                even with the logo already in the browser's cache. */}
            {shop.logoUrl && (
              <ImageWithFallback
                src={shop.logoUrl}
                alt=""
                fallback={false}
                position="absolute"
                inset="0"
                boxSize="full"
                objectFit="cover"
                rounded="inherit"
              />
            )}
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
  const { frame, hover, tiltRef } = useCard()
  const empty = useEmptyText()
  const categories = data.categories.slice(0, readNumber(settings, 'limit', 12))

  return (
    <Stack as="section" gap="4">
      <SectionHeading field="heading">{readText(settings, 'heading')}</SectionHeading>
      {categories.length === 0 ? (
        <EmptyNotice>{empty('categories')}</EmptyNotice>
      ) : readText(settings, 'layout') === 'bento' ? (
        <CategoryBento
          categories={categories}
          reveal={readText(settings, 'bentoText') === 'hover'}
        />
      ) : readText(settings, 'layout') === 'list' ? (
        <CategoryList categories={categories} size={readText(settings, 'listSize')} />
      ) : (
        <SimpleGrid columns={{ base: 3, md: 5, lg: 6 }} gap="3">
          {categories.map((category) => (
            <Card.Root
              key={category.id}
              ref={tiltRef}
              bg="bg.panel"
              rounded="l3"
              overflow="hidden"
              {...frame}
              {...hover}
            >
              <SmartLink link={{ kind: 'category', slug: category.slug }} display="block">
                <AspectRatio ratio={1} bg="bg.subtle">
                  <ImageWithFallback
                    src={category.imageUrl ?? undefined}
                    alt=""
                    objectFit="cover"
                    loading="lazy"
                    fallbackIconSize="6"
                    transition="transform 600ms ease"
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

/** Each preview photo arrives this much after the one before it. */
const PREVIEW_STAGGER_MS = 60

/** A preview photo shown, arriving `index` steps after the first. */
function revealed(index: number) {
  return {
    opacity: 1,
    transform: 'none',
    pointerEvents: 'auto',
    transitionDelay: `${index * PREVIEW_STAGGER_MS}ms`,
  } as const
}

/**
 * The categories as a list of large names, one per row, each bringing in its
 * best sellers on hover — or on keyboard focus, so the preview is not a
 * pointer-only feature.
 *
 * The whole row opens the category (its link is stretched over the row), and
 * each photo opens its own product above that, so neither link is nested in
 * the other. The photos come in from the right one after another; with
 * reduced motion they simply appear. A screen without hover — a tablet —
 * shows them all the time, and a phone keeps the plain list, where a strip of
 * photos would crowd the names it is there to sell.
 */
/**
 * The list layout's three sizes: the name, the row's padding and the preview
 * photos step together, so a smaller list stays in proportion.
 */
const CATEGORY_LIST_SIZES = {
  sm: {
    fontSize: { base: 'lg', md: 'xl', lg: '2xl' },
    py: { base: '3', md: '4' },
    preview: { md: '12', lg: '14' },
  },
  md: {
    fontSize: { base: 'xl', md: '2xl', lg: '3xl' },
    py: { base: '4', md: '5' },
    preview: { md: '16', lg: '20' },
  },
  lg: {
    fontSize: { base: '2xl', md: '4xl', lg: '5xl' },
    py: { base: '5', md: '7' },
    preview: { md: '20', lg: '24' },
  },
} as const

function CategoryList({
  categories,
  size: sizeKey,
}: {
  categories: StorefrontCategoryData[]
  size: string
}) {
  const size =
    CATEGORY_LIST_SIZES[sizeKey as keyof typeof CATEGORY_LIST_SIZES] ?? CATEGORY_LIST_SIZES.md
  return (
    <Stack
      as="ul"
      gap="0"
      listStyleType="none"
      m="0"
      p="0"
      borderTopWidth="1px"
      borderColor="border.subtle"
    >
      {categories.map((category) => {
        const products = (category.products ?? []).slice(0, CATEGORY_PREVIEW_PRODUCTS)
        return (
          <Flex
            as="li"
            key={category.id}
            className="group"
            position="relative"
            align="center"
            justify="space-between"
            gap="6"
            py={size.py}
            borderBottomWidth="1px"
            borderColor="border.subtle"
            data-category-row=""
          >
            <SmartLink
              link={{ kind: 'category', slug: category.slug }}
              minW="0"
              fontFamily="heading"
              fontWeight="bold"
              fontSize={size.fontSize}
              lineHeight="1.1"
              letterSpacing="-0.02em"
              color="fg"
              transition="color 0.2s ease"
              _groupHover={{ color: 'brand.fg' }}
              _groupFocusWithin={{ color: 'brand.fg' }}
              // The row is the target: the link's box is stretched over it.
              css={{ '&::after': { content: '""', position: 'absolute', inset: '0' } }}
            >
              {category.name}
            </SmartLink>
            {/* Always drawn, so a category with nothing to preview keeps the
                same row height as the rest. */}
            <HStack
              gap="3"
              flexShrink="0"
              hideBelow="md"
              h={size.preview}
              position="relative"
              zIndex="1"
            >
              {products.map((product, index) => (
                <SmartLink
                  key={product.id}
                  link={{ kind: 'product', slug: product.slug }}
                  aria-label={product.name}
                  display="block"
                  boxSize={size.preview}
                  rounded="l2"
                  overflow="hidden"
                  bg="bg.subtle"
                  data-category-preview=""
                  opacity="0"
                  transform="translateX(12px)"
                  pointerEvents="none"
                  transition="opacity 0.3s ease, transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)"
                  // Leaving, they all go at once; arriving, one after another.
                  _groupHover={revealed(index)}
                  _groupFocusWithin={revealed(index)}
                  css={{
                    '@media (hover: none)': {
                      opacity: 1,
                      transform: 'none',
                      pointerEvents: 'auto',
                    },
                    '@media (prefers-reduced-motion: reduce)': {
                      transition: 'none',
                      transform: 'none',
                    },
                  }}
                >
                  <ImageWithFallback
                    src={product.imageUrl ?? undefined}
                    alt=""
                    w="full"
                    h="full"
                    objectFit="cover"
                    loading="lazy"
                    fallbackIconSize="5"
                  />
                </SmartLink>
              ))}
            </HStack>
          </Flex>
        )
      })}
    </Stack>
  )
}

function CategoryBento({
  categories,
  reveal,
}: {
  categories: StorefrontCategoryData[]
  /** The names show on hover only (the section's `bentoText`). */
  reveal: boolean
}) {
  const { frame, hover } = useCard()

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
            {...hover}
          >
            <SmartLink
              link={{ kind: 'category', slug: category.slug }}
              display="block"
              position="relative"
              h="full"
              className="group"
              data-text-reveal={reveal ? '' : undefined}
            >
              <Box position="absolute" inset="0">
                <ImageWithFallback
                  src={category.imageUrl ?? undefined}
                  alt=""
                  w="full"
                  h="full"
                  objectFit="cover"
                  loading="lazy"
                  fallbackIconSize="6"
                  transition="transform 600ms ease"
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
                {...(reveal && bentoReveal(0, { rise: false }))}
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
                {...(reveal && bentoReveal(70))}
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

/** The "See all" link a product row's header ends with. */
function SeeAllLink({ link }: { link: Link }) {
  const text = useRenderText()
  return (
    <SmartLink link={link} fontSize="sm" flexShrink="0" color="brand.fg" fontWeight="medium">
      {text('seeAll')}
    </SmartLink>
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
      <SeeAllLink link={{ kind: 'collection', slug }} />
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
        <ProductList
          products={products}
          layout={readText(settings, 'layout')}
          textReveal={readText(settings, 'bentoText') === 'hover'}
          columns={readText(settings, 'columns')}
          mobileColumns={readText(settings, 'mobileColumns')}
          perPage={readText(settings, 'perPage')}
          perPageMobile={readText(settings, 'perPageMobile')}
        />
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
      {/* The shelves name their own collections; the section's own heading sits
          above them, as it does for every other product-list look. Without it
          the Heading field was a control that changed nothing. */}
      <SectionHeading field="heading">{readText(settings, 'heading')}</SectionHeading>
      {shelves.map((shelf) => (
        <Stack as="section" key={shelf.id} gap="4">
          <ShelfHeader title={shelf.name} description={shelf.description} slug={shelf.slug} />
          <ProductList
            products={shelf.products.slice(0, limit)}
            layout={readText(settings, 'layout')}
            textReveal={readText(settings, 'bentoText') === 'hover'}
            columns={readText(settings, 'columns')}
            mobileColumns={readText(settings, 'mobileColumns')}
            perPage={readText(settings, 'perPage')}
            perPageMobile={readText(settings, 'perPageMobile')}
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
      <Flex justify="space-between" align="baseline" gap="4">
        <SectionHeading field="heading">{readText(settings, 'heading')}</SectionHeading>
        {/* The newest few are a teaser; the catalogue is the rest, filterable. */}
        {readBoolean(settings, 'showAll') && products.length > 0 && (
          <SeeAllLink link={{ kind: 'catalog' }} />
        )}
      </Flex>
      {products.length === 0 ? (
        <EmptyNotice>{empty('products')}</EmptyNotice>
      ) : (
        <ProductList
          products={products}
          layout={readText(settings, 'layout')}
          textReveal={readText(settings, 'bentoText') === 'hover'}
          columns={readText(settings, 'columns')}
          mobileColumns={readText(settings, 'mobileColumns')}
          perPage={readText(settings, 'perPage')}
          perPageMobile={readText(settings, 'perPageMobile')}
        />
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
  const { mode } = useRenderEnvironment()
  const text = useRenderText()
  const align = alignOf(settings)
  const heading = readText(settings, 'heading')
  const body = readRichText(settings, 'body')
  // An empty text block draws nothing on the storefront — and in the editor
  // that left nothing to click. There it says what goes here instead.
  const empty = !heading && isRichDocEmpty(body)
  return (
    <TextColumn settings={settings} narrow="2xl" wide="5xl">
      <SectionHeading align={align} field="heading">
        {heading}
      </SectionHeading>
      {empty && mode === 'preview' ? (
        <Text color="fg.subtle" fontStyle="italic" textAlign={align} py="2">
          {text('textPlaceholder')}
        </Text>
      ) : (
        <RichTextView doc={body} align={align} elementKey={textElementKey('body')} field="body" />
      )}
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
        <ImageWithFallback
          src={src ?? undefined}
          alt=""
          objectFit={readToken(settings, 'fit', PHOTO_FIT_VALUES, 'cover')}
          objectPosition={readToken(settings, 'position', PHOTO_POSITION_VALUES, 'center')}
          loading="lazy"
        />
      </AspectRatio>
      {/* `start` rather than the default stretch, so the button keeps its own
          width with or without a link. */}
      <Stack gap="4" align="start">
        <SectionHeading field="heading">{readText(settings, 'heading')}</SectionHeading>
        <RichTextView
          doc={readRichText(settings, 'body')}
          elementKey={textElementKey('body')}
          field="body"
        />
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
  const { frame, flat, hover, tiltRef } = useCard()
  const empty = useEmptyText()
  const items = readList(settings, 'items')

  return (
    <Stack as="section" gap="4">
      <SectionHeading field="heading">{readText(settings, 'heading')}</SectionHeading>
      {items.length === 0 ? (
        <EmptyNotice>{empty('items')}</EmptyNotice>
      ) : (
        <SimpleGrid
          columns={gridColumns(readText(settings, 'columns'), readText(settings, 'mobileColumns'))}
          gap="3"
        >
          {items.map((item) => {
            const fileId = readText(item, 'image')
            const caption = readText(item, 'caption')
            return (
              <Card.Root
                key={item.id}
                ref={tiltRef}
                h="full"
                bg="bg.panel"
                rounded="l3"
                overflow="hidden"
                {...frame}
                {...hover}
              >
                <SmartLink link={readLink(item, 'link')} display="block">
                  <AspectRatio
                    ratio={1}
                    bg="bg.subtle"
                    rounded={flat ? 'l3' : undefined}
                    overflow="hidden"
                  >
                    <ImageWithFallback
                      src={(fileId && imageUrl(fileId, { width: 600, height: 600 })) || undefined}
                      alt={caption}
                      objectFit={readToken(item, 'fit', PHOTO_FIT_VALUES, 'cover')}
                      objectPosition={readToken(item, 'position', PHOTO_POSITION_VALUES, 'center')}
                      loading="lazy"
                      transition="transform 600ms ease"
                    />
                  </AspectRatio>
                  {caption && (
                    <Text fontSize="sm" color="fg.muted" p={flat ? '2' : '3'}>
                      {caption}
                    </Text>
                  )}
                </SmartLink>
              </Card.Root>
            )
          })}
        </SimpleGrid>
      )}
    </Stack>
  )
}

const FAQ_VARIANTS = ['enclosed', 'outline', 'plain'] as const
const FAQ_SIZES = ['sm', 'md', 'lg'] as const
const FAQ_ICONS = ['chevron', 'plus'] as const

/**
 * The trigger's icon: Chakra's own chevron, or a plus that becomes a minus
 * while the answer is open. The indicator carries `data-state`, so the two
 * glyphs swap with CSS — no state to thread through React.
 */
function FaqIndicator({ icon }: { icon: string }) {
  if (icon !== 'plus') return <Accordion.ItemIndicator />
  return (
    <Accordion.ItemIndicator>
      <Icon as={LuPlus} boxSize="4" css={{ '[data-state="open"] &': { display: 'none' } }} />
      <Icon as={LuMinus} boxSize="4" css={{ '[data-state="closed"] &': { display: 'none' } }} />
    </Accordion.ItemIndicator>
  )
}

function Faq({ settings }: SectionProps) {
  const empty = useEmptyText()
  const items = readList(settings, 'items').filter((item) => readText(item, 'question'))
  const variant = readToken(settings, 'variant', FAQ_VARIANTS, 'enclosed')
  const size = readToken(settings, 'size', FAQ_SIZES, 'md')
  const icon = readToken(settings, 'icon', FAQ_ICONS, 'chevron')

  // Only the heading follows the alignment: questions and answers stay
  // left-aligned inside the box, where a centred paragraph would be hard to read.
  return (
    <TextColumn settings={settings} narrow="3xl" wide="6xl">
      <SectionHeading align={alignOf(settings)} field="heading">
        {readText(settings, 'heading')}
      </SectionHeading>
      {items.length === 0 ? (
        <EmptyNotice>{empty('items')}</EmptyNotice>
      ) : (
        <Accordion.Root
          collapsible
          variant={variant}
          size={size}
          rounded={variant === 'enclosed' ? 'l3' : undefined}
        >
          {items.map((item) => (
            <Accordion.Item key={item.id} value={item.id}>
              <Accordion.ItemTrigger fontWeight="medium">
                <Box flex="1">{readText(item, 'question')}</Box>
                <FaqIndicator icon={icon} />
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
      <SectionHeading field="heading">{readText(settings, 'heading')}</SectionHeading>
      {items.length === 0 ? (
        <EmptyNotice>{empty('items')}</EmptyNotice>
      ) : layout === 'marquee' ? (
        <TestimonialMarquee items={items} settings={settings} />
      ) : layout === 'carousel' ? (
        <TestimonialCarousel items={items} autoplay={readBoolean(settings, 'autoplay')} />
      ) : layout === 'list' ? (
        <TestimonialList items={items} />
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
  const marquee = useMarqueePause()

  return (
    <Marquee.Root
      {...marquee.rootProps}
      // `start` scrolls towards the start edge — right to left in an LTR page.
      side={readText(settings, 'direction') === 'right' ? 'end' : 'start'}
      speed={MARQUEE_SPEED[speed] ?? MARQUEE_SPEED.normal}
      spacing="1rem"
      autoFill
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
 * moved by the shared slider's arrows, finger drag and autoplay. No dots: the
 * banner is the one slider that wears them, and no loop either: the row ends
 * on its last card.
 */
function TestimonialCarousel({ items, autoplay }: { items: TestimonialItem[]; autoplay: boolean }) {
  const perPage = Math.min(useResponsive({ base: 1, md: 2, lg: 3 }), items.length)

  return (
    <Slider
      count={items.length}
      perPage={perPage}
      autoplay={autoplay}
      slideProps={{ display: 'flex' }}
    >
      {items.map((item) => (
        <TestimonialCard key={item.id} item={item} />
      ))}
    </Slider>
  )
}

/**
 * The list arrangement: one testimonial per row, full width, separated by
 * hairlines — the quote, and the customer beneath it. Distinct from the grid,
 * which packs up to three cards across; the list reads top to bottom, one
 * voice at a time, and stays one per row at every width.
 */
function TestimonialList({ items }: { items: TestimonialItem[] }) {
  return (
    <Stack
      as="ul"
      gap="0"
      listStyleType="none"
      m="0"
      p="0"
      borderTopWidth="1px"
      borderColor="border.subtle"
    >
      {items.map((item) => (
        <Flex
          as="li"
          key={item.id}
          direction="column"
          align="flex-start"
          gap={{ base: '3', md: '4' }}
          py="6"
          borderBottomWidth="1px"
          borderColor="border.subtle"
          data-testimonial-row=""
        >
          <Text fontSize={{ base: 'lg', md: 'xl' }} lineHeight="tall" minW="0">
            “{readText(item, 'quote')}”
          </Text>
          <TestimonialByline item={item} />
        </Flex>
      ))}
    </Stack>
  )
}

/** The quote, then who said it — with their photo, or their initials without one. */
function TestimonialCard({ item }: { item: TestimonialItem }) {
  const { frame, hover, tiltRef } = useCard()

  return (
    <Card.Root ref={tiltRef} bg="bg.subtle" rounded="l3" w="full" h="full" {...frame} {...hover}>
      <Card.Body gap="4" justifyContent="space-between">
        <Text fontSize="lg" lineHeight="tall">
          “{readText(item, 'quote')}”
        </Text>
        <TestimonialByline item={item} />
      </Card.Body>
    </Card.Root>
  )
}

/**
 * Who said it — avatar (or initials), name and role. Shared by the card and the
 * list, and `null` when a testimonial carries neither an author nor a photo, so
 * neither leaves an empty row behind.
 */
function TestimonialByline({ item }: { item: TestimonialItem }) {
  const { imageUrl } = useRenderEnvironment()
  const author = readText(item, 'author')
  const role = readText(item, 'role')
  const avatar = readText(item, 'avatar')
  const src = avatar ? imageUrl(avatar, { width: 96, height: 96 }) : null
  if (!author && !src) return null

  return (
    <HStack gap="3" flexShrink="0">
      <Avatar.Root size="md" flexShrink="0">
        <Avatar.Fallback name={author || undefined} />
        {/* A plain image over the initials rather than `Avatar.Image`,
            which stays hidden until its script runs — a cached photo
            would otherwise never appear. */}
        {src && (
          <ImageWithFallback
            src={src}
            alt=""
            fallback={false}
            position="absolute"
            inset="0"
            boxSize="full"
            objectFit={readToken(item, 'fit', PHOTO_FIT_VALUES, 'cover')}
            objectPosition={readToken(item, 'position', PHOTO_POSITION_VALUES, 'center')}
            rounded="inherit"
            loading="lazy"
          />
        )}
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
  )
}

/** The first sections' renderers; the full registry is `./registry`. */
export const BASE_SECTION_RENDERERS = {
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
} satisfies Partial<Record<SectionType, ComponentType<SectionProps>>>
