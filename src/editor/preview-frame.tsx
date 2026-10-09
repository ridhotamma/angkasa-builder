/**
 * The editor's preview, in an iframe the width of the chosen device.
 *
 * An iframe, and not a narrower box, because a storefront is laid out by
 * media queries — every responsive style prop is one — and a media query
 * measures its window, not its container. Inside the iframe the window *is*
 * the device: a phone preview gets the phone layout, `100svh` is one phone
 * screen, a sticky header sticks to the preview's own top.
 *
 * The content is not a second React app. It is a portal from the editor's
 * tree into the iframe's body, so it shares the editor's state and handlers;
 * Emotion writes its styles into the iframe's head through a cache of its
 * own, and `EnvironmentProvider` points Chakra's overlays and machines
 * (carousels, marquees, dialogs) at the iframe's document and window.
 */

import createCache from '@emotion/cache'
import { CacheProvider } from '@emotion/react'
import { Box, ChakraProvider, EnvironmentProvider, useChakraContext } from '@chakra-ui/react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export const PREVIEW_DEVICES = {
  desktop: { width: 1280, label: 'desktop' },
  tablet: { width: 820, label: 'tablet' },
  mobile: { width: 390, label: 'mobile' },
} as const

export type PreviewDevice = keyof typeof PREVIEW_DEVICES

const DOCUMENT =
  '<!doctype html><html><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1"></head>' +
  '<body style="margin:0"></body></html>'

let frames = 0

export function PreviewFrame({
  device,
  mode,
  fontHref,
  onDocument,
  children,
}: {
  device: PreviewDevice
  /** The colour mode the preview paints: the iframe's own light/dark switch. */
  mode: 'light' | 'dark'
  /** The theme's Google Fonts stylesheet, which must load inside the frame too. */
  fontHref: string
  /** The iframe's document once it is ready, for scrolling a section into view. */
  onDocument?: (document: Document | null) => void
  children: ReactNode
}) {
  const system = useChakraContext()
  const outer = useRef<HTMLDivElement>(null)
  const [frame, setFrame] = useState<HTMLIFrameElement | null>(null)
  const [doc, setDoc] = useState<Document | null>(null)
  const [available, setAvailable] = useState({ width: 0, height: 0 })
  // Emotion keys are lower-case letters and dashes only: number the frames in letters.
  const key = useMemo(() => {
    let n = ++frames
    let letters = ''
    while (n > 0) {
      letters = String.fromCharCode(97 + ((n - 1) % 26)) + letters
      n = Math.floor((n - 1) / 26)
    }
    return `pb-preview-${letters}`
  }, [])

  // The iframe's document exists once `srcDoc` has loaded; before that there
  // is nothing to portal into.
  useEffect(() => {
    if (!frame) return
    const ready = () => {
      const next = frame.contentDocument
      if (next?.body) setDoc(next)
    }
    ready()
    frame.addEventListener('load', ready)
    return () => frame.removeEventListener('load', ready)
  }, [frame])

  useEffect(() => {
    onDocument?.(doc)
    return () => onDocument?.(null)
  }, [doc, onDocument])

  // The storefront and this frame both key their mode CSS off `.dark` on the
  // document root, so the toolbar's switch toggles exactly what the live
  // switch would — including the soft/inverse scheme bands.
  useEffect(() => {
    if (!doc) return
    doc.documentElement.classList.toggle('dark', mode === 'dark')
    doc.documentElement.style.colorScheme = mode
  }, [doc, mode])

  // Fonts are a `<link>` the editor's React tree cannot hoist into the frame.
  useEffect(() => {
    if (!doc) return
    const link = doc.createElement('link')
    link.rel = 'stylesheet'
    link.href = fontHref
    doc.head.appendChild(link)
    return () => link.remove()
  }, [doc, fontHref])

  const cache = useMemo(
    // Appended, in order: Chakra's cascade layers are ordered by where they
    // first appear, and prepending would put the reset after the recipes.
    () => (doc ? createCache({ key, container: doc.head }) : null),
    [doc, key],
  )

  // The space the preview has. A device wider than that is scaled down to
  // fit, so "desktop" is always a desktop layout rather than whatever width
  // the editor happens to leave for it.
  useEffect(() => {
    const element = outer.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      setAvailable({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const target = PREVIEW_DEVICES[device].width
  const fit = device === 'desktop' ? Math.max(target, 1024) : target
  const scale = available.width > 0 && fit > available.width ? available.width / fit : 1
  const width = device === 'desktop' && scale === 1 ? available.width : fit
  const height = available.height > 0 ? available.height / scale : 0
  const framed = device !== 'desktop'

  return (
    <Box ref={outer} position="relative" w="full" h="full" minH="0" overflow="hidden" bg="bg.muted">
      <Box
        position="absolute"
        top="0"
        left="50%"
        style={{
          width: `${width}px`,
          height: `${height}px`,
          transform: `translateX(-50%) scale(${scale})`,
          transformOrigin: 'top center',
        }}
        {...(framed && { borderInlineWidth: '1px', borderColor: 'border', shadow: 'lg' })}
        bg="white"
      >
        <iframe
          ref={setFrame}
          title="Preview"
          srcDoc={DOCUMENT}
          style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
        />
      </Box>
      {doc &&
        cache &&
        // Only once the frame has its size: sections measure their window as
        // they mount (scroll reveal, breakpoints), and a 0×0 frame misleads them.
        height > 0 &&
        createPortal(
          <CacheProvider value={cache}>
            <EnvironmentProvider value={() => doc}>
              <ChakraProvider value={system}>{children}</ChakraProvider>
            </EnvironmentProvider>
          </CacheProvider>,
          doc.body,
        )}
    </Box>
  )
}
