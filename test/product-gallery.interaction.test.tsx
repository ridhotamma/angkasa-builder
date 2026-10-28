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
import { act, cleanup, fireEvent, render, within } from '@testing-library/react'

import { LocaleProvider } from '../src/locale'
import { system } from '../src/ui'

import { createSection, DEFAULT_THEME_SETTINGS } from '../src/index'
import {
  RenderProvider,
  sampleStorefrontData,
  SectionsRenderer,
  type RenderEnvironment,
} from '../src/render/index'
import { sliderTransform } from '../src/render/slider'

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
      <LocaleProvider locale="en">
        <RenderProvider value={env}>
          <SectionsRenderer
            sections={[createSection('product-info', { gallery: 'mosaic', stickyInfo: true })]}
            env={env}
          />
        </RenderProvider>
      </LocaleProvider>
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
      // Real URLs, so the photos render as `<img>` (a bare name like `photo-0`
      // is an error in a browser, and the component quietly swaps in its
      // fallback icon).
      url: `https://example.com/photo-${index}.jpg`,
      thumbUrl: `https://example.com/thumb-${index}.jpg`,
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

/** The gallery's page with a product carrying `images` photos. */
function photos(images: number, settings: Record<string, unknown> = {}) {
  const env: RenderEnvironment = {
    data: { ...sampleStorefrontData('Gallery Shop'), product: photoProduct(images) },
    settings: { ...DEFAULT_THEME_SETTINGS, splash: { ...DEFAULT_THEME_SETTINGS.splash } },
    mode: 'preview',
    imageUrl: () => null,
    formatPrice: (amount, currency) => `${amount} ${currency}`,
    now: new Date('2026-03-10T00:00:00.000Z'),
  }
  return render(
    <ChakraProvider value={system}>
      <LocaleProvider locale="en">
        <RenderProvider value={env}>
          <SectionsRenderer
            sections={[
              createSection('product-info', { gallery: 'mosaic', stickyInfo: true, ...settings }),
            ]}
            env={env}
          />
        </RenderProvider>
      </LocaleProvider>
    </ChakraProvider>,
  )
}

/** The viewer's own track, as the slider wrote it. */
function viewerTrack(dialog: HTMLElement): string {
  return dialog.querySelector<HTMLElement>('[data-slider-track]')!.style.transform
}

/** Let the wrap's own frames run — the jump back takes two. */
async function frames() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 40))
  })
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

  test('a photo magnifies under a desktop pointer only where the theme asked', () => {
    // The grid is the layout whose photos take the pointer directly.
    const zoomed = photos(2, { gallery: 'grid', zoom: true })
    const growing = zoomed.container.querySelector('img')!
    // The frame is the pointer's target; the photo inside is what scales.
    fireEvent.pointerMove(growing.parentElement!, {
      pointerType: 'mouse',
      clientX: 10,
      clientY: 10,
    })
    expect(growing.style.transform).toBe('scale(1.8)')

    const plain = photos(2, { gallery: 'grid' })
    const still = plain.container.querySelector('img')!
    fireEvent.pointerMove(still.parentElement!, {
      pointerType: 'mouse',
      clientX: 10,
      clientY: 10,
    })
    expect(still.style.transform).toBe('')
  })

  test('a photo opens the fullscreen viewer, arrows paired at the bottom', async () => {
    const view = photos(6)
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

  test('the viewer loops: past either end, on into the next photo', async () => {
    const view = photos(6)
    fireEvent.click(view.getByLabelText('View all photos'))
    const viewer = await view.findByRole('dialog')
    const track = viewer.querySelector<HTMLElement>('[data-slider-track]')!
    // The "+N" tile is the fifth photo, so the viewer opens on it.
    const next = within(viewer).getByLabelText('Next slide')
    fireEvent.click(next)
    expect(viewerTrack(viewer)).toBe(sliderTransform(6, 1))
    // One more step leaves the last photo, gliding *forward* onto the double
    // of the first — one slide on, not a rewind across the whole set.
    fireEvent.click(next)
    expect(viewerTrack(viewer)).toBe(sliderTransform(7, 1))
    // The double is the first photo's own pixels, so the jump back is invisible.
    fireEvent.transitionEnd(track, { propertyName: 'transform' })
    expect(viewerTrack(viewer)).toBe(sliderTransform(1, 1))
    await frames()
    // And the other way: back from the first photo, onto the last's double.
    fireEvent.click(within(viewer).getByLabelText('Previous slide'))
    expect(viewerTrack(viewer)).toBe('translateX(0)')
    fireEvent.transitionEnd(track, { propertyName: 'transform' })
    expect(viewerTrack(viewer)).toBe(sliderTransform(6, 1))
    await frames()
  })

  test('a step asked for mid-wrap is taken once the wrap lands', async () => {
    const view = photos(6)
    fireEvent.click(view.getByLabelText('View all photos'))
    const viewer = await view.findByRole('dialog')
    const track = viewer.querySelector<HTMLElement>('[data-slider-track]')!
    const next = within(viewer).getByLabelText('Next slide')
    fireEvent.click(next)
    fireEvent.click(next)
    // Still gliding, and asked for one more: the track must not be sent back
    // across the set to reach it — the step waits, then glides on.
    fireEvent.click(next)
    fireEvent.transitionEnd(track, { propertyName: 'transform' })
    expect(viewerTrack(viewer)).toBe(sliderTransform(1, 1))
    await frames()
    expect(viewerTrack(viewer)).toBe(sliderTransform(2, 1))
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
        <LocaleProvider locale="en">
          <RenderProvider value={env}>
            <SectionsRenderer
              sections={[createSection('product-info', { gallery: 'mosaic', stickyInfo: true })]}
              env={env}
            />
          </RenderProvider>
        </LocaleProvider>
      </ChakraProvider>,
    )
    expect(view.queryByLabelText('Save to wishlist')).toBeNull()
    // The share button is the shop's own, so it stays.
    expect(view.queryByLabelText('Share')).not.toBeNull()
  })
})
