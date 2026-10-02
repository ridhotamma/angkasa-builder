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
  HStack,
  Link as ChakraLink,
  SimpleGrid,
  Stack,
  Text,
  type BoxProps,
  type LinkProps,
} from '@chakra-ui/react'
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type MouseEvent,
  type ReactNode,
} from 'react'

import { ImageWithFallback } from '@repo/theme'

import { readLink, readText, type FieldValues } from '../model/fields'
import type { Link } from '../model/links'
import type { ButtonStyle, CardStyle } from '../model/settings'
import type { SectionHeadline } from '../model/section-style'
import { useRenderEnvironment, type StorefrontProductCard } from './context'
import { Magnetic, SplitText } from './motion'

/**
 * Props for every dialog and drawer a section opens (photo viewer, size
 * guide, mobile menu).
 *
 * In the editor they must not be modal. A modal overlay sets
 * `pointer-events: none` on its document's body and restores it on close,
 * except while any other modal is still open. Zag keeps one layer stack for
 * every document, so the editor's own full-screen dialog counts. The preview
 * iframe's body was never restored, and after closing a photo the whole
 * preview stopped taking clicks. The backdrop still covers the page, so
 * non-modal with the focus trap, scroll lock and outside-click close turned
 * back on looks and behaves the same. The storefront keeps the real modal.
 */
export function useOverlayProps() {
  const { mode } = useRenderEnvironment()
  return mode === 'preview'
    ? ({
        modal: false,
        trapFocus: true,
        preventScroll: true,
        closeOnInteractOutside: true,
      } as const)
    : {}
}

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

export function ThemeButton({
  label,
  link,
  secondary = false,
  onImage = false,
  magnetic = false,
}: {
  label: string
  link: Link
  /** The second button beside a main one: outlined whatever the theme's style. */
  secondary?: boolean
  /** Over a photo, where the brand colour may not read: white instead. */
  onImage?: boolean
  /** Lean toward the pointer on banners; pointers only, harmless elsewhere. */
  magnetic?: boolean
}) {
  const { settings } = useRenderEnvironment()
  const anchor = useAnchor(link)
  if (!label) return null

  const look = buttonLook(settings.buttonStyle)
  const variant = secondary ? 'outline' : look.variant
  const imageLook = onImage
    ? secondary || variant === 'outline'
      ? { color: 'white', borderColor: 'white', _hover: { bg: 'whiteAlpha.200' } }
      : { bg: 'white', color: 'gray.900', _hover: { bg: 'whiteAlpha.900' } }
    : {}

  const props = {
    colorPalette: 'brand',
    variant,
    rounded: look.rounded,
    size: 'lg',
    transition: 'transform 180ms ease, background-color 150ms ease',
    _hover: { transform: 'translateY(-1px)' },
    _active: { transform: 'translateY(0) scale(0.98)' },
    ...imageLook,
  } as const

  const button = !anchor ? (
    <Button {...props}>{label}</Button>
  ) : (
    <Button asChild {...props}>
      <ChakraLink unstyled {...anchor}>
        {label}
      </ChakraLink>
    </Button>
  )
  return magnetic ? <Magnetic>{button}</Magnetic> : button
}

/** A section's main and second buttons, side by side, wrapping on a narrow screen. */
export function ButtonRow({
  settings,
  align = 'left',
  onImage = false,
  magnetic = false,
}: {
  settings: FieldValues
  align?: 'left' | 'center'
  onImage?: boolean
  magnetic?: boolean
}) {
  const primary = readText(settings, 'buttonLabel')
  const secondary = readText(settings, 'secondaryButtonLabel')
  if (!primary && !secondary) return null
  return (
    <HStack gap="3" wrap="wrap" justify={align === 'center' ? 'center' : 'start'}>
      <ThemeButton
        label={primary}
        link={readLink(settings, 'buttonLink')}
        onImage={onImage}
        magnetic={magnetic}
      />
      <ThemeButton
        label={secondary}
        link={readLink(settings, 'secondaryButtonLink')}
        secondary
        onImage={onImage}
        magnetic={magnetic}
      />
    </HStack>
  )
}

