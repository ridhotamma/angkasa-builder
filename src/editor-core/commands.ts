/**
 * Everything the seller can do to a page, as plain data.
 *
 * A command is a JSON value — `{ type: 'move-section', id, by: -1 }` — and
 * `applyCommand` turns the page's sections and the current selection into the
 * next ones. Nothing here touches React, the DOM or a clock, so the same
 * command means the same thing in the React editor, in an htmx editor whose
 * server keeps the page in a session, or in a test.
 *
 * The rules are the editor's, moved here from the components: a linked copy
 * edits through its original for structure and through its own overrides for
 * content; removing a block selects its parent; a duplicate is selected; a
 * changed choice may re-seed sample content the seller has not touched.
 */

import {
  duplicateBlock,
  findBlock,
  insertBlock,
  moveBlock,
  removeBlock,
  renameBlock,
  updateBlockSettings,
  updateBlockStyle,
  updateBlocksIn,
} from '../model/blocks'
import {
  clearOverrides,
  createSection,
  detachSection,
  duplicateLinkedSection,
  duplicateSection,
  linkedMaster,
  moveSection,
  removeSection,
  renameSection,
  setBlockOverrides,
  setSectionOverrides,
  type SectionInstance,
} from '../model/content'
import type { ElementKind } from '../model/element-style'
import { readBlocks, type BlockValue, type Field, type FieldValues } from '../model/fields'
import { isLocalizedText, withLocalizedEntry, type StorefrontLocale } from '../model/localized'
import { createStarterSection, reseedSectionVariant } from '../model/section-starters'
import { sectionSchema, type SectionPreset, type SectionType } from '../model/sections'
import { NO_SELECTION, sameSelection, sectionSelection, type EditorSelection } from './selection'

/** A block as the add palette offers it: a type and optional starting values. */
export interface NewBlock {
  type: string
  settings?: Record<string, unknown>
  style?: Record<string, unknown>
  /** A saved block keeps the name the seller gave it. */
  name?: string
}

/** Where something dropped on the preview lands. */
export type DropTarget =
  | { kind: 'sections'; index: number }
  | { kind: 'blocks'; sectionId: string; parentId: string | null; fieldKey: string; index: number }

/** A preset by its key (what a form can post), or the preset itself. */
export type PresetRef = SectionPreset | string | null

export type EditorCommand =
  // Selection
  /** A section picked. From the list it scrolls into view; from the preview it is already there. */
  | { type: 'select'; sectionId: string; fromPreview?: boolean }
  /** A block clicked on the canvas: its section and the block. */
  | { type: 'select-block'; sectionId: string; blockId: string }
  /** A block row picked in the panel, or `null` to go back to the section's own settings. */
  | { type: 'select-block-in-panel'; blockId: string | null }
  /** A button or text element clicked on the canvas. */
  | { type: 'select-element'; sectionId: string; elementId: string; kind?: ElementKind }
  | { type: 'clear-selection' }
  /** One level out: a block to its parent, an element to its section, a section to the list. */
  | { type: 'step-out' }
  // Sections
  /**
   * A new section with the type's starter content. `index` defaults to after
   * the selected section (or the end); `select` (default true) opens it.
   */
  | {
      type: 'add-section'
      sectionType: SectionType
      preset?: PresetRef
      index?: number
      select?: boolean
    }
  /**
   * Blocks from the add palette, into an existing section when `into` names
   * one (after `afterBlockId`, or at the end of its top-level blocks), and
   * otherwise into a new Custom section at `index`.
   */
  | {
      type: 'add-blocks'
      blocks: readonly NewBlock[]
      into?: { sectionId: string; afterBlockId?: string | null } | null
      index?: number
    }
  /** A palette item dropped on the preview: added where it fell, not selected. */
  | {
      type: 'drop'
      item:
        | { kind: 'section'; sectionType: SectionType; preset?: PresetRef }
        | { kind: 'blocks'; blocks: readonly NewBlock[] }
      target: DropTarget
    }
  | { type: 'move-section'; id: string; by: number }
  /** The list's drag: the section at `from` now sits at `to`. */
  | { type: 'reorder-section'; from: number; to: number }
  | { type: 'duplicate-section'; id: string; linked?: boolean }
  | { type: 'remove-section'; id: string }
  | { type: 'rename-section'; id: string; name: string }
  | { type: 'detach-section'; id: string }
  | { type: 'clear-overrides'; id: string; field?: string; blockId?: string }
  /**
   * The section's settings form. `reseed` (default true) lets a changed
   * choice trade untouched sample content for the new choice's own; the
   * block tree's edits pass `false`.
   */
  | { type: 'set-section-settings'; id: string; values: FieldValues; reseed?: boolean }
  /** A linked copy's own content, over its original's. */
  | { type: 'set-section-overrides'; id: string; values: FieldValues }
  | { type: 'set-section-style'; id: string; style: FieldValues }
  // Blocks
  | { type: 'set-block-settings'; sectionId: string; blockId: string; values: FieldValues }
  | { type: 'set-block-style'; sectionId: string; blockId: string; style: FieldValues | undefined }
  | { type: 'rename-block'; sectionId: string; blockId: string; name: string }
  | { type: 'move-block'; sectionId: string; blockId: string; by: number }
  | { type: 'duplicate-block'; sectionId: string; blockId: string }
  | { type: 'remove-block'; sectionId: string; blockId: string }
  // Elements
  | { type: 'set-element'; sectionId: string; elementId: string; values: FieldValues }
  | { type: 'reset-element'; sectionId: string; elementId: string }
  // Typing in the preview
  | { type: 'edit-text'; sectionId: string; key: string; value: string }
  | { type: 'edit-block-text'; sectionId: string; blockId: string; key: string; value: string }
  // The keyboard's verbs, on whatever is selected
  | { type: 'remove-selection' }
  | { type: 'duplicate-selection' }
  | { type: 'move-selection'; by: -1 | 1 }

