/**
 * Snake — a fully dynamic, stateful game block.
 *
 * The rules live in a pure engine (`createSnake`, `turnSnake`, `advanceSnake`)
 * so every edge — walls, self-collision, eating, reversed turns — is tested
 * without a DOM. The component owns the clock, the keyboard and the canvas.
 *
 * Server rendering stays deterministic: the board is drawn only in an effect,
 * so the server emits an empty `<canvas>` and the first client paint fills it.
 * The document's own window is used for listeners, which is the editor's
 * preview iframe when the block is on the editor canvas.
 */

import { Box, Button, HStack, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import { useEffect, useRef, useState } from 'react'

import type { BlockSchema } from '../model/fields'
import { readNumber, readText } from '../model/fields'
import { registerWidget, type BlockRendererProps } from '../render/block-registry'

export type Direction = 'up' | 'down' | 'left' | 'right'

export interface Cell {
  x: number
  y: number
}

export interface SnakeState {
  /** Head first. */
  snake: Cell[]
  food: Cell
  direction: Direction
  /** Buffered turns, applied one per tick so two quick presses are not lost. */
  queue: Direction[]
  score: number
  over: boolean
}

export const SNAKE_SPEEDS = { slow: 220, normal: 140, fast: 90 } as const
export type SnakeSpeed = keyof typeof SNAKE_SPEEDS

export const SNAKE_SPEED_OPTIONS = ['slow', 'normal', 'fast'] as const

const DIRECTION_VECTORS: Record<Direction, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

const OPPOSITE: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
}

/** The smallest board the engine will build, whatever a stored value says. */
export const MIN_GRID = 8
export const MAX_GRID = 24

export function clampGridSize(value: number): number {
  if (!Number.isFinite(value)) return 16
  return Math.max(MIN_GRID, Math.min(MAX_GRID, Math.round(value)))
}

/** The direction an arrow, WASD or vim key asks for, or `null`. */
export function directionForKey(key: string): Direction | null {
  const table: Record<string, Direction> = {
    arrowup: 'up',
    w: 'up',
    k: 'up',
    arrowdown: 'down',
    s: 'down',
    j: 'down',
    arrowleft: 'left',
    a: 'left',
    h: 'left',
    arrowright: 'right',
    d: 'right',
    l: 'right',
  }
  return table[key.toLowerCase()] ?? null
}

function sameCell(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y
}

/** A random free cell; the full board's first cell when there is no room. */
function randomFood(gridSize: number, snake: readonly Cell[], random: () => number): Cell {
  const free: Cell[] = []
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (!snake.some((cell) => cell.x === x && cell.y === y)) free.push({ x, y })
    }
  }
  if (free.length === 0) return { x: 0, y: 0 }
  const index = Math.min(free.length - 1, Math.floor(random() * free.length))
  return free[index]!
}

/**
 * A fresh board: three cells in the middle heading right, and food somewhere
 * else. `random` is injectable so tests get a fixed board.
 */
export function createSnake(gridSize: number, random: () => number = Math.random): SnakeState {
  const size = clampGridSize(gridSize)
  const middle = Math.floor(size / 2)
  const snake: Cell[] = [
    { x: middle, y: middle },
    { x: middle - 1, y: middle },
    { x: middle - 2, y: middle },
  ]
  return {
    snake,
    food: randomFood(size, snake, random),
    direction: 'right',
    queue: [],
    score: 0,
    over: false,
  }
}

/**
 * A turn is remembered, not applied: `advanceSnake` consumes one buffered
 * direction per tick, and a turn into the neck (or the turn before it) is
 * dropped so the snake can never reverse into itself with two quick presses.
 */
export function turnSnake(state: SnakeState, direction: Direction): SnakeState {
  if (state.over) return state
  const last = state.queue[state.queue.length - 1] ?? state.direction
  if (direction === last || direction === OPPOSITE[last]) return state
  if (state.queue.length >= 2) return state
  return { ...state, queue: [...state.queue, direction] }
}

/**
 * One tick. A wall or the snake's own body ends the game; the tail leaves its
 * cell as the head moves, so following the tail is legal unless the snake is
 * growing that tick.
 */
