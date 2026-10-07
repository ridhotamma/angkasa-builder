/**
 * Editor features that are built but switched off.
 *
 * Linked section copies — a "block link", where a section draws an original
 * and keeps only its own words — are hidden for now. Nothing is deleted: the
 * model, sanitiser and renderer keep resolving a stored link, and flipping
 * this to `true` brings every affordance back (list and toolbar buttons, the
 * linked badge, and the linked-section panel).
 */
export const SECTION_LINKING_ENABLED = false
