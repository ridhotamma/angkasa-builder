/**
 * A layout, drawn.
 *
 * `ThemeScope` puts a theme's CSS variables on one wrapping element, so the
 * same document can show the editor's own chrome in Pesanle's theme and the
 * preview beside it in the shop's. `SectionsRenderer` walks the section list
 * and hands each one to its renderer, inside the frame its style asks for.
 */

import { Badge, Box, Stack, type BoxProps } from '@chakra-ui/react'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

import { useLocale } from '@repo/i18n'

import type { SectionInstance } from '../model/content'
import { localize } from '../model/localized'
import { readSectionStyle, SCHEDULE_LABELS, scheduleState } from '../model/section-style'
import { themeCssVars, type ThemeSettings } from '../model/settings'
import { RenderProvider, type RenderEnvironment } from './context'
import { SectionFrame } from './frame'
import { SectionIdContext } from './primitives'
import { SECTION_RENDERERS } from './registry'

export function ThemeScope({
  settings,
  children,
  ...props
}: { settings: ThemeSettings; children: ReactNode } & BoxProps) {
  return (
    <Box css={themeCssVars(settings)} bg="bg" color="fg" fontFamily="body" {...props}>
      {children}
    </Box>
  )
}

export interface SectionsRendererProps {
  sections: readonly SectionInstance[]
  env: RenderEnvironment
  /** Editor only: highlights a section and reports clicks on one. */
  selectedId?: string | null
  onSelect?: (id: string) => void
  /**
   * Editor only: quick actions for the selected section (move, duplicate,
   * remove), drawn on its outline. The editor supplies them, so the renderer
   * needs to know nothing about editing.
   */
  toolbar?: (section: SectionInstance) => ReactNode
}

/**
 * Which sections the storefront draws right now. A hidden section never, and
 * a scheduled one only between its dates — judged at the environment's `now`,
 * which the storefront sets from the request so server and browser agree.
 * The editor draws everything that is not hidden, with a badge on sections
 * that are outside their dates.
 */
export function liveSections(
  sections: readonly SectionInstance[],
  now: Date,
): SectionInstance[] {
  return sections.filter((section) => {
    if (section.hidden) return false
    const state = scheduleState(readSectionStyle(section.style), now)
    return state === 'always' || state === 'live'
  })
}

/**
 * The sections a renderer in `mode` draws: live ones on the storefront,
 * everything not hidden in the editor.
 */
export function drawnSections(
  sections: readonly SectionInstance[],
  mode: RenderEnvironment['mode'],
  now: Date,
): SectionInstance[] {
  return mode === 'live' ? liveSections(sections, now) : sections.filter((section) => !section.hidden)
}

/** A section that runs past the page column — edge to edge, or on a full-width band. */
export function isFullBleed(section: SectionInstance): boolean {
  return readSectionStyle(section.style).width !== 'contained'
}

/**
 * Whether the page's own padding above and below the sections should go.
 *
 * The page column is padded top and bottom; a section that runs edge to edge
 * inside it would open (or close) with a strip of page background across it —
 * a banner that does not reach the header. The host drops that padding when
 * the first (or last) drawn section is full-bleed. Pass the sections the host
 * will draw, from `drawnSections`.
 */
export interface PageEdges {
  /** Drop the page's padding above the sections. */
  flushTop: boolean
  /** Drop it below them, and the footer's gap. */
  flushBottom: boolean
  /** The page opens with an edge-to-edge section a see-through header can float over. */
  bannerFirst: boolean
}

export const NO_PAGE_EDGES: PageEdges = { flushTop: false, flushBottom: false, bannerFirst: false }

export function pageEdges(drawn: readonly SectionInstance[]): PageEdges {
  const first = drawn[0]
  const last = drawn[drawn.length - 1]
  return {
    flushTop: first !== undefined && isFullBleed(first),
    flushBottom: last !== undefined && isFullBleed(last),
    bannerFirst: first !== undefined && readSectionStyle(first.style).width === 'edge',
  }
}

/** The space between two sections in the page column. */
const SECTION_GAP = { base: '10', md: '14' } as const

export function SectionsRenderer({
  sections,
  env,
  selectedId,
  onSelect,
  toolbar,
}: SectionsRendererProps) {
  const now = env.now ?? new Date()
  const visible = drawnSections(sections, env.mode, now)

  return (
    <RenderProvider value={env}>
      <Stack gap="0">
        {visible.map((section, index) => {
          const Section = SECTION_RENDERERS[section.type]
          if (!Section) return null
          // Two full-bleed sections in a row touch, like bands on a poster:
          // the page gap between them would be a strip of page background.
          // Their own "space above/below" is what separates them.
          const previous = visible[index - 1]
          const bleed = isFullBleed(section)
          const mt = !previous || (bleed && isFullBleed(previous)) ? '0' : SECTION_GAP
          const rendered = (
            <SectionIdContext.Provider value={section.id}>
              <SectionFrame style={section.style}>
                <Section settings={section.settings} />
              </SectionFrame>
            </SectionIdContext.Provider>
          )
          if (!onSelect) {
            return (
              <Box key={section.id} mt={mt}>
                {rendered}
              </Box>
            )
          }

          return (
            <PickableSection
              key={section.id}
              mt={mt}
              id={section.id}
              selected={section.id === selectedId}
              first={index === 0}
              toolbar={section.id === selectedId && toolbar ? toolbar(section) : null}
              badge={<ScheduleBadge section={section} now={now} />}
              onClickCapture={(event) => {
                // Every click also picks the section. A link must not be
                // followed out of the editor; anything else — a tab, a
                // slider arrow, the size guide drawer — still works, so the
                // seller can try the section out.
                const target = event.target as HTMLElement
                if (target.closest('a[href]') && !target.closest('[data-editable]')) {
                  event.preventDefault()
                }
                onSelect(section.id)
              }}
            >
              {rendered}
            </PickableSection>
          )
        })}
      </Stack>
    </RenderProvider>
  )
}