export function advanceSnake(
  state: SnakeState,
  gridSize: number,
  random: () => number = Math.random,
): SnakeState {
  if (state.over) return state
  const direction = state.queue[0] ?? state.direction
  const queue = state.queue.slice(1)
  const head = state.snake[0]
  if (!head) return { ...state, over: true }
  const vector = DIRECTION_VECTORS[direction]
  const next: Cell = { x: head.x + vector.x, y: head.y + vector.y }
  const size = clampGridSize(gridSize)

  const eating = sameCell(next, state.food)
  const body = eating ? state.snake : state.snake.slice(0, -1)
  const hitsWall = next.x < 0 || next.y < 0 || next.x >= size || next.y >= size
  const hitsSelf = body.some((cell) => sameCell(cell, next))
  if (hitsWall || hitsSelf) return { ...state, direction, queue, over: true }

  const snake = [next, ...body]
  return {
    snake,
    food: eating ? randomFood(size, snake, random) : state.food,
    direction,
    queue,
    score: state.score + (eating ? 1 : 0),
    over: false,
  }
}

/* -------------------------------------------------------------------------- */
/* The component                                                              */
/* -------------------------------------------------------------------------- */

/** Pixels per cell on the canvas. */
const CELL = 18

export const snakeSchema: BlockSchema = {
  type: 'widget-snake',
  name: { en: 'Snake game', id: 'Gim Ular' },
  description: {
    en: 'A playable snake game with arrow-key and on-screen controls.',
    id: 'Gim ular yang bisa dimainkan dengan tombol panah atau tombol di layar.',
  },
  fields: [
    {
      kind: 'text',
      key: 'title',
      label: { en: 'Title', id: 'Judul' },
      max: 60,
      default: 'Snake',
    },
    {
      kind: 'number',
      key: 'gridSize',
      label: { en: 'Board size (cells)', id: 'Ukuran papan (sel)' },
      min: MIN_GRID,
      max: MAX_GRID,
      default: 16,
    },
    {
      kind: 'select',
      key: 'speed',
      label: { en: 'Speed', id: 'Kecepatan' },
      options: [
        { value: 'slow', label: { en: 'Slow', id: 'Pelan' } },
        { value: 'normal', label: { en: 'Normal', id: 'Normal' } },
        { value: 'fast', label: { en: 'Fast', id: 'Cepat' } },
      ],
      default: 'normal',
    },
  ],
}

/**
 * Paints the board. Colours come from the theme's CSS variables when they are
 * there, so the game follows the shop's brand and dark mode; the fallbacks
 * cover a canvas measured before the theme has painted.
 */
function drawSnake(canvas: HTMLCanvasElement, state: SnakeState, size: number) {
  const context = canvas.getContext('2d')
  if (!context) return
  const pixels = size * CELL
  if (canvas.width !== pixels) canvas.width = pixels
  if (canvas.height !== pixels) canvas.height = pixels

  const styles = canvas.ownerDocument.defaultView?.getComputedStyle(canvas)
  const color = (name: string, fallback: string) =>
    styles?.getPropertyValue(name).trim() || fallback
  const board = color('--chakra-colors-bg-subtle', '#f4f4f5')
  const lines = color('--chakra-colors-border-subtle', '#e4e4e7')
  const body = color('--chakra-colors-brand-solid', '#16a34a')
  const head = color('--chakra-colors-brand-emphasized', body)
  const food = color('--chakra-colors-danger-solid', '#ef4444')

  context.clearRect(0, 0, pixels, pixels)
  context.fillStyle = board
  context.fillRect(0, 0, pixels, pixels)

  context.strokeStyle = lines
  context.lineWidth = 1
  for (let i = 1; i < size; i++) {
    const at = i * CELL + 0.5
    context.beginPath()
    context.moveTo(at, 0)
    context.lineTo(at, pixels)
    context.stroke()
    context.beginPath()
    context.moveTo(0, at)
    context.lineTo(pixels, at)
    context.stroke()
  }

  context.fillStyle = food
  context.beginPath()
  context.arc(
    state.food.x * CELL + CELL / 2,
    state.food.y * CELL + CELL / 2,
    CELL * 0.34,
    0,
    Math.PI * 2,
  )
  context.fill()

  state.snake.forEach((cell, index) => {
    context.fillStyle = index === 0 ? head : body
    context.fillRect(cell.x * CELL + 1, cell.y * CELL + 1, CELL - 2, CELL - 2)
  })

  if (state.over) {
    context.fillStyle = 'rgba(0, 0, 0, 0.45)'
    context.fillRect(0, 0, pixels, pixels)
  }
}

