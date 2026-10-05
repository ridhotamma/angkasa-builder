import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'

import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

import {
  blockStyleCss,
  createSection,
  DEFAULT_THEME_SETTINGS,
  readBlockDevices,
  readBlocks,
} from '../src/index'
import { sampleStorefrontData, SectionsRenderer, type RenderEnvironment } from '../src/render/index'

function env(overrides: Partial<RenderEnvironment> = {}): RenderEnvironment {
  return {
    data: sampleStorefrontData('Device Shop'),
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
      <I18nProvider locale="en" resources={{}}>
        {node}
      </I18nProvider>
    </ChakraProvider>,
  )
}

const SECTION = createSection('blocks', {
  blocks: [
    {
      id: 'phone',
      type: 'heading',
      settings: { text: 'Tap to order' },
      style: { showOn: 'mobile' },
    },
    {
      id: 'desk',
      type: 'heading',
      settings: { text: 'Click to order' },
      style: { showOn: 'desktop' },
    },
    { id: 'both', type: 'heading', settings: { text: 'Everywhere' } },
  ],
})

describe('a block narrowed to phones or desktops', () => {
  test('stores the choice, and drops values it does not know', () => {
    const blocks = readBlocks(
      createSection('blocks', {
        blocks: [
          { id: 'a', type: 'text', settings: {}, style: { showOn: 'mobile' } },
          { id: 'b', type: 'text', settings: {}, style: { showOn: 'tablet' } },
          { id: 'c', type: 'text', settings: {}, style: { showOn: 'default' } },
        ],
      }).settings,
      'blocks',
    )
    expect(blocks.map((block) => readBlockDevices(block.style))).toEqual(['mobile', 'all', 'all'])
    // "All devices" is the default, so nothing is stored for it.
    expect(blocks[1]!.style).toBeUndefined()
    expect(blocks[2]!.style).toBeUndefined()
  })

  test('hides at the same breakpoint as a section, over a display override', () => {
    expect(blockStyleCss({ showOn: 'mobile' })).toEqual({ md: { display: 'none' } })
    expect(blockStyleCss({ showOn: 'desktop' })).toEqual({ mdDown: { display: 'none' } })
    const css = blockStyleCss({ showOn: 'mobile', display: 'flex' })
    expect(css.display).toBe('flex')
    // Later in the rule, so the hiding wins while its media query applies.
    expect(Object.keys(css)).toEqual(['display', 'md'])
  })

  test('the storefront draws both, each behind its own media query', () => {
    const html = render(<SectionsRenderer sections={[SECTION]} env={env()} />)
    expect(html).toContain('Tap to order')
    expect(html).toContain('Click to order')
    expect(html).toMatch(
      /@media screen and \(min-width: 48rem\)\{\.css-[a-z0-9]+\{display:none;\}\}/,
    )
    expect(html).toMatch(
      /@media screen and \(max-width: 47\.9975rem\)\{\.css-[a-z0-9]+\{display:none;\}\}/,
    )
  })

  test('the editor names the screen on the block chip', () => {
    const html = render(
      <SectionsRenderer
        sections={[SECTION]}
        env={env({
          mode: 'preview',
          editing: {
            onEditText: () => undefined,
            onSelectBlock: () => undefined,
            selectedBlockId: null,
          },
        })}
      />,
    ).replaceAll('<!-- -->', '')
    expect(html).toContain('Heading · Phones only')
    expect(html).toContain('Heading · Desktop only')
    expect(html.match(/Heading · /g)).toHaveLength(2)
  })
})
