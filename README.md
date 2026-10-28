# angkasa-builder

A page builder whose pages, sections and editor logic are plain data. Render a page to HTML on any
server, make it interactive with a small framework-free script, and build the editor in htmx,
vanilla JS or React.

- **No framework in the browser.** The storefront is HTML plus one 6 kB (gzipped) script for sliders,
  menus, tabs, dialogs, popups and countdowns.
- **Any server.** `renderPageHtml` and `renderSectionHtml` return strings. React and Chakra draw
  the sections on the server, but callers never touch them.
- **Editor logic without UI.** Every edit is a JSON command applied by a pure function, so the
  same rules run behind an htmx form, a vanilla-JS widget or the bundled React editor.

## Install

```bash
bun add angkasa-builder    # or npm / pnpm / yarn
```

`react`, `react-dom`, `@chakra-ui/react` and `@emotion/react` are peer dependencies that the
server-side renderer uses. npm, pnpm and Bun install them for you. The browser never loads them
unless you use the React editor.

## Entry points

| Import                            | What it is                                                           | Runs on  |
| --------------------------------- | -------------------------------------------------------------------- | -------- |
| `angkasa-builder`                 | The model: sections, blocks, themes, sanitisers. Pure TypeScript.    | anywhere |
| `angkasa-builder/editor-core`     | The editor's logic: commands, selection, panel, forms, undo.         | anywhere |
| `angkasa-builder/html`            | Pages and single sections as HTML strings, plus `PAGE_RUNTIME_PATH`. | server   |
| `angkasa-builder/page-runtime.js` | The browser runtime as one file to serve as-is.                      | browser  |
| `angkasa-builder/html/runtime`    | The same runtime as a module, for your own bundle.                   | browser  |
| `angkasa-builder/render`          | The React/Chakra section renderers, for a React storefront.          | React    |
| `angkasa-builder/editor`          | The full React editor (`PageBuilder`).                               | React    |
| `angkasa-builder/snapshot`        | A template's page as a PNG, rendered locally or by a remote service. | server   |

## Rendering a page (any server)

```ts
import { renderPageDocument, PAGE_RUNTIME_PATH } from 'angkasa-builder/html'

const html = renderPageDocument({
  content, // a ThemeContent: settings, layout, templates
  data, // the shop's products, categories, …
  imageUrl: (fileId, size) => `/media/${fileId}?w=${size.width}`,
  formatPrice: (amount, currency) => `${currency} ${amount}`,
  locale: 'en',
  runtimeSrc: '/page-runtime.js', // serve PAGE_RUNTIME_PATH at this URL
})
```

The runtime wires itself up when it loads, and it also picks up HTML inserted later (htmx swaps,
Turbo, `innerHTML`). You don't need to call anything after a swap.

## An htmx editor

`editor-core` keeps the page in one JSON value (`EditorState`) and turns each request into a
command. `renderSectionHtml` sends back the one section that changed:

```ts
import { dispatchCommand, formCommand, panelForms } from 'angkasa-builder/editor-core'
import { renderSectionHtml } from 'angkasa-builder/html'

// The panel's forms, described as data, for your templates to draw.
const forms = panelForms(state.sections.present, state.selection, { locale: 'en' })

// A form POST becomes a command; the edited section goes back as a fragment.
const command = formCommand(state.sections.present, state.selection, formId, await req.formData(), {
  locale: 'en',
})
state = dispatchCommand(state, command, { locale: 'en' }).state
return renderSectionHtml({ ...renderInput, section, sections: state.sections.present })
```

```html
<form
  hx-post="/form/section-content"
  hx-trigger="input changed delay:300ms"
  hx-target="#section-abc"
  hx-swap="outerHTML"
>
  …
</form>
```

Pass the page's `sections` to `renderSectionHtml`. The space above a section depends on the one
before it, and with the full list the fragment is spaced exactly as the full page draws it.

`examples/htmx/server.ts` is a working editor in about 300 lines: a section list, settings forms,
add, move, copy, remove, undo and redo, and click-to-select in the preview. Run it with:

```bash
bun run example:htmx    # http://localhost:4600
```

## Vanilla JS (or any framework)

`createEditorStore` holds the same state in the browser. Subscribe to it with whatever draws your
UI:

```ts
import { createEditorStore, panelForms } from 'angkasa-builder/editor-core'

const store = createEditorStore(sections, { locale: 'en' })
store.subscribe((state) => {
  draw(panelForms(state.sections.present, state.selection, { locale: 'en' }))
  // Ask your server for fresh preview HTML, or render it there.
})
store.dispatch({ type: 'select', sectionId })
store.dispatch({ type: 'move-section', id: sectionId, by: 1 })
store.undo()
```

Commands are plain JSON, so a Vue, Svelte or Alpine component can send them to a server or apply
them in place. The browser runtime's module (`angkasa-builder/html/runtime`) exports
`startPageRuntime`, `mountPageRuntime`, `openDialog` and `closeDialog` for hosts that bundle it.

Undo merges typing-style edits made within 600 ms of each other into one step. A move, copy,
removal or add is always a step of its own.

### Form conventions

`describeFields` and `panelForms` name each input by its field key, and list item fields by
`list.index.key` (`items.0.title`). `readFormInput` and `formCommand` read them back and sanitise
them the same way a saved layout is sanitised:

- Fields the form didn't post keep their values.
- Structured values (links, videos, tables, points, map pins) are posted as JSON.
- A checkbox reads its last value, so put a hidden `false` input of the same name before it.

## React

```tsx
import { PageBuilder, useUndoableState } from 'angkasa-builder/editor'
import { LocaleProvider, system } from 'angkasa-builder/render'
```

The React editor runs on `editor-core` too. Wrap it (and the renderers) in Chakra's
`ChakraProvider value={system}` and in a `LocaleProvider`. Without a `LocaleProvider` the
language is English.

## Develop

```bash
bun install
bun run typecheck
bun run test       # the main suite, then the React editor's test in its own process
bun run build      # dist/: ESM + type declarations, and dist/html/page-runtime.js
```
