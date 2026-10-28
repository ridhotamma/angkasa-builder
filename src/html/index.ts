/**
 * `angkasa-builder/html` — themes and pages as plain HTML, for any server.
 *
 * Server-only. `renderPageHtml` and `renderPageDocument` draw a whole page;
 * `renderSectionHtml` draws one section as a fragment to swap into a page
 * already on screen (an htmx editor's response to a field change). The
 * browser needs no framework: serve `PAGE_RUNTIME_PATH` (built by
 * `bun run build`; `angkasa-builder/page-runtime.js`) as a script and the sliders, menus, popups and countdowns
 * work. Bundling it yourself? Import `angkasa-builder/html/runtime`.
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
 * `text/javascript`. Resolved through the package's own exports, so it is the
 * same file from the source and from the build. Exists once the package has
 * been built (`bun run build`).
 */
export const PAGE_RUNTIME_PATH = fileURLToPath(
  import.meta.resolve('angkasa-builder/page-runtime.js'),
)
