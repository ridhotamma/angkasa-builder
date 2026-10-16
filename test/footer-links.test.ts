/**
 * The footer's Information column, as a pure function.
 *
 * What goes in it is two rules, not one: the seller's pages step aside for any
 * configured footer menu, while a built-in route (order tracking) is only
 * replaced by a menu entry pointing at the same page. `StoreFooter` draws
 * whatever this returns, so the rules are pinned here rather than through
 * rendered HTML.
 */

import { describe, expect, test } from 'bun:test'

import { informationLinks, menuHasLinkKind } from '../src/render/footer-links'
import type { FieldValues } from '../src/model/fields'
import type { MenuItem } from '../src/model/menus'

const LABELS = { information: 'Information', trackOrder: 'Track order' }
const PAGES = [{ title: 'Privacy', slug: 'kebijakan-privasi' }]

/** A footer menu entry, with no children unless given. */
function item(label: string, link: MenuItem['link'], children: MenuItem[] = []): MenuItem {
  return { id: label, label, link, children }
}

function links(footer: FieldValues, menu: MenuItem[] = []) {
  return informationLinks({ footer, pages: PAGES, menu, labels: LABELS })
}

describe('the footer information column', () => {
  test('a fresh footer lists its pages, then the routes every shop has', () => {
    const column = links({ showPages: true, showOrderTracking: true })
    expect(column.map((entry) => entry.label)).toEqual(['Privacy', 'Track order'])
    // Keys are namespaced, so a page slug can never collide with a built-in.
    expect(column.map((entry) => entry.key)).toEqual([
      'page:kebijakan-privasi',
      'builtin:orderTracking',
    ])
    expect(column[1]?.link).toEqual({ kind: 'orderTracking' })
  })

  test('each side can be turned off on its own', () => {
    expect(links({ showPages: false, showOrderTracking: true }).map((entry) => entry.key)).toEqual([
      'builtin:orderTracking',
    ])
    expect(links({ showPages: true, showOrderTracking: false }).map((entry) => entry.key)).toEqual([
      'page:kebijakan-privasi',
    ])
    expect(links({})).toEqual([])
  })

  test('a link with no chrome text is left out rather than drawn empty', () => {
    const column = informationLinks({
      footer: { showPages: false, showOrderTracking: true },
      pages: [],
      menu: [],
      labels: { information: 'Information', trackOrder: '  ' },
    })
    expect(column).toEqual([])
  })

  test('a configured menu takes over the pages, but not the built-in routes', () => {
    // The seller's own navigation: their pages list steps aside, the tracking
    // link stays because the menu says nothing about that page.
    expect(
      links({ showPages: true, showOrderTracking: true }, [item('Shop', { kind: 'none' })]),
    ).toEqual([
      { key: 'builtin:orderTracking', label: 'Track order', link: { kind: 'orderTracking' } },
    ])
  })

  test('a menu entry for the same page replaces the built-in, at any depth', () => {
    expect(
      links({ showPages: true, showOrderTracking: true }, [
        item('Track order', { kind: 'orderTracking' }),
      ]),
    ).toEqual([])
    expect(
      links({ showPages: false, showOrderTracking: true }, [
        item('Help', { kind: 'none' }, [item('Lacak', { kind: 'orderTracking' })]),
      ]),
    ).toEqual([])
  })

  test('menuHasLinkKind walks the whole menu', () => {
    const menu = [
      item('Help', { kind: 'none' }, [
        item('Deep', { kind: 'none' }, [item('Lacak', { kind: 'orderTracking' })]),
      ]),
    ]
    expect(menuHasLinkKind(menu, 'orderTracking')).toBe(true)
    expect(menuHasLinkKind(menu, 'url')).toBe(false)
  })
})
