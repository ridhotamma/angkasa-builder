/**
 * A fractional slides-per-view.
 *
 * A seller may ask for 1.5, 2.5, 3.2 … slides at once, so the next card
 * peeks at the band's edge — on phones and on desktops alike. The slider
 * still steps one whole slide at a time, and the last position settles on the
 * last slide with its edge flush with the band's, never half-cut.
 */

import './happy-dom-setup'

import { afterEach, describe, expect, test } from 'bun:test'
import { Box, ChakraProvider } from '@chakra-ui/react'
import { cleanup, fireEvent, render, type RenderResult } from '@testing-library/react'

import { LocaleProvider } from '../src/locale'
import { system } from '../src/ui'

import { DEFAULT_THEME_SETTINGS } from '../src/index'
import { RenderProvider, sampleStorefrontData, type RenderEnvironment } from '../src/render/index'
import { Slider, sliderBasis, sliderStep, sliderTransform } from '../src/render/slider'

afterEach(() => cleanup())

function env(): RenderEnvironment {
  return {
    data: sampleStorefrontData('Peek Shop'),
    settings: { ...DEFAULT_THEME_SETTINGS, splash: { ...DEFAULT_THEME_SETTINGS.splash } },
    mode: 'live',
    imageUrl: () => null,
    formatPrice: (amount, currency) => `${amount} ${currency}`,
    now: new Date('2026-03-10T00:00:00.000Z'),
  }
}

/** Eight slides, `perPage` of them in view. */
function view(perPage: number): RenderResult {
  return render(
    <ChakraProvider value={system}>
      <LocaleProvider locale="en">
        <RenderProvider value={env()}>
          <Slider count={8} perPage={perPage} dots="below">
            {Array.from({ length: 8 }, (_, index) => (
              <Box key={index} bg="bg.subtle" h="full" />
            ))}
          </Slider>
        </RenderProvider>
      </LocaleProvider>
    </ChakraProvider>,
  )
}

/** The row's own transform. */
function shift(row: RenderResult): string {
  return row.container.querySelector<HTMLElement>('[data-slider-track]')!.style.transform
}

function next(row: RenderResult): HTMLButtonElement {
  return row.getByLabelText('Next slide') as HTMLButtonElement
}

describe('a fractional slides-per-view', () => {
  test('sizes the slides and the step by the fraction', () => {
    // A slide is 2.5-to-a-row wide: (100% − 1.5 gaps) / 2.5, and a step is
    // that slide plus one gap.
    expect(sliderBasis(2.5)).toBe('(100% - 12px * 1.5) / 2.5')
    expect(sliderStep(2.5)).toBe('calc((100% - 12px * 1.5) / 2.5 + 12px)')
    expect(sliderBasis(3.2)).toBe('(100% - 12px * 2.2) / 3.2')
    // No floating-point noise in the rule: 1.2 counts one fifth of a gap.
    expect(sliderBasis(1.2)).toBe('(100% - 12px * 0.2) / 1.2')
  })

  test('still steps whole slides, one press each', () => {
    const row = view(2.5)
    for (let step = 1; step <= 5; step += 1) {
      fireEvent.click(next(row))
      expect(shift(row), `step ${step}`).toBe(sliderTransform(step, 2.5))
    }
    // The sixth press leaves the last whole slide: the track clamps to
    // `count − perPage` (5.5) and stops there.
    fireEvent.click(next(row))
    expect(shift(row)).toBe(sliderTransform(5.5, 2.5))
  })

  test('ends on the last slide, its edge flush with the band', () => {
    const row = view(2.5)
    for (let step = 0; step < 6; step += 1) fireEvent.click(next(row))
    // Past the last whole slide the track clamps to `count − perPage` (5.5),
    // so the row ends right-aligned rather than half-cut — and the arrow is
    // done, because the row does not loop.
    expect(shift(row)).toBe(sliderTransform(5.5, 2.5))
    expect(next(row).disabled).toBe(true)
    fireEvent.click(next(row))
    expect(shift(row)).toBe(sliderTransform(5.5, 2.5))
  })

  test('one dot per resting position, a whole number of them', () => {
    const row = view(2.5)
    const dots = row.container.querySelectorAll('[aria-label^="Slide "]')
    // Positions 1 … 6, plus the right-aligned end: seven.
    expect(dots.length).toBe(7)
    expect(row.container.querySelector('[aria-label="Slide 8"]')).toBeNull()
  })

  test('a whole view keeps its old geometry', () => {
    const row = view(2)
    const dots = row.container.querySelectorAll('[aria-label^="Slide "]')
    expect(dots.length).toBe(7)
    for (let step = 0; step < 6; step += 1) fireEvent.click(next(row))
    expect(shift(row)).toBe(sliderTransform(6, 2))
    expect(next(row).disabled).toBe(true)
  })
})
