/**
 * A page editor in htmx, on the package's two framework-free halves:
 *
 * - `angkasa-builder/editor-core` keeps the page (sections, selection, undo)
 *   as one JSON value and turns each request into a command;
 * - `angkasa-builder/html` draws the preview — a whole page, or one section
 *   to swap in after a field changes — and the browser runtime
 *   (`angkasa-builder/page-runtime.js`) makes it interactive.
 *
 * The browser runs htmx and that runtime, nothing else. Run it with
 * `bun run example:htmx` and open http://localhost:4600.
 *
 * One editing session in memory, to keep the example short: a real server
 * keeps `EditorState` per user (it is plain JSON) and saves
 * `state.sections.present` wherever pages live.
 */

import {
  CONTENT_VERSION,
  createSection,
  DEFAULT_THEME_SETTINGS,
  isSectionOffered,
  richDocText,
  sanitizeLayout,
  SECTION_SCHEMAS,
  sectionDisplayName,
  sectionSchema,
  type RichDoc,
  type SectionInstance,
  type ThemeContent,
} from 'angkasa-builder'
import {
  createEditorState,
  dispatchCommand,
  formCommand,
  inspectSelection,
  panelForms,
  redoEditor,
  undoEditor,
  type EditorCommand,
  type EditorState,
  type FormField,
  type PanelFormId,
} from 'angkasa-builder/editor-core'
import { PAGE_RUNTIME_PATH, renderPageHtml, renderSectionHtml } from 'angkasa-builder/html'
import { sampleStorefrontData } from 'angkasa-builder/render'

const PORT = Number(process.env.PORT ?? 4600)
const LOCALE = 'en' as const

/* -------------------------------------------------------------------------- */
/* The page being edited                                                      */
/* -------------------------------------------------------------------------- */

const data = sampleStorefrontData('Angkasa demo shop')

let state: EditorState = createEditorState([
  createSection('banner', {
    heading: 'Build pages with htmx',
    subheading: 'Every edit is a command on the server.',
  }),
  createSection('rich-text', {
    heading: 'Plain HTML out',
    body: 'The browser gets markup and one small script.',
  }),
  createSection('faq', {
    heading: 'Questions',
    items: [
      {
        question: 'Does the browser need React?',
        answer: 'No. The server renders HTML; the runtime is plain JavaScript.',
      },
      {
        question: 'Can I use another framework?',
        answer: 'Yes. The editor core is plain functions over JSON.',
      },
    ],
  }),
])

function content(sections: SectionInstance[]): ThemeContent {
  return {
    version: CONTENT_VERSION,
    settings: DEFAULT_THEME_SETTINGS,
    layout: sanitizeLayout(null),
    templates: { home: sections, product: [], article: [], catalog: [], orderTracking: [] },
    recommendedLooks: [],
  }
}

const renderBase = {
  data,
  imageUrl: (fileId: string) => (fileId.startsWith('http') ? fileId : null),
  formatPrice: (amount: number, currency: string) => `${currency} ${amount.toLocaleString('en')}`,
  locale: LOCALE,
  // Empty sections explain themselves, as in an editor.
  mode: 'preview' as const,
}

function apply(command: EditorCommand) {
  state = dispatchCommand(state, command, { locale: LOCALE }).state
}

/* -------------------------------------------------------------------------- */
/* HTML helpers                                                               */
/* -------------------------------------------------------------------------- */

const esc = (value: unknown) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

/** A button that posts one editor command. */
function commandButton(label: string, command: EditorCommand, attrs = '') {
  const vals = esc(JSON.stringify({ command: JSON.stringify(command) }))
  return `<button type="button" hx-post="/command" hx-vals="${vals}" hx-target="#panel" ${attrs}>${esc(label)}</button>`
}

/* -------------------------------------------------------------------------- */
/* The panel                                                                  */
/* -------------------------------------------------------------------------- */

