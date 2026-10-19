/**
 * How the banner slider moves, and how it does not.
 *
 * The band is deliberately **not** a scroll container: a mouse drag inside it
 * belongs to the page (and, in the editor, to dragging blocks), never to the
 * slider. A finger, though, drags the row — and the dots and arrows are the
 * other two ways to change page. These tests click, swipe and drag for real,
 * scoped to happy-dom (see `./happy-dom-setup`).
 */

import './happy-dom-setup'

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { Box, ChakraProvider } from '@chakra-ui/react'
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
  type RenderResult,
} from '@testing-library/react'

import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

import { createSection, DEFAULT_THEME_SETTINGS } from '../src/index'
import {
  RenderProvider,
  sampleStorefrontData,
  SectionsRenderer,
  type RenderEnvironment,
} from '../src/render/index'
import { Slider, sliderTransform } from '../src/render/slider'

afterEach(() => cleanup())

function env(): RenderEnvironment {
  return {
    data: sampleStorefrontData('Slider Shop'),
    settings: { ...DEFAULT_THEME_SETTINGS, splash: { ...DEFAULT_THEME_SETTINGS.splash } },
    mode: 'live',
    imageUrl: () => null,
    formatPrice: (amount, currency) => `${amount} ${currency}`,
    now: new Date('2026-03-10T00:00:00.000Z'),
  }
}

function track(): RenderResult {
  return render(
    <ChakraProvider value={system}>
      <I18nProvider locale="en" resources={{}}>
        <RenderProvider value={env()}>
          <Slider count={3} perPage={1} ratio={2} dots="inside">
            <Box bg="bg.subtle" h="full" />
            <Box bg="bg.subtle" h="full" />
            <Box bg="bg.subtle" h="full" />
          </Slider>
        </RenderProvider>
      </I18nProvider>
    </ChakraProvider>,
  )
}

/** The row's own transform, as the component wrote it. */
function shift(view: RenderResult): string {
  return view.container.querySelector<HTMLElement>('[data-slider-track]')!.style.transform
}

function band(view: RenderResult): Element {
  return view.container.querySelector('[data-slider-band]')!
}

function pointer(
  target: Element,
  type: 'pointerDown' | 'pointerMove' | 'pointerUp',
  pointerType: string,
  clientX: number,
) {
  fireEvent[type](target, { pointerId: 1, pointerType, clientX })
}

describe('the wrap of a loop', () => {
  /** The same track, looped. */
  function looped(): RenderResult {
    return render(
      <ChakraProvider value={system}>
        <I18nProvider locale="en" resources={{}}>
          <RenderProvider value={env()}>
            <Slider count={3} perPage={1} ratio={2} loop dots="inside">
              <Box bg="bg.subtle" h="full" />
              <Box bg="bg.subtle" h="full" />
              <Box bg="bg.subtle" h="full" />
            </Slider>
          </RenderProvider>
        </I18nProvider>
      </ChakraProvider>,
    )
  }

  test('a step past either end glides on, then lands without a rewind', () => {
    const view = looped()
    // The doubles put the first slide one page into the track.
    expect(shift(view)).toBe(sliderTransform(1, 1))
    fireEvent.click(view.getByLabelText('Previous slide'))
    // Backward from the first slide: onto the last slide's double, one step —
    // not a jump across the whole run.
    expect(shift(view)).toBe('translateX(0)')
    fireEvent.transitionEnd(view.container.querySelector('[data-slider-track]')!, {
      propertyName: 'transform',
    })
    // The jump back is the last resting position, and the same pixels.
    expect(shift(view)).toBe(sliderTransform(3, 1))
  })

  test('a wrap whose transition never ends settles on its own', async () => {
    const view = looped()
    fireEvent.click(view.getByLabelText('Previous slide'))
    expect(shift(view)).toBe('translateX(0)')
    // No `transitionend` ever comes — the track inside a section hidden on
    // this device, say — so the wrap lands on its own beat instead, and the
    // next step is never swallowed.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 800))
    })
    expect(shift(view)).toBe(sliderTransform(3, 1))
  })
})

