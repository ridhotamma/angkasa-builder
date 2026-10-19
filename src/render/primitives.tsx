/**
 * The small pieces every section is built from.
 *
 * Each one reads the theme settings, so a button is solid, outlined or a pill
 * and a card has a border, a shadow or neither — decided once here rather than
 * in every section.
 */

import {
  AspectRatio,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Grid,
  GridItem,
  Heading,
  HStack,
  Icon,
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
  useMemo,
  useRef,
  type ComponentProps,
  type MouseEvent,
  type ReactNode,
  type RefCallback,
} from 'react'
import { LuHeart, LuStar } from 'react-icons/lu'

import { ImageWithFallback } from '@repo/theme'

import {
  ALIGN_SELF,
  BUTTON_PADDING_X,
  buttonAppearance,
  readButtonElement,
  readTextElement,
  textElementKey,
  textElementStyle,
  type ButtonAppearance,
  type ButtonHover,
  type TextElementStyle,
} from '../model/element-style'
import { readLink, readText, type FieldValues } from '../model/fields'
import { sectionAnchorId, type Link } from '../model/links'
import type { ButtonStyle, CardStyle, ThemeSettings } from '../model/settings'
import type { SectionHeadline } from '../model/section-style'
import { BOLD_INK, boldButton, boldCard, boldShadow } from './bold'
import { useRenderEnvironment, type RenderEnvironment, type StorefrontProductCard } from './context'
import { useRenderText } from './copy'
import { Slider } from './slider'

export { OVERLAY_ARROW } from './slider'
import { useResponsive } from './hooks'
import { SplitText, useTilt } from './motion'

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

/**
 * Scroll a section into view, smoothly.
 *
 * The section's own `scroll-margin-top` (set against the sticky store header)
 * is what the landing is measured from, so its heading is not hidden behind
 * the header. A shopper who asked for reduced motion gets the jump without the
 * animation — their system setting is the one place that preference is said.
 *
 * Returns whether the section was found.
 */
export function scrollToSection(doc: Document, sectionId: string): boolean {
  const target = doc.getElementById(sectionAnchorId(sectionId))
  if (!target) return false

  const reduced = doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  return true
}

/** The anchor props a link needs: where it goes, and whether it opens a new tab. */
function useAnchor(link: Link) {
  const { href, mode, navigate, editing } = useRenderEnvironment()
  const url = href(link)
  if (!url) return null

  // A section link is a same-document jump, not a route: it scrolls to the
  // section it names and keeps the address shareable, so `navigate` never
  // sees it. The `href` stays real, so a middle-click still opens the page at
  // that section.
  if (link.kind === 'section') {
    return {
      href: url,
      onClick: (event: MouseEvent<HTMLElement>) => {
        if (event.defaultPrevented || event.button !== 0) return
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        const doc = event.currentTarget.ownerDocument

        // The editor's preview still plays the jump — the seller tries the
        // navigation where they built it — but nothing else about it does: the
        // address stays the editor's, and a snapshot, which has no `editing`,
        // is a still picture rather than a live page.
        if (mode === 'preview') {
          event.preventDefault()
          if (editing) scrollToSection(doc, link.sectionId)
          return
        }

        event.preventDefault()
        const target = doc.getElementById(sectionAnchorId(link.sectionId))
        // A section pointing at itself — a link stored before the editor
        // stopped offering it — goes nowhere rather than nudging the page.
        if (!target || target.contains(event.currentTarget)) return
        scrollToSection(doc, link.sectionId)
        // Shareable, without dropping the page's own query (a filtered
        // catalogue, a search) from the address.
        const view = doc.defaultView
        if (view) {
          view.history.replaceState(
            null,
            '',
            `${view.location.pathname}${view.location.search}${url}`,
          )
        }
      },
    }
  }

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
} & Partial<ReturnType<typeof boldButton>> {
  const look = {
    variant: style === 'outline' ? ('outline' as const) : ('solid' as const),
    rounded: style === 'pill' ? ('full' as const) : ('l2' as const),
  }
  // The bold frame and its press ride along, so a host that spreads the look
  // on its own buttons (checkout, order status) gets them too.
  return style === 'hard' ? { ...look, ...boldButton(BOLD_INK) } : look
}

