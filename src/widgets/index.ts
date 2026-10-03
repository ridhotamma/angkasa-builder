/**
 * `@repo/page-builder/widgets` — ready-made custom blocks built on the widget
 * registry.
 *
 * Different shapes of "needs JavaScript", one registry:
 *
 * - **Calculator** — a pure reducer over a keypad, state only.
 * - **Todo list** — a checklist that adds, ticks and deletes items.
 * - **Snake** — a game with a clock, keyboard input and a canvas.
 * - **Tabs** — panels of real blocks behind a tab list.
 * - **Quiz / poll** — questions with choices, scored in the open.
 * - **Estimate** — options with amounts and a running total.
 * - **Before / after** — two images and a draggable divider.
 * - **Countdown** — time left to a moment, inside any layout.
 * - **Order form** — an order built in the browser and sent to WhatsApp.
 *
 * Each is a normal `BlockSchema` plus a React component, so once registered
 * they appear in the editor's Add-block menu, sanitise through the same
 * layout pipeline, and may be emitted by the AI page builder like any other
 * block. Registration is explicit — call `registerWidgets()` from a module
 * both the server and the client load — so importing a single widget does not
 * pull the rest into a bundle.
 */

import { registerBeforeAfter } from './before-after'
import { registerCalculator } from './calculator'
import { registerCountdown } from './countdown'
import { registerEstimate } from './estimate'
import { registerOrderForm } from './order-form'
import { registerQuiz } from './quiz'
import { registerSnake } from './snake'
import { registerTabs } from './tabs'
import { registerTodoList } from './todo-list'

export {
  BeforeAfterWidget,
  beforeAfterSchema,
  clampPosition,
  registerBeforeAfter,
} from './before-after'
export {
  Calculator,
  calculatorSchema,
  formatNumber,
  INITIAL_CALCULATOR,
  pressCalculator,
  registerCalculator,
  type CalculatorKey,
  type CalculatorOperator,
  type CalculatorState,
} from './calculator'
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
  buildOrderMessage,
  MAX_ORDER_ITEMS,
  normalizeWhatsappNumber,
  OrderFormWidget,
  orderFormSchema,
  registerOrderForm,
  whatsappOrderLink,
  type OrderLine,
} from './order-form'
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
export {
  addTodo,
  MAX_TODOS,
  parseTodoItems,
  registerTodoList,
  remainingTodos,
  removeTodo,
  TodoList,
  todoListSchema,
  toggleTodo,
  type TodoItem,
} from './todo-list'
export {
  advanceSnake,
  clampGridSize,
  createSnake,
  directionForKey,
  MAX_GRID,
  MIN_GRID,
  registerSnake,
  SNAKE_SPEED_OPTIONS,
  SNAKE_SPEEDS,
  SnakeGame,
  snakeSchema,
  turnSnake,
  type Cell,
  type Direction,
  type SnakeSpeed,
  type SnakeState,
} from './snake'
export { MAX_TABS, readTabs, registerTabs, TabsWidget, tabsSchema, type WidgetTab } from './tabs'

/** Registers every widget in this entry. Idempotent and safe to call twice. */
export function registerWidgets(): void {
  registerCalculator()
  registerTodoList()
  registerSnake()
  registerTabs()
  registerQuiz()
  registerEstimate()
  registerBeforeAfter()
  registerCountdown()
  registerOrderForm()
}
