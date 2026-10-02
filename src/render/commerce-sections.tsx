/** Selling sections: one featured product, collection tabs, a countdown, voucher codes. */

import {
  AspectRatio,
  Badge,
  Box,
  Button,
  Grid,
  Heading,
  HStack,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
} from '@chakra-ui/react'
import { useState } from 'react'
import { LuCheck, LuCopy } from 'react-icons/lu'

import { ImageWithFallback } from '@repo/theme'

import { readBoolean, readDate, readList, readNumber, readText } from '../model/fields'
import { findProductCard, useRenderEnvironment } from './context'
import { useRenderText } from './copy'
import { useMounted, useNow } from './hooks'
import {
  ButtonRow,
  EditableText,
  EmptyNotice,
  ProductGrid,
  SectionHeading,
  ThemeButton,
  useCardStyle,
  WishlistButton,
} from './primitives'
import { alignOf, useEmptyText, type SectionProps } from './sections'

/* -------------------------------------------------------------------------- */
/* Featured product                                                           */
/* -------------------------------------------------------------------------- */

export function FeaturedProduct({ settings }: SectionProps) {
  const { data, formatPrice } = useRenderEnvironment()
  const text = useRenderText()
  const product = findProductCard(data, readText(settings, 'productId'))
  const [active, setActive] = useState(0)

  if (!product) return <EmptyNotice>{text('pickProduct')}</EmptyNotice>

  const images = product.imageUrls?.length ? product.imageUrls : [product.imageUrl]
  const cover = images[Math.min(active, images.length - 1)] ?? null
  const imageRight = readText(settings, 'imagePosition') === 'right'
  const eyebrow = readText(settings, 'eyebrow')
  const saving =
    product.compareAtPrice && product.compareAtPrice > product.price
      ? Math.round((1 - product.price / product.compareAtPrice) * 100)
      : 0

  return (
    <Grid
      as="section"
      templateColumns={{ base: '1fr', md: '1fr 1fr' }}
      gap={{ base: '6', md: '12' }}
      alignItems="center"
    >
      <Stack gap="3" order={{ base: 0, md: imageRight ? 1 : 0 }}>
        <Box position="relative" rounded="l3" overflow="hidden" bg="bg.subtle">
          <AspectRatio ratio={1}>
            <ImageWithFallback src={cover ?? undefined} alt={product.name} objectFit="cover" />
          </AspectRatio>
          <WishlistButton product={product} position="absolute" top="2" right="2" zIndex="1" />
        </Box>
        {images.length > 1 && (
          <HStack gap="2">
            {images.slice(0, 6).map((url, index) => (
              <Box
                key={`${url}-${index}`}
                as="button"
                boxSize="16"
                rounded="l2"
                overflow="hidden"
                borderWidth="2px"
                borderColor={index === active ? 'brand.solid' : 'transparent'}
                onClick={() => setActive(index)}
                aria-label={`${product.name} ${index + 1}`}
              >
                <ImageWithFallback
                  src={url ?? undefined}
                  alt=""
                  objectFit="cover"
                  w="full"
                  h="full"
                />
              </Box>
            ))}
          </HStack>
        )}
      </Stack>
      <Stack gap="4" align="start">
        {eyebrow && (
          <Text
            fontSize="sm"
            fontWeight="semibold"
            textTransform="uppercase"
            letterSpacing="0.08em"
            color="brand.fg"
          >
            <EditableText field="eyebrow" value={eyebrow} />
          </Text>
        )}
        <Heading as="h2" size={{ base: '2xl', md: '4xl' }} letterSpacing="-0.02em">
          {product.name}
        </Heading>
        <HStack gap="3" align="baseline" wrap="wrap">
          <Text fontSize="2xl" fontWeight="bold" fontVariantNumeric="tabular-nums">
            {formatPrice(product.price, data.shop.currency)}
          </Text>
          {product.compareAtPrice && (
            <Text color="fg.subtle" textDecoration="line-through">
              {formatPrice(product.compareAtPrice, data.shop.currency)}
            </Text>
          )}
          {saving > 0 && (
            <Badge colorPalette="red" variant="solid">
              {text('save', { n: saving })}
            </Badge>
          )}
        </HStack>
        {readBoolean(settings, 'showDescription') && product.description && (
          <Text color="fg.muted" lineHeight="tall" lineClamp={5} whiteSpace="pre-line">
            {product.description}
          </Text>
        )}
        <ThemeButton
          label={readText(settings, 'buttonLabel') || text('shopNow')}
          link={{ kind: 'product', slug: product.slug }}
        />
      </Stack>
    </Grid>
  )
}

/* -------------------------------------------------------------------------- */
/* Collection tabs                                                            */
/* -------------------------------------------------------------------------- */

