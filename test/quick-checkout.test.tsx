import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import { renderToString } from 'react-dom/server'

import { stockPhotoValue } from '@repo/appwrite-config'
import { system } from '@repo/theme'

import { contrastRatio } from '../src/model/settings'
import {
  findQcTheme,
  parseQuickCheckoutContent,
  QC_THEME_PRESETS,
  qcPalette,
  qcProductIds,
  QuickCheckoutPage,
  safeUrl,
  sanitizeQuickCheckoutContent,
  serializeQuickCheckoutContent,
  socialHref,
  starterQuickCheckout,
  whatsappHref,
  youtubeId,
  type QcProductView,
  type QuickCheckoutContent,
} from '../src/quick-checkout'

const SHOP = {
  name: 'Kaos Keren',
  description: 'Kaos katun lokal.',
  logoFileId: 'logo123',
  bannerFileId: null,
  contactEmail: 'halo@kaoskeren.id',
  contactPhone: '0812-3456-7890',
  socials: { instagram: 'https://instagram.com/kaoskeren', tiktok: '' },
}

describe('sanitizeQuickCheckoutContent', () => {
  test('anything at all becomes a drawable page', () => {
    for (const value of [null, undefined, 42, 'x', [], { blocks: 'nope', style: 7 }]) {
      const page = sanitizeQuickCheckoutContent(value)
      expect(page.version).toBe(1)
      expect(page.blocks).toEqual([])
      expect(page.style.theme).toBe('clean')
    }
  })

  test('unknown blocks are dropped and known ones keep their order', () => {
    const page = sanitizeQuickCheckoutContent({
      blocks: [
        { id: 'a', type: 'text', title: 'Hi', body: 'There', align: 'left', visible: true },
        { id: 'b', type: 'script', src: 'evil.js' },
        { id: 'c', type: 'links', items: [{ id: 'l1', label: 'Site', url: 'example.com' }] },
      ],
    })
    expect(page.blocks.map((block) => block.id)).toEqual(['a', 'c'])
    const links = page.blocks[1]
    expect(links?.type === 'links' && links.items[0]?.url).toBe('https://example.com/')
  })

  test('duplicate block ids are re-minted', () => {
    const page = sanitizeQuickCheckoutContent({
      blocks: [
        { id: 'same', type: 'text', body: 'one' },
        { id: 'same', type: 'text', body: 'two' },
      ],
    })
    expect(new Set(page.blocks.map((block) => block.id)).size).toBe(2)
  })

  test('invalid style values fall back to the theme, not to nothing', () => {
    const page = sanitizeQuickCheckoutContent({
      style: { theme: 'forest', accent: 'red', fontHeading: 'Comic Sans 2000', radius: 'huge' },
    })
    const forest = findQcTheme('forest').style
    expect(page.style.accent).toBe(forest.accent)
    expect(page.style.fontHeading).toBe(forest.fontHeading)
    expect(page.style.radius).toBe(forest.radius)
  })

  test('product ids are de-duplicated and bounded', () => {
    const ids = Array.from({ length: 50 }, (_, index) => `p${index % 40}`)
    const page = sanitizeQuickCheckoutContent({
      blocks: [{ id: 'p', type: 'products', productIds: [...ids, 'bad id!', 12] }],
    })
    expect(qcProductIds(page)).toHaveLength(30)
  })

  test('an oversized page is refused with a message, not truncated', () => {
    const blocks = Array.from({ length: 20 }, (_, index) => ({
      id: `t${index}`,
      type: 'text',
      title: 'x'.repeat(80),
      body: 'y'.repeat(1000),
    }))
    const huge = sanitizeQuickCheckoutContent({
      blocks: [
        ...blocks.slice(0, 10),
        ...Array.from({ length: 10 }, (_, index) => ({
          id: `l${index}`,
          type: 'links',
          items: Array.from({ length: 20 }, (_, item) => ({
            id: `i${index}${item}`,
            label: 'z'.repeat(60),
            url: `https://example.com/${'q'.repeat(400)}`,
          })),
        })),
      ],
    })
    expect(() => serializeQuickCheckoutContent(huge)).toThrow(/too large/)
  })

  test('a stored row round-trips', () => {
    const page = starterQuickCheckout(SHOP, 'midnight', 'id')
    expect(parseQuickCheckoutContent(serializeQuickCheckoutContent(page))).toEqual(page)
    expect(parseQuickCheckoutContent('{not json')).toEqual(sanitizeQuickCheckoutContent({}))
  })

  test("Pixabay's pixabay.com/get/ renditions survive as image values", () => {
    const value = stockPhotoValue('https://pixabay.com/get/abc123_1280.jpg', {
      provider: 'pixabay',
      photographer: 'Jane',
      photographerUrl: 'https://pixabay.com/users/jane-123/',
    })
    const page = sanitizeQuickCheckoutContent({
      blocks: [{ id: 'i', type: 'image', imageFileId: value, url: '' }],
    })
    const block = page.blocks[0]
    expect(block?.type === 'image' && block.imageFileId).toBe(value)

    const pageUrl = sanitizeQuickCheckoutContent({
      blocks: [
        { id: 'p', type: 'image', imageFileId: 'https://pixabay.com/photos/cafe-42/', url: '' },
      ],
    })
    const refused = pageUrl.blocks[0]
    expect(refused?.type === 'image' && refused.imageFileId).toBeNull()
  })
})

