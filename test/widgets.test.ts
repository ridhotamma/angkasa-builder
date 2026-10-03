import { describe, expect, test } from 'bun:test'

import { readBlocks, registeredBlock, sanitizeValues, sectionSchema } from '../src/index'
import {
  addTodo,
  advanceSnake,
  buildOrderMessage,
  clampGridSize,
  clampPosition,
  createSnake,
  directionForKey,
  estimateTotal,
  INITIAL_CALCULATOR,
  normalizeWhatsappNumber,
  parseQuizAnswers,
  parseTodoItems,
  pressCalculator,
  readEstimateOptions,
  readQuizQuestions,
  readTabs,
  registerWidgets,
  remainingTodos,
  removeTodo,
  scoreQuiz,
  splitRemaining,
  toggleTodo,
  turnSnake,
  whatsappOrderLink,
  type CalculatorKey,
  type CalculatorState,
  type Direction,
  type EstimateOption,
  type SnakeState,
} from '../src/widgets/index'

registerWidgets()

/** Every widget this entry ships, in registration order. */
const WIDGET_TYPES = [
  'widget-calculator',
  'widget-todo-list',
  'widget-snake',
  'widget-tabs',
  'widget-quiz',
  'widget-estimate',
  'widget-before-after',
  'widget-countdown',
  'widget-order-form',
]

