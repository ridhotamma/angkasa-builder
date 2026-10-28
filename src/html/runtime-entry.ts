/**
 * The runtime as one browser script (`dist/page-runtime.js`): it starts itself
 * on the page that loads it, and leaves its API on `window.PageBuilderRuntime`
 * for a host that wants to open a dialog itself or mount markup the observer
 * cannot see.
 */

import { closeDialog, mountPageRuntime, openDialog, startPageRuntime } from './runtime'

const api = { start: startPageRuntime, mount: mountPageRuntime, openDialog, closeDialog }
;(globalThis as { PageBuilderRuntime?: typeof api }).PageBuilderRuntime = api

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => startPageRuntime(), { once: true })
} else {
  startPageRuntime()
}
