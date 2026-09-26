/**
 * A small spreadsheet: a header row and body rows of short text cells — a
 * size chart, a comparison table.
 *
 * Click a cell and a toolbar floats beside it with that cell's column and row
 * actions: move left or right, move up or down, delete. The cell's row and
 * column are tinted so it is plain what the buttons act on, and hovering a
 * delete tints what would go. Alt + an arrow key moves the row or column from
 * the keyboard. The header row is the table's column names, so it is never
 * moved or deleted as a row.
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
  ScrollArea,
  Stack,
  Text,
} from '@chakra-ui/react'
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { LuArrowDown, LuArrowLeft, LuArrowRight, LuArrowUp, LuPlus, LuTrash2 } from 'react-icons/lu'

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

type Emphasis = 'row' | 'column' | 'remove-row' | 'remove-column' | null

const keyOf = ({ row, column }: TableCell) => `${row}:${column}`

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
  const [emphasis, setEmphasis] = useState<Emphasis>(null)
  const container = useRef<HTMLDivElement>(null)
  const inputs = useRef(new Map<string, HTMLInputElement>())
  const cells = useRef(new Map<string, HTMLDivElement>())
  const [toolbarAt, setToolbarAt] = useState<{
    top: number
    /** From the left edge, or — for a cell in the right half — from the right. */
    left?: number
    right?: number
    below: boolean
  } | null>(null)

  // A move or delete can leave the active cell elsewhere, or gone.
  const current =
    active && active.column < columns.length && active.row < rows.length ? active : null

  // Keep the toolbar beside the active cell, and the caret in it after a move.
  useLayoutEffect(() => {
    if (!current) {
      setToolbarAt(null)
      return
    }
    const cell = cells.current.get(keyOf(current))
    const box = container.current
    if (!cell || !box) return
    const input = inputs.current.get(keyOf(current))
    if (input && document.activeElement !== input && box.contains(document.activeElement)) {
      input.focus()
    }
    // Above the cell, or below it for the header row, which has nothing above.
    // Lined up with the cell's near edge, so it never runs off the table.
    const below = current.row < 0
    const rightHalf = cell.offsetLeft + cell.offsetWidth / 2 > box.clientWidth / 2
    setToolbarAt({
      top: below ? cell.offsetTop + cell.offsetHeight + 4 : cell.offsetTop - 4,
      ...(rightHalf
        ? { right: box.clientWidth - cell.offsetLeft - cell.offsetWidth }
        : { left: cell.offsetLeft }),
      below,
    })
  }, [current?.row, current?.column, columns.length, rows.length])

  function apply(next: TableValue, focus: TableCell | null) {
    onChange(next)
    setActive(focus)
    setEmphasis(null)
  }

  const moveColumn = (by: number) =>
    current &&
    apply(moveTableColumn(value, current.column, by), { ...current, column: current.column + by })
  const moveRow = (by: number) =>
    current && apply(moveTableRow(value, current.row, by), { ...current, row: current.row + by })
  const removeColumn = () =>
    current &&
    apply(removeTableColumn(value, current.column), {
      ...current,
      column: Math.min(current.column, columns.length - 2),
    })
  const removeRow = () =>
    current &&
    apply(
      removeTableRow(value, current.row),
      rows.length > 1 ? { ...current, row: Math.min(current.row, rows.length - 2) } : null,
    )

  const canMoveLeft = Boolean(current && current.column > 0)
  const canMoveRight = Boolean(current && current.column < columns.length - 1)
  const canMoveUp = Boolean(current && current.row > 0)
  const canMoveDown = Boolean(current && current.row >= 0 && current.row < rows.length - 1)

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
    if (!event.altKey) return
    const moves: Record<string, () => unknown> = {
      ArrowLeft: () => canMoveLeft && moveColumn(-1),
      ArrowRight: () => canMoveRight && moveColumn(1),
      ArrowUp: () => canMoveUp && moveRow(-1),
      ArrowDown: () => canMoveDown && moveRow(1),
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    move()
  }

  /** How a cell is tinted: its row and column while active, red while about to go. */
  const tint = (row: number, column: number) => {
    if (!current) return undefined
    const inColumn = column === current.column
    const inRow = row === current.row
    if (emphasis === 'remove-column' && inColumn) return 'danger.subtle'
    if (emphasis === 'remove-row' && inRow) return 'danger.subtle'
    if (inColumn || (inRow && row >= 0)) return 'brand.subtle'
    return undefined
  }

  const cell = (row: number, column: number, text: string) => {
    const key = keyOf({ row, column })
    const header = row < 0
    return (
      <Box
        key={key}
        ref={(node: HTMLDivElement | null) => {
          if (node) cells.current.set(key, node)
          else cells.current.delete(key)
        }}
        rounded="sm"
        p="0.5"
        bg={tint(row, column)}
        transition="background 120ms"
      >
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

  return (
    <Stack gap="2">
      <ScrollArea.Root size="xs">
        <ScrollArea.Viewport>
          <ScrollArea.Content style={{ minWidth: 0 }}>
            <Box
              ref={container}
              position="relative"
              onBlur={(event) => {
                // Leaving the table closes the toolbar; moving between its
                // cells or onto the toolbar does not.
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setActive(null)
                  setEmphasis(null)
                }
              }}
            >
              <Grid
                // Columns share the width; past 4.5rem each the table scrolls sideways.
                templateColumns={`repeat(${columns.length}, minmax(0, 1fr))`}
                gap="0.5"
                minW={`${columns.length * 4.5}rem`}
              >
                {columns.map((text, column) => cell(-1, column, text))}
                {rows.map((cells, row) => cells.map((text, column) => cell(row, column, text)))}
              </Grid>

              {current && toolbarAt && (
                <HStack
                  position="absolute"
                  zIndex="2"
                  gap="0.5"
                  p="0.5"
                  rounded="md"
                  bg="bg.panel"
                  borderWidth="1px"
                  borderColor="border"
                  shadow="md"
                  style={{
                    top: toolbarAt.top,
                    left: toolbarAt.left,
                    right: toolbarAt.right,
                    transform: toolbarAt.below ? undefined : 'translateY(-100%)',
                  }}
                  // The toolbar never takes focus from the cell: the caret
                  // stays where the seller was typing.
                  onMouseDown={(event) => event.preventDefault()}
                >
                  <ToolbarGroup
                    label={t('tableColumnLabel')}
                    onHover={(on) => setEmphasis(on ? 'column' : null)}
                  >
                    <ToolButton
                      label="tableMoveLeft"
                      disabled={!canMoveLeft}
                      onClick={() => moveColumn(-1)}
                    >
                      <LuArrowLeft />
                    </ToolButton>
                    <ToolButton
                      label="tableMoveRight"
                      disabled={!canMoveRight}
                      onClick={() => moveColumn(1)}
                    >
                      <LuArrowRight />
                    </ToolButton>
                    <ToolButton
                      label="tableRemoveColumn"
                      danger
                      disabled={columns.length <= 1}
                      onClick={removeColumn}
                      onHover={(on) => setEmphasis(on ? 'remove-column' : 'column')}
                    >
                      <LuTrash2 />
                    </ToolButton>
                  </ToolbarGroup>
                  {current.row >= 0 && (
                    <>
                      <Box w="1px" h="5" bg="border" mx="0.5" />
                      <ToolbarGroup
                        label={t('tableRowLabel')}
                        onHover={(on) => setEmphasis(on ? 'row' : null)}
                      >
                        <ToolButton
                          label="moveUp"
                          disabled={!canMoveUp}
                          onClick={() => moveRow(-1)}
                        >
                          <LuArrowUp />
                        </ToolButton>
                        <ToolButton
                          label="moveDown"
                          disabled={!canMoveDown}
                          onClick={() => moveRow(1)}
                        >
                          <LuArrowDown />
                        </ToolButton>
                        <ToolButton
                          label="tableRemoveRow"
                          danger
                          onClick={removeRow}
                          onHover={(on) => setEmphasis(on ? 'remove-row' : 'row')}
                        >
                          <LuTrash2 />
                        </ToolButton>
                      </ToolbarGroup>
                    </>
                  )}
                </HStack>
              )}
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

function ToolbarGroup({
  label,
  onHover,
  children,
}: {
  label: string
  onHover: (on: boolean) => void
  children: ReactNode
}) {
  return (
    <HStack gap="0" onPointerEnter={() => onHover(true)} onPointerLeave={() => onHover(false)}>
      <Text fontSize="2xs" fontWeight="medium" color="fg.muted" px="1.5" textTransform="uppercase">
        {label}
      </Text>
      {children}
    </HStack>
  )
}

function ToolButton({
  label,
  danger,
  disabled,
  onClick,
  onHover,
  children,
}: {
  label: EditorMessage
  danger?: boolean
  disabled?: boolean
  onClick: () => void
  onHover?: (on: boolean) => void
  children: ReactNode
}) {
  const { t } = useEditorText()
  return (
    <Tooltip content={t(label)} wrap>
      <IconButton
        aria-label={t(label)}
        size="2xs"
        variant="ghost"
        colorPalette={danger ? 'danger' : 'gray'}
        disabled={disabled}
        onClick={onClick}
        onPointerEnter={onHover ? () => onHover(true) : undefined}
        onPointerLeave={onHover ? () => onHover(false) : undefined}
      >
        {children}
      </IconButton>
    </Tooltip>
  )
}
