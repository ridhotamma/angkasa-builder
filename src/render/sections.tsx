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
  Box,
  Card,
  Container,
  Flex,
  Heading,
  Image,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react'
import type { ComponentType } from 'react'

import { ImageWithFallback } from '@repo/theme'
import { useLocale } from '@repo/i18n'

import {
  readBoolean,
  readLink,
  readList,
  readNumber,
  readText,
  type FieldValues,
} from '../model/fields'
import type { SectionType } from '../model/sections'
import { useRenderEnvironment } from './context'
import {
  EmptyNotice,
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

function ShopIntro({ settings }: SectionProps) {
  const { data } = useRenderEnvironment()
  const align = alignOf(settings)
  const { shop } = data

  return (
    <Stack gap="3" align={align === 'center' ? 'center' : 'start'} textAlign={align}>
      {readBoolean(settings, 'showLogo') && shop.logoUrl && (
        <Image src={shop.logoUrl} alt="" boxSize="16" rounded="l2" objectFit="cover" />
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

function RichText({ settings }: SectionProps) {
  const align = alignOf(settings)
  return (
    <Container
      as="section"
      maxW={readText(settings, 'width') === 'wide' ? '5xl' : '2xl'}
      px="0"
      mx={align === 'center' ? 'auto' : '0'}
    >
      <Stack gap="4">
        <SectionHeading align={align}>{readText(settings, 'heading')}</SectionHeading>
        <Paragraphs text={readText(settings, 'body')} align={align} />
      </Stack>
    </Container>
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
      <Stack gap="4">
        <SectionHeading>{readText(settings, 'heading')}</SectionHeading>
        <Paragraphs text={readText(settings, 'body')} />
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

  return (
    <Container as="section" maxW="3xl" px="0">
      <Stack gap="4">
        <SectionHeading>{readText(settings, 'heading')}</SectionHeading>
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
      </Stack>
    </Container>
  )
}

function Testimonials({ settings }: SectionProps) {
  const { frame } = useCardStyle()
  const empty = useEmptyText()
  const items = readList(settings, 'items').filter((item) => readText(item, 'quote'))

  return (
    <Stack as="section" gap="4">
      <SectionHeading>{readText(settings, 'heading')}</SectionHeading>
      {items.length === 0 ? (
        <EmptyNotice>{empty('items')}</EmptyNotice>
      ) : (
        <SimpleGrid columns={{ base: 1, md: Math.min(3, items.length) }} gap="4">
          {items.map((item) => (
            <Card.Root key={item.id} bg="bg.subtle" rounded="l3" {...frame}>
              <Card.Body gap="4">
                <Text fontSize="lg" lineHeight="tall">
                  “{readText(item, 'quote')}”
                </Text>
                <Box>
                  <Text fontWeight="semibold">{readText(item, 'author')}</Text>
                  {readText(item, 'role') && (
                    <Text fontSize="sm" color="fg.muted">
                      {readText(item, 'role')}
                    </Text>
                  )}
                </Box>
              </Card.Body>
            </Card.Root>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  )
}

/**
 * Every section type's renderer. `satisfies Record<SectionType, …>` is what
 * makes a schema without a renderer a compile error.
 */
export const SECTION_RENDERERS = {
  'announcement-bar': AnnouncementBar,
  hero: Hero,
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
