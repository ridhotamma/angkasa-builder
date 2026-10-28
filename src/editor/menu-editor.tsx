/**
 * Editing a navigation menu: labelled links, nested up to three levels.
 *
 * Controlled like the rest of the editor — every change hands up a new list.
 * Links use the same picker as a section's button, so a menu entry can point
 * only where a button can.
 *
 * A row reads at a glance while closed — its label and where it goes — and
 * opens to edit. Sub-links hang off a guide line under their parent. A host
 * form can report a missing label per link; the row is then outlined, says
 * what is wrong, and the first such row opens when the form asks for it.
 */

import {
  Box,
  Button,
  Collapsible,
  HStack,
  Icon,
  IconButton,
  Input,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  LuArrowDown,
  LuArrowUp,
  LuChevronDown,
  LuChevronRight,
  LuCornerDownRight,
  LuLink,
  LuPlus,
  LuTrash2,
} from 'react-icons/lu'

import { Tooltip } from '../ui'

import { newId } from '../model/fields'
import { NO_LINK, type Link } from '../model/links'
import { hasLocalizedText, readLocalizedText, withLocalizedEntry } from '../model/localized'
import {
  MAX_MENU_DEPTH,
  MAX_MENU_ITEMS_PER_LEVEL,
  MAX_MENU_LABEL,
  type MenuItem,
} from '../model/menus'
import { Labeled, LINK_KIND_LABELS, LinkControl } from './controls'
import { useEditorText } from './messages'
import { flipElements, orderMoved, type SectionRects } from './reorder-flip'
import type { EditorServices } from './services'

/** An item's place in the tree: its index at each level, top first. */
export type MenuPath = readonly number[]

function newItem(): MenuItem {
  return { id: newId(), label: '', link: NO_LINK, children: [] }
}

/** Where a link goes, in a few words: "Collection · summer". */
function useLinkSummary() {
  const { t } = useEditorText()
  return (link: Link): string => {
    const kind = t(LINK_KIND_LABELS[link.kind])
    const detail =
      link.kind === 'url'
        ? link.href
        : link.kind === 'search'
          ? link.query
          : link.kind === 'blog'
            ? link.blogHandle + (link.tag ? ` #${link.tag}` : '')
            : link.kind === 'article'
              ? `${link.blogHandle}/${link.slug}`
              : 'slug' in link
                ? link.slug
                : ''
    return detail ? `${kind} · ${detail}` : kind
  }
}

/** The ids of every item whose label the host reports as wrong, in reading order. */
function invalidIds(
  items: readonly MenuItem[],
  labelError: ((path: MenuPath) => string | undefined) | undefined,
  path: MenuPath = [],
): string[] {
  if (!labelError) return []
  return items.flatMap((item, index) => {
    const here = [...path, index]
    return [...(labelError(here) ? [item.id] : []), ...invalidIds(item.children, labelError, here)]
  })
}

interface ItemsProps {
  items: MenuItem[]
  onChange: (items: MenuItem[]) => void
  path: MenuPath
  services: EditorServices
  open: string | null
  setOpen: (id: string | null) => void
  labelError?: (path: MenuPath) => string | undefined
}

