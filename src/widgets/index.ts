/**
 * `@repo/page-builder/widgets` — ready-made custom blocks built on the widget
 * registry.
 *
 * Different shapes of "needs JavaScript", one registry:
 *
 * - **Tabs** — panels of real blocks behind a tab list.
 * - **Quiz / poll** — questions with choices, scored in the open.
 * - **Estimate** — options with amounts and a running total.
 * - **Before / after** — two images and a draggable divider.
 * - **Countdown** — time left to a moment, inside any layout.
 *
 * Each is a normal `BlockSchema` plus a React component, so once registered
 * they appear in the editor's Add-block menu, sanitise through the same
 * layout pipeline, and may be emitted by the AI page builder like any other
 * block. Registration is explicit — call `registerWidgets()` from a module
 * both the server and the client load — so importing a single widget does not
 * pull the rest into a bundle.
 */

import { registerBeforeAfter } from './before-after'
import { registerCountdown } from './countdown'
import { registerEstimate } from './estimate'
import { registerQuiz } from './quiz'
import { registerTabs } from './tabs'

export {
  BeforeAfterWidget,
  beforeAfterSchema,
  clampPosition,
  registerBeforeAfter,
} from './before-after'
export {
  CountdownWidget,
  countdownSchema,
  registerCountdown,
  splitRemaining,
  type CountdownParts,
} from './countdown'
export {
  EstimateWidget,
  estimateSchema,
  estimateTotal,
  MAX_ESTIMATE_OPTIONS,
  readEstimateOptions,
  registerEstimate,
  type EstimateOption,
} from './estimate'
export {
  MAX_QUIZ_ANSWERS,
  MAX_QUIZ_QUESTIONS,
  parseQuizAnswers,
  QuizWidget,
  quizSchema,
  readQuizQuestions,
  registerQuiz,
  scoreQuiz,
  type QuizQuestion,
} from './quiz'
export { MAX_TABS, readTabs, registerTabs, TabsWidget, tabsSchema, type WidgetTab } from './tabs'

/** Registers every widget in this entry. Idempotent and safe to call twice. */
export function registerWidgets(): void {
  registerTabs()
  registerQuiz()
  registerEstimate()
  registerBeforeAfter()
  registerCountdown()
}
