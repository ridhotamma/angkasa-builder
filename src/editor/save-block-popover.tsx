/**
 * "Save as block" on a block's panel: name it, and it joins the saved blocks
 * the add palette and Ctrl+K offer — content, style and children included.
 */

import { Button, Field, IconButton, Input, Popover, Portal, Stack, Text } from '@chakra-ui/react'
import { useId, useState } from 'react'
import { LuBookmarkPlus } from 'react-icons/lu'

import { Tooltip } from '../ui'

import { MAX_BLOCK_NAME, type BlockValue } from '../model/fields'
import { useEditorText } from './messages'
import { saveBlock } from './saved-blocks'

export function SaveBlockPopover({
  block,
  fallbackName,
}: {
  block: BlockValue
  /** The name the field starts with when the block has none of its own. */
  fallbackName: string
}) {
  const { t } = useEditorText()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [status, setStatus] = useState<'idle' | 'saved' | 'failed'>('idle')
  // Shared by the popover and the tooltip on the one trigger (see `Tooltip`).
  const triggerId = `save-block-${useId()}`

  function save() {
    const ok = saveBlock(name || fallbackName, block)
    setStatus(ok ? 'saved' : 'failed')
    if (ok) setTimeout(() => setOpen(false), 900)
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={({ open: next }) => {
        setOpen(next)
        if (next) {
          setName(block.name?.trim() || fallbackName)
          setStatus('idle')
        }
      }}
      positioning={{ placement: 'bottom-start' }}
      ids={{ trigger: triggerId }}
    >
      {/* An icon beside the block's other actions, so the row never wraps. */}
      <Tooltip content={t('saveBlock')} triggerId={triggerId}>
        <Popover.Trigger asChild>
          <IconButton aria-label={t('saveBlock')} size="xs" variant="outline">
            <LuBookmarkPlus />
          </IconButton>
        </Popover.Trigger>
      </Tooltip>
      <Portal>
        <Popover.Positioner>
          <Popover.Content w="72">
            <Popover.Body p="3">
              <Stack gap="3">
                <Field.Root>
                  <Field.Label fontSize="sm">{t('saveBlockName')}</Field.Label>
                  <Input
                    size="sm"
                    autoFocus
                    value={name}
                    maxLength={MAX_BLOCK_NAME}
                    onChange={(event) => setName(event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        save()
                      }
                    }}
                  />
                </Field.Root>
                <Text fontSize="xs" color="fg.muted">
                  {t('saveBlockHelp')}
                </Text>
                {status !== 'idle' && (
                  <Text fontSize="xs" color={status === 'saved' ? 'success.fg' : 'danger.fg'}>
                    {status === 'saved' ? t('blockSaved') : t('blockSaveFailed')}
                  </Text>
                )}
                <Button
                  size="sm"
                  colorPalette="brand"
                  alignSelf="end"
                  disabled={status === 'saved'}
                  onClick={save}
                >
                  {t('saveBlockConfirm')}
                </Button>
              </Stack>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  )
}
