/**
 * Click-level proof for the navigation fallback: the hamburger opens a sheet
 * that is not blank, and the collapsible groups open into real links.
 *
 * The `renderToString` suite next door pins *what* the sheet holds when open;
 * this file pins the interaction itself — closed drawer shows nothing, one
 * tap opens it, group taps reveal the catalogue links. Scoped to happy-dom
 * (see `./happy-dom-setup`) so the rest of the folder keeps its fast
 * string renderer.
 */

import './happy-dom-setup'

import { afterEach, describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import { cleanup, render, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'

import { LocaleProvider } from '../src/locale'
import { system } from '../src/ui'

import { DEFAULT_THEME_SETTINGS } from '../src/index'
import {
  RenderProvider,
  StoreHeader,
  type ChromeShop,
  type RenderEnvironment,
} from '../src/render/index'

afterEach(() => cleanup())

// A phone-drawer test runs at a phone viewport: the hamburger lives in the
// `hideFrom="md"` mobile bar, which happy-dom (like a real desktop browser at
// 1024px) hides from the accessibility tree at wider widths.
;(
  window as unknown as {
    happyDOM?: { setViewport?: (size: { width: number; height: number }) => void }
  }
).happyDOM?.setViewport?.({ width: 375, height: 812 })

const shop: ChromeShop = { name: 'Toko Baru', logoUrl: null, description: '', email: null }

function env(): RenderEnvironment {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { shop: { name: 'Toko Baru' } } as any,
    settings: DEFAULT_THEME_SETTINGS,
    mode: 'live',
    imageUrl: () => null,
    formatPrice: (amount, currency) => `${amount} ${currency}`,
    now: new Date('2026-03-10T00:00:00.000Z'),
  }
}

function renderHeader(node: ReactNode) {
  return render(
    <ChakraProvider value={system}>
      <LocaleProvider locale="en">
        <RenderProvider value={env()}>{node}</RenderProvider>
      </LocaleProvider>
    </ChakraProvider>,
  )
}

const CATS = [
  { id: '1', name: 'Kaos', slug: 'kaos' },
  { id: '2', name: 'Topi', slug: 'topi' },
]
const COLS = [{ id: 'c1', name: 'New Arrival', slug: 'new-arrival' }]

function header(opts: {
  menu?: Parameters<typeof StoreHeader>[0]['menu']
  categories?: { id: string; name: string; slug: string }[]
  collections?: { id: string; name: string; slug: string }[]
}) {
  return (
    <StoreHeader
      header={{ layout: 'classic', sticky: true, showSearch: true }}
      shop={shop}
      menu={opts.menu ?? []}
      categories={opts.categories ?? []}
      collections={opts.collections ?? []}
      searchButton={<span>ICON</span>}
      cart={<span>CART</span>}
      account={<span>ACCOUNT</span>}
      drawerAccount={<span>ACCOUNT ROW</span>}
    />
  )
}

describe('phone drawer interaction', () => {
  test('fresh shop with categories and collections: hamburger opens grouped fallback links', async () => {
    const user = userEvent.setup()
    // NOTE: queries come from the render result, not `screen` — `screen`
    // binds to `document.body` at import time, before the setup import's
    // top-level await has registered the happy-dom globals.
    const view = renderHeader(header({ categories: CATS, collections: COLS }))

    // Closed drawer contributes no dialog to the document.
    expect(view.queryByRole('dialog')).toBeNull()

    await user.click(view.getByRole('button', { name: 'Menu' }))

    const dialog = await view.findByRole('dialog')
    expect(within(dialog).getByText('Categories')).toBeDefined()
    expect(within(dialog).getByText('Collections')).toBeDefined()

    // The groups are collapsed until tapped; tapping reveals catalogue links.
    await user.click(within(dialog).getByText('Categories'))
    const kaos = await within(dialog).findByText('Kaos')
    expect(kaos.closest('a')?.getAttribute('href')).toBe('/c/kaos')

    await user.click(within(dialog).getByText('Collections'))
    const arrival = await within(dialog).findByText('New Arrival')
    expect(arrival.closest('a')?.getAttribute('href')).toBe('/k/new-arrival')
  })

  test('categories-only shop: drawer lists every category with no group to open', async () => {
    const user = userEvent.setup()
    const view = renderHeader(header({ categories: CATS }))

    await user.click(view.getByRole('button', { name: 'Menu' }))
    const dialog = await view.findByRole('dialog')

    // Flat rows — no collapsible heading stands between the tap and the link.
    expect(within(dialog).queryByText('Categories')).toBeNull()
    const kaos = await within(dialog).findByText('Kaos')
    const topi = await within(dialog).findByText('Topi')
    expect(kaos.closest('a')?.getAttribute('href')).toBe('/c/kaos')
    expect(topi.closest('a')?.getAttribute('href')).toBe('/c/topi')
  })

  test('configured menu wins: drawer shows it, never the fallback', async () => {
    const user = userEvent.setup()
    const view = renderHeader(
      header({
        menu: [{ id: 'm1', label: 'Sale', link: { kind: 'catalog' }, children: [] }],
        categories: CATS,
        collections: COLS,
      }),
    )

    await user.click(view.getByRole('button', { name: 'Menu' }))
    const dialog = await view.findByRole('dialog')

    expect(await within(dialog).findByText('Sale')).toBeDefined()
    expect(within(dialog).queryByText('Categories')).toBeNull()
    expect(within(dialog).queryByText('Kaos')).toBeNull()
  })
})
