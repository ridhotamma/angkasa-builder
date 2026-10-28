/**
 * The editor's logic with no UI (`src/editor-core`): commands, selection,
 * the panel a selection opens, forms both ways, and undo — what the React
 * editor and an htmx editor share.
 */

import { describe, expect, test } from 'bun:test'

import { createSection, readBlocks, type SectionInstance } from '../src/index'
import {
  applyCommand,
  createEditorState,
  createEditorStore,
  describeFields,
  dispatchCommand,
  formCommand,
  inspectSelection,
  NO_SELECTION,
  panelForms,
  pushHistory,
  createHistory,
  readFormInput,
  undoEditor,
  undoHistory,
  redoHistory,
  type EditorCommand,
  type EditorSelection,
} from '../src/editor-core/index'
import { sectionSchema } from '../src/model/sections'

const ctx = { locale: 'en' as const }

function page(): SectionInstance[] {
  return [
    createSection('rich-text', { heading: 'First', body: 'One' }),
    createSection('blocks', {}),
    createSection('rich-text', { heading: 'Third', body: 'Three' }),
  ]
}

function run(
  sections: SectionInstance[],
  selection: EditorSelection,
  ...commands: EditorCommand[]
) {
  let state = { sections, selection }
  let last = applyCommand(sections, selection, { type: 'step-out' }, ctx)
  for (const command of commands) {
    last = applyCommand(state.sections, state.selection, command, ctx)
    state = { sections: last.sections, selection: last.selection }
  }
  return last
}

describe('selection', () => {
  test('picking a section drops the block of the previous one', () => {
    const sections = page()
    const blocks = readBlocks(sections[1]!.settings, 'blocks')
    const result = run(
      sections,
      NO_SELECTION,
      { type: 'select-block', sectionId: sections[1]!.id, blockId: blocks[0]!.id },
      { type: 'select', sectionId: sections[0]!.id },
    )
    expect(result.selection).toEqual({ ...NO_SELECTION, sectionId: sections[0]!.id })
    expect(result.reveal).toEqual({ id: sections[0]!.id, how: 'start' })
  })

  test('a block clicked on the canvas opens its section in the tree', () => {
    const sections = page()
    const block = readBlocks(sections[1]!.settings, 'blocks')[0]!
    const result = applyCommand(
      sections,
      NO_SELECTION,
      { type: 'select-block', sectionId: sections[1]!.id, blockId: block.id },
      ctx,
    )
    expect(result.expand).toBe(sections[1]!.id)
    expect(result.selection.blockId).toBe(block.id)
  })

  test('stepping out goes block → section → list', () => {
    const sections = page()
    const block = readBlocks(sections[1]!.settings, 'blocks')[0]!
    const selection: EditorSelection = {
      ...NO_SELECTION,
      sectionId: sections[1]!.id,
      blockId: block.id,
    }
    const once = applyCommand(sections, selection, { type: 'step-out' }, ctx)
    expect(once.selection).toEqual({ ...NO_SELECTION, sectionId: sections[1]!.id })
    const twice = applyCommand(sections, once.selection, { type: 'step-out' }, ctx)
    expect(twice.selection).toEqual(NO_SELECTION)
    expect(applyCommand(sections, NO_SELECTION, { type: 'step-out' }, ctx).handled).toBe(false)
  })
})

