/**
 * The framework-free runtime (`src/html/runtime.ts`) driving real markup from
 * `renderPageHtml`: the same HTML a non-React server would send, clicked in a
 * happy-dom window.
 *
 * The window is a local one, not the global registrator the other interaction
 * tests use: Emotion would see a global `document` and stop extracting CSS
 * from the server render these tests start from.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { Window } from 'happy-dom'

import {
  CONTENT_VERSION,
  createSection,
  DEFAULT_THEME_SETTINGS,
  sanitizeLayout,
  type SectionInstance,
  type ThemeContent,
  type ThemeSettings,
} from '../src/index'
import { renderPageHtml, renderSectionHtml } from '../src/html/index'
import { startPageRuntime } from '../src/html/runtime'
import { createStarterSection } from '../src/model/section-starters'
import { sampleStorefrontData } from '../src/render/index'

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

function content(
  home: SectionInstance[],
  settings: ThemeSettings = DEFAULT_THEME_SETTINGS,
): ThemeContent {
  return {
    version: CONTENT_VERSION,
    settings,
    layout: sanitizeLayout(null),
    templates: { home, product: [], article: [], catalog: [], orderTracking: [] },
    recommendedLooks: [],
  }
}

const base = {
  data: sampleStorefrontData('Runtime shop'),
  imageUrl: (id: string) => `https://img.test/${id}`,
  formatPrice: (amount: number, currency: string) => `${currency} ${amount}`,
  locale: 'en' as const,
}

const windows: Window[] = []
afterEach(async () => {
  for (const window of windows.splice(0)) await window.happyDOM.close()
})

/** A page rendered to HTML, loaded in a fresh window with the runtime started. */
function load(
  sections: SectionInstance[],
  options: { width?: number; settings?: ThemeSettings; chrome?: boolean } = {},
) {
  const page = renderPageHtml({
    ...base,
    content: content(sections, options.settings),
    chrome: options.chrome === false ? false : { menu: MENU },
  })
  const window = new Window({
    width: options.width ?? 1280,
    height: 800,
    url: 'https://shop.test/',
  })
  windows.push(window)
  const doc = window.document as unknown as Document
  doc.head.innerHTML = page.head
  doc.body.innerHTML = page.body
  startPageRuntime(doc)
  return { window, doc }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function faq(): SectionInstance {
  return createSection('faq', {
    items: [
      { question: 'One?', answer: 'First answer.' },
      { question: 'Two?', answer: 'Second answer.' },
    ],
  })
}

/** The banner slider at one slide a view, looping. */
function loopingBanner(): SectionInstance {
  const starter = createStarterSection('banner-slider', null)
  return createSection('banner-slider', {
    ...starter.settings,
    perPage: '1',
    perPageMobile: '1',
    loop: true,
  })
}

function slider(
  doc: Document,
  match: (config: { perPage: Record<string, number>; loop: boolean }) => boolean,
) {
  const root = [...doc.querySelectorAll<HTMLElement>('[data-pb-slider]')].find((element) =>
    match(JSON.parse(element.getAttribute('data-pb-slider')!)),
  )!
  const dots = () =>
    [...root.querySelectorAll('[data-pb-slider-dot]')]
      .filter((dot) => !(dot as HTMLElement).hidden)
      .map((dot) => (dot.getAttribute('aria-current') ? '●' : '○'))
      .join('')
  return {
    root,
    track: root.querySelector<HTMLElement>('[data-slider-track]')!,
    next: root.querySelector<HTMLButtonElement>('[data-pb-slider-next]')!,
    prev: root.querySelector<HTMLButtonElement>('[data-pb-slider-prev]')!,
    dots,
  }
}

describe('accordion', () => {
  test('opens one answer at a time', () => {
    const { doc } = load([faq()], { chrome: false })
    const triggers = [
      ...doc.querySelectorAll<HTMLElement>('[data-scope="accordion"][data-part="item-trigger"]'),
    ]
    const panel = (trigger: HTMLElement) =>
      doc.getElementById(trigger.getAttribute('aria-controls')!)!
    expect(panel(triggers[0]!).hidden).toBe(true)

    triggers[0]!.click()
    expect(triggers[0]!.getAttribute('aria-expanded')).toBe('true')
    expect(panel(triggers[0]!).hidden).toBe(false)
    expect(panel(triggers[0]!).getAttribute('data-state')).toBe('open')

    triggers[1]!.click()
    expect(triggers.map((trigger) => trigger.getAttribute('aria-expanded'))).toEqual([
      'false',
      'true',
    ])
    expect(panel(triggers[0]!).getAttribute('data-state')).toBe('closed')
  })
})

describe('phone menu', () => {
  test('opens over the page, closes on Escape, and goes back where it was', () => {
    const { doc, window } = load([], { width: 375 })
    const trigger = doc.querySelector<HTMLElement>('[data-scope="dialog"][data-part="trigger"]')!
    const content = doc.getElementById(trigger.getAttribute('aria-controls')!)!
    expect(content.closest('header')).not.toBeNull()

    trigger.click()
    expect(content.getAttribute('data-state')).toBe('open')
    expect(content.hidden).toBe(false)
    // Lifted out of the blurred header, which would trap a fixed child.
    expect(content.closest('header')).toBeNull()
    expect(doc.body.style.overflow).toBe('hidden')
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    doc.dispatchEvent(
      new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }) as unknown as Event,
    )
    expect(content.getAttribute('data-state')).toBe('closed')
    expect(content.hidden).toBe(true)
    expect(content.closest('header')).not.toBeNull()
    expect(doc.body.style.overflow).toBe('')
  })

  test('a link inside it closes it', () => {
    const { doc } = load([], { width: 375 })
    const trigger = doc.querySelector<HTMLElement>('[data-scope="dialog"][data-part="trigger"]')!
    const content = doc.getElementById(trigger.getAttribute('aria-controls')!)!
    trigger.click()
    content.querySelector<HTMLElement>('a[href]')!.click()
    expect(content.getAttribute('data-state')).toBe('closed')
  })
})

