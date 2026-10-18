/**
 * The template language's abstract syntax tree.
 *
 * Two families live here. `TemplateNode` is the document half — markup,
 * output, conditionals, loops and snippet calls, in the order they appear.
 * `Expression` is the expression half — the whitelisted grammar an
 * `{{ … }}` or a `{% if %}` may contain.
 *
 * Every node carries the source location it was parsed from, so a compile
 * error can point at the exact expression a developer has to fix.
 *
 * The tree is deliberately small: no assignment, no function definitions, no
 * arbitrary calls. A template is a closure over data, which is what makes it
 * both compilable and safe (see docs/TEMPLATE_ENGINE.md).
 */

import type { SourceLocation } from './diagnostics'

interface Located {
  loc: SourceLocation
}

/* -------------------------------------------------------------------------- */
/* Expressions                                                                */
/* -------------------------------------------------------------------------- */

export interface LiteralExpression extends Located {
  kind: 'literal'
  value: string | number | boolean | null
}

/** `blank` / `empty` as comparison operands — see `isBlank` / `isEmpty` at runtime. */
export interface BlankExpression extends Located {
  kind: 'blank'
}

export interface EmptyExpression extends Located {
  kind: 'empty'
}

export interface VariableExpression extends Located {
  kind: 'variable'
  name: string
}

export interface PropertyExpression extends Located {
  kind: 'property'
  object: Expression
  name: string
}

export interface IndexExpression extends Located {
  kind: 'index'
  object: Expression
  index: Expression
}

export interface FilterExpression extends Located {
  kind: 'filter'
  value: Expression
  name: string
  args: Expression[]
}

export interface UnaryExpression extends Located {
  kind: 'unary'
  operator: 'not'
  operand: Expression
}

export const BINARY_OPERATORS = ['and', 'or', '==', '!=', '<', '>', '<=', '>=', 'contains'] as const

export type BinaryOperator = (typeof BINARY_OPERATORS)[number]

export interface BinaryExpression extends Located {
  kind: 'binary'
  operator: BinaryOperator
  left: Expression
  right: Expression
}

/** `(1..5)` — a list of numbers, bounded at runtime. */
export interface RangeExpression extends Located {
  kind: 'range'
  from: Expression
  to: Expression
}

/**
 * A node the parser could not understand. It exists so one bad expression
 * does not poison the whole tree: the checker and codegen skip it, and the
 * diagnostic the parser already emitted is what the developer acts on.
 */
export interface ErrorExpression extends Located {
  kind: 'error'
  message: string
}

export type Expression =
  | LiteralExpression
  | BlankExpression
  | EmptyExpression
  | VariableExpression
  | PropertyExpression
  | IndexExpression
  | FilterExpression
  | UnaryExpression
  | BinaryExpression
  | RangeExpression
  | ErrorExpression

/* -------------------------------------------------------------------------- */
/* Markup                                                                     */
/* -------------------------------------------------------------------------- */

export interface TextNode extends Located {
  kind: 'text'
  value: string
}

export interface OutputNode extends Located {
  kind: 'output'
  expression: Expression
}

/**
 * One attribute. A value is either `true` (a bare attribute like `disabled`),
 * a plain string, or a mix of literal strings and `{{ … }}` expressions that
 * the codegen concatenates.
 */
export interface AttributeValuePart {
  text?: string
  expression?: Expression
}

export interface AttributeNode {
  name: string
  /** `true` for a bare attribute; otherwise the ordered parts. */
  value: true | AttributeValuePart[]
}

export interface ElementNode extends Located {
  kind: 'element'
  tag: string
  attributes: AttributeNode[]
  children: TemplateNode[]
}

export interface IfBranch {
  loc: SourceLocation
  condition: Expression
  children: TemplateNode[]
}

export interface IfNode extends Located {
  kind: 'if'
  branches: IfBranch[]
  elseChildren: TemplateNode[] | null
}

export interface ForNode extends Located {
  kind: 'for'
  variable: string
  iterable: Expression
  limit: Expression | null
  offset: Expression | null
  reversed: boolean
  children: TemplateNode[]
  elseChildren: TemplateNode[] | null
}

export interface RenderArgument {
  name: string
  value: Expression
}

export interface RenderNode extends Located {
  kind: 'render'
  snippet: string
  args: RenderArgument[]
}

export type TemplateNode = TextNode | OutputNode | ElementNode | IfNode | ForNode | RenderNode

/** A parsed file: its tree plus the raw `{% schema %}` JSON, when it has one. */
export interface ParsedTemplate {
  file: string
  nodes: TemplateNode[]
  schema: string | null
}

/* -------------------------------------------------------------------------- */
/* Walking                                                                    */
/* -------------------------------------------------------------------------- */

/** Every expression in `node`, in document order. */
export function expressionsOf(node: TemplateNode): Expression[] {
  const out: Expression[] = []
  const visitNodes = (nodes: readonly TemplateNode[]) => {
    for (const child of nodes) visitNode(child)
  }
  const visitNode = (child: TemplateNode) => {
    switch (child.kind) {
      case 'text':
        return
      case 'output':
        visitExpression(child.expression)
        return
      case 'element':
        for (const attribute of child.attributes) {
          if (attribute.value === true) continue
          for (const part of attribute.value) if (part.expression) visitExpression(part.expression)
        }
        visitNodes(child.children)
        return
      case 'if':
        for (const branch of child.branches) {
          visitExpression(branch.condition)
          visitNodes(branch.children)
        }
        if (child.elseChildren) visitNodes(child.elseChildren)
        return
      case 'for':
        visitExpression(child.iterable)
        if (child.limit) visitExpression(child.limit)
        if (child.offset) visitExpression(child.offset)
        visitNodes(child.children)
        if (child.elseChildren) visitNodes(child.elseChildren)
        return
      case 'render':
        for (const argument of child.args) visitExpression(argument.value)
        return
    }
  }
  const visitExpression = (expression: Expression) => {
    out.push(expression)
    switch (expression.kind) {
      case 'property':
        visitExpression(expression.object)
        return
      case 'index':
        visitExpression(expression.object)
        visitExpression(expression.index)
        return
      case 'filter':
        visitExpression(expression.value)
        for (const arg of expression.args) visitExpression(arg)
        return
      case 'unary':
        visitExpression(expression.operand)
        return
      case 'binary':
        visitExpression(expression.left)
        visitExpression(expression.right)
        return
      case 'range':
        visitExpression(expression.from)
        visitExpression(expression.to)
        return
      default:
        return
    }
  }
  visitNode(node)
  return out
}

/** Every `{% render %}` in a tree, in document order. */
export function rendersOf(nodes: readonly TemplateNode[]): RenderNode[] {
  const out: RenderNode[] = []
  const visit = (node: TemplateNode) => {
    switch (node.kind) {
      case 'render':
        out.push(node)
        return
      case 'element':
        node.children.forEach(visit)
        return
      case 'if':
        node.branches.forEach((branch) => branch.children.forEach(visit))
        node.elseChildren?.forEach(visit)
        return
      case 'for':
        node.children.forEach(visit)
        node.elseChildren?.forEach(visit)
        return
      default:
        return
    }
  }
  nodes.forEach(visit)
  return out
}
