/**
 * Navigation menus: the links in the storefront's header and footer.
 *
 * Two menus per shop, by handle. The main menu is the header's: a top-level
 * item with children opens a dropdown, and children with children of their
 * own turn it into a mega menu of columns. The footer menu's top-level items
 * are column headings.
 *
 * Stored in the `menus` collection as `itemsJson`, separately from themes, so
 * switching themes keeps the shop's navigation — the same choice Shopify
 * makes. Every link is the builder's `Link` union, so a menu entry can point
 * only where a button can.
 */

import { z } from 'zod'

import { isRecord, newId } from './fields'
import { sanitizeLink, type Link } from './links'
import type { Localized } from './localized'

export const MENU_HANDLES = ['main', 'footer'] as const
export type MenuHandle = (typeof MENU_HANDLES)[number]

export interface MenuItem {
  id: string
  label: string
  link: Link
  children: MenuItem[]
}

/** Three levels: top, column, link. Deeper than that is not navigation. */
export const MAX_MENU_DEPTH = 3
export const MAX_MENU_ITEMS_PER_LEVEL = 12
/** Across the whole menu, so a mega menu cannot grow without bound. */
export const MAX_MENU_ITEMS = 150
export const MAX_MENU_LABEL = 60

export const MENU_NAMES: Record<MenuHandle, Localized> = {
  main: { en: 'Main menu', id: 'Menu utama' },
  footer: { en: 'Footer menu', id: 'Menu footer' },
}

export const MENU_DESCRIPTIONS: Record<MenuHandle, Localized> = {
  main: {
    en: 'The links in the header. Add links under a link for a dropdown, and one more level for a mega menu with columns.',
    id: 'Tautan di header. Tambahkan tautan di bawah tautan untuk menu tarik-turun, dan satu tingkat lagi untuk mega menu berkolom.',
  },
  footer: {
    en: 'The links in the footer. Each top-level link is a column heading; the links under it are the column.',
    id: 'Tautan di footer. Setiap tautan tingkat atas menjadi judul kolom; tautan di bawahnya menjadi isi kolom.',
  },
}

/**
 * A menu as a form value, for the admin's menu editor. The sanitiser below
 * quietly drops a link with no label; the form says so on the field instead,
 * before the seller loses the link on save. Depth and counts are enforced by
 * the editor (it offers no way past them) and by the sanitiser on the server.
 */
const menuItemSchema: z.ZodType<MenuItem, MenuItem> = z.lazy(() =>
  z.object({
    id: z.string(),
    label: z.string().trim().min(1, 'Give the link a label.').max(MAX_MENU_LABEL),
    link: z.custom<Link>((value) => isRecord(value) && typeof value.kind === 'string'),
    children: z.array(menuItemSchema).max(MAX_MENU_ITEMS_PER_LEVEL),
  }),
)

export const menuFormSchema = z.object({
  items: z.array(menuItemSchema).max(MAX_MENU_ITEMS_PER_LEVEL),
})

export type MenuFormValues = z.infer<typeof menuFormSchema>

export function sanitizeMenuItems(value: unknown): MenuItem[] {
  let budget = MAX_MENU_ITEMS
  const seen = new Set<string>()

  function walk(raw: unknown, depth: number): MenuItem[] {
    if (!Array.isArray(raw) || depth > MAX_MENU_DEPTH) return []
    const out: MenuItem[] = []
    for (const entry of raw.slice(0, MAX_MENU_ITEMS_PER_LEVEL)) {
      if (budget <= 0) break
      if (!isRecord(entry)) continue
      const label =
        typeof entry.label === 'string' ? entry.label.trim().slice(0, MAX_MENU_LABEL) : ''
      if (!label) continue
      budget -= 1
      let id =
        typeof entry.id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(entry.id) ? entry.id : newId()
      if (seen.has(id)) id = newId()
      seen.add(id)
      out.push({
        id,
        label,
        link: sanitizeLink(entry.link),
        children: walk(entry.children, depth + 1),
      })
    }
    return out
  }

  return walk(value, 1)
}

export function parseMenuItems(json: string | null | undefined): MenuItem[] {
  if (!json) return []
  try {
    return sanitizeMenuItems(JSON.parse(json))
  } catch {
    return []
  }
}

export function isMenuHandle(value: unknown): value is MenuHandle {
  return typeof value === 'string' && (MENU_HANDLES as readonly string[]).includes(value)
}

/** Whether any top-level item has grandchildren — the header then opens a mega menu. */
export function isMegaMenu(item: MenuItem): boolean {
  return item.children.some((child) => child.children.length > 0)
}
