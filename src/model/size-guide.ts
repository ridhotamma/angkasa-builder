/**
 * Size guides: a shop's measurement tables, shared by many products.
 *
 * A guide is data, not design — "Men's tops" is the same table whichever
 * theme is live — so it lives in its own collection (`size_guides`), not in a
 * theme or a product. A category names a default guide and a product may name
 * its own, so one table edited once reaches every product it fits. The
 * product page's "Size guide" block shows whichever applies.
 *
 * The table has the same shape and the same sanitiser as the page builder's
 * table field, so one editor control serves both.
 */

import { z } from 'zod'

import { sanitizeTable, type TableValue } from './fields'

export const SIZE_GUIDE_MAX_COLUMNS = 10
export const SIZE_GUIDE_MAX_ROWS = 30
export const SIZE_GUIDE_MAX_NOTE = 1000

export interface SizeGuide {
  id: string
  name: string
  table: TableValue
  /** How to measure, fit notes — plain text, blank lines as paragraphs. */
  note: string
}

export const sizeGuideFormSchema = z.object({
  name: z.string().trim().min(1, 'Give the guide a name.').max(128),
  note: z.string().trim().max(SIZE_GUIDE_MAX_NOTE).default(''),
  table: z.unknown().transform((value) => sanitizeSizeGuideTable(value)),
})

export type SizeGuideForm = z.infer<typeof sizeGuideFormSchema>

export function sanitizeSizeGuideTable(value: unknown): TableValue {
  return sanitizeTable(value, SIZE_GUIDE_MAX_COLUMNS, SIZE_GUIDE_MAX_ROWS)
}

export function parseSizeGuideTable(json: string | null | undefined): TableValue {
  if (!json) return sanitizeSizeGuideTable(null)
  try {
    return sanitizeSizeGuideTable(JSON.parse(json))
  } catch {
    return sanitizeSizeGuideTable(null)
  }
}

/** A starting table for a new guide: the columns most clothing guides have. */
export const STARTER_SIZE_TABLE: TableValue = {
  columns: ['Size', 'Chest (cm)', 'Length (cm)'],
  rows: [
    ['S', '96', '68'],
    ['M', '102', '70'],
    ['L', '108', '72'],
    ['XL', '114', '74'],
  ],
}
