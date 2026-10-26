import { describe, expect, test } from 'bun:test'

import { stockPhotoValue } from '@repo/appwrite-config'

import { drawnSections, layoutMedia, pageEdges, sanitizeLayout, sanitizeSections } from '../src/index'

const STOCK = stockPhotoValue('https://images.pexels.com/photos/1/pexels-photo-1.jpeg', {
  provider: 'pexels',
  photographer: 'Ana',
  photographerUrl: 'https://www.pexels.com/@ana',
})

describe('layoutMedia', () => {
  const sections = sanitizeSections([
    { id: 'a', type: 'statement', settings: { layout: 'contained', image: 'file-abc_1' } },
    { id: 'b', type: 'statement', settings: { layout: 'contained', image: STOCK } },
    {
      id: 'c',
      type: 'video-reels',
      settings: {
        items: [{ id: 'r', video: { source: 'upload', id: 'vid1' }, poster: 'img2', productId: 'p' }],
      },
    },
  ])

  test('finds bucket files, stock photos and uploaded videos', () => {
    const media = layoutMedia(sections)
    expect(media.images.sort()).toEqual(['file-abc_1', 'img2', STOCK].sort())
    expect(media.videos).toEqual(['vid1'])
  })

  test('reads the header and footer when a layout is given', () => {
    const layout = sanitizeLayout(null)
    expect(layoutMedia([], layout)).toEqual({ images: [], videos: [] })
  })
})

describe('drawnSections', () => {
  test('a hidden section is not drawn live, and the edges follow what is', () => {
    const sections = sanitizeSections([
      { id: 'a', type: 'statement', settings: { layout: 'contained' }, hidden: true },
      { id: 'b', type: 'statement', settings: { layout: 'contained' } },
    ])
    const live = drawnSections(sections, 'live', new Date())
    expect(live.map((section) => section.id)).toEqual(['b'])
    expect(pageEdges(live)).toHaveProperty('flushTop')
  })
})
