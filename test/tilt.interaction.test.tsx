/**
 * One card list, one `useCard()` call.
 *
 * A section maps its items to cards and hands every card the same `tiltRef`.
 * A ref object would keep only the last card React attached, so only that card
 * leaned toward the pointer. This pins the callback ref that keeps all of them
 * alive, each with its own listeners.
 *
 * Scoped to happy-dom (see `./happy-dom-setup`) so GSAP can write real styles.
 */

import './happy-dom-setup'

import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'

import { useTilt } from '../src/render/index'

afterEach(() => cleanup())

function CardList() {
  const tiltRef = useTilt(true)
  return (
    <div>
      <div ref={tiltRef} data-card="first" />
      <div ref={tiltRef} data-card="second" />
      <div ref={tiltRef} data-card="third" />
    </div>
  )
}

/** happy-dom has no layout; give each card a box the pointer maths can use. */
function stubBox(card: HTMLElement) {
  card.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 200,
      bottom: 100,
      width: 200,
      height: 100,
      toJSON: () => ({}),
    }) as DOMRect
}

describe('tilt ref', () => {
  test('tilts every card mounted through the same ref, not just the last', async () => {
    const { container } = render(<CardList />)
    const cards = Array.from(container.querySelectorAll<HTMLElement>('[data-card]'))
    expect(cards).toHaveLength(3)
    cards.forEach(stubBox)

    // GSAP loads lazily; once it is ready every attached card carries the
    // perspective. The old ref object only ever reached the last one.
    await waitFor(() => {
      for (const card of cards) expect(card.style.transform).toContain('perspective')
    })

    // Lean each card in a different direction, then let the tweens settle.
    fireEvent.pointerMove(cards[0]!, { clientX: 190, clientY: 50 })
    fireEvent.pointerMove(cards[1]!, { clientX: 10, clientY: 50 })
    fireEvent.pointerMove(cards[2]!, { clientX: 100, clientY: 5 })

    await waitFor(
      () => {
        for (const card of cards) expect(card.style.transform).toMatch(/rotate3d|rotateX|rotateY/)
      },
      { timeout: 2000 },
    )
    expect(cards[0]!.style.transform).not.toBe(cards[2]!.style.transform)
  })

  test('survives StrictMode remounting its effects', async () => {
    const { container } = render(
      <StrictMode>
        <CardList />
      </StrictMode>,
    )
    const cards = Array.from(container.querySelectorAll<HTMLElement>('[data-card]'))
    cards.forEach(stubBox)

    await waitFor(() => {
      for (const card of cards) expect(card.style.transform).toContain('perspective')
    })
    fireEvent.pointerMove(cards[0]!, { clientX: 190, clientY: 50 })
    await waitFor(() => expect(cards[0]!.style.transform).toMatch(/rotate3d|rotateX|rotateY/), {
      timeout: 2000,
    })
  })

  test('leaving a card eases it flat again', async () => {
    const { container } = render(<CardList />)
    const [first] = Array.from(container.querySelectorAll<HTMLElement>('[data-card]'))
    stubBox(first!)

    await waitFor(() => expect(first!.style.transform).toContain('perspective'))
    fireEvent.pointerMove(first!, { clientX: 190, clientY: 50 })
    await waitFor(() => expect(first!.style.transform).toMatch(/rotate3d|rotateX|rotateY/), {
      timeout: 2000,
    })

    fireEvent.pointerLeave(first!)
    await waitFor(
      () => {
        const transform = first!.style.transform
        expect(transform).not.toMatch(/rotateY\((?!0deg)/)
      },
      { timeout: 2000 },
    )
  })
})