describe('starterQuickCheckout', () => {
  test('fills the page from what the shop already has', () => {
    const page = starterQuickCheckout(SHOP, 'clean', 'id')
    expect(page.profile.name).toBe('Kaos Keren')
    expect(page.profile.avatarFileId).toBe('logo123')
    expect(page.blocks.map((block) => block.type)).toEqual(['socials', 'products', 'contact'])
    const contact = page.blocks[2]
    expect(contact?.type === 'contact' && contact.whatsapp).toBe('0812-3456-7890')
    expect(contact?.type === 'contact' && contact.floating).toBe(true)
  })
})

describe('links', () => {
  test('only http(s) survives', () => {
    expect(safeUrl('javascript:alert(1)')).toBe('')
    expect(safeUrl('data:text/html,hi')).toBe('')
    expect(safeUrl('/relative')).toBe('')
    expect(safeUrl('localhost')).toBe('')
    expect(safeUrl('shop.id/promo')).toBe('https://shop.id/promo')
  })

  test('handles become profile URLs', () => {
    expect(socialHref('instagram', '@kaoskeren')).toBe('https://instagram.com/kaoskeren')
    expect(socialHref('tiktok', 'kaoskeren')).toBe('https://www.tiktok.com/@kaoskeren')
    expect(socialHref('website', 'kaoskeren.id')).toBe('https://kaoskeren.id/')
    expect(socialHref('facebook', 'javascript:x')).toBeNull()
  })

  test('Indonesian numbers reach wa.me in international form', () => {
    expect(whatsappHref('0812-3456-7890')).toBe('https://wa.me/6281234567890')
    expect(whatsappHref('+62 812 3456 7890', 'Halo kak')).toBe(
      'https://wa.me/6281234567890?text=Halo%20kak',
    )
    expect(whatsappHref('123')).toBeNull()
  })

  test('YouTube ids from every URL shape', () => {
    expect(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(youtubeId('youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(youtubeId('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(youtubeId('https://vimeo.com/123')).toBeNull()
  })
})

describe('qcPalette', () => {
  test('every preset draws readable text on its page and its cards', () => {
    for (const preset of QC_THEME_PRESETS) {
      const style = { ...preset.style, theme: preset.id }
      const palette = qcPalette(style)
      const stops =
        style.background.kind === 'gradient'
          ? [style.background.color, style.background.gradientTo]
          : [style.background.color]
      for (const stop of stops)
        expect(contrastRatio(palette.pageText, stop)).toBeGreaterThanOrEqual(4.5)
      if (style.cardStyle !== 'outline' && style.cardStyle !== 'glass') {
        expect(contrastRatio(palette.cardText, style.surface)).toBeGreaterThanOrEqual(4.5)
      }
      expect(contrastRatio(palette.accentText, style.accent)).toBeGreaterThanOrEqual(3)
    }
  })

  test('an unreadable choice is repaired and says so', () => {
    const page = sanitizeQuickCheckoutContent({
      style: { theme: 'clean', text: '#f5f5f5', background: { kind: 'solid', color: '#ffffff' } },
    })
    const palette = qcPalette(page.style)
    expect(palette.repaired).toBe(true)
    expect(contrastRatio(palette.pageText, '#ffffff')).toBeGreaterThanOrEqual(4.5)
  })
})

describe('QuickCheckoutPage', () => {
  const product: QcProductView = {
    id: 'p1',
    slug: 'kaos-hitam',
    name: 'Kaos Hitam',
    imageUrl: null,
    price: 99000,
    compareAtPrice: 129000,
    soldOut: false,
    hasVariants: true,
  }

  function render(content: QuickCheckoutContent, mode: 'live' | 'preview' = 'live') {
    return renderToString(
      <ChakraProvider value={system}>
        <QuickCheckoutPage
          content={content}
          products={{ p1: product }}
          autoProducts={[product]}
          imageUrl={(id) => (id ? `https://cdn.test/${id}` : null)}
          formatPrice={(amount) => `Rp${amount}`}
          locale="id"
          fallbackName="Toko"
          mode={mode}
        />
      </ChakraProvider>,
    )
  }

  test('draws every layout with the profile, products and contact', () => {
    for (const layout of ['list', 'grid', 'hero', 'minimal'] as const) {
      const page = starterQuickCheckout(SHOP, 'clean', 'id')
      page.style.layout = layout
      const html = render(page)
      expect(html).toContain('Kaos Keren')
      expect(html).toContain('Kaos Hitam')
      expect(html).toContain('Rp99000')
      expect(html).toContain('https://wa.me/6281234567890')
      // A product with variants asks the shopper to choose first.
      expect(html).toContain('Pilih')
    }
  })

  test('hidden blocks are not drawn and the preview never links out', () => {
    const page = starterQuickCheckout(SHOP, 'clean', 'id')
    const contact = page.blocks.find((block) => block.type === 'contact')!
    contact.visible = false
    const html = render(page, 'preview')
    expect(html).not.toContain('Chat WhatsApp')
    expect(html).not.toContain('href="https://instagram.com/kaoskeren"')
  })
})

describe('qcPalette low contrast', () => {
  test('a gradient no text colour can serve is flagged', () => {
    const page = sanitizeQuickCheckoutContent({
      style: {
        theme: 'clean',
        background: { kind: 'gradient', color: '#ffffff', gradientTo: '#000000', angle: 180 },
      },
    })
    expect(qcPalette(page.style).lowContrast).toBe(true)
    expect(qcPalette({ ...findQcTheme('ocean').style, theme: 'ocean' }).lowContrast).toBe(false)
  })
})
