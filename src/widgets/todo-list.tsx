/**
 * Todo list — an interactive checklist block.
 *
 * Shoppers add, tick and delete items; the list lives in component state, so
 * two todo blocks on one page never share a list. The pure helpers below
 * (`parseTodoItems`, `addTodo`, `toggleTodo`, `removeTodo`) carry the rules
 * and are what the tests exercise.
 */

import { Button, Checkbox, HStack, IconButton, Input, Stack, Text } from '@chakra-ui/react'
import { useEffect, useMemo, useState } from 'react'
import { LuPlus, LuTrash2 } from 'react-icons/lu'

import type { BlockSchema } from '../model/fields'
import { newId, readBoolean, readText } from '../model/fields'
import { registerWidget, type BlockRendererProps } from '../render/block-registry'

export interface TodoItem {
  id: string
  text: string
  done: boolean
}

/** How many items one list may hold, seeded or added. */
export const MAX_TODOS = 20

const MAX_TODO_TEXT = 120

/** One item per non-empty line, trimmed and capped. Ids are stable per line. */
export function parseTodoItems(text: string): TodoItem[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, MAX_TODOS)
    .map((line, index) => ({
      id: `todo-${index}`,
      text: line.slice(0, MAX_TODO_TEXT),
      done: false,
    }))
}

/** `items` with `text` appended; unchanged when empty, a duplicate or full. */
export function addTodo(items: readonly TodoItem[], text: string, id: string): TodoItem[] {
  const value = text.trim().slice(0, MAX_TODO_TEXT)
  if (!value || items.length >= MAX_TODOS) return items as TodoItem[]
  if (items.some((item) => item.text.toLowerCase() === value.toLowerCase()))
    return items as TodoItem[]
  return [...items, { id, text: value, done: false }]
}

export function toggleTodo(items: readonly TodoItem[], id: string): TodoItem[] {
  return items.map((item) => (item.id === id ? { ...item, done: !item.done } : item))
}

export function removeTodo(items: readonly TodoItem[], id: string): TodoItem[] {
  return items.filter((item) => item.id !== id)
}

/** How many items are still unticked. */
export function remainingTodos(items: readonly TodoItem[]): number {
  return items.filter((item) => !item.done).length
}

export const todoListSchema: BlockSchema = {
  type: 'widget-todo-list',
  name: { en: 'Todo list', id: 'Daftar tugas' },
  description: {
    en: 'A checklist visitors can add to, tick off and clear.',
    id: 'Daftar centang yang bisa ditambah, dicentang, dan dihapus pengunjung.',
  },
  fields: [
    {
      kind: 'text',
      key: 'title',
      label: { en: 'Title', id: 'Judul' },
      max: 60,
      default: 'To do',
    },
    {
      kind: 'textarea',
      key: 'initialItems',
      label: { en: 'Starting items', id: 'Item awal' },
      help: { en: 'One item per line.', id: 'Satu item per baris.' },
      max: 1000,
      rows: 3,
      default: '',
    },
    {
      kind: 'boolean',
      key: 'allowAdd',
      label: { en: 'Let visitors add items', id: 'Izinkan pengunjung menambah item' },
      default: true,
    },
  ],
}

export function TodoList({ block }: BlockRendererProps) {
  const title = readText(block.settings, 'title')
  const allowAdd = readBoolean(block.settings, 'allowAdd')
  // Re-seeds only when the stored settings change, so typing in the editor's
  // panel replaces the demo list but ticking items does not get undone.
  const initial = useMemo(
    () => parseTodoItems(readText(block.settings, 'initialItems')),
    [block.settings],
  )
  const [items, setItems] = useState<TodoItem[]>(initial)
  const [draft, setDraft] = useState('')

  useEffect(() => setItems(initial), [initial])

  const add = () => {
    const next = addTodo(items, draft, newId())
    if (next !== items) setItems(next)
    setDraft('')
  }

  const remaining = remainingTodos(items)

  return (
    <Stack gap="3" data-widget="todo-list" maxW="md">
      {(title || items.length > 0) && (
        <HStack justify="space-between" align="baseline" gap="3">
          {title && <Text fontWeight="semibold">{title}</Text>}
          {items.length > 0 && (
            <Text fontSize="xs" color="fg.muted" flexShrink="0">
              {remaining} / {items.length}
            </Text>
          )}
        </HStack>
      )}

      {items.length === 0 && (
        <Text fontSize="sm" color="fg.muted">
          Nothing here yet.
        </Text>
      )}

      <Stack gap="1.5">
        {items.map((item) => (
          <HStack key={item.id} gap="2" align="center">
            <Checkbox.Root
              flex="1"
              minW="0"
              checked={item.done}
              onCheckedChange={() => setItems((current) => toggleTodo(current, item.id))}
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Checkbox.Label
                truncate
                textDecoration={item.done ? 'line-through' : undefined}
                color={item.done ? 'fg.muted' : undefined}
              >
                {item.text}
              </Checkbox.Label>
            </Checkbox.Root>
            <IconButton
              aria-label="Remove item"
              size="2xs"
              variant="ghost"
              colorPalette="danger"
              onClick={() => setItems((current) => removeTodo(current, item.id))}
            >
              <LuTrash2 />
            </IconButton>
          </HStack>
        ))}
      </Stack>

      {allowAdd && (
        <HStack gap="2">
          <Input
            size="sm"
            value={draft}
            placeholder="Add an item…"
            maxLength={MAX_TODO_TEXT}
            onChange={(event) => setDraft(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                add()
              }
            }}
          />
          <Button
            size="sm"
            colorPalette="brand"
            disabled={!draft.trim() || items.length >= MAX_TODOS}
            onClick={add}
          >
            <LuPlus />
          </Button>
        </HStack>
      )}
    </Stack>
  )
}

/** Registers the schema and its renderer. Idempotent; see `./index`. */
export function registerTodoList(): void {
  registerWidget(todoListSchema, TodoList)
}
