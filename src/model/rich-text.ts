/**
 * Formatted text, stored as a small document tree — never as HTML.
 *
 * The editor (Tiptap) produces ProseMirror JSON, and this module keeps only
 * the part of that vocabulary a shop's text needs: paragraphs, two heading
 * levels, lists, quotes, line breaks, and bold/italic/underline/strike/link.
 * Anything else — an unknown node, a mark with a `javascript:` href, an
 * attribute a crafted payload slipped in — is dropped on the way in, and the
 * storefront draws the tree with its own components, so seller text never
 * reaches the page as markup.
 *
 * Pure and dependency-free like the rest of `model/`: the servers sanitise a
 * layout with it, without loading the editor.
 */

export type RichMark =
  | { type: 'bold' }
  | { type: 'italic' }
  | { type: 'underline' }
  | { type: 'strike' }
  | { type: 'link'; attrs: { href: string } }

export type RichInline = { type: 'text'; text: string; marks?: RichMark[] } | { type: 'hardBreak' }

export type RichBlock =
  | { type: 'paragraph'; content?: RichInline[] }
  | { type: 'heading'; attrs: { level: 2 | 3 }; content?: RichInline[] }
  | { type: 'bulletList'; content: RichListItem[] }
  | { type: 'orderedList'; content: RichListItem[] }
  | { type: 'blockquote'; content: RichBlock[] }

export interface RichListItem {
  type: 'listItem'
  content: RichBlock[]
}

export interface RichDoc {
  type: 'doc'
  content: RichBlock[]
}

export const EMPTY_RICH_DOC: RichDoc = { type: 'doc', content: [] }

/** Lists inside lists inside lists — past this a layout is being abused, not written. */
const MAX_DEPTH = 4

/** Where a link in formatted text may point: the web, an email, a phone, or the shop itself. */
export function isSafeRichHref(href: string): boolean {
  if (href.startsWith('/') && !href.startsWith('//')) return true
  try {
    const url = new URL(href)
    return ['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol)
  } catch {
    return false
  }
}

/** Blank-line paragraphs, the shape text was stored in before it could be formatted. */
export function richDocFromPlainText(text: string): RichDoc {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
  return {
    type: 'doc',
    content: paragraphs.map((paragraph) => ({
      type: 'paragraph',
      content: paragraph
        .split('\n')
        .flatMap((line, index): RichInline[] =>
          index === 0
            ? [{ type: 'text', text: line }]
            : [{ type: 'hardBreak' }, { type: 'text', text: line }],
        ),
    })),
  }
}

/** The words in a document, for measuring it and for places that want plain text. */
export function richDocText(doc: RichDoc): string {
  const blockText = (block: RichBlock | RichListItem): string => {
    if (block.type === 'paragraph' || block.type === 'heading') {
      return (block.content ?? [])
        .map((inline) => (inline.type === 'text' ? inline.text : '\n'))
        .join('')
    }
    return block.content.map(blockText).join('\n')
  }
  return doc.content.map(blockText).join('\n\n')
}

export function isRichDocEmpty(doc: RichDoc): boolean {
  return richDocText(doc).trim() === ''
}

/**
 * Any stored value, as a document of at most `maxChars` characters.
 *
 * A string is text saved before formatting existed and becomes paragraphs.
 * Everything outside the vocabulary above is dropped rather than refused, so a
 * layout that went through an older or newer editor still renders.
 */
export function sanitizeRichDoc(value: unknown, maxChars: number): RichDoc {
  if (typeof value === 'string') return sanitizeRichDoc(richDocFromPlainText(value), maxChars)
  if (!isObject(value) || value.type !== 'doc' || !Array.isArray(value.content)) {
    return { type: 'doc', content: [] }
  }

  const budget = { left: maxChars }
  return { type: 'doc', content: blocks(value.content, 0, budget) }
}

type Budget = { left: number }

function blocks(value: unknown[], depth: number, budget: Budget): RichBlock[] {
  const out: RichBlock[] = []
  for (const node of value) {
    if (budget.left <= 0) break
    const block = blockNode(node, depth, budget)
    if (block) out.push(block)
  }
  return out
}

function blockNode(node: unknown, depth: number, budget: Budget): RichBlock | null {
  if (!isObject(node) || depth > MAX_DEPTH) return null
  const content = Array.isArray(node.content) ? node.content : []

  switch (node.type) {
    case 'paragraph':
      return withInline({ type: 'paragraph' }, inlines(content, budget))
    case 'heading': {
      const level = isObject(node.attrs) && node.attrs.level === 3 ? 3 : 2
      return withInline({ type: 'heading', attrs: { level } }, inlines(content, budget))
    }
    case 'bulletList':
    case 'orderedList': {
      const items = content
        .map((item) => listItem(item, depth + 1, budget))
        .filter((item): item is RichListItem => item !== null)
      return items.length > 0 ? { type: node.type, content: items } : null
    }
    case 'blockquote': {
      const inner = blocks(content, depth + 1, budget)
      return inner.length > 0 ? { type: 'blockquote', content: inner } : null
    }
    default:
      return null
  }
}

function listItem(node: unknown, depth: number, budget: Budget): RichListItem | null {
  if (!isObject(node) || node.type !== 'listItem' || !Array.isArray(node.content)) return null
  const inner = blocks(node.content, depth, budget)
  return inner.length > 0 ? { type: 'listItem', content: inner } : null
}

/** `content` is omitted when empty — the shape the editor itself produces. */
function withInline<T extends { type: string }>(block: T, content: RichInline[]): T & RichBlock {
  return (content.length > 0 ? { ...block, content } : block) as T & RichBlock
}

function inlines(value: unknown[], budget: Budget): RichInline[] {
  const out: RichInline[] = []
  for (const node of value) {
    if (budget.left <= 0) break
    if (!isObject(node)) continue
    if (node.type === 'hardBreak') {
      out.push({ type: 'hardBreak' })
      continue
    }
    if (node.type !== 'text' || typeof node.text !== 'string' || node.text === '') continue
    const text = node.text.slice(0, budget.left)
    budget.left -= text.length
    const marks = Array.isArray(node.marks) ? markList(node.marks) : []
    out.push(marks.length > 0 ? { type: 'text', text, marks } : { type: 'text', text })
  }
  return out
}

function markList(value: unknown[]): RichMark[] {
  const out: RichMark[] = []
  const seen = new Set<string>()
  for (const mark of value) {
    if (!isObject(mark) || typeof mark.type !== 'string' || seen.has(mark.type)) continue
    if (mark.type === 'link') {
      const href =
        isObject(mark.attrs) && typeof mark.attrs.href === 'string' ? mark.attrs.href.trim() : ''
      if (!href || href.length > 2000 || !isSafeRichHref(href)) continue
      out.push({ type: 'link', attrs: { href } })
    } else if (['bold', 'italic', 'underline', 'strike'].includes(mark.type)) {
      out.push({ type: mark.type as 'bold' | 'italic' | 'underline' | 'strike' })
    } else {
      continue
    }
    seen.add(mark.type)
  }
  return out
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
