/**
 * The sidebar's forward/back slide.
 *
 * The interesting part is not that two screens move, but that the one leaving
 * keeps what it showed: it is the node React just unmounted, not a fresh copy.
 * These tests stub Web Animations so the timing and direction are readable.
 */

import './happy-dom-setup'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import { cleanup, render, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

import { system } from '../src/ui'

import { PanelSlide } from '../src/editor/panel-slide'

interface SlideCall {
  target: Element
  keyframes: Keyframe[]
  options?: number | KeyframeAnimationOptions
}

let calls: SlideCall[] = []
let restoreAnimate: (() => void) | null = null

beforeEach(() => {
  calls = []
  const original = Element.prototype.animate
  Element.prototype.animate = function (
    this: Element,
    keyframes: Keyframe[],
    options?: number | KeyframeAnimationOptions,
  ) {
    calls.push({ target: this, keyframes, options })
    return {
      finished: Promise.resolve(),
      cancel: () => undefined,
    } as unknown as Animation
  }
  restoreAnimate = () => {
    Element.prototype.animate = original
  }
})

afterEach(() => {
  cleanup()
  restoreAnimate?.()
  restoreAnimate = null
})

function view(view: string, depth: number, children: ReactNode) {
  return (
    <ChakraProvider value={system}>
      <PanelSlide view={view} depth={depth}>
        {children}
      </PanelSlide>
    </ChakraProvider>
  )
}

function outgoing(container: HTMLElement): HTMLElement {
  const layer = container.querySelector<HTMLElement>('[data-panel-outgoing]')
  if (!layer) throw new Error('no outgoing layer')
  return layer
}

describe('the sidebar slide', () => {
  test('forward: the old screen leaves left and the new one arrives from the right', () => {
    const built = render(view('list', 0, <div data-screen="list">Sections</div>))
    built.rerender(view('section', 1, <div data-screen="section">Banner</div>))

    expect(outgoing(built.container).textContent).toBe('Sections')
    expect(built.container.querySelector('[data-screen="section"]')).not.toBeNull()

    expect(calls).toHaveLength(2)
    // The incoming screen first, then the outgoing layer.
    expect(calls[0]!.keyframes[0]).toMatchObject({ transform: 'translate3d(100%, 0, 0)' })
    expect(calls[1]!.keyframes[1]).toMatchObject({ transform: 'translate3d(-100%, 0, 0)' })
    expect(calls[0]!.options).toMatchObject({ duration: 260 })
  })

  test('back: the direction reverses', () => {
    const built = render(view('section', 1, <div data-screen="section">Banner</div>))
    built.rerender(view('list', 0, <div data-screen="list">Sections</div>))

    expect(calls).toHaveLength(2)
    expect(calls[0]!.keyframes[0]).toMatchObject({ transform: 'translate3d(-100%, 0, 0)' })
    expect(calls[1]!.keyframes[1]).toMatchObject({ transform: 'translate3d(100%, 0, 0)' })
  })

  test('the leaving screen keeps the value typed into it', () => {
    const built = render(
      view('list', 0, <input aria-label="typed" defaultValue="before" data-screen="list" />),
    )
    const input = built.getByLabelText('typed') as HTMLInputElement
    input.value = 'typed just now'

    built.rerender(
      view('section', 1, <input aria-label="other" defaultValue="after" data-screen="section" />),
    )

    const left = outgoing(built.container).querySelector<HTMLInputElement>('input')
    expect(left?.value).toBe('typed just now')
  })

  test('the outgoing screen is dropped when the slide settles', async () => {
    const built = render(view('list', 0, <div>Sections</div>))
    built.rerender(view('section', 1, <div>Banner</div>))

    await waitFor(() => expect(outgoing(built.container).childElementCount).toBe(0))
  })

  test('reduced motion swaps the screens without animating', () => {
    const original = window.matchMedia
    window.matchMedia = (query: string) =>
      ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }) as MediaQueryList

    try {
      const built = render(view('list', 0, <div data-screen="list">Sections</div>))
      built.rerender(view('section', 1, <div data-screen="section">Banner</div>))

      expect(calls).toHaveLength(0)
      expect(outgoing(built.container).childElementCount).toBe(0)
      expect(built.container.querySelector('[data-screen="section"]')).not.toBeNull()
    } finally {
      window.matchMedia = original
    }
  })
})