export interface CommandContext {
  /** The language the editor shows; typing into a translated field edits this one. */
  locale: StorefrontLocale
}

export interface CommandResult {
  sections: SectionInstance[]
  selection: EditorSelection
  /** Whether the command did anything — the keyboard's cue to swallow the key. */
  handled: boolean
  /** A section the preview should bring into view: `start` scrolls to it, `nearest` only nudges. */
  reveal?: { id: string; how: 'start' | 'nearest' }
  /** A section whose branch the list's tree should open, so the way back shows the pick. */
  expand?: string
}

/**
 * The section an edit should land on: a linked copy edits its original, so
 * every copy updates together.
 */
export function editTargetId(sections: readonly SectionInstance[], id: string): string {
  const section = sections.find((other) => other.id === id)
  if (!section?.linkedTo) return id
  return linkedMaster(section, sections)?.id ?? id
}

/** `sections` with the edit target of `id` changed; the same array when nothing changed. */
function updateSection(
  sections: SectionInstance[],
  id: string,
  change: (section: SectionInstance) => SectionInstance,
): SectionInstance[] {
  const target = editTargetId(sections, id)
  let changed = false
  const next = sections.map((section) => {
    if (section.id !== target) return section
    const updated = change(section)
    if (updated !== section) changed = true
    return updated
  })
  return changed ? next : sections
}

/** A section's settings rewritten by a blocks operation that may refuse (`null`). */
function updateBlocks(
  sections: SectionInstance[],
  id: string,
  change: (fields: readonly Field[], settings: FieldValues) => FieldValues | null,
): SectionInstance[] {
  return updateSection(sections, id, (section) => {
    const fields = fieldsOf(section)
    if (!fields) return section
    const settings = change(fields, section.settings)
    return settings ? { ...section, settings } : section
  })
}

function fieldsOf(section: SectionInstance) {
  return sectionSchema(section.type)?.fields ?? null
}

function resolvePreset(type: SectionType, preset: PresetRef | undefined): SectionPreset | null {
  if (!preset) return null
  if (typeof preset !== 'string') return preset
  return sectionSchema(type)?.presets?.find((candidate) => candidate.key === preset) ?? null
}

/** Where a new section goes by default: after the selected one, or at the end. */
function defaultIndex(sections: readonly SectionInstance[], selection: EditorSelection): number {
  const after = selection.sectionId
    ? sections.findIndex((section) => section.id === selection.sectionId) + 1
    : 0
  return after > 0 ? after : sections.length
}

function clampIndex(sections: readonly SectionInstance[], index: number): number {
  return Math.max(0, Math.min(sections.length, index))
}

function insertAt(sections: SectionInstance[], index: number, section: SectionInstance) {
  const next = [...sections]
  next.splice(clampIndex(sections, index), 0, section)
  return next
}

/** Palette blocks, sanitised the way a Custom section would store them. */
function newBlocks(blocks: readonly NewBlock[]): { donor: SectionInstance; created: BlockValue[] } {
  const donor = createSection('blocks', { blocks: blocks as never })
  return { donor, created: readBlocks(donor.settings, 'blocks') }
}

