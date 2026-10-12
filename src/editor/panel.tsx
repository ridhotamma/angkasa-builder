/**
 * The editor's side panels: a fixed header, a scrolling body and an optional
 * fixed footer. The section sidebar and the property inspector are both one.
 *
 * `fill` panels own their height and scroll inside it (beside the preview on
 * a wide screen). Without it the panel simply grows, and the screen around it
 * scrolls instead (the phone layout, inside the dialog's own scroll area).
 */

import { Box, Flex, HStack, Icon, IconButton, ScrollArea, Stack, Text } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import type { IconType } from 'react-icons'
import { LuChevronLeft, LuX } from 'react-icons/lu'

export function Panel({
  header,
  footer,
  fill,
  children,
}: {
  header?: ReactNode
  footer?: ReactNode
  fill: boolean
  children: ReactNode
}) {
  if (!fill) {
    return (
      <Stack gap="0" minW="0">
        {header}
        <Box px="4" py="4">
          {children}
        </Box>
        {footer && (
          <Box borderTopWidth="1px" borderColor="border.subtle">
            {footer}
          </Box>
        )}
      </Stack>
    )
  }
  return (
    <Flex direction="column" h="full" minH="0" minW="0">
      {header && <Box flexShrink="0">{header}</Box>}
      <ScrollArea.Root size="xs" flex="1" minH="0">
        <ScrollArea.Viewport>
          {/* Zag gives the content an inline `min-width: fit-content`, which
              lets one long line — a help text, a long caption typed into an
              input — push the whole panel wider than its column and clip the
              controls. The panel only ever scrolls vertically. */}
          <ScrollArea.Content px="4" py="4" style={{ minWidth: 0 }}>
            {children}
          </ScrollArea.Content>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar />
      </ScrollArea.Root>
      {footer && (
        <Box flexShrink="0" borderTopWidth="1px" borderColor="border.subtle">
          {footer}
        </Box>
      )}
    </Flex>
  )
}

/**
 * A panel's title bar: what is being edited, and a way back or out. Under the
 * title, still outside the scroll, sit the thing's own `actions` (a block's
 * move, copy and remove) and `tabs` (a section's Content / Style /
 * Visibility), so neither ever squeezes the title.
 */
export function PanelHeader({
  title,
  description,
  icon,
  back,
  close,
  actions,
  tabs,
}: {
  title: ReactNode
  description?: ReactNode
  icon?: IconType
  /** A step up: from a block to its section, or from a section to the list. */
  back?: { label: string; onClick: () => void }
  /** Out of the panel altogether: drops the selection. */
  close?: { label: string; onClick: () => void }
  actions?: ReactNode
  /** A `Tabs.List`, drawn flush with the header's bottom edge. */
  tabs?: ReactNode
}) {
  return (
    <Stack
      gap="3"
      px="4"
      pt="3"
      pb={tabs ? '0' : '3'}
      borderBottomWidth="1px"
      borderColor="border.subtle"
    >
      <Flex align="start" gap="2" minW="0">
        {back && (
          <IconButton
            aria-label={back.label}
            title={back.label}
            size="xs"
            variant="ghost"
            ms="-1.5"
            flexShrink="0"
            onClick={back.onClick}
          >
            <LuChevronLeft />
          </IconButton>
        )}
        {icon && (
          <Flex boxSize="6" align="center" justify="center" flexShrink="0" color="fg.muted">
            <Icon as={icon} boxSize="4" />
          </Flex>
        )}
        <Stack gap="0.5" flex="1" minW="0" pt="0.5">
          <Text fontSize="sm" fontWeight="semibold" lineHeight="short" truncate>
            {title}
          </Text>
          {description && (
            <Text fontSize="xs" color="fg.muted" lineClamp="2">
              {description}
            </Text>
          )}
        </Stack>
        {close && (
          <IconButton
            aria-label={close.label}
            title={close.label}
            size="xs"
            variant="ghost"
            me="-1.5"
            flexShrink="0"
            onClick={close.onClick}
          >
            <LuX />
          </IconButton>
        )}
      </Flex>
      {actions && <HStack gap="1">{actions}</HStack>}
      {tabs}
    </Stack>
  )
}