/** How far the outline stands off a section, and how far in it sits where the section meets the page edge. */
const OUTLINE_GAP = 6
const OUTLINE_INSET = 2

/** The outline's box, in the wrapper's coordinates. */
interface OutlineBox {
  top: number
  left: number
  width: number
  height: number
  /** The section runs across the page, edge to edge. */
  band: boolean
}

/**
 * Where the outline goes: around the box the section is actually drawn in.
 *
 * That is not the wrapper. A full-width or edge-to-edge section breaks out of
 * the page column, so an outline on the column's wrapper cut through it. The
 * frame's offset box is measured instead, which the scroll-reveal transform
 * does not skew. The outline stands off the section, but is kept inside the
 * page so the frame's edges never cut it off. A section that spans the page
 * gets its outline just inside its own edges.
 */
function measureOutline(wrapper: HTMLElement): OutlineBox | null {
  const frame = wrapper.firstElementChild as HTMLElement | null
  // A section hidden on this device has no box to outline.
  if (!frame || frame.offsetWidth === 0) return null
  const page = wrapper.ownerDocument.documentElement.clientWidth
  const origin = wrapper.getBoundingClientRect().left
  const start = frame.offsetLeft
  const end = start + frame.offsetWidth
  const band = origin + start <= OUTLINE_GAP && origin + end >= page - OUTLINE_GAP
  const gap = band ? -OUTLINE_INSET : OUTLINE_GAP
  const left = Math.max(start - gap, OUTLINE_INSET - origin)
  const right = Math.min(end + gap, page - OUTLINE_INSET - origin)
  return {
    top: frame.offsetTop - gap,
    left,
    width: right - left,
    height: frame.offsetHeight + 2 * gap,
    band,
  }
}

function sameBox(a: OutlineBox | null, b: OutlineBox | null) {
  if (!a || !b) return a === b
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height && a.band === b.band
}

/**
 * A section in the editor: clickable, outlined when hovered or selected, with
 * the selected one's toolbar on the outline's top-right corner. The toolbar
 * tucks inside the corner on a section that spans the page, where above is
 * the section before it, and on the first section, where above is the store
 * header.
 */
function PickableSection({
  id,
  selected,
  first,
  toolbar,
  badge,
  children,
  ...props
}: {
  id: string
  selected: boolean
  first: boolean
  toolbar: ReactNode
  badge: ReactNode
  children: ReactNode
} & BoxProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<OutlineBox | null>(null)

  const update = () => {
    const wrapper = ref.current
    if (!wrapper) return
    const next = measureOutline(wrapper)
    setBox((previous) => (sameBox(previous, next) ? previous : next))
  }

  // Every render: a style change can swap the frame for a wider one without
  // resizing the wrapper.
  useLayoutEffect(update)

  // And whenever the section or the page changes size on its own: images
  // loading, the device switched, a scrollbar appearing.
  useLayoutEffect(() => {
    const wrapper = ref.current
    const view = wrapper?.ownerDocument.defaultView
    if (!wrapper || !view) return
    const observer = new view.ResizeObserver(update)
    observer.observe(wrapper)
    observer.observe(wrapper.ownerDocument.documentElement)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const inside = first || !!box?.band
  return (
    <Box
      ref={ref}
      data-section-id={id}
      position="relative"
      cursor="pointer"
      css={{ '&:hover > [data-section-outline]': { borderColor: selected ? 'brand.solid' : 'brand.muted' } }}
      {...props}
    >
      {children}
      {badge}
      {box && (
        <Box
          data-section-outline=""
          position="absolute"
          zIndex="3"
          pointerEvents="none"
          rounded="md"
          borderWidth="2px"
          borderColor={selected ? 'brand.solid' : 'transparent'}
          transition="border-color 120ms"
          style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
        >
          {toolbar && (
            <Box
              position="absolute"
              pointerEvents="auto"
              // The border is inside the box: -2px lines the toolbar up with its outer edge.
              right={inside ? '2' : '-2px'}
              top={inside ? '2' : '-2px'}
              transform={inside ? undefined : 'translateY(calc(-100% - 4px))'}
            >
              {toolbar}
            </Box>
          )}
        </Box>
      )}
    </Box>
  )
}

/** In the editor: says a section is timed, and dims one that is not on the storefront now. */
function ScheduleBadge({ section, now }: { section: SectionInstance; now: Date }) {
  const { locale } = useLocale()
  const style = readSectionStyle(section.style)
  const state = scheduleState(style, now)
  if (state === 'always') return null
  const when = state === 'scheduled' ? style.showFrom : style.showUntil
  const date = when?.toLocaleString(locale === 'id' ? 'id-ID' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  return (
    <Badge
      position="absolute"
      top="2"
      right="2"
      zIndex="2"
      colorPalette={state === 'live' ? 'green' : state === 'scheduled' ? 'blue' : 'gray'}
      variant="solid"
      shadow="sm"
    >
      {localize(SCHEDULE_LABELS[state], locale)}
      {date ? ` · ${date}` : ''}
    </Badge>
  )
}
