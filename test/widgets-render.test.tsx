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
    id: 'tabs',
    type: 'widget-tabs',
    settings: {
      title: 'Details',
      tab1Label: 'Overview',
      tab1Blocks: [{ id: 'tab-heading', type: 'heading', settings: { text: 'Tab heading' } }],
      tab2Label: 'Sizing',
      tab2Blocks: [{ id: 'tab-text', type: 'text', settings: { body: 'Tab body' } }],
    },
    style: { position: 'relative', zIndex: '10' },
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

  test('tabs draw their labels and the first panel of real blocks', () => {
    expect(html).toContain('data-widget="tabs"')
    expect(html).toContain('Details')
    expect(html).toContain('Overview')
    expect(html).toContain('Sizing')
    expect(html).toContain('Tab heading')
  })

  test('the style override on a widget survives sanitising and reaches the CSS', () => {
    const stored = readBlocks(section().settings, 'blocks')
    expect(stored.find((block) => block.id === 'tabs')?.style).toEqual({
      position: 'relative',
      zIndex: '10',
    })
    expect(html).toMatch(/z-index:\s*10/)
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
})
