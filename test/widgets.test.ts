import { describe, expect, test } from 'bun:test'

import { readBlocks, registeredBlock, sanitizeValues, sectionSchema } from '../src/index'
import {
  addTodo,
  advanceSnake,
  clampGridSize,
  createSnake,
  directionForKey,
  INITIAL_CALCULATOR,
  parseTodoItems,
  pressCalculator,
  registerWidgets,
  remainingTodos,
  removeTodo,
  toggleTodo,
  turnSnake,
  type CalculatorKey,
  type CalculatorState,
  type Direction,
  type SnakeState,
} from '../src/widgets/index'

registerWidgets()

describe('widget registration', () => {
  test('every widget is a first-class block after registering', () => {
    for (const type of ['widget-calculator', 'widget-todo-list', 'widget-snake']) {
      expect(registeredBlock(type)).not.toBeNull()
    }
    const schema = sectionSchema('blocks')!
    const field = schema.fields.find((candidate) => candidate.key === 'blocks')!
    expect(field.kind).toBe('blocks')
    if (field.kind !== 'blocks') throw new Error('wrong field kind')
    for (const type of ['widget-calculator', 'widget-todo-list', 'widget-snake']) {
      expect(field.blocks.some((block) => block.type === type)).toBe(true)
    }
  })

  test('a generated layout sanitises through the same pipeline', () => {
    const schema = sectionSchema('blocks')!
    const field = schema.fields.find((candidate) => candidate.key === 'blocks')
    if (!field || field.kind !== 'blocks') throw new Error('the blocks field is missing')
    const values = sanitizeValues([field], {
      blocks: [
        { id: 'calc', type: 'widget-calculator', settings: { title: 'Tip' } },
        {
          id: 'todo',
          type: 'widget-todo-list',
          settings: { title: 'Packing', initialItems: 'A\nB', allowAdd: true },
        },
        {
          id: 'snake',
          type: 'widget-snake',
          settings: { title: 'Game', gridSize: 99, speed: 'fast', unknown: 'dropped' },
        },
      ],
    })
    const blocks = readBlocks(values, 'blocks')
    expect(blocks.map((block) => block.type)).toEqual([
      'widget-calculator',
      'widget-todo-list',
      'widget-snake',
    ])
    // Out of range numbers fall back to the field default; unknown keys vanish.
    expect(blocks[2]!.settings).toEqual({ title: 'Game', gridSize: 16, speed: 'fast' })
    expect(blocks[1]!.settings).toEqual({
      title: 'Packing',
      initialItems: 'A\nB',
      allowAdd: true,
    })
  })
})

describe('calculator', () => {
  const run = (keys: readonly CalculatorKey[]): CalculatorState =>
    keys.reduce(pressCalculator, INITIAL_CALCULATOR)

  test('adds, subtracts, multiplies and divides', () => {
    expect(run(['1', '2', '+', '3', '=']).display).toBe('15')
    expect(run(['9', '-', '4', '=']).display).toBe('5')
    expect(run(['6', '×', '7', '=']).display).toBe('42')
    expect(run(['8', '÷', '2', '=']).display).toBe('4')
  })

  test('rounds floating point noise away', () => {
    expect(run(['0', '.', '1', '+', '0', '.', '2', '=']).display).toBe('0.3')
  })

  test('chains operations left to right', () => {
    expect(run(['2', '+', '3', '×', '4', '=']).display).toBe('20')
    // The pending operation is applied when the second operator is pressed.
    expect(run(['2', '+', '3', '×']).display).toBe('5')
  })

  test('handles clear, sign, percent and decimal points', () => {
    expect(run(['1', '2', '3', 'C']).display).toBe('0')
    expect(run(['9', '±']).display).toBe('-9')
    expect(run(['5', '0', '%']).display).toBe('0.5')
    expect(run(['.', '5']).display).toBe('0.5')
    expect(run(['1', '.', '.', '5']).display).toBe('1.5')
  })

  test('division by zero shows Error and recovers on a digit', () => {
    expect(run(['5', '÷', '0', '=']).display).toBe('Error')
    expect(run(['5', '÷', '0', '=', '7']).display).toBe('7')
    // An operator alone does not clear it.
    expect(run(['5', '÷', '0', '=', '+']).display).toBe('Error')
    expect(run(['5', '÷', '0', '=', 'C']).display).toBe('0')
  })
})

