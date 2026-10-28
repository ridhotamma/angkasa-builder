/**
 * Features that are built but switched off (or on) in code. A stored value
 * for a switched-off feature is still read and sanitised, just not applied,
 * so turning one back on needs no migration.
 */

/** "Stick while scrolling" on a section. */
export const SECTION_STICKY_ENABLED = false
/** A shadow behind a section's text over a photo. */
export const SECTION_TEXT_SHADOW_ENABLED = false
/** A section's cards and items appearing one after another as it scrolls in. */
export const SECTION_STAGGER_ENABLED = true
/** Linked copies of a section — one original, edited once, drawn in several places. */
export const SECTION_LINKING_ENABLED = false
