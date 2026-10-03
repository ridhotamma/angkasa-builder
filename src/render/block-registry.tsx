/**
 * The render half of the custom-block registry.
 *
 * A custom block's schema lives in the model (`defineBlock`); its component
 * lives here. `registerBlockRenderer` maps a type to a React component that
 * receives the stored block and draws whatever it likes — including hooks,
 * state and effects, so a calculator, a quantity stepper or any widget that
 * needs to be dynamic is just a component. It renders on the server and
 * hydrates in the browser like every other block.
 *
 * Lookup happens at render time and the registry wins over the built-ins, so
 * a registered renderer can override a built-in block too. A component that
 * wants to draw nested blocks (a custom layout) can use `BlockChildren` from
 * `./blocks-section`.
 */

import type { ComponentType } from 'react'

import { registerBlock } from '../model/block-registry'
import type { BlockSchema, BlockValue } from '../model/fields'

/** What every block renderer receives: the stored block, settings and style. */
export interface BlockRendererProps {
  block: BlockValue
}

export type BlockRenderer = ComponentType<BlockRendererProps>

const RENDERERS = new Map<string, BlockRenderer>()

/** Registers (or replaces) the component that draws `type`. */
export function registerBlockRenderer(type: string, renderer: BlockRenderer): void {
  RENDERERS.set(type, renderer)
}

/** The custom renderer for `type`, or `undefined` to fall through to a built-in. */
export function blockRenderer(type: string): BlockRenderer | undefined {
  return RENDERERS.get(type)
}

/** The types with a custom renderer registered. */
export function registeredBlockRenderers(): readonly string[] {
  return [...RENDERERS.keys()]
}

/**
 * Registers a custom block end to end: its schema with the model, so the
 * sanitiser and the editor accept it, and its component with the renderer.
 * The one call a `register-blocks` module needs.
 */
export function registerWidget(schema: BlockSchema, renderer: BlockRenderer): BlockSchema {
  registerBlock(schema)
  registerBlockRenderer(schema.type, renderer)
  return schema
}
