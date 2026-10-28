/**
 * The CSS variables the store header and tab bar publish on the document
 * root. Kept apart from the components, so the framework-free runtime can
 * write the same ones without importing React.
 */

/** The room the header takes from the page (0 while it floats over a banner). */
export const HEADER_HEIGHT_VAR = '--store-header-height'
/** What anything sticky below the header must leave above itself. */
export const HEADER_OFFSET_VAR = '--store-header-offset'
/** The phone tab bar's height. */
export const TABBAR_HEIGHT_VAR = '--store-tabbar-height'
