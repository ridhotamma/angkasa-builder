/**
 * A Chakra tooltip, in place of the browser's own `title` tooltip.
 *
 * `title` shows late, in the OS's font and colours, and never on touch or for
 * keyboard focus. This one follows the theme, opens on hover and focus, and
 * portals out so an `overflow: hidden` parent cannot clip it.
 *
 * It wraps one focusable child (usually an `IconButton`). A disabled button
 * gets no pointer events, so its tooltip would never open; pass `wrap` to put
 * the trigger on a span around it instead.
 *
 * Around a `Menu.Trigger` or `Popover.Trigger`, pass the same `triggerId`
 * as that root's `ids={{ trigger }}`. Both components stamp their own id and
 * `data-scope` on the one button; without a shared id the menu cannot find
 * its trigger, takes the click on it for a click outside, and closes the
 * moment it opens.
 */

import { Box, Portal, Tooltip as ChakraTooltip } from '@chakra-ui/react'
import type { ReactNode } from 'react'

export interface TooltipProps {
  content: ReactNode
  children: ReactNode
  /** Where it opens, relative to the trigger. */
  placement?: 'top' | 'bottom' | 'left' | 'right'
  /** Put the trigger on a wrapping span — needed around a disabled button. */
  wrap?: boolean
  /** Skip the tooltip and render the child alone. */
  disabled?: boolean
  showArrow?: boolean
  /** The id shared with a Menu or Popover whose trigger this wraps. */
  triggerId?: string
}

export function Tooltip({
  content,
  children,
  placement = 'top',
  wrap = false,
  disabled = false,
  showArrow = true,
  triggerId,
}: TooltipProps) {
  if (disabled || !content) return <>{children}</>
  return (
    <ChakraTooltip.Root
      openDelay={300}
      closeDelay={0}
      positioning={{ placement }}
      ids={triggerId ? { trigger: triggerId } : undefined}
    >
      <ChakraTooltip.Trigger asChild>
        {wrap ? (
          <Box as="span" display="inline-flex">
            {children}
          </Box>
        ) : (
          children
        )}
      </ChakraTooltip.Trigger>
      <Portal>
        <ChakraTooltip.Positioner>
          <ChakraTooltip.Content>
            {showArrow && (
              <ChakraTooltip.Arrow>
                <ChakraTooltip.ArrowTip />
              </ChakraTooltip.Arrow>
            )}
            {content}
          </ChakraTooltip.Content>
        </ChakraTooltip.Positioner>
      </Portal>
    </ChakraTooltip.Root>
  )
}