describe('todo list', () => {
  test('parses one item per non-empty line', () => {
    expect(parseTodoItems('  Book a courier \n\n  Pack the order  \n')).toEqual([
      { id: 'todo-0', text: 'Book a courier', done: false },
      { id: 'todo-1', text: 'Pack the order', done: false },
    ])
    expect(parseTodoItems('')).toEqual([])
  })

  test('adds, ignores empty and duplicate text, ticks and removes', () => {
    const items = parseTodoItems('Book a courier')
    const added = addTodo(items, ' Ship ', 'x')
    expect(added).toEqual([
      { id: 'todo-0', text: 'Book a courier', done: false },
      { id: 'x', text: 'Ship', done: false },
    ])
    expect(addTodo(items, '   ', 'y')).toBe(items)
    expect(addTodo(items, 'book a courier', 'y')).toBe(items)

    const toggled = toggleTodo(added, 'x')
    expect(toggled[1]!.done).toBe(true)
    expect(remainingTodos(toggled)).toBe(1)
    expect(removeTodo(toggled, 'x')).toHaveLength(1)
  })
})

describe('snake engine', () => {
  const fixed = () => 0

  test('a fresh board starts centred with food on the first free cell', () => {
    const state = createSnake(8, fixed)
    expect(state.snake).toEqual([
      { x: 4, y: 4 },
      { x: 3, y: 4 },
      { x: 2, y: 4 },
    ])
    expect(state.food).toEqual({ x: 0, y: 0 })
    expect(state.over).toBe(false)
  })

  test('advances in the current direction', () => {
    const moved = advanceSnake(createSnake(8, fixed), 8, fixed)
    expect(moved.snake[0]).toEqual({ x: 5, y: 4 })
    expect(moved.score).toBe(0)
  })

  test('buffers turns one per tick and refuses reversals', () => {
    const moved = advanceSnake(createSnake(8, fixed), 8, fixed)
    expect(turnSnake(moved, 'left')).toBe(moved)
    expect(turnSnake(moved, 'right')).toBe(moved)

    let state = turnSnake(turnSnake(moved, 'up'), 'left')
    expect(state.queue).toEqual(['up', 'left'])
    state = advanceSnake(state, 8, fixed)
    expect(state.snake[0]).toEqual({ x: 5, y: 3 })
    state = advanceSnake(state, 8, fixed)
    expect(state.snake[0]).toEqual({ x: 4, y: 3 })
  })

  test('eating grows the snake and scores', () => {
    const moved = advanceSnake(createSnake(8, fixed), 8, fixed)
    const head = moved.snake[0]!
    const feeding: SnakeState = { ...moved, food: { x: head.x + 1, y: head.y } }
    const grown = advanceSnake(feeding, 8, fixed)
    expect(grown.score).toBe(1)
    expect(grown.snake).toHaveLength(4)
    expect(grown.snake[0]).toEqual({ x: head.x + 1, y: head.y })
  })

  test('a wall ends the game', () => {
    const edge: SnakeState = {
      snake: [
        { x: 7, y: 4 },
        { x: 6, y: 4 },
        { x: 5, y: 4 },
      ],
      food: { x: 0, y: 0 },
      direction: 'right',
      queue: [],
      score: 3,
      over: false,
    }
    const dead = advanceSnake(edge, 8, fixed)
    expect(dead.over).toBe(true)
    expect(advanceSnake(dead, 8, fixed)).toBe(dead)
  })

  test('running into its own body ends the game', () => {
    const coiled: SnakeState = {
      snake: [
        { x: 2, y: 2 },
        { x: 2, y: 3 },
        { x: 3, y: 3 },
        { x: 3, y: 2 },
      ],
      food: { x: 0, y: 0 },
      direction: 'down',
      queue: [],
      score: 0,
      over: false,
    }
    // The neck is directly below the head.
    expect(advanceSnake(coiled, 8, fixed).over).toBe(true)
  })

  test('grid sizes are clamped and keys map to directions', () => {
    expect(clampGridSize(100)).toBe(24)
    expect(clampGridSize(1)).toBe(8)
    expect(clampGridSize(Number.NaN)).toBe(16)
    expect(directionForKey('ArrowUp')).toBe('up')
    expect(directionForKey('W')).toBe('up')
    expect(directionForKey('a')).toBe('left')
    expect(directionForKey('q')).toBeNull()
  })

  test('turns do nothing once the game is over', () => {
    const dead: SnakeState = { ...createSnake(8, fixed), over: true }
    expect(turnSnake(dead, 'up' as Direction)).toBe(dead)
  })
})
