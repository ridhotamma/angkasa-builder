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
  IconButton,
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
  type ComponentProps,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { LuHeart } from 'react-icons/lu'

import { ImageWithFallback } from '@repo/theme'

import {
  ALIGN_SELF,
  BUTTON_PADDING_X,
  buttonAppearance,
  readButtonElement,
  readTextElement,
  textElementStyle,
  type ButtonAppearance,
  type ButtonHover,
} from '../model/element-style'
import { readLink, readText, type FieldValues } from '../model/fields'
import type { Link } from '../model/links'
import type { ButtonStyle, CardStyle } from '../model/settings'
import type { SectionHeadline } from '../model/section-style'
import { useRenderEnvironment, type StorefrontProductCard } from './context'
import { useRenderText } from './copy'
import { SplitText } from './motion'

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

/**
 * A button with a link: a real `Button` when the link is empty, and the same
 * button as an anchor when it is not. `ThemeButton` and the Blocks section's
 * button block both build on it, so link behaviour stays in one place.
 */
export function LinkButton({
  label,
  link,
  ...props
}: { label: string; link: Link } & ComponentProps<typeof Button>) {
  const anchor = useAnchor(link)
  // The label sits above a hover fill's pseudo-element, so the wipe never
  // hides the words no matter which direction it comes from.
  const content = (
    <Box
      as="span"
      data-button-label=""
      position="relative"
      zIndex="1"
      display="inline-flex"
      alignItems="center"
    >
      {label}
    </Box>
  )
  if (!anchor) return <Button {...props}>{content}</Button>
  return (
    <Button asChild {...props}>
      <ChakraLink unstyled {...anchor}>
        {content}
      </ChakraLink>
    </Button>
  )
}

const HOVER_FILL_TRANSITION = 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)'

/**
 * The hover the seller picked: a contrasting fill that wipes in from a
 * direction, or a light that sweeps across. Runs only under
 * `prefers-reduced-motion: no-preference`, and only ever styles the button —
 * no pointer tracking, no cursor following.
 */
export function buttonHoverCss(
  hover: ButtonHover | 'none',
  appearance: ButtonAppearance,
): BoxProps['css'] {
  if (hover === 'none') return undefined
  // A fill wipes in and stays, so the text flips to stay readable on it.
  const wipe = (origin: string, axis: 'X' | 'Y') => ({
    '&::before': {
      content: '""',
      position: 'absolute',
      inset: '0',
      backgroundColor: appearance.sweepBg,
      transform: axis === 'Y' ? 'scaleY(0)' : 'scaleX(0)',
      transformOrigin: origin,
      transition: HOVER_FILL_TRANSITION,
      pointerEvents: 'none',
    },
    '&:hover::before, &:focus-visible::before': {
      transform: axis === 'Y' ? 'scaleY(1)' : 'scaleX(1)',
    },
    '&:hover, &:focus-visible': { color: appearance.sweepColor },
  })
  const effect =
    hover === 'fill-up'
      ? wipe('bottom', 'Y')
      : hover === 'fill-down'
        ? wipe('top', 'Y')
        : hover === 'fill-left'
          ? wipe('left', 'X')
          : hover === 'fill-right'
            ? wipe('right', 'X')
            : // A shine is only a light passing over: the button's own fill,
              // border and text stay exactly as they were.
              {
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: '0',
                  bottom: '0',
                  left: '0',
                  width: '40%',
                  backgroundImage:
                    'linear-gradient(100deg, transparent, color-mix(in srgb, white 55%, transparent), transparent)',
                  transform: 'translateX(-160%) skewX(-18deg)',
                  transition: 'transform 650ms ease',
                  pointerEvents: 'none',
                },
                '&:hover::before, &:focus-visible::before': {
                  transform: 'translateX(340%) skewX(-18deg)',
                },
              }
  return {
    position: 'relative',
    overflow: 'hidden',
    '@media (prefers-reduced-motion: no-preference)': effect,
  }
}

