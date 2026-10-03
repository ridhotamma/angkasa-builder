/**
 * Quiz / poll — questions visitors answer, with the scoring done in the open.
 *
 * The rules are pure (`parseQuizAnswers`, `scoreQuiz`) so they are tested
 * without a DOM; the component only holds the picks. In quiz mode an answer is
 * marked right or wrong and the score shows; in poll mode the picks are the
 * result — no aggregate is shown, because a real poll needs a place to keep
 * the counts, and a widget never writes.
 */

import { Box, Button, HStack, Stack, Text } from '@chakra-ui/react'
import { useEffect, useMemo, useState } from 'react'
import { LuCheck, LuX } from 'react-icons/lu'

import type { BlockSchema, FieldValues } from '../model/fields'
import { readBoolean, readList, readNumber, readText } from '../model/fields'
import { registerWidget, type BlockRendererProps } from '../render/block-registry'

/** At most this many choices per question. */
export const MAX_QUIZ_ANSWERS = 6
/** At most this many questions per widget. */
export const MAX_QUIZ_QUESTIONS = 12

export interface QuizQuestion {
  id: string
  question: string
  answers: string[]
  /** Zero-based index of the right answer; clamped into the answers' range. */
  correct: number
  explanation: string
}

/** One answer per non-empty line, trimmed and capped. */
export function parseQuizAnswers(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, MAX_QUIZ_ANSWERS)
}

/** The usable questions: one with a prompt and at least two choices. */
export function readQuizQuestions(values: FieldValues): QuizQuestion[] {
  return readList(values, 'questions')
    .map((item) => {
      const answers = parseQuizAnswers(readText(item, 'answers'))
      const correct = Math.max(0, Math.round(readNumber(item, 'correct', 1)) - 1)
      return {
        id: item.id,
        question: readText(item, 'question'),
        answers,
        correct: Math.min(correct, Math.max(0, answers.length - 1)),
        explanation: readText(item, 'explanation'),
      }
    })
    .filter((question) => question.question.length > 0 && question.answers.length >= 2)
    .slice(0, MAX_QUIZ_QUESTIONS)
}

/** How many picks were right. An unanswered question (`-1`) is simply wrong. */
export function scoreQuiz(
  questions: readonly QuizQuestion[],
  picks: readonly number[],
): { correct: number; total: number } {
  let correct = 0
  questions.forEach((question, index) => {
    if (picks[index] === question.correct) correct += 1
  })
  return { correct, total: questions.length }
}

type OptionState = 'idle' | 'chosen' | 'correct' | 'wrong'

function optionState(
  question: QuizQuestion,
  index: number,
  pick: number,
  submitted: boolean,
  quiz: boolean,
): OptionState {
  if (!submitted) return pick === index ? 'chosen' : 'idle'
  if (!quiz) return pick === index ? 'chosen' : 'idle'
  if (index === question.correct) return 'correct'
  if (pick === index) return 'wrong'
  return 'idle'
}

const OPTION_PROPS: Record<OptionState, { variant: 'outline' | 'subtle'; colorPalette: string }> = {
  idle: { variant: 'outline', colorPalette: 'gray' },
  chosen: { variant: 'subtle', colorPalette: 'brand' },
  correct: { variant: 'subtle', colorPalette: 'green' },
  wrong: { variant: 'subtle', colorPalette: 'red' },
}

