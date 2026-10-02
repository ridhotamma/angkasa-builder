/**
 * The Blocks section: a canvas of headings, text, buttons, images, columns
 * and spacers.
 *
 * On the storefront every block draws its final state — the same markup a
 * no-JS visitor gets. In the editor's preview, each block gains a hover
 * outline and a click target, so clicking a button or a paragraph selects
 * that block and the panel beside it opens on the block's own size, width,
 * alignment, colour and spacing; typing into a selected text block edits it
 * in place. All of it reads its options from the shared scale in
 * `../model/element-style`, so nothing here invents a size.
 */

import { AspectRatio, Box, Flex, Grid, Heading, Stack, type BoxProps } from '@chakra-ui/react'
import { useContext, type ReactNode } from 'react'

import { useLocale } from '@repo/i18n'
import { ImageWithFallback } from '@repo/theme'

import { blockSchema } from '../model/blocks'
import {
  BUTTON_HOVERS,
  BUTTON_PADDINGS,
  BUTTON_PADDING_X,
  BUTTON_SIZES,
  BUTTON_TONES,
  BUTTON_VARIANTS,
  CONTENT_WIDTHS,
  ELEMENT_ALIGNMENTS,
  HEADING_FONT_SIZE,
  HEADING_LEVELS,
  HEADING_SIZES,
  IMAGE_RATIO,
  IMAGE_RATIOS,
  IMAGE_ROUNDED,
  IMAGE_ROUNDING,
  SELF_WIDTHS,
  SPACE_GAP,
  SPACE_HEIGHT,
  SPACE_PADDING_Y,
  SPACES,
  TEXT_FONT_SIZE,
  TEXT_SIZES,
  buttonAppearance,
  contentLayout,
  readToken,
  selfLayout,
} from '../model/element-style'
import { readBlocks, readLink, readText, type BlockValue } from '../model/fields'
import { localize } from '../model/localized'
import { useRenderEnvironment } from './context'
import {
  buttonHoverCss,
  EditableText,
  EmptyNotice,
  LinkButton,
  SectionIdContext,
} from './primitives'
import { useEmptyText, type SectionProps } from './sections'

/* -------------------------------------------------------------------------- */
/* The section                                                                */
/* -------------------------------------------------------------------------- */

export function BlocksSection({ settings }: SectionProps) {
  const empty = useEmptyText()
  const blocks = readBlocks(settings, 'blocks')
  const gap = SPACE_GAP[readToken(settings, 'gap', SPACES, 'md')]
  if (blocks.length === 0) return <EmptyNotice>{empty('items')}</EmptyNotice>
  return <BlockList blocks={blocks} gap={gap} />
}

function BlockList({ blocks, gap }: { blocks: BlockValue[]; gap: string }) {
  const empty = useEmptyText()
  if (blocks.length === 0) return <EmptyNotice>{empty('items')}</EmptyNotice>
  return (
    <Stack gap={gap}>
      {blocks.map((block) => (
        <BlockView key={block.id} block={block} />
      ))}
    </Stack>
  )
}

function BlockView({ block }: { block: BlockValue }) {
  const content = blockContent(block)
  if (!content) return null
  return <BlockShell block={block}>{content}</BlockShell>
}

function blockContent(block: BlockValue): ReactNode {
  switch (block.type) {
    case 'heading':
      return <HeadingBlock block={block} />
    case 'text':
      return <TextBlock block={block} />
    case 'button':
      return <ButtonBlock block={block} />
    case 'image':
      return <ImageBlock block={block} />
    case 'spacer':
      return <SpacerBlock block={block} />
    case 'column':
      return <ColumnBlock block={block} />
    case 'columns':
      return <ColumnsBlock block={block} />
    default:
      return null
  }
}

/* -------------------------------------------------------------------------- */
/* Canvas selection                                                           */
/* -------------------------------------------------------------------------- */

/**
 * The editor's handle on a block. Live pages get the children untouched; a
 * preview gets a hover/selected outline, a name chip on the selected block,
 * and a click that reports the block to the editor. The
 * `:has([data-block-id]:hover)` guard keeps the outline on the innermost
 * block under the pointer rather than every ancestor.
 */