describe('a drag across several slides', () => {
  // The finger moves in a single tick here; the wall clock can still read a
  // slow test run as a fast flick. Pin it so each drag settles by distance —
  // exactly what the expectations describe.
  let clock: () => number
  beforeEach(() => {
    clock = performance.now
    performance.now = () => 0
  })
  afterEach(() => {
    performance.now = clock
  })

  /** Eight slides, one per view, so a flick has room to travel. */
  function row(): RenderResult {
    return render(
      <ChakraProvider value={system}>
        <I18nProvider locale="en" resources={{}}>
          <RenderProvider value={env()}>
            <Slider count={8} perPage={1} dots="below">
              {Array.from({ length: 8 }, (_, index) => (
                <Box key={index} bg="bg.subtle" h="full" />
              ))}
            </Slider>
          </RenderProvider>
        </I18nProvider>
      </ChakraProvider>,
    )
  }

  /** happy-dom has no layout: give the first slide a width to measure. */
  function stubSlideWidth(view: RenderResult, width: number) {
    const first = view.container.querySelector<HTMLElement>('[data-slider-slide]')!
    Object.defineProperty(first, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        width,
        height: width,
        top: 0,
        left: 0,
        right: width,
        bottom: width,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    })
  }

  test('lands where the finger stopped, not just the next page', () => {
    const view = row()
    stubSlideWidth(view, 100) // a slide, plus the 12px gap, is 112px
    pointer(band(view), 'pointerDown', 'touch', 600)
    pointer(band(view), 'pointerMove', 'touch', 600 - 336)
    pointer(band(view), 'pointerUp', 'touch', 600 - 336)
    expect(shift(view)).toBe(sliderTransform(3, 1))
  })

  test('flicks backwards the same way', () => {
    const view = row()
    stubSlideWidth(view, 100)
    fireEvent.click(view.getByLabelText('Slide 6'))
    expect(shift(view)).toBe(sliderTransform(5, 1))
    pointer(band(view), 'pointerDown', 'touch', 0)
    pointer(band(view), 'pointerMove', 'touch', 224)
    pointer(band(view), 'pointerUp', 'touch', 224)
    expect(shift(view)).toBe(sliderTransform(3, 1))
  })

  test('a drag past the end stops on the last slide', () => {
    const view = row()
    stubSlideWidth(view, 100)
    pointer(band(view), 'pointerDown', 'touch', 900)
    pointer(band(view), 'pointerMove', 'touch', 0)
    pointer(band(view), 'pointerUp', 'touch', 0)
    // 900px over 112px steps is eight slides; the row has seven other
    // positions, so it ends on the last.
    expect(shift(view)).toBe(sliderTransform(7, 1))
  })

  test('a drag that stops between two slides snaps to the nearer one', () => {
    const view = row()
    stubSlideWidth(view, 100)
    pointer(band(view), 'pointerDown', 'touch', 600)
    pointer(band(view), 'pointerMove', 'touch', 550) // 0.45 slides
    pointer(band(view), 'pointerUp', 'touch', 550)
    expect(shift(view)).toBe(sliderTransform(0, 1))

    pointer(band(view), 'pointerDown', 'touch', 600)
    pointer(band(view), 'pointerMove', 'touch', 540) // 0.54 slides
    pointer(band(view), 'pointerUp', 'touch', 540)
    expect(shift(view)).toBe(sliderTransform(1, 1))
  })
})

