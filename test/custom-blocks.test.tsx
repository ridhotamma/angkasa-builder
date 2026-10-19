import { describe, expect, test } from 'bun:test'
import { Box, Button, ChakraProvider, HStack, Text } from '@chakra-ui/react'
import { useState, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'

import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

import {
  createSection,
  DEFAULT_THEME_SETTINGS,
  defineBlock,
  readBlocks,
  readNumber,
  registeredBlock,
  registeredBlocks,
  type SectionInstance,
} from '../src/index'
import {
  BlockChildren,
  registerBlockRenderer,
  registerWidget,
  sampleStorefrontData,
  SectionsRenderer,
  type BlockRendererProps,
  type RenderEnvironment,
} from '../src/render/index'

/**
 * A stateful, dynamic widget: the settings fix the price, the component keeps
 * a quantity in React state and recalculates on every click. Nothing about it
 * is known to the section library — the schema is registered with the model
 * and the component with the renderer.
 */
defineBlock({
  type: 'test-widget-calculator',
  name: { en: 'Calculator', id: 'Kalkulator' },
  description: {
    en: 'A price times a quantity, with steppers.',
    id: 'Harga dikali jumlah, dengan penambah.',
  },
  fields: [
    {
      kind: 'number',
      key: 'price',
      label: { en: 'Price', id: 'Harga' },
      min: 0,
      max: 1_000_000,
      default: 0,
    },
    {
      kind: 'number',
      key: 'quantity',
      label: { en: 'Starting quantity', id: 'Jumlah awal' },
      min: 1,
      max: 99,
      default: 1,
    },
  ],
})

function Calculator({ block }: BlockRendererProps) {
  const [quantity, setQuantity] = useState(readNumber(block.settings, 'quantity', 1))
  const total = readNumber(block.settings, 'price', 0) * quantity
  return (
    <HStack data-widget="calculator">
      <Button onClick={() => setQuantity((current) => current + 1)}>+</Button>
      <Text>{`total ${total}`}</Text>
      <Text>{`qty ${quantity}`}</Text>
    </HStack>
  )
}

registerBlockRenderer('test-widget-calculator', Calculator)

/** A custom layout block that arranges nested blocks through the shared shells. */
const layoutBlock = registerWidget(
  {
    type: 'test-custom-layout',
    name: { en: 'Custom layout', id: 'Tata letak kustom' },
    fields: [
      {
        kind: 'blocks',
        key: 'blocks',
        label: { en: 'Blocks', id: 'Blok' },
        max: 10,
        blocks: registeredBlocks(),
      },
    ],
  },
  function CustomLayout({ block }) {
    return (
      <Box data-custom-layout="">
        <BlockChildren blocks={readBlocks(block.settings, 'blocks')} />
      </Box>
    )
  },
)

const TREE = [
  {
    id: 'calc',
    type: 'test-widget-calculator',
    settings: { price: 2500, quantity: 3 },
  },
  {
    id: 'layout',
    type: 'test-custom-layout',
    settings: {
      blocks: [{ id: 'nested', type: 'richtext', settings: { body: 'Nested in a custom layout' } }],
    },
  },
  {
    id: 'styled',
    type: 'richtext',
    settings: { body: 'Styled text' },
    style: { position: 'absolute', zIndex: '10', backgroundSize: 'cover' },
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

describe('custom blocks and widgets', () => {
  test('a registered widget becomes a first-class block', () => {
    const stored = readBlocks(section().settings, 'blocks')
    expect(stored.map((block) => block.type)).toEqual([
      'test-widget-calculator',
      'test-custom-layout',
      'richtext',
    ])
    expect(registeredBlock('test-widget-calculator')?.name.en).toBe('Calculator')
    expect(layoutBlock.type).toBe('test-custom-layout')
  })

  test('the stateful component draws with its sanitised settings', () => {
    const html = render(<SectionsRenderer sections={[section()]} env={env()} />)
    expect(html).toContain('data-widget="calculator"')
    // 2 500 × 3, the initial state its component computed.
    expect(html).toContain('total 7500')
    expect(html).toContain('qty 3')
  })

  test('a custom layout draws its nested blocks', () => {
    const html = render(<SectionsRenderer sections={[section()]} env={env()} />)
    expect(html).toContain('data-custom-layout')
    expect(html).toContain('Nested in a custom layout')
  })

  test('style overrides survive sanitising and reach the CSS', () => {
    const stored = readBlocks(section().settings, 'blocks')
    expect(stored[2]!.style).toEqual({
      position: 'absolute',
      zIndex: '10',
      backgroundSize: 'cover',
    })
    const html = render(<SectionsRenderer sections={[section()]} env={env()} />)
    expect(html).toMatch(/z-index:\s*10/)
    expect(html).toMatch(/background-size:\s*cover/)
    expect(html).toMatch(/position:\s*absolute/)
  })

  test('a group hover on a card reaches the CSS and the marker', () => {
    const hovered = createSection('blocks', {
      blocks: [
        {
          id: 'card',
          type: 'column',
          settings: {
            blocks: [
              {
                id: 'caption',
                type: 'richtext',
                settings: { body: 'Hover the card' },
                style: {
                  hoverTrigger: 'group',
                  hoverTransform: 'scale-105',
                  hoverDecoration: 'underline',
                },
              },
            ],
          },
        },
      ],
    })
    const html = render(<SectionsRenderer sections={[hovered]} env={env()} />)
    expect(html).toContain('data-block-hover-group')
    expect(html).toContain('[data-block-hover-group]:hover')
    expect(html).toMatch(/scale\(1\.05\)/)
    expect(html).toMatch(/text-decoration:\s*underline/)
  })
})
