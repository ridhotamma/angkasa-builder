/**
 * What changes when a page is rendered for the framework-free runtime
 * (`RenderEnvironment.target === 'html'`) instead of for React hydration.
 *
 * Two things. A portal renders nothing on the server, so an overlay's content
 * (the phone menu, a dialog, a dropdown) would be missing from the HTML; here
 * it renders in place. And a lazily mounted part (a tab's panel, a popover)
 * would be missing until React opens it; here every part is in the markup,
 * hidden, for the runtime to show.
 */

import { Portal } from '@chakra-ui/react'
import type { ComponentProps } from 'react'

import { useOptionalRenderEnvironment } from './context'

/** Whether this render is for the framework-free runtime. */
export function useHtmlTarget(): boolean {
  return useOptionalRenderEnvironment()?.target === 'html'
}

/** A portal for React; the content in place for the HTML runtime. */
export function RenderPortal(props: ComponentProps<typeof Portal>) {
  const html = useHtmlTarget()
  return <Portal {...props} disabled={html || props.disabled} />
}

/**
 * An overlay's mount props: what the caller asks for under React, and every
 * part always in the markup under the HTML runtime.
 */
export function useMountProps(props: { lazyMount?: boolean; unmountOnExit?: boolean } = {}): {
  lazyMount?: boolean
  unmountOnExit?: boolean
} {
  const html = useHtmlTarget()
  return html ? { lazyMount: false, unmountOnExit: false } : props
}
