/**
 * Compiled template sections in the React renderer.
 *
 * A theme's own section is a render function the compiler produced; this is
 * the thin React wrapper that gives it the host's environment, builds the
 * template scope from `StorefrontRenderData`, and hands the result back to
 * the same `SectionFrame` every shipped section renders inside.
 *
 * The resolver is per render environment — never a module-level registry —
 * so two shops rendered by one server process can never see each other's
 * compiled themes.
 */

import {
  createElement,
  Fragment,
  useContext,
  useMemo,
  type ComponentType,
  type ReactNode,
} from 'react'

import {
  buildTemplateScope,
  createTemplateRuntime,
  type ActivatedTheme,
  type TemplateH,
  type TemplateRoute,
} from '../template'
import { sanitizeValues } from '../model/fields'
import { useRenderEnvironment } from './context'
import { SectionIdContext } from './primitives'
import type { SectionProps } from './sections'

export interface TemplateSectionOptions {
  /** The template the section is drawn on; defaults to the home page. */
  route?: TemplateRoute
}

/**
 * One compiled section as a React component. Register it through the render
 * environment's `sections` resolver (see `themeSectionResolver`) and the
 * section draws inside the normal section frame — style, spacing, dividers
 * and all — with no second render path.
 */
export function compiledSectionComponent(
  theme: ActivatedTheme,
  type: string,
  options: TemplateSectionOptions = {},
): ComponentType<SectionProps> {
  const schema = theme.manifest.sections[type]?.schema ?? null

  function CompiledSection({ settings: rawSettings }: SectionProps) {
    const env = useRenderEnvironment()
    const sectionId = useContext(SectionIdContext) ?? type
    // The platform's rule is sanitise on write *and* again on render; a
    // compiled section's schema is its sanitiser.
    const settings = useMemo(
      () => (schema ? sanitizeValues(schema.fields, rawSettings) : rawSettings),
      [schema, rawSettings],
    )
    const runtime = useMemo(
      () => createTemplateRuntime(createElement as unknown as TemplateH, env, Fragment),
      [env],
    )
    const scope = useMemo(
      () =>
        buildTemplateScope({
          data: env.data,
          env,
          route: options.route,
          section: { id: sectionId, settings },
        }),
      [env, sectionId, settings],
    )
    const rendered = theme.renderSection(type, scope)
    return <>{rendered as ReactNode}</>
  }
  CompiledSection.displayName = `CompiledSection(${type})`
  return CompiledSection
}

/**
 * A theme's section resolver for `RenderEnvironment.sections`, memoized per
 * type so a re-render never mints a new component and remounts the subtree.
 */
export function themeSectionResolver(
  theme: ActivatedTheme,
): (type: string) => ComponentType<SectionProps> | null {
  const cache = new Map<string, ComponentType<SectionProps>>()
  return (type) => {
    if (!theme.manifest.sections[type]) return null
    let component = cache.get(type)
    if (!component) {
      component = compiledSectionComponent(theme, type)
      cache.set(type, component)
    }
    return component
  }
}