describe('widget registration', () => {
  test('every widget is a first-class block after registering', () => {
    for (const type of WIDGET_TYPES) {
      expect(registeredBlock(type)).not.toBeNull()
    }
    const schema = sectionSchema('blocks')!
    const field = schema.fields.find((candidate) => candidate.key === 'blocks')!
    expect(field.kind).toBe('blocks')
    if (field.kind !== 'blocks') throw new Error('wrong field kind')
    for (const type of WIDGET_TYPES) {
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
        {
          id: 'tabs',
          type: 'widget-tabs',
          settings: {
            tab1Label: 'Overview',
            tab1Blocks: [
              { id: 't1', type: 'heading', settings: { text: 'Hi' } },
              { id: 't2', type: 'not-a-block', settings: {} },
            ],
            tab9Label: 'gone',
          },
        },
      ],
    })
    const blocks = readBlocks(values, 'blocks')
    expect(blocks.map((block) => block.type)).toEqual([
      'widget-calculator',
      'widget-todo-list',
      'widget-snake',
      'widget-tabs',
    ])
    // Out of range numbers fall back to the field default; unknown keys vanish.
    expect(blocks[2]!.settings).toEqual({ title: 'Game', gridSize: 16, speed: 'fast' })
    expect(blocks[1]!.settings).toEqual({
      title: 'Packing',
      initialItems: 'A\nB',
      allowAdd: true,
    })
    // A tab's content is a real block tree: unknown types drop, the rest stays.
    const tabs = readTabs(blocks[3]!.settings)
    expect(tabs).toHaveLength(1)
    expect(tabs[0]!.label).toBe('Overview')
    expect(tabs[0]!.blocks.map((block) => block.type)).toEqual(['heading'])
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

describe('tabs', () => {
  test('reads the filled slots, skipping empty ones', () => {
    const tabs = readTabs({
      tab1Label: 'Overview',
      tab1Blocks: [{ id: 'a', type: 'text', settings: { body: 'Hi' } }],
      tab2Label: 'Details',
      tab2Blocks: [],
      tab3Label: '',
      tab3Blocks: [],
      tab4Label: 'Sizing',
      tab4Blocks: [{ id: 'b', type: 'heading', settings: { text: 'S' } }],
    })
    expect(tabs.map((tab) => tab.label)).toEqual(['Overview', 'Details', 'Sizing'])
    expect(tabs[0]!.blocks).toHaveLength(1)
    expect(tabs[1]!.blocks).toEqual([])
  })

  test('an all-empty widget has no tabs', () => {
    expect(readTabs({})).toEqual([])
    expect(readTabs({ tab1Label: '  ', tab1Blocks: [] })).toEqual([])
  })
})

describe('quiz', () => {
  test('parses one choice per line, capped', () => {
    expect(parseQuizAnswers(' A \n\n B \nC')).toEqual(['A', 'B', 'C'])
    expect(parseQuizAnswers('')).toEqual([])
  })

  test('reads questions and clamps the right answer', () => {
    const questions = readQuizQuestions({
      questions: [
        { id: 'q1', question: 'Berapa?', answers: 'Satu\nDua', correct: 2, explanation: 'Dua.' },
        { id: 'q2', question: 'Kosong?', answers: '', correct: 1 },
        { id: 'q3', question: '', answers: 'A\nB', correct: 1 },
      ],
    })
    // A question with no choices and one with no prompt are both dropped.
    expect(questions).toHaveLength(1)
    expect(questions[0]).toEqual({
      id: 'q1',
      question: 'Berapa?',
      answers: ['Satu', 'Dua'],
      correct: 1,
      explanation: 'Dua.',
    })
  })

  test('scores right, wrong and unanswered picks', () => {
    const questions = readQuizQuestions({
      questions: [
        { id: 'q1', question: 'A?', answers: 'A\nB', correct: 1 },
        { id: 'q2', question: 'B?', answers: 'A\nB', correct: 2 },
      ],
    })
    expect(scoreQuiz(questions, [0, 1])).toEqual({ correct: 2, total: 2 })
    expect(scoreQuiz(questions, [1, -1])).toEqual({ correct: 0, total: 2 })
  })
})

describe('estimate', () => {
  const options: EstimateOption[] = [
    { id: 'a', label: 'Base', detail: '', amount: 100_000, selected: true },
    { id: 'b', label: 'Extra', detail: '', amount: 25_000, selected: false },
  ]

  test('reads options and drops label-less rows', () => {
    const read = readEstimateOptions({
      options: [
        { id: 'a', label: 'Base', amount: 100_000, selected: true },
        { id: 'b', label: '', amount: 50_000 },
      ],
    })
    expect(read).toHaveLength(1)
    expect(read[0]!.amount).toBe(100_000)
  })

  test('sums the picked options, times the quantity', () => {
    expect(estimateTotal(options, [true, true])).toBe(125_000)
    expect(estimateTotal(options, [true, false])).toBe(100_000)
    expect(estimateTotal(options, [true, true], 3)).toBe(375_000)
    expect(estimateTotal(options, [false, false], 9)).toBe(0)
  })
})

describe('before / after', () => {
  test('keeps the divider between 0 and 100', () => {
    expect(clampPosition(-10)).toBe(0)
    expect(clampPosition(140)).toBe(100)
    expect(clampPosition(37)).toBe(37)
    expect(clampPosition(Number.NaN)).toBe(50)
  })
})

describe('countdown', () => {
  test('splits a duration into whole units', () => {
    expect(splitRemaining(90_061_000)).toEqual({ days: 1, hours: 1, minutes: 1, seconds: 1 })
    expect(splitRemaining(-5)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  })
})

describe('order form', () => {
  test('normalises an Indonesian number for wa.me', () => {
    expect(normalizeWhatsappNumber('0812-3456-7890')).toBe('6281234567890')
    expect(normalizeWhatsappNumber('+62 812 3456 7890')).toBe('6281234567890')
    expect(normalizeWhatsappNumber('no digits')).toBeNull()
  })

  test('builds the chat message with lines, total and note', () => {
    const message = buildOrderMessage(
      'Kopi Senja',
      [
        { name: 'Es Kopi', quantity: 2, totalLabel: 'Rp 20.000' },
        { name: 'Tote', quantity: 1, totalLabel: 'Rp 50.000' },
      ],
      ' Tanpa gula ',
      'Rp 70.000',
    )
    expect(message.split('\n')).toEqual([
      'Hello Kopi Senja, I would like to order:',
      '',
      '- 2x Es Kopi — Rp 20.000',
      '- 1x Tote — Rp 50.000',
      '',
      'Total: Rp 70.000',
      '',
      'Note: Tanpa gula',
    ])
  })

  test('omits an empty note and builds the link', () => {
    const message = buildOrderMessage('Toko', [], '', 'Rp 0')
    expect(message).not.toContain('Note:')
    expect(whatsappOrderLink('0812 3456 7890', 'Halo')).toBe(
      `https://wa.me/6281234567890?text=${encodeURIComponent('Halo')}`,
    )
    expect(whatsappOrderLink('', 'Halo')).toBeNull()
  })
})
