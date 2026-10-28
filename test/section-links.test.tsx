/**
 * A button that points at another section on the same page — a hero's
 * "Explore now". The link stores the target's id; the renderer draws the
 * target's anchor and the button's `#` href from it.
 */

import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'

import { LocaleProvider } from '../src/locale'
import { system } from '../src/ui'

import {
  createSection,
  DEFAULT_THEME_SETTINGS,
  duplicateSection,
  sectionAnchorId,
  sectionLinkTargets,
  type SectionInstance,
} from '../src/index'
import { sampleStorefrontData, SectionsRenderer, type RenderEnvironment } from '../src/render/index'

function env(overrides: Partial<RenderEnvironment> = {}): RenderEnvironment {
  return {
    data: sampleStorefrontData('Link Shop'),
    settings: DEFAULT_THEME_SETTINGS,
    mode: 'live',
    imageUrl: () => null,
    formatPrice: (amount, currency) => `${amount} ${currency}`,
    now: new Date('2026-03-10T00:00:00.000Z'),
    ...overrides,
  }
}

function render(node: ReactNode): string {
  return renderToString(
    <ChakraProvider value={system}>
      <LocaleProvider locale="en">
        {node}
      </LocaleProvider>
    </ChakraProvider>,
  )
}

function bandWithButton(overrides: Record<string, unknown>): SectionInstance {
  return createSection('statement', {
    layout: 'contained',
    heading: 'A band',
    body: '',
    buttonLabel: '',
    buttonLink: { kind: 'none' },
    ...overrides,
  })
}

describe('section links', () => {
  test('the button href and the target section share one anchor', () => {
    const target = bandWithButton({ heading: 'What we sell' })
    const hero = bandWithButton({
      heading: 'Welcome',
      buttonLabel: 'Explore now',
      buttonLink: { kind: 'section', sectionId: target.id },
    })

    const html = render(<SectionsRenderer sections={[hero, target]} env={env()} />)

    expect(html).toContain(`href="#${sectionAnchorId(target.id)}"`)
    expect(html).toContain(`id="${sectionAnchorId(target.id)}"`)
  })

  test('a duplicate gets its own anchor while the link keeps the original', () => {
    const target = bandWithButton({ heading: 'What we sell' })
    const hero = bandWithButton({
      buttonLabel: 'Explore now',
      buttonLink: { kind: 'section', sectionId: target.id },
    })
    const duplicated = duplicateSection([target], target.id)
    const copy = duplicated?.sections.find((section) => section.id !== target.id)!

    const html = render(<SectionsRenderer sections={[hero, target, copy]} env={env()} />)

    expect(html).toContain(`href="#${sectionAnchorId(target.id)}"`)
    expect(html).toContain(`id="${sectionAnchorId(target.id)}"`)
    expect(html).toContain(`id="${sectionAnchorId(copy.id)}"`)
  })

  test('a section is never offered as its own link target', () => {
    const hero = bandWithButton({ heading: 'Hero' })
    const grid = bandWithButton({ heading: 'Grid' })

    // The section being edited is left out of the picker…
    expect(sectionLinkTargets([hero, grid], hero.id).map((section) => section.id)).toEqual([
      grid.id,
    ])
    // …while editing something else (a layout part) still offers every one.
    expect(sectionLinkTargets([hero, grid], null).map((section) => section.id)).toEqual([
      hero.id,
      grid.id,
    ])
  })
})
