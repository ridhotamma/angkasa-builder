/**
 * What a selection means for the panel: which screen it opens, the trail of
 * screens above it, and which actions are possible there.
 *
 * Pure reads of the sections and selection, so an htmx server renders the
 * same panel the React editor does from the same state.
 */

import { findBlock, type FoundBlock } from '../model/blocks'
import {
  linkedMaster,
  resolveLinkedSections,
  sectionDisplayName,
  type SectionInstance,
} from '../model/content'
import type { ElementKind } from '../model/element-style'
import { localize, type Localized } from '../model/localized'
import { sectionSchema, type SectionSchema } from '../model/sections'
import type { EditorCommand } from './commands'
import { DETAILS_ID, FOOTER_ID, HEADER_ID, type EditorSelection } from './selection'

/**
 * The screen the panel shows. `key` names it (two selections on the same
 * screen share one), and `depth` is how deep it sits — deeper is a step
 * forward, shallower a step back.
 */
export type PanelView = { key: string; depth: number } & (
  | { view: 'list' }
  | { view: 'details' }
  | { view: 'layout'; part: 'header' | 'footer' }
  | { view: 'section'; sectionId: string; linked: boolean }
  | { view: 'block'; sectionId: string; blockId: string }
  | { view: 'element'; sectionId: string; elementId: string; kind: ElementKind }
)

/** One step of the way back, and the command that takes it. */
export interface Crumb {
  kind: 'list' | 'section' | 'block'
  /** The section's or block's name; empty for the list, which the screen labels itself. */
  label: string
  command: EditorCommand
}

export interface Inspection {
  /** The picked section, as stored. */
  selected: SectionInstance | null
  /** What edits read from: the original, for a linked copy. */
  source: SectionInstance | null
  /** What the copy draws: the original's values with its own overrides. */
  resolved: SectionInstance | null
  schema: SectionSchema | null
  /** The picked block, with where it sits. */
  block: FoundBlock | null
  panel: PanelView
  crumbs: Crumb[]
  /** What the selected block's toolbar allows, or `null` with no block picked. */
  blockActions: { canMoveUp: boolean; canMoveDown: boolean; canDuplicate: boolean } | null
  /** The section's name as the panel titles it. */
  sectionName: string
}

export interface InspectOptions {
  /** The editor's language, for names in the trail. */
  locale: string
  /** The header and footer are editable here (a theme, not a page). */
  editableLayout?: boolean
  /** The host draws a frame whose details are picked like a section. */
  details?: boolean
}

export function inspectSelection(
  sections: readonly SectionInstance[],
  selection: EditorSelection,
  options: InspectOptions,
): Inspection {
  const l = (text: Localized) => localize(text, options.locale)
  const { sectionId, blockId, elementId, elementKind } = selection
  const selected = sections.find((section) => section.id === sectionId) ?? null
  const source = selected?.linkedTo ? (linkedMaster(selected, sections) ?? selected) : selected
  const resolved = selected?.linkedTo
    ? (resolveLinkedSections(sections).find((section) => section.id === selected.id) ?? selected)
    : selected
  const schema = source ? sectionSchema(source.type) : null
  const block =
    resolved && schema && blockId ? findBlock(schema.fields, resolved.settings, blockId) : null
  const sectionName =
    schema && selected ? sectionDisplayName(selected, sections, l(schema.name)) : ''

  const layoutPart = sectionId === HEADER_ID ? 'header' : sectionId === FOOTER_ID ? 'footer' : null

  let panel: PanelView
  if (sectionId === DETAILS_ID && options.details) {
    panel = { view: 'details', key: 'details', depth: 1 }
  } else if (layoutPart && options.editableLayout) {
    panel = { view: 'layout', part: layoutPart, key: `layout:${layoutPart}`, depth: 1 }
  } else if (selected && schema && block) {
    // A block directly in a section is one step in from the section's
    // settings, and every container around it is another.
    let depth = 2
    let parent = block.parentId
    while (parent) {
      depth += 1
      parent =
        findBlock(schema.fields, resolved?.settings ?? selected.settings, parent)?.parentId ?? null
    }
    panel = {
      view: 'block',
      sectionId: selected.id,
      blockId: block.block.id,
      key: `block:${selected.id}:${block.block.id}`,
      depth,
    }
  } else if (selected && elementId) {
    panel = {
      view: 'element',
      sectionId: selected.id,
      elementId,
      kind: elementKind,
      key: `element:${selected.id}:${elementId}`,
      depth: 2,
    }
  } else if (selected && schema) {
    panel = {
      view: 'section',
      sectionId: selected.id,
      linked: Boolean(selected.linkedTo),
      key: `section:${selected.id}`,
      depth: 1,
    }
  } else {
    panel = { view: 'list', key: 'list', depth: 0 }
  }

  // The way back: the list, the section, then each block the selection sits
  // in — every level one click away.
  const crumbs: Crumb[] = [{ kind: 'list', label: '', command: { type: 'clear-selection' } }]
  if (panel.view === 'block' && block && schema) {
    crumbs.push({
      kind: 'section',
      label: sectionName,
      command: { type: 'select-block-in-panel', blockId: null },
    })
    const values = resolved?.settings ?? selected?.settings ?? {}
    const parents: Crumb[] = []
    let parentId = block.parentId
    while (parentId) {
      const parent = findBlock(schema.fields, values, parentId)
      if (!parent) break
      parents.unshift({
        kind: 'block',
        label: parent.block.name?.trim() || l(parent.schema.name),
        command: { type: 'select-block-in-panel', blockId: parent.block.id },
      })
      parentId = parent.parentId
    }
    crumbs.push(...parents)
  } else if (panel.view === 'element') {
    crumbs.push({
      kind: 'section',
      label: sectionName,
      command: { type: 'select-block-in-panel', blockId: null },
    })
  }

  return {
    selected,
    source,
    resolved,
    schema,
    block,
    panel,
    crumbs,
    blockActions: block
      ? {
          canMoveUp: block.index > 0,
          canMoveDown: block.index < block.count - 1,
          canDuplicate: block.count < block.field.max,
        }
      : null,
    sectionName,
  }
}
