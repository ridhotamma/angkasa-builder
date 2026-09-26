// Throwaway lab: renders the editor with the Studio preset and sample data.
import { createRoot } from 'react-dom/client'
import { useState } from 'react'

import { I18nProvider } from '@repo/i18n'
import { UIProvider } from '@repo/theme'

import { findPreset, type TemplateKey, type ThemeContent } from '../src'
import { PageBuilder, useUndoableState, type EditorServices } from '../src/editor'
import { sampleStorefrontData } from '../src/render'

const COLORS = ['#e7c9a9', '#9fb8ad', '#c9b6e4', '#f2a488', '#a8c5e8', '#e9d77f', '#b5c99a', '#d4a5a5']

function swatch(id: string, w = 800, h = 800) {
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  const a = COLORS[hash % COLORS.length]!
  const b = COLORS[(hash >> 3) % COLORS.length]!
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="${w * 0.7}" cy="${h * 0.35}" r="${Math.min(w, h) * 0.18}" fill="white" fill-opacity="0.35"/></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const data = sampleStorefrontData('Kanaya Studio')
for (const [i, product] of data.latest.entries()) {
  product.imageUrl = swatch(product.id + i)
  product.imageUrls = [swatch(product.id + 'a'), swatch(product.id + 'b'), swatch(product.id + 'c')]
  product.description = 'Soft cotton, relaxed fit. Made in Bandung.'
}
for (const shelf of data.collections) for (const p of shelf.products) p.imageUrl = swatch(p.id)
for (const c of data.categories) c.imageUrl = swatch(c.id, 400, 400)

const services: EditorServices = {
  uploadImage: async (file) => `lab-${file.name.replace(/\W/g, '')}`.slice(0, 40),
  imageUrl: (id, size) => swatch(id, size.width, size.height),
  collections: data.collections.map((c) => ({ id: c.id, slug: c.slug, name: c.name })),
  categories: data.categories.map((c) => ({ id: c.id, slug: c.slug, name: c.name })),
  pages: [],
}

const studio = findPreset('studio')!.content()
// Fill the lookbook and reels with sample picks, as a seller would.
for (const section of studio.templates.home) {
  if (section.type === 'lookbook') {
    section.settings.image = 'lab-look'
    section.settings.hotspots = [
      { id: 'h1', productId: data.latest[0]!.id, position: { x: 30, y: 40 }, label: 'Tee' },
      { id: 'h2', productId: data.latest[1]!.id, position: { x: 65, y: 70 }, label: 'Bag' },
    ]
  }
  if (section.type === 'video-hero') section.settings.poster = 'lab-hero'
  if (section.type === 'scrolling-story') {
    const steps = section.settings.steps as Array<Record<string, unknown>>
    steps.forEach((step, i) => (step.image = `lab-story-${i}`))
  }
  if (section.type === 'video-reels') {
    section.settings.items = [0, 1, 2, 3, 4, 5].map((i) => ({
      id: `r${i}`,
      poster: `lab-reel-${i}`,
      caption: ['Weekend fit', 'Studio day', 'Linen summer'][i % 3],
      productId: data.latest[i]!.id,
      video: null,
    }))
  }
}

const menus = {
  main: [
    { id: 'm1', label: 'New in', link: { kind: 'home' as const }, children: [] },
    {
      id: 'm2',
      label: 'Women',
      link: { kind: 'home' as const },
      children: [
        { id: 'm21', label: 'Tops', link: { kind: 'home' as const }, children: [
          { id: 'm211', label: 'T-shirts', link: { kind: 'home' as const }, children: [] },
          { id: 'm212', label: 'Shirts', link: { kind: 'home' as const }, children: [] },
        ] },
        { id: 'm22', label: 'Bottoms', link: { kind: 'home' as const }, children: [
          { id: 'm221', label: 'Trousers', link: { kind: 'home' as const }, children: [] },
        ] },
      ],
    },
    { id: 'm3', label: 'Sale', link: { kind: 'home' as const }, children: [] },
  ],
  footer: [
    { id: 'f1', label: 'Help', link: { kind: 'none' as const }, children: [
      { id: 'f11', label: 'Shipping', link: { kind: 'home' as const }, children: [] },
      { id: 'f12', label: 'Returns', link: { kind: 'home' as const }, children: [] },
    ] },
  ],
}

function Lab() {
  const { value: draft, set, history } = useUndoableState<ThemeContent>(studio)
  const [template, setTemplate] = useState<TemplateKey>('home')
  ;(window as unknown as { __draft: ThemeContent }).__draft = draft
  return (
    <div style={{ padding: 16, height: '100vh', boxSizing: 'border-box' }}>
      <PageBuilder
        height="calc(100vh - 32px)"
        scope={template}
        template={{ value: template, onChange: setTemplate }}
        sections={draft.templates[template]}
        onSectionsChange={(sections) => set({ ...draft, templates: { ...draft.templates, [template]: sections } })}
        settings={draft.settings}
        onSettingsChange={(settings) => set({ ...draft, settings })}
        layout={draft.layout}
        onLayoutChange={(layout) => set({ ...draft, layout })}
        menus={menus}
        history={history}
        data={data}
        services={services}
        formatPrice={(amount) => `Rp ${amount.toLocaleString('id-ID')}`}
      />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <I18nProvider locale="en" resources={{}}>
    <UIProvider>
      <Lab />
    </UIProvider>
  </I18nProvider>,
)