describe('slider', () => {
  test('a loop wraps past the last slide onto the first, both ways', async () => {
    const { doc } = load([loopingBanner()], { chrome: false })
    const banner = slider(doc, (config) => config.loop && config.perPage.base === 1)
    // One slide a view, so one double at each end.
    expect(banner.track.querySelectorAll('[data-pb-clone]').length).toBe(2)
    expect(banner.dots()).toBe('●○○')

    const settle = async () => {
      banner.track.dispatchEvent(
        new (doc.defaultView as unknown as typeof globalThis).Event('transitionend'),
      )
      await wait(80)
    }
    banner.next.click()
    await settle()
    expect(banner.dots()).toBe('○●○')
    banner.next.click()
    await settle()
    banner.next.click()
    await settle()
    expect(banner.dots()).toBe('●○○')
    banner.prev.click()
    await settle()
    expect(banner.dots()).toBe('○○●')
  })

  test('takes slides per view from the width, and hides arrows when all fit', () => {
    const quotes = createSection('quotes', {
      ...createStarterSection('quotes', null).settings,
      layout: 'carousel',
    })
    // Three quotes: one a view on a phone, all three on a desktop.
    const phone = load([quotes], { chrome: false, width: 375 })
    const small = slider(phone.doc, (config) => config.perPage.lg === 3)
    expect(small.next.hidden).toBe(false)
    expect(small.next.disabled).toBe(false)
    expect(small.prev.disabled).toBe(true)

    const desktop = load([quotes], { chrome: false, width: 1280 })
    const wide = slider(desktop.doc, (config) => config.perPage.lg === 3)
    expect(wide.next.hidden).toBe(true)
    expect(wide.track.querySelector<HTMLElement>('[data-slider-slide]')!.style.flex).toContain(
      '/ 3',
    )
  })
})

describe('countdown', () => {
  test('ticks, and leaves the page once the sale ends', async () => {
    const endsAt = new Date(Date.now() + 1200).toISOString()
    const { doc } = load([createSection('countdown', { heading: 'Sale', endsAt })], {
      chrome: false,
    })
    const units = () => [...doc.querySelectorAll('[data-pb-unit]')].map((unit) => unit.textContent)
    expect(units()).toEqual(['00', '00', '00', '01'])
    // It ticks once a second, so the end is seen on the second tick.
    await wait(2200)
    const anchor = doc.querySelector<HTMLElement>('[id^="section-"]')!
    expect(anchor.hidden).toBe(true)
  })

  test('shows its ended message when asked to', async () => {
    const endsAt = new Date(Date.now() + 300).toISOString()
    const { doc } = load(
      [
        createSection('countdown', {
          heading: 'Sale',
          endsAt,
          afterEnd: 'message',
          endedText: 'See you next time',
        }),
      ],
      { chrome: false },
    )
    const ended = doc.querySelector<HTMLElement>('[data-pb-countdown-ended]')!
    expect(ended.hidden).toBe(true)
    await wait(1200)
    expect(ended.hidden).toBe(false)
    expect(ended.textContent).toContain('See you next time')
    expect(
      doc.querySelector<HTMLElement>('[role="timer"]')!.closest<HTMLElement>('[hidden]'),
    ).not.toBeNull()
  })
})

describe('voucher', () => {
  test('copies its code and says so', async () => {
    const { doc, window } = load([createStarterSection('promo-codes', null)], { chrome: false })
    let copied = ''
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText: async (text: string) => void (copied = text) },
      configurable: true,
    })
    const button = doc.querySelector<HTMLElement>('[data-pb-copy]')!
    button.click()
    await wait(10)
    expect(copied).toBe(button.getAttribute('data-pb-copy')!)
    expect(button.querySelector<HTMLElement>('[data-pb-copy-done]')!.hidden).toBe(false)
    expect(button.querySelector<HTMLElement>('[data-pb-copy-idle]')!.hidden).toBe(true)
  })
})

describe('cookie notice', () => {
  test('stays away once answered this session', () => {
    const settings: ThemeSettings = {
      ...DEFAULT_THEME_SETTINGS,
      popup: { ...DEFAULT_THEME_SETTINGS.popup, kind: 'cookie', oncePerSession: true },
    }
    const first = load([], { settings })
    const bar = first.doc.querySelector<HTMLElement>('[data-pb-popup="cookie"]')!
    expect(bar.hidden).toBe(false)
    bar.querySelector<HTMLElement>('[data-pb-popup-close]')!.click()
    expect(bar.hidden).toBe(true)
    expect(first.window.sessionStorage.getItem('pb-popup:cookie')).toBe('1')
  })
})

describe('swapping a section in (htmx and friends)', () => {
  test('a fragment from renderSectionHtml works with no extra call', async () => {
    const section = loopingBanner()
    const { doc } = load([createSection('rich-text', { heading: 'Before' })], { chrome: false })
    const old = doc.querySelector<HTMLElement>('[id^="section-"]')!
    old.outerHTML = renderSectionHtml({ ...base, content: content([]), section })!
    // The observer picks the new slider up on the next microtask.
    await wait(0)
    const swapped = slider(doc, (config) => config.loop && config.perPage.base === 1)
    expect(swapped.track.querySelectorAll('[data-pb-clone]').length).toBe(2)
    swapped.next.click()
    swapped.track.dispatchEvent(
      new (doc.defaultView as unknown as typeof globalThis).Event('transitionend'),
    )
    await wait(80)
    expect(swapped.dots()).toBe('○●○')
  })
})
