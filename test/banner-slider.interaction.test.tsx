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

import { afterEach, describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import { cleanup, fireEvent, render, type RenderResult } from '@testing-library/react'

import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

import { DEFAULT_THEME_SETTINGS } from '../src/index'
import { RenderProvider, sampleStorefrontData, type RenderEnvironment } from '../src/render/index'
import { BannerSliderTrack, sliderTransform } from '../src/render/sections'

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
          <BannerSliderTrack
            slides={[
              { id: 'a', image: 's1' },
              { id: 'b', image: 's2' },
              { id: 'c', image: 's3' },
            ]}
            perPage={1}
            ratio={2}
            loop={false}
            autoplay={false}
          />
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
