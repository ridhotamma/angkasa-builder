/**
 * Screenshotting the snapshot document with a real browser engine.
 *
 * Same two-Chromium arrangement as the shipping-label PDF renderer in
 * `apps/admin` (`VITE` comment there explains why each branch exists the way
 * it does):
 *  - **Vercel** (`process.env.VERCEL === '1'`): `puppeteer-core` driving the
 *    serverless-packaged `@sparticuz/chromium` binary. Both are real
 *    dependencies here (not dev), because unlike local `puppeteer` they are
 *    needed inside the deployed function.
 *  - **Everywhere else** (local dev, VPS): full `puppeteer`, managing its own
 *    matching local browser. Imported through a non-literal specifier so a
 *    bundler never sees a static `import('puppeteer')` to trace into a deploy
 *    — and `puppeteer` stays a devDependency of each app for the same reason.
 *
 * Typed against `puppeteer-core`'s `Browser`/`Page` only — a type-only import
 * is erased at build time, so it carries none of that bundling risk, and
 * `puppeteer`'s browser is structurally the same type.
 *
 * Server-only, like the rest of `@repo/page-builder/snapshot`.
 */

import type { Browser, Page } from 'puppeteer-core'

/** The card the snapshot is shown in is 16:10, so capture exactly that. */
export const SNAPSHOT_VIEWPORT = { width: 1280, height: 800 } as const

async function launchBrowser(): Promise<Browser> {
  const ignoreCertificateErrors = ['--ignore-certificate-errors']
  if (process.env.VERCEL === '1') {
    const [{ default: chromium }, { default: puppeteerCore }] = await Promise.all([
      import('@sparticuz/chromium'),
      import('puppeteer-core'),
    ])
    return puppeteerCore.launch({
      args: [...chromium.args, ...ignoreCertificateErrors],
      executablePath: await chromium.executablePath(),
      headless: true,
    })
  }

  // A non-literal specifier so no bundler ever traces `puppeteer` into a
  // deploy — see the module doc comment above.
  const devOnlyPackage = 'puppeteer'
  const { default: puppeteer } = await import(devOnlyPackage)
  return puppeteer.launch({
    headless: true,
    args: ignoreCertificateErrors,
    executablePath: await findLocalChromeExecutable(),
  }) as Promise<Browser>
}

/**
 * Under Bun on Windows, full `puppeteer`'s own executable-path resolution
 * throws (`this.configuration.cacheDirectory` comes back `undefined`, so
 * `@puppeteer/browsers`'s `Cache` does `path.join(undefined, ...)`) even
 * though a browser is actually installed at the default location. Rather than
 * fight that resolution, this looks the installed browser up directly from
 * the same default `~/.cache/puppeteer` puppeteer's own download step already
 * wrote it to.
 */
async function findLocalChromeExecutable(): Promise<string | undefined> {
  const os = await import('node:os')
  const path = await import('node:path')
  const fs = await import('node:fs/promises')

  const chromeRoot = path.join(os.homedir(), '.cache', 'puppeteer', 'chrome')
  const platformPrefix =
    process.platform === 'win32' ? 'win64-' : process.platform === 'darwin' ? 'mac' : 'linux-'
  const binaryPath = (buildDir: string) =>
    process.platform === 'win32'
      ? path.join(chromeRoot, buildDir, 'chrome-win64', 'chrome.exe')
      : process.platform === 'darwin'
        ? path.join(
            chromeRoot,
            buildDir,
            `chrome-${buildDir.startsWith('mac-arm64') ? 'mac-arm64' : 'mac'}`,
            'Google Chrome for Testing.app',
            'Contents',
            'MacOS',
            'Google Chrome for Testing',
          )
        : path.join(chromeRoot, buildDir, 'chrome-linux64', 'chrome')

  try {
    const builds = (await fs.readdir(chromeRoot))
      .filter((name) => name.startsWith(platformPrefix))
      .sort()
    const newest = builds.at(-1)
    if (!newest) return undefined
    const executable = binaryPath(newest)
    await fs.access(executable)
    return executable
  } catch {
    return undefined
  }
}

/**
 * Let the page finish arriving before capturing: webfonts, every image, two
 * animation frames of paint, then a beat for late paints and video first
 * frames. Capped, so one stalled asset cannot hold a save hostage.
 */
async function waitForSnapshotReady(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const settled = (async () => {
      try {
        await (document as Document).fonts.ready
      } catch {
        /* offline or no webfonts — fall back to system stacks */
      }
      const images = [...document.images]
      await Promise.all(
        images.map((image) =>
          image.complete
            ? undefined
            : new Promise<void>((resolve) => {
                image.onload = image.onerror = () => resolve()
                setTimeout(() => resolve(), 4000)
              }),
        ),
      )
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    })()
    const cap = new Promise<void>((resolve) => setTimeout(() => resolve(), 12_000))
    await Promise.race([settled, cap])
  })
  await new Promise((resolve) => setTimeout(resolve, 600))
}

/**
 * Capture the above-the-fold viewport of a snapshot document as a PNG — the
 * Vercel/Netlify-style website snapshot shown on a template card.
 */
export async function screenshotHtml(
  html: string,
  viewport: { width: number; height: number } = { ...SNAPSHOT_VIEWPORT },
): Promise<Uint8Array<ArrayBuffer>> {
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 })
    await page.setContent(html, { waitUntil: 'domcontentloaded' })
    await waitForSnapshotReady(page)
    const shot = await page.screenshot({ type: 'png' })
    // A fresh copy on its own `ArrayBuffer`: what Puppeteer hands back can
    // ride on a pooled buffer, which `File`'s `BlobPart` typing refuses.
    return Uint8Array.from(shot instanceof Uint8Array ? shot : new Uint8Array(shot))
  } finally {
    await browser.close()
  }
}
