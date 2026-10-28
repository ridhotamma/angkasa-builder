/**
 * Pages and sections as plain HTML strings, for hosts that do not run React.
 *
 * The section components are still what draws them — React and Chakra run
 * here, on the server, as a template engine — so this output can never drift
 * from the React storefront. What leaves this module is markup and CSS only.
 * The browser needs no framework: the interactive parts (sliders, the phone
 * menu, popups, countdowns, motion) carry `data-pb-*` hooks that the
 * framework-free runtime in `./runtime` wires up.
 *
 * Server-only, like `../snapshot`: `react-dom/server` and `@emotion/server`
 * have no place in a client bundle.
 */

import createCache, { type EmotionCache } from '@emotion/cache'
import { CacheProvider } from '@emotion/react'
import createEmotionServer from '@emotion/server/create-instance'
import { Box, ChakraProvider, Container } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'

import { I18nProvider, type Locale } from '@repo/i18n'
import { system } from '@repo/theme'

import type { ThemeContent, SectionInstance } from '../model/content'
import { drawnSections, pageEdges, type PageEdges } from '../model/drawn'
import type { MenuItem } from '../model/menus'
import { googleFontsHref, themeStylesheet } from '../model/settings'
import {
  isHeaderTransparent,
  StoreFooter,
  StoreHeader,
  StoreTabBar,
  type ChromeShop,
} from '../render/chrome'
import {
  RenderProvider,
  type RenderEnvironment,
  type StorefrontRenderData,
} from '../render/context'
import { PAGE_WIDTH_CONTAINER } from '../render/primitives'
import { SectionsRenderer } from '../render/renderer'
import { SitePopup } from '../render/popup'
import { SplashScreen, splashSkipScript } from '../render/splash'
import { HtmlChromeLink } from './chrome-links'

/** The four page templates a theme carries. */
export type HtmlTemplate = 'home' | 'product' | 'article' | 'catalog'

/** What the header and footer need that the theme itself does not hold. */
export interface HtmlChrome {
  /** The header's main menu. Empty falls back to the catalogue, as on the storefront. */
  menu?: MenuItem[]
  /** The footer's menu. */
  footerMenu?: MenuItem[]
  /** Published pages that ask to be in the footer. */
  pages?: Array<{ title: string; slug: string }>
  /** The footer's own words. English when omitted. */
  labels?: { information: string; followUs: string; links: string; trackOrder: string }
  /** Where the header's cart, account and search icons lead. */
  cartHref?: string
  accountHref?: string
  searchHref?: string
  /** The small print under the footer. */
  bottom?: string
  /** This page is the home page — the tab bar marks it, and a see-through header needs it. */
  home?: boolean
}

export interface HtmlRenderInput {
  content: ThemeContent
  /** The template to draw. Ignored when `sections` is given. Defaults to `home`. */
  template?: HtmlTemplate
  /** A custom page's own sections, instead of one of the theme's templates. */
  sections?: readonly SectionInstance[]
  data: StorefrontRenderData
  imageUrl: RenderEnvironment['imageUrl']
  formatPrice: RenderEnvironment['formatPrice']
  videoUrl?: RenderEnvironment['videoUrl']
  href?: RenderEnvironment['href']
  pageHref?: RenderEnvironment['pageHref']
  /** When scheduled sections and countdowns are judged. Defaults to now. */
  now?: Date
  /** `preview` makes empty sections explain themselves, as in an editor. Defaults to `live`. */
  mode?: RenderEnvironment['mode']
  /** The chrome's language ("Shop now", countdown units). Defaults to Indonesian. */
  locale?: Locale
  /**
   * The header, footer and phone tab bar. `false` draws the sections alone —
   * what an embed, or an editor's preview frame of one page, wants.
   */
  chrome?: HtmlChrome | false
}

export interface HtmlPage {
  /** The page's markup, to go inside `<body>`. */
  body: string
  /**
   * Everything `<head>` needs: the webfont link, the theme's variables and
   * every rule the markup uses, as `<style>` tags.
   */
  head: string
  /** Whether full-bleed sections meet the page's top and bottom edges. */
  edges: PageEdges
}

/** The emotion cache key every HTML render shares, so class names agree across renders. */
const CACHE_KEY = 'pb'

