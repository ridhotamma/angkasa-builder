/**
 * What the frame around a section tells the renderers inside it: how wide it
 * runs, the cap its content follows, whether it sits in a coloured band, and
 * the headline treatment it opted into.
 *
 * Kept apart from `frame.tsx` so a primitive the frame itself draws — the
 * slider, whose arrows must know when the band reaches the viewport edge —
 * can read the layout without importing the frame and its own output.
 */

import { createContext, useContext } from 'react'

import type {
  SectionContentWidth,
  SectionHeadline,
  SectionWidth,
} from '../model/section-style'

export interface SectionLayout {
  width: SectionWidth
  /** The cap the section's content runs at; renderers add the column for `edge`. */
  contentWidth: SectionContentWidth
  banded: boolean
  headline: SectionHeadline
}

export const SectionLayoutContext = createContext<SectionLayout>({
  width: 'contained',
  contentWidth: '6xl',
  banded: false,
  headline: 'none',
})

export function useSectionLayout() {
  return useContext(SectionLayoutContext)
}
