/**
 * Tabs — an interactive widget whose panels are real block trees.
 *
 * Four fixed slots rather than a list of panels: a list item's fields cannot
 * hold a blocks field (`ListField.fields` is `ItemField[]`), and widening that
 * union for one widget would change the editor and sanitiser core. Slots keep
 * the widget inside the existing tree: each slot's content is edited with the
 * same block controls as a column, and any registered block — a heading, a
 * gallery, another widget — can sit inside a tab.
 *
 * A slot with no label and no blocks is not a tab, so a two-tab widget stores
 * exactly two slots and the other two stay out of the way.
 */

import { Stack, Tabs, Text } from '@chakra-ui/react'
import { useState } from 'react'

import { BLOCK_TYPES } from '../model/blocks'
import { BLOCK_STYLE_FIELDS } from '../model/block-style'
import type { BlockSchema, BlockValue, Field, FieldValues } from '../model/fields'
import { readBlocks, readText } from '../model/fields'
import { BlockChildren } from '../render/blocks-section'
import { registerWidget, type BlockRendererProps } from '../render/block-registry'

/** How many panels one widget may hold; slots past the filled ones stay hidden. */
export const MAX_TABS = 4

export interface WidgetTab {
  key: string
  label: string
  blocks: BlockValue[]
}

/** The filled slots, in order — a label-only slot is a tab with nothing in it. */
export function readTabs(values: FieldValues): WidgetTab[] {
  const out: WidgetTab[] = []
  for (let n = 1; n <= MAX_TABS; n += 1) {
    const label = readText(values, `tab${n}Label`).trim()
    const blocks = readBlocks(values, `tab${n}Blocks`)
    if (!label && blocks.length === 0) continue
    out.push({ key: `tab-${n}`, label: label || `Tab ${n}`, blocks })
  }
  return out
}

function tabSlot(n: number): Field[] {
  return [
    {
      kind: 'text',
      key: `tab${n}Label`,
      label: { en: `Tab ${n} label`, id: `Label tab ${n}` },
      help: {
        en: 'Leave empty to hide this tab, unless you add content to it.',
        id: 'Kosongkan untuk menyembunyikan tab ini, kecuali ada isinya.',
      },
      max: 24,
      default: n === 1 ? 'Overview' : '',
    },
    {
      kind: 'blocks',
      key: `tab${n}Blocks`,
      label: { en: `Tab ${n} content`, id: `Isi tab ${n}` },
      max: 30,
      blocks: BLOCK_TYPES,
      styleFields: BLOCK_STYLE_FIELDS,
      ...(n === 1 && { defaultBlocks: ['heading', 'text'] }),
    },
  ]
}

export const tabsSchema: BlockSchema = {
  type: 'widget-tabs',
  name: { en: 'Tabs', id: 'Tab' },
  description: {
    en: 'Panels visitors switch between — details, sizing, shipping — each built from blocks.',
    id: 'Panel yang bisa diganti pengunjung — detail, ukuran, pengiriman — masing-masing dari blok.',
  },
  fields: [
    {
      kind: 'text',
      key: 'title',
      label: { en: 'Title', id: 'Judul' },
      max: 80,
      default: '',
    },
    {
      kind: 'select',
      key: 'tabStyle',
      label: { en: 'Tab style', id: 'Gaya tab' },
      options: [
        { value: 'underline', label: { en: 'Underline', id: 'Garis bawah' } },
        { value: 'pill', label: { en: 'Pills', id: 'Pil' } },
      ],
      default: 'underline',
    },
    ...tabSlot(1),
    ...tabSlot(2),
    ...tabSlot(3),
    ...tabSlot(4),
  ],
}

export function TabsWidget({ block }: BlockRendererProps) {
  const tabs = readTabs(block.settings)
  const title = readText(block.settings, 'title')
  const pill = readText(block.settings, 'tabStyle') === 'pill'
  const [active, setActive] = useState(0)

  if (tabs.length === 0) return null
  const index = Math.min(active, tabs.length - 1)

  return (
    <Stack gap="3" data-widget="tabs">
      {title && (
        <Text fontWeight="semibold" fontSize="sm">
          {title}
        </Text>
      )}
      <Tabs.Root
        value={String(index)}
        onValueChange={({ value }) => setActive(Number(value))}
        variant={pill ? 'subtle' : 'line'}
        size="sm"
      >
        <Tabs.List>
          {tabs.map((tab, at) => (
            <Tabs.Trigger key={tab.key} value={String(at)}>
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        {tabs.map((tab, at) => (
          <Tabs.Content key={tab.key} value={String(at)} pt="4">
            <BlockChildren blocks={tab.blocks} />
          </Tabs.Content>
        ))}
      </Tabs.Root>
    </Stack>
  )
}

/** Registers the schema and its renderer. Idempotent; see `./index`. */
export function registerTabs(): void {
  registerWidget(tabsSchema, TabsWidget)
}