function environment(input: HtmlRenderInput): RenderEnvironment {
  return {
    data: input.data,
    settings: input.content.settings,
    mode: input.mode ?? 'live',
    imageUrl: input.imageUrl,
    videoUrl: input.videoUrl,
    formatPrice: input.formatPrice,
    href: input.href,
    pageHref: input.pageHref,
    now: input.now ?? new Date(),
    target: 'html',
  }
}

function sectionsOf(input: HtmlRenderInput): readonly SectionInstance[] {
  return input.sections ?? input.content.templates[input.template ?? 'home'] ?? []
}

/** Draw `tree` with the providers every section needs, and collect its CSS. */
function draw(
  input: HtmlRenderInput,
  env: RenderEnvironment,
  tree: ReactNode,
  /**
   * Prefixes every generated id (`useId`), so a fragment rendered on its own
   * never repeats an id the page it is swapped into already has.
   */
  identifierPrefix: string,
): {
  html: string
  chunks: ReturnType<ReturnType<typeof createEmotionServer>['extractCriticalToChunks']>
  cache: EmotionCache
} {
  const cache = createCache({ key: CACHE_KEY })
  const { extractCriticalToChunks } = createEmotionServer(cache)
  const html = renderToString(
    <CacheProvider value={cache}>
      <ChakraProvider value={system}>
        <I18nProvider locale={input.locale ?? 'id'} resources={{}}>
          <RenderProvider value={env}>{tree}</RenderProvider>
        </I18nProvider>
      </ChakraProvider>
    </CacheProvider>,
    { identifierPrefix },
  )
  return { html, chunks: extractCriticalToChunks(html), cache }
}

function styleTags(
  chunks: ReturnType<ReturnType<typeof createEmotionServer>['extractCriticalToChunks']>,
  { globals }: { globals: boolean },
): string {
  return chunks.styles
    .filter((chunk) => chunk.css && (globals || !chunk.key.endsWith('-global')))
    .map(
      (chunk) => `<style data-emotion="${chunk.key} ${chunk.ids.join(' ')}">${chunk.css}</style>`,
    )
    .join('')
}

/**
 * A whole storefront page: header, the template's sections, footer, the
 * phone tab bar, and the theme's splash and popup when it has them.
 */
export function renderPageHtml(input: HtmlRenderInput): HtmlPage {
  const env = environment(input)
  const settings = input.content.settings
  const sections = sectionsOf(input)
  const edges = pageEdges(drawnSections(sections, env.mode, env.now ?? new Date()))
  const chrome = input.chrome === false ? null : (input.chrome ?? {})
  const layout = input.content.layout
  const shop: ChromeShop = {
    name: input.data.shop.name,
    logoUrl: input.data.shop.logoUrl,
    description: input.data.shop.description,
    email: input.data.shop.email ?? null,
    phone: input.data.shop.phone ?? null,
    address: input.data.shop.address ?? null,
  }
  const home =
    chrome?.home ?? (input.sections === undefined && (input.template ?? 'home') === 'home')
  const transparent = !!chrome && home && isHeaderTransparent(layout.header, edges)

  const main = (
    <Box flex="1" {...PAGE_WIDTH_CONTAINER}>
      <Container
        as="main"
        maxW="6xl"
        px={{ base: '4', md: '6' }}
        pt={edges.flushTop ? '0' : { base: '6', md: '10' }}
        pb={edges.flushBottom ? '0' : { base: '6', md: '10' }}
      >
        <SectionsRenderer sections={sections} env={env} />
      </Container>
    </Box>
  )

  const tree = chrome ? (
    <>
      {settings.splash.enabled && (
        <SplashScreen settings={settings} shop={{ name: shop.name, logoUrl: shop.logoUrl }} />
      )}
      {settings.popup.kind !== 'none' && <SitePopup settings={settings} />}
      <Box display="flex" flexDirection="column" minH="dvh">
        <StoreHeader
          header={layout.header}
          shop={shop}
          menu={chrome.menu ?? []}
          categories={input.data.categories}
          collections={input.data.collections}
          searchButton={<HtmlChromeLink kind="search" href={chrome.searchHref ?? '/search'} />}
          cart={<HtmlChromeLink kind="cart" href={chrome.cartHref ?? '/cart'} />}
          account={<HtmlChromeLink kind="account" href={chrome.accountHref ?? '/account'} />}
          transparent={transparent}
        />
        {main}
        <StoreFooter
          footer={layout.footer}
          shop={shop}
          menu={chrome.footerMenu ?? []}
          categories={input.data.categories}
          collections={input.data.collections}
          pages={chrome.pages ?? []}
          labels={
            chrome.labels ?? {
              information: 'Information',
              followUs: 'Follow us',
              links: 'Links',
              trackOrder: 'Track order',
            }
          }
          bottom={chrome.bottom}
          flush={edges.flushBottom}
        />
        <StoreTabBar
          header={layout.header}
          homeActive={home}
          cart={<HtmlChromeLink kind="cart" href={chrome.cartHref ?? '/cart'} tab />}
          account={<HtmlChromeLink kind="account" href={chrome.accountHref ?? '/account'} tab />}
        />
      </Box>
    </>
  ) : (
    main
  )

  const { html, chunks } = draw(input, env, tree, 'pb-')
  const fonts = googleFontsHref(settings)
  const head = [
    settings.splash.enabled
      ? `<script>${splashSkipScript(settings.splash.oncePerSession)}</script>`
      : '',
    `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`,
    `<link rel="stylesheet" href="${escapeAttribute(fonts)}">`,
    `<style data-pb-theme>${themeStylesheet(settings)}</style>`,
    styleTags(chunks, { globals: true }),
  ].join('')

  return { body: html, head, edges }
}