function Items({ items, onChange, path, services, open, setOpen, labelError }: ItemsProps) {
  const { t, locale } = useEditorText()
  const summary = useLinkSummary()
  const depth = path.length + 1

  // Rows slide to their new places on every reorder — see `ListControl`.
  const rowsRef = useRef<HTMLDivElement>(null)
  const rowRects = useRef<SectionRects>(new Map())
  const rowIndexes = useRef<Map<string, number>>(new Map())

  useLayoutEffect(() => {
    const ids = items.map((item) => item.id)
    rowRects.current = flipElements(rowsRef.current, ids, rowRects.current, {
      attribute: 'data-menu-row',
      animate: orderMoved(ids, rowIndexes.current),
    })
    rowIndexes.current = new Map(ids.map((id, index) => [id, index]))
  }, [items])

  const update = (id: string, next: Partial<MenuItem>) =>
    onChange(items.map((item) => (item.id === id ? { ...item, ...next } : item)))

  const move = (index: number, by: number) => {
    const next = [...items]
    const [item] = next.splice(index, 1)
    next.splice(index + by, 0, item!)
    onChange(next)
  }

  return (
    <Stack ref={rowsRef} gap="1.5">
      {items.map((item, index) => {
        const here = [...path, index]
        const expanded = open === item.id
        const error = labelError?.(here)
        return (
          <Box key={item.id} data-menu-row={item.id}>
            <Collapsible.Root
              open={expanded}
              onOpenChange={({ open: next }) => setOpen(next ? item.id : null)}
            >
              <Box
                className="group"
                borderWidth="1px"
                borderColor={error ? 'border.error' : expanded ? 'brand.muted' : 'border.subtle'}
                rounded="md"
                bg="bg.panel"
                transition="border-color 120ms"
                _hover={{
                  borderColor: error ? 'border.error' : expanded ? 'brand.muted' : 'border',
                }}
              >
                <HStack gap="1" pl="1" pr="1.5" py="1">
                  <Collapsible.Trigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      flex="1"
                      minW="0"
                      h="auto"
                      py="1.5"
                      px="2"
                      justifyContent="start"
                      gap="2"
                    >
                      <Icon
                        as={expanded ? LuChevronDown : LuChevronRight}
                        boxSize="4"
                        color="fg.muted"
                        flexShrink="0"
                      />
                      <Stack gap="0" minW="0" align="start" flex="1">
                        <Text
                          fontSize="sm"
                          fontWeight="medium"
                          truncate
                          maxW="full"
                          color={hasLocalizedText(item.label) ? 'fg' : 'fg.muted'}
                        >
                          {readLocalizedText(item.label, locale) || t('menuUntitled')}
                        </Text>
                        <Text
                          fontSize="xs"
                          fontWeight="normal"
                          truncate
                          maxW="full"
                          color={error ? 'fg.error' : 'fg.muted'}
                        >
                          {error ? t('menuNeedsLabel') : summary(item.link)}
                        </Text>
                      </Stack>
                    </Button>
                  </Collapsible.Trigger>
                  <Tooltip content={t('moveUp')} wrap>
                    <IconButton
                      aria-label={t('moveUp')}
                      size="xs"
                      variant="ghost"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <LuArrowUp />
                    </IconButton>
                  </Tooltip>
                  <Tooltip content={t('moveDown')} wrap>
                    <IconButton
                      aria-label={t('moveDown')}
                      size="xs"
                      variant="ghost"
                      disabled={index === items.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <LuArrowDown />
                    </IconButton>
                  </Tooltip>
                  <Tooltip content={t('remove')}>
                    <IconButton
                      aria-label={t('remove')}
                      size="xs"
                      variant="ghost"
                      colorPalette="danger"
                      onClick={() => onChange(items.filter((other) => other.id !== item.id))}
                    >
                      <LuTrash2 />
                    </IconButton>
                  </Tooltip>
                </HStack>
                <Collapsible.Content>
                  <Stack
                    gap="4"
                    px="3"
                    pt="1"
                    pb="3"
                    borderTopWidth="1px"
                    borderColor="border.subtle"
                  >
                    <SimpleGrid columns={{ base: 1, md: 2 }} gap="3" pt="2">
                      <Labeled label={t('menuLabel')} error={error}>
                        <Input
                          size="sm"
                          value={readLocalizedText(item.label, locale)}
                          maxLength={MAX_MENU_LABEL}
                          placeholder={t('menuLabelPlaceholder')}
                          // A fresh link opens straight onto its label.
                          autoFocus={!hasLocalizedText(item.label)}
                          onChange={(event) =>
                            // The field edits the current language's entry; the
                            // shop's own stays until overwritten, so a translation
                            // can be added without losing the original.
                            update(item.id, {
                              label: withLocalizedEntry(
                                item.label,
                                locale,
                                event.currentTarget.value,
                              ),
                            })
                          }
                        />
                      </Labeled>
                      <Labeled label={t('linkKind')}>
                        <LinkControl
                          value={item.link}
                          onChange={(link) => update(item.id, { link })}
                          services={services}
                        />
                      </Labeled>
                    </SimpleGrid>
                    {depth < MAX_MENU_DEPTH && (
                      <Button
                        size="xs"
                        variant="ghost"
                        alignSelf="start"
                        ml="-1.5"
                        disabled={item.children.length >= MAX_MENU_ITEMS_PER_LEVEL}
                        onClick={() => {
                          const child = newItem()
                          update(item.id, { children: [...item.children, child] })
                          setOpen(child.id)
                        }}
                      >
                        <LuCornerDownRight />
                        {t('menuAddChild')}
                      </Button>
                    )}
                  </Stack>
                </Collapsible.Content>
              </Box>
            </Collapsible.Root>
            {/* Sub-links hang off a guide line under their parent. */}
            {item.children.length > 0 && (
              <Box ml="4" pl="3" pt="1.5" borderLeftWidth="2px" borderColor="border.subtle">
                <Items
                  items={item.children}
                  onChange={(children) => update(item.id, { children })}
                  path={here}
                  services={services}
                  open={open}
                  setOpen={setOpen}
                  labelError={labelError}
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
  labelError,
  revealErrors,
}: {
  items: MenuItem[]
  onChange: (items: MenuItem[]) => void
  services: EditorServices
  /** The host form's message for the label at `path`, if it is wrong. */
  labelError?: (path: MenuPath) => string | undefined
  /** Bump (a form's submit count) to open the first link with an error. */
  revealErrors?: number
}) {
  const { t } = useEditorText()
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    if (!revealErrors) return
    const [first] = invalidIds(items, labelError)
    if (first) setOpen(first)
    // Only a new submit reveals; a later edit must not yank the panel open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealErrors])

  const add = () => {
    const item = newItem()
    onChange([...items, item])
    setOpen(item.id)
  }

  if (items.length === 0) {
    return (
      <Stack
        align="center"
        gap="3"
        py="8"
        px="4"
        rounded="md"
        borderWidth="1px"
        borderStyle="dashed"
        borderColor="border"
        textAlign="center"
      >
        <Box
          boxSize="10"
          rounded="full"
          bg="bg.muted"
          color="fg.muted"
          display="grid"
          placeItems="center"
        >
          <Icon as={LuLink} boxSize="5" />
        </Box>
        <Stack gap="0.5">
          <Text fontSize="sm" fontWeight="medium">
            {t('menuEmpty')}
          </Text>
          <Text fontSize="sm" color="fg.muted">
            {t('menuEmptyHint')}
          </Text>
        </Stack>
        <Button size="sm" variant="outline" onClick={add}>
          <LuPlus />
          {t('menuAddItem')}
        </Button>
      </Stack>
    )
  }

  return (
    <Stack gap="3">
      <Items
        items={items}
        onChange={onChange}
        path={[]}
        services={services}
        open={open}
        setOpen={setOpen}
        labelError={labelError}
      />
      <Button
        size="sm"
        variant="ghost"
        alignSelf="start"
        disabled={items.length >= MAX_MENU_ITEMS_PER_LEVEL}
        onClick={add}
      >
        <LuPlus />
        {t('menuAddItem')}
      </Button>
    </Stack>
  )
}
