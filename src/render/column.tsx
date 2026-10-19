import type { ReactNode } from 'react'

import { useSectionLayout } from './section-layout'
import { PageColumn } from './primitives'

/**
 * A section's words, kept in the page column when the section runs edge to
 * edge.
 *
 * A full-bleed section paints its background and media across the viewport,
 * but its text belongs in the same column as the header and every contained
 * section around it — the documented contract in `model/section-style.ts`.
 * `SectionFrame` supplies that column for `full`; for `edge` the renderer
 * wraps its text in this. A contained or `full` section is already in a
 * column, so this is a no-op there.
 */
export function SectionColumn({ children }: { children: ReactNode }) {
  const { width, contentWidth } = useSectionLayout()
  if (width !== 'edge') return <>{children}</>
  return <PageColumn maxW={contentWidth}>{children}</PageColumn>
}
