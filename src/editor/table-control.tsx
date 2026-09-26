/**
 * A small spreadsheet: a header row and body rows of short text cells — a
 * size chart, a comparison table.
 *
 * Focus a cell and grips appear at the table's edges: above its column and
 * beside its row, in gutters that hold no cells, so nothing is covered (the
 * pattern Notion, Google Docs and Airtable use). They follow the cell being
 * typed in, not the pointer, so the table stays still while it is read. A grip opens that column's or
 * row's actions: move, or delete. The cell's row and column are tinted so it
 * is plain what a grip acts on, and pointing at a delete tints what would go.
 * Alt + an arrow key moves the row or column from the keyboard. The header row
 * is the table's column names, so it has no row grip.
 *
 * Pasting a block copied from a spreadsheet into any cell fills the grid from
 * there — the usual way a size chart arrives.
 */

import {
  Box,
  Button,
  Grid,
  HStack,
  IconButton,
  Input,
  Menu,
  Portal,
  ScrollArea,
  Stack,
  Text,
} from '@chakra-ui/react'
import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import {
  LuArrowDown,
  LuArrowLeft,
  LuArrowRight,
  LuArrowUp,
  LuGripHorizontal,
  LuGripVertical,
  LuPlus,
  LuTrash2,
} from 'react-icons/lu'

import { Tooltip } from '@repo/theme'

import type { TableValue } from '../model/fields'
import { useEditorText, type EditorMessage } from './messages'

/* -------------------------------------------------------------------------- */
/* Edits                                                                      */
/* -------------------------------------------------------------------------- */

/** `row` is `-1` for the header row. */
export interface TableCell {
  row: number
  column: number
}

function swap<T>(list: readonly T[], a: number, b: number): T[] {
  const next = [...list]
  ;[next[a], next[b]] = [next[b]!, next[a]!]
  return next
}

/** The table with column `column` moved `by` places; unchanged past either edge. */
export function moveTableColumn(table: TableValue, column: number, by: number): TableValue {
  const to = column + by
  if (to < 0 || to >= table.columns.length) return table
  return {
    columns: swap(table.columns, column, to),
    rows: table.rows.map((cells) => swap(cells, column, to)),
  }
}

/** The table with body row `row` moved `by` places; unchanged past either edge. */
export function moveTableRow(table: TableValue, row: number, by: number): TableValue {
  const to = row + by
  if (row < 0 || to < 0 || to >= table.rows.length) return table
  return { columns: table.columns, rows: swap(table.rows, row, to) }
}

/** The table without column `column` — never its last one. */
export function removeTableColumn(table: TableValue, column: number): TableValue {
  if (table.columns.length <= 1) return table
  return {
    columns: table.columns.filter((_, index) => index !== column),
    rows: table.rows.map((cells) => cells.filter((_, index) => index !== column)),
  }
}

/** The table without body row `row`. */
export function removeTableRow(table: TableValue, row: number): TableValue {
  if (row < 0) return table
  return { columns: table.columns, rows: table.rows.filter((_, index) => index !== row) }
}

/* -------------------------------------------------------------------------- */
/* Control                                                                    */
/* -------------------------------------------------------------------------- */

/** What the tint shows beyond the active row and column: what a delete would take. */
type Emphasis = 'remove-row' | 'remove-column' | null

const keyOf = ({ row, column }: TableCell) => `${row}:${column}`

/** The gutters that hold the grips, beside and above the cells. */
const GUTTER = '1.25rem'

