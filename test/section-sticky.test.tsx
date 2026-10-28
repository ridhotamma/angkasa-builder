/**
 * A sticky section band.
 *
 * The "Stick while scrolling" toggle pins a section at the top while the
 * sections after it scroll up over it. The position has to land on the
 * section's wrapper — the element carrying the anchor id — because a sticky
 * box is clamped to its containing block, and the wrapper is what spans the
 * whole column of sections. On the frame inside it (whose parent is that same
 * wrapper, exactly the frame's own height) it had no room to travel and
 * scrolled away like any other section.
 */

import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'

import { SECTION_STICKY_ENABLED } from '../src/model/flags'
import { LocaleProvider } from '../src/locale'
import { system } from '../src/ui'

import { createSection, DEFAULT_THEME_SETTINGS, sectionAnchorId } from '../src/index'
import { sampleStorefrontData, SectionsRenderer, type RenderEnvironment } from '../src/render/index'

function env(): RenderEnvironment {
  return {
    data: sampleStorefrontData('Sticky Shop'),
    settings: DEFAULT_THEME_SETTINGS,
    mode: 'live',
    imageUrl: () => null,
    formatPrice: (amount, currency) => `${amount} ${currency}`,
    now: new Date('2026-03-10T00:00:00.000Z'),
  }
}

function hero(style: Record<string, unknown> = {}) {
  return createSection(
    'banner',
    { media: 'image', heading: 'Judul', subheading: 'Subjudul' },
    style,
  )
}

function render(sections: ReturnType<typeof hero>[]): string {
  const node: ReactNode = <SectionsRenderer sections={sections} env={env()} />
  return renderToString(
    <ChakraProvider value={system}>
      <LocaleProvider locale="en">
        {node}
      </LocaleProvider>
    </ChakraProvider>,
  )
}

/** The opening tag of the element carrying a section's anchor id. */
function anchorTag(html: string, sectionId: string): string | null {
  const at = html.indexOf(`id="${sectionAnchorId(sectionId)}"`)
  if (at < 0) return null
  const start = html.lastIndexOf('<', at)
  return html.slice(start, html.indexOf('>', at) + 1)
}

function classAttribute(tag: string): string[] {
  const match = tag.match(/class="([^"]*)"/)
  return match?.[1] ? match[1].split(/\s+/).filter(Boolean) : []
}

/** The declarations of an Emotion class rule, or an empty string. */
function classRule(html: string, className: string): string {
  const at = html.indexOf(`.${className}{`)
  if (at < 0) return ''
  const start = at + className.length + 2
  return html.slice(start, html.indexOf('}', start))
}

/** Whether the element with a section's anchor id is the sticky box. */
function anchorIsSticky(html: string, sectionId: string): boolean {
  const tag = anchorTag(html, sectionId)
  if (!tag) return false
  return classAttribute(tag).some((className) =>
    classRule(html, className).includes('position:sticky'),
  )
}

/**
 * The sticky band is built but switched off (`SECTION_STICKY_ENABLED`): the
 * toggle is not offered and a stored `sticky: true` is ignored. These tests
 * pin the behaviour for the day it is turned back on, so they run only then.
 */
describe.skipIf(!SECTION_STICKY_ENABLED)('the sticky section band', () => {
  test('the wrapper with the anchor id carries the sticky position', () => {
    const section = hero({ sticky: true })
    const html = render([section])

    expect(anchorIsSticky(html, section.id)).toBe(true)
    const stickyClass = classAttribute(anchorTag(html, section.id)!).find((className) =>
      classRule(html, className).includes('position:sticky'),
    )!
    expect(classRule(html, stickyClass)).toContain('top:0')
  })

  test('the frame inside the wrapper is not the sticky box', () => {
    // One sticky rule on the page, and it belongs to the anchor element — the
    // frame's own `position:relative` is a different rule.
    const section = hero({ sticky: true })
    const html = render([section])
    const tags = html.match(/<div[^>]*>/g) ?? []
    const stickyTags = tags.filter((tag) =>
      classAttribute(tag).some((className) =>
        classRule(html, className).includes('position:sticky'),
      ),
    )
    expect(stickyTags).toHaveLength(1)
    expect(stickyTags[0]).toContain(`id="${sectionAnchorId(section.id)}"`)
  })

  test('a section without the toggle is not sticky', () => {
    const section = hero()
    const html = render([section])
    expect(anchorIsSticky(html, section.id)).toBe(false)
  })

  test('the sections after a sticky one still render, later in the DOM', () => {
    const first = hero({ sticky: true })
    const second = hero()
    const html = render([first, second])
    expect(html).toContain('Judul')
    expect(html.indexOf(sectionAnchorId(first.id))).toBeLessThan(
      html.indexOf(sectionAnchorId(second.id)),
    )
  })
})
