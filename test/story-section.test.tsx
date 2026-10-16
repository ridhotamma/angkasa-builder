/**
 * A story section draws its chapters.
 *
 * The consolidated `story` stores its list under `items`, but `ScrollingStory`
 * was reading the old key name (`steps`) the retired `scrolling-story` used —
 * so every chapters-style story rendered as an empty notice, or nothing at all
 * on the storefront. The list key is not something a type-check can catch: the
 * schema and the renderer only meet here, at render time.
 */

import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'

import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

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
      <I18nProvider locale="en" resources={{}}>
        {node}
      </I18nProvider>
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

  test('a layout saved under the old key still draws', () => {
    // A `scrolling-story` written before the consolidation: same renderer, the
    // list under its original name.
    const legacy = createSection('scrolling-story', {
      heading: 'How it is made',
      steps: [{ image: '', heading: 'Drawn', body: { type: 'doc', content: [] } }],
    })
    expect(draw(legacy)).toContain('Drawn')
  })

  test('the timeline style draws its milestones', () => {
    const timeline = createSection('story', {
      style: 'timeline',
      items: [{ image: '', label: '2019', title: 'The first order', text: 'One bag, one buyer.' }],
    })
    expect(draw(timeline)).toContain('The first order')
  })
})
