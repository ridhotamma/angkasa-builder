/**
 * A layout, drawn.
 *
 * `ThemeScope` puts a theme's CSS variables on one wrapping element, so the
 * same document can show the editor's own chrome in Pesanle's theme and the
 * preview beside it in the shop's. `SectionsRenderer` walks the section list
 * and hands each one to its renderer.
 */

import { Box, Stack, type BoxProps } from '@chakra-ui/react'
import { type ReactNode } from 'react'

import type { SectionInstance } from '../model/content'
import { themeCssVars, type ThemeSettings } from '../model/settings'
import { RenderProvider, type RenderEnvironment } from './context'
import { SECTION_RENDERERS } from './sections'

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

export function SectionsRenderer({ sections, env, selectedId, onSelect }: SectionsRendererProps) {
  const visible = sections.filter((section) => !section.hidden)

  return (
    <RenderProvider value={env}>
      <Stack gap={{ base: '10', md: '14' }}>
        {visible.map((section) => {
          const Section = SECTION_RENDERERS[section.type]
          if (!Section) return null
          const rendered = <Section settings={section.settings} />
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
                event.preventDefault()
                onSelect(section.id)
              }}
            >
              {rendered}
            </Box>
          )
        })}
      </Stack>
    </RenderProvider>
  )
}
