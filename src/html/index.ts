/**
 * `@repo/page-builder/html` — themes and pages as plain HTML, for any server.
 *
 * Server-only. `renderPageHtml` and `renderPageDocument` draw a whole page;
 * `renderSectionHtml` draws one section as a fragment to swap into a page
 * already on screen (an htmx editor's response to a field change). The
 * browser needs no framework: serve `PAGE_RUNTIME_PATH` (built by
 * `bun run build`) as a script and the sliders, menus, popups and countdowns
 * work. Bundling it yourself? Import `@repo/page-builder/html/runtime`.
 *
 * See docs/PAGE-BUILDER.md ("Plain HTML").
 */

import { fileURLToPath } from 'node:url'

export {
  renderPageDocument,
  renderPageHtml,
  renderSectionHtml,
  type HtmlChrome,
  type HtmlDocumentInput,
  type HtmlPage,
  type HtmlRenderInput,
  type HtmlTemplate,
} from './render'

/**
 * The built browser runtime on disk, for a server to send as
 * `text/javascript`. Exists once the package has been built.
 */
export const PAGE_RUNTIME_PATH = fileURLToPath(
  new URL('../../dist/page-runtime.js', import.meta.url),
)
