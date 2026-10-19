/**
 * A throwaway probe: measures the drop geometry against a real page in
 * headless Chrome, so the band's gaps can be read as numbers instead of
 * guessed from screenshots. Run: `bun scripts/drop-probe.ts` from `packages/page-builder`.
 */

import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import puppeteer from 'puppeteer'

import {
  CONTENT_VERSION,
  createSection,
  DEFAULT_THEME_SETTINGS,
  sanitizeLayout,
  type ThemeContent,
} from '../src/index'
import { sampleStorefrontData } from '../src/render/index'
import { renderTemplateSnapshotHtml } from '../src/snapshot/index'

const IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#dfe6ee"/></svg>',
  )

function content(): ThemeContent {
  return {
    version: CONTENT_VERSION,
    settings: DEFAULT_THEME_SETTINGS,
    layout: sanitizeLayout(null),
    templates: {
      home: [
        createSection('banner-slider', {
          perPage: '1',
          ratio: '16/9',
          slides: [{ image: 'slide-1' }, { image: 'slide-2' }, { image: 'slide-3' }],
        }),
        createSection('shop-intro', {
          showDescription: true,
          background: 'image',
          backgroundImage: 'hero',
          heading: 'Demo Batik',
          body: 'Batik cap dan tulis langsung dari perajin Solo dan Yogyakarta. Kemeja, blus, sampai kain lembaran — dibuat dengan pewarna alami dan jahitan rapi.',
        }),
        createSection('product-list', { source: 'collection', limit: 8, columns: '4' }),
        createSection('rich-text', {
          heading: 'What our customers say',
          body: 'Every piece is cut and sewn in small batches, so the fit and the finish stay true.',
        }),
      ],
      product: [],
      article: [],
      catalog: [],
      orderTracking: [],
    },
    recommendedLooks: [],
  }
}

const html = renderTemplateSnapshotHtml({
  content: content(),
  data: sampleStorefrontData('Demo Batik'),
  imageUrl: () => IMAGE,
  formatPrice: (amount, currency) => `${amount} ${currency}`,
})

const dir = mkdtempSync(join(tmpdir(), 'drop-probe-'))
const page = join(dir, 'page.html')
writeFileSync(page, html)
console.log(`page: ${page} (${Math.round(html.length / 1024)} kB)`)

const bundle = join(dir, 'geometry.js')
const built = Bun.spawnSync([
  'bun',
  'build',
  join(import.meta.dir, 'drop-probe-entry.ts'),
  '--target=browser',
  '--format=iife',
  `--outfile=${bundle}`,
])
if (built.exitCode !== 0) {
  console.error(built.stderr.toString())
  process.exit(1)
}

const browser = await puppeteer.launch({ headless: true })
const tab = await browser.newPage()
await tab.setViewport({ width: 1280, height: 900 })
await tab.setContent(html, { waitUntil: 'load' })
await tab.addScriptTag({ path: bundle })

/** The geometry surface the page hands back, as the probe uses it. */
interface Geometry {
  sectionBounds(
    doc: Document,
    ids: readonly string[],
  ): Array<{
    id: string
    top: number
    bottom: number
    contentTop: number
    contentBottom: number
  }>
  chromeBounds(doc: Document): { headerBottom: number | null; footerTop: number | null }
  gapMotion(at: number, count: number): { up: number; down: number }
  gapInsets(
    before: { contentBottom: number } | null,
    after: { contentTop: number } | null,
    chrome: { headerBottom: number | null; footerTop: number | null },
    boundary: number,
  ): { above: number; below: number }
  gapBand(above: number, below: number, up: number, down: number): { top: number; height: number }
}