function BlockShell({ block, children }: { block: BlockValue; children: ReactNode }) {
  const { mode, editing } = useRenderEnvironment()
  const sectionId = useContext(SectionIdContext)
  const { locale } = useLocale()
  const schema = blockSchema(block.type)

  if (mode !== 'preview' || !editing?.onSelectBlock || !sectionId) return <>{children}</>
  const selected = editing.selectedBlockId === block.id

  return (
    <Box
      data-block-id={block.id}
      position="relative"
      rounded="sm"
      cursor="pointer"
      outlineWidth="1px"
      outlineStyle="dashed"
      outlineColor={selected ? 'brand.solid' : 'transparent'}
      css={{
        '&:hover:not(:has([data-block-id]:hover))': {
          outlineColor: selected ? 'brand.solid' : 'brand.muted',
        },
        '&:hover:not(:has([data-block-id]:hover)) [data-block-label]': { opacity: 1 },
      }}
      onClick={(event) => {
        // The innermost block wins: a nested block stops the click before its
        // ancestors' shells see it.
        event.stopPropagation()
        editing.onSelectBlock?.(sectionId, block.id)
      }}
    >
      {children}
      {schema && (
        <Box
          data-block-label=""
          position="absolute"
          top="-2.5"
          left="-1px"
          px="1"
          rounded="sm"
          bg={selected ? 'brand.solid' : 'bg.muted'}
          color={selected ? 'brand.contrast' : 'fg.muted'}
          fontSize="2xs"
          fontWeight="medium"
          lineHeight="1.4"
          pointerEvents="none"
          opacity={selected ? 1 : 0}
          transition="opacity 120ms"
          zIndex="1"
        >
          {localize(schema.name, locale)}
        </Box>
      )}
    </Box>
  )
}

/* -------------------------------------------------------------------------- */
/* Content blocks                                                             */
/* -------------------------------------------------------------------------- */

/**
 * A text block's editable field: plain until the block is selected, then the
 * same inline editor the rest of the builder uses. `onCommit` routes the
 * typed text back into the block's settings, wherever it sits in the tree.
 */
function BlockText({
  block,
  field,
  value,
  as,
  ...props
}: {
  block: BlockValue
  field: string
  value: string
  as?: 'span' | 'p'
} & Omit<BoxProps, 'children' | 'as'>) {
  const { mode, editing } = useRenderEnvironment()
  const sectionId = useContext(SectionIdContext)
  const canEdit = mode === 'preview' && Boolean(editing?.onEditBlockText) && Boolean(sectionId)
  const selected = editing?.selectedBlockId === block.id
  return (
    <EditableText
      field={field}
      value={value}
      as={as}
      editable={canEdit && selected}
      {...(canEdit && {
        onCommit: (next: string) => editing!.onEditBlockText!(sectionId!, block.id, field, next),
      })}
      {...props}
    />
  )
}

function HeadingBlock({ block }: { block: BlockValue }) {
  const value = readText(block.settings, 'text')
  if (!value) return null
  const level = readToken(block.settings, 'level', HEADING_LEVELS, 'h2')
  const size = HEADING_FONT_SIZE[readToken(block.settings, 'size', HEADING_SIZES, 'lg')]
  const align = readToken(block.settings, 'align', ELEMENT_ALIGNMENTS, 'left')
  const width = readToken(block.settings, 'width', CONTENT_WIDTHS, 'full')
  return (
    <Heading as={level} size={size} letterSpacing="-0.01em" {...contentLayout(width, align)}>
      <BlockText block={block} field="text" value={value} />
    </Heading>
  )
}

function TextBlock({ block }: { block: BlockValue }) {
  const value = readText(block.settings, 'body')
  if (!value) return null
  const size = TEXT_FONT_SIZE[readToken(block.settings, 'size', TEXT_SIZES, 'md')]
  const align = readToken(block.settings, 'align', ELEMENT_ALIGNMENTS, 'left')
  const width = readToken(block.settings, 'width', CONTENT_WIDTHS, 'full')
  return (
    <BlockText
      block={block}
      field="body"
      value={value}
      as="p"
      color="fg.muted"
      fontSize={size}
      lineHeight="tall"
      whiteSpace="pre-line"
      {...contentLayout(width, align)}
    />
  )
}

