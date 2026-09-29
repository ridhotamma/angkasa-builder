/**
 * The pieces every editor's header bar is built from, so the theme, page and
 * template editors read the same way:
 *
 *     ● Unsaved changes   [⚙]  [⋯]   Save   [Publish]
 *
 * Only what needs attention is shown: the unsaved dot appears when there is
 * something unsaved, and anything used now and then (view the storefront,
 * unpublish, go back to the default) lives in the "more" menu rather than as
 * a button of its own.
 */

import {
  Box,
  CloseButton,
  Dialog,
  HStack,
  IconButton,
  Link as ChakraLink,
  Menu,
  Popover,
  Portal,
  Text,
  useBreakpointValue,
} from '@chakra-ui/react'
import { useId, type ReactNode } from 'react'
import { LuEllipsis, LuSettings2 } from 'react-icons/lu'

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
          <LuEllipsis />
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
 * The header's settings (page details, theme name and status): a popover under
 * a gear button on a wide screen, and a dialog on a phone, where the buttons
 * fold into the "⋯" menu and there is no gear to anchor a popover to. Both are
 * driven by `open`, so a menu item can open it.
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
  const triggerId = useId()
  const phone = useBreakpointValue({ base: true, md: false }, { ssr: false }) ?? false

  if (phone) {
    return (
      <Dialog.Root
        open={open}
        onOpenChange={({ open: next }) => onOpenChange(next)}
        placement="center"
        scrollBehavior="inside"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner p="3">
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title fontSize="md">{label}</Dialog.Title>
                <Dialog.CloseTrigger asChild>
                  <CloseButton size="sm" />
                </Dialog.CloseTrigger>
              </Dialog.Header>
              <Dialog.Body pb="5">{children}</Dialog.Body>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    )
  }

  return (
    <Popover.Root
      ids={{ trigger: triggerId }}
      positioning={{ placement: 'bottom-end' }}
      open={open}
      onOpenChange={({ open: next }) => onOpenChange(next)}
    >
      <Tooltip content={label} triggerId={triggerId}>
        <Popover.Trigger asChild>
          <IconButton aria-label={label} size="sm" variant="ghost">
            <LuSettings2 />
          </IconButton>
        </Popover.Trigger>
      </Tooltip>
      <Portal>
        <Popover.Positioner>
          <Popover.Content w="md">
            <Popover.Arrow />
            <Popover.Body>{children}</Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  )
}
