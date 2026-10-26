/**
 * Shop data the storefront draws inside sections, in shapes that servers
 * produce too (`../server/content`). Pure; the renderer re-exports them from
 * `../render/context`.
 */

import type { TableValue } from './fields'

export interface StorefrontSizeGuide {
  name: string
  table: TableValue
  note: string
}

/**
 * One physical shop the storefront can show: a branch with its address, or
 * the shop's own single address when it has no branches. Read-only, and only
 * what a shopper may see — never a branch's internal fields.
 */
export interface StorefrontBranchData {
  id: string
  name: string
  /** The address as one line, already composed. `''` when unknown. */
  address: string
  phone: string | null
  /** Where to pin it; `null` when the address was never geocoded. */
  latitude: number | null
  longitude: number | null
  /** The branch the shop calls its headquarters, when there is one. */
  isHeadquarters?: boolean
}
