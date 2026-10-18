/**
 * `@repo/page-builder/template` — the compiled template language.
 *
 * Tier 1 of the custom-storefront story in docs/TEMPLATE_ENGINE.md: a
 * Liquid-shaped, HTML-first language that compiles at publish to a JavaScript
 * render function, checked against the same drops and rendered through the
 * same React pipeline as every shipped section.
 *
 * Pure by construction — no React, no Chakra. The runtime takes the element
 * factory as an argument, and `@repo/page-builder/render` supplies React's.
 *
 * ```ts
 * const theme = compileTheme({
 *   'layout/theme.tpl': '<main>{{ content_for_layout }}</main>',
 *   'templates/index.tpl': '<h1>{{ shop.name }}</h1>',
 *   'sections/hero.tpl': '<section><h1>{{ section.settings.heading }}</h1></section>{% schema %}{"settings":[{"key":"heading","kind":"text"}]}{% endschema %}',
 * })
 * if (hasErrors(theme.diagnostics)) throw new Error(theme.diagnostics.map(formatDiagnostic).join('\n'))
 * ```
 */

export {
  BINARY_OPERATORS,
  expressionsOf,
  rendersOf,
  type AttributeNode,
  type AttributeValuePart,
  type BinaryExpression,
  type BinaryOperator,
  type BlankExpression,
  type ElementNode,
  type EmptyExpression,
  type ErrorExpression,
  type Expression,
  type FilterExpression,
  type ForNode,
  type IfBranch,
  type IfNode,
  type IndexExpression,
  type LiteralExpression,
  type OutputNode,
  type ParsedTemplate,
  type PropertyExpression,
  type RangeExpression,
  type RenderArgument,
  type RenderNode,
  type SlotNode,
  type TemplateNode,
  type TextNode,
  type UnaryExpression,
  type VariableExpression,
} from './ast'

export {
  checkTemplate,
  type CheckResult,
  type CheckTemplateOptions,
  type SnippetInfo,
} from './check'

export {
  createHoistCollector,
  generateUnit,
  isStaticNode,
  parseStyle,
  type CodegenOptions,
  type GeneratedUnit,
  type HoistCollector,
} from './codegen'

export {
  closestName,
  createPositioner,
  DIAGNOSTIC_CODES,
  error,
  formatDiagnostic,
  hasErrors,
  suggestion,
  warning,
  type Diagnostic,
  type DiagnosticCode,
  type SourceLocation,
  type SourcePosition,
} from './diagnostics'

export {
  buildTemplateScope,
  dropAny,
  dropBoolean,
  dropList,
  dropNames,
  dropNil,
  dropNumber,
  dropRecord,
  dropString,
  ROUTE_DROPS,
  STOREFRONT_DROP_SCHEMA,
  type DropType,
  type TemplateRoute,
  type TemplateScope,
  type TemplateScopeInput,
} from './drops'

export { parseExpression, positionAt } from './expression'

export {
  defineFilter,
  filterNames,
  formatDate,
  isBlank,
  isEmpty,
  looseEquals,
  MAX_IMAGE_SIZE,
  MAX_RANGE,
  registeredFilter,
  registeredFilters,
  type FilterContext,
  type FilterDefinition,
} from './filters'

export {
  MAX_TEMPLATE_DEPTH,
  parseTemplate,
  splitForHeader,
  splitTopLevel,
  type ParseTemplateOptions,
  type ParsedTemplateFile,
} from './parse'

export {
  createTemplateRuntime,
  evaluateThemeModule,
  MAX_LOOP_ITEMS,
  TEMPLATE_FRAGMENT,
  TEMPLATE_SLOTS,
  type TemplateH,
  type TemplateRender,
  type TemplateRuntime,
  type TemplateSlotName,
  type ThemeModule,
  type ThemeModuleFactory,
} from './runtime'

export {
  compileSectionSchema,
  MAX_SECTION_SETTINGS,
  SCHEMA_FIELD_KINDS,
  type CompiledSectionSchema,
  type CompileSectionSchemaOptions,
  type SchemaFieldKind,
} from './schema'

export {
  activateTheme,
  activateThemeFactory,
  ASSETS_PREFIX,
  compileTheme,
  contentHash,
  createTheme,
  DEFAULT_THEME_LIMITS,
  LAYOUT_FILE,
  ROUTE_FILES,
  SECTIONS_PREFIX,
  SNIPPETS_PREFIX,
  TEMPLATE_ROUTES,
  type ActivatedTheme,
  type CompiledTheme,
  type SectionManifest,
  type ThemeArtifact,
  type ThemeFiles,
  type ThemeLimits,
  type ThemeManifest,
  type UnitManifest,
} from './theme'