/**
 * One section, as a fragment to swap into a page that is already showing —
 * what an htmx editor returns after a field changes. The section's own rules
 * travel with it as `<style>` tags in front of the markup; the page's global
 * styles (from `renderPageHtml`) are assumed to be there already.
 *
 * The fragment's root is the same element the full page draws for the
 * section (`id="section-<id>"`), so `hx-swap="outerHTML"` on that id replaces
 * it in place. `null` when the section is not drawn at all (a schedule that
 * has ended, a type with no renderer).
 */
export function renderSectionHtml(
  input: Omit<HtmlRenderInput, 'sections' | 'template' | 'chrome'> & { section: SectionInstance },
): string | null {
  const env = environment(input)
  const drawn = drawnSections([input.section], env.mode, env.now ?? new Date())
  if (drawn.length === 0) return null
  const { html, chunks } = draw(
    input,
    env,
    <SectionsRenderer sections={drawn} env={env} />,
    `pb-${input.section.id}-`,
  )
  // `SectionsRenderer` wraps its list in one stack; the fragment is the
  // section inside it.
  const inner = unwrapOuterElement(html)
  return styleTags(chunks, { globals: false }) + inner
}

export interface HtmlDocumentInput extends HtmlRenderInput {
  /** The page's `<title>`. */
  title?: string
  /** Extra markup for `<head>` — meta tags, the host's own stylesheet. */
  extraHead?: string
  /** Extra markup at the end of `<body>` — htmx, the host's own scripts. */
  extraBody?: string
  /**
   * Where the browser runtime is served from (see `PAGE_RUNTIME_PATH`).
   * Without it the page is static: sliders rest on their first slide and the
   * phone menu does not open.
   */
  runtimeSrc?: string
}

/** A complete HTML document for one storefront page. */
export function renderPageDocument(input: HtmlDocumentInput): string {
  const page = renderPageHtml(input)
  const locale = input.locale ?? 'id'
  return [
    '<!DOCTYPE html>',
    `<html lang="${escapeAttribute(locale)}">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    input.title ? `<title>${escapeText(input.title)}</title>` : '',
    page.head,
    input.extraHead ?? '',
    '</head>',
    '<body>',
    page.body,
    input.runtimeSrc ? `<script src="${escapeAttribute(input.runtimeSrc)}" defer></script>` : '',
    input.extraBody ?? '',
    '</body>',
    '</html>',
  ].join('')
}

/** The children of the outermost element in `html`. */
function unwrapOuterElement(html: string): string {
  const open = html.indexOf('>')
  const close = html.lastIndexOf('</')
  if (open < 0 || close < open) return html
  return html.slice(open + 1, close)
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function escapeText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}
