/**
 * Every look of a consolidated section reaches a renderer.
 *
 * `banner`, `product-list`, `gallery`, `quotes`, `cards`, `statement` and
 * `story` each store a choice — the look — and dispatch it to the renderer of
 * the old section type that look replaces. The dispatch is a plain record, so a
 * look whose old type is missing from it is not a compile error: `draw` returns
 * nothing and the whole section silently disappears from the page. Two banner
 * looks and the chapters-style story were doing exactly that.
 *
 * The check is deliberately blunt: rendered in *preview* mode, a look must draw
 * either the copy its starter carries, the "nothing here yet" notice, or
 * noticeably more markup than an empty section draws (the Chakra frame every
 * render carries). Drawing none of those means the look reached no renderer.
 *
 * See also `section-looks.test.ts` for which fields each look offers.
 */

import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import { renderToString } from 'react-dom/server'

import { LocaleProvider } from '../src/locale'
import { system } from '../src/ui'

import {
  SECTION_SCHEMAS,
  SECTION_STARTERS,
  createSection,
  readText,
  DEFAULT_THEME_SETTINGS,
  type Field,
  type SectionType,
} from '../src/index'
import {
  RenderProvider,
  sampleStorefrontData,
  SectionsRenderer,
  type RenderEnvironment,
} from '../src/render/index'

const NOW = new Date('2026-03-10T00:00:00.000Z')

function env(mode: 'live' | 'preview'): RenderEnvironment {
  return {
    data: sampleStorefrontData('Look Shop'),
    settings: DEFAULT_THEME_SETTINGS,
    mode,
    imageUrl: (id: string) => `/img/${id}`,
    formatPrice: (amount, currency) => `${amount} ${currency}`,
    now: NOW,
  }
}

/** What a section draws in the editor's preview, where an empty look is visible. */
function preview(type: SectionType, settings: Record<string, unknown>): string {
  const section = createSection(type, settings)
  return renderSections([section])
}

function renderSections(sections: ReturnType<typeof createSection>[]): string {
  const environment = env('preview')
  return renderToString(
    <ChakraProvider value={system}>
      <LocaleProvider locale="en">
        <RenderProvider value={environment}>
          <SectionsRenderer sections={sections} env={environment} />
        </RenderProvider>
      </LocaleProvider>
    </ChakraProvider>,
  )
}

/**
 * What a render costs when no section drew anything — the Chakra frame and the
 * section's own wrapper, measured here rather than guessed, so a look that
 * reached no renderer can be told from one that drew a section.
 */
const FRAME = renderSections([]).length
const DREW = FRAME + 400

/** The consolidated types, and the field whose value picks their renderer. */
const CONSOLIDATED: Array<{ type: SectionType; look: string }> = [
  { type: 'banner', look: 'media' },
  { type: 'product-list', look: 'source' },
  { type: 'gallery', look: 'layout' },
  { type: 'quotes', look: 'variant' },
  { type: 'cards', look: 'card' },
  { type: 'statement', look: 'layout' },
  { type: 'story', look: 'style' },
]

describe('every consolidated look draws something', () => {
  for (const { type, look } of CONSOLIDATED) {
    const schema = SECTION_SCHEMAS.find((candidate) => candidate.type === type)
    const field = (schema?.fields as readonly Field[] | undefined)?.find(
      (candidate) => candidate.key === look,
    )
    const options = ((field as { options?: { value: string }[] } | undefined)?.options ?? []).map(
      (option) => option.value,
    )

    test(`${type} offers looks, and every one reaches a renderer`, () => {
      expect(options.length).toBeGreaterThan(1)

      const starter = SECTION_STARTERS[type]?.(NOW) ?? {}
      const heading = readText(starter as never, 'heading')

      for (const value of options) {
        const html = preview(type, { ...starter, [look]: value })
        const drew =
          html.includes('data-empty-notice') ||
          html.length > DREW ||
          (heading.length > 0 && html.includes(heading))
        expect(drew, `${type} [${look}=${value}] reached no renderer`).toBe(true)
      }
    })
  }

  test('the chapters story draws its chapters', () => {
    // The regression this file exists for: the list was stored under `items`
    // and read from `steps`.
    const html = preview('story', SECTION_STARTERS.story?.(NOW) ?? {})
    for (const heading of ['Designed', 'Made', 'Shipped']) {
      expect(html).toContain(heading)
    }
  })
})
