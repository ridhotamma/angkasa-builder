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

import {
  AspectRatio,
  Box,
  Flex,
  Grid,
  Heading,
  Icon,
  Stack,
  type BoxProps,
} from '@chakra-ui/react'
import { useContext, type ReactNode } from 'react'

import { useLocale } from '@repo/i18n'
import { ImageWithFallback } from '@repo/theme'

import { blockSchema } from '../model/blocks'
import { blockStyleCss } from '../model/block-style'
import {
  ALIGN_JUSTIFY,
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
import {
  readBlocks,
  readBoolean,
  readLink,
  readRichText,
  readText,
  readVideo,
  type BlockValue,
} from '../model/fields'
import { localize } from '../model/localized'
import { isRichDocEmpty } from '../model/rich-text'
import { blockRenderer, type BlockRenderer } from './block-registry'
import { useRenderEnvironment } from './context'
import { featureIcon } from './icons'
import { VideoFrame } from './media'
import {
  buttonHoverCss,
  EditableText,
  EmptyNotice,
  LinkButton,
  SectionIdContext,
} from './primitives'
import { RichTextView } from './rich-text'
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
  return <Stack gap={gap}>{blockItems(blocks)}</Stack>
}

/**
 * The blocks drawn one by one, with no gap of their own — what a layout block
 * (a row, a grid) arranges itself. Exported so a custom layout renderer can
 * put its own children through the same shells.
 */
export function BlockChildren({ blocks }: { blocks: readonly BlockValue[] }) {
  return <>{blockItems(blocks)}</>
}

function blockItems(blocks: readonly BlockValue[]) {
  return blocks.map((block) => <BlockView key={block.id} block={block} />)
}

function BlockView({ block }: { block: BlockValue }) {
  const content = blockContent(block)
  if (content === null) return null
  return <BlockShell block={block}>{content}</BlockShell>
}

/** The built-in blocks; a registered renderer of the same type wins. */
const BUILT_IN_BLOCKS: Record<string, BlockRenderer> = {
  heading: HeadingBlock,
  text: TextBlock,
  button: ButtonBlock,
  image: ImageBlock,
  spacer: SpacerBlock,
  column: ColumnBlock,
  columns: ColumnsBlock,
  row: RowBlock,
  grid: GridBlock,
  richtext: RichTextBlock,
  icon: IconBlock,
  divider: DividerBlock,
  video: VideoBlock,
  badge: BadgeBlock,
}

