/**
 * A story section draws its chapters.
 *
 * The consolidated `story` stores its list under `items`. The list key is not
 * something a type-check can catch: the schema and the renderer only meet
 * here, at render time.
 */

import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'

import { LocaleProvider } from '../src/locale'
import { system } from '../src/ui'

import { createSection, createStarterSection, DEFAULT_THEME_SETTINGS } from '../src/index'
import {
  RenderProvider,
  sampleStorefrontData,
  SectionsRenderer,
  type RenderEnvironment,
} from '../src/render/index'

function env(): RenderEnvironment {
  return {
    data: sampleStorefrontData('Story Shop'),
    settings: DEFAULT_THEME_SETTINGS,
    mode: 'live',
    imageUrl: () => null,
    formatPrice: (amount, currency) => `${amount} ${currency}`,
    now: new Date('2026-03-10T00:00:00.000Z'),
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

/** One section of `type`, drawn the way the storefront draws it. */
function draw(section: Parameters<typeof SectionsRenderer>[0]['sections'][number]): string {
  const environment = env()
  return render(
    <RenderProvider value={environment}>
      <SectionsRenderer sections={[section]} env={environment} />
    </RenderProvider>,
  )
}

describe('the story section', () => {
  test('the chapters starter draws every chapter it ships with', () => {
    const starter = createStarterSection('story')
    const html = draw(starter)

    expect(starter.settings.style).toBe('chapters')
    for (const heading of ['Designed', 'Made', 'Shipped']) {
      expect(html).toContain(heading)
    }
    // The body copy of a chapter, not just the heading.
    expect(html).toContain('Every piece starts as a sketch.')
  })

  test('the timeline style draws its milestones', () => {
    const timeline = createSection('story', {
      style: 'timeline',
      items: [{ image: '', label: '2019', title: 'The first order', text: 'One bag, one buyer.' }],
    })
    expect(draw(timeline)).toContain('The first order')
  })

  test('the chapters leave room under the last one', () => {
    // Without trailing room the last chapter can never cross the halfway line
    // the scroll observer watches: its words stay at the bottom and its picture
    // never swaps in. Desktop only — on a phone each chapter carries its own.
    expect(draw(createStarterSection('story'))).toContain('15svh')
  })
})
