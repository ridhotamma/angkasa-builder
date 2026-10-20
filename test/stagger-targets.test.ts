/**
 * What a staggered entrance animates.
 *
 * A section renderer returns one root element, so its frame wraps everything
 * in one band. Taking the wrapper's children then animated that band as a
 * whole — no cascade at all. The renderer marks the real units instead.
 */

import './happy-dom-setup'

import { describe, expect, test } from 'bun:test'

import { staggerTargets } from '../src/render/motion'

function wrapper(html: string): HTMLElement {
  const element = document.createElement('div')
  element.innerHTML = html
  return element
}

describe('stagger targets', () => {
  test('cascades the marked items, not the section around them', () => {
    const element = wrapper(`
      <section>
        <header><h2>New in</h2></header>
        <div class="grid">
          <article data-stagger-item=""></article>
          <article data-stagger-item=""></article>
          <article data-stagger-item=""></article>
        </div>
      </section>
    `)

    const targets = staggerTargets(element)
    expect(targets).toHaveLength(3)
    expect(targets.every((target) => target.hasAttribute('data-stagger-item'))).toBe(true)
  })

  test('falls back to the wrapper’s children when nothing is marked', () => {
    const element = wrapper('<p>One</p><p>Two</p>')

    expect(staggerTargets(element).map((target) => target.textContent)).toEqual(['One', 'Two'])
  })
})