export function TableControl({
  value,
  onChange,
  maxColumns,
  maxRows,
}: {
  value: TableValue
  onChange: (table: TableValue) => void
  maxColumns: number
  maxRows: number
}) {
  const { t } = useEditorText()
  const { columns, rows } = value

  const [active, setActive] = useState<TableCell | null>(null)
  // The grip whose menu is open. Its menu takes focus out of the table (into a
  // portal, past a dialog's focus trap), so nothing about the grips may hang
  // on the focused cell — every grip stays mounted, and only its visibility
  // follows the active cell, the pointer, and this.
  const [menu, setMenu] = useState<{ kind: 'row' | 'column'; index: number } | null>(null)
  const [emphasis, setEmphasis] = useState<Emphasis>(null)
  const container = useRef<HTMLDivElement>(null)
  const inputs = useRef(new Map<string, HTMLInputElement>())
  // The last cell typed in, for where the caret lands after a menu action.
  const lastCell = useRef<TableCell | null>(null)

  // A move or delete can leave the active cell elsewhere, or gone.
  const current =
    active && active.column < columns.length && active.row < rows.length ? active : null
  if (current) lastCell.current = current

  // After a move, the caret follows the cell it was in.
  useLayoutEffect(() => {
    if (!current) return
    const input = inputs.current.get(keyOf(current))
    const box = container.current
    if (input && box && document.activeElement !== input && box.contains(document.activeElement)) {
      input.focus()
    }
  }, [current?.row, current?.column])

  function apply(next: TableValue, focus: TableCell | null) {
    onChange(next)
    setActive(focus)
    setEmphasis(null)
    if (!focus) return
    // Back into the moved cell once the menu has closed and handed focus back
    // to its grip.
    requestAnimationFrame(() => setTimeout(() => inputs.current.get(keyOf(focus))?.focus(), 0))
  }

  const moveColumn = (column: number, by: number) =>
    apply(moveTableColumn(value, column, by), {
      row: lastCell.current?.row ?? -1,
      column: column + by,
    })
  const moveRow = (row: number, by: number) =>
    apply(moveTableRow(value, row, by), { row: row + by, column: lastCell.current?.column ?? 0 })
  const removeColumn = (column: number) =>
    apply(removeTableColumn(value, column), {
      row: lastCell.current?.row ?? -1,
      column: Math.max(0, Math.min(column, columns.length - 2)),
    })
  const removeRow = (row: number) =>
    apply(
      removeTableRow(value, row),
      rows.length > 1
        ? { row: Math.min(row, rows.length - 2), column: lastCell.current?.column ?? 0 }
        : null,
    )

  // A grip shows for the focused cell's column and row, and while its menu
  // is open (which takes focus out of the cell).
  const columnGripShown = (column: number) =>
    (menu?.kind === 'column' && menu.index === column) || current?.column === column
  const rowGripShown = (row: number) =>
    (menu?.kind === 'row' && menu.index === row) || current?.row === row

  const setCell = (row: number, column: number, text: string) => {
    if (row < 0) {
      onChange({ columns: columns.map((cell, index) => (index === column ? text : cell)), rows })
    } else {
      onChange({
        columns,
        rows: rows.map((cells, index) =>
          index === row ? cells.map((cell, at) => (at === column ? text : cell)) : cells,
        ),
      })
    }
  }

  const paste = (row: number, column: number, text: string): boolean => {
    if (!text.includes('\t') && !text.includes('\n')) return false
    const grid = text
      .replace(/\r/g, '')
      .replace(/\n$/, '')
      .split('\n')
      .map((line) => line.split('\t'))
    const width = Math.min(
      maxColumns,
      Math.max(columns.length, column + Math.max(...grid.map((line) => line.length))),
    )
    const nextColumns = Array.from({ length: width }, (_, index) => columns[index] ?? '')
    const nextRows = rows.map((cells) =>
      Array.from({ length: width }, (_, index) => cells[index] ?? ''),
    )
    grid.forEach((line, lineIndex) => {
      const target = row + lineIndex
      line.forEach((cell, cellIndex) => {
        const at = column + cellIndex
        if (at >= width) return
        if (target < 0) nextColumns[at] = cell.trim()
        else {
          if (target >= maxRows) return
          while (nextRows.length <= target) nextRows.push(Array.from({ length: width }, () => ''))
          nextRows[target]![at] = cell.trim()
        }
      })
    })
    onChange({ columns: nextColumns, rows: nextRows })
    return true
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!event.altKey || !current) return
    const { row, column } = current
    const moves: Record<string, (() => unknown) | false> = {
      ArrowLeft: column > 0 && (() => moveColumn(column, -1)),
      ArrowRight: column < columns.length - 1 && (() => moveColumn(column, 1)),
      ArrowUp: row > 0 && (() => moveRow(row, -1)),
      ArrowDown: row >= 0 && row < rows.length - 1 && (() => moveRow(row, 1)),
    }
    if (!(event.key in moves)) return
    event.preventDefault()
    const move = moves[event.key]
    if (move) move()
  }

  /** A cell's tint: its row and column while active, red while about to go. */
  const tint = (row: number, column: number) => {
    // An open menu speaks for its own column or row only.
    const target = menu
      ? menu.kind === 'column'
        ? { row: Number.NaN, column: menu.index }
        : { row: menu.index, column: Number.NaN }
      : current
    if (!target) return undefined
    const inColumn = column === target.column
    const inRow = row >= 0 && row === target.row
    if (emphasis === 'remove-column' && inColumn) return 'danger.subtle'
    if (emphasis === 'remove-row' && inRow) return 'danger.subtle'
    if (inColumn || inRow) return 'brand.subtle'
    return undefined
  }

  const cell = (row: number, column: number, text: string) => {
    const key = keyOf({ row, column })
    const header = row < 0
    return (
      <Box key={key} rounded="sm" p="0.5" bg={tint(row, column)} transition="background 120ms">
        <Input
          ref={(node) => {
            if (node) inputs.current.set(key, node)
            else inputs.current.delete(key)
          }}
          size="xs"
          value={text}
          maxLength={80}
          fontWeight={header ? 'semibold' : undefined}
          bg={header ? 'bg.muted' : 'bg.panel'}
          aria-label={header ? t('tableColumnName') : undefined}
          onFocus={() => setActive({ row, column })}
          onKeyDown={onKeyDown}
          onChange={(event) => setCell(row, column, event.currentTarget.value)}
          onPaste={(event) => {
            if (paste(row, column, event.clipboardData.getData('text/plain')))
              event.preventDefault()
          }}
        />
      </Box>
    )
  }

  const gripMenu = (kind: 'row' | 'column', index: number) => ({
    onOpenChange: (open: boolean) => {
      setMenu(open ? { kind, index } : null)
      if (!open) setEmphasis(null)
    },
    onEmphasis: setEmphasis,
  })

  return (
    <Stack gap="2">
      <ScrollArea.Root size="xs">
        <ScrollArea.Viewport>
          <ScrollArea.Content style={{ minWidth: 0 }}>
            <Box
              ref={container}
              onBlur={(event) => {
                // Leaving the table clears the active cell. The grips do not
                // depend on it, so a menu taking focus away is harmless.
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setActive(null)
                  setEmphasis(null)
                }
              }}
            >
              {/* A gutter column for the row grips and a gutter row for the
                  column grips: the grips sit beside the cells, never on them. */}
              <Grid
                templateColumns={`${GUTTER} repeat(${columns.length}, minmax(0, 1fr))`}
                gap="0.5"
                alignItems="center"
                minW={`calc(${GUTTER} + ${columns.length * 4.5}rem)`}
              >
                <Box h={GUTTER} />
                {columns.map((_, column) => (
                  <Box key={`grip:${column}`} h={GUTTER} display="flex" justifyContent="center">
                    <GripMenu
                      {...gripMenu('column', column)}
                      shown={columnGripShown(column)}
                      kind="column"
                      label={t('tableColumnActions')}
                      actions={[
                        {
                          value: 'left',
                          label: t('tableMoveLeft'),
                          icon: <LuArrowLeft />,
                          disabled: column === 0,
                          onSelect: () => moveColumn(column, -1),
                        },
                        {
                          value: 'right',
                          label: t('tableMoveRight'),
                          icon: <LuArrowRight />,
                          disabled: column === columns.length - 1,
                          onSelect: () => moveColumn(column, 1),
                        },
                        {
                          value: 'delete',
                          label: t('tableRemoveColumn'),
                          icon: <LuTrash2 />,
                          danger: true,
                          disabled: columns.length <= 1,
                          onSelect: () => removeColumn(column),
                        },
                      ]}
                    />
                  </Box>
                ))}

                <Box />
                {columns.map((text, column) => cell(-1, column, text))}

                {rows.map((cells, row) => [
                  <Box
                    key={`grip:row:${row}`}
                    display="flex"
                    justifyContent="center"
                    alignSelf="stretch"
                    alignItems="center"
                  >
                    <GripMenu
                      {...gripMenu('row', row)}
                      shown={rowGripShown(row)}
                      kind="row"
                      label={t('tableRowActions')}
                      actions={[
                        {
                          value: 'up',
                          label: t('moveUp'),
                          icon: <LuArrowUp />,
                          disabled: row === 0,
                          onSelect: () => moveRow(row, -1),
                        },
                        {
                          value: 'down',
                          label: t('moveDown'),
                          icon: <LuArrowDown />,
                          disabled: row === rows.length - 1,
                          onSelect: () => moveRow(row, 1),
                        },
                        {
                          value: 'delete',
                          label: t('tableRemoveRow'),
                          icon: <LuTrash2 />,
                          danger: true,
                          onSelect: () => removeRow(row),
                        },
                      ]}
                    />
                  </Box>,
                  ...cells.map((text, column) => cell(row, column, text)),
                ])}
              </Grid>
            </Box>
          </ScrollArea.Content>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="horizontal" />
      </ScrollArea.Root>
      <HStack gap="2" wrap="wrap">
        <Button
          size="xs"
          variant="outline"
          disabled={rows.length >= maxRows}
          onClick={() => onChange({ columns, rows: [...rows, columns.map(() => '')] })}
        >
          <LuPlus />
          {t('tableAddRow')}
        </Button>
        <Button
          size="xs"
          variant="outline"
          disabled={columns.length >= maxColumns}
          onClick={() =>
            onChange({ columns: [...columns, ''], rows: rows.map((cells) => [...cells, '']) })
          }
        >
          <LuPlus />
          {t('tableAddColumn')}
        </Button>
      </HStack>
      <Text fontSize="xs" color="fg.muted">
        {t('tableHint')}
      </Text>
    </Stack>
  )
}