function ButtonBlock({ block }: { block: BlockValue }) {
  const { settings } = useRenderEnvironment()
  const label = readText(block.settings, 'label')
  if (!label) return null
  const size = readToken(block.settings, 'size', BUTTON_SIZES, 'md')
  const padding = readToken(block.settings, 'padding', BUTTON_PADDINGS, 'default')
  const width = readToken(block.settings, 'width', SELF_WIDTHS, 'auto')
  const align = readToken(block.settings, 'align', ELEMENT_ALIGNMENTS, 'left')
  const variant = readToken(block.settings, 'variant', BUTTON_VARIANTS, 'solid')
  const tone = readToken(block.settings, 'tone', BUTTON_TONES, 'brand')
  const hover = readToken(block.settings, 'hover', BUTTON_HOVERS, 'none')
  const appearance = buttonAppearance(tone, variant, settings)
  const layout = selfLayout(width, align)
  return (
    <Flex justify={layout.justify}>
      <LinkButton
        label={label}
        link={readLink(block.settings, 'link')}
        variant="plain"
        size={size}
        rounded="l2"
        px={padding === 'default' ? undefined : BUTTON_PADDING_X[padding]}
        css={buttonHoverCss(hover, appearance)}
        w={layout.w}
        bg={appearance.bg}
        color={appearance.color}
        borderWidth="1px"
        borderColor={appearance.borderColor ?? 'transparent'}
        // The shine leaves the fill alone; only the other hovers shade it.
        _hover={hover === 'shine' ? undefined : { bg: appearance.hoverBg }}
        transition="background-color 150ms ease, border-color 150ms ease, color 150ms ease"
      />
    </Flex>
  )
}

function ImageBlock({ block }: { block: BlockValue }) {
  const { imageUrl } = useRenderEnvironment()
  const fileId = readText(block.settings, 'image')
  const src = fileId ? imageUrl(fileId, { width: 1200, height: 900 }) : null
  if (!src) return null
  const ratio = IMAGE_RATIO[readToken(block.settings, 'ratio', IMAGE_RATIOS, '4/3')]
  const rounded = IMAGE_ROUNDED[readToken(block.settings, 'rounded', IMAGE_ROUNDING, 'md')]
  const width = readToken(block.settings, 'width', CONTENT_WIDTHS, 'full')
  const align = readToken(block.settings, 'align', ELEMENT_ALIGNMENTS, 'left')
  const alt = readText(block.settings, 'alt')
  return (
    <Box {...contentLayout(width, align)}>
      {ratio ? (
        <AspectRatio ratio={ratio} rounded={rounded} overflow="hidden" bg="bg.subtle">
          <ImageWithFallback src={src} alt={alt} objectFit="cover" loading="lazy" />
        </AspectRatio>
      ) : (
        <ImageWithFallback src={src} alt={alt} w="full" rounded={rounded} loading="lazy" />
      )}
    </Box>
  )
}

function SpacerBlock({ block }: { block: BlockValue }) {
  return <Box h={SPACE_HEIGHT[readToken(block.settings, 'size', SPACES, 'md')]} aria-hidden />
}

/* -------------------------------------------------------------------------- */
/* Layout blocks                                                              */
/* -------------------------------------------------------------------------- */

function ColumnBlock({ block }: { block: BlockValue }) {
  const gap = SPACE_GAP[readToken(block.settings, 'gap', SPACES, 'md')]
  const paddingY = SPACE_PADDING_Y[readToken(block.settings, 'padding', SPACES, 'none')]
  const width = readToken(block.settings, 'width', CONTENT_WIDTHS, 'full')
  const align = readToken(block.settings, 'align', ELEMENT_ALIGNMENTS, 'left')
  return (
    <Box py={paddingY} {...contentLayout(width, align)}>
      <BlockList blocks={readBlocks(block.settings, 'blocks')} gap={gap} />
    </Box>
  )
}

const COLUMN_LAYOUT: Record<string, string> = {
  equal: '1fr 1fr',
  leftWide: '3fr 2fr',
  rightWide: '2fr 3fr',
}

const COLUMN_ALIGN: Record<string, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
}

const COLUMN_LAYOUTS = ['equal', 'leftWide', 'rightWide'] as const
const COLUMN_ALIGNS = ['start', 'center', 'end'] as const

function ColumnsBlock({ block }: { block: BlockValue }) {
  const layout = readToken(block.settings, 'layout', COLUMN_LAYOUTS, 'equal')
  const align = readToken(block.settings, 'align', COLUMN_ALIGNS, 'start')
  const gap = SPACE_GAP[readToken(block.settings, 'gap', SPACES, 'lg')]
  return (
    <Grid
      templateColumns={{ base: '1fr', md: COLUMN_LAYOUT[layout] }}
      gap={gap}
      alignItems={COLUMN_ALIGN[align]}
    >
      <BlockList blocks={readBlocks(block.settings, 'left')} gap={gap} />
      <BlockList blocks={readBlocks(block.settings, 'right')} gap={gap} />
    </Grid>
  )
}
