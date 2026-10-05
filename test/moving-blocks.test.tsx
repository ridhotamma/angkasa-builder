import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'

import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

import {
  blockSchema,
  createSection,
  DEFAULT_THEME_SETTINGS,
  readBlocks,
  sanitizeValues,
  sectionSchema,
} from '../src/index'
import { sampleStorefrontData, SectionsRenderer, type RenderEnvironment } from '../src/render/index'

function env(overrides: Partial<RenderEnvironment> = {}): RenderEnvironment {
  return {
    data: sampleStorefrontData('Moving Shop'),
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

const heading = (id: string, text: string) => ({ id, type: 'heading', settings: { text } })

const SLIDER = {
  id: 'sl',
  type: 'slider',
  settings: {
    orientation: 'vertical',
    perPage: '2',
    autoplay: true,
    interval: '3',
    blocks: [
      heading('s1', 'First slide'),
      {
        id: 's2',
        type: 'column',
        settings: { blocks: [heading('s2h', 'Second slide')] },
      },
      heading('s3', 'Third slide'),
    ],
  },
}

const MARQUEE = {
  id: 'mq',
  type: 'marquee',
  settings: {
    direction: 'up',
    speed: 'fast',
    blocks: [heading('m1', 'Free delivery'), heading('m2', 'Made by hand')],
  },
}

function editorEnv(selectedBlockId: string | null = null) {
  return env({
    mode: 'preview',
    editing: {
      onEditText: () => undefined,
      onEditBlockText: () => undefined,
      onSelectBlock: () => undefined,
      selectedBlockId,
    },
  })
}

describe('slider and marquee blocks', () => {
  test('are registered blocks the Blocks section can hold', () => {
    expect(blockSchema('slider')).not.toBeNull()
    expect(blockSchema('marquee')).not.toBeNull()
    const values = createSection('blocks', { blocks: [SLIDER, MARQUEE] }).settings
    expect(readBlocks(values, 'blocks').map((block) => block.type)).toEqual(['slider', 'marquee'])
    // Already sanitised: a second pass changes nothing.
    expect(sanitizeValues(sectionSchema('blocks')!.fields, values)).toEqual(values)
  })

  test('settings outside their scales fall back to the defaults', () => {
    const values = createSection('blocks', {
      blocks: [
        {
          id: 'sl',
          type: 'slider',
          settings: { orientation: 'diagonal', perPage: '9', interval: '1', arrows: 'huge' },
        },
        { id: 'mq', type: 'marquee', settings: { direction: 'sideways', speed: 'warp' } },
      ],
    }).settings
    const [slider, marquee] = readBlocks(values, 'blocks')
    expect(slider!.settings).toMatchObject({
      orientation: 'horizontal',
      perPage: '1',
      interval: '5',
      arrows: 'overlay',
    })
    expect(marquee!.settings).toMatchObject({ direction: 'left', speed: 'normal' })
  })

  test('a slider holds at most twelve slides', () => {
    const values = createSection('blocks', {
      blocks: [
        {
          id: 'sl',
          type: 'slider',
          settings: {
            blocks: Array.from({ length: 20 }, (_, index) =>
              heading(`h${index}`, `Slide ${index}`),
            ),
          },
        },
      ],
    }).settings
    expect(readBlocks(readBlocks(values, 'blocks')[0]!.settings, 'blocks')).toHaveLength(12)
  })

  test('the server draws every slide as a plain track, with no editor marks', () => {
    const section = createSection('blocks', { blocks: [SLIDER] })
    const html = render(<SectionsRenderer sections={[section]} env={env()} />)
    for (const text of ['First slide', 'Second slide', 'Third slide']) {
      expect(html).toContain(text)
    }
    expect(html).not.toContain('data-block-id')
    expect(html).not.toContain('data-block-list')
  })

  test('marquee repeats are hidden from assistive tech and inert', () => {
    const section = createSection('blocks', { blocks: [MARQUEE] })
    const html = render(<SectionsRenderer sections={[section]} env={env()} />)
    expect(html).toContain('Free delivery')
    expect(html).toContain('data-side="top"')
    const copies = html.match(/data-part="content"/g)?.length ?? 0
    const hidden = html.match(/aria-hidden="true"[^>]*inert=""|inert=""[^>]*aria-hidden="true"/g)
    expect(copies).toBeGreaterThan(1)
    expect(hidden?.length ?? 0).toBe(copies - 1)
  })
})

describe('slider and marquee blocks, in the editor preview', () => {
  const section = createSection('blocks', { blocks: [SLIDER, MARQUEE] })
  const html = render(<SectionsRenderer sections={[section]} env={editorEnv()} />)

  test('every slide and item is selectable exactly once', () => {
    for (const id of ['sl', 's1', 's2', 's2h', 's3', 'mq']) {
      expect(html.split(`data-block-id="${id}"`)).toHaveLength(2)
    }
    // The marquee repeats its items, but only the first copy is the seller's.
    expect(html.split('Free delivery').length).toBeGreaterThan(1)
    expect(html.split('data-block-id="m1"')).toHaveLength(2)
    expect(html.split('data-block-id="m2"')).toHaveLength(2)
  })

  test('both are drop targets for the palette, once each', () => {
    expect(html.split('data-parent-id="sl"')).toHaveLength(2)
    expect(html.split('data-parent-id="mq"')).toHaveLength(2)
    expect(html).toContain('data-block-slot')
  })

  test('an empty slider or marquee is still somewhere to drop a block', () => {
    const empty = createSection('blocks', {
      blocks: [
        { id: 'sl', type: 'slider', settings: { blocks: [] } },
        { id: 'mq', type: 'marquee', settings: { blocks: [] } },
      ],
    })
    const out = render(<SectionsRenderer sections={[empty]} env={editorEnv()} />)
    expect(out.match(/Drag a block here/g)).toHaveLength(2)
  })
})