/** One form field as an input, named the way `formCommand` reads it back. */
function fieldInput(field: FormField): string {
  if (!field.shown) return ''
  const label = `<span class="label">${esc(field.label)}</span>`
  switch (field.kind) {
    case 'text':
      return `<label>${label}<input name="${field.name}" value="${esc(field.value)}" maxlength="${field.max}"></label>`
    case 'textarea':
      return `<label>${label}<textarea name="${field.name}" rows="${field.rows ?? 3}">${esc(field.value)}</textarea></label>`
    case 'richtext': {
      const text =
        typeof field.value === 'string'
          ? field.value
          : richDocText(field.value as unknown as RichDoc)
      return `<label>${label}<textarea name="${field.name}" rows="4">${esc(text)}</textarea></label>`
    }
    case 'number':
      return `<label>${label}<input type="number" name="${field.name}" value="${field.value}" min="${field.min}" max="${field.max}" step="${field.step ?? 1}"></label>`
    case 'select':
      return `<label>${label}<select name="${field.name}">${field.options
        .map(
          (option) =>
            `<option value="${esc(option.value)}"${option.value === field.value ? ' selected' : ''}>${esc(option.label)}</option>`,
        )
        .join('')}</select></label>`
    case 'boolean':
      // The hidden "false" posts the switch's off; a checked box's "true" comes after and wins.
      return `<label class="row"><input type="hidden" name="${field.name}" value="false"><input type="checkbox" name="${field.name}" value="true"${field.value ? ' checked' : ''}>${esc(field.label)}</label>`
    case 'color':
      return `<label>${label}<input type="color" name="${field.name}" value="${esc(field.value || '#000000')}"></label>`
    case 'list':
      return `<fieldset><legend>${esc(field.label)}</legend>${field.items
        .map(
          (item, index) =>
            `<div class="item"><div class="item-title">${esc(field.itemLabel)} ${index + 1}</div>${item.fields.map(fieldInput).join('')}</div>`,
        )
        .join('')}</fieldset>`
    default:
      // Images, links, videos, tables… post as JSON; the full editor has pickers for them.
      return ''
  }
}

function panelHtml(): string {
  const sections = state.sections.present
  const inspection = inspectSelection(sections, state.selection, { locale: LOCALE })
  const history = `<div class="toolbar">
    <button type="button" hx-post="/undo" hx-target="#panel"${state.sections.past.length ? '' : ' disabled'}>Undo</button>
    <button type="button" hx-post="/redo" hx-target="#panel"${state.sections.future.length ? '' : ' disabled'}>Redo</button>
  </div>`

  if (inspection.panel.view === 'list') {
    const rows = sections
      .map((section, index) => {
        const schema = sectionSchema(section.type)
        const name = schema ? sectionDisplayName(section, sections, schema.name.en) : section.type
        return `<li>
          ${commandButton(name, { type: 'select', sectionId: section.id }, 'class="name"')}
          ${commandButton('↑', { type: 'move-section', id: section.id, by: -1 }, index === 0 ? 'disabled' : '')}
          ${commandButton('↓', { type: 'move-section', id: section.id, by: 1 }, index === sections.length - 1 ? 'disabled' : '')}
          ${commandButton('Copy', { type: 'duplicate-section', id: section.id })}
          ${commandButton('Remove', { type: 'remove-section', id: section.id })}
        </li>`
      })
      .join('')
    const options = SECTION_SCHEMAS.filter((schema) => isSectionOffered(schema, 'home'))
      .map((schema) => `<option value="${schema.type}">${esc(schema.name.en)}</option>`)
      .join('')
    return `${history}<h2>Sections</h2><ul class="sections">${rows}</ul>
      <form hx-post="/add" hx-target="#panel" class="add">
        <select name="sectionType">${options}</select><button>Add section</button>
      </form>`
  }

  const crumbs = inspection.crumbs
    .map((crumb) =>
      commandButton(
        crumb.kind === 'list' ? '← All sections' : crumb.label,
        crumb.command,
        'class="crumb"',
      ),
    )
    .join(' / ')
  const target = inspection.selected ? `#section-${inspection.selected.id}` : '#preview'
  const forms = panelForms(sections, state.selection, { locale: LOCALE })
    .map((form) => {
      const fields = form.groups
        ? form.groups
            .map(
              (group) =>
                `<details><summary>${esc(group.label)}</summary>${group.fields.map(fieldInput).join('')}</details>`,
            )
            .join('')
        : form.fields.map(fieldInput).join('')
      // Every keystroke (debounced) posts the form; the reply is the section, swapped in place.
      return `<form class="fields" hx-post="/form/${form.id}" hx-trigger="input changed delay:300ms, change"
        hx-target="${target}" hx-swap="outerHTML"><h3>${esc(form.id.replace('section-', '').replace('-', ' '))}</h3>${fields}</form>`
    })
    .join('')
  return `${history}<nav class="crumbs">${crumbs}</nav><h2>${esc(inspection.sectionName)}</h2>${forms}`
}

/* -------------------------------------------------------------------------- */
/* The preview                                                                */
/* -------------------------------------------------------------------------- */

function previewHtml(): string {
  const page = renderPageHtml({
    ...renderBase,
    content: content(state.sections.present),
    chrome: false,
  })
  // The page's styles travel with it, so a full swap keeps every rule its markup uses.
  return `<div id="preview">${page.head}${page.body}</div>`
}

/** The panel, with the preview swapped alongside it (htmx out-of-band). */
function panelResponse(): Response {
  const preview = previewHtml().replace(
    '<div id="preview">',
    '<div id="preview" hx-swap-oob="true">',
  )
  return html(panelHtml() + preview)
}

