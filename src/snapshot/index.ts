/**
 * `@repo/page-builder/snapshot` — a template's home page as a stored PNG.
 *
 * Server-only. `renderTemplateSnapshotHtml` draws the page to a standalone
 * document (same component the dashboard's live preview draws);
 * `screenshotHtml` captures its above-the-fold viewport with headless Chrome.
 * The apps call both on a template write and store the bytes as the row's
 * `previewFileId`, so the library shows a picture instead of rendering every
 * template live. See docs/PAGE-BUILDER.md ("Template snapshots").
 */

export { renderTemplateSnapshotHtml, type SnapshotHtmlInput } from './render-html'
export { screenshotHtml, SNAPSHOT_VIEWPORT } from './screenshot'
