/**
 * The marquee's pause is one boolean we own.
 *
 * Zag's own `pauseOnInteraction` cannot be trusted beside a controlled
 * `paused`: a focused node that unmounts — the editor re-renders a marquee's
 * copies when a block inside is selected — fires no blur, the machine stays
 * paused, and taking the controlled `paused` away again cannot release it.
 * The track then never runs again. These tests pin every reason to pause and
 * every way back, including the click-away that used to leave it stuck.
 *
 * Scoped to happy-dom (see `./happy-dom-setup`) so the rest of the folder
 * keeps its fast string renderer.
 */

import './happy-dom-setup'

import { afterEach, describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import { cleanup, fireEvent, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'

import { LocaleProvider } from '../src/locale'
import { system } from '../src/ui'

import { createSection, DEFAULT_THEME_SETTINGS } from '../src/index'
import { sampleStorefrontData, SectionsRenderer, type RenderEnvironment } from '../src/render/index'

afterEach(() => cleanup())

const heading = (id: string, text: string) => ({ id, type: 'heading', settings: { text } })

function marquee(pauseOnHover: boolean) {
  return {
    id: 'mq',
    type: 'marquee',
    settings: {
      pauseOnHover,
      blocks: [heading('m1', 'Free delivery'), heading('m2', 'Made by hand')],
    },
  }
}

function env(selectedBlockId: string | null): RenderEnvironment {
  return {
    data: sampleStorefrontData('Moving Shop'),
    settings: DEFAULT_THEME_SETTINGS,
    mode: 'preview',
    imageUrl: () => null,
    formatPrice: (amount, currency) => `${amount} ${currency}`,
    now: new Date('2026-03-10T00:00:00.000Z'),
    editing: {
      onEditText: () => undefined,
      onEditBlockText: () => undefined,
      onSelectBlock: () => undefined,
      selectedBlockId,
    },
  }
}

function draw(selectedBlockId: string | null, pauseOnHover = true): HTMLElement {
  const section = createSection('blocks', { blocks: [marquee(pauseOnHover)] })
  const environment = env(selectedBlockId)
  const tree: ReactNode = <SectionsRenderer sections={[section]} env={environment} />
  const { container } = render(
    <ChakraProvider value={system}>
      <LocaleProvider locale="en">
        {tree}
      </LocaleProvider>
    </ChakraProvider>,
  )
  const track = container.querySelector<HTMLElement>('[data-scope="marquee"][data-part="root"]')
  if (!track) throw new Error('no marquee root rendered')
  return track
}

describe('the marquee block pause', () => {
  test('a block selected inside holds the track still', () => {
    expect(draw('m1').hasAttribute('data-paused')).toBe(true)
  })

  test('no selection, and the track runs', () => {
    expect(draw(null).hasAttribute('data-paused')).toBe(false)
  })

  test('the pointer pauses it, and leaving resumes', async () => {
    const track = draw(null)
    await userEvent.hover(track)
    expect(track.hasAttribute('data-paused')).toBe(true)
    await userEvent.unhover(track)
    expect(track.hasAttribute('data-paused')).toBe(false)
  })

  test('focus pauses it, and a click anywhere outside resumes it', () => {
    const track = draw(null)
    fireEvent.focus(track)
    expect(track.hasAttribute('data-paused')).toBe(true)
    // The regression: no blur fires when the focused node is re-rendered away,
    // so a click elsewhere is the resume this test pins.
    fireEvent.pointerDown(document.body)
    expect(track.hasAttribute('data-paused')).toBe(false)
  })

  test('pause under the pointer off ignores the pointer and focus alike', async () => {
    const track = draw(null, false)
    await userEvent.hover(track)
    expect(track.hasAttribute('data-paused')).toBe(false)
    fireEvent.focus(track)
    expect(track.hasAttribute('data-paused')).toBe(false)
  })

  test('a selection inside still holds it while the pointer comes and goes', async () => {
    const track = draw('m2')
    await userEvent.hover(track)
    expect(track.hasAttribute('data-paused')).toBe(true)
    await userEvent.unhover(track)
    // The selection is the reason that stays; the pointer only ever adds one.
    expect(track.hasAttribute('data-paused')).toBe(true)
  })
})