function html(body: string): Response {
  return new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}

function documentHtml(): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>angkasa-builder · htmx</title>
<script src="https://unpkg.com/htmx.org@2.0.4/dist/htmx.min.js"></script>
<style>
  /* Unlayered, so it wins over the preview's layered reset. */
  body { margin: 0; font: 14px/1.4 system-ui, sans-serif; }
  .editor { display: grid; grid-template-columns: 340px 1fr; height: 100vh; }
  #panel { overflow: auto; padding: 16px; border-right: 1px solid #ddd; background: #fafafa; color: #111; }
  #panel h2 { font-size: 16px; font-weight: 600; margin: 12px 0 8px; }
  #panel h3 { font-size: 12px; text-transform: uppercase; color: #666; margin: 16px 0 6px; }
  #panel label { display: block; margin: 6px 0; }
  #panel .label { display: block; font-size: 12px; color: #555; margin-bottom: 2px; }
  #panel input:not([type=checkbox]), #panel textarea, #panel select { width: 100%; box-sizing: border-box; padding: 4px 6px; border: 1px solid #ccc; border-radius: 4px; background: #fff; }
  #panel button { padding: 3px 8px; border: 1px solid #ccc; border-radius: 4px; background: #fff; cursor: pointer; }
  #panel button:disabled { opacity: .4; cursor: default; }
  #panel .sections { list-style: none; padding: 0; margin: 0; }
  #panel .sections li { display: flex; gap: 4px; margin-bottom: 4px; }
  #panel .sections .name { flex: 1; text-align: left; }
  #panel .crumb { border: 0; background: none; color: #0a58ca; padding: 0; }
  #panel .row { display: flex; gap: 6px; align-items: center; }
  #panel fieldset { border: 1px solid #ddd; border-radius: 4px; margin: 8px 0; }
  #panel .item { border-top: 1px dashed #ddd; padding-top: 4px; }
  #panel .item-title { font-size: 12px; color: #888; }
  #panel .toolbar, #panel .add { display: flex; gap: 6px; }
  #preview-scroll { overflow: auto; }
  #preview [id^=section-] { cursor: pointer; }
</style></head><body>
<div class="editor">
  <aside id="panel">${panelHtml()}</aside>
  <main id="preview-scroll">${previewHtml()}</main>
</div>
<script src="/page-runtime.js" defer></script>
<script>
  // A click on a section in the preview picks it, as in the React editor.
  document.addEventListener('click', (event) => {
    const section = event.target.closest('#preview [id^="section-"]')
    if (!section || event.target.closest('a, button, input, summary')) return
    const sectionId = section.id.slice('section-'.length)
    htmx.ajax('POST', '/command', {
      target: '#panel',
      values: { command: JSON.stringify({ type: 'select', sectionId, fromPreview: true }) },
    })
  })
</script>
</body></html>`
}

/* -------------------------------------------------------------------------- */
/* Routes                                                                     */
/* -------------------------------------------------------------------------- */

Bun.serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url)
    const route = `${request.method} ${url.pathname}`

    if (route === 'GET /') return html(documentHtml())
    if (route === 'GET /page-runtime.js') {
      return new Response(Bun.file(PAGE_RUNTIME_PATH), {
        headers: { 'content-type': 'text/javascript' },
      })
    }

    if (route === 'POST /command') {
      const form = await request.formData()
      apply(JSON.parse(String(form.get('command'))) as EditorCommand)
      return panelResponse()
    }

    if (route === 'POST /add') {
      const form = await request.formData()
      apply({ type: 'add-section', sectionType: String(form.get('sectionType')) as never })
      return panelResponse()
    }

    if (route === 'POST /undo') {
      state = undoEditor(state)
      return panelResponse()
    }
    if (route === 'POST /redo') {
      state = redoEditor(state)
      return panelResponse()
    }

    // A settings form: the command it stands for, then just the edited section back.
    if (request.method === 'POST' && url.pathname.startsWith('/form/')) {
      const id = url.pathname.slice('/form/'.length) as PanelFormId
      const command = formCommand(
        state.sections.present,
        state.selection,
        id,
        await request.formData(),
        { locale: LOCALE },
      )
      if (!command) return new Response('This form is not on screen any more.', { status: 409 })
      apply(command)
      const section = state.sections.present.find(
        (candidate) => candidate.id === state.selection.sectionId,
      )
      const fragment = section
        ? renderSectionHtml({
            ...renderBase,
            content: content([]),
            section,
            sections: state.sections.present,
          })
        : null
      return html(fragment ?? '')
    }

    return new Response('Not found', { status: 404 })
  },
})

console.log(`angkasa-builder htmx example: http://localhost:${PORT}`)
