import { describe, expect, test } from 'bun:test'

import { createSection, sanitizeLayout } from '../src/index'
import { drawnSections, isHeaderTransparent, pageEdges } from '../src/render'

const now = new Date('2026-09-26T00:00:00Z')

describe('page edges', () => {
  test('a page that opens and closes full-bleed drops its padding', () => {
    const drawn = drawnSections(
      [
        createSection('banner', { media: 'video' }), // edge to edge by default
        createSection('rich-text'),
        createSection('banner', { media: 'parallax' }, { width: 'full' }),
      ],
      'live',
      now,
    )
    expect(pageEdges(drawn)).toEqual({ flushTop: true, flushBottom: true, bannerFirst: true })
  })

  test('only drawn sections count: a hidden or ended banner leaves the padding', () => {
    const hidden = { ...createSection('banner', { media: 'video' }), hidden: true }
    const ended = createSection(
      'banner',
      { media: 'image' },
      { width: 'edge', showUntil: '2026-01-01T00:00:00Z' },
    )
    const drawn = drawnSections([hidden, ended, createSection('rich-text')], 'live', now)
    expect(pageEdges(drawn)).toEqual({ flushTop: false, flushBottom: false, bannerFirst: false })
  })

  test('a full-width band is flush but is not a banner to see through', () => {
    const drawn = drawnSections(
      [createSection('cards', { card: 'icon' }, { width: 'full', colorScheme: 'subtle' })],
      'live',
      now,
    )
    expect(pageEdges(drawn)).toMatchObject({ flushTop: true, bannerFirst: false })
  })

  test('the header goes see-through only when asked and over a banner', () => {
    const asked = sanitizeLayout({ header: { transparentOnHome: true } }).header
    const notAsked = sanitizeLayout(null).header
    const banner = pageEdges(
      drawnSections([createSection('banner', { media: 'video' })], 'live', now),
    )
    const text = pageEdges(drawnSections([createSection('rich-text')], 'live', now))
    expect(isHeaderTransparent(asked, banner)).toBe(true)
    expect(isHeaderTransparent(asked, text)).toBe(false)
    expect(isHeaderTransparent(notAsked, banner)).toBe(false)
  })
})
