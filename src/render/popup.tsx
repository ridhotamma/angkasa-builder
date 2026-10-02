/**
 * The site popup: one theme setting, four behaviours — a welcome offer after
 * a delay, an exit-intent offer, an age gate, or a cookie notice bar.
 *
 * Off by default. Shown once per session unless the seller unchecks it, and
 * never stored anywhere: dismissing a cookie bar only remembers the choice in
 * `sessionStorage`, no collection, no consent database. The editor never
 * mounts it on load; the Theme tab's replay button renders it on demand.
 */

import { Box, Button, CloseButton, Dialog, Flex, Heading, Stack, Text } from '@chakra-ui/react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { resolveScheme, schemeCssVars, type ThemeSettings } from '../model/settings'
import { schemeCss } from './frame'

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

function storageKey(kind: string) {
  return `pb-popup:${kind}`
}

export function SitePopup({
  settings,
  replay = false,
  onDone,
}: {
  settings: ThemeSettings
  /** The editor's replay: opens immediately, ignores session storage. */
  replay?: boolean
  onDone?: () => void
}) {
  const popup = settings.popup
  // The cookie bar is the one popup that must also exist without JavaScript,
  // so it renders on the server and hides itself on mount when already seen.
  const [open, setOpen] = useState(replay || popup.kind === 'cookie')
  const [dismissed, setDismissed] = useState(false)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useIsoLayoutEffect(() => {
    if (replay || popup.kind === 'none') return
    const view = globalThis.window
    if (!view) return
    try {
      if (popup.oncePerSession && view.sessionStorage.getItem(storageKey(popup.kind)) === '1') {
        setDismissed(true)
        return
      }
    } catch {
      // Private mode: show it.
    }
    if (popup.kind === 'exit') {
      const onLeave = (event: MouseEvent) => {
        if (event.clientY <= 0) setOpen(true)
      }
      view.document.addEventListener('mouseout', onLeave)
      return () => view.document.removeEventListener('mouseout', onLeave)
    }
    if (popup.kind === 'cookie') {
      setOpen(true)
      return
    }
    const timer = view.setTimeout(() => setOpen(true), popup.delaySeconds * 1000)
    return () => view.clearTimeout(timer)
  }, [popup.kind, popup.delaySeconds, popup.oncePerSession, replay])

  if (popup.kind === 'none' || dismissed || (!open && !replay)) return null

  const close = () => {
    setOpen(false)
    setDismissed(true)
    onDoneRef.current?.()
    try {
      globalThis.window?.sessionStorage.setItem(storageKey(popup.kind), '1')
    } catch {
      // Nothing to remember.
    }
  }

  const scheme =
    popup.tone === 'page'
      ? null
      : { key: popup.tone === 'dark' ? ('inverse' as const) : ('brand' as const) }
  const vars = scheme ? schemeCssVars(resolveScheme(settings, scheme.key)) : null
  const toneCss = scheme && vars ? (schemeCss(scheme.key, vars) as Record<string, unknown>) : {}

  if (popup.kind === 'cookie') {
    return (
      <Box
        data-popup="cookie"
        position="fixed"
        insetX="0"
        bottom="0"
        zIndex="2000"
        bg="bg"
        color="fg"
        borderTopWidth="1px"
        borderColor="border"
        css={toneCss}
        px={{ base: '4', md: '6' }}
        py="3"
      >
        <Flex
          maxW="6xl"
          mx="auto"
          gap="4"
          align={{ base: 'flex-start', md: 'center' }}
          direction={{ base: 'column', md: 'row' }}
        >
          <Text fontSize="sm" flex="1">
            {popup.body || popup.title}
          </Text>
          <Button size="sm" colorPalette="brand" onClick={close}>
            {popup.buttonLabel}
          </Button>
        </Flex>
      </Box>
    )
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={({ open: next }) => {
        // An age gate is answered, never dismissed by tapping away.
        if (!next && popup.kind !== 'age') close()
      }}
      size="md"
      placement="center"
      role={popup.kind === 'age' ? 'alertdialog' : 'dialog'}
    >
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content data-popup={popup.kind} bg="bg" color="fg" css={toneCss}>
          <Stack gap="4" p={{ base: '6', md: '8' }} align="center" textAlign="center">
            <Heading as="h2" size="2xl" letterSpacing="-0.02em">
              {popup.title}
            </Heading>
            {popup.body && <Text color="fg.muted">{popup.body}</Text>}
            <Button colorPalette="brand" size="lg" onClick={close}>
              {popup.buttonLabel}
            </Button>
          </Stack>
          {popup.kind !== 'age' && (
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" top="2" right="2" />
            </Dialog.CloseTrigger>
          )}
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  )
}
