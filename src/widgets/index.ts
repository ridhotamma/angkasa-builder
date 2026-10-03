/**
 * `@repo/page-builder/widgets` — ready-made custom blocks built on the widget
 * registry.
 *
 * Three examples, deliberately different shapes of "needs JavaScript":
 *
 * - **Calculator** — a pure reducer over a keypad, state only.
 * - **Todo list** — a checklist that adds, ticks and deletes items.
 * - **Snake** — a game with a clock, keyboard input and a canvas.
 *
 * Each is a normal `BlockSchema` plus a React component, so once registered
 * they appear in the editor's Add-block menu, sanitise through the same
 * layout pipeline, and may be emitted by the AI page builder like any other
 * block. Registration is explicit — call `registerWidgets()` from a module
 * both the server and the client load — so importing a single widget does not
 * pull the other two into a bundle.
 */

import { registerCalculator } from './calculator'
import { registerSnake } from './snake'
import { registerTodoList } from './todo-list'

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

/** Registers every widget in this entry. Idempotent and safe to call twice. */
export function registerWidgets(): void {
  registerCalculator()
  registerTodoList()
  registerSnake()
}
