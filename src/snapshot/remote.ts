/**
 * Call the `render` Appwrite Function: HTML in, rendered bytes out.
 *
 * Single implementation shared by `screenshotHtml` (this package) and the
 * admin's `renderHtmlToPdf` — one contract, one auth scheme, one timeout.
 *
 * Routing: when `RENDER_FUNCTION_URL` **and** `RENDER_FUNCTION_KEY` are set
 * (every deployed environment), rendering happens in the Function and the
 * apps never launch a browser. When either is unset (local dev), callers
 * take their local-Chromium branch instead. Nothing here launches anything.
 *
 * Server-only: both variables are secrets-adjacent (the key especially) and
 * must never be `VITE_`-prefixed into a client bundle.
 */

export interface RenderFunctionRequest {
  action: 'pdf' | 'png'
  html: string
  /** PDF only: 'a4' or 'thermal' (100×150 mm label). */
  size?: 'a4' | 'thermal'
  /** PNG only: capture viewport; the function clamps it. */
  viewport?: { width: number; height: number }
}

/** Returned on success — `bytes` is a fresh copy on its own `ArrayBuffer`. */
export interface RenderFunctionResult {
  mime: 'application/pdf' | 'image/png'
  bytes: Uint8Array<ArrayBuffer>
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
  mime?: 'application/pdf' | 'image/png'
  data?: string
  error?: string
}

export async function renderViaFunction(request: RenderFunctionRequest): Promise<RenderFunctionResult> {
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
      // Chromium cold start + render stays far below the function's own
      // 180 s timeout; this only bounds a hung network call.
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
    mime: payload.mime ?? (request.action === 'png' ? 'image/png' : 'application/pdf'),
    bytes,
  }
}
