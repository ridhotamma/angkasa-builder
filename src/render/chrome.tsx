/**
 * The storefront's header and footer, drawn from a theme's layout settings
 * and the shop's menus.
 *
 * Shared by the storefront and the editor's preview, so what the seller
 * arranges is what shoppers get. The parts only the storefront can draw —
 * the search box, the cart with its count, the account menu — arrive as
 * slots; the editor passes stand-ins.
 */

import {
  Accordion,
  Avatar,
  Box,
  chakra,
  Container,
  Drawer,
  Flex,
  Grid,
  HoverCard,
  HStack,
  Icon,
  IconButton,
  Link as ChakraLink,
  Portal,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  type BoxProps,
  type HTMLChakraProps,
  type LinkProps,
} from '@chakra-ui/react'
import {
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react'
import { FaFacebookF, FaInstagram, FaTiktok, FaXTwitter, FaYoutube } from 'react-icons/fa6'
import {
  LuChevronDown,
  LuGlobe,
  LuHouse,
  LuLayoutGrid,
  LuMail,
  LuMapPin,
  LuMenu,
  LuPhone,
} from 'react-icons/lu'

import { ImageWithFallback, Tooltip } from '@repo/theme'

import { readBoolean, readLink, readList, readText, type FieldValues } from '../model/fields'
import {
  buildFooterFallbackMenu,
  buildMobileFallbackMenu,
  isMegaMenu,
  type CatalogNavEntry,
  type MenuItem,
} from '../model/menus'
import { isContentWidth } from '../model/section-style'
import { resolveScheme, schemeCssVars, SCHEME_KEYS, type SchemeKey } from '../model/settings'
import { BOLD_BORDER_WIDTH, BOLD_INK, boldShadow } from './bold'
import { useRenderEnvironment } from './context'
import { useRenderText } from './copy'
import { schemeCss } from './frame'
import { SmartLink, useOverlayProps } from './primitives'
import type { PageEdges } from './renderer'

export type SocialPlatform = 'instagram' | 'tiktok' | 'facebook' | 'youtube' | 'twitter' | 'website'

export interface ChromeShop {
  name: string
  logoUrl: string | null
  description?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  socialLinks?: Array<{ platform: SocialPlatform; url: string }>
}

function isScheme(value: string): value is SchemeKey {
  return (SCHEME_KEYS as readonly string[]).includes(value)
}

/** The layout's content width, or the page column when it is missing or unknown. */
function contentWidthOf(values: FieldValues): string {
  const value = readText(values, 'contentWidth')
  return isContentWidth(value) ? value : '6xl'
}

/** A scheme's variables as a style, or nothing for the page's own colours. */
function useSchemeCss(value: string): BoxProps {
  const { settings } = useRenderEnvironment()
  if (!isScheme(value)) return {}
  // Same scoping as a section band: soft schemes step aside in dark mode.
  return {
    css: schemeCss(value, schemeCssVars(resolveScheme(settings, value))),
    bg: 'bg',
    color: 'fg',
  }
}

/* -------------------------------------------------------------------------- */
/* Announcements                                                              */
/* -------------------------------------------------------------------------- */

/** The strip above the header; several announcements take turns every few seconds. */
function AnnouncementStrip({ header }: { header: FieldValues }) {
  const items = readList(header, 'announcements').filter((item) => readText(item, 'text'))
  const scheme = useSchemeCss(readText(header, 'announcementScheme') || 'brand')
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (items.length < 2) return
    const view = typeof window === 'undefined' ? null : window
    if (view?.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = setInterval(() => setIndex((current) => (current + 1) % items.length), 5000)
    return () => clearInterval(timer)
  }, [items.length])

  if (items.length === 0) return null
  const current = items[index % items.length]!

  return (
    <Box {...scheme} fontSize="sm" fontWeight="medium" textAlign="center" py="2" px="4">
      <SmartLink
        key={current.id}
        link={readLink(current, 'link')}
        display="block"
        css={{
          animation: items.length > 1 ? 'pb-announce 400ms ease' : undefined,
          '@keyframes pb-announce': {
            from: { opacity: 0, transform: 'translateY(4px)' },
            to: { opacity: 1, transform: 'none' },
          },
        }}
      >
        {readText(current, 'text')}
      </SmartLink>
    </Box>
  )
}

/* -------------------------------------------------------------------------- */
/* Menus                                                                      */
/* -------------------------------------------------------------------------- */

function NavLink({
  item,
  ...props
}: { item: MenuItem } & Omit<LinkProps, 'children' | 'href' | 'onClick'>) {
  return (
    <SmartLink
      link={item.link}
      fontSize="sm"
      fontWeight="medium"
      color="inherit"
      _hover={{ color: 'brand.fg' }}
      {...props}
    >
      {item.label}
    </SmartLink>
  )
}

/**
 * One top-level entry of the main menu on a desktop: a plain link, a
 * dropdown of links, or — when its children have children — a mega menu of
 * columns. Opened by hovering or focusing, as shoppers expect a shop's
 * navigation to behave.
 */