describe('sections', () => {
  test('a new section goes after the selected one and opens', () => {
    const sections = page()
    const result = applyCommand(
      sections,
      { ...NO_SELECTION, sectionId: sections[0]!.id },
      { type: 'add-section', sectionType: 'faq' },
      ctx,
    )
    expect(result.sections.map((section) => section.type)).toEqual([
      'rich-text',
      'faq',
      'blocks',
      'rich-text',
    ])
    expect(result.selection.sectionId).toBe(result.sections[1]!.id)
  })

  test('a dropped section lands where it fell and is not selected', () => {
    const sections = page()
    const result = applyCommand(
      sections,
      NO_SELECTION,
      {
        type: 'drop',
        item: { kind: 'section', sectionType: 'faq' },
        target: { kind: 'sections', index: 0 },
      },
      ctx,
    )
    expect(result.sections[0]!.type).toBe('faq')
    expect(result.selection).toBe(NO_SELECTION)
  })

  test('a preset can be named by its key, as a form posts it', () => {
    const preset = sectionSchema('banner')?.presets?.[0]
    if (!preset) return
    const result = applyCommand(
      page(),
      NO_SELECTION,
      { type: 'add-section', sectionType: 'banner', preset: preset.key },
      ctx,
    )
    const added = result.sections.find((section) => section.type === 'banner')!
    for (const [key, value] of Object.entries(preset.settings ?? {})) {
      if (typeof value === 'string') expect(added.settings[key]).toEqual(value)
    }
  })

  test('move, duplicate and remove, by keyboard verbs on the selection', () => {
    const sections = page()
    const first = sections[0]!.id
    const moved = applyCommand(
      sections,
      { ...NO_SELECTION, sectionId: first },
      { type: 'move-selection', by: 1 },
      ctx,
    )
    expect(moved.sections[1]!.id).toBe(first)
    expect(moved.reveal).toEqual({ id: first, how: 'nearest' })

    const copied = applyCommand(
      moved.sections,
      moved.selection,
      { type: 'duplicate-selection' },
      ctx,
    )
    expect(copied.sections).toHaveLength(4)
    expect(copied.selection.sectionId).toBe(copied.sections[2]!.id)
    expect(copied.selection.sectionId).not.toBe(first)

    const removed = applyCommand(
      copied.sections,
      copied.selection,
      { type: 'remove-selection' },
      ctx,
    )
    expect(removed.sections).toHaveLength(3)
    expect(removed.selection).toEqual(NO_SELECTION)
  })

  test('a move off the end changes nothing and says so', () => {
    const sections = page()
    const result = applyCommand(
      sections,
      NO_SELECTION,
      { type: 'move-section', id: sections[0]!.id, by: -1 },
      ctx,
    )
    expect(result.sections).toBe(sections)
    expect(result.handled).toBe(false)
  })

  test('the list drag reorders', () => {
    const sections = page()
    const result = applyCommand(
      sections,
      NO_SELECTION,
      { type: 'reorder-section', from: 0, to: 2 },
      ctx,
    )
    expect(result.sections.map((section) => section.id)).toEqual([
      sections[1]!.id,
      sections[2]!.id,
      sections[0]!.id,
    ])
  })
})

describe('blocks', () => {
  test('palette blocks go after the selected block in a Custom section', () => {
    const sections = page()
    const host = sections[1]!
    const before = readBlocks(host.settings, 'blocks')
    const result = applyCommand(
      sections,
      { ...NO_SELECTION, sectionId: host.id, blockId: before[0]!.id },
      {
        type: 'add-blocks',
        blocks: [{ type: 'heading', settings: { text: 'New' } }],
        into: { sectionId: host.id, afterBlockId: before[0]!.id },
      },
      ctx,
    )
    const after = readBlocks(result.sections[1]!.settings, 'blocks')
    expect(after).toHaveLength(before.length + 1)
    expect(after[1]!.type).toBe('heading')
    expect(result.selection.blockId).toBe(after[1]!.id)
  })

  test('with nowhere to go, palette blocks start a new Custom section', () => {
    const sections = page()
    const result = applyCommand(
      sections,
      NO_SELECTION,
      { type: 'add-blocks', blocks: [{ type: 'heading' }] },
      ctx,
    )
    expect(result.sections).toHaveLength(4)
    expect(result.sections[3]!.type).toBe('blocks')
    expect(result.selection.sectionId).toBe(result.sections[3]!.id)
  })

  test('removing a selected block selects its parent level', () => {
    const sections = page()
    const host = sections[1]!
    const block = readBlocks(host.settings, 'blocks')[1]!
    const result = applyCommand(
      sections,
      { ...NO_SELECTION, sectionId: host.id, blockId: block.id },
      { type: 'remove-selection' },
      ctx,
    )
    expect(
      readBlocks(result.sections[1]!.settings, 'blocks').some((other) => other.id === block.id),
    ).toBe(false)
    expect(result.selection).toEqual({ ...NO_SELECTION, sectionId: host.id })
  })

  test('typing in a block on the canvas edits that block', () => {
    const sections = page()
    const host = sections[1]!
    const heading = readBlocks(host.settings, 'blocks').find((block) => block.type === 'heading')!
    const result = applyCommand(
      sections,
      NO_SELECTION,
      {
        type: 'edit-block-text',
        sectionId: host.id,
        blockId: heading.id,
        key: 'text',
        value: 'Typed',
      },
      ctx,
    )
    const edited = readBlocks(result.sections[1]!.settings, 'blocks').find(
      (block) => block.id === heading.id,
    )!
    expect(edited.settings.text).toBe('Typed')
  })
})