/* -------------------------------------------------------------------------- */
/* Inline editing                                                             */
/* -------------------------------------------------------------------------- */

/** Which section a renderer is drawing, for text edited straight in the preview. */
export const SectionIdContext = createContext<string | null>(null)

/**
 * The section's heading animation, set by the frame around it. Lives here —
 * not on the frame's layout context — so this module stays importable from
 * the frame without a cycle.
 */
export const HeadlineContext = createContext<SectionHeadline>('none')

/**
 * A piece of a section's text that the seller can click and type into in the
 * editor's preview. On the storefront it is plain text in `as`.
 *
 * Uncontrolled while focused — React re-rendering a contentEditable under the
 * caret moves the caret — and committed on every input so the settings panel
 * follows along. Plain text only: paste is reduced to text, Enter ends the
 * edit, so no markup can get in.
 */
export function EditableText({
  field,
  value,
  as = 'span',
  ...props
}: {
  /** The section setting this text is. */
  field: string
  value: string
  as?: 'span' | 'h1' | 'h2' | 'p' | 'div'
} & Omit<BoxProps, 'as' | 'children'>) {
  const { mode, editing } = useRenderEnvironment()
  const sectionId = useContext(SectionIdContext)
  const ref = useRef<HTMLElement>(null)
  const focused = useRef(false)

  // Keep the DOM in step with edits from the settings panel, except while the
  // seller is typing here.
  useEffect(() => {
    const element = ref.current
    if (element && !focused.current && element.textContent !== value) element.textContent = value
  }, [value])

  if (mode !== 'preview' || !editing || !sectionId) {
    return value ? (
      <Box as={as} {...props}>
        {value}
      </Box>
    ) : null
  }

  return (
    <Box
      as={as}
      ref={ref}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      spellCheck
      data-editable=""
      cursor="text"
      outline="none"
      rounded="sm"
      transition="box-shadow 120ms"
      _hover={{ boxShadow: '0 0 0 1px var(--chakra-colors-brand-muted)' }}
      _focus={{ boxShadow: '0 0 0 2px var(--chakra-colors-brand-solid)' }}
      // An empty heading still needs somewhere to click.
      minW="4ch"
      css={{ '&:empty::before': { content: '"…"', opacity: 0.4 } }}
      onFocus={() => (focused.current = true)}
      onBlur={() => (focused.current = false)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === 'Escape') {
          event.preventDefault()
          ;(event.currentTarget as HTMLElement).blur()
        }
      }}
      onPaste={(event) => {
        event.preventDefault()
        const text = event.clipboardData.getData('text/plain').replace(/\s+/g, ' ')
        event.currentTarget.ownerDocument.execCommand('insertText', false, text)
      }}
      onInput={(event) =>
        editing.onEditText(sectionId, field, (event.currentTarget as HTMLElement).textContent ?? '')
      }
      {...props}
    >
      {value}
    </Box>
  )
}

export function SectionHeading({
  children,
  align = 'left',
  field,
}: {
  children: ReactNode
  align?: 'left' | 'center'
  /** The setting the heading is, so the seller can type into it in the preview. */
  field?: string
}) {
  const { mode } = useRenderEnvironment()
  const headline = useContext(HeadlineContext)
  if (!children) return null
  // Split words animate on the storefront; the preview keeps editable text,
  // so the seller can still click and type. A section without a field — a
  // status line, not a setting — animates in both.
  const animated =
    headline === 'rise' && typeof children === 'string' && (mode === 'live' || !field)
  return (
    <Heading as="h2" size={{ base: 'lg', md: 'xl' }} textAlign={align} letterSpacing="-0.01em">
      {animated ? (
        <SplitText text={children} />
      ) : field && typeof children === 'string' ? (
        <EditableText field={field} value={children} />
      ) : (
        children
      )}
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
      css={{
        '&:hover img': { transform: 'scale(1.05)' },
        '@media (prefers-reduced-motion: reduce)': {
          '&:hover img': { transform: 'none' },
        },
      }}
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
            transition="transform 600ms ease"
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