function DesktopMenuItem({ item }: { item: MenuItem }) {
  if (item.children.length === 0) return <NavLink item={item} py="2" />

  const mega = isMegaMenu(item)
  return (
    <HoverCard.Root
      openDelay={80}
      closeDelay={150}
      positioning={{ placement: 'bottom', gutter: 6 }}
      lazyMount
    >
      <HoverCard.Trigger asChild>
        <HStack
          as="span"
          gap="1"
          py="2"
          cursor="pointer"
          fontSize="sm"
          fontWeight="medium"
          _hover={{ color: 'brand.fg' }}
        >
          <SmartLink link={item.link} color="inherit">
            {item.label}
          </SmartLink>
          <Icon as={LuChevronDown} boxSize="3.5" />
        </HStack>
      </HoverCard.Trigger>
      <Portal>
        <HoverCard.Positioner>
          <HoverCard.Content
            p={mega ? '6' : '2'}
            minW={mega ? 'min(56rem, calc(100vw - 2rem))' : '48'}
            rounded="l3"
            shadow="lg"
            bg="bg.panel"
            color="fg"
          >
            {mega ? (
              <SimpleGrid columns={Math.min(4, item.children.length)} gap="8">
                {item.children.map((column) => (
                  <Stack key={column.id} gap="2.5">
                    <NavLink item={column} fontWeight="semibold" />
                    {column.children.map((child) => (
                      <NavLink key={child.id} item={child} fontWeight="normal" color="fg.muted" />
                    ))}
                  </Stack>
                ))}
              </SimpleGrid>
            ) : (
              <Stack gap="0">
                {item.children.map((child) => (
                  <NavLink
                    key={child.id}
                    item={child}
                    px="3"
                    py="2"
                    rounded="l2"
                    _hover={{ bg: 'bg.muted', color: 'fg' }}
                  />
                ))}
              </Stack>
            )}
          </HoverCard.Content>
        </HoverCard.Positioner>
      </Portal>
    </HoverCard.Root>
  )
}

/**
 * The main menu's row on a desktop. A long menu scrolls sideways in one row
 * rather than wrapping into a second: a wrapped header grows taller with every
 * link the seller adds, and its second line reads as a different menu.
 *
 * The row sits in a box at least as wide as the viewport, centred with auto
 * margins: a menu that fits is centred (or starts at the left), and one that
 * overflows starts at its first link instead of being clipped on both sides,
 * which is what `justify-content: center` alone would do. The dropdowns open in
 * a portal, so the scroll container never clips them.
 */
function DesktopMenu({ items, justify }: { items: MenuItem[]; justify: 'start' | 'center' }) {
  if (items.length === 0) return null
  return (
    <ScrollArea.Root as="nav" size="xs" hideBelow="md" data-desktop-menu="">
      <ScrollArea.Viewport>
        <ScrollArea.Content minW="full" w="max-content" pb="1">
          <HStack gap="6" w="max-content" mx={justify === 'center' ? 'auto' : undefined}>
            {items.map((item) => (
              <Box key={item.id} flexShrink="0" whiteSpace="nowrap">
                <DesktopMenuItem item={item} />
              </Box>
            ))}
          </HStack>
        </ScrollArea.Content>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar orientation="horizontal" />
    </ScrollArea.Root>
  )
}

/**
 * The whole main menu in a drawer on a phone, nested levels as accordions,
 * with the caller's rows pinned at its bottom.
 *
 * Opened by the hamburger in the phone bar, in every header state: the tab
 * bar's own tabs are the shop's destinations, not its whole menu.
 */
