/**
 * A template's home page as a standalone HTML document, for headless-Chrome
 * capture.
 *
 * Server-only: `react-dom/server` and `@emotion/server` have no place in a
 * client bundle, which is why this lives in `@repo/page-builder/snapshot`
 * rather than the root entry. Only server functions import it.
 *
 * The document draws `TemplateSnapshotPage` — the same component the
 * dashboard's live `ThemePreview` card draws — under the shared Chakra
 * `system`, so a stored snapshot can never drift from the live render. All
 * CSS is inlined as `<style>` tags extracted from the same Emotion cache the
 * tree renders into; fonts and images stay remote absolute URLs the capture
 * browser fetches.
 */

import createCache from '@emotion/cache'
import { CacheProvider } from '@emotion/react'
import createEmotionServer from '@emotion/server/create-instance'
import { ChakraProvider } from '@chakra-ui/react'
import { renderToString } from 'react-dom/server'

import { I18nProvider, type Locale } from '@repo/i18n'
import { system } from '@repo/theme'

import type { ThemeContent } from '../model/content'
import { googleFontsHref } from '../model/settings'
import { RenderProvider, type RenderEnvironment, type StorefrontRenderData } from '../render/context'
import { SNAPSHOT_WIDTH, TemplateSnapshotPage } from '../render/theme-preview'

export interface SnapshotHtmlInput {
  content: ThemeContent
  data: StorefrontRenderData
  /** A media file id as an absolute URL headless Chrome can fetch. */
  imageUrl: RenderEnvironment['imageUrl']
  formatPrice: RenderEnvironment['formatPrice']
  /** An uploaded video's file id as an absolute URL. */
  videoUrl?: RenderEnvironment['videoUrl']
  /** Chrome around sections ("Shop now", countdown units). Defaults to Indonesian. */
  locale?: Locale
}

/**
 * Render a template's home page to a complete HTML document at snapshot
 * width, with every style inlined. Hand the string to `screenshotHtml`.
 */
export function renderTemplateSnapshotHtml({
  content,
  data,
  imageUrl,
  formatPrice,
  videoUrl,
  locale = 'id',
}: SnapshotHtmlInput): string {
  const cache = createCache({ key: 'snap' })
  const { extractCriticalToChunks, constructStyleTagsFromChunks } = createEmotionServer(cache)

  const env: RenderEnvironment = {
    data,
    settings: content.settings,
    mode: 'live',
    imageUrl,
    videoUrl,
    formatPrice,
    // Judged once, at capture: the storefront would judge at request time.
    now: new Date(),
  }

  const body = renderToString(
    <CacheProvider value={cache}>
      <ChakraProvider value={system}>
        <I18nProvider locale={locale} resources={{}}>
          <RenderProvider value={env}>
            <TemplateSnapshotPage
              content={content}
              data={data}
              imageUrl={imageUrl}
              formatPrice={formatPrice}
              videoUrl={videoUrl}
            />
          </RenderProvider>
        </I18nProvider>
      </ChakraProvider>
    </CacheProvider>,
  )

  const chunks = extractCriticalToChunks(body)
  const styles = constructStyleTagsFromChunks(chunks)
  const fonts = googleFontsHref(content.settings)

  return [
    '<!DOCTYPE html>',
    `<html lang="${locale}">`,
    '<head>',
    '<meta charset="utf-8">',
    `<meta name="viewport" content="width=${SNAPSHOT_WIDTH}">`,
    fonts ? `<link rel="stylesheet" href="${fonts}">` : '',
    styles,
    `<style>html,body{margin:0;padding:0;background:#fff}body{min-width:${SNAPSHOT_WIDTH}px}</style>`,
    '</head>',
    `<body>${body}</body>`,
    '</html>',
  ].join('')
}