/**
 * A section's button, in the theme's shape unless the seller clicked it in
 * the preview and restyled it. `elementKey` is where those overrides live in
 * `SectionInstance.elements`; every button passes its own, so two buttons in
 * one section never share a panel.
 */
export function ThemeButton({
  label,
  link,
  secondary = false,
  onImage = false,
  elementKey = 'button',
}: {
  label: string
  link: Link
  /** The second button beside a main one: outlined whatever the theme's style. */
  secondary?: boolean
  /** Over a photo, where the brand colour may not read: white instead. */
  onImage?: boolean
  /** The element id its editor overrides are stored under. */
  elementKey?: string
}) {
  const { settings, editing } = useRenderEnvironment()
  const elements = useContext(SectionElementsContext)
  if (!label) return null

  const look = buttonLook(settings.buttonStyle)
  const override = readButtonElement(elements[elementKey])
  const themeVariant = secondary ? 'outline' : look.variant
  const variant = override.variant !== 'default' ? override.variant : themeVariant
  const configured = override.variant !== 'default' || override.tone !== 'default'
  const size = override.size !== 'default' ? override.size : 'lg'
  const width = override.width !== 'default' ? override.width : 'auto'
  const padding = override.padding !== 'default' ? BUTTON_PADDING_X[override.padding] : undefined
  const alignSelf = override.align !== 'default' ? ALIGN_SELF[override.align] : undefined
  const hover = override.hover === 'default' ? 'none' : override.hover
  // The theme's variant and the resolved tones share one appearance, so a
  // hover fill knows what to wipe in with on either path.
  const appearance = buttonAppearance(
    override.tone === 'default' ? 'brand' : override.tone,
    variant,
    settings,
  )
  const hoverCss = buttonHoverCss(hover, appearance)

  const press = {
    transition: 'transform 180ms ease, background-color 150ms ease',
    _hover: { transform: 'translateY(-1px)' },
    _active: { transform: 'translateY(0) scale(0.98)' },
  }
  const shape = {
    colorPalette: 'brand',
    rounded: look.rounded,
    size,
    w: width === 'full' ? ('full' as const) : undefined,
    px: padding,
    alignSelf,
    css: hoverCss,
  }

  const imageSolid = onImage && !(secondary || variant === 'outline')
  const button = configured ? (
    <ConfiguredButton
      label={label}
      link={link}
      variant={variant}
      appearance={appearance}
      hover={hover}
      shape={shape}
      press={press}
    />
  ) : (
    <LinkButton
      label={label}
      link={link}
      variant={variant}
      {...shape}
      {...press}
      {...(onImage
        ? secondary || variant === 'outline'
          ? { color: 'white', borderColor: 'white', _hover: { bg: 'whiteAlpha.200' } }
          : { bg: 'white', color: 'gray.900', _hover: { bg: 'whiteAlpha.900' } }
        : {})}
      // A shine is only a light passing over: pin the button's own fill so
      // neither the recipe's hover nor the on-image look darkens it.
      {...(hover === 'shine' && {
        _hover: { ...press._hover, bg: imageSolid ? 'white' : appearance.bg },
      })}
    />
  )

  return (
    <ElementShell
      elementId={elementKey}
      selected={editing?.selectedElementId === elementKey}
      width={width}
    >
      {button}
    </ElementShell>
  )
}

/**
 * A button with an explicit colour and style. The appearance decides the
 * fill, text, border and hover; press physics and the theme's corner stay on
 * top, so an overridden button still moves like every other button.
 */
function ConfiguredButton({
  label,
  link,
  variant,
  appearance,
  hover,
  shape,
  press,
}: {
  label: string
  link: Link
  variant: 'solid' | 'outline' | 'ghost'
  appearance: ButtonAppearance
  hover: ButtonHover | 'none'
  shape: ComponentProps<typeof Button>
  press: ComponentProps<typeof Button>
}) {
  return (
    <LinkButton
      label={label}
      link={link}
      variant="plain"
      {...shape}
      bg={appearance.bg}
      color={appearance.color}
      borderWidth="1px"
      borderColor={appearance.borderColor ?? 'transparent'}
      {...press}
      // The shine leaves the fill alone; only the other hovers shade it.
      _hover={{ ...press._hover, ...(hover !== 'shine' && { bg: appearance.hoverBg }) }}
    />
  )
}