function MobileMenu({
  items,
  shop,
  bottom,
  defaultOpen = false,
}: {
  items: MenuItem[]
  shop: ChromeShop
  /** Rows under the menu — the account row, and whatever the host pins with it. */
  bottom?: ReactNode
  /** Initial drawer state. Closed in production; open in render tests. */
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const overlay = useOverlayProps()
  if (items.length === 0 && !bottom) return null

  const entry = (item: MenuItem, depth: number): ReactNode =>
    item.children.length === 0 ? (
      <Box key={item.id} onClick={() => setOpen(false)}>
        <NavLink item={item} display="block" py="2.5" pl={depth * 4} fontSize="md" />
      </Box>
    ) : (
      <Accordion.Item key={item.id} value={item.id} borderBottomWidth="0">
        <Accordion.ItemTrigger py="2.5" pl={depth * 4} fontWeight="medium">
          <Box flex="1">{item.label}</Box>
          <Accordion.ItemIndicator />
        </Accordion.ItemTrigger>
        <Accordion.ItemContent>
          <Accordion.ItemBody py="0">
            <Accordion.Root collapsible multiple variant="plain">
              {item.link.kind !== 'none' && entry({ ...item, children: [] }, depth + 1)}
              {item.children.map((child) => entry(child, depth + 1))}
            </Accordion.Root>
          </Accordion.ItemBody>
        </Accordion.ItemContent>
      </Accordion.Item>
    )

  return (
    <Drawer.Root
      {...overlay}
      open={open}
      onOpenChange={({ open: next }) => setOpen(next)}
      placement="start"
      size="xs"
    >
      <Drawer.Trigger asChild>
        <IconButton aria-label="Menu" variant="ghost" size="md" rounded="full" color="inherit">
          <LuMenu />
        </IconButton>
      </Drawer.Trigger>
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content>
            <Drawer.Header>
              <Drawer.Title>{shop.name}</Drawer.Title>
            </Drawer.Header>
            <Drawer.Body>
              <Accordion.Root collapsible multiple variant="plain">
                {items.map((item) => entry(item, 0))}
              </Accordion.Root>
            </Drawer.Body>
            {bottom && (
              <Box
                data-mobile-drawer-bottom=""
                borderTopWidth="1px"
                borderColor="border"
                px="6"
                py="3"
                onClick={() => setOpen(false)}
              >
                <Stack gap="1">{bottom}</Stack>
              </Box>
            )}
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  )
}

/* -------------------------------------------------------------------------- */
/* Header                                                                     */
/* -------------------------------------------------------------------------- */

function Logo({ shop, centered = false }: { shop: ChromeShop; centered?: boolean }) {
  return (
    <SmartLink
      link={{ kind: 'home' }}
      display="flex"
      alignItems="center"
      gap="2.5"
      minW="0"
      fontWeight="semibold"
      letterSpacing="-0.01em"
      justifyContent={centered ? 'center' : 'start'}
      color="inherit"
      _hover={{ opacity: 0.8 }}
    >
      <Avatar.Root size="xs" shape="rounded" flexShrink="0">
        <Avatar.Fallback name={shop.name} />
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
      <Text truncate fontFamily="heading" fontSize={centered ? 'lg' : 'md'}>
        {shop.name}
      </Text>
    </SmartLink>
  )
}

/**
 * Whether the header goes see-through over a page laid out as `edges` (from
 * `pageEdges`): the setting asks for it, and the page opens with an
 * edge-to-edge banner — there has to be something to see through to. The
 * host also limits it to the home page.
 */
export function isHeaderTransparent(header: FieldValues, edges: PageEdges): boolean {
  return readBoolean(header, 'transparentOnHome') && edges.bannerFirst
}

export interface StoreHeaderProps {
  header: FieldValues
  shop: ChromeShop
  menu: MenuItem[]
  /**
   * The shop's catalogue for the phone drawer's fallback menu. When `menu`
   * is empty a fresh shop would otherwise open a blank sheet — so the
   * drawer lists the catalogue instead (categories, collections, or one
   * collapsible group per kind when both exist). The desktop bar
   * deliberately stays empty: one clean row, never a full catalogue.
   */
  categories?: readonly CatalogNavEntry[]
  collections?: readonly CatalogNavEntry[]
  /** The search box, for the classic layout's middle column on a desktop. */
  searchField?: ReactNode
  /** A search icon that opens the search — the phone bar gets it, and the non-classic desktops too. */
  searchButton?: ReactNode
  /** The cart. In the bar at every width. */
  cart?: ReactNode
  /** The account. In the desktop bar; on a phone it moves into the menu. */
  account?: ReactNode
  /**
   * The account as a full-width row for the phone menu's bottom. Falls back
   * to `account`, so a host with one control still gets it down there. With
   * the tab bar on, the account is a tab and the row is left out.
   */
  drawerAccount?: ReactNode
  /**
   * What else sits under the menu, below the account row — the storefront
   * pins its colour-mode switch here. Kept when the tab bar carries the
   * account, so the switch does not lose its only phone home.
   */
  drawerFooter?: ReactNode
  /** Trailing controls for a host that has no separate cart and account slots. */
  actions?: ReactNode
  /**
   * Initial phone-drawer state. Closed everywhere in production; tests
   * render it open to assert what the sheet holds. Mirrors the drawer's
   * own uncontrolled `defaultOpen`.
   */
  drawerDefaultOpen?: boolean
  /**
   * See-through over the page's first section, until the shopper scrolls.
   * The host decides — the setting asks for it, but only a home page that
   * starts with an edge-to-edge banner has something to see through to.
   *
   * A see-through header is taken out of the flow and laid over the page, so
   * the banner starts at the very top with no measuring: the host only drops
   * its own top padding (see `pageEdges`).
   */
  transparent?: boolean
}

/**
 * Over a photo: white text, and every surface the slots draw on (the search
 * box, the cart badge's ring) a translucent white instead of the page's
 * light grey — a grey pill with white text in it cannot be read.
 *
 * The palette variables matter for the storefront's own controls: a `ghost`
 * IconButton (its cart and account buttons) is coloured `colorPalette.fg`, not
 * `fg`. The root already resolved `--chakra-colors-color-palette-*` to gray on
 * `<html>`, so overriding `fg` here never reached them and they stayed dark.
 * The editor's stand-ins inherit `color`, which is why only the preview
 * showed white icons. The `gray-*` ones cover a control that sets
 * `colorPalette="gray"` on itself, which re-reads gray from here.
 */
const CLEAR_PALETTE = {
  fg: '#ffffff',
  subtle: 'rgba(255, 255, 255, 0.16)',
  muted: 'rgba(255, 255, 255, 0.24)',
  emphasized: 'rgba(255, 255, 255, 0.32)',
  border: 'rgba(255, 255, 255, 0.35)',
}

const CLEAR_VARS = {
  ...Object.fromEntries(
    Object.entries(CLEAR_PALETTE).flatMap(([token, value]) => [
      [`--chakra-colors-color-palette-${token}`, value],
      [`--chakra-colors-gray-${token}`, value],
    ]),
  ),
  '--chakra-colors-fg': '#ffffff',
  '--chakra-colors-fg-muted': 'rgba(255, 255, 255, 0.85)',
  '--chakra-colors-fg-subtle': 'rgba(255, 255, 255, 0.7)',
  // `bg` itself must also go translucent: slotted controls (the storefront
  // search field's `_focusVisible`, the cart badge's ring) read it, and the
  // page's solid `bg` under a white header colour is what turned a focused
  // search box into a blank white pill.
  '--chakra-colors-bg': 'rgba(255, 255, 255, 0.18)',
  '--chakra-colors-bg-subtle': 'rgba(255, 255, 255, 0.16)',
  '--chakra-colors-bg-muted': 'rgba(255, 255, 255, 0.24)',
  '--chakra-colors-border': 'rgba(255, 255, 255, 0.35)',
  '--chakra-colors-border-emphasized': 'rgba(255, 255, 255, 0.6)',
} as const

/**
 * What the header's own neutral controls paint their hover with: a tint of the
 * header's ink.
 *
 * Chakra's ghost icon buttons read the `gray` palette, a colour-mode token
 * pair that knows nothing about a shop theme's page — so on a dark theme a
 * hover turned into Chakra's near-white pill and swallowed the pale icon.
 * `currentColor` is white over a photo, cream over ink and charcoal over a
 * light page: one rule for every theme, mode and scheme the header can wear,
 * and it also covers a host's own slotted search, cart and account controls.
 */
const HEADER_CONTROL_VARS = {
  '--chakra-colors-color-palette-fg': 'currentColor',
  '--chakra-colors-color-palette-subtle': 'color-mix(in srgb, currentColor 14%, transparent)',
  '--chakra-colors-color-palette-muted': 'color-mix(in srgb, currentColor 10%, transparent)',
  '--chakra-colors-color-palette-emphasized': 'color-mix(in srgb, currentColor 18%, transparent)',
  '--chakra-colors-gray-fg': 'currentColor',
  '--chakra-colors-gray-subtle': 'color-mix(in srgb, currentColor 14%, transparent)',
  '--chakra-colors-gray-muted': 'color-mix(in srgb, currentColor 10%, transparent)',
  '--chakra-colors-gray-emphasized': 'color-mix(in srgb, currentColor 18%, transparent)',
} as const

/** The header's height as the page sees it; `StoreHeader` keeps it current. */
export const HEADER_HEIGHT_VAR = '--store-header-height'

/**
 * Where a sticky panel stops: a gap below the header's real height, whatever
 * its layout, menu row and announcement strip make it. The fallback is the
 * classic header, for the server's HTML before the header has measured itself.
 */
export const STICKY_BELOW_HEADER = `calc(var(${HEADER_HEIGHT_VAR}, 76px) + var(--chakra-spacing-4))`

/**
 * The header as the theme lays it out. Sticky unless the seller turned that
 * off; see-through over a home banner when the host says so, turning solid
 * as soon as the page scrolls.
 */
export function StoreHeader({
  header,
  shop,
  menu,
  categories = [],
  collections = [],
  searchField,
  searchButton,
  cart,
  account,
  drawerAccount: drawerAccountProp,
  drawerFooter,
  actions,
  drawerDefaultOpen = false,
  transparent = false,
}: StoreHeaderProps) {
  const layout = readText(header, 'layout') || 'classic'
  const tabs = hasTabBar(header)
  const sticky = readBoolean(header, 'sticky')
  const showSearch = readBoolean(header, 'showSearch')
  const ref = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)
  const text = useRenderText()

  // Read from the header's own window, which in the editor is the preview's.
  useEffect(() => {
    const view = ref.current?.ownerDocument.defaultView
    if (!transparent || !view) return
    const read = () => setScrolled(view.scrollY > 24)
    read()
    view.addEventListener('scroll', read, { passive: true })
    return () => view.removeEventListener('scroll', read)
  }, [transparent])

  // How much of the screen the header takes from the page, for a full-screen
  // banner (`HERO_HEIGHT.screen`): its real height — the layout, the menu row
  // and the announcement strip all change it — or nothing when it floats over
  // the banner. On the document root, since the banner is not inside the
  // header; in the editor that is the preview's own document.
  useEffect(() => {
    const element = ref.current
    const view = element?.ownerDocument.defaultView
    if (!element || !view) return
    const root = element.ownerDocument.documentElement
    const write = () =>
      root.style.setProperty(
        HEADER_HEIGHT_VAR,
        transparent ? '0px' : `${element.getBoundingClientRect().height}px`,
      )
    write()
    const observer = new view.ResizeObserver(write)
    observer.observe(element)
    return () => {
      observer.disconnect()
      root.style.removeProperty(HEADER_HEIGHT_VAR)
    }
  }, [transparent])

  const clear = transparent && !scrolled
  // Out of the flow when see-through: fixed if it should stay on screen,
  // absolute if it should scroll away with the banner.
  const position = transparent ? (sticky ? 'fixed' : 'absolute') : sticky ? 'sticky' : 'relative'
  const search = showSearch ? searchButton : null

  // A host with separate cart and account slots gets the cart in the phone
  // bar and the account down in the menu; a host that only fills `actions`
  // keeps the single trailing row it always had.
  const desktopTrailing =
    cart || account ? (
      <>
        {cart}
        {account}
      </>
    ) : (
      actions
    )
  const drawerAccount = drawerAccountProp ?? account
  // The drawer's bottom rows. With the tab bar on, the account is a tab, so
  // the drawer skips it and keeps only what the host pins beyond it — the
  // storefront's colour-mode switch, which has no other phone home there.
  const drawerBottom = tabs ? (
    drawerFooter
  ) : drawerAccount && drawerFooter ? (
    <>
      {drawerAccount}
      {drawerFooter}
    </>
  ) : (
    (drawerAccount ?? drawerFooter)
  )

  // The phone drawer never opens blank on a fresh shop: with no configured
  // menu it falls back to the catalogue — categories, collections, or one
  // collapsible group per kind when both exist. The desktop bar keeps the
  // configured menu only, so it stays one clean row.
  const mobileMenu =
    menu.length > 0
      ? menu
      : buildMobileFallbackMenu(categories, collections, {
          categories: text('filters'),
          collections: text('filtersCollections'),
        })

  // The phone bar is one design in every layout: a menu button with the brand
  // beside it, and search and the cart on the right. The account is not here —
  // it waits at the bottom of the menu, where its name can be written out.
  //
  // With the tab bar on, the bar keeps the menu button on the left and search
  // on the right, around the centred brand; only the cart and the account move
  // down to `StoreTabBar`, whose own tabs are destinations rather than the
  // whole menu.
  const mobileBar = tabs ? (
    <Grid
      data-mobile-bar=""
      templateColumns="minmax(0, 1fr) auto minmax(0, 1fr)"
      alignItems="center"
      gap="2"
      hideFrom="md"
    >
      <HStack gap="2.5" minW="0">
        <MobileMenu
          items={mobileMenu}
          shop={shop}
          bottom={drawerBottom}
          defaultOpen={drawerDefaultOpen}
        />
      </HStack>
      <Box minW="0" maxW="full" justifySelf="center">
        <Logo shop={shop} centered />
      </Box>
      <HStack gap="1" justifySelf="end" minW="0" flexShrink="0">
        {search}
      </HStack>
    </Grid>
  ) : (
    <Grid
      data-mobile-bar=""
      templateColumns="minmax(0, 1fr) auto"
      alignItems="center"
      gap="2"
      hideFrom="md"
    >
      <HStack gap="2.5" minW="0">
        <MobileMenu
          items={mobileMenu}
          shop={shop}
          bottom={drawerBottom}
          defaultOpen={drawerDefaultOpen}
        />
        <Box minW="0">
          <Logo shop={shop} />
        </Box>
      </HStack>
      <HStack gap="1" justifySelf="end" minW="0" flexShrink="0">
        {cart ? (
          <>
            {search}
            {cart}
          </>
        ) : (
          actions
        )}
      </HStack>
    </Grid>
  )

  const desktopBar =
    layout === 'centered' ? (
      <Stack data-desktop-bar="" gap="2" hideBelow="md">
        {/* The middle track may shrink, so a long shop name truncates rather
            than running under the icons beside it. */}
        <Grid
          templateColumns="minmax(0, 1fr) minmax(0, auto) minmax(0, 1fr)"
          alignItems="center"
          gap="3"
        >
          <HStack />
          <Logo shop={shop} centered />
          <HStack gap="1" justifySelf="end" ms="auto" flexShrink="0">
            {/* This layout has no middle column for the full field, so the
                desktop keeps the icon beside the cart and the account. */}
            {search}
            {desktopTrailing}
          </HStack>
        </Grid>
        <DesktopMenu items={menu} justify="center" />
      </Stack>
    ) : layout === 'inline' ? (
      <Flex data-desktop-bar="" align="center" gap="6" hideBelow="md">
        <Box flexShrink="0" maxW="16rem" minW="0">
          <Logo shop={shop} />
        </Box>
        <Box flex="1" minW="0">
          <DesktopMenu items={menu} justify="start" />
        </Box>
        <HStack gap="1" ms="auto" flexShrink="0">
          {search}
          {desktopTrailing}
        </HStack>
      </Flex>
    ) : (
      <Stack data-desktop-bar="" gap="2" hideBelow="md">
        <Grid
          templateColumns="minmax(0, 1fr) minmax(0, 2fr) minmax(0, 1fr)"
          alignItems="center"
          gap="4"
        >
          <Box minW="0">
            <Logo shop={shop} />
          </Box>
          <Box>{showSearch ? searchField : null}</Box>
          <HStack gap="1" justifySelf="end" ms="auto" flexShrink="0">
            {desktopTrailing}
          </HStack>
        </Grid>
        <DesktopMenu items={menu} justify="start" />
      </Stack>
    )

  const bar = (
    <>
      {mobileBar}
      {desktopBar}
    </>
  )

  return (
    <Box
      ref={ref}
      as="header"
      position={position}
      top="0"
      insetX={transparent ? '0' : undefined}
      zIndex="docked"
      transition="background-color 250ms, color 250ms, border-color 250ms"
      borderBottomWidth="1px"
      borderColor={clear ? 'transparent' : 'border'}
      bg={clear ? 'transparent' : 'bg/85'}
      color={clear ? 'white' : 'fg'}
      backdropFilter={clear ? undefined : 'blur(8px)'}
      data-transparent={clear ? '' : undefined}
      // The clear palette first, then the control tint: over a photo the two
      // agree (white ink), and on a solid header the tint follows the theme.
      css={clear ? { ...CLEAR_VARS, ...HEADER_CONTROL_VARS } : HEADER_CONTROL_VARS}
    >
      {/* Before the measurement above can run — the server's HTML — a
          see-through header is already known to take no room. */}
      {transparent && <style>{`:root{${HEADER_HEIGHT_VAR}:0px}`}</style>}
      <AnnouncementStrip header={header} />
      <Container maxW={contentWidthOf(header)} px={{ base: '4', md: '6' }} py="3">
        {bar}
      </Container>
    </Box>
  )
}

