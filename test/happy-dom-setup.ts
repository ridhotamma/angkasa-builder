/**
 * Happy-dom globals for the interaction tests in this folder.
 *
 * Imported (for its side effects) as the first import of each interaction
 * test file — `bun test` runs no jsdom/happy-dom by default, and this keeps
 * the fake DOM scoped to the files that click things rather than changing
 * the environment of every `renderToString` test beside them.
 */

import { GlobalRegistrator } from '@happy-dom/global-registrator'

await GlobalRegistrator.register()

// React's `act()` environment flag, which @testing-library/react expects.
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

// Chakra reads this for breakpoints and reduced-motion checks. Evaluate
// min/max-width queries against the current viewport so JS-driven hooks agree
// with the CSS that `hideBelow`/`hideFrom` generate (happy-dom does apply
// matching media rules in `getComputedStyle`).
if (typeof globalThis.matchMedia !== 'function') {
  const EM_PX = 16
  const toPx = (value: number, unit: string) =>
    unit === 'em' || unit === 'rem' ? value * EM_PX : value
  ;(globalThis as Record<string, unknown>).matchMedia = (query: string) => {
    const width =
      typeof globalThis.innerWidth === 'number' ? (globalThis.innerWidth as number) : 1024
    let matches = false
    const min = query.match(/\(min-width:\s*([\d.]+)(px|em|rem)\)/)
    const max = query.match(/\(max-width:\s*([\d.]+)(px|em|rem)\)/)
    if (min) matches = width >= toPx(Number(min[1]), min[2]!)
    else if (max) matches = width <= toPx(Number(max[1]), max[2]!)
    return {
      matches,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }
  }
}

// Floating-UI positioning and the drawer's presence tracking measure nodes.
if (typeof globalThis.ResizeObserver !== 'function') {
  ;(globalThis as Record<string, unknown>).ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

if (typeof globalThis.IntersectionObserver !== 'function') {
  ;(globalThis as Record<string, unknown>).IntersectionObserver = class IntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

if (
  typeof Element !== 'undefined' &&
  typeof (Element.prototype as unknown as Record<string, unknown>).scrollIntoView !== 'function'
) {
  ;(Element.prototype as unknown as Record<string, unknown>).scrollIntoView = () => undefined
}
