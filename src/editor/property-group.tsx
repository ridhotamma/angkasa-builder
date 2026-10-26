/**
 * One collapsible group in an editor's property panel.
 *
 * The same accordion the theme settings use: a compact heading, its controls,
 * and a line of context inside the body rather than under the heading. Shared
 * by the page builder and the print designers so their settings panels read as
 * one editor.
 */

import { Accordion, Stack, Text } from '@chakra-ui/react'
import type { ReactNode } from 'react'

export function PropertyGroup({
  value,
  title,
  helper,
  children,
}: {
  value: string
  title: string
  /** A line of context under the heading, inside the group. */
  helper?: string
  children: ReactNode
}) {
  return (
    <Accordion.Item value={value} borderBottomWidth="1px" borderColor="border.subtle">
      <Accordion.ItemTrigger py="3" cursor="pointer">
        <Text flex="1" fontSize="sm" fontWeight="medium">
          {title}
        </Text>
        <Accordion.ItemIndicator />
      </Accordion.ItemTrigger>
      <Accordion.ItemContent>
        <Accordion.ItemBody pt="0" pb="5">
          <Stack gap="4">
            {helper && (
              <Text fontSize="xs" color="fg.muted">
                {helper}
              </Text>
            )}
            {children}
          </Stack>
        </Accordion.ItemBody>
      </Accordion.ItemContent>
    </Accordion.Item>
  )
}
