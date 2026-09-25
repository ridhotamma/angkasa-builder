/**
 * A stored rich-text document, drawn with the page's own components.
 *
 * Each node type maps to one Chakra element; there is no HTML string anywhere
 * on the way, so what a seller typed can only ever become the formatting the
 * vocabulary in `../model/rich-text` allows.
 */

import { Blockquote, Box, Heading, Link, List, Stack, Text } from '@chakra-ui/react'
import type { ReactNode } from 'react'

import {
  isRichDocEmpty,
  type RichBlock,
  type RichDoc,
  type RichInline,
  type RichListItem,
} from '../model/rich-text'

export function RichTextView({ doc, align = 'left' }: { doc: RichDoc; align?: 'left' | 'center' }) {
  if (isRichDocEmpty(doc)) return null
  return (
    <Stack gap="3" textAlign={align} color="fg.muted" lineHeight="tall">
      {doc.content.map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </Stack>
  )
}

function Block({ block }: { block: RichBlock }) {
  switch (block.type) {
    case 'paragraph':
      // An empty paragraph is a blank line the seller left on purpose.
      return <Text minH="1lh">{inlineNodes(block.content)}</Text>
    case 'heading':
      return (
        <Heading
          as={block.attrs.level === 2 ? 'h3' : 'h4'}
          size={block.attrs.level === 2 ? 'lg' : 'md'}
          color="fg"
          mt="2"
        >
          {inlineNodes(block.content)}
        </Heading>
      )
    case 'bulletList':
    case 'orderedList':
      return (
        <List.Root
          as={block.type === 'bulletList' ? 'ul' : 'ol'}
          listStyleType={block.type === 'bulletList' ? 'disc' : 'decimal'}
          ps="5"
          gap="1"
        >
          {block.content.map((item, index) => (
            <ListItem key={index} item={item} />
          ))}
        </List.Root>
      )
    case 'blockquote':
      return (
        <Blockquote.Root>
          <Blockquote.Content>
            <Stack gap="3">
              {block.content.map((inner, index) => (
                <Block key={index} block={inner} />
              ))}
            </Stack>
          </Blockquote.Content>
        </Blockquote.Root>
      )
  }
}

function ListItem({ item }: { item: RichListItem }) {
  return (
    <List.Item>
      {item.content.map((block, index) =>
        // A list item's first paragraph sits on the marker's line.
        index === 0 && block.type === 'paragraph' ? (
          <Box as="span" key={index}>
            {inlineNodes(block.content)}
          </Box>
        ) : (
          <Block key={index} block={block} />
        ),
      )}
    </List.Item>
  )
}

function inlineNodes(content: RichInline[] | undefined): ReactNode {
  return (content ?? []).map((inline, index) => {
    if (inline.type === 'hardBreak') return <br key={index} />
    let node: ReactNode = inline.text
    for (const mark of inline.marks ?? []) {
      switch (mark.type) {
        case 'bold':
          node = <strong>{node}</strong>
          break
        case 'italic':
          node = <em>{node}</em>
          break
        case 'underline':
          node = <u>{node}</u>
          break
        case 'strike':
          node = <s>{node}</s>
          break
        case 'link': {
          const internal = mark.attrs.href.startsWith('/')
          node = (
            <Link
              href={mark.attrs.href}
              color="brand.fg"
              textDecoration="underline"
              {...(!internal && { target: '_blank', rel: 'noopener noreferrer' })}
            >
              {node}
            </Link>
          )
          break
        }
      }
    }
    return (
      <Box as="span" key={index}>
        {node}
      </Box>
    )
  })
}