const report = await tab.evaluate(() => {
  const geometry = (globalThis as unknown as { DropGeometry: Geometry }).DropGeometry
  // The live page carries the anchor ids; the editor's frames carry
  // `data-section-id` on the same wrapper. Tag them so both agree.
  const wrappers = Array.from(document.querySelectorAll<HTMLElement>('[id^="section-"]'))
  for (const wrapper of wrappers) {
    wrapper.dataset.sectionId = wrapper.id.replace(/^section-/, '')
  }
  const ids = wrappers.map((element) => element.dataset.sectionId!)
  const bounds = geometry.sectionBounds(document, ids)
  const chrome = geometry.chromeBounds(document)
  if (bounds.length === 0) throw new Error('no sections found in the probe page')

  /** The ink boxes the measurement found, for eyeballing. */
  const ink = (id: string) => {
    const root = document.querySelector(`[data-section-id="${id}"]`)!
    const found: Array<{ tag: string; top: number; bottom: number; text: string }> = []
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ALL)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (!node.textContent?.trim()) continue
        const range = document.createRange()
        range.selectNodeContents(node)
        const box = range.getBoundingClientRect()
        if (box.height === 0) continue
        found.push({
          tag: 'text',
          top: box.top,
          bottom: box.bottom,
          text: node.textContent!.trim().slice(0, 24),
        })
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element
        const tag = el.tagName.toLowerCase()
        if (!['img', 'button', 'input', 'svg', 'hr'].includes(tag)) continue
        const box = el.getBoundingClientRect()
        found.push({ tag, top: box.top, bottom: box.bottom, text: '' })
      }
    }
    return found
      .filter((item) => item.tag !== 'text' || item.top > 0)
      .sort((a, b) => a.bottom - b.bottom)
      .slice(-6)
  }

  const rows = [] as unknown[]
  const structure = (id: string) => {
    const wrapper = document.querySelector(`[data-section-id="${id}"]`)!
    const rows: Array<{ cls: string; top: number; bottom: number; height: number }> = []
    const walk = (element: Element, depth: number) => {
      const box = element.getBoundingClientRect()
      rows.push({
        cls: `${'  '.repeat(depth)}${element.tagName.toLowerCase()}.${element.className.toString().split(' ').pop()}`,
        top: Math.round(box.top),
        bottom: Math.round(box.bottom),
        height: Math.round(box.height),
      })
      if (depth >= 3) return
      for (const child of Array.from(element.children)) walk(child, depth + 1)
    }
    walk(wrapper, 0)
    return rows
  }
  for (let at = 0; at <= bounds.length; at++) {
    const before = at > 0 ? bounds[at - 1]! : null
    const after = at < bounds.length ? bounds[at]! : null
    const boundary = before ? before.bottom : after!.top
    const motion = geometry.gapMotion(at, bounds.length)
    const { above, below } = geometry.gapInsets(before, after, chrome, boundary)
    const band = geometry.gapBand(above, below, motion.up, motion.down)
    const top = boundary + band.top
    // The eye's references: the sections above move up, below move down.
    const ceiling = before ? before.contentBottom - motion.up : chrome.headerBottom
    const floor = after ? after.contentTop + motion.down : chrome.footerTop
    rows.push({
      at,
      boundary: Math.round(boundary),
      above: Math.round(above),
      below: Math.round(below),
      band: [Math.round(top), Math.round(top + band.height)],
      gapAbove: ceiling === null ? null : Math.round(top - ceiling),
      gapBelow: floor === null ? null : Math.round(floor - (top + band.height)),
    })
  }
  return {
    chrome,
    bounds,
    rows,
    ink: ids.map((id) => ({ id, boxes: ink(id) })),
    structure: structure(ids[0]!),
  }
})

console.log('\nchrome:', report.chrome)
console.log('\nsections:')
for (const bound of report.bounds) {
  console.log(
    `  ${bound.id}  box ${Math.round(bound.top)}..${Math.round(bound.bottom)}  content ${Math.round(bound.contentTop)}..${Math.round(bound.contentBottom)}`,
  )
}
console.log('\nlast ink boxes per section:')
for (const entry of report.ink) {
  console.log(
    `  ${entry.id}:`,
    entry.boxes
      .map((box) => `${box.tag}@${Math.round(box.top)}-${Math.round(box.bottom)}`)
      .join(' '),
  )
}
console.log('\nboundaries:')
for (const row of report.rows) console.log(' ', row)
console.log('\nfirst section structure:')
for (const row of report.structure)
  console.log(`  ${row.cls}  ${row.top}..${row.bottom} (h ${row.height})`)

await browser.close()
