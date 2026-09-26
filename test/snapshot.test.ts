import { describe, expect, test } from 'bun:test'

import {
  CONTENT_VERSION,
  createSection,
  DEFAULT_THEME_SETTINGS,
  sanitizeLayout,
  type ThemeContent,
} from '../src/index'
import { sampleStorefrontData } from '../src/render/index'
import { renderTemplateSnapshotHtml } from '../src/snapshot/index'

function content(): ThemeContent {
  return {
    version: CONTENT_VERSION,
    settings: DEFAULT_THEME_SETTINGS,
    layout: sanitizeLayout(null),
    templates: {
      home: [
        createSection('shop-intro', { showDescription: true }),
        createSection('rich-text', { heading: 'Snapshot probe', body: 'A section that must appear.' }),
      ],
      product: [],
    },
  }
}

describe('template snapshot document', () => {
  test('draws the home page to a standalone document with inlined styles', () => {
    const html = renderTemplateSnapshotHtml({
      content: content(),
      data: sampleStorefrontData('Snapshot shop'),
      imageUrl: () => null,
      formatPrice: (amount, currency) => `${amount} ${currency}`,
    })

    expect(html).toStartWith('<!DOCTYPE html>')
    // The page itself, not an empty shell.
    expect(html).toContain('Snapshot probe')
    expect(html).toContain('Snapshot shop')
    // The theme's tokens made it into extracted CSS…
    expect(html).toContain('--chakra-colors-brand-500')
    // …inside real style tags (Chakra preflight + emotion rules)…
    expect(html).toContain('<style data-emotion="snap ')
    // …and the webfont for the theme's faces is linked in the head.
    expect(html).toContain('fonts.googleapis.com')
    expect(html).toContain('width=1280')
  })

  test('survives sections with no shop content behind them', () => {
    const empty = content()
    empty.templates.home = [createSection('featured-collection', { limit: 8, columns: '4' })]
    const html = renderTemplateSnapshotHtml({
      content: empty,
      data: { ...sampleStorefrontData(), collections: [], latest: [] },
      imageUrl: () => null,
      formatPrice: (amount, currency) => `${amount} ${currency}`,
    })
    expect(html).toContain('<!DOCTYPE html>')
  })
})
