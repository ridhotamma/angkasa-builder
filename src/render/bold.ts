/**
 * The bold look: a thick ink border and a hard offset shadow with no blur,
 * the neo-brutalist frame that Quick Checkout's "Bold" theme made popular.
 *
 * One definition for both places it appears. Quick Checkout passes the hex
 * colours its palette resolved; the storefront passes a token variable
 * (`BOLD_INK`), so a card inside a dark colour-scheme band casts a pale
 * shadow, not a black one that disappears.
 */

/** The storefront's ink: the scheme's text colour wherever the frame sits. */
export const BOLD_INK = 'var(--chakra-colors-fg)'

export const BOLD_BORDER_WIDTH = '2px'

/** How far a card's and a button's shadows fall, in pixels. */
const CARD_OFFSET = 4
const BUTTON_OFFSET = 3

const PRESS_TRANSITION = 'transform 0.12s ease, box-shadow 0.12s ease, filter 0.12s ease'

/** A hard shadow `offset` pixels down and to the right. */
export function boldShadow(ink: string, offset = CARD_OFFSET): string {
  return `${offset}px ${offset}px 0 ${ink}`
}

/** A card's bold frame: the border and the shadow it rests on. */
export function boldCard(ink: string) {
  return {
    borderWidth: BOLD_BORDER_WIDTH,
    borderColor: ink,
    boxShadow: boldShadow(ink, CARD_OFFSET),
  }
}

/**
 * A button's bold frame, with the press that sells it: it lifts toward the
 * pointer on hover and lands on its shadow when pressed.
 */
export function boldButton(ink: string) {
  return {
    borderWidth: BOLD_BORDER_WIDTH,
    borderColor: ink,
    boxShadow: boldShadow(ink, BUTTON_OFFSET),
    transition: PRESS_TRANSITION,
    _hover: {
      transform: 'translate(-1px, -1px)',
      boxShadow: boldShadow(ink, BUTTON_OFFSET + 1),
    },
    _active: {
      transform: `translate(${BUTTON_OFFSET}px, ${BUTTON_OFFSET}px)`,
      boxShadow: 'none',
    },
  }
}