interface GripAction {
  value: string
  label: string
  icon: ReactNode
  danger?: boolean
  disabled?: boolean
  onSelect: () => void
}

/**
 * The grip above a column or beside a row, opening its actions. Pointing at
 * (or arrowing to) the delete item tints what it would remove.
 */
function GripMenu({
  kind,
  shown,
  label,
  actions,
  onOpenChange,
  onEmphasis,
}: {
  kind: 'row' | 'column'
  /** Hidden grips stay mounted — a menu must never lose its anchor. */
  shown: boolean
  label: string
  actions: GripAction[]
  onOpenChange: (open: boolean) => void
  onEmphasis: (emphasis: Emphasis) => void
}) {
  const removing: Emphasis = kind === 'column' ? 'remove-column' : 'remove-row'
  // Shared by the menu and its tooltip, which wrap the same button.
  const triggerId = useId()
  return (
    <Menu.Root
      ids={{ trigger: triggerId }}
      positioning={{ placement: kind === 'column' ? 'bottom' : 'right-start' }}
      onOpenChange={({ open }) => onOpenChange(open)}
      onHighlightChange={({ highlightedValue }) =>
        onEmphasis(
          actions.find((action) => action.value === highlightedValue)?.danger ? removing : null,
        )
      }
      onSelect={({ value }) => actions.find((action) => action.value === value)?.onSelect()}
    >
      <Tooltip content={label} triggerId={triggerId}>
        <Menu.Trigger asChild>
          <IconButton
            aria-label={label}
            size="2xs"
            variant="subtle"
            colorPalette="brand"
            h={kind === 'column' ? '4' : '6'}
            minW={kind === 'column' ? '6' : '4'}
            px="0"
            rounded="sm"
            opacity={shown ? 1 : 0}
            pointerEvents={shown ? 'auto' : 'none'}
            tabIndex={shown ? 0 : -1}
            aria-hidden={shown ? undefined : true}
            transition="opacity 120ms"
          >
            {kind === 'column' ? <LuGripHorizontal /> : <LuGripVertical />}
          </IconButton>
        </Menu.Trigger>
      </Tooltip>
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW="10rem">
            {actions.map((action) => (
              <Menu.Item
                key={action.value}
                value={action.value}
                disabled={action.disabled}
                color={action.danger ? 'fg.error' : undefined}
                _highlighted={action.danger ? { bg: 'bg.error', color: 'fg.error' } : undefined}
              >
                {action.icon}
                {action.label}
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  )
}
