/**
 * A layout, drawn.
 *
 * `ThemeScope` puts a theme's CSS variables on one wrapping element, so the
 * same document can show the editor's own chrome in Pesanle's theme and the
 * preview beside it in the shop's. `SectionsRenderer` walks the section list
 * and hands each one to its renderer, inside the frame its style asks for.
 */

import { Badge, Box, Stack, type BoxProps } from '@chakra-ui/react'
import { type ReactNode } from 'react'

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

          const selected = section.id === selectedId
          return (
            <Box
              key={section.id}
              mt={mt}
              data-section-id={section.id}
              position="relative"
              cursor="pointer"
              rounded="md"
              outline="2px solid"
              outlineColor={selected ? 'brand.solid' : 'transparent'}
              // Inside the section when it touches the page edges, where an
              // outline outside it would be cut off.
              outlineOffset={bleed ? '-2px' : '6px'}
              transition="outline-color 120ms"
              _hover={{ outlineColor: selected ? 'brand.solid' : 'brand.muted' }}
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
              <ScheduleBadge section={section} now={now} />
              {selected && toolbar && <ToolbarSlot inside={bleed || index === 0}>{toolbar(section)}</ToolbarSlot>}
              {rendered}
            </Box>
          )
        })}
      </Stack>
    </RenderProvider>
  )
}

/**
 * Where the selected section's toolbar sits: on the outline's top-right
 * corner, just above the section. It tucks inside the corner instead on a
 * full-bleed section, whose outline is drawn inside it and would cut it off at
 * the page edge, and on the first section, where above is the store header.
 */
function ToolbarSlot({ inside, children }: { inside: boolean; children: ReactNode }) {
  return (
    <Box
      position="absolute"
      right={inside ? '2' : '-6px'}
      top={inside ? '2' : '-6px'}
      transform={inside ? undefined : 'translateY(calc(-100% - 4px))'}
      zIndex="3"
    >
      {children}
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
