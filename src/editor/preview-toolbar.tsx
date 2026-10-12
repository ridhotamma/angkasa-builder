/**
 * The bar above the preview: the device switch, undo and redo, the preview's
 * colour mode, and whatever the screen adds (`toolbar`).
 *
 * Memoized by the caller: its tooltips and segment group are not cheap, and
 * nothing in it changes while a section is typed into.
 */

import { Box, Flex, HStack, Icon, IconButton, SegmentGroup, Separator, Text } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import {
  LuMonitor,
  LuMoon,
  LuRedo2,
  LuSmartphone,
  LuSun,
  LuTablet,
  LuUndo2,
} from 'react-icons/lu'

import { Tooltip } from '@repo/theme'

import type { EditorHistory } from './history'
import { useEditorText } from './messages'
import type { PreviewDevice } from './preview-frame'

const DEVICES = [
  ['desktop', LuMonitor, 'deviceDesktop'],
  ['tablet', LuTablet, 'deviceTablet'],
  ['mobile', LuSmartphone, 'deviceMobile'],
] as const

export function PreviewToolbar({
  device,
  onDeviceChange,
  mode,
  onModeChange,
  history,
  note,
  toolbar,
}: {
  device: PreviewDevice
  onDeviceChange: (device: PreviewDevice) => void
  mode: 'light' | 'dark'
  onModeChange: (mode: 'light' | 'dark') => void
  history?: EditorHistory
  /** Said in the middle of the bar, e.g. which theme the page is drawn in. */
  note?: string
  toolbar?: ReactNode
}) {
  const { t } = useEditorText()
  const modeLabel = mode === 'dark' ? t('previewLight') : t('previewDark')

  return (
    <Flex align="center" gap="3" minW="0">
      <SegmentGroup.Root
        size="xs"
        flexShrink="0"
        value={device}
        onValueChange={({ value }) => value && onDeviceChange(value as PreviewDevice)}
      >
        <SegmentGroup.Indicator />
        {DEVICES.map(([value, glyph, label]) => (
          <Tooltip key={value} content={t(label)}>
            <SegmentGroup.Item value={value} aria-label={t(label)}>
              <SegmentGroup.ItemText>
                <Icon as={glyph} boxSize="3.5" />
              </SegmentGroup.ItemText>
              <SegmentGroup.ItemHiddenInput />
            </SegmentGroup.Item>
          </Tooltip>
        ))}
      </SegmentGroup.Root>

      {/* A spacer on a phone, where there is no room to say it. */}
      <Box flex="1" minW="0">
        <Text
          hideBelow="md"
          fontSize="xs"
          color="fg.muted"
          textAlign="center"
          truncate
          title={note ?? t('inlineHint')}
        >
          {note ?? t('inlineHint')}
        </Text>
      </Box>

      <HStack gap="0.5" flexShrink="0">
        {history && (
          <>
            <Tooltip content={`${t('undo')} (Ctrl+Z)`} wrap>
              <IconButton
                aria-label={t('undo')}
                size="xs"
                variant="ghost"
                disabled={!history.canUndo}
                onClick={history.undo}
              >
                <LuUndo2 />
              </IconButton>
            </Tooltip>
            <Tooltip content={`${t('redo')} (Ctrl+Shift+Z)`} wrap>
              <IconButton
                aria-label={t('redo')}
                size="xs"
                variant="ghost"
                disabled={!history.canRedo}
                onClick={history.redo}
              >
                <LuRedo2 />
              </IconButton>
            </Tooltip>
            <Separator orientation="vertical" h="4" mx="1" />
          </>
        )}
        <Tooltip content={modeLabel} wrap>
          <IconButton
            aria-label={modeLabel}
            size="xs"
            variant="ghost"
            onClick={() => onModeChange(mode === 'dark' ? 'light' : 'dark')}
          >
            <Icon as={mode === 'dark' ? LuSun : LuMoon} />
          </IconButton>
        </Tooltip>
      </HStack>

      {toolbar}
    </Flex>
  )
}
