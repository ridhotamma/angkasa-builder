/**
 * Shared harness for the template-engine tests: a real runtime over React,
 * a sample storefront, and compile-and-render helpers that fail loudly on a
 * compile error instead of rendering something empty.
 */

import { createElement, Fragment, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { DEFAULT_THEME_SETTINGS } from '../src'
import {
  previewArticleDetail,
  previewListing,
  previewProductDetail,
  sampleStorefrontData,
  type RenderEnvironment,
  type StorefrontRenderData,
} from '../src/render'
import {
  activateTheme,
  buildTemplateScope,
  compileTheme,
  createTemplateRuntime,
  formatDiagnostic,
  hasErrors,
  type TemplateH,
  type TemplateRoute,
  type TemplateScope,
  type ThemeFiles,
} from '../src/template'

/** Sample data with the drop a route needs, so every page has something to draw. */
export function routeData(route: TemplateRoute, base?: StorefrontRenderData): StorefrontRenderData {
  const data = base ?? sampleStorefrontData('Test shop')
  switch (route) {
    case 'product':
      return { ...data, product: data.product ?? previewProductDetail(data) }
    case 'article':
      return { ...data, article: data.article ?? previewArticleDetail(data) }
    case 'catalog':
      return { ...data, listing: data.listing ?? previewListing(data) }
    default:
      return data
  }
}

export function testEnvironment(overrides: Partial<RenderEnvironment> = {}): RenderEnvironment {
  return {
    data: routeData('home', overrides.data),
    settings: DEFAULT_THEME_SETTINGS,
    mode: 'live',
    imageUrl: (fileId, size) => `https://cdn.test/${fileId}-${size.width}x${size.height}.jpg`,
    videoUrl: (fileId) => `https://cdn.test/video/${fileId}.mp4`,
    formatPrice: (amount, currency) => `${currency} ${amount}`,
    ...overrides,
  }
}

export interface RenderThemeOptions {
  route?: TemplateRoute
  env?: Partial<RenderEnvironment>
  /** Merged over the built scope, for tests that need a specific shape. */
  scope?: Partial<TemplateScope>
}

export interface RenderedTheme {
  html: string
  scope: TemplateScope
  env: RenderEnvironment
}

/** Compiles, activates and renders one route of a theme to static HTML. */
export function renderTheme(files: ThemeFiles, options: RenderThemeOptions = {}): RenderedTheme {
  const route = options.route ?? 'home'
  const env = testEnvironment({
    ...options.env,
    data: routeData(route, options.env?.data),
  })
  const theme = compileTheme(files)
  if (hasErrors(theme.diagnostics)) {
    throw new Error(`Theme did not compile:\n${theme.diagnostics.map(formatDiagnostic).join('\n')}`)
  }
  const runtime = createTemplateRuntime(createElement as unknown as TemplateH, env, Fragment)
  const activated = activateTheme(theme, runtime)
  const scope = { ...buildTemplateScope({ data: env.data, env, route }), ...options.scope }
  const rendered = activated.renderRoute(route, scope)
  return {
    html: rendered === null ? '' : renderToStaticMarkup(rendered as ReactNode),
    scope,
    env,
  }
}

/** Renders one template body as the theme's home page. */
export function renderTemplate(source: string, options: RenderThemeOptions = {}): string {
  return renderTheme({ 'templates/index.tpl': source }, options).html
}
