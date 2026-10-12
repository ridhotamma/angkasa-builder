/**
 * The editor's frame: a full-screen dialog over the dashboard.
 *
 * Full screen because the editor is two panes side by side — the section list
 * and a storefront-width preview — and inside the dashboard's own sidebar and
 * header neither had room. The header bar carries what the page header used
 * to: a close button, the title, status badges and the save/publish actions.
 *
 * Closing — the X, Escape — never throws work away silently. With unsaved
 * changes it asks first: keep editing, or discard. Saving lives in the
 * header bar; this question deliberately offers no save shortcut.
 */

import {
  Box,
  Button,
  CloseButton,
  Dialog,
  Flex,
  HStack,
  IconButton,
  Portal,
  ScrollArea,
  Text,
} from '@chakra-ui/react'
import { createContext, useContext, useState, type ReactNode } from 'react'
import { LuX } from 'react-icons/lu'

import { EditorMenu, type EditorMenuItem } from './actions'
import { useEditorText } from './messages'

/**
 * The strip under the dialog's scrolling body, for what must stay on screen
 * while the editor scrolls — the phone's "view preview" button. It lives
 * outside the scroll area rather than sticking inside it, so nothing scrolls
 * under it. `null` outside a `BuilderDialog`, or before the strip mounts.
 */
const FooterSlot = createContext<HTMLElement | null>(null)

export function useBuilderDialogFooter(): HTMLElement | null {
  return useContext(FooterSlot)
}

export interface BuilderDialogProps {
  title: ReactNode
  /** Beside the title: status badges, a URL. */
  meta?: ReactNode
  /** Right of the header bar: save, publish, view storefront. */
  actions?: ReactNode
  /**
   * The same actions as a phone's "⋯" menu. Given, the bar shows `actions` from
   * `md` up and only this menu below it, so the title keeps the whole bar.
   */
  menu?: EditorMenuItem[]
  /** The draft differs from what was last saved. */
  dirty: boolean
  /** Called once the editor may actually close — after discarding. */
  onClose: () => void
  children: ReactNode
}

export function BuilderDialog({
  title,
  meta,
  actions,
  menu,
  dirty,
  onClose,
  children,
}: BuilderDialogProps) {
  const { t } = useEditorText()
  const [confirming, setConfirming] = useState(false)
  const [footer, setFooter] = useState<HTMLDivElement | null>(null)

  function requestClose() {
    if (dirty) {
      setConfirming(true)
    } else {
      onClose()
    }
  }

  return (
    <Dialog.Root
      open
      size="full"
      motionPreset="none"
      // Escape and the close button both land here; the dialog itself never
      // closes on its own.
      onOpenChange={({ open }) => {
        if (!open) requestClose()
      }}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content rounded="none" display="flex" flexDirection="column" h="100dvh">
            <Flex
              as="header"
              align="center"
              gap="3"
              px={{ base: '3', md: '5' }}
              py="2.5"
              borderBottomWidth="1px"
              borderColor="border.subtle"
            >
              <IconButton
                aria-label={t('close')}
                variant="ghost"
                size="sm"
                flexShrink="0"
                onClick={requestClose}
              >
                <LuX />
              </IconButton>
              {/* One row that never wraps: the title, then its status badge right
                  beside it, then the actions. The title takes what room there is
                  and truncates; the badge keeps its size. */}
              <Flex flex="1" minW="0" align="center" gap="2">
                <Dialog.Title fontSize="md" truncate minW="0">
                  {title}
                </Dialog.Title>
                <HStack gap="2" flexShrink="0">
                  {meta}
                </HStack>
              </Flex>
              {menu ? (
                <>
                  <Box flexShrink="0" hideBelow="md">
                    {actions}
                  </Box>
                  <Box flexShrink="0" hideFrom="md">
                    <EditorMenu items={menu} />
                  </Box>
                </>
              ) : (
                <Box flexShrink="0">{actions}</Box>
              )}
            </Flex>

            <Dialog.Body flex="1" minH="0" p="0" display="flex">
              {/* On a wide screen the body is exactly the screen and the two
                  panes scroll themselves; on a narrow one they stack, and the
                  whole body scrolls instead. */}
              <ScrollArea.Root size="xs" flex="1" minH="0">
                <ScrollArea.Viewport>
                  <ScrollArea.Content
                    display="flex"
                    flexDirection="column"
                    gap="4"
                    h={{ lg: 'full' }}
                    px={{ base: '3', md: '5' }}
                    py="4"
                    // Vertical scrolling only — see the panel in `builder.tsx`.
                    style={{ minWidth: 0 }}
                  >
                    <FooterSlot.Provider value={footer}>{children}</FooterSlot.Provider>
                  </ScrollArea.Content>
                </ScrollArea.Viewport>
                <ScrollArea.Scrollbar />
              </ScrollArea.Root>
            </Dialog.Body>

            {/* Empty — and so out of the layout — until something is portalled in. */}
            <Box
              ref={setFooter}
              flexShrink="0"
              px={{ base: '3', md: '5' }}
              pt="3"
              pb="calc(var(--chakra-spacing-3) + env(safe-area-inset-bottom))"
              borderTopWidth="1px"
              borderColor="border.subtle"
              bg="bg.panel"
              _empty={{ display: 'none' }}
            />

            <Dialog.Root
              open={confirming}
              role="alertdialog"
              placement="center"
              onOpenChange={({ open }) => {
                if (!open) setConfirming(false)
              }}
            >
              <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner p={{ base: '3', sm: '4' }}>
                  <Dialog.Content>
                    <Dialog.Header>
                      <Dialog.Title fontSize="md">{t('unsavedTitle')}</Dialog.Title>
                      <Dialog.CloseTrigger asChild>
                        <CloseButton size="sm" />
                      </Dialog.CloseTrigger>
                    </Dialog.Header>
                    <Dialog.Body>
                      <Text fontSize="sm" color="fg.muted">
                        {t('unsavedBody')}
                      </Text>
                    </Dialog.Body>
                    {/* Two buttons: side by side on a desktop, stacked full
                        width on a phone. */}
                    <Dialog.Footer
                      flexDirection={{ base: 'column', sm: 'row' }}
                      alignItems={{ base: 'stretch', sm: 'center' }}
                      justifyContent={{ sm: 'flex-end' }}
                    >
                      <Button variant="ghost" onClick={() => setConfirming(false)}>
                        {t('keepEditing')}
                      </Button>
                      <Button
                        variant="outline"
                        colorPalette="danger"
                        onClick={() => {
                          setConfirming(false)
                          onClose()
                        }}
                      >
                        {t('discard')}
                      </Button>
                    </Dialog.Footer>
                  </Dialog.Content>
                </Dialog.Positioner>
              </Portal>
            </Dialog.Root>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