/* -------------------------------------------------------------------------- */
/* Tab bar                                                                    */
/* -------------------------------------------------------------------------- */

/** Whether the header asks for the phone's bottom tab bar instead of a top menu button. */
export function hasTabBar(header: FieldValues): boolean {
  return readText(header, 'mobileNav') === 'tabs'
}

/**
 * How much of a phone's screen the tab bar covers, on the document root:
 * `0px` without it. Anything else fixed to the bottom of the screen — the
 * floating contact buttons, the cookie bar — sits on top of it with this.
 */
export const TABBAR_HEIGHT_VAR = '--store-tabbar-height'

const TABBAR_HEIGHT = 'calc(4rem + env(safe-area-inset-bottom, 0px))'

/**
 * One tab: an icon over its label, with an optional count.
 *
 * Hosts build their own tabs from it — the cart that knows its count, the
 * account that knows its route — so every tab in the bar is the same shape.
 * `asChild` puts the tab on the host's own link element (its router's `Link`);
 * without it the tab is a button, for a tab that opens something.
 */
export function StoreTab({
  icon,
  label,
  active = false,
  badge = 0,
  asChild = false,
  children,
  ...props
}: {
  icon: ComponentType
  label: string
  /** The page the shopper is on. */
  active?: boolean
  /** A count over the icon — the cart's items. Hidden at zero. */
  badge?: number
} & Omit<HTMLChakraProps<'button'>, 'children'> & { children?: ReactNode }) {
  const { settings } = useRenderEnvironment()
  const bold = settings.cardStyle === 'hard'

  const content = (
    <>
      <Flex
        data-tab-icon=""
        position="relative"
        align="center"
        justify="center"
        h="7"
        px="4"
        rounded="full"
        transition="background-color 150ms ease"
        bg={active ? 'brand.subtle' : 'transparent'}
        // The bold look's active tab is a small brand chip on its own shadow.
        // Every tab keeps the border's room, so the icons never shift.
        {...(bold && {
          borderWidth: BOLD_BORDER_WIDTH,
          borderColor: 'transparent',
          ...(active && {
            bg: 'brand.solid',
            color: 'brand.contrast',
            borderColor: BOLD_INK,
            boxShadow: boldShadow(BOLD_INK, 2),
          }),
        })}
      >
        <Icon as={icon} boxSize="5" />
        {badge > 0 && (
          <Flex
            position="absolute"
            top="-1"
            insetEnd="1.5"
            minW="4"
            h="4"
            px="1"
            rounded="full"
            bg="brand.solid"
            color="brand.contrast"
            align="center"
            justify="center"
            fontSize="9px"
            fontWeight="bold"
            lineHeight="1"
            fontVariantNumeric="tabular-nums"
            borderWidth="2px"
            borderColor="bg"
            aria-hidden
          >
            {badge > 99 ? '99+' : badge}
          </Flex>
        )}
      </Flex>
      <Text
        as="span"
        fontSize="2xs"
        fontWeight={active ? 'semibold' : 'medium'}
        truncate
        maxW="full"
      >
        {label}
      </Text>
    </>
  )

  const look = {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5',
    flex: '1',
    minW: '0',
    h: 'full',
    px: '1',
    color: active ? 'fg' : 'fg.muted',
    bg: 'transparent',
    cursor: 'pointer',
    // `manipulation` drops the double-tap zoom delay on touch controls.
    touchAction: 'manipulation',
    transition: 'color 150ms ease',
    _hover: { color: 'fg', textDecoration: 'none' },
    _focusVisible: { outline: '2px solid', outlineColor: 'brand.focusRing', outlineOffset: '-2px' },
    'aria-current': active ? ('page' as const) : undefined,
  }

  if (asChild && isValidElement(children)) {
    return (
      <chakra.button asChild {...look} {...props}>
        {cloneElement(children, undefined, content)}
      </chakra.button>
    )
  }
  return (
    <chakra.button type="button" {...look} {...props}>
      {content}
    </chakra.button>
  )
}