export function CollectionTabs({ settings }: SectionProps) {
  const { data } = useRenderEnvironment()
  const text = useRenderText()
  const empty = useEmptyText()
  const limit = readNumber(settings, 'limit', 8)
  const tabs = readList(settings, 'tabs')
    .map((tab) => {
      const shelf = data.collections.find(
        (collection) => collection.id === readText(tab, 'collectionId'),
      )
      return shelf ? { id: tab.id, label: readText(tab, 'label') || shelf.name, shelf } : null
    })
    .filter((tab): tab is NonNullable<typeof tab> => tab !== null)

  // No tab picked yet: the shop's first collections, so a freshly added
  // section already shows something real.
  const shown =
    tabs.length > 0
      ? tabs
      : data.collections.slice(0, 3).map((shelf) => ({ id: shelf.id, label: shelf.name, shelf }))

  if (shown.length === 0) {
    return data.collections.length === 0 ? (
      <EmptyNotice>{empty('collections')}</EmptyNotice>
    ) : (
      <EmptyNotice>{text('pickCollections')}</EmptyNotice>
    )
  }

  return (
    <Stack as="section" gap="5">
      <Tabs.Root defaultValue={shown[0]!.id} variant="plain" lazyMount>
        <Stack gap="5">
          <Stack
            direction={{ base: 'column', md: 'row' }}
            justify="space-between"
            align={{ base: 'start', md: 'end' }}
            gap="3"
          >
            <SectionHeading field="heading">{readText(settings, 'heading')}</SectionHeading>
            <Tabs.List bg="bg.muted" rounded="full" p="1" gap="1" flexWrap="wrap">
              {shown.map((tab) => (
                <Tabs.Trigger
                  key={tab.id}
                  value={tab.id}
                  rounded="full"
                  px="4"
                  fontWeight="medium"
                  _selected={{ bg: 'bg', shadow: 'sm', color: 'fg' }}
                >
                  {tab.label}
                </Tabs.Trigger>
              ))}
              <Tabs.Indicator display="none" />
            </Tabs.List>
          </Stack>
          {shown.map((tab) => (
            <Tabs.Content key={tab.id} value={tab.id} p="0">
              {tab.shelf.products.length === 0 ? (
                <EmptyNotice>{empty('products')}</EmptyNotice>
              ) : (
                <ProductGrid
                  products={tab.shelf.products.slice(0, limit)}
                  columns={readText(settings, 'columns')}
                />
              )}
            </Tabs.Content>
          ))}
        </Stack>
      </Tabs.Root>
    </Stack>
  )
}

/* -------------------------------------------------------------------------- */
/* Countdown                                                                  */
/* -------------------------------------------------------------------------- */

function split(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  }
}

/**
 * Time left to a moment, in boxes. The digits only appear once the page is
 * live: rendered on the server they would be seconds out of date by the time
 * the browser hydrates them, and React would complain about every one.
 */
export function Countdown({ settings }: SectionProps) {
  const { mode } = useRenderEnvironment()
  const text = useRenderText()
  const mounted = useMounted()
  const now = useNow(1000)
  const end = readDate(settings, 'endsAt')
  const align = alignOf(settings)

  if (!end) return <EmptyNotice>{text('pickDate')}</EmptyNotice>

  const left = end.getTime() - now.getTime()
  if (left <= 0 && mounted) {
    if (readText(settings, 'afterEnd') !== 'message') {
      return mode === 'live' ? null : <EmptyNotice>{text('ended')}</EmptyNotice>
    }
    return (
      <Stack as="section" gap="3" align={align === 'center' ? 'center' : 'start'} textAlign={align}>
        <SectionHeading align={align}>{readText(settings, 'endedText')}</SectionHeading>
      </Stack>
    )
  }

  const parts = split(left)
  const units = [
    { value: parts.days, label: text('days') },
    { value: parts.hours, label: text('hours') },
    { value: parts.minutes, label: text('minutes') },
    { value: parts.seconds, label: text('seconds') },
  ]

  return (
    <Stack as="section" gap="5" align={align === 'center' ? 'center' : 'start'} textAlign={align}>
      <Stack gap="2" align={align === 'center' ? 'center' : 'start'}>
        <SectionHeading align={align} field="heading">
          {readText(settings, 'heading')}
        </SectionHeading>
        <EditableText
          as="p"
          field="subheading"
          value={readText(settings, 'subheading')}
          color="fg.muted"
        />
      </Stack>
      <HStack gap={{ base: '2', md: '3' }} role="timer" aria-live="off">
        {units.map((unit) => (
          <Stack
            key={unit.label}
            gap="1"
            align="center"
            minW={{ base: '16', md: '20' }}
            py={{ base: '3', md: '4' }}
            rounded="l3"
            bg="bg.panel"
            borderWidth="1px"
            borderColor="border.subtle"
          >
            <Text
              fontFamily="heading"
              fontSize={{ base: '2xl', md: '4xl' }}
              fontWeight="bold"
              lineHeight="1"
              fontVariantNumeric="tabular-nums"
            >
              {mounted ? String(unit.value).padStart(2, '0') : '––'}
            </Text>
            <Text fontSize="xs" color="fg.muted" textTransform="uppercase" letterSpacing="wide">
              {unit.label}
            </Text>
          </Stack>
        ))}
      </HStack>
      <ButtonRow settings={settings} align={align} />
    </Stack>
  )
}