/** `created` into `host` at `container` from `index` on; `null` when none fit. */
function insertBlocks(
  host: SectionInstance,
  container: { parentId: string | null; fieldKey: string },
  index: number,
  created: readonly BlockValue[],
): FieldValues | null {
  const fields = fieldsOf(host)
  if (!fields || created.length === 0) return null
  let values = host.settings
  let at = index
  for (const block of created) {
    const inserted = insertBlock(fields, values, container, at, block)
    if (!inserted) break
    values = inserted
    at += 1
  }
  return values === host.settings ? null : values
}

/** The section a selection's edits read from: the original, for a linked copy. */
function sourceOf(sections: readonly SectionInstance[], id: string): SectionInstance | null {
  const section = sections.find((other) => other.id === id) ?? null
  if (!section?.linkedTo) return section
  return linkedMaster(section, sections) ?? section
}

/**
 * Apply one command. Returns the next sections and selection — the same
 * objects when the command changed nothing, so a caller can compare by
 * identity before writing history.
 */
export function applyCommand(
  sections: SectionInstance[],
  selection: EditorSelection,
  command: EditorCommand,
  context: CommandContext,
): CommandResult {
  const unchanged: CommandResult = { sections, selection, handled: false }
  const done = (
    next: SectionInstance[],
    nextSelection: EditorSelection = selection,
    extra: Pick<CommandResult, 'reveal' | 'expand'> = {},
  ): CommandResult => ({
    sections: next,
    selection: sameSelection(selection, nextSelection),
    handled: true,
    ...extra,
  })

  switch (command.type) {
    /* Selection ---------------------------------------------------------- */

    case 'select':
      return done(
        sections,
        sectionSelection(command.sectionId),
        command.fromPreview ? {} : { reveal: { id: command.sectionId, how: 'start' } },
      )

    case 'select-block':
      return done(
        sections,
        { ...NO_SELECTION, sectionId: command.sectionId, blockId: command.blockId },
        { expand: command.sectionId },
      )

    case 'select-block-in-panel':
      return done(sections, { ...selection, blockId: command.blockId, elementId: null })

    case 'select-element':
      return done(sections, {
        ...NO_SELECTION,
        sectionId: command.sectionId,
        elementId: command.elementId,
        elementKind: command.kind ?? 'button',
      })

    case 'clear-selection':
      return selection.sectionId ? done(sections, NO_SELECTION) : unchanged

    case 'step-out': {
      if (selection.blockId && selection.sectionId) {
        const source = sourceOf(sections, selection.sectionId)
        const fields = source ? fieldsOf(source) : null
        const found =
          source && fields
            ? findBlock(fields, resolvedSettings(sections, selection.sectionId), selection.blockId)
            : null
        return done(sections, { ...selection, blockId: found?.parentId ?? null })
      }
      if (selection.elementId) return done(sections, { ...selection, elementId: null })
      if (selection.sectionId) return done(sections, NO_SELECTION)
      return unchanged
    }

    /* Sections ----------------------------------------------------------- */

    case 'add-section': {
      const section = createStarterSection(
        command.sectionType,
        resolvePreset(command.sectionType, command.preset),
      )
      const next = insertAt(sections, command.index ?? defaultIndex(sections, selection), section)
      return command.select === false
        ? done(next)
        : done(next, sectionSelection(section.id), { reveal: { id: section.id, how: 'start' } })
    }

    case 'add-blocks': {
      const { donor, created } = newBlocks(command.blocks)
      const into = command.into
      const host = into ? sections.find((section) => section.id === into.sectionId) : undefined
      if (host && !host.linkedTo) {
        const fields = fieldsOf(host)
        const after =
          into?.afterBlockId && fields ? findBlock(fields, host.settings, into.afterBlockId) : null
        const values = insertBlocks(
          host,
          after
            ? { parentId: after.parentId, fieldKey: after.field.key }
            : { parentId: null, fieldKey: 'blocks' },
          after ? after.index + 1 : readBlocks(host.settings, 'blocks').length,
          created,
        )
        if (values) {
          return done(
            sections.map((section) =>
              section.id === host.id ? { ...section, settings: values } : section,
            ),
            { ...NO_SELECTION, sectionId: host.id, blockId: created[0]!.id },
            { reveal: { id: host.id, how: 'start' } },
          )
        }
      }
      const next = insertAt(sections, command.index ?? defaultIndex(sections, selection), donor)
      return done(next, sectionSelection(donor.id), { reveal: { id: donor.id, how: 'start' } })
    }

    case 'drop': {
      const { item, target } = command
      const index = target.kind === 'sections' ? target.index : sections.length
      if (item.kind === 'section') {
        const section = createStarterSection(
          item.sectionType,
          resolvePreset(item.sectionType, item.preset),
        )
        return done(insertAt(sections, index, section))
      }
      const { donor, created } = newBlocks(item.blocks)
      if (target.kind === 'blocks') {
        const host = sections.find(
          (section) => section.id === editTargetId(sections, target.sectionId),
        )
        const values = host
          ? insertBlocks(
              host,
              { parentId: target.parentId, fieldKey: target.fieldKey },
              target.index,
              created,
            )
          : null
        if (host && values) {
          return done(
            sections.map((section) =>
              section.id === host.id ? { ...section, settings: values } : section,
            ),
          )
        }
      }
      return done(insertAt(sections, index, donor))
    }

    case 'move-section': {
      const next = moveSection(sections, command.id, command.by)
      return next === sections
        ? unchanged
        : done(next, selection, { reveal: { id: command.id, how: 'nearest' } })
    }

    case 'reorder-section': {
      const { from, to } = command
      if (from === to || from < 0 || to < 0 || from >= sections.length || to >= sections.length)
        return unchanged
      const next = [...sections]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved!)
      return done(next)
    }

    case 'duplicate-section': {
      const result = command.linked
        ? duplicateLinkedSection(sections, command.id)
        : duplicateSection(sections, command.id)
      if (!result) return unchanged
      return done(result.sections, sectionSelection(result.copy.id), {
        reveal: { id: result.copy.id, how: 'nearest' },
      })
    }

    case 'remove-section': {
      const next = removeSection(sections, command.id)
      if (next === sections) return unchanged
      return done(next, selection.sectionId === command.id ? NO_SELECTION : selection)
    }

    case 'rename-section':
      return done(renameSection(sections, command.id, command.name))

    case 'detach-section':
      return done(detachSection(sections, command.id))

    case 'clear-overrides': {
      const target = command.blockId
        ? { blockId: command.blockId }
        : command.field
          ? { field: command.field }
          : undefined
      return done(clearOverrides(sections, command.id, target))
    }

    case 'set-section-settings':
      return done(
        updateSection(sections, command.id, (section) => ({
          ...section,
          settings:
            command.reseed === false
              ? command.values
              : reseedSectionVariant(section.type, section.settings, command.values),
        })),
      )

    case 'set-section-overrides':
      return done(setSectionOverrides(sections, command.id, command.values))

    case 'set-section-style':
      return done(
        updateSection(sections, command.id, (section) => ({ ...section, style: command.style })),
      )

    /* Blocks ------------------------------------------------------------- */

    case 'set-block-settings': {
      // A linked copy's block content is its own; structure still belongs to
      // the original, which `setBlockOverrides` routes.
      if (sections.find((section) => section.id === command.sectionId)?.linkedTo) {
        return done(setBlockOverrides(sections, command.sectionId, command.blockId, command.values))
      }
      return done(
        updateBlocks(sections, command.sectionId, (fields, settings) =>
          updateBlockSettings(fields, settings, command.blockId, command.values),
        ),
      )
    }

    case 'set-block-style':
      return done(
        updateBlocks(sections, command.sectionId, (fields, settings) =>
          updateBlockStyle(fields, settings, command.blockId, command.style),
        ),
      )

    case 'rename-block':
      return done(
        updateBlocks(sections, command.sectionId, (fields, settings) =>
          renameBlock(fields, settings, command.blockId, command.name),
        ),
      )

    case 'move-block': {
      const next = updateBlocks(sections, command.sectionId, (fields, settings) =>
        moveBlock(fields, settings, command.blockId, command.by),
      )
      return next === sections ? unchanged : done(next)
    }

    case 'duplicate-block': {
      const source = sourceOf(sections, command.sectionId)
      const fields = source ? fieldsOf(source) : null
      const result =
        source && fields ? duplicateBlock(fields, source.settings, command.blockId) : null
      if (!result) return unchanged
      return done(
        updateSection(sections, command.sectionId, (section) => ({
          ...section,
          settings: result.values,
        })),
        { ...selection, sectionId: command.sectionId, blockId: result.copy.id, elementId: null },
      )
    }

    case 'remove-block': {
      const source = sourceOf(sections, command.sectionId)
      const fields = source ? fieldsOf(source) : null
      const found = source && fields ? findBlock(fields, source.settings, command.blockId) : null
      const next = updateBlocks(sections, command.sectionId, (shape, settings) =>
        removeBlock(shape, settings, command.blockId),
      )
      if (next === sections) return unchanged
      // Removing a child returns to its parent, not all the way out.
      const wasSelected =
        selection.sectionId === command.sectionId && selection.blockId === command.blockId
      return done(
        next,
        wasSelected ? { ...selection, blockId: found?.parentId ?? null } : selection,
      )
    }

    /* Elements ----------------------------------------------------------- */

    case 'set-element':
      return done(
        updateSection(sections, command.sectionId, (section) => ({
          ...section,
          elements: { ...(section.elements ?? {}), [command.elementId]: command.values },
        })),
      )

    case 'reset-element':
      return done(
        updateSection(sections, command.sectionId, (section) => {
          const current = section.elements
          if (!current?.[command.elementId]) return section
          const remaining = { ...current }
          delete remaining[command.elementId]
          if (Object.keys(remaining).length === 0) {
            const { elements: _cleared, ...rest } = section
            return rest
          }
          return { ...section, elements: remaining }
        }),
      )

    /* Typing in the preview ---------------------------------------------- */

    case 'edit-text': {
      const { sectionId, key, value } = command
      // A linked copy's words are its own override; the original keeps its own.
      if (sections.find((section) => section.id === sectionId)?.linkedTo) {
        return done(setSectionOverrides(sections, sectionId, { [key]: value }))
      }
      return done(
        updateSection(sections, sectionId, (section) => {
          const existing = section.settings[key]
          // A translated field stays a locale map: the language the editor
          // shows is edited, the other one left alone.
          const written = isLocalizedText(existing)
            ? withLocalizedEntry(existing, context.locale, value)
            : value
          return { ...section, settings: { ...section.settings, [key]: written } }
        }),
      )
    }

    case 'edit-block-text': {
      const { sectionId, blockId, key, value } = command
      if (sections.find((section) => section.id === sectionId)?.linkedTo) {
        return done(setBlockOverrides(sections, sectionId, blockId, { [key]: value }))
      }
      return done(
        updateBlocks(sections, sectionId, (fields, settings) =>
          updateBlocksIn(fields, settings, blockId, (blocks, index) =>
            blocks.map((block, at) =>
              at === index ? { ...block, settings: { ...block.settings, [key]: value } } : block,
            ),
          ),
        ),
      )
    }

    /* The keyboard ------------------------------------------------------- */

    case 'remove-selection': {
      const { sectionId, blockId } = selection
      if (!sectionId) return unchanged
      if (blockId && selectedBlockExists(sections, selection)) {
        return applyCommand(
          sections,
          selection,
          { type: 'remove-block', sectionId, blockId },
          context,
        )
      }
      return applyCommand(sections, selection, { type: 'remove-section', id: sectionId }, context)
    }

    case 'duplicate-selection': {
      const { sectionId, blockId } = selection
      if (!sectionId) return unchanged
      if (blockId && selectedBlockExists(sections, selection)) {
        const found = selectedBlock(sections, selection)
        if (!found || found.count >= found.field.max) return unchanged
        return applyCommand(
          sections,
          selection,
          { type: 'duplicate-block', sectionId, blockId },
          context,
        )
      }
      return applyCommand(
        sections,
        selection,
        { type: 'duplicate-section', id: sectionId },
        context,
      )
    }

    case 'move-selection': {
      const { sectionId, blockId } = selection
      if (!sectionId) return unchanged
      if (blockId && selectedBlockExists(sections, selection)) {
        const result = applyCommand(
          sections,
          selection,
          { type: 'move-block', sectionId, blockId, by: command.by },
          context,
        )
        // The key is the block's either way: at the end of its list, it stays put.
        return { ...result, handled: true }
      }
      const result = applyCommand(
        sections,
        selection,
        { type: 'move-section', id: sectionId, by: command.by },
        context,
      )
      return { ...result, handled: true }
    }
  }
}

/** What a selected section draws: its own settings, or a linked copy's merged ones. */
function resolvedSettings(sections: readonly SectionInstance[], id: string): FieldValues {
  return sourceOf(sections, id)?.settings ?? {}
}

function selectedBlock(sections: readonly SectionInstance[], selection: EditorSelection) {
  if (!selection.sectionId || !selection.blockId) return null
  const source = sourceOf(sections, selection.sectionId)
  const fields = source ? fieldsOf(source) : null
  return source && fields ? findBlock(fields, source.settings, selection.blockId) : null
}

function selectedBlockExists(sections: readonly SectionInstance[], selection: EditorSelection) {
  return selectedBlock(sections, selection) !== null
}