/** A window whose one breakpoint answer the test sets. */
function windowAt(desktop: boolean): Window {
  return {
    matchMedia: (query: string) => ({
      matches: desktop,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  } as unknown as Window
}

describe('the banner slider view', () => {
  /** The banner section itself, as the storefront draws it. */
  function banner(
    { slides = 3, desktop = true, editing = false, ...settings }: {
      slides?: number
      desktop?: boolean
      editing?: boolean
      loop?: boolean
      perPage?: string
      perPageMobile?: string
    } = {},
  ): RenderResult {
    return render(
      <ChakraProvider value={system}>
        <I18nProvider locale="en" resources={{}}>
          <SectionsRenderer
            sections={[
              createSection('banner-slider', {
                perPage: settings.perPage ?? '2',
                perPageMobile: settings.perPageMobile ?? '1',
                loop: settings.loop ?? true,
                slides: Array.from({ length: slides }, (_, index) => ({
                  image: `s${index + 1}`,
                  alt: `Banner ${index + 1}`,
                })),
              }),
            ]}
            env={{
              ...env(),
              getWindow: () => windowAt(desktop),
              ...(editing && {
                mode: 'preview' as const,
                editing: { onEditText: () => undefined },
              }),
            }}
          />
        </I18nProvider>
      </ChakraProvider>,
    )
  }

  /**
   * The SSR variant the test's window shows. Phone and desktop each ship their
   * own slider; only the one for the reported breakpoint is queried.
   */
  function scopeOf(view: RenderResult, name: 'phone' | 'desktop' = 'desktop') {
    return (
      view.container.querySelector<HTMLElement>(`[data-banner-variant="${name}"]`) ?? view.container
    )
  }

  function inScope(view: RenderResult, name: 'phone' | 'desktop' = 'desktop') {
    return within(scopeOf(view, name))
  }

  function shiftOf(view: RenderResult, name: 'phone' | 'desktop' = 'desktop') {
    return scopeOf(view, name).querySelector<HTMLElement>('[data-slider-track]')!.style.transform
  }

  test('one banner in view keeps the dots over the photo', async () => {
    const view = banner({ perPage: '1' })
    const dot = await waitFor(() => view.getByLabelText('Slide 1'))
    // Over the band, the indicator rides inside the slider's own frame.
    expect(dot.closest('[data-slider-frame]')).not.toBeNull()
  })

  test('more than one banner in view moves the dots below the band', async () => {
    const view = banner({ perPage: '2' })
    const desktop = inScope(view)
    const dot = await waitFor(() => desktop.getByLabelText('Slide 1'))
    // Under the band: a row after the slider's frame, not over the photos.
    expect(dot.closest('[data-slider-frame]')).toBeNull()
  })

  test('a looped full view still rotates, with its arrows and dots', async () => {
    // Three slides all in view: there is no hidden slide to page to, but a
    // looped banner cycles the set one place at a time instead of freezing.
    const view = banner({ perPage: '3' })
    const desktop = inScope(view)
    const next = await waitFor(() => desktop.getByLabelText('Next slide') as HTMLButtonElement)
    await waitFor(() => expect(desktop.queryAllByLabelText(/^Slide \d$/)).toHaveLength(3))
    expect(next.disabled).toBe(false)
    expect(desktop.getByLabelText('Slide 1').getAttribute('aria-current')).toBe('true')

    fireEvent.click(next)
    expect(desktop.getByLabelText('Slide 2').getAttribute('aria-current')).toBe('true')
    expect(shiftOf(view)).toBe(sliderTransform(4, 3)) // one step on from the tail's three
    fireEvent.click(next)
    fireEvent.click(next)
    expect(desktop.getByLabelText('Slide 1').getAttribute('aria-current')).toBe('true')
  })

  test('the full view rotates in the editor preview too', async () => {
    const view = banner({ perPage: '3', editing: true })
    const desktop = inScope(view)
    const next = await waitFor(() => desktop.getByLabelText('Next slide') as HTMLButtonElement)
    fireEvent.click(next)
    expect(desktop.getByLabelText('Slide 2').getAttribute('aria-current')).toBe('true')
  })

  test('a full view with loop off stays a still row', async () => {
    const view = banner({ perPage: '3', loop: false })
    const desktop = inScope(view)
    await waitFor(() =>
      expect(scopeOf(view).querySelector('[data-slider-track]')).not.toBeNull(),
    )
    expect(desktop.queryByLabelText('Next slide')).toBeNull()
    expect(desktop.queryByLabelText('Slide 1')).toBeNull()
  })

  test('the editor picker lets the slider controls act, but selects the section', async () => {
    const onSelect = mock(() => undefined)
    const view = render(
      <ChakraProvider value={system}>
        <I18nProvider locale="en" resources={{}}>
          <SectionsRenderer
            sections={[
              createSection('banner-slider', {
                perPage: '3',
                loop: true,
                slides: [{ image: 's1' }, { image: 's2' }, { image: 's3' }],
              }),
            ]}
            env={{ ...env(), getWindow: () => windowAt(true) }}
            onSelect={onSelect}
          />
        </I18nProvider>
      </ChakraProvider>,
    )
    const desktop = inScope(view)
    const next = await waitFor(() => desktop.getByLabelText('Next slide') as HTMLButtonElement)
    // An arrow pages the banner instead of being swallowed by the picker.
    fireEvent.click(next)
    expect(desktop.getByLabelText('Slide 2').getAttribute('aria-current')).toBe('true')
    expect(onSelect).not.toHaveBeenCalled()
    // Anywhere else in the section still selects it.
    fireEvent.click(view.container.querySelector('[data-slider-slide]')!)
    expect(onSelect).toHaveBeenCalled()
  })

  test('a fractional view reaches the slides, on desktop and phone alike', async () => {
    // 2.5 banners across a desktop, 1.5 across a phone: the next one peeks,
    // so there are fewer resting positions (dots) on the desktop.
    const desktopView = banner({ perPage: '2.5', perPageMobile: '1.5', desktop: true })
    const desktop = inScope(desktopView)
    const desktopNext = await waitFor(
      () => desktop.getByLabelText('Next slide') as HTMLButtonElement,
    )
    await waitFor(() => expect(desktop.queryAllByLabelText(/^Slide \d$/)).toHaveLength(2))
    fireEvent.click(desktopNext)
    // The last position clamps to count − perPage (0.5), so the final slide
    // sits flush instead of half-cut.
    expect(shiftOf(desktopView)).toBe(sliderTransform(0.5, 2.5))
    cleanup()

    const phoneView = banner({ perPage: '2.5', perPageMobile: '1.5', desktop: false })
    const phone = inScope(phoneView, 'phone')
    const phoneNext = await waitFor(() => phone.getByLabelText('Next slide') as HTMLButtonElement)
    await waitFor(() => expect(phone.queryAllByLabelText(/^Slide \d$/)).toHaveLength(3))
    fireEvent.click(phoneNext)
    expect(shiftOf(phoneView, 'phone')).toBe(sliderTransform(1, 1.5))
  })

  test('the arrows are not clipped by the band they straddle', async () => {
    const view = banner({ perPage: '2' })
    const desktop = inScope(view)
    const next = await waitFor(() => desktop.getByLabelText('Next slide'))
    // The overlays sit beside the clipped band, never inside it: the photo
    // band clips its own children, which once sawed this pair in half.
    expect(next.closest('[data-slider-band]')).toBeNull()
    expect(next.closest('[data-slider-frame]')).not.toBeNull()
  })

  test('a lone banner stays a still picture with no indicator', async () => {
    const view = banner({ slides: 1 })
    // Let the image-settled effect run; a lone banner never becomes a slider.
    await act(async () => {
      await Promise.resolve()
    })
    expect(view.container.querySelector('[data-slider-track]')).toBeNull()
    expect(view.container.querySelector('[aria-label^="Slide "]')).toBeNull()
    expect(view.container.querySelector('[aria-label="Next slide"]')).toBeNull()
  })
})

describe('the banner slider', () => {
  test('a dot moves the track, and the active dot is the one showing', () => {
    const view = track()
    expect(shift(view)).toBe('translateX(0)')
    fireEvent.click(view.getByLabelText('Slide 2'))
    expect(shift(view)).toBe(sliderTransform(1, 1))
    expect(view.getByLabelText('Slide 2').getAttribute('aria-current')).toBe('true')
    expect(view.getByLabelText('Slide 1').getAttribute('aria-current')).toBeNull()
  })

  test('an arrow moves one page, and stops at the ends without a loop', () => {
    const view = track()
    fireEvent.click(view.getByLabelText('Next slide'))
    expect(shift(view)).toBe(sliderTransform(1, 1))
    fireEvent.click(view.getByLabelText('Next slide'))
    expect(shift(view)).toBe(sliderTransform(2, 1))
    // No loop: the last page is the last page.
    expect((view.getByLabelText('Next slide') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(view.getByLabelText('Previous slide'))
    expect(shift(view)).toBe(sliderTransform(1, 1))
  })

  test('a finger drags the row and settles on the next page', () => {
    const view = track()
    pointer(band(view), 'pointerDown', 'touch', 300)
    pointer(band(view), 'pointerMove', 'touch', 200)
    // Mid-drag the row follows the finger: the position plus its offset.
    expect(shift(view)).toBe(sliderTransform(0, 1, -100))
    pointer(band(view), 'pointerUp', 'touch', 200)
    expect(shift(view)).toBe(sliderTransform(1, 1))
  })

  test('a mouse drag leaves the slider where it is', () => {
    const view = track()
    pointer(band(view), 'pointerDown', 'mouse', 300)
    pointer(band(view), 'pointerMove', 'mouse', 120)
    pointer(band(view), 'pointerUp', 'mouse', 120)
    // The mouse belongs to the page — and, in the editor, to block dragging.
    expect(shift(view)).toBe('translateX(0)')
  })
})
