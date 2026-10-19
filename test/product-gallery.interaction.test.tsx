/**
 * The product gallery's two floating actions: share and save.
 *
 * Share opens the short list a marketplace listing shows — Facebook, Twitter,
 * WhatsApp, email, copy the link, cancel — and the heart is the shop's own
 * wishlist. Scoped to happy-dom (see `./happy-dom-setup`) so the dialog can
 * actually be opened.
 */

import './happy-dom-setup'

import { afterEach, describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import { cleanup, fireEvent, render, within } from '@testing-library/react'

import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

import { createSection, DEFAULT_THEME_SETTINGS } from '../src/index'
import {
  RenderProvider,
  sampleStorefrontData,
  SectionsRenderer,
  type RenderEnvironment,
} from '../src/render/index'

afterEach(() => cleanup())

function gallery(toggled: string[]) {
  const env: RenderEnvironment = {
    data: sampleStorefrontData('Gallery Shop'),
    settings: { ...DEFAULT_THEME_SETTINGS, splash: { ...DEFAULT_THEME_SETTINGS.splash } },
    // Preview mode supplies the stand-in product; the wishlist comes from the
    // host, exactly as the storefront passes it.
    mode: 'preview',
    imageUrl: () => null,
    formatPrice: (amount, currency) => `${amount} ${currency}`,
    now: new Date('2026-03-10T00:00:00.000Z'),
    wishlist: { ids: new Set<string>(), onToggle: (product) => toggled.push(product.id) },
  }
  return render(
    <ChakraProvider value={system}>
      <I18nProvider locale="en" resources={{}}>
        <RenderProvider value={env}>
          <SectionsRenderer
            sections={[createSection('product-info', { gallery: 'mosaic', stickyInfo: true })]}
            env={env}
          />
        </RenderProvider>
      </I18nProvider>
    </ChakraProvider>,
  )
}

/** A product with enough photos for the mosaic's "+N" tile to show. */
function photoProduct(images: number) {
  return {
    id: 'product-1',
    name: 'Gallery jacket',
    slug: 'gallery-jacket',
    price: 249_000,
    compareAtPrice: null,
    images: Array.from({ length: images }, (_, index) => ({
      url: `photo-${index}`,
      thumbUrl: `thumb-${index}`,
    })),
    description: 'A jacket.',
    rating: null,
    ratingCount: 0,
    available: 3,
    category: null,
    sizeGuide: null,
    related: [],
  }
}

describe('the product gallery actions', () => {
  test('share opens the list of places to send it', async () => {
    const view = gallery([])
    fireEvent.click(view.getByLabelText('Share'))
    const dialog = await view.findByRole('dialog')
    for (const label of [
      'Share to Facebook',
      'Share to Twitter',
      'Share via WhatsApp',
      'Share via Email',
      'Copy link',
      'Cancel',
    ]) {
      expect(within(dialog).getByText(label), label).toBeDefined()
    }
  })

  test('a photo opens the fullscreen viewer, arrows paired at the bottom', async () => {
    const env: RenderEnvironment = {
      data: { ...sampleStorefrontData('Gallery Shop'), product: photoProduct(6) },
      settings: { ...DEFAULT_THEME_SETTINGS, splash: { ...DEFAULT_THEME_SETTINGS.splash } },
      mode: 'preview',
      imageUrl: () => null,
      formatPrice: (amount, currency) => `${amount} ${currency}`,
      now: new Date('2026-03-10T00:00:00.000Z'),
    }
    const view = render(
      <ChakraProvider value={system}>
        <I18nProvider locale="en" resources={{}}>
          <RenderProvider value={env}>
            <SectionsRenderer
              sections={[createSection('product-info', { gallery: 'mosaic', stickyInfo: true })]}
              env={env}
            />
          </RenderProvider>
        </I18nProvider>
      </ChakraProvider>,
    )
    fireEvent.click(view.getByLabelText('View all photos'))
    const viewer = await view.findByRole('dialog')
    // The photos ride the shared track, with the arrows paired at the bottom
    // and no dots: the pair is the whole indicator in a viewer.
    expect(viewer.querySelector('[data-slider-band]')).not.toBeNull()
    const pair = within(viewer).getByLabelText('Previous slide').parentElement!
    expect(within(pair).getByLabelText('Next slide')).toBeDefined()
    expect(within(viewer).queryByLabelText('Slide 1')).toBeNull()
    expect(within(viewer).getByLabelText('Close')).toBeDefined()
  })

  test('the heart is the host’s wishlist', () => {
    const toggled: string[] = []
    const view = gallery(toggled)
    fireEvent.click(view.getByLabelText('Save to wishlist'))
    expect(toggled.length).toBe(1)
  })

  test('without a host wishlist the heart is left out', () => {
    const env: RenderEnvironment = {
      data: sampleStorefrontData('Gallery Shop'),
      settings: { ...DEFAULT_THEME_SETTINGS, splash: { ...DEFAULT_THEME_SETTINGS.splash } },
      // The preview's stand-in product, with no wishlist on the host at all.
      mode: 'preview',
      imageUrl: () => null,
      formatPrice: (amount, currency) => `${amount} ${currency}`,
      now: new Date('2026-03-10T00:00:00.000Z'),
    }
    const view = render(
      <ChakraProvider value={system}>
        <I18nProvider locale="en" resources={{}}>
          <RenderProvider value={env}>
            <SectionsRenderer
              sections={[createSection('product-info', { gallery: 'mosaic', stickyInfo: true })]}
              env={env}
            />
          </RenderProvider>
        </I18nProvider>
      </ChakraProvider>,
    )
    expect(view.queryByLabelText('Save to wishlist')).toBeNull()
    // The share button is the shop's own, so it stays.
    expect(view.queryByLabelText('Share')).not.toBeNull()
  })
})
