import { describe, expect, test } from 'bun:test'

import { stockPhotoValue } from '../src/model/stock-photo'

import { createSection, imageFileIds, remapImageFileIds, type SectionInstance } from '../src/index'

const STOCK = stockPhotoValue('https://images.pexels.com/photos/1/pexels-photo-1.jpeg', {
  provider: 'pexels',
  photographer: 'Jane Doe',
  photographerUrl: 'https://www.pexels.com/@jane',
})

describe('image fields and stock photos', () => {
  test('a stock photo survives sanitising, an arbitrary URL does not', () => {
    const withStock = createSection('statement', {
      layout: 'contained',
      heading: 'Roastery',
      image: STOCK,
    })
    expect(withStock.settings.image).toBe(STOCK)

    const withUrl = createSection('statement', {
      layout: 'contained',
      heading: 'Roastery',
      image: 'https://example.com/photo.jpg',
    })
    expect(withUrl.settings.image).toBe('')

    const withId = createSection('statement', {
      layout: 'contained',
      heading: 'Roastery',
      image: 'file-abc_1',
    })
    expect(withId.settings.image).toBe('file-abc_1')
  })

  test('imageFileIds collects bucket files only', () => {
    const sections: SectionInstance[] = [
      createSection('statement', { layout: 'contained', image: 'file-abc_1' }),
      createSection('statement', { layout: 'contained', image: STOCK }),
    ]
    expect(imageFileIds(sections)).toEqual(['file-abc_1'])
  })

  test('copying a layout keeps stock photos and clears unmapped files', () => {
    const sections: SectionInstance[] = [
      createSection('statement', { layout: 'contained', image: 'file-abc_1' }),
      createSection('statement', { layout: 'contained', image: STOCK }),
    ]
    const copied = remapImageFileIds(sections, new Map())
    expect(copied[0]!.settings.image).toBe('')
    expect(copied[1]!.settings.image).toBe(STOCK)
  })
})
