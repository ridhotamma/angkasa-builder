/**
 * The Quick Checkout page, drawn from its content.
 *
 * One component serves both places the page appears: the storefront's
 * `/link` route (`mode: 'live'`) and the dashboard editor's phone preview
 * (`mode: 'preview'`, where nothing navigates and the buy buttons only show
 * what the shopper would tap). Everything it needs arrives as props —
 * products already resolved and priced by the caller, image URLs built by the
 * caller's own helper — so the package stays free of Appwrite and of either
 * app's routing.
 *
 * Colours come from `qcPalette`, never straight from the stored values: that
 * is where unreadable combinations are repaired.
 */

import { AspectRatio, Box, chakra, Flex, Grid, Heading, Icon, Stack, Text } from '@chakra-ui/react'
import type { ComponentProps, ReactNode } from 'react'
import {
  FaFacebookF,
  FaInstagram,
  FaLinkedinIn,
  FaSpotify,
  FaTelegram,
  FaThreads,
  FaTiktok,
  FaWhatsapp,
  FaXTwitter,
  FaYoutube,
} from 'react-icons/fa6'
import type { IconType } from 'react-icons'
import {
  LuArrowUpRight,
  LuGlobe,
  LuImage,
  LuMail,
  LuMapPin,
  LuPackageOpen,
  LuPhone,
  LuShoppingBag,
  LuStore,
} from 'react-icons/lu'
import { SiShopee } from 'react-icons/si'

import { Image } from '@repo/theme'

import { contrastRatio, mix, readableOn } from '../model/settings'
import { boldButton, boldCard } from '../render/bold'
import {
  QC_AUTO_PRODUCTS,
  QC_RADIUS_PX,
  QC_SOCIAL_LABELS,
  qcFloatingWhatsapp,
  qcFontStacks,
  qcFontsHref,
  qcPalette,
  socialHref,
  whatsappHref,
  youtubeId,
  type QcBlock,
  type QcContactBlock,
  type QcLayout,
  type QcLinksBlock,
  type QcPalette,
  type QcProductsBlock,
  type QcSocialPlatform,
  type QcSocialsBlock,
  type QcStyle,
  type QuickCheckoutContent,
} from './model'

/** One product as the page draws it, priced by the caller. */
export interface QcProductView {
  id: string
  slug: string
  name: string
  imageUrl: string | null
  /** What the shopper pays now: a live sale event's price when there is one. */
  price: number
  compareAtPrice: number | null
  soldOut: boolean
  hasVariants: boolean
}

export type QcLinkKind = 'link' | 'social' | 'whatsapp' | 'email' | 'phone' | 'image'

export interface QuickCheckoutPageProps {
  content: QuickCheckoutContent
  /** The products the page names, by id. Missing ids are not drawn. */
  products: Record<string, QcProductView>
  /** The shop's newest live products, for a products block with none picked. */
  autoProducts: QcProductView[]
  imageUrl: (fileId: string | null, size: { width?: number; height?: number }) => string | null
  formatPrice: (amount: number) => string
  locale: 'en' | 'id'
  /** The shop's name, when the profile leaves its own blank. */
  fallbackName: string
  mode: 'live' | 'preview'
  /** Tapping a product. Absent in the preview. */
  onBuy?: (product: QcProductView) => void
  /** Every outbound tap, for the caller's analytics. */
  onLinkClick?: (kind: QcLinkKind, href: string) => void
  /** Drawn under the last block — the platform's credit on the storefront. */
  footer?: ReactNode
}

const COPY = {
  en: {
    buy: 'Buy now',
    choose: 'Choose',
    soldOut: 'Sold out',
    whatsapp: 'Chat on WhatsApp',
    email: 'Send an email',
    call: 'Call us',
    emptyProducts: 'Pick products in the editor, or publish some — the newest show here.',
    emptyLinks: 'Add a link with an address to show it.',
    emptyImage: 'Upload an image',
    emptyVideo: 'Paste a YouTube link',
    save: 'Save',
  },
  id: {
    buy: 'Beli sekarang',
    choose: 'Pilih',
    soldOut: 'Habis',
    whatsapp: 'Chat WhatsApp',
    email: 'Kirim email',
    call: 'Telepon',
    emptyProducts: 'Pilih produk di editor, atau terbitkan produk — yang terbaru tampil di sini.',
    emptyLinks: 'Isi alamat tautan agar tampil.',
    emptyImage: 'Unggah gambar',
    emptyVideo: 'Tempel tautan YouTube',
    save: 'Hemat',
  },
} as const