function blockContent(block: BlockValue): ReactNode {
  const Renderer = blockRenderer(block.type) ?? BUILT_IN_BLOCKS[block.type]
  return Renderer ? <Renderer block={block} /> : null
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
  // The seller's per-block overrides. On the storefront a block with none is
  // drawn exactly as its section's markup was — no wrapper, no class.
  const css = blockStyleCss(block.style)
  const styled = Object.keys(css).length > 0

  if (mode !== 'preview' || !editing?.onSelectBlock || !sectionId) {
    return styled ? <Box css={css}>{children}</Box> : <>{children}</>
  }
  const selected = editing.selectedBlockId === block.id

  return (
    <Box
      data-block-id={block.id}
      // The editor's outline and label need a positioned ancestor; a style
      // override of the block's own position is applied instead.
      position={css.position === undefined ? 'relative' : undefined}
      rounded={css.borderRadius === undefined ? 'sm' : undefined}
      cursor="pointer"
      outlineWidth="1px"
      outlineStyle="dashed"
      outlineColor={selected ? 'brand.solid' : 'transparent'}
      css={{
        ...css,
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
      // The block owns the click inside a blocks tree; its text is not an
      // element of its own.
      element={false}
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
/* Further primitives                                                         */
/* -------------------------------------------------------------------------- */

function RichTextBlock({ block }: { block: BlockValue }) {
  const doc = readRichText(block.settings, 'body')
  if (isRichDocEmpty(doc)) return null
  const align = readToken(block.settings, 'align', ELEMENT_ALIGNMENTS, 'left')
  const width = readToken(block.settings, 'width', CONTENT_WIDTHS, 'full')
  return (
    <Box {...contentLayout(width, align)}>
      <RichTextView doc={doc} align={align === 'center' ? 'center' : 'left'} />
    </Box>
  )
}

const ICON_SIZES: Record<string, string> = { sm: '4', md: '6', lg: '8', xl: '12' }
const ICON_SIZE_KEYS = ['sm', 'md', 'lg', 'xl'] as const

const ICON_TONES: Record<string, string> = {
  brand: 'var(--chakra-colors-brand-solid)',
  accent: 'var(--pb-accent)',
  muted: 'var(--chakra-colors-fg-muted)',
  dark: 'var(--chakra-colors-fg)',
}
const ICON_TONE_KEYS = ['brand', 'accent', 'muted', 'dark', 'inherit'] as const

function IconBlock({ block }: { block: BlockValue }) {
  const align = readToken(block.settings, 'align', ELEMENT_ALIGNMENTS, 'left')
  const size = readToken(block.settings, 'size', ICON_SIZE_KEYS, 'md')
  const tone = readToken(block.settings, 'tone', ICON_TONE_KEYS, 'brand')
  return (
    <Flex justify={ALIGN_JUSTIFY[align]}>
      <Icon
        as={featureIcon(readText(block.settings, 'icon'))}
        boxSize={ICON_SIZES[size]}
        color={tone === 'inherit' ? 'currentColor' : ICON_TONES[tone]}
        aria-hidden
      />
    </Flex>
  )
}

const DIVIDER_THICKNESS: Record<string, string> = {
  thin: '1px',
  medium: '2px',
  thick: '4px',
}
const DIVIDER_THICKNESS_KEYS = ['thin', 'medium', 'thick'] as const

const DIVIDER_TONES: Record<string, string> = {
  subtle: 'var(--chakra-colors-border-subtle)',
  border: 'var(--chakra-colors-border)',
  strong: 'var(--chakra-colors-fg)',
  brand: 'var(--chakra-colors-brand-solid)',
}
const DIVIDER_TONE_KEYS = ['subtle', 'border', 'strong', 'brand'] as const

function DividerBlock({ block }: { block: BlockValue }) {
  const spacing = readToken(block.settings, 'spacing', SPACES, 'md')
  const thickness = readToken(block.settings, 'thickness', DIVIDER_THICKNESS_KEYS, 'thin')
  const tone = readToken(block.settings, 'tone', DIVIDER_TONE_KEYS, 'border')
  const width = readToken(block.settings, 'width', CONTENT_WIDTHS, 'full')
  const align = readToken(block.settings, 'align', ELEMENT_ALIGNMENTS, 'left')
  return (
    <Box py={SPACE_GAP[spacing]} {...contentLayout(width, align)}>
      <Box h={DIVIDER_THICKNESS[thickness]} bg={DIVIDER_TONES[tone]} rounded="full" />
    </Box>
  )
}

const VIDEO_RATIOS: Record<string, number> = {
  '16/9': 16 / 9,
  '4/3': 4 / 3,
  '1/1': 1,
  '9/16': 9 / 16,
}
const VIDEO_RATIO_KEYS = ['16/9', '4/3', '1/1', '9/16'] as const

function VideoBlock({ block }: { block: BlockValue }) {
  const { imageUrl } = useRenderEnvironment()
  const video = readVideo(block.settings, 'video')
  if (!video) return null
  const posterId = readText(block.settings, 'poster')
  const poster = posterId ? imageUrl(posterId, { width: 1600, height: 900 }) : null
  const ratio = VIDEO_RATIOS[readToken(block.settings, 'ratio', VIDEO_RATIO_KEYS, '16/9')] ?? 16 / 9
  const width = readToken(block.settings, 'width', CONTENT_WIDTHS, 'full')
  const align = readToken(block.settings, 'align', ELEMENT_ALIGNMENTS, 'left')
  return (
    <Box {...contentLayout(width, align)}>
      <VideoFrame
        video={video}
        poster={poster}
        ratio={ratio}
        autoplay={readBoolean(block.settings, 'autoplay')}
        title=""
      />
    </Box>
  )
}

const BADGE_TONES = {
  brand: { bg: 'var(--chakra-colors-brand-solid)', color: 'var(--chakra-colors-brand-contrast)' },
  dark: { bg: 'var(--chakra-colors-fg)', color: 'var(--chakra-colors-bg)' },
  subtle: { bg: 'var(--chakra-colors-bg-muted)', color: 'var(--chakra-colors-fg)' },
  outline: {
    borderWidth: '1px',
    borderColor: 'var(--chakra-colors-border)',
    color: 'var(--chakra-colors-fg)',
  },
} satisfies Record<string, BoxProps>
const BADGE_TONE_KEYS = ['brand', 'dark', 'subtle', 'outline'] as const

function BadgeBlock({ block }: { block: BlockValue }) {
  const label = readText(block.settings, 'text')
  if (!label) return null
  const tone = readToken(block.settings, 'tone', BADGE_TONE_KEYS, 'brand')
  const size = readToken(block.settings, 'size', ['sm', 'md'] as const, 'md')
  const align = readToken(block.settings, 'align', ELEMENT_ALIGNMENTS, 'left')
  return (
    <Flex justify={ALIGN_JUSTIFY[align]}>
      <Box
        as="span"
        display="inline-flex"
        alignItems="center"
        px={size === 'sm' ? '2.5' : '3.5'}
        py={size === 'sm' ? '0.5' : '1'}
        rounded="full"
        fontSize={size === 'sm' ? 'xs' : 'sm'}
        fontWeight="medium"
        lineHeight="1.4"
        {...BADGE_TONES[tone]}
      >
        {label}
      </Box>
    </Flex>
  )
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

const ROW_ALIGNS = ['start', 'center', 'end', 'stretch'] as const
const ROW_JUSTIFIES = ['start', 'center', 'end', 'between', 'around', 'evenly'] as const

const ROW_ALIGN: Record<string, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
}

const ROW_JUSTIFY: Record<string, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
  evenly: 'space-evenly',
}

/**
 * Blocks in a row, wrapping when they run out of width and stacking on a
 * phone unless told otherwise. The flexible layout primitive: put text,
 * buttons, images or whole columns beside each other and size them with
 * their own width and style overrides.
 */
function RowBlock({ block }: { block: BlockValue }) {
  const gap = SPACE_GAP[readToken(block.settings, 'gap', SPACES, 'md')]
  const align = readToken(block.settings, 'align', ROW_ALIGNS, 'stretch')
  const justify = readToken(block.settings, 'justify', ROW_JUSTIFIES, 'start')
  const wrap = readBoolean(block.settings, 'wrap')
  const stack = readBoolean(block.settings, 'stackOnMobile')
  const padding = SPACE_GAP[readToken(block.settings, 'padding', SPACES, 'none')]
  return (
    <Flex
      direction={{ base: stack ? 'column' : 'row', md: 'row' }}
      wrap={wrap ? 'wrap' : 'nowrap'}
      align={ROW_ALIGN[align]}
      justify={ROW_JUSTIFY[justify]}
      gap={gap}
      p={padding}
    >
      {blockItems(readBlocks(block.settings, 'blocks'))}
    </Flex>
  )
}

/**
 * Blocks in a grid of equal columns — cards, features, a gallery of custom
 * content — collapsing to one column on a phone by default.
 */
function GridBlock({ block }: { block: BlockValue }) {
  const columns = Math.min(6, Math.max(1, Number(readText(block.settings, 'columns')) || 2))
  const gap = SPACE_GAP[readToken(block.settings, 'gap', SPACES, 'md')]
  const align = readToken(block.settings, 'align', ROW_ALIGNS, 'stretch')
  const stack = readBoolean(block.settings, 'stackOnMobile')
  const padding = SPACE_GAP[readToken(block.settings, 'padding', SPACES, 'none')]
  return (
    <Grid
      templateColumns={{
        base: stack ? '1fr' : `repeat(${columns}, minmax(0, 1fr))`,
        md: `repeat(${columns}, minmax(0, 1fr))`,
      }}
      gap={gap}
      alignItems={ROW_ALIGN[align]}
      p={padding}
    >
      {blockItems(readBlocks(block.settings, 'blocks'))}
    </Grid>
  )
}
