/**
 * Store locations and the map block: branches coming from shop settings,
 * falling back to the seller's list and then the shop's own address, the
 * list-and-map locator, and the contact sections reading shop settings.
 */

import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'

import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

import { createSection, DEFAULT_THEME_SETTINGS } from '../src/index'
import {
  sampleStorefrontData,
  SectionsRenderer,
  type RenderEnvironment,
  type StorefrontBranchData,
  type StorefrontRenderData,
} from '../src/render/index'

const BRANCHES: StorefrontBranchData[] = [
  {
    id: 'b1',
    name: 'Bandung',
    address: 'Jl. Dago No. 8, Bandung',
    phone: '0812-3456-7891',
    latitude: -6.8915,
    longitude: 107.6107,
  },
  {
    id: 'b2',
    name: 'Surabaya',
    address: 'Jl. Darmo No. 15, Surabaya',
    phone: null,
    latitude: -7.2892,
    longitude: 112.7344,
  },
]

function env(overrides: Partial<StorefrontRenderData> = {}): RenderEnvironment {
  return {
    data: { ...sampleStorefrontData('Toko Ridho'), branches: [], ...overrides },
    settings: DEFAULT_THEME_SETTINGS,
    mode: 'live',
    imageUrl: () => null,
    formatPrice: (amount, currency) => `${amount} ${currency}`,
    now: new Date('2026-10-09T00:00:00.000Z'),
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

describe('store locations', () => {
  test('draws the shop branches, not the typed list, when branches exist', () => {
    const html = render(
      <SectionsRenderer
        sections={[
          createSection('store-locations', {
            items: [{ name: 'Typed store', address: 'Somewhere' }],
          }),
        ]}
        env={env({ branches: BRANCHES })}
      />,
    )
    expect(html).toContain('Bandung')
    expect(html).toContain('Jl. Dago No. 8, Bandung')
    expect(html).not.toContain('Typed store')
    // The branch phone and a coordinates-based directions link come along.
    expect(html).toContain('tel:081234567891')
    expect(html).toContain('maps/search/?api=1&amp;query=-6.8915,107.6107')
  })

  test('falls back to the typed list when the shop has no branches', () => {
    const html = render(
      <SectionsRenderer
        sections={[
          createSection('store-locations', {
            items: [{ name: 'Typed store', address: 'Somewhere' }],
          }),
        ]}
        env={env()}
      />,
    )
    expect(html).toContain('Typed store')
    expect(html).toContain('Somewhere')
  })

  test('falls back to the shop address when there is neither', () => {
    const html = render(
      <SectionsRenderer sections={[createSection('store-locations', { items: [] })]} env={env()} />,
    )
    expect(html).toContain('Jl. Contoh Raya No. 24, Kebayoran Baru, Jakarta Selatan')
    expect(html).toContain('maps/search/?api=1')
  })

  test('the locator layout lists every store beside the map', () => {
    const html = render(
      <SectionsRenderer
        sections={[createSection('store-locations', { layout: 'locator' })]}
        env={env({ branches: BRANCHES })}
      />,
    )
    expect(html).toContain('data-store-map=""')
    // The map is the keyless Google embed, opened on the selected store.
    expect(html).toContain('maps.google.com/maps?q=-6.8915,107.6107')
    expect(html).toContain('Bandung')
    expect(html).toContain('Surabaya')
    // The first pinned store is the selection the page starts on.
    expect(html).toContain('aria-pressed="true"')
  })

  test('the grid draws a map when coordinates exist, and nothing without', () => {
    const withPins = render(
      <SectionsRenderer
        sections={[createSection('store-locations')]}
        env={env({ branches: BRANCHES })}
      />,
    )
    expect(withPins).toContain('data-store-map=""')

    const withoutPins = render(
      <SectionsRenderer
        sections={[createSection('store-locations')]}
        env={env({ branches: [{ ...BRANCHES[0]!, latitude: null, longitude: null }] })}
      />,
    )
    expect(withoutPins).not.toContain('data-store-map')
  })

  test('typed stores with coordinates still map', () => {
    const html = render(
      <SectionsRenderer
        sections={[
          createSection('store-locations', {
            layout: 'locator',
            items: [
              {
                name: 'Typed store',
                address: 'Somewhere',
                coordinates: '-6.2, 106.8',
              },
            ],
          }),
        ]}
        env={env()}
      />,
    )
    expect(html).toContain('Typed store')
    expect(html).toContain('data-store-map=""')
    expect(html).toContain('maps.google.com/maps?q=-6.2,106.8')
  })

  test('a locator with no pinned stores is a single-column list', () => {
    const html = render(
      <SectionsRenderer
        sections={[
          createSection('store-locations', {
            layout: 'locator',
            items: [{ name: 'Typed store', address: 'Somewhere' }],
          }),
        ]}
        env={env()}
      />,
    )
    expect(html).toContain('Typed store')
    expect(html).not.toContain('data-store-map')
    expect(html).toContain('grid-template-columns:1fr')
  })
})

describe('the map block', () => {
  test('draws one pin at the block coordinates', () => {
    const html = render(
      <SectionsRenderer
        sections={[
          createSection('blocks', {
            blocks: [
              {
                type: 'map',
                settings: { label: 'Warung', coordinates: '-6.2, 106.816666' },
              },
            ],
          }),
        ]}
        env={env()}
      />,
    )
    expect(html).toContain('data-store-map=""')
    expect(html).toContain('maps.google.com/maps?q=-6.2,106.816666')
    expect(html).toContain('title="Warung"')
  })

  test('a block saved before the combined field keeps its pin', () => {
    const html = render(
      <SectionsRenderer
        sections={[
          createSection('blocks', {
            blocks: [
              {
                type: 'map',
                settings: { label: 'Warung', latitude: -6.2, longitude: 106.816666 },
              },
            ],
          }),
        ]}
        env={env()}
      />,
    )
    expect(html).toContain('maps.google.com/maps?q=-6.2,106.816666')
  })
})

describe('contact sections read shop settings', () => {
  test('the chat section falls back to the shop phone and email', () => {
    const html = render(
      <SectionsRenderer
        sections={[createSection('contact-cta', { whatsapp: '', email: '' })]}
        env={env()}
      />,
    )
    expect(html).toContain('wa.me/6281234567890')
    expect(html).toContain('mailto:hello@example.com')
  })

  test('the floating contact falls back the same way', () => {
    const html = render(
      <SectionsRenderer
        sections={[createSection('floating-contact', { whatsapp: '', email: '' })]}
        env={env()}
      />,
    )
    expect(html).toContain('wa.me/6281234567890')
    expect(html).toContain('mailto:hello@example.com')
  })
})
