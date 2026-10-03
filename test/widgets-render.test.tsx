import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'

import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

import {
  createSection,
  DEFAULT_THEME_SETTINGS,
  readBlocks,
  type SectionInstance,
} from '../src/index'
import { sampleStorefrontData, SectionsRenderer, type RenderEnvironment } from '../src/render/index'
import { registerWidgets } from '../src/widgets/index'

// The schema must be registered before the section sanitises; the renderer
// lookup happens per render, so this covers the SSR path too.
registerWidgets()

const TREE = [
  {
    id: 'calc',
    type: 'widget-calculator',
    settings: { title: 'Tip calculator' },
  },
  {
    id: 'todo',
    type: 'widget-todo-list',
    settings: {
      title: 'Packing list',
      initialItems: 'Book a courier\nPack the order',
      allowAdd: true,
    },
  },
  {
    id: 'snake',
    type: 'widget-snake',
    settings: { title: 'Break time', gridSize: 12, speed: 'fast' },
    style: { position: 'relative', zIndex: '10' },
  },
]

function section(): SectionInstance {
  return createSection('blocks', { blocks: TREE })
}

function env(overrides: Partial<RenderEnvironment> = {}): RenderEnvironment {
  return {
    data: sampleStorefrontData('Widget Shop'),
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

describe('the widget library on the storefront', () => {
  const html = render(<SectionsRenderer sections={[section()]} env={env()} />)

  test('the calculator draws its keypad and starting display', () => {
    expect(html).toContain('data-widget="calculator"')
    expect(html).toContain('Tip calculator')
    expect(html).toContain('aria-live="polite"')
    for (const key of ['7', '+', '=', 'C']) {
      expect(html).toContain(`>${key}<`)
    }
  })

  test('the todo list draws its seeded items and an add field', () => {
    expect(html).toContain('data-widget="todo-list"')
    expect(html).toContain('Packing list')
    expect(html).toContain('Book a courier')
    expect(html).toContain('Pack the order')
    expect(html).toContain('Add an item…')
  })

  test('the snake draws a canvas, controls and a starting hint', () => {
    expect(html).toContain('data-widget="snake"')
    expect(html).toContain('Break time')
    expect(html).toContain('<canvas')
    expect(html).toContain('Press Play or an arrow key to start')
    expect(html).toContain('>Play<')
    expect(html).toContain('aria-label="Up"')
  })

  test('the style override on the game survives sanitising and reaches the CSS', () => {
    const stored = readBlocks(section().settings, 'blocks')
    expect(stored.find((block) => block.id === 'snake')?.style).toEqual({
      position: 'relative',
      zIndex: '10',
    })
    expect(html).toMatch(/z-index:\s*10/)
  })
})
