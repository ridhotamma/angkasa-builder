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
  {
    id: 'tabs',
    type: 'widget-tabs',
    settings: {
      title: 'Details',
      tab1Label: 'Overview',
      tab1Blocks: [{ id: 'tab-heading', type: 'heading', settings: { text: 'Tab heading' } }],
      tab2Label: 'Sizing',
      tab2Blocks: [{ id: 'tab-text', type: 'text', settings: { body: 'Tab body' } }],
    },
  },
  {
    id: 'quiz',
    type: 'widget-quiz',
    settings: {
      title: 'Quiz title',
      questions: [{ id: 'q1', question: 'Which bean?', answers: 'Arabica\nRobusta', correct: 1 }],
    },
  },
  {
    id: 'estimate',
    type: 'widget-estimate',
    settings: {
      title: 'Build your estimate',
      options: [{ id: 'o1', label: 'Setup', detail: 'Onboarding', amount: 100000, selected: true }],
      ctaLabel: 'Continue',
    },
  },
  {
    id: 'before-after',
    type: 'widget-before-after',
    settings: {
      beforeImage: 'file-before',
      afterImage: 'file-after',
      beforeLabel: 'Before',
      afterLabel: 'After',
    },
  },
  {
    id: 'countdown',
    type: 'widget-countdown',
    settings: { heading: 'Launch', endsAt: '2027-01-01T00:00:00.000Z' },
  },
  {
    id: 'order-form',
    type: 'widget-order-form',
    settings: { title: 'Order on WhatsApp' },
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
    imageUrl: (fileId, _size) => `https://img.test/${fileId}`,
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

  test('tabs draw their labels and the first panel of real blocks', () => {
    expect(html).toContain('data-widget="tabs"')
    expect(html).toContain('Details')
    expect(html).toContain('Overview')
    expect(html).toContain('Sizing')
    expect(html).toContain('Tab heading')
  })

  test('the quiz draws its question and choices', () => {
    expect(html).toContain('data-widget="quiz"')
    expect(html).toContain('Quiz title')
    expect(html).toContain('Which bean?')
    expect(html).toContain('Arabica')
    expect(html).toContain('Robusta')
    expect(html).toContain('Check answers')
  })

  test('the estimate draws its option, price and total', () => {
    expect(html).toContain('data-widget="estimate"')
    expect(html).toContain('Build your estimate')
    expect(html).toContain('Setup')
    expect(html).toContain('100000 IDR')
    expect(html).toContain('Continue')
  })

  test('before / after draws both images and a labelled range control', () => {
    expect(html).toContain('data-widget="before-after"')
    expect(html).toContain('https://img.test/file-before')
    expect(html).toContain('https://img.test/file-after')
    expect(html).toContain('type="range"')
  })

  test('the countdown draws its units before the client ticks', () => {
    expect(html).toContain('data-widget="countdown"')
    expect(html).toContain('Launch')
    expect(html).toContain('Days')
    expect(html).toContain('Minutes')
    // Server-rendered digits would hydrate seconds out of date.
    expect(html).toContain('––')
  })

  test('the order form draws products and a wa.me link', () => {
    expect(html).toContain('data-widget="order-form"')
    expect(html).toContain('Order on WhatsApp')
    expect(html).toContain('aria-label="Add one ')
    expect(html).toContain('https://wa.me/6281234567890')
  })
})