/** A section's main and second buttons, side by side, wrapping on a narrow screen. */
export function ButtonRow({
  settings,
  align = 'left',
  onImage = false,
  elementKey = 'button',
}: {
  settings: FieldValues
  align?: 'left' | 'center'
  onImage?: boolean
  /** The prefix for the two buttons' override ids. */
  elementKey?: string
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
        elementKey={elementKey}
      />
      <ThemeButton
        label={secondary}
        link={readLink(settings, 'secondaryButtonLink')}
        secondary
        onImage={onImage}
        elementKey={`${elementKey}.secondary`}
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
 * The section's per-element overrides, keyed by element id: the button the
 * seller clicked and restyled. Shared through context so a button deep in a
 * section reads its own override without every renderer passing it down.
 */
export const SectionElementsContext = createContext<Record<string, FieldValues>>({})

/**
 * The editor's handle on a button. Live pages get the button untouched; a
 * preview gets a hover/selected outline and a click that reports the element
 * to the editor, whose panel then opens on it. The wrapper is `inline-flex`
 * so the button keeps its natural place in its row or column.
 */
function ElementShell({
  elementId,
  selected,
  width,
  children,
}: {
  elementId: string
  selected: boolean
  width: 'auto' | 'full'
  children: ReactNode
}) {
  const { mode, editing } = useRenderEnvironment()
  const sectionId = useContext(SectionIdContext)
  if (mode !== 'preview' || !editing?.onSelectElement || !sectionId) return <>{children}</>
  return (
    <Box
      data-element-id={elementId}
      display="inline-flex"
      position="relative"
      rounded="l2"
      cursor="pointer"
      w={width === 'full' ? 'full' : undefined}
      outlineWidth="1px"
      outlineStyle="dashed"
      outlineColor={selected ? 'brand.solid' : 'transparent'}
      _hover={{ outlineColor: selected ? 'brand.solid' : 'brand.muted' }}
      onClick={(event) => {
        event.stopPropagation()
        editing.onSelectElement?.(sectionId, elementId, 'button')
      }}
    >
      {children}
    </Box>
  )
}

/**
 * A section's heading, paragraph or label that the seller can select and
 * restyle like a button: font size, colour, weight, line height, letter
 * spacing, case, italic, underline and alignment, stored per element in
 * `SectionInstance.elements` under `text.<name>` (see `textElementKey`).
 *
 * Once selected it is also editable in place — a second click places the
 * caret. `inline={false}` keeps the inner content uneditable (a rich-text
 * document is edited from the settings panel) while the element can still be
 * selected for styling. On the storefront and in snapshots it is plain text
 * with no wrapper.
 */
export function ThemeText({
  elementKey,
  field,
  value,
  as = 'span',
  inline = true,
  children,
  ...props
}: {
  /** The element id its overrides are stored under. */
  elementKey: string
  /** The section setting the text is, for the inline editor. */
  field: string
  value?: string
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'p' | 'div'
  /** Whether typing in the preview edits the text; false for rich documents. */
  inline?: boolean
  children?: ReactNode
} & Omit<BoxProps, 'as' | 'children'>) {
  const { mode, editing } = useRenderEnvironment()
  const sectionId = useContext(SectionIdContext)
  const elements = useContext(SectionElementsContext)
  const overrides = textElementStyle(readTextElement(elements[elementKey]))
  // The theme's own props first, the seller's overrides on top. A heading tag
  // keeps the heading face and weight Chakra's own `Heading` would give it,
  // since a plain box would inherit the body font.
  const heading = as === 'h1' || as === 'h2' || as === 'h3'
  const style = {
    ...(heading && { fontFamily: 'heading', fontWeight: 'semibold' }),
    ...props,
    ...overrides,
  }

  // The storefront and snapshots: final markup, no wrapper or affordance.
  if (mode !== 'preview' || !editing?.onSelectElement || !sectionId) {
    if (children !== undefined) {
      return (
        <Box as={as} {...style}>
          {children}
        </Box>
      )
    }
    return value ? (
      <Box as={as} {...style}>
        {value}
      </Box>
    ) : null
  }

  const selected = editing.selectedElementId === elementKey
  const content =
    children !== undefined ? (
      <Box as={as} {...style}>
        {children}
      </Box>
    ) : inline && value !== undefined ? (
      // Plain until the element is selected, then the caret: the first click
      // selects and opens the panel, the next one types.
      <EditableText field={field} value={value} as={as} editable={selected} {...style} />
    ) : value ? (
      <Box as={as} {...style}>
        {value}
      </Box>
    ) : null

  return (
    <Box
      data-element-id={elementKey}
      position="relative"
      rounded="sm"
      cursor="pointer"
      outlineWidth="1px"
      outlineStyle="dashed"
      outlineColor={selected ? 'brand.solid' : 'transparent'}
      css={{
        '&:hover:not(:has([data-element-id]:hover))': {
          outlineColor: selected ? 'brand.solid' : 'brand.muted',
        },
      }}
      onClick={(event) => {
        event.stopPropagation()
        editing.onSelectElement?.(sectionId, elementKey, 'text')
      }}
    >
      {content}
    </Box>
  )
}

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
 *
 * A block passes `editable={false}` until the seller selects it, so the first
 * click selects the block and the next places the caret; `onCommit` sends the
 * typed text wherever the block tree stores it.
 */
export function EditableText({
  field,
  value,
  as = 'span',
  editable = true,
  onCommit,
  ...props
}: {
  /** The section setting this text is. */
  field: string
  value: string
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'p' | 'div'
  /** Whether the preview shows a caret here; a block turns it on once selected. */
  editable?: boolean
  /** Where typed text goes; defaults to the section's own field. */
  onCommit?: (value: string) => void
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

  if (mode !== 'preview' || !editing || !sectionId || !editable) {
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
      onInput={(event) => {
        const next = (event.currentTarget as HTMLElement).textContent ?? ''
        if (onCommit) onCommit(next)
        else editing.onEditText(sectionId, field, next)
      }}
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

/**
 * The heart a product surface overlays: filled when the shopper has saved the
 * product, writing through the host's wishlist. Renders nothing when the host
 * has none — the editor preview passes an empty set so it is visible on the
 * canvas, and snapshots leave it out.
 */
export function WishlistButton({
  product,
  ...props
}: { product: StorefrontProductCard } & Omit<ComponentProps<typeof IconButton>, 'children'>) {
  const { wishlist } = useRenderEnvironment()
  const text = useRenderText()
  if (!wishlist) return null
  const saved = wishlist.ids.has(product.id)

  return (
    <IconButton
      data-wishlist-toggle=""
      aria-label={saved ? text('savedToWishlist') : text('saveToWishlist')}
      aria-pressed={saved}
      size="sm"
      rounded="full"
      variant="surface"
      colorPalette={saved ? 'red' : 'gray'}
      shadow="sm"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        wishlist.onToggle(product)
      }}
      {...props}
    >
      <LuHeart fill={saved ? 'currentColor' : 'none'} />
    </IconButton>
  )
}

export function ProductCard({ product }: { product: StorefrontProductCard }) {
  const { data, formatPrice } = useRenderEnvironment()
  const { frame, flat } = useCardStyle()

  return (
    <Card.Root
      position="relative"
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
      {/* Outside the link: a button nested in an anchor is neither valid HTML
          nor clickable without hijacking the navigation. */}
      <WishlistButton product={product} position="absolute" top="2" right="2" zIndex="1" />
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