export function SnakeGame({ block }: BlockRendererProps) {
  const title = readText(block.settings, 'title')
  const size = clampGridSize(readNumber(block.settings, 'gridSize', 16))
  const storedSpeed = readText(block.settings, 'speed')
  const speed: SnakeSpeed = (SNAKE_SPEED_OPTIONS as readonly string[]).includes(storedSpeed)
    ? (storedSpeed as SnakeSpeed)
    : 'normal'

  const [state, setState] = useState<SnakeState>(() => createSnake(size))
  const [running, setRunning] = useState(false)
  const [started, setStarted] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // A different board size is a new game.
  useEffect(() => {
    setState(createSnake(size))
    setRunning(false)
    setStarted(false)
  }, [size])

  // The tick.
  useEffect(() => {
    if (!running || state.over) return
    const timer = setInterval(
      () => setState((current) => advanceSnake(current, size)),
      SNAKE_SPEEDS[speed],
    )
    return () => clearInterval(timer)
  }, [running, state.over, speed, size])

  // Draw after every tick and on mount.
  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) drawSnake(canvas, state, size)
  }, [state, size])

  const reset = () => {
    setState(createSnake(size))
    setRunning(false)
    setStarted(false)
  }

  const turn = (direction: Direction) => {
    setState((current) => turnSnake(current, direction))
    setRunning(true)
    setStarted(true)
  }

  const play = () => {
    if (state.over) {
      reset()
      return
    }
    setRunning((current) => !current)
    setStarted(true)
  }

  return (
    <Stack gap="3" data-widget="snake" maxW="sm">
      <HStack justify="space-between" align="baseline" gap="3">
        {title && <Text fontWeight="semibold">{title}</Text>}
        <Text fontSize="sm" color="fg.muted" fontVariantNumeric="tabular-nums">
          Score {state.score}
        </Text>
      </HStack>

      <Box
        position="relative"
        rounded="l2"
        overflow="hidden"
        borderWidth="1px"
        borderColor="border.subtle"
        tabIndex={0}
        outline="none"
        _focusVisible={{ boxShadow: '0 0 0 2px var(--chakra-colors-brand-solid)' }}
        onPointerDown={(event) => event.currentTarget.focus()}
        onKeyDown={(event) => {
          if (
            (event.key === ' ' || event.key === 'Spacebar' || event.key === 'Enter') &&
            event.target === event.currentTarget
          ) {
            event.preventDefault()
            play()
            return
          }
          const direction = directionForKey(event.key)
          if (!direction) return
          event.preventDefault()
          turn(direction)
        }}
      >
        <canvas
          ref={canvasRef}
          width={size * CELL}
          height={size * CELL}
          style={{ display: 'block', width: '100%', height: 'auto' }}
        />
        {(state.over || !running) && (
          <Box
            position="absolute"
            inset="0"
            display="flex"
            alignItems="center"
            justifyContent="center"
            bg="blackAlpha.600"
            color="white"
            fontSize="sm"
            fontWeight="medium"
            pointerEvents="none"
            textAlign="center"
            px="4"
          >
            {state.over
              ? 'Game over — press Play again'
              : started
                ? 'Paused'
                : 'Press Play or an arrow key to start'}
          </Box>
        )}
      </Box>

      <HStack gap="2">
        <Button size="sm" colorPalette="brand" onClick={play}>
          {state.over ? 'Play again' : running ? 'Pause' : 'Play'}
        </Button>
        <Button size="sm" variant="outline" onClick={reset}>
          Reset
        </Button>
        <Text fontSize="xs" color="fg.muted" ml="auto">
          Arrows or WASD
        </Text>
      </HStack>

      <SimpleGrid columns={3} gap="1" w="fit-content" mx="auto">
        <Box />
        <Button size="sm" variant="subtle" aria-label="Up" onClick={() => turn('up')}>
          ↑
        </Button>
        <Box />
        <Button size="sm" variant="subtle" aria-label="Left" onClick={() => turn('left')}>
          ←
        </Button>
        <Button size="sm" variant="subtle" aria-label="Down" onClick={() => turn('down')}>
          ↓
        </Button>
        <Button size="sm" variant="subtle" aria-label="Right" onClick={() => turn('right')}>
          →
        </Button>
      </SimpleGrid>
    </Stack>
  )
}

/** Registers the schema and its renderer. Idempotent; see `./index`. */
export function registerSnake(): void {
  registerWidget(snakeSchema, SnakeGame)
}
