/**
 * What the footer's Information column holds.
 *
 * Two kinds of link meet here: the seller's own published pages, and the routes
 * *every* shop has — the order-tracking page today — so a fresh footer already
 * leads somewhere useful before anyone configures a thing.
 *
 * They do not follow the same rules, which is why the column is built here
 * rather than in the component:
 *
 *   - pages are the seller's to lose. A configured footer menu is them taking
 *     over the footer's navigation, so the whole list steps aside (see
 *     "Show custom pages" in `FOOTER_FIELDS`).
 *   - a built-in route is only replaced by a menu entry that points at the same
 *     page. An unrelated menu item — a category column, say — leaves it alone,
 *     so the footer never both duplicates and never silently loses the page.
 *
 * Adding the next built-in link is a row in `BUILTIN_LINKS` and a label, not
 * another branch in `StoreFooter`.
 */

import { readBoolean, type FieldValues } from '../model/fields'
import type { Link } from '../model/links'
import type { MenuItem } from '../model/menus'

/** The label a host must supply for each built-in link, plus the column's own heading. */
export interface InformationLabels {
  /** The column heading — "Information". */
  information: string
  /** What the link to the order-tracking page reads. */
  trackOrder: string
}

/** One link in the column: what it says, and where it goes. */
export interface InformationLink {
  /** Unique within the column, for React's key. */
  key: string
  label: string
  link: Link
}

interface BuiltinLink {
  key: string
  /** The `FOOTER_FIELDS` boolean that turns it on. */
  flag: string
  /** Which `InformationLabels` entry its text comes from. */
  label: Exclude<keyof InformationLabels, 'information'>
  link: Link
}

/**
 * Routes the storefront owns, drawn for every shop unless the footer settings
 * turn them off or the seller's own menu already links to them.
 */
const BUILTIN_LINKS: readonly BuiltinLink[] = [
  {
    key: 'builtin:orderTracking',
    flag: 'showOrderTracking',
    label: 'trackOrder',
    link: { kind: 'orderTracking' },
  },
]

/** Whether the menu the seller built already carries a link of this kind, at any depth. */
export function menuHasLinkKind(items: readonly MenuItem[], kind: Link['kind']): boolean {
  return items.some((item) => item.link.kind === kind || menuHasLinkKind(item.children, kind))
}

/**
 * The column's links, in the order they are drawn: the seller's pages first,
 * then the built-in routes. Empty when there is nothing to show, which is how
 * `StoreFooter` decides whether the column exists at all.
 */
export function informationLinks({
  footer,
  pages,
  menu,
  labels,
}: {
  footer: FieldValues
  pages: readonly { title: string; slug: string }[]
  /** The seller's *configured* footer menu — the fallback never carries built-ins. */
  menu: readonly MenuItem[]
  labels: InformationLabels
}): InformationLink[] {
  const pagesListed = readBoolean(footer, 'showPages') && menu.length === 0

  return [
    ...(pagesListed
      ? pages.map((page) => ({
          key: `page:${page.slug}`,
          label: page.title,
          link: { kind: 'page', slug: page.slug } as Link,
        }))
      : []),
    ...BUILTIN_LINKS.filter(
      (builtin) =>
        readBoolean(footer, builtin.flag) &&
        // A built-in with no chrome text cannot be drawn: an empty anchor is
        // worse than no link. The editor's previews pass no labels at all.
        labels[builtin.label].trim().length > 0 &&
        !menuHasLinkKind(menu, builtin.link.kind),
    ).map((builtin) => ({
      key: builtin.key,
      label: labels[builtin.label],
      link: builtin.link,
    })),
  ]
}
