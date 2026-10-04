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

/* -------------------------------------------------------------------------- */
/* Simple HTML                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Models sometimes answer a rich-text field with HTML (`<p>…</p>`) instead of
 * words. Stored as-is it would show the tags literally, so a string that
 * *looks* like HTML is parsed into the vocabulary above instead of being kept
 * as text. The parser understands exactly the tags this module allows and
 * ignores everything else — an unknown tag is transparent, a `<script>` is
 * dropped with its contents — so a crafted answer cannot smuggle markup in.
 */
export function looksLikeHtml(value: string): boolean {
  return HTML_TAG.test(value)
}

const HTML_TAG =
  /<\/?(?:p|h[1-6]|ul|ol|li|blockquote|strong|b|em|i|u|s|strike|del|a|br)(?:\s[^>]*)?\/?>/i
const HTML_BLOCK_TAG = /<\/?(?:p|h[1-6]|ul|ol|li|blockquote|div|section|br)(?:\s[^>]*)?\/?>/i
const DROPPED_TAGS = new Set(['script', 'style', 'head', 'title', 'iframe', 'svg'])

const INLINE_TAGS: Record<string, RichMark['type']> = {
  strong: 'bold',
  b: 'bold',
  em: 'italic',
  i: 'italic',
  u: 'underline',
  s: 'strike',
  strike: 'strike',
  del: 'strike',
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '—',
  ndash: '–',
  hellip: '…',
}

interface HtmlToken {
  tag?: string
  closing?: boolean
  attrs?: Record<string, string>
  text?: string
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
    if (code.startsWith('#')) {
      const point = code.startsWith('#x')
        ? Number.parseInt(code.slice(2), 16)
        : Number.parseInt(code.slice(1), 10)
      return Number.isFinite(point) && point > 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : match
    }
    return ENTITIES[code.toLowerCase()] ?? match
  })
}

function parseAttrs(source: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const re = /([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g
  let match: RegExpExecArray | null
  while ((match = re.exec(source))) {
    attrs[match[1]!.toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '')
  }
  return attrs
}

function tokenizeHtml(html: string): HtmlToken[] {
  const tokens: HtmlToken[] = []
  const re = /<!--[\s\S]*?-->|<[^>]*>|[^<]+/g
  let match: RegExpExecArray | null
  while ((match = re.exec(html))) {
    const raw = match[0]
    if (raw.startsWith('<!--')) continue
    if (!raw.startsWith('<')) {
      tokens.push({ text: raw })
      continue
    }
    const tagMatch = /^<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9-]*)([\s\S]*?)\/?\s*>$/.exec(raw)
    if (!tagMatch) continue
    tokens.push({
      tag: tagMatch[2]!.toLowerCase(),
      closing: tagMatch[1] === '/',
      attrs: parseAttrs(tagMatch[3] ?? ''),
    })
  }
  return tokens
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ')
}

/** Drop empty text nodes and trim the block's outer whitespace. */
function trimInline(content: RichInline[]): RichInline[] {
  const out = content.filter((node) => node.type === 'hardBreak' || node.text !== '')
  const first = out[0]
  if (first && first.type === 'text') first.text = first.text.replace(/^\s+/, '')
  const last = out[out.length - 1]
  if (last && last.type === 'text') last.text = last.text.replace(/\s+$/, '')
  return out.filter((node) => node.type === 'hardBreak' || node.text !== '')
}

/** Skip a `<script>`/`<style>` and its contents whole. */
function skipDropped(tokens: readonly HtmlToken[], start: number): number {
  const tag = tokens[start]!.tag!
  let depth = 0
  for (let i = start; i < tokens.length; i += 1) {
    const token = tokens[i]!
    if (token.tag !== tag) continue
    if (token.closing) {
      depth -= 1
      if (depth === 0) return i + 1
    } else {
      depth += 1
    }
  }
  return tokens.length
}

function inlineMarks(marks: Set<string>, href: string | null): RichMark[] {
  const out: RichMark[] = []
  for (const mark of ['bold', 'italic', 'underline', 'strike'] as const) {
    if (marks.has(mark)) out.push({ type: mark })
  }
  if (href) out.push({ type: 'link', attrs: { href } })
  return out
}

function parseInlines(
  tokens: readonly HtmlToken[],
  start: number,
  stopTag: string | null,
): { content: RichInline[]; next: number } {
  const content: RichInline[] = []
  const marks = new Set<string>()
  let href: string | null = null
  let i = start

  while (i < tokens.length) {
    const token = tokens[i]!
    if (token.tag !== undefined) {
      if (token.closing) {
        if (stopTag && token.tag === stopTag) return { content, next: i + 1 }
        // A block closing that is not ours ends this inline run; the caller
        // owns it. An inline closing (`</strong>`) falls through to the marks.
        if (HTML_BLOCK_TAG.test(`<${token.tag}>`)) return { content, next: i }
      }
      if (!stopTag && !token.closing && HTML_BLOCK_TAG.test(`<${token.tag}>`)) {
        return { content, next: i }
      }
      if (!token.closing && DROPPED_TAGS.has(token.tag)) {
        i = skipDropped(tokens, i)
        continue
      }
      if (token.tag === 'br') {
        content.push({ type: 'hardBreak' })
        i += 1
        continue
      }
      const mark = INLINE_TAGS[token.tag]
      if (mark) {
        if (token.closing) marks.delete(mark)
        else marks.add(mark)
        i += 1
        continue
      }
      if (token.tag === 'a') {
        const candidate = token.attrs?.href?.trim() ?? ''
        href =
          !token.closing && candidate && candidate.length <= 2000 && isSafeRichHref(candidate)
            ? candidate
            : null
        i += 1
        continue
      }
      // An unknown inline tag (`span`, `font`, …) is transparent.
      i += 1
      continue
    }

    const text = collapseWhitespace(decodeEntities(token.text ?? ''))
    if (text) {
      const list = inlineMarks(marks, href)
      content.push(list.length > 0 ? { type: 'text', text, marks: list } : { type: 'text', text })
    }
    i += 1
  }

  return { content, next: i }
}

