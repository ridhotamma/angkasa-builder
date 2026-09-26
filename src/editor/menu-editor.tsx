/**
 * Editing a navigation menu: labelled links, nested up to three levels.
 *
 * Controlled like the rest of the editor — every change hands up a new list.
 * Links use the same picker as a section's button, so a menu entry can point
 * only where a button can.
 */

import { Box, Button, Collapsible, HStack, Icon, IconButton, Input, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import {
  LuArrowDown,
  LuArrowUp,
  LuChevronDown,
  LuChevronRight,
  LuCornerDownRight,
  LuPlus,
  LuTrash2,
} from 'react-icons/lu'

import { newId } from '../model/fields'
import { NO_LINK } from '../model/links'
import {
  MAX_MENU_DEPTH,
  MAX_MENU_ITEMS_PER_LEVEL,
  MAX_MENU_LABEL,
  type MenuItem,
} from '../model/menus'
import { Labeled, LinkControl } from './controls'
import { useEditorText } from './messages'
import type { EditorServices } from './services'

function newItem(label: string): MenuItem {
  return { id: newId(), label, link: NO_LINK, children: [] }
}

function Items({
  items,
  onChange,
  depth,
  services,
  open,
  setOpen,
}: {
  items: MenuItem[]
  onChange: (items: MenuItem[]) => void
  depth: number
  services: EditorServices
  open: string | null
  setOpen: (id: string | null) => void
}) {
  const { t } = useEditorText()

  const update = (id: string, next: Partial<MenuItem>) =>
    onChange(items.map((item) => (item.id === id ? { ...item, ...next } : item)))

  const move = (index: number, by: number) => {
    const next = [...items]
    const [item] = next.splice(index, 1)
    next.splice(index + by, 0, item!)
    onChange(next)
  }

  return (
    <Stack gap="1.5">
      {items.map((item, index) => {
        const expanded = open === item.id
        return (
          <Box key={item.id}>
            <Collapsible.Root open={expanded} onOpenChange={({ open: next }) => setOpen(next ? item.id : null)}>
              <Box
                borderWidth="1px"
                borderColor={expanded ? 'brand.muted' : 'border.subtle'}
                rounded="md"
                bg="bg.panel"
              >
                <HStack gap="1" px="2" py="1">
                  {depth > 1 && <Icon as={LuCornerDownRight} boxSize="3.5" color="fg.subtle" />}
                  <Collapsible.Trigger asChild>
                    <Button variant="ghost" size="xs" flex="1" justifyContent="start" minW="0">
                      <Icon as={expanded ? LuChevronDown : LuChevronRight} />
                      <Text truncate>{item.label || t('menuUntitled')}</Text>
                      {item.children.length > 0 && (
                        <Text as="span" color="fg.muted" fontWeight="normal">
                          · {item.children.length}
                        </Text>
                      )}
                    </Button>
                  </Collapsible.Trigger>
                  <IconButton aria-label={t('moveUp')} size="2xs" variant="ghost" disabled={index === 0} onClick={() => move(index, -1)}>
                    <LuArrowUp />
                  </IconButton>
                  <IconButton
                    aria-label={t('moveDown')}
                    size="2xs"
                    variant="ghost"
                    disabled={index === items.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <LuArrowDown />
                  </IconButton>
                  <IconButton
                    aria-label={t('remove')}
                    size="2xs"
                    variant="ghost"
                    colorPalette="danger"
                    onClick={() => onChange(items.filter((other) => other.id !== item.id))}
                  >
                    <LuTrash2 />
                  </IconButton>
                </HStack>
                <Collapsible.Content>
                  <Stack gap="3" px="3" pb="3">
                    <Labeled label={t('menuLabel')}>
                      <Input
                        size="sm"
                        value={item.label}
                        maxLength={MAX_MENU_LABEL}
                        onChange={(event) => update(item.id, { label: event.currentTarget.value })}
                      />
                    </Labeled>
                    <Labeled label={t('linkKind')}>
                      <LinkControl
                        value={item.link}
                        onChange={(link) => update(item.id, { link })}
                        services={services}
                      />
                    </Labeled>
                    {depth < MAX_MENU_DEPTH && (
                      <Button
                        size="xs"
                        variant="outline"
                        alignSelf="start"
                        disabled={item.children.length >= MAX_MENU_ITEMS_PER_LEVEL}
                        onClick={() => {
                          const child = newItem('')
                          update(item.id, { children: [...item.children, child] })
                          setOpen(child.id)
                        }}
                      >
                        <LuPlus />
                        {t('menuAddChild')}
                      </Button>
                    )}
                  </Stack>
                </Collapsible.Content>
              </Box>
            </Collapsible.Root>
            {item.children.length > 0 && (
              <Box pl="5" pt="1.5">
                <Items
                  items={item.children}
                  onChange={(children) => update(item.id, { children })}
                  depth={depth + 1}
                  services={services}
                  open={open}
                  setOpen={setOpen}
                />
              </Box>
            )}
          </Box>
        )
      })}
    </Stack>
  )
}

export function MenuEditor({
  items,
  onChange,
  services,
}: {
  items: MenuItem[]
  onChange: (items: MenuItem[]) => void
  services: EditorServices
}) {
  const { t } = useEditorText()
  const [open, setOpen] = useState<string | null>(null)

  return (
    <Stack gap="3">
      {items.length === 0 ? (
        <Text fontSize="sm" color="fg.muted">
          {t('menuEmpty')}
        </Text>
      ) : (
        <Items items={items} onChange={onChange} depth={1} services={services} open={open} setOpen={setOpen} />
      )}
      <Button
        size="sm"
        variant="outline"
        alignSelf="start"
        disabled={items.length >= MAX_MENU_ITEMS_PER_LEVEL}
        onClick={() => {
          const item = newItem('')
          onChange([...items, item])
          setOpen(item.id)
        }}
      >
        <LuPlus />
        {t('menuAddItem')}
      </Button>
    </Stack>
  )
}
