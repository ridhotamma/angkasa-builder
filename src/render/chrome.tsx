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
  SimpleGrid,
  Stack,
  Text,
  type BoxProps,
  type LinkProps,
} from '@chakra-ui/react'
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { FaFacebookF, FaInstagram, FaTiktok, FaXTwitter, FaYoutube } from 'react-icons/fa6'
import { LuChevronDown, LuGlobe, LuMail, LuMapPin, LuMenu, LuPhone } from 'react-icons/lu'

import { ImageWithFallback, Tooltip } from '@repo/theme'

import { readBoolean, readLink, readList, readText, type FieldValues } from '../model/fields'
import { isMegaMenu, type MenuItem } from '../model/menus'
import { resolveScheme, schemeCssVars, SCHEME_KEYS, type SchemeKey } from '../model/settings'
import { useRenderEnvironment } from './context'
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

function DesktopMenu({ items, justify }: { items: MenuItem[]; justify: 'start' | 'center' }) {
  if (items.length === 0) return null
  return (
    <HStack as="nav" gap="6" justify={justify} wrap="wrap" hideBelow="md">
      {items.map((item) => (
        <DesktopMenuItem key={item.id} item={item} />
      ))}
    </HStack>
  )
}

/** The whole main menu in a drawer on a phone, nested levels as accordions. */
function MobileMenu({ items, shop }: { items: MenuItem[]; shop: ChromeShop }) {
  const [open, setOpen] = useState(false)
  const overlay = useOverlayProps()
  if (items.length === 0) return null

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
        <IconButton
          aria-label="Menu"
          variant="ghost"
          size="sm"
          rounded="full"
          hideFrom="md"
          color="inherit"
        >
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
  /** The search box, for the classic layout's middle column on a desktop. */
  searchField?: ReactNode
  /** A search icon that opens the search — phones, and the other layouts. */
  searchButton?: ReactNode
  /** Cart and account. */
  actions: ReactNode
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

/** The header's height as the page sees it; `StoreHeader` keeps it current. */
export const HEADER_HEIGHT_VAR = '--store-header-height'

/**
 * The header as the theme lays it out. Sticky unless the seller turned that
 * off; see-through over a home banner when the host says so, turning solid
 * as soon as the page scrolls.
 */
export function StoreHeader({
  header,
  shop,
  menu,
  searchField,
  searchButton,
  actions,
  transparent = false,
}: StoreHeaderProps) {
  const layout = readText(header, 'layout') || 'classic'
  const sticky = readBoolean(header, 'sticky')
  const showSearch = readBoolean(header, 'showSearch')
  const ref = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)

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
  const right = (
    <HStack gap="0.5" justifySelf="end" flexShrink="0">
      {layout === 'classic' ? <Box hideFrom="md">{search}</Box> : search}
      {actions}
    </HStack>
  )

  const bar =
    layout === 'centered' ? (
      <Stack gap="2">
        {/* The middle track may shrink, so a long shop name truncates rather
            than running under the icons beside it. */}
        <Grid
          templateColumns="minmax(0, 1fr) minmax(0, auto) minmax(0, 1fr)"
          alignItems="center"
          gap="3"
        >
          <HStack>
            <MobileMenu items={menu} shop={shop} />
          </HStack>
          <Logo shop={shop} centered />
          {right}
        </Grid>
        <DesktopMenu items={menu} justify="center" />
      </Stack>
    ) : layout === 'inline' ? (
      <Flex align="center" gap="6">
        <MobileMenu items={menu} shop={shop} />
        <Box flexShrink="0" maxW={{ base: '60%', md: '16rem' }} minW="0">
          <Logo shop={shop} />
        </Box>
        <Box flex="1" minW="0">
          <DesktopMenu items={menu} justify="start" />
        </Box>
        {right}
      </Flex>
    ) : (
      <Stack gap="2">
        <Grid
          templateColumns={{
            base: 'auto minmax(0, 1fr) auto',
            md: 'minmax(0, 1fr) minmax(0, 2fr) minmax(0, 1fr)',
          }}
          alignItems="center"
          gap={{ base: '2', md: '4' }}
        >
          <HStack gap="1" minW="0">
            <MobileMenu items={menu} shop={shop} />
            <Logo shop={shop} />
          </HStack>
          <Box hideBelow="md">{showSearch ? searchField : null}</Box>
          {right}
        </Grid>
        <DesktopMenu items={menu} justify="start" />
      </Stack>
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
      css={clear ? CLEAR_VARS : undefined}
    >
      {/* Before the measurement above can run — the server's HTML — a
          see-through header is already known to take no room. */}
      {transparent && <style>{`:root{${HEADER_HEIGHT_VAR}:0px}`}</style>}
      <AnnouncementStrip header={header} />
      <Container maxW="6xl" px={{ base: '4', md: '6' }} py="3">
        {bar}
      </Container>
    </Box>
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

  // Top-level links with children are columns; loose top-level links share one.
  const columns = menu.filter((item) => item.children.length > 0)
  const loose = menu.filter((item) => item.children.length === 0)
  const showPages = readBoolean(footer, 'showPages') && menu.length === 0 && pages.length > 0

  return (
    <Box
      as="footer"
      mt={flush ? '0' : '10'}
      borderTopWidth={schemeValue === 'default' ? '1px' : '0'}
      borderColor="border"
      {...(isScheme(schemeValue) ? scheme : { bg: 'bg' })}
    >
      <Container maxW="6xl" px={{ base: '4', md: '6' }} py={{ base: '10', md: '14' }}>
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