/** What a theme's card style means for a card's frame. Shared like `buttonLook`. */
export function cardFrame(style: CardStyle): BoxProps {
  switch (style) {
    case 'shadow':
      return { borderWidth: '0', shadow: 'md' }
    case 'flat':
      return { borderWidth: '0', shadow: 'none', bg: 'transparent' }
    case 'hard':
      return boldCard(BOLD_INK)
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
  const override = readButtonElement(elements[elementKey])
  // The settings panel's label override wins over the section's own text.
  const text = override.label || label
  if (!text) return null

  const look = buttonLook(settings.buttonStyle)
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

  const press =
    settings.buttonStyle === 'hard'
      ? // The bold look lifts off its shadow and lands on it instead.
        { touchAction: 'manipulation', ...boldButton(BOLD_INK) }
      : {
          // `manipulation` drops the double-tap zoom delay on touch controls.
          touchAction: 'manipulation',
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
      label={text}
      link={link}
      variant={variant}
      appearance={appearance}
      hover={hover}
      shape={shape}
      press={press}
    />
  ) : (
    <LinkButton
      label={text}
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
 * A stored text element's resolved style, shared by everything that draws one:
 * `EditableText`, `ThemeText` and rich-text views. Empty for a key that was
 * never overridden, so an untouched element costs nothing.
 */
export function useTextElementStyle(elementKey?: string): TextElementStyle {
  const elements = useContext(SectionElementsContext)
  return useMemo(
    () => textElementStyle(readTextElement(elementKey ? elements[elementKey] : undefined)),
    [elements, elementKey],
  )
}

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
  const overrides = useTextElementStyle(elementKey)
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
      <EditableText
        field={field}
        value={value}
        as={as}
        editable={selected}
        element={false}
        {...style}
      />
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
/** The style-only props a block's overrides pass down to its inner text. */
export type BlockTextOverrideProps = Pick<
  BoxProps,
  | 'fontFamily'
  | 'fontSize'
  | 'fontWeight'
  | 'lineHeight'
  | 'letterSpacing'
  | 'textTransform'
  | 'fontStyle'
  | 'textDecoration'
  | 'textAlign'
  | 'color'
  | 'css'
>

export function EditableText({
  field,
  value,
  as = 'span',
  editable = true,
  element = true,
  elementKey,
  onCommit,
  ...props
}: {
  /** The section setting this text is. */
  field: string
  value: string
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'p' | 'div'
  /** Whether the preview shows a caret here; a block turns it on once selected. */
  editable?: boolean
  /**
   * Whether this text is a styleable element. On by default, so every
   * section-level heading, subheading and label can be picked and restyled
   * like a button; `false` inside a block, where the block owns the click.
   */
  element?: boolean
  /** Stored under this key instead of the derived `text.<field>`. */
  elementKey?: string
  /** Where typed text goes; defaults to the section's own field. */
  onCommit?: (value: string) => void
} & Omit<BoxProps, 'as' | 'children'>) {
  const { mode, editing } = useRenderEnvironment()
  const sectionId = useContext(SectionIdContext)
  const key = elementKey ?? textElementKey(field)
  // Read even outside the preview: a stored override must draw on the
  // storefront exactly as it does in the editor.
  const overrides = useTextElementStyle(element ? key : undefined)
  const ref = useRef<HTMLElement>(null)
  const focused = useRef(false)
  // The text the DOM held when the seller started typing. While focused React
  // renders this frozen string, so the children prop never changes and React
  // never rewrites the contentEditable — rewriting it moves the caret.
  const committed = useRef(value)

  // Keep the DOM in step with edits from the settings panel, except while the
  // seller is typing here.
  useEffect(() => {
    const node = ref.current
    if (node && !focused.current && node.textContent !== value) node.textContent = value
  }, [value])

  const interactive = mode === 'preview' && Boolean(editing) && Boolean(sectionId)
  const elementAware = element && interactive && Boolean(editing?.onSelectElement)
  const selected = editing?.selectedElementId === key
  // The first click picks the element; the next places the caret.
  const canEdit = interactive && editable && (!elementAware || selected)

  // Hidden only where it can never be edited: an empty editable element stays
  // mounted, so Ctrl+A + Delete leaves the caret in place instead of unmounting
  // the field under the seller.
  if (!value && !canEdit) return null

  const style = { ...props, ...overrides }
  const shown = focused.current ? committed.current : value

  const text = canEdit ? (
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
      onFocus={() => {
        focused.current = true
        committed.current = ref.current?.textContent ?? value
      }}
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
        else editing!.onEditText(sectionId!, field, next)
      }}
      {...style}
      // Merge the caller's css (a block's hover colour) under the empty
      // placeholder: the caller's object must not wipe the ellipsis an
      // emptied heading needs.
      css={{
        '&:empty::before': { content: '"…"', opacity: 0.4 },
        ...((style as { css?: Record<string, unknown> }).css ?? {}),
      }}
    >
      {shown}
    </Box>
  ) : (
    <Box as={as} {...style}>
      {value}
    </Box>
  )

  if (!elementAware) return text

  // An inline run keeps its place in the line; a block-level text stands alone.
  const inline = as === 'span'
  return (
    <Box
      as={inline ? 'span' : 'div'}
      data-element-id={key}
      display={inline ? 'inline-block' : undefined}
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
        editing!.onSelectElement?.(sectionId!, key, 'text')
      }}
    >
      {text}
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
  // In the preview an empty heading that has a field stays mounted: swapping
  // it out would unmount the inline editor the moment the seller clears it.
  // The live storefront still hides an empty heading.
  const keepEmpty = mode === 'preview' && Boolean(field)
  if (!children && !keepEmpty) return null
  // Split words animate on the storefront; the preview keeps editable text,
  // so the seller can still click and type. A section without a field — a
  // status line, not a setting — animates in both.
  const animated =
    headline === 'rise' && typeof children === 'string' && (mode === 'live' || !field)
  return (
    <Heading
      as="h2"
      size={{ base: 'lg', md: 'xl' }}
      textAlign={align}
      letterSpacing="-0.01em"
      textWrap="balance"
    >
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
        <Text
          key={index}
          color="fg.muted"
          whiteSpace="pre-line"
          lineHeight="tall"
          textWrap="pretty"
        >
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

/**
 * The page's own content column: the width and gutters the header and every
 * contained section use.
 *
 * A full-bleed section (`width: full` or `edge`) paints its background and
 * media across the viewport, but its **words** still belong here — lined up
 * with the header's logo and the sections above and below. The frame supplies
 * this column for `full`; an `edge` renderer that draws text adds it itself
 * (see `SectionColumn` in `./column` for the width-aware wrapper).
 */
export function PageColumn(props: BoxProps) {
  return <Container maxW="6xl" px={{ base: '4', md: '6' }} w="full" {...props} />
}

/** Shown in a preview where the live storefront would render nothing. */
export function EmptyNotice({ children }: { children: ReactNode }) {
  const { mode } = useRenderEnvironment()
  if (mode === 'live') return null
  return (
    <Box
      // A hook for tests: "this look rendered nothing" is a state worth
      // asserting on, and it is otherwise invisible in the markup.
      data-empty-notice=""
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

/**
 * The brand ring on hover, drawn as an overlay pseudo-element rather than an
 * `outline`: a card's own outline paints under its children, so an opaque image
 * box hid the top half of the ring and a full-bleed bento tile hid all of it.
 */
function outlineCss() {
  return {
    '&::after': {
      content: '""',
      position: 'absolute',
      inset: '0',
      zIndex: 2,
      borderRadius: 'inherit',
      border: '2px solid transparent',
      pointerEvents: 'none',
      transition: 'border-color 150ms ease',
    },
    '&:hover::after': { borderColor: 'var(--chakra-colors-brand-solid)' },
  }
}

/**
 * A light sweeping across the card, left to right, on hover. No transition at
 * rest, so leaving the card snaps the light back to its start — the sweep is
 * one-way, never dragging back across.
 */
function shineCss() {
  return {
    '&::before': {
      content: '""',
      position: 'absolute',
      inset: '0',
      zIndex: 1,
      borderRadius: 'inherit',
      pointerEvents: 'none',
      background:
        'linear-gradient(115deg, transparent 35%, rgb(255 255 255 / 0.35) 50%, transparent 65%)',
      transform: 'translateX(-130%)',
      transition: 'none',
    },
    '&:hover::before': { transform: 'translateX(130%)', transition: 'transform 650ms ease' },
  }
}

/**
 * The movement an effect set adds to the card's own `:hover` rule. A tilt owns
 * the card's `transform` (GSAP writes it), so the CSS lift stands down when the
 * two would otherwise fight over the same property.
 */
function liftCss(effects: ReadonlySet<string>, bold: boolean, tilt: boolean) {
  const hover: Record<string, string> = {}
  if (!tilt && effects.has('lift')) {
    hover.transform = bold ? 'translate(-2px, -2px)' : 'translateY(-4px)'
  }
  if (effects.has('shadow')) {
    hover.boxShadow = bold ? boldShadow(BOLD_INK, 6) : 'var(--chakra-shadows-lg)'
  }
  return Object.keys(hover).length > 0 ? { '&:hover': hover } : {}
}

/**
 * What every card does when the shopper points at it, from the theme's
 * `cardHover` — a brand outline, an image zoom, a lift, a shadow, a 3D tilt and
 * a shine sweep. One set for every card; none has its own. A pure function, so
 * the storefront's own pages wear it through `storefrontLook` too (they read the
 * theme from the root loader, not from a `RenderProvider`).
 */
export function cardHoverProps(settings: ThemeSettings): BoxProps {
  const effects = new Set(settings.cardHover)
  if (effects.size === 0) return {}
  const outline = effects.has('outline')
  const shine = effects.has('shine')
  const tilt = effects.has('tilt')
  return {
    // The ring and shine overlays are absolutely placed, so the card anchors them.
    ...((outline || shine) && { position: 'relative' as const }),
    // Tilt transforms the card itself, so its `transform` must not be CSS-
    // transitioned too — GSAP would fight the easing. Only the shadow transitions.
    transition: tilt ? 'box-shadow 250ms ease' : 'transform 250ms ease, box-shadow 250ms ease',
    css: {
      ...(outline && outlineCss()),
      ...(shine && shineCss()),
      ...liftCss(effects, settings.cardStyle === 'hard', tilt),
      ...(effects.has('zoom') && {
        // The transition rides on the image itself, not on each call site:
        // one card that forgot to repeat `transition` is a card whose image
        // snaps instead of easing. Declared once here, so every card that
        // zooms eases the same way and a new card gets it for free.
        '& img': { transition: 'transform 600ms ease' },
        '&:hover img': { transform: 'scale(1.05)' },
      }),
      '@media (prefers-reduced-motion: reduce)': {
        '&:hover': { transform: 'none' },
        '&:hover img': { transform: 'none', transition: 'none' },
        ...(shine && { '&::before': { display: 'none' } }),
      },
    },
  }
}

/** Everything a card wears from the theme: the frame, flatness and effects. */
export interface CardTheme {
  frame: BoxProps
  flat: boolean
  hover: BoxProps
  /**
   * Attach to every card's own root element to give it the 3D `tilt` — never a
   * wrapper, so a tilt can never change the card's box in the layout. One ref
   * may serve a whole list: each mounted card gets its own tilt. A no-op when
   * the theme does not ask for tilt.
   */
  tiltRef: RefCallback<HTMLDivElement>
}

/**
 * Everything a card wears from the theme, in one call, so every card in every
 * section is drawn the same way:
 * `const { frame, hover, tiltRef } = useCard()`.
 */
export function useCard(): CardTheme {
  const { settings } = useRenderEnvironment()
  return {
    frame: cardFrame(settings.cardStyle),
    flat: settings.cardStyle === 'flat',
    hover: cardHoverProps(settings),
    tiltRef: useTilt(settings.cardHover.includes('tilt')),
  }
}

/**
 * The published theme's shape for a page outside the builder — checkout, the
 * receipt, the account — so its cards and buttons wear what the sections do.
 * `null` means no published theme: the plain look those pages always had.
 */
export interface StorefrontLook {
  /** Whether a published theme is shaping the page at all. */
  themed: boolean
  /** Spread on a page's outer `Card.Root`s: rounding and the theme's frame. */
  card: BoxProps
  /** Spread on a product or category card's root, after `card`. */
  cardHover: BoxProps
  /** The theme draws cards with no frame at all, so their content needs its own corners. */
  flatCards: boolean
  /** Corner sizes, largest to smallest: outer cards, tiles inside them, chips. */
  radius: { card: string; tile: string; chip: string }
  /** Spread on a page's primary action button. Empty without a theme. */
  primaryButton: Partial<ReturnType<typeof buttonLook>>
}

const UNTHEMED_LOOK: StorefrontLook = {
  themed: false,
  card: { borderColor: 'border', rounded: 'xl' },
  // No theme means no `cardHover` to follow: the emphasis these cards always
  // had stays.
  cardHover: { transition: 'border-color 150ms', _hover: { borderColor: 'brand.emphasized' } },
  flatCards: false,
  radius: { card: 'xl', tile: 'lg', chip: 'md' },
  primaryButton: {},
}

export function storefrontLook(settings: ThemeSettings | null): StorefrontLook {
  if (!settings) return UNTHEMED_LOOK
  // The theme's three radius tokens, which its stylesheet sets per shop.
  const radius = { card: 'l3', tile: 'l2', chip: 'l1' }
  return {
    themed: true,
    card: { ...cardFrame(settings.cardStyle), rounded: radius.card },
    cardHover: cardHoverProps(settings),
    flatCards: settings.cardStyle === 'flat',
    radius,
    primaryButton: buttonLook(settings.buttonStyle),
  }
}

/**
 * The heart a product surface overlays: filled when the shopper has saved the
 * product, writing through the host's wishlist. Renders nothing when the host
 * has none — the editor preview passes an empty set so it is visible on the
 * canvas, and snapshots leave it out.
 */
export function WishlistButton({
  product,
  wishlist: store,
  ...props
}: {
  product: StorefrontProductCard
  /** A host wiring its own wishlist; falls back to the render environment. */
  wishlist?: RenderEnvironment['wishlist']
} & Omit<ComponentProps<typeof IconButton>, 'children'>) {
  const { wishlist: envWishlist } = useRenderEnvironment()
  const wishlist = store ?? envWishlist
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

/**
 * The second photo a product card shows on hover, if it is a different image
 * from the primary. Old card data carries only `imageUrls`, so that is the
 * fallback; a repeated file never becomes a hover layer.
 */
function hoverImageUrl(product: StorefrontProductCard): string | null {
  const candidate = product.secondaryImageUrl ?? product.imageUrls?.[1] ?? null
  return candidate && candidate !== product.imageUrl ? candidate : null
}

export function ProductCard({
  product,
  wishlist,
}: {
  product: StorefrontProductCard
  /** A host wiring its own wishlist; falls back to the render environment. */
  wishlist?: RenderEnvironment['wishlist']
}) {
  const { data, formatPrice } = useRenderEnvironment()
  const { frame, flat, hover, tiltRef } = useCard()
  const text = useRenderText()
  const soldOut = product.trackStock === true && product.available === 0
  const ratingCount = product.ratingCount ?? 0
  const soldCount = product.soldCount ?? 0
  const secondaryImage = hoverImageUrl(product)

  return (
    <Card.Root
      ref={tiltRef}
      className="group"
      position="relative"
      w="full"
      h="full"
      bg="bg.panel"
      rounded="l3"
      overflow="hidden"
      {...frame}
      {...hover}
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
          {/* One child: Chakra's ratio box takes a single element. The two
              photos then stack inside it, the second waiting for the hover. */}
          <Box position="relative" w="full" h="full">
            <ImageWithFallback
              src={product.imageUrl ?? undefined}
              alt={product.name}
              position="absolute"
              inset="0"
              w="full"
              h="full"
              objectFit="cover"
              loading="lazy"
            />
            {secondaryImage && (
              <ImageWithFallback
                src={secondaryImage}
                alt=""
                position="absolute"
                inset="0"
                w="full"
                h="full"
                objectFit="cover"
                loading="lazy"
                fetchPriority="low"
                opacity={0}
                transition="opacity 300ms ease, transform 600ms ease"
                _groupHover={{ opacity: 1 }}
                data-product-secondary=""
                aria-hidden
                // No second image on a touch screen: the card opens the product.
                css={{
                  '@media (hover: none)': { display: 'none' },
                  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                }}
                // A photo that fails to load must not cover the primary with a
                // placeholder icon.
                fallback={<Box aria-hidden />}
              />
            )}
          </Box>
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
          {(ratingCount > 0 || soldOut || soldCount > 0) && (
            <Stack direction="row" gap="1.5" align="center" wrap="wrap">
              {/* No stars at all for an unreviewed product — "0.0" would read
                  as a bad rating rather than as none. */}
              {ratingCount > 0 && (
                <Stack direction="row" gap="0.5" align="center">
                  <Icon as={LuStar} boxSize="3" color="yellow.solid" fill="currentColor" />
                  <Text fontSize="xs" color="fg.muted" fontVariantNumeric="tabular-nums">
                    {formatRating(product.rating ?? 0)} ({ratingCount})
                  </Text>
                </Stack>
              )}
              {soldOut && (
                <Badge size="sm" variant="subtle" colorPalette="gray" rounded="md">
                  {text('soldOut')}
                </Badge>
              )}
              {soldCount > 0 && (
                <Text fontSize="xs" color="fg.subtle">
                  {text('sold', { count: soldCount })}
                </Text>
              )}
            </Stack>
          )}
        </Stack>
      </SmartLink>
      {/* Outside the link: a button nested in an anchor is neither valid HTML
          nor clickable without hijacking the navigation. */}
      <WishlistButton
        product={product}
        wishlist={wishlist}
        position="absolute"
        top="2"
        right="2"
        zIndex="1"
      />
    </Card.Root>
  )
}

/** One decimal, in the reader's own locale — "4.8" or "4,8". */
function formatRating(rating: number): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(rating)
}

export function gridColumns(
  columns: string,
  mobileColumns = '2',
): { base: number; md: number; lg: number } {
  const n = Math.min(6, Math.max(2, Number(columns) || 4))
  return { base: mobileColumns === '1' ? 1 : 2, md: Math.min(3, n), lg: n }
}

export function ProductGrid({
  products,
  columns = '4',
  mobileColumns,
  wishlist,
}: {
  products: StorefrontProductCard[]
  columns?: string
  /** One or two columns on a phone; anything else keeps the phone default. */
  mobileColumns?: string
  /** A host wiring its own wishlist; falls back to the render environment. */
  wishlist?: RenderEnvironment['wishlist']
}) {
  return (
    <SimpleGrid
      data-product-layout="grid"
      columns={gridColumns(columns, mobileColumns)}
      gap={{ base: '3', md: '5' }}
    >
      {products.map((product) => (
        <ProductCard key={product.id} product={product} wishlist={wishlist} />
      ))}
    </SimpleGrid>
  )
}

/**
 * A stored slides-per-view, clamped to the slider's own scale. Whole steps
 * are rows of cards; a fraction leaves the next slide peeking. Shared by the
 * product row and the banner slider, so one setting reads the same on both.
 */
export function slidesPerView(value: string | undefined, fallback: number, max: number): number {
  const count = Number(value)
  return Number.isFinite(count) && count > 0 ? Math.min(max, count) : fallback
}

/**
 * The shop's products in one row the shopper swipes, drags or pages with the
 * shared slider's arrows and a finger — no dots and no loop: the row ends on
 * its last card, and the banner is the one slider that wears dots. A short
 * list is simply a still row.
 */
function ProductSlider({
  products,
  perPage,
  perPageMobile,
}: {
  products: StorefrontProductCard[]
  /** The seller's slides-per-view, whole or half steps, on each screen. */
  perPage?: string
  perPageMobile?: string
}) {
  // The chosen phone count, three cards on a tablet — never more than the
  // desktop view — and the chosen desktop count, never more than the list.
  const desktop = slidesPerView(perPage, 4, 6)
  const base = slidesPerView(perPageMobile, 2, 3)
  const perView = Math.min(
    useResponsive({ base, md: Math.min(3, desktop), lg: desktop }),
    products.length,
  )

  return (
    <Slider
      count={products.length}
      perPage={perView}
      rootProps={{ 'data-product-layout': 'slider' }}
      slideProps={{ display: 'flex', alignItems: 'stretch' }}
    >
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </Slider>
  )
}

/**
 * A tile's place in the desktop bento, repeating every eight: a big square,
 * two small ones and a wide one, then the same mirrored. Auto-placement puts
 * each group of four into exactly two rows of the four-column grid.
 */
export const BENTO_PATTERN = [
  'big',
  'small',
  'small',
  'wide',
  'small',
  'small',
  'big',
  'wide',
] as const

export type BentoShape = (typeof BENTO_PATTERN)[number] | 'full'

/**
 * The desktop shape of tile `index` of `count`. A last group short of four
 * would leave holes beside its big square, so it is laid out as one full row
 * instead: one tile across, two halves, or a half and two quarters.
 */
export function bentoShape(index: number, count: number): BentoShape {
  const groupStart = index - (index % 4)
  const inGroup = count - groupStart
  if (inGroup >= 4) return BENTO_PATTERN[index % BENTO_PATTERN.length]!
  if (inGroup === 1) return 'full'
  if (inGroup === 2) return 'wide'
  return index === groupStart ? 'wide' : 'small'
}

export const BENTO_COLUMNS: Record<BentoShape, number> = {
  big: 2,
  wide: 2,
  small: 1,
  full: 4,
}

/**
 * Phones repeat a full-width tile then two halves. A last pair would leave its
 * second half alone, so a short final group of two is laid out as two halves.
 */
export function bentoPhoneColumns(index: number, count: number): number {
  const groupStart = index - (index % 3)
  return index === groupStart && count - groupStart !== 2 ? 2 : 1
}

/**
 * A bento tile's text and shade, hidden until the tile (a `group`) is hovered
 * or holds focus, then brought in `delayMs` after the hover begins: the shade
 * first, then the name rising into place, then the price. Leaving, all of it
 * goes at once. A screen without hover always shows it, and reduced motion
 * keeps the fade without the movement.
 */
export function bentoReveal(delayMs = 0, { rise = true }: { rise?: boolean } = {}) {
  const shown = {
    opacity: 1,
    transform: 'none',
    transitionDelay: `${delayMs}ms`,
  }
  return {
    opacity: 0,
    transform: rise ? 'translateY(10px)' : 'none',
    transition: 'opacity 0.3s ease, transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
    _groupHover: shown,
    _groupFocusWithin: shown,
    css: {
      '@media (hover: none)': { opacity: 1, transform: 'none' },
      '@media (prefers-reduced-motion: reduce)': {
        transform: 'none',
        transition: 'opacity 0.2s ease',
      },
    },
  } as const
}

/** How far the price trails the name when a bento tile reveals its text. */
const REVEAL_STAGGER_MS = 70

/**
 * A product as a background tile, name and price over a faded bottom edge —
 * the bento counterpart of `ProductCard`, which a mixed-size tile cannot hold.
 * With `reveal`, the text waits for the shopper to point at the tile.
 */
function ProductBentoCard({
  product,
  shape,
  reveal,
}: {
  product: StorefrontProductCard
  shape: BentoShape
  reveal: boolean
}) {
  const { data, formatPrice } = useRenderEnvironment()
  const { frame, hover } = useCard()
  const big = shape === 'big'
  const secondaryImage = hoverImageUrl(product)

  return (
    <Card.Root
      className="group"
      position="relative"
      h="full"
      bg="bg.subtle"
      rounded="l3"
      overflow="hidden"
      data-text-reveal={reveal ? '' : undefined}
      {...frame}
      {...hover}
    >
      <SmartLink
        link={{ kind: 'product', slug: product.slug }}
        display="block"
        position="absolute"
        inset="0"
      >
        <ImageWithFallback
          src={product.imageUrl ?? undefined}
          alt={product.name}
          position="absolute"
          inset="0"
          w="full"
          h="full"
          objectFit="cover"
          loading="lazy"
          transition="transform 600ms ease"
        />
        {secondaryImage && (
          <ImageWithFallback
            src={secondaryImage}
            alt=""
            position="absolute"
            inset="0"
            w="full"
            h="full"
            objectFit="cover"
            loading="lazy"
            fetchPriority="low"
            opacity={0}
            transition="opacity 300ms ease, transform 600ms ease"
            _groupHover={{ opacity: 1 }}
            data-product-secondary=""
            aria-hidden
            css={{
              '@media (hover: none)': { display: 'none' },
              '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
            }}
            fallback={<Box aria-hidden />}
          />
        )}
        <Box
          position="absolute"
          inset="0"
          bgGradient="to-t"
          gradientFrom="blackAlpha.700"
          gradientTo="transparent"
          {...(reveal && bentoReveal(0, { rise: false }))}
        />
        <Stack position="absolute" insetX="0" bottom="0" gap="0.5" p={big ? '4' : '3'}>
          <Text
            color="white"
            fontWeight="semibold"
            lineClamp={2}
            fontSize={big ? { base: 'sm', md: 'lg' } : { base: 'sm', md: 'md' }}
            {...(reveal && bentoReveal(REVEAL_STAGGER_MS))}
          >
            {product.name}
          </Text>
          <HStack
            gap="2"
            align="baseline"
            wrap="wrap"
            {...(reveal && bentoReveal(REVEAL_STAGGER_MS * 2))}
          >
            <Text
              color="white"
              fontWeight="bold"
              fontVariantNumeric="tabular-nums"
              fontSize={big ? { base: 'sm', md: 'lg' } : 'md'}
            >
              {formatPrice(product.price, data.shop.currency)}
            </Text>
            {product.compareAtPrice !== null && (
              <Text color="whiteAlpha.800" fontSize="sm" textDecoration="line-through">
                {formatPrice(product.compareAtPrice, data.shop.currency)}
              </Text>
            )}
          </HStack>
        </Stack>
      </SmartLink>
      <WishlistButton product={product} position="absolute" top="2" right="2" zIndex="1" />
    </Card.Root>
  )
}

/**
 * Products in a bento: tiles of mixed sizes, the image behind the name and
 * price, four columns of paired rows on a desktop and repeating halves on a
 * phone.
 */
function ProductBento({
  products,
  reveal,
}: {
  products: StorefrontProductCard[]
  reveal: boolean
}) {
  return (
    <Grid
      data-product-layout="bento"
      templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }}
      autoRows={{ base: '9.5rem', md: '12rem' }}
      autoFlow="dense"
      gap="3"
    >
      {products.map((product, index) => {
        const shape = bentoShape(index, products.length)
        return (
          <GridItem
            key={product.id}
            colSpan={{
              base: bentoPhoneColumns(index, products.length),
              md: BENTO_COLUMNS[shape],
            }}
            rowSpan={{ base: 1, md: shape === 'big' ? 2 : 1 }}
            minW="0"
          >
            <ProductBentoCard product={product} shape={shape} reveal={reveal} />
          </GridItem>
        )
      })}
    </Grid>
  )
}

/**
 * A product list in the layout the seller picked: the plain grid, a slider
 * with arrows over its edges, or a bento of mixed tiles. Every section that
 * draws products from the catalogue renders through this, so the three
 * layouts stay the same wherever the list comes from.
 */
export function ProductList({
  products,
  layout = 'grid',
  columns = '4',
  mobileColumns,
  perPage,
  perPageMobile,
  textReveal = false,
}: {
  products: StorefrontProductCard[]
  layout?: string
  columns?: string
  /** One or two columns on a phone; anything else keeps the phone default. */
  mobileColumns?: string
  /**
   * The slider's own per-view, whole or fractional, each screen. A layout
   * saved before the pair existed carries only the grid's `columns`, which
   * still reads as a whole number of slides.
   */
  perPage?: string
  perPageMobile?: string
  /** The bento's text shows on hover only (the section's `bentoText`). */
  textReveal?: boolean
}) {
  if (layout === 'slider')
    return (
      <ProductSlider
        products={products}
        perPage={perPage || columns}
        perPageMobile={perPageMobile || mobileColumns}
      />
    )
  if (layout === 'bento') return <ProductBento products={products} reveal={textReveal} />
  return <ProductGrid products={products} columns={columns} mobileColumns={mobileColumns} />
}