type Copy = (typeof COPY)[keyof typeof COPY]

/**
 * Wider than a phone: a tablet or a desktop window on the live page.
 *
 * A container query, not a viewport breakpoint, on purpose: the same page is
 * drawn inside the editor's 360px phone on a desktop screen, where a `md:`
 * prop would wrongly switch it to its wide look. The container is the page's
 * own width, wherever it is drawn.
 */
const WIDE = '@container (min-width: 768px)'

const SOCIAL_ICONS: Record<QcSocialPlatform, IconType> = {
  instagram: FaInstagram,
  tiktok: FaTiktok,
  youtube: FaYoutube,
  facebook: FaFacebookF,
  x: FaXTwitter,
  threads: FaThreads,
  shopee: SiShopee,
  tokopedia: LuStore,
  telegram: FaTelegram,
  linkedin: FaLinkedinIn,
  spotify: FaSpotify,
  website: LuGlobe,
}

/** Everything a block needs to draw itself, worked out once per render. */
interface Frame {
  style: QcStyle
  palette: QcPalette
  radius: (typeof QC_RADIUS_PX)[keyof typeof QC_RADIUS_PX]
  fonts: { heading: string; body: string }
  copy: Copy
  props: QuickCheckoutPageProps
}

export function QuickCheckoutPage(props: QuickCheckoutPageProps) {
  const { content, mode, imageUrl } = props
  const { style } = content
  const palette = qcPalette(
    style,
    style.background.kind === 'image'
      ? imageUrl(style.background.imageFileId, { width: 1200 })
      : null,
  )
  const frame: Frame = {
    style,
    palette,
    radius: QC_RADIUS_PX[style.radius],
    fonts: qcFontStacks(style),
    copy: COPY[props.locale],
    props,
  }
  const fontsHref = qcFontsHref(style)
  const floating = qcFloatingWhatsapp(content)
  const floatingHref = floating ? whatsappHref(floating.number, floating.message) : null
  const blocks = content.blocks.filter((block) => block.visible)

  return (
    <Box
      position="relative"
      minH={mode === 'live' ? '100dvh' : 'full'}
      color={palette.pageText}
      fontFamily={frame.fonts.body}
      style={{ background: palette.pageBackground }}
      css={{
        '& *:focus-visible': { outline: `2px solid ${palette.accent}`, outlineOffset: '2px' },
      }}
    >
      {/* React hoists a stylesheet link with a precedence into <head>, on the
          server's first pass and in the editor alike. */}
      {fontsHref && <link rel="stylesheet" href={fontsHref} precedence="default" />}

      {/* The width the `WIDE` query measures. Nothing fixed-position lives
          inside it: a size container is the containing block of a fixed
          element, which would pin the WhatsApp bubble to the page's end. */}
      <Box css={{ containerType: 'inline-size' }}>
        <Box
          maxW="480px"
          mx="auto"
          px={style.layout === 'hero' ? '0' : '5'}
          pt={style.layout === 'hero' ? '0' : '10'}
          pb="12"
          css={{
            [WIDE]: {
              maxWidth: '600px',
              paddingTop: style.layout === 'hero' ? '40px' : '64px',
              paddingBottom: '64px',
            },
          }}
        >
          <ProfileHeader frame={frame} />

          <Stack gap="5" mt="7" px={style.layout === 'hero' ? '5' : '0'}>
            {blocks.map((block, index) => (
              <Box
                key={block.id}
                animationName="fade-in, slide-from-bottom"
                animationDuration="0.45s"
                animationTimingFunction="ease-out"
                animationFillMode="backwards"
                animationDelay={`${Math.min(index, 8) * 60}ms`}
                _motionReduce={{ animation: 'none' }}
              >
                <BlockView block={block} frame={frame} />
              </Box>
            ))}
          </Stack>

          {props.footer && (
            <Box mt="12" textAlign="center" fontSize="xs" color={palette.pageMuted} px="5">
              {props.footer}
            </Box>
          )}
        </Box>
      </Box>

      {floatingHref && (
        <chakra.a
          href={mode === 'live' ? floatingHref : undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={frame.copy.whatsapp}
          onClick={() => props.onLinkClick?.('whatsapp', floatingHref)}
          position={mode === 'live' ? 'fixed' : 'absolute'}
          right="4"
          bottom="4"
          boxSize="14"
          rounded="full"
          bg="#25d366"
          color="white"
          display="flex"
          alignItems="center"
          justifyContent="center"
          boxShadow="0 8px 24px rgba(0,0,0,0.22)"
          zIndex="sticky"
          transition="transform 0.15s ease"
          _hover={{ transform: 'scale(1.06)' }}
        >
          <Icon as={FaWhatsapp} boxSize="7" />
        </chakra.a>
      )}
    </Box>
  )
}

/* -------------------------------------------------------------------------- */
/* Profile                                                                    */
/* -------------------------------------------------------------------------- */

function ProfileHeader({ frame }: { frame: Frame }) {
  const { style, palette, fonts, props } = frame
  const { profile } = props.content
  const name = profile.name || props.fallbackName
  const avatar = props.imageUrl(profile.avatarFileId, { width: 240, height: 240 })
  const layout = style.layout

  const avatarNode = (size: string) => (
    <Box
      boxSize={size}
      rounded="full"
      overflow="hidden"
      flexShrink="0"
      bg={palette.accent}
      color={palette.accentText}
      display="flex"
      alignItems="center"
      justifyContent="center"
      borderWidth="3px"
      borderColor={palette.backdrop}
      boxShadow="0 6px 20px rgba(0,0,0,0.12)"
    >
      {avatar ? (
        <Image src={avatar} alt="" boxSize="full" objectFit="cover" />
      ) : (
        <Text fontFamily={fonts.heading} fontWeight="bold" fontSize="2xl">
          {initials(name)}
        </Text>
      )}
    </Box>
  )

  const nameNode = (
    <Heading
      as="h1"
      fontFamily={fonts.heading}
      fontSize={layout === 'minimal' ? 'xl' : '2xl'}
      fontWeight="bold"
      lineHeight="1.15"
      letterSpacing="-0.01em"
      color={palette.pageText}
    >
      {name}
    </Heading>
  )

  const location = profile.location && (
    <Flex align="center" gap="1" fontSize="sm" color={palette.pageMuted}>
      <Icon as={LuMapPin} boxSize="3.5" />
      <Text>{profile.location}</Text>
    </Flex>
  )

  const bio = profile.bio && (
    <Text fontSize="sm" lineHeight="1.6" color={palette.pageMuted} whiteSpace="pre-line">
      {profile.bio}
    </Text>
  )

  if (layout === 'hero') {
    const cover = props.imageUrl(profile.coverFileId, { width: 960, height: 400 })
    return (
      <Box>
        <Box
          h="180px"
          // On a wide page the banner is a card in the column, not a strip
          // across the top of the window.
          css={{
            [WIDE]: { height: '240px', marginInline: '20px', borderRadius: frame.radius.card },
          }}
          style={{
            background: cover
              ? `url("${cover.replace(/"/g, '%22')}") center / cover no-repeat`
              : `linear-gradient(135deg, ${palette.accent}, ${mix(palette.accent, palette.backdrop, 0.6)})`,
          }}
        />
        <Stack gap="2" px="5" mt="-12">
          {avatarNode('24')}
          {nameNode}
          {location}
          {bio}
        </Stack>
      </Box>
    )
  }

  if (layout === 'minimal') {
    return (
      <Stack gap="3">
        <Flex align="center" gap="3">
          {avatarNode('16')}
          <Stack gap="0.5" minW="0">
            {nameNode}
            {location}
          </Stack>
        </Flex>
        {bio}
      </Stack>
    )
  }

  return (
    <Stack gap="2" align="center" textAlign="center">
      {avatarNode('24')}
      <Box mt="1">{nameNode}</Box>
      {location}
      {bio}
    </Stack>
  )
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return (
    words.length > 1 ? `${words[0]![0]}${words[1]![0]}` : (words[0]?.slice(0, 2) ?? '')
  ).toUpperCase()
}

/* -------------------------------------------------------------------------- */
/* Surfaces                                                                   */
/* -------------------------------------------------------------------------- */

/** The card every block sits on, in the page's card style. */
function cardProps(frame: Frame) {
  const { style, palette, radius } = frame
  const base = {
    bg: palette.card,
    color: palette.cardText,
    borderRadius: radius.card,
  }
  switch (style.cardStyle) {
    case 'glass':
      return {
        ...base,
        borderWidth: '1px',
        borderColor: palette.cardBorder,
        backdropFilter: 'blur(14px)',
      }
    case 'outline':
      return { ...base, borderWidth: '1.5px', borderColor: palette.cardBorder }
    case 'hard':
      return { ...base, ...boldCard(palette.cardBorder) }
    default:
      return { ...base, boxShadow: '0 1px 2px rgba(0,0,0,0.05), 0 6px 20px rgba(0,0,0,0.06)' }
  }
}

/**
 * A button on a card, in the page's button style. `emphasis` is the accent
 * fill; without it the button is the quiet card-coloured variant (a link that
 * is not highlighted).
 */
function buttonProps(frame: Frame, emphasis = true) {
  const { style, palette, radius } = frame
  const cardBase = style.cardStyle === 'outline' ? style.background.color : style.surface

  if (!emphasis) {
    return {
      ...cardProps(frame),
      borderRadius: radius.button,
    }
  }

  const common = {
    borderRadius: radius.button,
    fontWeight: 'semibold',
    transition: 'transform 0.12s ease, box-shadow 0.12s ease, filter 0.12s ease',
  }
  switch (style.buttonStyle) {
    case 'soft': {
      const bg = mix(palette.accent, cardBase, 0.82)
      const color =
        contrastRatio(palette.accent, bg) >= 4.5
          ? palette.accent
          : mix(palette.accent, readableOn(bg), 0.6)
      return { ...common, bg, color, _hover: { filter: 'brightness(0.97)' } }
    }
    case 'outline':
      return {
        ...common,
        bg: 'transparent',
        color: palette.accentOnCard,
        borderWidth: '2px',
        borderColor: palette.accentOnCard,
        _hover: { bg: mix(palette.accentOnCard, cardBase, 0.9) },
      }
    case 'hard':
      return {
        ...common,
        bg: palette.accent,
        color: palette.accentText,
        ...boldButton(palette.cardText),
      }
    default:
      return {
        ...common,
        bg: palette.accent,
        color: palette.accentText,
        _hover: { filter: 'brightness(1.06)' },
        _active: { transform: 'scale(0.98)' },
      }
  }
}

function BlockTitle({ frame, children }: { frame: Frame; children: ReactNode }) {
  return (
    <Heading
      as="h2"
      fontFamily={frame.fonts.heading}
      fontSize="md"
      fontWeight="bold"
      color={frame.palette.pageText}
      textAlign={
        frame.style.layout === 'minimal' || frame.style.layout === 'hero' ? 'left' : 'center'
      }
      mb="3"
    >
      {children}
    </Heading>
  )
}

function EmptyHint({
  frame,
  icon,
  children,
}: {
  frame: Frame
  icon: IconType
  children: ReactNode
}) {
  if (frame.props.mode !== 'preview') return null
  return (
    <Flex
      direction="column"
      align="center"
      gap="2"
      p="5"
      textAlign="center"
      fontSize="xs"
      borderWidth="1.5px"
      borderStyle="dashed"
      borderColor={frame.palette.pageMuted}
      color={frame.palette.pageMuted}
      borderRadius={frame.radius.card}
    >
      <Icon as={icon} boxSize="5" />
      <Text>{children}</Text>
    </Flex>
  )
}

/* -------------------------------------------------------------------------- */
/* Blocks                                                                     */
/* -------------------------------------------------------------------------- */

function BlockView({ block, frame }: { block: QcBlock; frame: Frame }) {
  switch (block.type) {
    case 'products':
      return <ProductsBlock block={block} frame={frame} />
    case 'links':
      return <LinksBlock block={block} frame={frame} />
    case 'socials':
      return <SocialsBlock block={block} frame={frame} />
    case 'contact':
      return <ContactBlock block={block} frame={frame} />
    case 'text':
      return (
        <Stack gap="2" textAlign={block.align} px="1">
          {block.title && (
            <Heading as="h2" fontFamily={frame.fonts.heading} fontSize="lg" fontWeight="bold">
              {block.title}
            </Heading>
          )}
          {block.body && (
            <Text
              fontSize="sm"
              lineHeight="1.7"
              color={frame.palette.pageMuted}
              whiteSpace="pre-line"
            >
              {block.body}
            </Text>
          )}
        </Stack>
      )
    case 'image': {
      const src = frame.props.imageUrl(block.imageFileId, { width: 960 })
      if (!src)
        return (
          <EmptyHint frame={frame} icon={LuImage}>
            {frame.copy.emptyImage}
          </EmptyHint>
        )
      const image = (
        <Image
          src={src}
          alt={block.alt}
          w="full"
          borderRadius={frame.radius.card}
          display="block"
          loading="lazy"
        />
      )
      return block.url ? (
        <OutboundLink frame={frame} kind="image" href={block.url} display="block">
          {image}
        </OutboundLink>
      ) : (
        image
      )
    }
    case 'video': {
      const id = youtubeId(block.url)
      return (
        <Stack gap="0">
          {block.title && <BlockTitle frame={frame}>{block.title}</BlockTitle>}
          {id ? (
            <AspectRatio
              ratio={16 / 9}
              borderRadius={frame.radius.card}
              overflow="hidden"
              bg="black"
            >
              <chakra.iframe
                src={`https://www.youtube-nocookie.com/embed/${id}`}
                title={block.title || 'YouTube'}
                loading="lazy"
                allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                border="0"
                pointerEvents={frame.props.mode === 'preview' ? 'none' : undefined}
              />
            </AspectRatio>
          ) : (
            <EmptyHint frame={frame} icon={FaYoutube}>
              {frame.copy.emptyVideo}
            </EmptyHint>
          )}
        </Stack>
      )
    }
  }
}

/** An `<a>` that only navigates on the live page, and reports the tap. */
function OutboundLink({
  frame,
  kind,
  href,
  children,
  ...rest
}: {
  frame: Frame
  kind: QcLinkKind
  href: string
  children: ReactNode
} & Omit<ComponentProps<typeof chakra.a>, 'href' | 'children'>) {
  const live = frame.props.mode === 'live'
  const external = /^https?:/.test(href)
  return (
    <chakra.a
      href={live ? href : undefined}
      target={live && external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      cursor="pointer"
      onClick={() => frame.props.onLinkClick?.(kind, href)}
      {...rest}
    >
      {children}
    </chakra.a>
  )
}

function ProductsBlock({ block, frame }: { block: QcProductsBlock; frame: Frame }) {
  const { props } = frame
  const products =
    block.productIds.length > 0
      ? block.productIds.flatMap((id) => (props.products[id] ? [props.products[id]] : []))
      : props.autoProducts.slice(0, QC_AUTO_PRODUCTS)

  return (
    <Box>
      {block.title && <BlockTitle frame={frame}>{block.title}</BlockTitle>}
      {products.length === 0 ? (
        <EmptyHint frame={frame} icon={LuPackageOpen}>
          {frame.copy.emptyProducts}
        </EmptyHint>
      ) : (
        <ProductList products={products} layout={frame.style.layout} frame={frame} />
      )}
    </Box>
  )
}

function ProductList({
  products,
  layout,
  frame,
}: {
  products: QcProductView[]
  layout: QcLayout
  frame: Frame
}) {
  if (layout === 'grid') {
    return (
      <Grid
        templateColumns="repeat(2, minmax(0, 1fr))"
        gap="3"
        css={{ [WIDE]: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px' } }}
      >
        {products.map((product) => (
          <ProductTile key={product.id} product={product} frame={frame} />
        ))}
      </Grid>
    )
  }
  if (layout === 'hero') {
    return (
      // Two large cards a row on a wide page: one would be a 450px-tall photo.
      <Stack
        gap="4"
        css={{
          [WIDE]: {
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '16px',
          },
        }}
      >
        {products.map((product) => (
          <ProductFeature key={product.id} product={product} frame={frame} />
        ))}
      </Stack>
    )
  }
  return (
    <Stack gap="3">
      {products.map((product) => (
        <ProductRow
          key={product.id}
          product={product}
          frame={frame}
          compact={layout === 'minimal'}
        />
      ))}
    </Stack>
  )
}

function buyAction(frame: Frame, product: QcProductView) {
  const { onBuy, mode } = frame.props
  const disabled = product.soldOut
  return {
    disabled,
    onClick: () => {
      if (!disabled && mode === 'live') onBuy?.(product)
    },
    label: product.soldOut
      ? frame.copy.soldOut
      : product.hasVariants
        ? frame.copy.choose
        : frame.copy.buy,
  }
}

function Price({
  product,
  frame,
  size = 'sm',
}: {
  product: QcProductView
  frame: Frame
  size?: string
}) {
  const { palette, props } = frame
  const discounted = product.compareAtPrice != null && product.compareAtPrice > product.price
  return (
    <Flex align="baseline" gap="1.5" wrap="wrap">
      <Text
        fontWeight="bold"
        fontSize={size}
        color={palette.accentOnCard}
        fontVariantNumeric="tabular-nums"
      >
        {props.formatPrice(product.price)}
      </Text>
      {discounted && (
        <Text
          fontSize="xs"
          color={palette.cardMuted}
          textDecoration="line-through"
          fontVariantNumeric="tabular-nums"
        >
          {props.formatPrice(product.compareAtPrice!)}
        </Text>
      )}
    </Flex>
  )
}

function ProductImage({ product, frame }: { product: QcProductView; frame: Frame }) {
  return product.imageUrl ? (
    <Image
      src={product.imageUrl}
      alt={product.name}
      boxSize="full"
      objectFit="cover"
      loading="lazy"
    />
  ) : (
    <Flex
      boxSize="full"
      align="center"
      justify="center"
      bg={mix(frame.palette.accent, frame.style.surface, 0.85)}
    >
      <Icon as={LuShoppingBag} boxSize="6" color={frame.palette.accentOnCard} />
    </Flex>
  )
}

function SoldOutVeil({ frame }: { frame: Frame }) {
  return (
    <Flex
      position="absolute"
      inset="0"
      align="center"
      justify="center"
      bg="rgba(0,0,0,0.45)"
      color="white"
      fontSize="xs"
      fontWeight="bold"
      textTransform="uppercase"
      letterSpacing="0.06em"
    >
      {frame.copy.soldOut}
    </Flex>
  )
}

function ProductRow({
  product,
  frame,
  compact,
}: {
  product: QcProductView
  frame: Frame
  compact: boolean
}) {
  const buy = buyAction(frame, product)
  return (
    <chakra.button
      type="button"
      onClick={buy.onClick}
      aria-disabled={buy.disabled}
      display="flex"
      alignItems="center"
      gap="3"
      w="full"
      p="2.5"
      textAlign="left"
      cursor={buy.disabled ? 'not-allowed' : 'pointer'}
      transition="transform 0.12s ease"
      _hover={buy.disabled ? undefined : { transform: 'translateY(-1px)' }}
      {...cardProps(frame)}
    >
      <Box
        position="relative"
        boxSize={compact ? '12' : '16'}
        flexShrink="0"
        overflow="hidden"
        borderRadius={frame.radius.image}
      >
        <ProductImage product={product} frame={frame} />
        {product.soldOut && <SoldOutVeil frame={frame} />}
      </Box>
      <Stack gap="0.5" flex="1" minW="0">
        <Text fontWeight="semibold" fontSize="sm" lineClamp={2} lineHeight="1.3">
          {product.name}
        </Text>
        <Price product={product} frame={frame} />
      </Stack>
      <Box
        as="span"
        flexShrink="0"
        px="3.5"
        py="2"
        fontSize="xs"
        whiteSpace="nowrap"
        opacity={buy.disabled ? 0.5 : 1}
        {...buttonProps(frame)}
      >
        {buy.label}
      </Box>
    </chakra.button>
  )
}

function ProductTile({ product, frame }: { product: QcProductView; frame: Frame }) {
  const buy = buyAction(frame, product)
  return (
    <chakra.button
      type="button"
      onClick={buy.onClick}
      aria-disabled={buy.disabled}
      display="flex"
      flexDirection="column"
      textAlign="left"
      overflow="hidden"
      cursor={buy.disabled ? 'not-allowed' : 'pointer'}
      transition="transform 0.12s ease"
      _hover={buy.disabled ? undefined : { transform: 'translateY(-2px)' }}
      {...cardProps(frame)}
    >
      <AspectRatio ratio={1} w="full" position="relative">
        <Box>
          <ProductImage product={product} frame={frame} />
          {product.soldOut && <SoldOutVeil frame={frame} />}
        </Box>
      </AspectRatio>
      <Stack gap="1.5" p="3" flex="1" w="full">
        <Text fontWeight="semibold" fontSize="sm" lineClamp={2} lineHeight="1.3" minH="2lh">
          {product.name}
        </Text>
        <Price product={product} frame={frame} />
        <Box
          as="span"
          mt="auto"
          py="2"
          fontSize="xs"
          textAlign="center"
          opacity={buy.disabled ? 0.5 : 1}
          {...buttonProps(frame)}
        >
          {buy.label}
        </Box>
      </Stack>
    </chakra.button>
  )
}

function ProductFeature({ product, frame }: { product: QcProductView; frame: Frame }) {
  const buy = buyAction(frame, product)
  const discount =
    product.compareAtPrice != null && product.compareAtPrice > product.price
      ? Math.round((1 - product.price / product.compareAtPrice) * 100)
      : 0
  return (
    <chakra.button
      type="button"
      onClick={buy.onClick}
      aria-disabled={buy.disabled}
      // A flex column rather than a block: the grid stretches every card in a
      // row to the tallest one, and a button's own layout vertically centres
      // its content — a short product name would push the image down instead
      // of leaving the spare space at the foot of the card.
      display="flex"
      flexDirection="column"
      w="full"
      textAlign="left"
      overflow="hidden"
      cursor={buy.disabled ? 'not-allowed' : 'pointer'}
      {...cardProps(frame)}
    >
      <AspectRatio ratio={4 / 3} w="full">
        <Box position="relative">
          <ProductImage product={product} frame={frame} />
          {product.soldOut && <SoldOutVeil frame={frame} />}
          {discount > 0 && !product.soldOut && (
            <Box
              position="absolute"
              top="3"
              left="3"
              px="2.5"
              py="1"
              fontSize="xs"
              fontWeight="bold"
              bg={frame.palette.accent}
              color={frame.palette.accentText}
              borderRadius={frame.radius.button}
            >
              {frame.copy.save} {discount}%
            </Box>
          )}
        </Box>
      </AspectRatio>
      <Stack gap="2" p="4" flex="1">
        <Text fontFamily={frame.fonts.heading} fontWeight="bold" fontSize="lg" lineHeight="1.25">
          {product.name}
        </Text>
        <Price product={product} frame={frame} size="md" />
        <Box
          as="span"
          mt="auto"
          py="3"
          fontSize="sm"
          textAlign="center"
          opacity={buy.disabled ? 0.5 : 1}
          {...buttonProps(frame)}
        >
          {buy.label}
        </Box>
      </Stack>
    </chakra.button>
  )
}

function LinksBlock({ block, frame }: { block: QcLinksBlock; frame: Frame }) {
  const items = block.items.filter((item) => item.url && item.label)
  return (
    <Box>
      {block.title && <BlockTitle frame={frame}>{block.title}</BlockTitle>}
      {items.length === 0 ? (
        <EmptyHint frame={frame} icon={LuArrowUpRight}>
          {frame.copy.emptyLinks}
        </EmptyHint>
      ) : (
        <Stack gap="3">
          {items.map((item) => (
            <OutboundLink
              key={item.id}
              frame={frame}
              kind="link"
              href={item.url}
              display="flex"
              alignItems="center"
              justifyContent="center"
              position="relative"
              minH="14"
              px="12"
              py="3"
              fontSize="sm"
              fontWeight="semibold"
              textAlign="center"
              transition="transform 0.12s ease"
              _hover={{ transform: 'translateY(-1px)' }}
              {...buttonProps(frame, item.highlight)}
            >
              {item.label}
              <Icon as={LuArrowUpRight} position="absolute" right="4" boxSize="4" opacity={0.6} />
            </OutboundLink>
          ))}
        </Stack>
      )}
    </Box>
  )
}

function SocialsBlock({ block, frame }: { block: QcSocialsBlock; frame: Frame }) {
  const items = block.items.flatMap((item) => {
    const href = socialHref(item.platform, item.value)
    return href ? [{ ...item, href }] : []
  })
  if (items.length === 0) return null
  const left = frame.style.layout === 'minimal' || frame.style.layout === 'hero'
  return (
    <Flex gap="2.5" wrap="wrap" justify={left ? 'flex-start' : 'center'}>
      {items.map((item) => (
        <OutboundLink
          key={item.platform}
          frame={frame}
          kind="social"
          href={item.href}
          aria-label={QC_SOCIAL_LABELS[item.platform]}
          title={QC_SOCIAL_LABELS[item.platform]}
          boxSize="11"
          display="flex"
          alignItems="center"
          justifyContent="center"
          transition="transform 0.12s ease"
          _hover={{ transform: 'translateY(-2px)' }}
          {...cardProps(frame)}
          borderRadius="full"
        >
          <Icon as={SOCIAL_ICONS[item.platform]} boxSize="5" />
        </OutboundLink>
      ))}
    </Flex>
  )
}

function ContactBlock({ block, frame }: { block: QcContactBlock; frame: Frame }) {
  const whatsapp = whatsappHref(block.whatsapp, block.whatsappMessage)
  const phone = block.phone.replace(/[^\d+]/g, '')
  const rows: Array<{
    kind: QcLinkKind
    href: string
    icon: IconType
    label: string
    detail: string
    emphasis: boolean
  }> = []
  if (whatsapp) {
    rows.push({
      kind: 'whatsapp',
      href: whatsapp,
      icon: FaWhatsapp,
      label: frame.copy.whatsapp,
      detail: block.whatsapp,
      emphasis: true,
    })
  }
  if (block.email) {
    rows.push({
      kind: 'email',
      href: `mailto:${block.email}`,
      icon: LuMail,
      label: frame.copy.email,
      detail: block.email,
      emphasis: false,
    })
  }
  if (phone.length >= 6) {
    rows.push({
      kind: 'phone',
      href: `tel:${phone}`,
      icon: LuPhone,
      label: frame.copy.call,
      detail: block.phone,
      emphasis: false,
    })
  }
  if (rows.length === 0) return null

  return (
    <Box>
      {block.title && <BlockTitle frame={frame}>{block.title}</BlockTitle>}
      <Stack gap="2.5">
        {rows.map((row) => (
          <OutboundLink
            key={row.kind}
            frame={frame}
            kind={row.kind}
            href={row.href}
            display="flex"
            alignItems="center"
            gap="3"
            px="4"
            py="3"
            transition="transform 0.12s ease"
            _hover={{ transform: 'translateY(-1px)' }}
            {...buttonProps(frame, row.emphasis)}
          >
            <Icon as={row.icon} boxSize="5" flexShrink="0" />
            <Stack gap="0" flex="1" minW="0">
              <Text fontSize="sm" fontWeight="semibold">
                {row.label}
              </Text>
              <Text fontSize="xs" opacity={0.75} truncate>
                {row.detail}
              </Text>
            </Stack>
            <Icon as={LuArrowUpRight} boxSize="4" opacity={0.6} />
          </OutboundLink>
        ))}
      </Stack>
    </Box>
  )
}