/* -------------------------------------------------------------------------- */
/* Voucher codes                                                              */
/* -------------------------------------------------------------------------- */

export function PromoCodes({ settings }: SectionProps) {
  const { data, formatPrice } = useRenderEnvironment()
  const empty = useEmptyText()
  const items = readList(settings, 'items')

  const resolved = items
    .map((item) => {
      const voucherId = readText(item, 'voucherId')
      const voucher = voucherId ? data.vouchers?.find((v) => v.id === voucherId) : undefined
      const code = readText(item, 'code') || voucher?.code || ''
      if (!code) return null

      const title =
        readText(item, 'title') ||
        voucher?.name ||
        (voucher
          ? voucher.discountType === 'percentage'
            ? `${voucher.discountValue}% off`
            : formatPrice(voucher.discountValue, data.shop.currency)
          : '')

      const terms =
        readText(item, 'terms') ||
        voucher?.description ||
        (voucher?.minOrderAmount
          ? `Min. spend ${formatPrice(voucher.minOrderAmount, data.shop.currency)}`
          : '')

      return {
        id: item.id,
        code,
        title,
        terms,
      }
    })
    .filter((v): v is NonNullable<typeof v> => v !== null)

  const shown =
    resolved.length > 0
      ? resolved
      : (data.vouchers ?? []).slice(0, 3).map((v) => ({
          id: v.id,
          code: v.code,
          title:
            v.name ||
            (v.discountType === 'percentage'
              ? `${v.discountValue}% off`
              : formatPrice(v.discountValue, data.shop.currency)),
          terms:
            v.description ||
            (v.minOrderAmount
              ? `Min. spend ${formatPrice(v.minOrderAmount, data.shop.currency)}`
              : ''),
        }))

  return (
    <Stack as="section" gap="4">
      <SectionHeading field="heading">{readText(settings, 'heading')}</SectionHeading>
      {shown.length === 0 ? (
        <EmptyNotice>{empty('items')}</EmptyNotice>
      ) : (
        <SimpleGrid columns={{ base: 1, sm: 2, lg: Math.min(3, shown.length) }} gap="3">
          {shown.map((item) => (
            <VoucherCard key={item.id} code={item.code} title={item.title} terms={item.terms} />
          ))}
        </SimpleGrid>
      )}
    </Stack>
  )
}

/** A ticket-shaped voucher with a copy button — notched edges, a dashed tear line. */
function VoucherCard({ code, title, terms }: { code: string; title: string; terms: string }) {
  const { mode } = useRenderEnvironment()
  const { frame } = useCardStyle()
  const text = useRenderText()
  const [copied, setCopied] = useState(false)

  const notch = {
    content: '""',
    position: 'absolute',
    top: '50%',
    boxSize: '5',
    rounded: 'full',
    // The surface around the card — the page, or the scheme band it sits in.
    bg: 'bg',
    transform: 'translateY(-50%)',
  } as const

  return (
    <Box
      display="flex"
      alignItems="center"
      position="relative"
      rounded="l3"
      bg="brand.subtle"
      overflow="hidden"
      {...frame}
      borderStyle="dashed"
      borderWidth="1px"
      borderColor="brand.muted"
      css={{ '&::before': { ...notch, left: '-10px' }, '&::after': { ...notch, right: '-10px' } }}
    >
      <Stack gap="1" flex="1" minW="0" p="4" pl="6">
        {title && (
          <Text fontWeight="semibold" lineClamp={2}>
            {title}
          </Text>
        )}
        {terms && (
          <Text fontSize="xs" color="fg.muted" lineClamp={2}>
            {terms}
          </Text>
        )}
        <Text
          fontFamily="mono"
          fontWeight="bold"
          fontSize="lg"
          letterSpacing="0.08em"
          color="brand.fg"
        >
          {code}
        </Text>
      </Stack>
      <Box
        borderLeftWidth="1px"
        borderStyle="dashed"
        borderColor="brand.muted"
        alignSelf="stretch"
      />
      <Box p="4" pr="6">
        <Button
          size="sm"
          colorPalette="brand"
          variant={copied ? 'subtle' : 'solid'}
          rounded="full"
          onClick={async (event) => {
            if (mode === 'preview') return
            const view = event.currentTarget.ownerDocument.defaultView
            try {
              await view?.navigator.clipboard.writeText(code)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            } catch {
              // Clipboard refused (an old browser, an insecure page): the code
              // is on screen to copy by hand.
            }
          }}
        >
          {copied ? <LuCheck /> : <LuCopy />}
          {copied ? text('copied') : text('copy')}
        </Button>
      </Box>
    </Box>
  )
}
