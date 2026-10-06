/**
 * The pieces every editor's header bar is built from, so the theme, page and
 * template editors read the same way:
 *
 *     ● Unsaved changes   [⚙ Settings]   Save   [Publish]   [⋯]
 *
 * Only what needs attention is shown: the unsaved dot appears when there is
 * something unsaved, and anything used now and then (view the storefront,
 * unpublish, go back to the default) lives in the "more" menu rather than as
 * a button of its own.
 */

import {
  Box,
  Button,
  CloseButton,
  Drawer,
  HStack,
  IconButton,
  Link as ChakraLink,
  Menu,
  Portal,
  Text,
  useBreakpointValue,
} from '@chakra-ui/react'
import { type ReactNode } from 'react'
import { LuEllipsisVertical, LuSettings2 } from 'react-icons/lu'

import { Tooltip } from '@repo/theme'

import { useEditorText } from './messages'

/** A dot and "Unsaved changes" while the draft differs from what was saved; nothing otherwise. */
export function UnsavedIndicator({ dirty }: { dirty: boolean }) {
  const { t } = useEditorText()
  if (!dirty) return null
  return (
    <HStack gap="1.5" color="fg.muted" display={{ base: 'none', md: 'flex' }}>
      <Box boxSize="2" rounded="full" bg="warning.solid" />
      <Text fontSize="xs">{t('unsaved')}</Text>
    </HStack>
  )
}

export interface EditorMenuItem {
  value: string
  label: string
  icon?: ReactNode
  /** Opens in a new tab instead of running `onSelect`. */
  href?: string
  onSelect?: () => void
  danger?: boolean
  hidden?: boolean
  disabled?: boolean
}

/** The header's "⋯" menu. Renders nothing when every item is hidden. */
export function EditorMenu({ items }: { items: EditorMenuItem[] }) {
  const { t } = useEditorText()
  const visible = items.filter((item) => !item.hidden)
  if (visible.length === 0) return null

  return (
    <Menu.Root
      positioning={{ placement: 'bottom-end' }}
      onSelect={({ value }) => visible.find((item) => item.value === value)?.onSelect?.()}
    >
      <Menu.Trigger asChild>
        <IconButton aria-label={t('moreActions')} size="sm" variant="ghost">
          <LuEllipsisVertical />
        </IconButton>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW="52">
            {visible.map((item) =>
              item.href ? (
                <Menu.Item key={item.value} value={item.value} asChild>
                  <ChakraLink unstyled href={item.href} target="_blank" rel="noopener noreferrer">
                    {item.icon}
                    {item.label}
                  </ChakraLink>
                </Menu.Item>
              ) : (
                <Menu.Item
                  key={item.value}
                  value={item.value}
                  disabled={item.disabled}
                  color={item.danger ? 'danger.fg' : undefined}
                  _hover={item.danger ? { bg: 'danger.subtle', color: 'danger.fg' } : undefined}
                >
                  {item.icon}
                  {item.label}
                </Menu.Item>
              ),
            )}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  )
}

/**
 * The header's settings (page or article details, theme name and status), in a
 * drawer: from the side on a wide screen, from the bottom on a phone, where the
 * header's buttons fold into the "⋯" menu and a menu item opens it instead.
 * Driven by `open` either way.
 *
 * A drawer and not a popover. The editor is a modal dialog, and a popover
 * portalled out of it sits outside the dialog's focus trap: every field in it
 * gave its focus straight back, so nothing could be typed. A drawer is a dialog
 * of its own, which the trap hands over to, like the unsaved-changes question.
 * It also scrolls, so a long form (an article's nine fields) fits a short
 * screen.
 */
export function EditorSettings({
  label,
  open,
  onOpenChange,
  children,
}: {
  label: string
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}) {
  const { t } = useEditorText()
  const phone = useBreakpointValue({ base: true, md: false }, { ssr: false }) ?? false

  return (
    <>
      <Tooltip content={label}>
        <Button
          aria-label={label}
          size="sm"
          variant="ghost"
          hideBelow="md"
          onClick={() => onOpenChange(true)}
        >
          <LuSettings2 />
          <Box as="span" hideBelow="xl">
            {label}
          </Box>
        </Button>
      </Tooltip>
      <Drawer.Root
        open={open}
        onOpenChange={({ open: next }) => onOpenChange(next)}
        placement={phone ? 'bottom' : 'end'}
        size={phone ? 'full' : 'md'}
      >
        <Portal>
          <Drawer.Backdrop />
          <Drawer.Positioner>
            <Drawer.Content {...(phone && { roundedTop: 'l3', maxH: '90dvh', h: 'auto' })}>
              <Drawer.Header borderBottomWidth="1px" borderColor="border.subtle">
                <Drawer.Title fontSize="md">{label}</Drawer.Title>
              </Drawer.Header>
              <Drawer.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Drawer.CloseTrigger>
              <Drawer.Body py="5">{children}</Drawer.Body>
              <Drawer.Footer borderTopWidth="1px" borderColor="border.subtle">
                <Button
                  colorPalette="brand"
                  w={{ base: 'full', md: 'auto' }}
                  onClick={() => onOpenChange(false)}
                >
                  {t('done')}
                </Button>
              </Drawer.Footer>
            </Drawer.Content>
          </Drawer.Positioner>
        </Portal>
      </Drawer.Root>
    </>
  )
}
