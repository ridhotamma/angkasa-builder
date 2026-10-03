/**
 * The custom-block registry: how a shop, an app or a platform release adds a
 * block type the library does not ship.
 *
 * A block is two halves — a **schema** (name, fields, bounds) that the pure
 * model owns, and a **renderer** that `@repo/page-builder/render` owns. This
 * module is the model half: `defineBlock` registers the schema with the shared
 * `BLOCK_TYPES` list every `blocks` field reads, so from that moment the new
 * type flows through the sanitiser, the editor's add-block menu, generated
 * forms and the AI planner without a change anywhere else. The renderer is
 * registered in `render/block-registry`.
 *
 * Registration is a module-scope side effect, so register custom blocks once,
 * at the entry point both the server and the client load (a `register-blocks`
 * module imported by the app's root). A type registered twice — an app
 * overriding a built-in, or a hot reload — replaces the earlier schema in
 * place rather than duplicating it.
 *
 * This is what lets an AI page builder compose a block nobody wrote:
 * generation only ever emits a `type` and field values, and any type it may
 * emit is one a developer registered here. There is no path for generated
 * HTML, CSS or JavaScript.
 */

import { BLOCK_TYPES } from './blocks'
import type { BlockSchema } from './fields'

/** The schemas every `blocks` field can hold, in picker order. */
export function registeredBlocks(): readonly BlockSchema[] {
  return BLOCK_TYPES
}

/** The schema for `type`, built-in or registered — `null` when there is none. */
export function registeredBlock(type: string): BlockSchema | null {
  return BLOCK_TYPES.find((block) => block.type === type) ?? null
}

/**
 * Registers `schema`, replacing any existing block of the same type in place.
 * Returns the schema, so a definition can be exported and registered in one
 * expression.
 */
export function registerBlock(schema: BlockSchema): BlockSchema {
  const index = BLOCK_TYPES.findIndex((block) => block.type === schema.type)
  if (index >= 0) BLOCK_TYPES[index] = schema
  else BLOCK_TYPES.push(schema)
  return schema
}

/** `registerBlock`, as a definition helper: `const callout = defineBlock({ … })`. */
export function defineBlock(schema: BlockSchema): BlockSchema {
  return registerBlock(schema)
}

/** Registers a list of schemas, in order. */
export function registerBlocks(schemas: readonly BlockSchema[]): void {
  for (const schema of schemas) registerBlock(schema)
}