export const quizSchema: BlockSchema = {
  type: 'widget-quiz',
  name: { en: 'Quiz or poll', id: 'Kuis atau jajak pendapat' },
  description: {
    en: 'Questions with choices: mark the right answers, or run it as an opinion poll.',
    id: 'Pertanyaan dengan pilihan: tandai jawaban benar, atau jadikan jajak pendapat.',
  },
  fields: [
    {
      kind: 'text',
      key: 'title',
      label: { en: 'Title', id: 'Judul' },
      max: 80,
      default: '',
    },
    {
      kind: 'select',
      key: 'mode',
      label: { en: 'Mode', id: 'Mode' },
      options: [
        {
          value: 'quiz',
          label: { en: 'Quiz — mark right answers', id: 'Kuis — tandai jawaban benar' },
        },
        {
          value: 'poll',
          label: { en: 'Poll — collect opinions', id: 'Jajak — kumpulkan pendapat' },
        },
      ],
      default: 'quiz',
    },
    {
      kind: 'boolean',
      key: 'showScore',
      label: { en: 'Show the score', id: 'Tampilkan skor' },
      default: true,
      showWhen: { key: 'mode', is: ['quiz'] },
    },
    {
      kind: 'text',
      key: 'submitLabel',
      label: { en: 'Button label', id: 'Label tombol' },
      max: 32,
      default: '',
    },
    {
      kind: 'list',
      key: 'questions',
      label: { en: 'Questions', id: 'Pertanyaan' },
      itemLabel: { en: 'Question', id: 'Pertanyaan' },
      titleKey: 'question',
      max: MAX_QUIZ_QUESTIONS,
      fields: [
        {
          kind: 'textarea',
          key: 'question',
          label: { en: 'Question', id: 'Pertanyaan' },
          max: 240,
          rows: 2,
          default: '',
        },
        {
          kind: 'textarea',
          key: 'answers',
          label: { en: 'Answer choices', id: 'Pilihan jawaban' },
          help: { en: 'One choice per line.', id: 'Satu pilihan per baris.' },
          max: 400,
          rows: 4,
          default: '',
        },
        {
          kind: 'number',
          key: 'correct',
          label: { en: 'Right answer (number)', id: 'Jawaban benar (nomor)' },
          help: { en: 'The line number of the right answer.', id: 'Nomor baris jawaban benar.' },
          min: 1,
          max: MAX_QUIZ_ANSWERS,
          step: 1,
          default: 1,
        },
        {
          kind: 'text',
          key: 'explanation',
          label: { en: 'Explanation', id: 'Penjelasan' },
          help: {
            en: 'Shown after answering, in quiz mode.',
            id: 'Tampil setelah menjawab, di mode kuis.',
          },
          max: 200,
          default: '',
        },
      ],
    },
  ],
}

export function QuizWidget({ block }: BlockRendererProps) {
  const questions = useMemo(() => readQuizQuestions(block.settings), [block.settings])
  const title = readText(block.settings, 'title')
  const poll = readText(block.settings, 'mode') === 'poll'
  const showScore = !poll && readBoolean(block.settings, 'showScore')
  const [picks, setPicks] = useState<number[]>(() => questions.map(() => -1))
  const [submitted, setSubmitted] = useState(false)

  // New questions start a new round; ticking through a stale round would be
  // scoring the wrong quiz.
  useEffect(() => {
    setPicks(questions.map(() => -1))
    setSubmitted(false)
  }, [questions])

  if (questions.length === 0) return null

  const answered = picks.every((pick) => pick >= 0)
  const score = scoreQuiz(questions, picks)
  const submitLabel = readText(block.settings, 'submitLabel') || (poll ? 'Send' : 'Check answers')

  return (
    <Stack gap="4" data-widget="quiz" maxW="lg">
      {title && (
        <Text fontWeight="semibold" data-testid="quiz-title">
          {title}
        </Text>
      )}

      {questions.map((question, questionIndex) => {
        const pick = picks[questionIndex] ?? -1
        return (
          <Stack key={question.id} gap="2">
            <Text fontSize="sm" fontWeight="medium">
              {questionIndex + 1}. {question.question}
            </Text>
            <Stack gap="1.5">
              {question.answers.map((answer, answerIndex) => {
                const state = optionState(question, answerIndex, pick, submitted, !poll)
                return (
                  <Button
                    key={answerIndex}
                    size="sm"
                    justifyContent="flex-start"
                    textAlign="start"
                    h="auto"
                    py="2"
                    {...OPTION_PROPS[state]}
                    aria-pressed={pick === answerIndex}
                    onClick={() => {
                      if (submitted) return
                      setPicks((current) =>
                        current.map((value, index) =>
                          index === questionIndex ? answerIndex : value,
                        ),
                      )
                    }}
                  >
                    {state === 'correct' && <LuCheck />}
                    {state === 'wrong' && <LuX />}
                    {answer}
                  </Button>
                )
              })}
            </Stack>
            {submitted && !poll && question.explanation && (
              <Text fontSize="xs" color="fg.muted">
                {question.explanation}
              </Text>
            )}
          </Stack>
        )
      })}

      {!submitted ? (
        <Button
          colorPalette="brand"
          alignSelf="start"
          disabled={!answered}
          onClick={() => setSubmitted(true)}
        >
          {submitLabel}
        </Button>
      ) : (
        <HStack gap="2" fontSize="sm" color="fg.muted">
          {poll
            ? 'Thanks for answering.'
            : showScore
              ? `Score: ${score.correct}/${score.total}`
              : 'Answers checked.'}
        </HStack>
      )}
    </Stack>
  )
}

/** Registers the schema and its renderer. Idempotent; see `./index`. */
export function registerQuiz(): void {
  registerWidget(quizSchema, QuizWidget)
}