function parseBlocks(
  tokens: readonly HtmlToken[],
  start: number,
  stopTag: string | null,
): { blocks: RichBlock[]; next: number } {
  const blocks: RichBlock[] = []
  let i = start

  while (i < tokens.length) {
    const token = tokens[i]!
    if (token.tag !== undefined) {
      if (token.closing) {
        if (stopTag && token.tag === stopTag) return { blocks, next: i + 1 }
        // An ancestor's closing tag: hand it back rather than swallowing it.
        if (stopTag) return { blocks, next: i }
        i += 1
        continue
      }

      switch (token.tag) {
        case 'p':
        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6': {
          const parsed = parseInlines(tokens, i + 1, token.tag)
          const content = trimInline(parsed.content)
          if (content.length > 0) {
            if (token.tag === 'p') blocks.push({ type: 'paragraph', content })
            else {
              const level = token.tag === 'h1' || token.tag === 'h2' ? 2 : 3
              blocks.push({ type: 'heading', attrs: { level }, content })
            }
          }
          i = parsed.next
          continue
        }
        case 'ul':
        case 'ol': {
          const parsed = parseList(tokens, i + 1, token.tag)
          if (parsed.items.length > 0) {
            blocks.push({
              type: token.tag === 'ul' ? 'bulletList' : 'orderedList',
              content: parsed.items,
            })
          }
          i = parsed.next
          continue
        }
        case 'blockquote': {
          const parsed = parseBlocks(tokens, i + 1, 'blockquote')
          if (parsed.blocks.length > 0) {
            blocks.push({ type: 'blockquote', content: parsed.blocks })
          }
          i = parsed.next
          continue
        }
        case 'br':
          i += 1
          continue
        default:
          // A dropped tag takes its contents with it; anything else is transparent.
          i = DROPPED_TAGS.has(token.tag) ? skipDropped(tokens, i) : i + 1
          continue
      }
    }

    // Loose text outside any tag becomes its own paragraph.
    const parsed = parseInlines(tokens, i, null)
    const content = trimInline(parsed.content)
    if (content.length > 0) blocks.push({ type: 'paragraph', content })
    i = parsed.next > i ? parsed.next : i + 1
  }

  return { blocks, next: i }
}

function parseList(
  tokens: readonly HtmlToken[],
  start: number,
  listTag: string,
): { items: RichListItem[]; next: number } {
  const items: RichListItem[] = []
  let i = start

  while (i < tokens.length) {
    const token = tokens[i]!
    if (token.tag !== undefined) {
      if (token.closing) {
        if (token.tag === listTag) return { items, next: i + 1 }
        return { items, next: i }
      }
      if (token.tag === 'li') {
        const parsed = parseBlocks(tokens, i + 1, 'li')
        if (parsed.blocks.length > 0) items.push({ type: 'listItem', content: parsed.blocks })
        i = parsed.next
        continue
      }
      i = DROPPED_TAGS.has(token.tag) ? skipDropped(tokens, i) : i + 1
      continue
    }

    const parsed = parseInlines(tokens, i, null)
    const content = trimInline(parsed.content)
    if (content.length > 0) {
      items.push({ type: 'listItem', content: [{ type: 'paragraph', content }] })
    }
    i = parsed.next > i ? parsed.next : i + 1
  }

  return { items, next: i }
}

/** A simple HTML answer as the document vocabulary, dropping everything else. */
export function richDocFromHtml(html: string): RichDoc {
  return { type: 'doc', content: parseBlocks(tokenizeHtml(html), 0, null).blocks }
}

/**
 * The same repair for a document that was saved before this parser existed:
 * a paragraph whose whole text is HTML is replaced by what that HTML says.
 */
function repairHtml(value: Record<string, unknown>): unknown[] {
  if (!Array.isArray(value.content)) return []
  return value.content.flatMap((node): unknown[] => {
    if (!isObject(node) || (node.type !== 'paragraph' && node.type !== 'heading')) return [node]
    const text = inlineText(node.content)
    if (!text || !looksLikeHtml(text)) return [node]
    const parsed = richDocFromHtml(text).content
    if (parsed.length === 0) return [node]
    if (!HTML_BLOCK_TAG.test(text)) {
      const first = parsed[0]
      if (first && (first.type === 'paragraph' || first.type === 'heading')) {
        return [{ ...node, content: first.content }]
      }
      return [node]
    }
    return parsed
  })
}

function inlineText(content: unknown): string {
  if (!Array.isArray(content)) return ''
  return content
    .map((node) =>
      isObject(node) && node.type === 'text' && typeof node.text === 'string' ? node.text : '',
    )
    .join('')
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
  if (typeof value === 'string') {
    // A model sometimes answers with HTML; parse it rather than showing tags.
    const doc = looksLikeHtml(value) ? richDocFromHtml(value) : richDocFromPlainText(value)
    return sanitizeRichDoc(doc, maxChars)
  }
  if (!isObject(value) || value.type !== 'doc' || !Array.isArray(value.content)) {
    return { type: 'doc', content: [] }
  }

  const budget = { left: maxChars }
  // A document saved before the HTML parser existed may hold tags as text;
  // repairing here means a stored theme heals on its next read or save.
  return { type: 'doc', content: blocks(repairHtml(value), 0, budget) }
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
