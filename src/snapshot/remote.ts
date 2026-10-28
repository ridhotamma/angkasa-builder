/**
 * Call a remote render service: HTML in, rendered bytes out.
 *
 * Used by `screenshotHtml`; a host can call it for PDFs too — one contract,
 * one auth scheme, one timeout. The service takes `{ action, html, … }` as
 * JSON with a bearer key and answers with the bytes.
 *
 * Routing: when `RENDER_FUNCTION_URL` **and** `RENDER_FUNCTION_KEY` are set
 * (every deployed environment), rendering happens in the Function and the
 * apps never launch a browser. When either is unset (local dev), callers
 * take their local-Chromium branch instead. Nothing here launches anything.
 *
 * Server-only: both variables are secrets-adjacent (the key especially) and
 * must never be `VITE_`-prefixed into a client bundle.
 */

export type RenderFunctionMime = 'application/pdf' | 'image/png' | 'image/jpeg'

export interface RenderFunctionRequest {
  action: 'pdf' | 'png' | 'jpeg'
  html: string
  /**
   * PDF only: 'a4', 'thermal' (100×150 mm label), or a page size in pixels
   * (AI Studio carousels: one page per slide).
   */
  size?: 'a4' | 'thermal' | { width: number; height: number }
  /** PNG/JPEG only: capture viewport; the function clamps it. */
  viewport?: { width: number; height: number }
  /** JPEG only: 40–100, default 90. */
  quality?: number
  /**
   * PNG/JPEG only: capture at this fraction of the viewport (0.1–1, default
   * 1) — the page lays out at full size, the bitmap is smaller.
   */
  scale?: number
}

/** Returned on success — `bytes` is a fresh copy on its own `ArrayBuffer`. */
export interface RenderFunctionResult {
  mime: RenderFunctionMime
  bytes: Uint8Array<ArrayBuffer>
}

const MIME_FOR_ACTION: Record<RenderFunctionRequest['action'], RenderFunctionMime> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpeg: 'image/jpeg',
}

interface RenderFunctionConfig {
  url: string
  key: string
}

/** `null` when the deployment renders locally instead of in the Function. */
export function renderFunctionConfig(): RenderFunctionConfig | null {
  const url = (process.env.RENDER_FUNCTION_URL ?? '').trim().replace(/\/+$/, '')
  const key = (process.env.RENDER_FUNCTION_KEY ?? '').trim()
  if (!url || !key) return null
  return { url, key }
}

interface RenderFunctionResponse {
  ok: boolean
  mime?: RenderFunctionMime
  data?: string
  error?: string
}

export async function renderViaFunction(
  request: RenderFunctionRequest,
): Promise<RenderFunctionResult> {
  const config = renderFunctionConfig()
  if (!config) throw new Error('Render function is not configured on this deployment.')

  let response: Response
  try {
    response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-render-key': config.key,
      },
      body: JSON.stringify(request),
      // Renderer cold start + render stays far below the function's own
      // 300 s timeout; this only bounds a hung network call.
      signal: AbortSignal.timeout(150_000),
    })
  } catch (error) {
    throw new Error(
      `Could not reach the render function: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  let payload: RenderFunctionResponse
  try {
    payload = (await response.json()) as RenderFunctionResponse
  } catch {
    throw new Error(`Render function answered ${response.status} with a non-JSON body.`)
  }
  if (!response.ok || !payload.ok || typeof payload.data !== 'string') {
    throw new Error(payload.error || `Render function failed with status ${response.status}.`)
  }
  // atob rather than Buffer: this package has no @types/node and the helper
  // runs in whatever server runtime the app deploys to.
  const binary = atob(payload.data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return {
    mime: payload.mime ?? MIME_FOR_ACTION[request.action],
    bytes,
  }
}