describe('typing in the preview', () => {
  test('a translated field keeps its other language', () => {
    const section = createSection('rich-text', { heading: { id: 'Halo', en: 'Hello' } as never })
    const result = applyCommand(
      [section],
      NO_SELECTION,
      { type: 'edit-text', sectionId: section.id, key: 'heading', value: 'Hi' },
      ctx,
    )
    expect(result.sections[0]!.settings.heading).toEqual({ id: 'Halo', en: 'Hi' })
  })
})

describe('inspectSelection', () => {
  test('names the screen, its depth and the way back', () => {
    const sections = page()
    const host = sections[1]!
    const block = readBlocks(host.settings, 'blocks')[0]!
    const list = inspectSelection(sections, NO_SELECTION, ctx)
    expect(list.panel).toMatchObject({ view: 'list', depth: 0 })

    const section = inspectSelection(sections, { ...NO_SELECTION, sectionId: host.id }, ctx)
    expect(section.panel).toMatchObject({
      view: 'section',
      key: `section:${host.id}`,
      depth: 1,
      linked: false,
    })

    const picked = inspectSelection(
      sections,
      { ...NO_SELECTION, sectionId: host.id, blockId: block.id },
      ctx,
    )
    expect(picked.panel).toMatchObject({ view: 'block', depth: 2 })
    expect(picked.crumbs.map((crumb) => crumb.kind)).toEqual(['list', 'section'])
    expect(picked.crumbs[1]!.command).toEqual({ type: 'select-block-in-panel', blockId: null })
    expect(picked.blockActions).toEqual({ canMoveUp: false, canMoveDown: true, canDuplicate: true })
  })

  test('the header opens its own screen only where the layout is editable', () => {
    const selection = { ...NO_SELECTION, sectionId: 'layout:header' }
    expect(
      inspectSelection(page(), selection, { locale: 'en', editableLayout: true }).panel.view,
    ).toBe('layout')
    expect(inspectSelection(page(), selection, { locale: 'en' }).panel.view).toBe('list')
  })
})

