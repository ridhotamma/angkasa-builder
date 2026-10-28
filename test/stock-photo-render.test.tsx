/**
 * Hotlinked stock photos and the browser's cookie jar.
 *
 * Pixabay/Pexels/Unsplash CDNs answer every hotlinked image with a
 * third-party cookie (`__cf_bm`, `_cfuvid`), which browsers are phasing out
 * and Lighthouse flags in Best Practices. The renderer must fetch a stock
 * photo with `crossorigin="anonymous"` — and only a stock photo: a bucket
 * image that does not allow anonymous CORS would break if forced.
 */

import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'

import { stockPhotoValue } from '../src/model/stock-photo'
import { LocaleProvider } from '../src/locale'
import { system } from '../src/ui'

import { createSection, DEFAULT_THEME_SETTINGS } from '../src/index'
import { sampleStorefrontData, SectionsRenderer, type RenderEnvironment } from '../src/render/index'

const STOCK = stockPhotoValue('https://pixabay.com/get/abc_1280.jpg', {
  provider: 'pixabay',
  photographer: 'Jane',
  photographerUrl: 'https://pixabay.com/users/jane-1/',
})

function render(image: string): string {
  const env: RenderEnvironment = {
    data: sampleStorefrontData('Stock Shop'),
    settings: DEFAULT_THEME_SETTINGS,
    mode: 'live',
    imageUrl: () => image,
    formatPrice: (amount, currency) => `${amount} ${currency}`,
    now: new Date('2026-03-10T00:00:00.000Z'),
  }
  const node: ReactNode = (
    <SectionsRenderer
      sections={[createSection('banner', { media: 'image', heading: 'Hi', image: 'file-abc_1' })]}
      env={env}
    />
  )
  return renderToString(
    <ChakraProvider value={system}>
      <LocaleProvider locale="en">
        {node}
      </LocaleProvider>
    </ChakraProvider>,
  )
}

function firstImageTag(html: string): string {
  return html.match(/<img[^>]*>/)?.[0] ?? ''
}

describe('stock photos in the section renderer', () => {
  test('a hotlinked stock photo is fetched with anonymous credentials', () => {
    expect(firstImageTag(render(STOCK))).toContain('crossorigin="anonymous"')
  })

  test('a bucket image keeps the element default', () => {
    const html = render('https://assets.pesanle.com/public/x-y/product/y-w1600.webp')
    expect(firstImageTag(html)).not.toContain('crossorigin')
  })
})
