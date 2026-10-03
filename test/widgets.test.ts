import { describe, expect, test } from 'bun:test'

import { readBlocks, registeredBlock, sanitizeValues, sectionSchema } from '../src/index'
import {
  clampPosition,
  estimateTotal,
  parseQuizAnswers,
  readEstimateOptions,
  readQuizQuestions,
  readTabs,
  registerWidgets,
  scoreQuiz,
  splitRemaining,
  type EstimateOption,
} from '../src/widgets/index'

registerWidgets()

/** Every widget this entry ships, in registration order. */
const WIDGET_TYPES = [
  'widget-tabs',
  'widget-quiz',
  'widget-estimate',
  'widget-before-after',
  'widget-countdown',
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
    expect(blocks.map((block) => block.type)).toEqual(['widget-tabs'])
    // A tab's content is a real block tree: unknown types drop, the rest stays.
    const tabs = readTabs(blocks[0]!.settings)
    expect(tabs).toHaveLength(1)
    expect(tabs[0]!.label).toBe('Overview')
    expect(tabs[0]!.blocks.map((block) => block.type)).toEqual(['heading'])
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