export interface StoreTabBarProps {
  header: FieldValues
  /** The shopper is on the home page. */
  homeActive?: boolean
  /** The shopper is in the catalogue (`/products`). */
  catalogActive?: boolean
  /** The cart tab, built with `StoreTab`. */
  cart?: ReactNode
  /** The account tab, built with `StoreTab`. */
  account?: ReactNode
}

/**
 * The phone's bottom navigation, when the header asks for it (`mobileNav`):
 * home, the catalogue, the cart and the account, a thumb away. The menu button
 * and search stay up in the header — the bar is for destinations, and the
 * whole menu is one tap away in the drawer.
 *
 * Rendered last in the page's column by the host. It draws an in-flow spacer
 * as tall as itself, so the footer's last line is never under the bar, and
 * publishes its height as `TABBAR_HEIGHT_VAR` for the other things fixed to
 * the bottom of the screen. Nothing from `md` up, and nothing at all when the
 * header keeps the menu button.
 */
export function StoreTabBar({
  header,
  homeActive = false,
  catalogActive = false,
  cart,
  account,
}: StoreTabBarProps) {
  const { settings } = useRenderEnvironment()
  const text = useRenderText()
  if (!hasTabBar(header)) return null
  const bold = settings.cardStyle === 'hard'

  return (
    <>
      {/* The md breakpoint is Chakra's 48rem; the variable must agree with `hideFrom`. */}
      <style>{`@media (max-width:47.99rem){:root{${TABBAR_HEIGHT_VAR}:${TABBAR_HEIGHT}}}`}</style>
      <Box data-tabbar-spacer="" h={TABBAR_HEIGHT} flexShrink="0" hideFrom="md" aria-hidden />
      <Box
        as="nav"
        data-tabbar=""
        aria-label={text('phoneNavigation')}
        position="fixed"
        insetX="0"
        bottom="0"
        zIndex="sticky"
        hideFrom="md"
        bg="bg/95"
        color="fg"
        backdropFilter="blur(8px)"
        borderTopWidth={bold ? BOLD_BORDER_WIDTH : '1px'}
        borderColor={bold ? BOLD_INK : 'border'}
        pb="env(safe-area-inset-bottom, 0px)"
        css={HEADER_CONTROL_VARS}
      >
        <Flex h="16" align="stretch" maxW="lg" mx="auto" px="1">
          <StoreTab asChild icon={LuHouse} label={text('home')} active={homeActive}>
            <SmartLink link={{ kind: 'home' }}>{null}</SmartLink>
          </StoreTab>
          <StoreTab asChild icon={LuLayoutGrid} label={text('catalog')} active={catalogActive}>
            <SmartLink link={{ kind: 'catalog' }}>{null}</SmartLink>
          </StoreTab>
          {cart}
          {account}
        </Flex>
      </Box>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Footer                                                                     */
/* -------------------------------------------------------------------------- */

const SOCIAL_ICONS: Record<SocialPlatform, { icon: ComponentType; label: string }> = {
  instagram: { icon: FaInstagram, label: 'Instagram' },
  tiktok: { icon: FaTiktok, label: 'TikTok' },
  facebook: { icon: FaFacebookF, label: 'Facebook' },
  youtube: { icon: FaYoutube, label: 'YouTube' },
  twitter: { icon: FaXTwitter, label: 'X' },
  website: { icon: LuGlobe, label: 'Website' },
}

function ColumnHeading({ children }: { children: ReactNode }) {
  return (
    <Text
      fontSize="xs"
      fontWeight="semibold"
      color="fg.subtle"
      textTransform="uppercase"
      letterSpacing="0.06em"
    >
      {children}
    </Text>
  )
}

function ContactLine({
  icon,
  href,
  children,
}: {
  icon: ComponentType
  href?: string
  children: ReactNode
}) {
  const content = (
    <HStack gap="2" align="flex-start">
      <Icon as={icon} boxSize="4" mt="0.5" flexShrink="0" color="fg.subtle" />
      <Text>{children}</Text>
    </HStack>
  )
  if (!href) return content
  return (
    <ChakraLink href={href} color="inherit" _hover={{ color: 'fg' }}>
      {content}
    </ChakraLink>
  )
}

export interface StoreFooterProps {
  footer: FieldValues
  shop: ChromeShop
  menu: MenuItem[]
  /**
   * The shop's catalogue for the footer's fallback columns. When `menu` is
   * empty every category and collection gets a home here — one column per
   * kind that exists — so a fresh shop's footer already leads somewhere.
   */
  categories?: readonly CatalogNavEntry[]
  collections?: readonly CatalogNavEntry[]
  /** Published pages that ask to be in the footer, used while the footer menu is empty. */
  pages: Array<{ title: string; slug: string }>
  labels: { information: string; followUs: string; links: string }
  /** The small print under everything — "Powered by Pesanle". */
  bottom?: ReactNode
  /** The page ends in a full-bleed section, which the footer should meet with no gap. */
  flush?: boolean
}

export function StoreFooter({
  footer,
  shop,
  menu,
  categories = [],
  collections = [],
  pages,
  labels,
  bottom,
  flush = false,
}: StoreFooterProps) {
  const schemeValue = readText(footer, 'colorScheme') || 'default'
  const scheme = useSchemeCss(schemeValue)
  const about = readText(footer, 'about') || shop.description || ''
  const socials = readBoolean(footer, 'showSocials') ? (shop.socialLinks ?? []) : []
  const showContact = readBoolean(footer, 'showContact')
  const text = useRenderText()

  // A configured footer menu always wins; otherwise every category and
  // collection gets its own column.
  const effectiveMenu =
    menu.length > 0
      ? menu
      : buildFooterFallbackMenu(categories, collections, {
          categories: text('filters'),
          collections: text('filtersCollections'),
        })

  // Top-level links with children are columns; loose top-level links share one.
  const columns = effectiveMenu.filter((item) => item.children.length > 0)
  const loose = effectiveMenu.filter((item) => item.children.length === 0)
  const showPages = readBoolean(footer, 'showPages') && menu.length === 0 && pages.length > 0

  return (
    <Box
      as="footer"
      mt={flush ? '0' : '10'}
      borderTopWidth={schemeValue === 'default' ? '1px' : '0'}
      borderColor="border"
      {...(isScheme(schemeValue) ? scheme : { bg: 'bg' })}
    >
      <Container
        maxW={contentWidthOf(footer)}
        px={{ base: '4', md: '6' }}
        py={{ base: '10', md: '14' }}
      >
        <Stack gap="10">
          <Grid
            templateColumns={{
              base: '1fr',
              md: `minmax(0, 1.4fr) repeat(${Math.max(1, columns.length + (loose.length ? 1 : 0) + (showPages ? 1 : 0))}, minmax(0, 1fr))`,
            }}
            gap={{ base: '8', md: '10' }}
          >
            <Stack gap="4" maxW="sm">
              <Logo shop={shop} />
              {about && (
                <Text fontSize="sm" color="fg.muted" lineHeight="tall">
                  {about}
                </Text>
              )}
              {showContact && (
                <Stack gap="1.5" fontSize="sm" color="fg.muted">
                  {shop.email && (
                    <ContactLine icon={LuMail} href={`mailto:${shop.email}`}>
                      {shop.email}
                    </ContactLine>
                  )}
                  {shop.phone && (
                    <ContactLine icon={LuPhone} href={`tel:${shop.phone.replace(/[^\d+]/g, '')}`}>
                      {shop.phone}
                    </ContactLine>
                  )}
                  {shop.address && <ContactLine icon={LuMapPin}>{shop.address}</ContactLine>}
                </Stack>
              )}
              {socials.length > 0 && (
                <HStack gap="2" wrap="wrap" pt="1" aria-label={labels.followUs}>
                  {socials.map((link) => {
                    const { icon, label } = SOCIAL_ICONS[link.platform]
                    return (
                      <Tooltip key={link.platform} content={label}>
                        <IconButton
                          asChild
                          aria-label={label}
                          variant="outline"
                          size="sm"
                          rounded="full"
                        >
                          <ChakraLink href={link.url} target="_blank" rel="noopener noreferrer">
                            <Icon as={icon} boxSize="4" />
                          </ChakraLink>
                        </IconButton>
                      </Tooltip>
                    )
                  })}
                </HStack>
              )}
            </Stack>

            {columns.map((column) => (
              <Stack key={column.id} as="nav" gap="3" aria-label={column.label}>
                <ColumnHeading>{column.label}</ColumnHeading>
                <Stack gap="2" fontSize="sm" color="fg.muted">
                  {column.children.map((child) => (
                    <NavLink
                      key={child.id}
                      item={child}
                      fontWeight="normal"
                      _hover={{ color: 'fg' }}
                    />
                  ))}
                </Stack>
              </Stack>
            ))}
            {loose.length > 0 && (
              <Stack as="nav" gap="3" aria-label={labels.links}>
                <ColumnHeading>{labels.links}</ColumnHeading>
                <Stack gap="2" fontSize="sm" color="fg.muted">
                  {loose.map((item) => (
                    <NavLink
                      key={item.id}
                      item={item}
                      fontWeight="normal"
                      _hover={{ color: 'fg' }}
                    />
                  ))}
                </Stack>
              </Stack>
            )}
            {showPages && (
              <Stack as="nav" gap="3" aria-label={labels.information}>
                <ColumnHeading>{labels.information}</ColumnHeading>
                <Stack gap="2" fontSize="sm" color="fg.muted">
                  {pages.map((page) => (
                    <SmartLink
                      key={page.slug}
                      link={{ kind: 'page', slug: page.slug }}
                      _hover={{ color: 'fg' }}
                    >
                      {page.title}
                    </SmartLink>
                  ))}
                </Stack>
              </Stack>
            )}
          </Grid>

          <Flex
            borderTopWidth="1px"
            borderColor="border"
            pt="5"
            direction={{ base: 'column', sm: 'row' }}
            justify="space-between"
            gap="2"
            fontSize="xs"
            color="fg.subtle"
          >
            <Text>{bottom}</Text>
            <Text>
              &copy; {new Date().getFullYear()} {shop.name}
            </Text>
          </Flex>
        </Stack>
      </Container>
    </Box>
  )
}
