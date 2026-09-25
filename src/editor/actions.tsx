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

import { Box, HStack, IconButton, Link as ChakraLink, Menu, Portal, Text } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { LuEllipsis } from 'react-icons/lu'

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