describe('forms', () => {
  test('describe a section in the editor language, with showWhen applied', () => {
    const section = createSection('rich-text', { heading: 'Hello' })
    const schema = sectionSchema('rich-text')!
    const fields = describeFields(schema.fields, section.settings, { locale: 'en' })
    const heading = fields.find((field) => field.key === 'heading')!
    expect(heading.kind).toBe('text')
    expect(heading.label).toBeTruthy()
    expect(heading).toMatchObject({ name: 'heading', value: 'Hello', shown: true })
  })

  test('read a submission back, sanitised, keeping what was not posted', () => {
    const section = createSection('faq', {
      heading: 'Questions',
      items: [{ question: 'One?', answer: 'Yes.' }],
    })
    const schema = sectionSchema('faq')!
    const input = new URLSearchParams()
    input.set('heading', 'Answers')
    input.set('items.0.question', 'Changed?')
    const values = readFormInput(schema.fields, section.settings, input, { locale: 'en' })
    expect(values.heading).toBe('Answers')
    const items = values.items as Array<Record<string, unknown>>
    expect(items[0]!.question).toBe('Changed?')
    expect(items[0]!.answer).toBe('Yes.')
    // The item keeps its id, so the editor keeps its row.
    expect(items[0]!.id).toBe((section.settings.items as Array<Record<string, unknown>>)[0]!.id)
  })

  test('a switch reads its last value, so a hidden "false" before the box posts off', () => {
    const fields = [
      { kind: 'boolean' as const, key: 'on', label: { en: 'On', id: 'On' }, default: true },
    ]
    expect(readFormInput(fields, { on: true }, { on: ['false'] }, { locale: 'en' }).on).toBe(false)
    expect(
      readFormInput(fields, { on: false }, { on: ['false', 'true'] }, { locale: 'en' }).on,
    ).toBe(true)
  })

  test('out-of-range input falls back as a save would', () => {
    const fields = [
      {
        kind: 'number' as const,
        key: 'n',
        label: { en: 'N', id: 'N' },
        min: 1,
        max: 5,
        default: 3,
      },
    ]
    expect(readFormInput(fields, { n: 2 }, { n: '99' }, { locale: 'en' }).n).toBe(3)
    expect(readFormInput(fields, { n: 2 }, { n: '4' }, { locale: 'en' }).n).toBe(4)
  })

  test('the panel lists its forms, and a posted one becomes its command', () => {
    const sections = page()
    const selection = { ...NO_SELECTION, sectionId: sections[0]!.id }
    const forms = panelForms(sections, selection, ctx)
    expect(forms.map((form) => form.id)).toEqual([
      'section-content',
      'section-style',
      'section-visibility',
    ])
    expect(forms[1]!.groups!.length).toBeGreaterThan(0)

    const command = formCommand(sections, selection, 'section-content', { heading: 'Posted' }, ctx)
    expect(command).toMatchObject({ type: 'set-section-settings', id: sections[0]!.id })
    const result = applyCommand(sections, selection, command!, ctx)
    expect(result.sections[0]!.settings.heading).toBe('Posted')
    expect(result.sections[0]!.settings.body).toEqual(sections[0]!.settings.body)

    // A form that is not on the selected screen is refused.
    expect(formCommand(sections, NO_SELECTION, 'section-content', {}, ctx)).toBeNull()
  })

  test('posting one style fold keeps the others', () => {
    const sections = page()
    const selection = { ...NO_SELECTION, sectionId: sections[0]!.id }
    const before = sections[0]!.style
    const command = formCommand(sections, selection, 'section-style', {}, ctx)!
    expect(command.type).toBe('set-section-style')
    expect((command as { style: Record<string, unknown> }).style).toEqual(before)
  })
})

describe('history', () => {
  test('typing coalesces; a pause starts a new step', () => {
    let history = createHistory('a')
    history = pushHistory(history, 'ab', 1000)
    history = pushHistory(history, 'abc', 1200)
    expect(history.past).toEqual(['a'])
    history = pushHistory(history, 'abcd', 5000)
    expect(history.past).toEqual(['a', 'abc'])
    expect(undoHistory(history).present).toBe('abc')
    expect(redoHistory(undoHistory(history)).present).toBe('abcd')
  })

  test('the editor state undoes a command, and drops a selection that no longer exists', () => {
    const state = createEditorState(page())
    const { state: added } = dispatchCommand(
      state,
      { type: 'add-section', sectionType: 'faq' },
      { locale: 'en', now: 1 },
    )
    expect(added.selection.sectionId).not.toBeNull()
    const undone = undoEditor(added)
    expect(undone.sections.present).toHaveLength(3)
    expect(undone.selection).toEqual(NO_SELECTION)
  })

  test('the state is plain JSON, so a server can keep it in a session', () => {
    const { state } = dispatchCommand(
      createEditorState(page()),
      { type: 'add-section', sectionType: 'faq' },
      { locale: 'en', now: 1 },
    )
    expect(JSON.parse(JSON.stringify(state))).toEqual(state)
  })

  test('a store tells its subscribers', () => {
    const store = createEditorStore(page(), { locale: 'en' })
    const seen: number[] = []
    store.subscribe((state) => seen.push(state.sections.present.length))
    store.dispatch({ type: 'add-section', sectionType: 'faq' })
    store.undo()
    expect(seen).toEqual([4, 3])
  })
})
