/**
 * Pages and sections as plain HTML (`@repo/page-builder/html`): what the
 * markup carries for a browser with no React — every overlay in place, the
 * slider's whole configuration, ids that cannot collide — and that the React
 * render beside it is untouched.
 */

import { describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { ChakraProvider } from '@chakra-ui/react'

import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

import {
  CONTENT_VERSION,
  createSection,
  DEFAULT_THEME_SETTINGS,
  sanitizeLayout,
  type SectionInstance,
  type ThemeContent,
} from '../src/index'
import { renderPageDocument, renderPageHtml, renderSectionHtml } from '../src/html/index'
import { createStarterSection } from '../src/model/section-starters'
import { sampleStorefrontData, SectionsRenderer, type RenderEnvironment } from '../src/render/index'

const MENU = [
  {
    id: 'shop',
    label: 'Shop',
    link: { kind: 'url' as const, href: 'https://example.com/shop' },
    children: [
      {
        id: 'bags',
        label: 'Bags',
        link: { kind: 'url' as const, href: 'https://example.com/bags' },
        children: [],
      },
    ],
  },
]

function content(home: SectionInstance[]): ThemeContent {
  return {
    version: CONTENT_VERSION,
    settings: DEFAULT_THEME_SETTINGS,
    layout: sanitizeLayout(null),
    templates: { home, product: [], article: [], catalog: [], orderTracking: [] },
    recommendedLooks: [],
  }
}

const base = {
  data: sampleStorefrontData('Plain shop'),
  imageUrl: (id: string) => `https://img.test/${id}`,
  formatPrice: (amount: number, currency: string) => `${currency} ${amount}`,
  locale: 'en' as const,
}

/** A testimonial carousel: a slider whose slides-per-view changes by breakpoint. */
function carousel(): SectionInstance {
  const starter = createStarterSection('quotes', null)
  return createSection('quotes', { ...starter.settings, layout: 'carousel' })
}

describe('renderPageHtml', () => {
  test('draws the page with its theme and every rule its markup uses', () => {
    const page = renderPageHtml({
      ...base,
      content: content([createSection('rich-text', { heading: 'Plain probe', body: 'Hello.' })]),
    })
    expect(page.body).toContain('Plain probe')
    expect(page.body).toContain('Plain shop')
    expect(page.head).toContain('<style data-pb-theme>')
    expect(page.head).toContain('<style data-emotion="pb')
    expect(page.head).toContain('fonts.googleapis.com')
  })

  test('puts the phone menu in the markup, closed, for the runtime to open', () => {
    const page = renderPageHtml({ ...base, content: content([]), chrome: { menu: MENU } })
    // React would portal the drawer on open; here its content is already there.
    expect(page.body).toMatch(
      /data-scope="dialog" data-part="trigger"[^>]*aria-controls="dialog:[^"]+:content"/,
    )
    expect(page.body).toMatch(/data-scope="dialog" data-part="content"[^>]*hidden=""/)
    expect(page.body).toContain('data-pb-header=""')
    // The desktop dropdown is mounted too, not lazily.
    expect(page.body).toContain('data-scope="hover-card" data-part="content"')
    expect(page.body).toContain('Bags')
  })

  test('leaves the chrome out when asked', () => {
    const page = renderPageHtml({
      ...base,
      content: content([createSection('rich-text', { heading: 'Alone' })]),
      chrome: false,
    })
    expect(page.body).toContain('Alone')
    expect(page.body).not.toContain('data-pb-header')
  })

  test('hands a slider its whole configuration, with no loop doubles in the markup', () => {
    const section = carousel()
    const page = renderPageHtml({ ...base, content: content([section]), chrome: false })
    const match = page.body.match(/data-pb-slider="([^"]+)"/)
    expect(match).not.toBeNull()
    const config = JSON.parse(match![1]!.replaceAll('&quot;', '"'))
    expect(config.perPage).toEqual({ base: 1, md: 2, lg: 3 })
    expect(config.breakpoints.md).toBeTruthy()
    // The runtime clones the doubles for the view it lands on.
    expect(page.body).not.toContain('aria-hidden="true" inert')
    // Each breakpoint's slide width is in the CSS, so the page lays out with no script.
    expect(page.head).toContain('calc((100% - 12px * 1) / 2)')
    expect(page.head).toContain('calc((100% - 12px * 2) / 3)')
  })

  test('renders a whole document that loads the runtime', () => {
    const html = renderPageDocument({
      ...base,
      content: content([]),
      title: 'A & B',
      runtimeSrc: '/assets/page-runtime.js',
    })
    expect(html).toStartWith('<!DOCTYPE html>')
    expect(html).toContain('<title>A &amp; B</title>')
    expect(html).toContain('<script src="/assets/page-runtime.js" defer></script>')
    expect(html).toContain('width=device-width')
  })
})

describe('renderSectionHtml', () => {
  test('returns one section, anchored by its id, with its own rules in front', () => {
    const section = createSection('rich-text', { heading: 'Fragment probe' })
    const html = renderSectionHtml({ ...base, content: content([]), section })!
    expect(html).toStartWith('<style data-emotion="pb ')
    expect(html).toContain(`id="section-${section.id}"`)
    expect(html).toContain('Fragment probe')
    // The page's globals (preflight, tokens) are already on the page.
    expect(html).not.toContain('pb-global')
  })

  test('prefixes generated ids with the section, so a swap never repeats one', () => {
    const section = createSection('faq', {
      items: [
        { question: 'One?', answer: 'Yes.' },
        { question: 'Two?', answer: 'No.' },
      ],
    })
    const html = renderSectionHtml({ ...base, content: content([]), section })!
    expect(html).toContain(`accordion:_pb-${section.id}-`)
  })

  test('draws nothing for a section whose schedule has ended', () => {
    const section = createSection(
      'rich-text',
      { heading: 'Gone' },
      { showUntil: '2020-01-01T00:00:00.000Z' },
    )
    expect(renderSectionHtml({ ...base, content: content([]), section })).toBeNull()
  })
})

describe('the React render is unchanged', () => {
  test('carries no runtime hooks and mounts no closed overlays', () => {
    const env: RenderEnvironment = {
      data: base.data,
      settings: DEFAULT_THEME_SETTINGS,
      mode: 'live',
      imageUrl: base.imageUrl,
      formatPrice: base.formatPrice,
    }
    const html = renderToString(
      <ChakraProvider value={system}>
        <I18nProvider locale="en" resources={{}}>
          <SectionsRenderer sections={[carousel()]} env={env} />
        </I18nProvider>
      </ChakraProvider>,
    )
    expect(html).toContain('data-slider-track')
    expect(html).not.toContain('data-pb-')
    expect(html).not.toContain('data-scope="dialog" data-part="content"')
  })
})
