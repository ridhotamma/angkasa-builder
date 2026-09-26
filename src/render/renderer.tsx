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

export function SectionsRenderer({ sections, env, selectedId, onSelect }: SectionsRendererProps) {
  const now = env.now ?? new Date()
  const visible =
    env.mode === 'live' ? liveSections(sections, now) : sections.filter((section) => !section.hidden)

  return (
    <RenderProvider value={env}>
      <Stack gap={{ base: '10', md: '14' }}>
        {visible.map((section) => {
          const Section = SECTION_RENDERERS[section.type]
          if (!Section) return null
          const rendered = (
            <SectionIdContext.Provider value={section.id}>
              <SectionFrame style={section.style}>
                <Section settings={section.settings} />
              </SectionFrame>
            </SectionIdContext.Provider>
          )
          if (!onSelect) return <Box key={section.id}>{rendered}</Box>

          const selected = section.id === selectedId
          return (
            <Box
              key={section.id}
              data-section-id={section.id}
              position="relative"
              cursor="pointer"
              rounded="md"
              outline="2px solid"
              outlineColor={selected ? 'brand.solid' : 'transparent'}
              outlineOffset="6px"
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
              {rendered}
            </Box>
          )
        })}
      </Stack>
    </RenderProvider>
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
