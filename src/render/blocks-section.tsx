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
  Accordion,
  AspectRatio,
  Box,
  Carousel,
  chakra,
  Container,
  Flex,
  Grid,
  Heading,
  Icon,
  IconButton,
  Marquee,
  Stack,
  Text,
  useCarouselContext,
  useMarqueeContext,
  useMarqueeStyles,
  type BoxProps,
} from '@chakra-ui/react'
import { useContext, useEffect, type ReactNode } from 'react'
import {
  LuChevronDown,
  LuChevronLeft,
  LuChevronRight,
  LuChevronUp,
  LuPause,
  LuPlay,
  LuStar,
} from 'react-icons/lu'

import { StoreMap } from '@repo/geoapify/store-map'
import { useLocale } from '@repo/i18n'
import { ImageWithFallback } from '@repo/theme'

import { blockSchema, findBlock } from '../model/blocks'
import {
  blockStyleCss,
  readBlockBleed,
  readBlockDevices,
  readBlockMotion,
  type BlockStyleCss,
} from '../model/block-style'
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
  type Space,
} from '../model/element-style'
import {
  readBlocks,
  readBoolean,
  readCoordinates,
  readLink,
  readNumber,
  readRichText,
  readText,
  readVideo,
  type BlockValue,
} from '../model/fields'
import { localize, type Localized } from '../model/localized'
import { isRichDocEmpty } from '../model/rich-text'
import { blockRenderer, type BlockRenderer } from './block-registry'
import { useRenderEnvironment } from './context'
import { useRenderText } from './copy'
import { useMounted, usePrefersReducedMotion, useResponsive } from './hooks'
import { FeatureIcon } from './icons'
import { VideoFrame } from './media'
import { Parallax, ScrollReveal } from './motion'
import {
  buttonHoverCss,
  EditableText,
  EmptyNotice,
  LinkButton,
  SectionIdContext,
  type BlockTextOverrideProps,
} from './primitives'
import { RichTextView } from './rich-text'
import { useEmptyText, overlayProps, type SectionProps } from './sections'

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

/**
 * The attributes that mark a block list as a drop target in the editor's
 * preview: which field holds the children and which block (or the section)
 * owns it. Absent on live pages, so nothing leaks to shoppers. Exported for
 * renderers that draw their own list of blocks — the stacked cards' pile.
 */
export function useDropTarget(parentId: string | null, fieldKey: string): Record<string, string> {
  const { mode } = useRenderEnvironment()
  // No section id: a marquee's repeated copy, which is not somewhere to drop.
  const sectionId = useContext(SectionIdContext)
  return mode === 'preview' && sectionId
    ? { 'data-block-list': '', 'data-parent-id': parentId ?? '', 'data-field-key': fieldKey }
    : {}
}

function BlockList({
  blocks,
  gap,
  parentId = null,
  fieldKey = 'blocks',
  justify,
}: {
  blocks: BlockValue[]
  gap: string
  parentId?: string | null
  fieldKey?: string
  /** Vertical packing, for a side of a Columns block whose row is taller. */
  justify?: string
}) {
  const empty = useEmptyText()
  const drop = useDropTarget(parentId, fieldKey)
  if (blocks.length === 0) {
    // An empty column is still somewhere to drop a block from the palette.
    return Object.keys(drop).length > 0 ? (
      <Box {...drop} minH="10" display="flex" alignItems="center" justifyContent="center">
        <BlockPlaceholder label={BLOCK_PLACEHOLDERS.drop} />
      </Box>
    ) : (
      <EmptyNotice>{empty('items')}</EmptyNotice>
    )
  }
  return (
    <Stack gap={gap} justify={justify} {...drop}>
      {blockItems(blocks)}
    </Stack>
  )
}

/**
 * The blocks drawn one by one, with no gap of their own — what a layout block
 * (a row, a grid) arranges itself. Exported so a custom layout renderer can
 * put its own children through the same shells.
 */
export function BlockChildren({ blocks }: { blocks: readonly BlockValue[] }) {
  return <>{blockItems(blocks)}</>
}

/**
 * A blocks list running sideways: every top-level block is one stop, each
 * held to `width` so a plain heading cannot stretch the track. Exported for
 * the scroll rail, whose whole content is one horizontal strip.
 */
export function BlockStrip({
  blocks,
  gap,
  width,
}: {
  blocks: BlockValue[]
  gap: string
  width: BoxProps['w']
}) {
  const drop = useDropTarget(null, 'blocks')
  return (
    <Flex gap={gap} w="max-content" align="stretch" {...drop}>
      {blocks.map((block) => (
        <Box key={block.id} w={width} flexShrink="0">
          <BlockView block={block} />
        </Box>
      ))}
    </Flex>
  )
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
  button: ButtonBlock,
  image: ImageBlock,
  'media-card': MediaCardBlock,
  spacer: SpacerBlock,
  column: ColumnBlock,
  row: RowBlock,
  grid: GridBlock,
  slider: SliderBlock,
  marquee: MarqueeBlock,
  richtext: RichTextBlock,
  icon: IconBlock,
  video: VideoBlock,
  map: MapBlock,
  badge: BadgeBlock,
  rating: RatingBlock,
  collapsible: CollapsibleBlock,
}

function blockContent(block: BlockValue): ReactNode {
  const Renderer = blockRenderer(block.type) ?? BUILT_IN_BLOCKS[block.type]
  return Renderer ? <Renderer block={block} /> : null
}

/**
 * What an empty block says in the editor's preview: a dashed note that marks
 * where the just-added block sits. On the storefront it draws nothing, so an
 * empty block costs no markup there.
 */
const BLOCK_PLACEHOLDERS = {
  heading: { en: 'Write a heading', id: 'Tulis judul' },
  text: { en: 'Write your text', id: 'Tulis teks Anda' },
  richtext: { en: 'Write your text', id: 'Tulis teks Anda' },
  button: { en: 'Set a button label', id: 'Atur label tombol' },
  image: { en: 'Upload your image', id: 'Unggah gambar Anda' },
  video: { en: 'Pick a video', id: 'Pilih video' },
  badge: { en: 'Write a badge label', id: 'Tulis label lencana' },
  icon: { en: 'Pick an icon', id: 'Pilih ikon' },
  collapsible: { en: 'Write a question and its answer', id: 'Tulis pertanyaan dan jawabannya' },
  collapsibleBody: { en: 'Write the answer', id: 'Tulis jawabannya' },
  drop: { en: 'Drag a block here', id: 'Seret blok ke sini' },
} as const satisfies Record<string, Localized>

/**
 * The typography a block's own style overrides set, passed to its inner text
 * element so it beats the block's own size/alignment settings — a wrapper
 * alone cannot, since the text sets its size explicitly.
 */
function blockTextOverrides(block: BlockValue): BlockTextOverrideProps {
  const css = blockStyleCss(block.style)
  const out: BlockTextOverrideProps = {}
  for (const key of [
    'fontFamily',
    'fontSize',
    'fontWeight',
    'lineHeight',
    'letterSpacing',
    'textTransform',
    'fontStyle',
    'textDecoration',
    'textAlign',
    'color',
  ] as const) {
    const value = css[key]
    if (typeof value === 'string' || typeof value === 'number') {
      ;(out as Record<string, unknown>)[key] = value
    }
  }
  // A hover colour has to live on the text element itself: a colour the text
  // sets explicitly (a muted paragraph) beats one inherited from the block's
  // wrapper, so the wrapper alone would never turn red.
  const self = css['&:hover'] as BlockStyleCss | undefined
  const group = css['[data-block-hover-group]:hover &'] as BlockStyleCss | undefined
  const hover = self ?? group
  if (hover && typeof hover.color === 'string') {
    out.css = (
      self
        ? { '&:hover': { color: hover.color } }
        : { '[data-block-hover-group]:hover &': { color: hover.color } }
    ) as BlockTextOverrideProps['css']
  }
  return out
}

function BlockPlaceholder({ label }: { label: Localized }) {
  const { mode } = useRenderEnvironment()
  const { locale } = useLocale()
  if (mode !== 'preview') return null
  return (
    <Box
      borderWidth="1px"
      borderStyle="dashed"
      borderColor="border"
      rounded="md"
      px="4"
      py="6"
      textAlign="center"
      color="fg.muted"
      fontSize="sm"
    >
      {localize(label, locale)}
    </Box>
  )
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
/**
 * A block's own entrance and parallax, resolved from its style overrides and
 * rendered only when the block asked for one — a plain block keeps exactly
 * the markup it had before. The wrappers nest so the reveal and the scroll
 * drift never fight over the same transform.
 */
function BlockMotion({ block, children }: { block: BlockValue; children: ReactNode }) {
  const { entrance, parallax } = readBlockMotion(block.style)
  let content = children
  if (parallax > 0) content = <Parallax amount={parallax}>{content}</Parallax>
  if (entrance) {
    content = (
      <ScrollReveal entrance={entrance} data-block-motion={entrance.key}>
        {content}
      </ScrollReveal>
    )
  }
  return <>{content}</>
}

function BlockShell({ block, children }: { block: BlockValue; children: ReactNode }) {
  const { mode, editing } = useRenderEnvironment()
  const sectionId = useContext(SectionIdContext)
  const { locale } = useLocale()
  const schema = blockSchema(block.type)
  // The seller's per-block overrides. On the storefront a block with none is
  // drawn exactly as its section's markup was — no wrapper, no class.
  const css = blockStyleCss(block.style)
  const styled = Object.keys(css).length > 0
  // A full-width band spans the page, but its words stay in the page column —
  // the same measure the header and the sections around it use.
  const content =
    readBlockBleed(block.style) === 'band' ? (
      <Container maxW="6xl" px={{ base: '4', md: '6' }} w="full">
        {children}
      </Container>
    ) : (
      children
    )
  const motion = <BlockMotion block={block}>{content}</BlockMotion>

  if (mode !== 'preview' || !editing?.onSelectBlock || !sectionId) {
    return styled ? (
      <Box css={css} data-block-hover-group="">
        {motion}
      </Box>
    ) : (
      <>{motion}</>
    )
  }
  const selected = editing.selectedBlockId === block.id
  const devices = readBlockDevices(block.style)

  return (
    <Box
      data-block-id={block.id}
      data-block-hover-group=""
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
      {motion}
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
          {devices !== 'all' && ` · ${localize(DEVICE_CHIPS[devices], locale)}`}
        </Box>
      )}
    </Box>
  )
}

/** The name chip's note on a block narrowed to one kind of screen. */
const DEVICE_CHIPS = {
  mobile: { en: 'Phones only', id: 'Hanya ponsel' },
  desktop: { en: 'Desktop only', id: 'Hanya desktop' },
} as const satisfies Record<string, Localized>

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
  const { mode, editing } = useRenderEnvironment()
  const sectionId = useContext(SectionIdContext)
  const value = readText(block.settings, 'text')
  // While this block is the one being edited in the preview, the field stays
  // mounted even when emptied — swapping in the placeholder would unmount the
  // caret the moment the seller clears the text.
  const editingThis =
    mode === 'preview' &&
    Boolean(editing?.onEditBlockText) &&
    Boolean(sectionId) &&
    editing?.selectedBlockId === block.id
  if (!value && !editingThis) return <BlockPlaceholder label={BLOCK_PLACEHOLDERS.heading} />
  const level = readToken(block.settings, 'level', HEADING_LEVELS, 'h2')
  const size = HEADING_FONT_SIZE[readToken(block.settings, 'size', HEADING_SIZES, 'lg')]
  const align = readToken(block.settings, 'align', ELEMENT_ALIGNMENTS, 'left')
  const width = readToken(block.settings, 'width', CONTENT_WIDTHS, 'full')
  return (
    <Heading
      as={level}
      size={size}
      letterSpacing="-0.01em"
      {...contentLayout(width, align)}
      {...blockTextOverrides(block)}
    >
      <BlockText block={block} field="text" value={value} />
    </Heading>
  )
}

function ButtonBlock({ block }: { block: BlockValue }) {
  const { settings } = useRenderEnvironment()
  const label = readText(block.settings, 'label')
  if (!label) return <BlockPlaceholder label={BLOCK_PLACEHOLDERS.button} />
  const size = readToken(block.settings, 'size', BUTTON_SIZES, 'md')
  const padding = readToken(block.settings, 'padding', BUTTON_PADDINGS, 'default')
  const width = readToken(block.settings, 'width', SELF_WIDTHS, 'auto')
  const align = readToken(block.settings, 'align', ELEMENT_ALIGNMENTS, 'left')
  const variant = readToken(block.settings, 'variant', BUTTON_VARIANTS, 'solid')
  const tone = readToken(block.settings, 'tone', BUTTON_TONES, 'brand')
  const hover = readToken(block.settings, 'hover', BUTTON_HOVERS, 'none')
  const appearance = buttonAppearance(tone, variant, settings, {
    fill: readText(block.settings, 'toneColor'),
    text: readText(block.settings, 'toneTextColor'),
  })
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
        {...blockTextOverrides(block)}
      />
    </Flex>
  )
}

function ImageBlock({ block }: { block: BlockValue }) {
  const { imageUrl } = useRenderEnvironment()
  const fileId = readText(block.settings, 'image')
  const src = fileId ? imageUrl(fileId, { width: 1200, height: 900 }) : null
  if (!src) return <BlockPlaceholder label={BLOCK_PLACEHOLDERS.image} />
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

const MEDIA_CARD_HEIGHTS = ['sm', 'md', 'lg', 'xl'] as const

/** Card heights step with the shared spacing rhythm, not fixed pixels. */
const MEDIA_CARD_HEIGHT: Record<(typeof MEDIA_CARD_HEIGHTS)[number], { base: string; md: string }> =
  {
    sm: { base: '10rem', md: '12rem' },
    md: { base: '14rem', md: '18rem' },
    lg: { base: '18rem', md: '24rem' },
    xl: { base: '24rem', md: '32rem' },
  }

const MEDIA_CARD_POSITIONS = ['middle', 'bottom'] as const
const MEDIA_CARD_ALIGN: Record<(typeof MEDIA_CARD_POSITIONS)[number], string> = {
  middle: 'center',
  bottom: 'flex-end',
}

const MEDIA_CARD_OVERLAYS = ['gradient', 'dark', 'light', 'none'] as const

/**
 * Words on a photo read light. Remapping the theme's text tokens inside the
 * card — the same variables a dark scheme sets on a section — turns every
 * child block light at once, so a heading and a paragraph dropped in stay
 * readable without either being restyled; a block that picks its own colour
 * still wins, since it sets `color` explicitly.
 */
const ON_PHOTO_TEXT = {
  '--chakra-colors-fg': 'white',
  '--chakra-colors-fg-muted': 'rgba(255, 255, 255, 0.85)',
  '--chakra-colors-fg-subtle': 'rgba(255, 255, 255, 0.7)',
} as const

/**
 * A card whose full face is a photo, with the nested blocks on top. The image
 * is a background layer (absolutely positioned and cropped to cover), the
 * shade sits over it, and the content is centred or bottom-packed by the same
 * spacing tokens every other block reads.
 */
function MediaCardBlock({ block }: { block: BlockValue }) {
  const { imageUrl, mode } = useRenderEnvironment()
  const children = readBlocks(block.settings, 'blocks')
  const fileId = readText(block.settings, 'image')
  const src = fileId ? imageUrl(fileId, { width: 1200, height: 1200 }) : null
  if (!src && children.length === 0) return <BlockPlaceholder label={BLOCK_PLACEHOLDERS.image} />
  const overlay = readToken(block.settings, 'overlay', MEDIA_CARD_OVERLAYS, 'gradient')
  const position = readToken(block.settings, 'contentPosition', MEDIA_CARD_POSITIONS, 'middle')
  const height = MEDIA_CARD_HEIGHT[readToken(block.settings, 'height', MEDIA_CARD_HEIGHTS, 'md')]
  const padding = SPACE_PADDING_Y[readToken(block.settings, 'padding', SPACES, 'md')]
  const gap = SPACE_GAP[readToken(block.settings, 'gap', SPACES, 'sm')]
  const rounded = IMAGE_ROUNDED[readToken(block.settings, 'rounded', IMAGE_ROUNDING, 'md')]
  return (
    <Box
      position="relative"
      minH={height}
      rounded={rounded}
      overflow="hidden"
      bg="bg.subtle"
      {...(mode === 'preview' &&
        !src && {
          borderWidth: '1px',
          borderStyle: 'dashed',
          borderColor: 'border',
        })}
      data-block-hover-group=""
    >
      {src && (
        <ImageWithFallback
          src={src}
          alt={readText(block.settings, 'alt')}
          position="absolute"
          inset={0}
          w="full"
          h="full"
          objectFit="cover"
        />
      )}
      {overlay !== 'none' && <Box position="absolute" inset={0} {...overlayProps(overlay)} />}
      <Flex
        position="relative"
        direction="column"
        minH={height}
        justify={MEDIA_CARD_ALIGN[position]}
        p={padding}
        // The colour must be set here, not only as a variable: a heading
        // inherits the resolved body colour, so overriding `--chakra-colors-fg`
        // alone would leave it dark.
        color={overlay === 'none' ? undefined : 'fg'}
        css={overlay === 'none' ? undefined : ON_PHOTO_TEXT}
      >
        <Box w="full">
          <BlockList blocks={children} gap={gap} parentId={block.id} />
        </Box>
      </Flex>
    </Box>
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

/** A gap on the spacing scale — a spacer with `line` set draws the rule. */
function SpacerBlock({ block }: { block: BlockValue }) {
  const size = readToken(block.settings, 'size', SPACES, 'md')
  if (!readBoolean(block.settings, 'line')) return <Box h={SPACE_HEIGHT[size]} aria-hidden />
  const thickness = readToken(block.settings, 'thickness', DIVIDER_THICKNESS_KEYS, 'thin')
  const tone = readToken(block.settings, 'tone', DIVIDER_TONE_KEYS, 'border')
  const width = readToken(block.settings, 'width', CONTENT_WIDTHS, 'full')
  const align = readToken(block.settings, 'align', ELEMENT_ALIGNMENTS, 'left')
  return (
    <Box py={SPACE_GAP[size]} {...contentLayout(width, align)}>
      <Box h={DIVIDER_THICKNESS[thickness]} bg={DIVIDER_TONES[tone]} rounded="full" />
    </Box>
  )
}

/* -------------------------------------------------------------------------- */
/* Further primitives                                                         */
/* -------------------------------------------------------------------------- */

function RichTextBlock({ block }: { block: BlockValue }) {
  const doc = readRichText(block.settings, 'body')
  if (isRichDocEmpty(doc)) return <BlockPlaceholder label={BLOCK_PLACEHOLDERS.richtext} />
  const size = TEXT_FONT_SIZE[readToken(block.settings, 'size', TEXT_SIZES, 'md')]
  const align = readToken(block.settings, 'align', ELEMENT_ALIGNMENTS, 'left')
  const width = readToken(block.settings, 'width', CONTENT_WIDTHS, 'full')
  return (
    <Box {...contentLayout(width, align)}>
      {/* The overrides go on the text element itself, not a wrapper: the rich
          view's own stack sets its colour, so a wrapper's colour — hover
          included — would never reach the words. */}
      <RichTextView
        doc={doc}
        align={align === 'center' ? 'center' : 'left'}
        style={{ fontSize: size, ...blockTextOverrides(block) }}
      />
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
  const color = blockTextOverrides(block).color
  const name = readText(block.settings, 'icon')
  if (!name) return <BlockPlaceholder label={BLOCK_PLACEHOLDERS.icon} />
  return (
    <Flex justify={ALIGN_JUSTIFY[align]}>
      <FeatureIcon
        name={name}
        boxSize={ICON_SIZES[size]}
        color={color ?? (tone === 'inherit' ? 'currentColor' : ICON_TONES[tone])}
        aria-hidden
      />
    </Flex>
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
  if (!video) return <BlockPlaceholder label={BLOCK_PLACEHOLDERS.video} />
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

/** One pin on a map at the block's coordinates. */
function MapBlock({ block }: { block: BlockValue }) {
  const width = readToken(block.settings, 'width', CONTENT_WIDTHS, 'full')
  const align = readToken(block.settings, 'align', ELEMENT_ALIGNMENTS, 'left')
  const zoom = Number(readText(block.settings, 'zoom'))
  const coordinates = readCoordinates(block.settings, 'coordinates')
  return (
    <Box {...contentLayout(width, align)}>
      <StoreMap
        points={
          coordinates
            ? [{ id: block.id, ...coordinates, label: readText(block.settings, 'label') }]
            : []
        }
        zoom={Number.isFinite(zoom) && zoom > 0 ? zoom : 13}
        height={{ base: '14rem', md: '20rem' }}
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
  if (!label) return <BlockPlaceholder label={BLOCK_PLACEHOLDERS.badge} />
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
        {...blockTextOverrides(block)}
      >
        {label}
      </Box>
    </Flex>
  )
}

const RATING_SIZES = ['sm', 'md', 'lg'] as const

const RATING_STAR_SIZE: Record<(typeof RATING_SIZES)[number], string> = {
  sm: '3.5',
  md: '4',
  lg: '5.5',
}

const RATING_TONES = ['yellow', 'brand', 'accent', 'dark'] as const

const RATING_TONE: Record<(typeof RATING_TONES)[number], string> = {
  yellow: 'yellow.solid',
  brand: 'brand.solid',
  accent: 'var(--pb-accent)',
  dark: 'var(--chakra-colors-fg)',
}

/**
 * The five stars a rating is read from. A score between stars fills the next
 * one faintly, exactly like the product page's own rating, so a custom rating
 * and a product's rating never disagree on what 4.8 looks like.
 */
function RatingStars({ score, size, color }: { score: number; size: string; color: string }) {
  return (
    <Flex gap="0.5" color={color} role="img" aria-label={`${score.toFixed(1)}/5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Icon
          key={star}
          as={LuStar}
          boxSize={size}
          fill={score >= star - 0.25 ? 'currentColor' : 'none'}
          opacity={score >= star - 0.75 ? 1 : 0.35}
        />
      ))}
    </Flex>
  )
}

/**
 * The seller's own rating: stars, the average and how many reviews it stands
 * on. Nothing here reads shop data — the numbers are settings — so the block
 * can sit beside a testimonial the seller wrote themselves.
 */
function RatingBlock({ block }: { block: BlockValue }) {
  const text = useRenderText()
  const score = Math.min(5, Math.max(0, readNumber(block.settings, 'score', 5)))
  const count = Math.max(0, readNumber(block.settings, 'count', 0))
  const size = readToken(block.settings, 'size', RATING_SIZES, 'md')
  const tone = readToken(block.settings, 'tone', RATING_TONES, 'yellow')
  const align = readToken(block.settings, 'align', ELEMENT_ALIGNMENTS, 'left')
  const width = readToken(block.settings, 'width', CONTENT_WIDTHS, 'full')
  const label = readText(block.settings, 'label')
  return (
    <Box {...contentLayout(width, align)}>
      <Flex align="center" justify={ALIGN_JUSTIFY[align]} gap="2" wrap="wrap">
        <RatingStars score={score} size={RATING_STAR_SIZE[size]} color={RATING_TONE[tone]} />
        {readBoolean(block.settings, 'showScore') && (
          <Text fontWeight="semibold" {...blockTextOverrides(block)}>
            {score.toFixed(1)}
          </Text>
        )}
        {count > 0 && (
          <Text color="fg.muted" fontSize="sm">
            {`(${text('reviews', { n: count })})`}
          </Text>
        )}
      </Flex>
      {label && (
        <BlockText
          block={block}
          field="label"
          value={label}
          as="p"
          fontSize="sm"
          color="fg.muted"
          mt="1"
        />
      )}
    </Box>
  )
}

/**
 * A heading that folds open to reveal its answer: the FAQ item, the shipping
 * note, anything explained on demand. Every collapsible block is its own
 * fold, so a stack of them reads as an FAQ list.
 */
function CollapsibleBlock({ block }: { block: BlockValue }) {
  const heading = readText(block.settings, 'heading')
  const children = readBlocks(block.settings, 'blocks')
  if (!heading && children.length === 0) {
    return <BlockPlaceholder label={BLOCK_PLACEHOLDERS.collapsible} />
  }
  return (
    <Accordion.Root
      collapsible
      variant="plain"
      borderColor="border"
      defaultValue={readBoolean(block.settings, 'open') ? [block.id] : undefined}
    >
      <Accordion.Item value={block.id} borderBottomWidth="1px" borderColor="border">
        <Accordion.ItemTrigger fontWeight="medium" py="4" textAlign="left">
          <Box flex="1" {...blockTextOverrides(block)}>
            {heading}
          </Box>
          <Accordion.ItemIndicator color="fg.muted" />
        </Accordion.ItemTrigger>
        <Accordion.ItemContent>
          <Accordion.ItemBody pt="0">
            <BlockList blocks={children} gap="md" parentId={block.id} />
          </Accordion.ItemBody>
        </Accordion.ItemContent>
      </Accordion.Item>
    </Accordion.Root>
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
    <Box py={paddingY} data-block-hover-group="" {...contentLayout(width, align)}>
      <BlockList blocks={readBlocks(block.settings, 'blocks')} gap={gap} parentId={block.id} />
    </Box>
  )
}

const COLUMN_LAYOUT: Record<string, string> = {
  equal: '1fr 1fr',
  leftWide: '3fr 2fr',
  rightWide: '2fr 3fr',
}

const COLUMN_JUSTIFY: Record<string, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
}

const COLUMN_LAYOUTS = ['equal', 'leftWide', 'rightWide'] as const

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
  const drop = useDropTarget(block.id, 'blocks')
  const gap = SPACE_GAP[readToken(block.settings, 'gap', SPACES, 'md')]
  const align = readToken(block.settings, 'align', ROW_ALIGNS, 'stretch')
  const justify = readToken(block.settings, 'justify', ROW_JUSTIFIES, 'start')
  const wrap = readBoolean(block.settings, 'wrap')
  const stack = readBoolean(block.settings, 'stackOnMobile')
  const padding = SPACE_GAP[readToken(block.settings, 'padding', SPACES, 'none')]
  const children = readBlocks(block.settings, 'blocks')
  if (children.length === 0) {
    return (
      <Box {...drop} flex="1" minW="0">
        <BlockPlaceholder label={BLOCK_PLACEHOLDERS.drop} />
      </Box>
    )
  }
  return (
    <Flex
      direction={{ base: stack ? 'column' : 'row', md: 'row' }}
      wrap={wrap ? 'wrap' : 'nowrap'}
      align={ROW_ALIGN[align]}
      justify={ROW_JUSTIFY[justify]}
      gap={gap}
      p={padding}
      data-block-hover-group=""
      {...drop}
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
  const drop = useDropTarget(block.id, 'blocks')
  const columns = Math.min(6, Math.max(1, Number(readText(block.settings, 'columns')) || 2))
  const widths = readToken(block.settings, 'widths', COLUMN_LAYOUTS, 'equal')
  // A two-column grid may split unequally; any other count is equal tracks.
  const track =
    columns === 2 && widths !== 'equal'
      ? COLUMN_LAYOUT[widths]
      : `repeat(${columns}, minmax(0, 1fr))`
  const gap = SPACE_GAP[readToken(block.settings, 'gap', SPACES, 'md')]
  const align = readToken(block.settings, 'align', ROW_ALIGNS, 'stretch')
  const stack = readBoolean(block.settings, 'stackOnMobile')
  const padding = SPACE_GAP[readToken(block.settings, 'padding', SPACES, 'none')]
  const children = readBlocks(block.settings, 'blocks')
  if (children.length === 0) {
    return (
      <Box {...drop}>
        <BlockPlaceholder label={BLOCK_PLACEHOLDERS.drop} />
      </Box>
    )
  }
  return (
    <Grid
      templateColumns={{ base: stack ? '1fr' : track, md: track }}
      gap={gap}
      alignItems={ROW_ALIGN[align]}
      p={padding}
      data-block-hover-group=""
      {...drop}
    >
      {blockItems(readBlocks(block.settings, 'blocks'))}
    </Grid>
  )
}

/* -------------------------------------------------------------------------- */
/* Moving blocks                                                              */
/* -------------------------------------------------------------------------- */

/** The spacing scale as CSS lengths, for the carousel's and marquee's own `calc()`. */
const SPACE_LENGTH: Record<Space, string> = {
  none: '0px',
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2.5rem',
}

const TRACK_HEIGHTS = ['sm', 'md', 'lg', 'xl'] as const

/** The window a vertical slider or marquee scrolls inside. */
const TRACK_HEIGHT: Record<(typeof TRACK_HEIGHTS)[number], BoxProps['h']> = {
  sm: { base: '16rem', md: '20rem' },
  md: { base: '22rem', md: '28rem' },
  lg: { base: '28rem', md: '36rem' },
  xl: { base: '34rem', md: '44rem' },
}

/**
 * Whether `id` is `block` or sits anywhere inside it — the editor's question
 * "is the selection in this slide?".
 */
function holdsBlock(block: BlockValue, id: string | null | undefined): boolean {
  if (!id) return false
  if (block.id === id) return true
  const schema = blockSchema(block.type)
  return schema ? findBlock(schema.fields, block.settings, id) !== null : false
}

const SLIDER_ORIENTATIONS = ['horizontal', 'vertical'] as const
const SLIDER_ARROWS = ['overlay', 'none'] as const
const SLIDER_INDICATORS = ['dots', 'count', 'none'] as const
const SLIDER_INTERVALS = ['3', '5', '8'] as const

/** A stored slides-per-page count, clamped to what the field offers. */
function perPageOf(block: BlockValue, key: string, max: number): number {
  const value = Number(readText(block.settings, key))
  return Number.isInteger(value) ? Math.min(max, Math.max(1, value)) : 1
}

/** One slide's share of the track, the same sum the carousel itself does. */
const slideSize = (count: number, spacing: string) =>
  `calc(100% / ${count} - ${spacing} * ${count - 1} / ${count})`

const SLIDER_ARROW = {
  position: 'absolute',
  zIndex: '1',
  rounded: 'full',
  size: 'sm',
  variant: 'subtle',
  bg: 'bg/85',
  shadow: 'md',
} as const

/**
 * Child blocks as slides. Until the page has hydrated it draws the first
 * page as a plain track of the same geometry — what the server, a snapshot
 * and a no-JS visitor see — so nothing jumps when the carousel takes over
 * (the breakpoint is only known in the browser).
 *
 * In the editor, the slider follows the selection: picking a block on slide
 * three scrolls slide three into view and holds autoplay there, so the
 * seller is never editing something off-screen. The slide wrappers carry
 * `data-block-slot`, which tells the palette's drop layer to look one level
 * in for the blocks themselves.
 */
function SliderBlock({ block }: { block: BlockValue }) {
  const drop = useDropTarget(block.id, 'blocks')
  const { editing } = useRenderEnvironment()
  const mounted = useMounted()
  const reduced = usePrefersReducedMotion()
  const slides = readBlocks(block.settings, 'blocks')
  const vertical =
    readToken(block.settings, 'orientation', SLIDER_ORIENTATIONS, 'horizontal') === 'vertical'
  const desktop = perPageOf(block, 'perPage', 4)
  const phone = perPageOf(block, 'perPageMobile', 2)
  const perPage = Math.min(useResponsive({ base: phone, md: desktop }), Math.max(1, slides.length))
  const spacing = SPACE_LENGTH[readToken(block.settings, 'gap', SPACES, 'md')]
  const height = vertical
    ? TRACK_HEIGHT[readToken(block.settings, 'height', TRACK_HEIGHTS, 'md')]
    : undefined
  const peek = readBoolean(block.settings, 'peek') ? '2rem' : undefined
  const arrows = readToken(block.settings, 'arrows', SLIDER_ARROWS, 'overlay')
  const indicator = readToken(block.settings, 'indicator', SLIDER_INDICATORS, 'dots')
  const interval = Number(readToken(block.settings, 'interval', SLIDER_INTERVALS, '5'))
  const autoplay = readBoolean(block.settings, 'autoplay') && !reduced
  const selectedSlide = slides.findIndex((slide) => holdsBlock(slide, editing?.selectedBlockId))

  if (slides.length === 0) {
    return (
      <Box {...drop}>
        <BlockPlaceholder label={BLOCK_PLACEHOLDERS.drop} />
      </Box>
    )
  }

  if (!mounted) {
    const count = (n: number) => Math.min(n, slides.length)
    const size = { base: slideSize(count(phone), spacing), md: slideSize(count(desktop), spacing) }
    return (
      <Grid
        gridAutoFlow={vertical ? 'row' : 'column'}
        {...(vertical ? { gridAutoRows: size, h: height } : { gridAutoColumns: size })}
        gap={spacing}
        overflow="hidden"
        {...(peek && (vertical ? { py: peek } : { px: peek }))}
        data-block-hover-group=""
        {...drop}
      >
        {blockItems(slides)}
      </Grid>
    )
  }

  const paged = slides.length > perPage
  const Prev = vertical ? LuChevronUp : LuChevronLeft
  const Next = vertical ? LuChevronDown : LuChevronRight

  return (
    <Carousel.Root
      slideCount={slides.length}
      slidesPerPage={perPage}
      orientation={vertical ? 'vertical' : 'horizontal'}
      spacing={spacing}
      padding={peek}
      loop={readBoolean(block.settings, 'loop')}
      autoplay={autoplay ? { delay: interval * 1000 } : false}
      allowMouseDrag
      data-block-hover-group=""
    >
      <Box position="relative" flex="1" minW="0">
        <Carousel.ItemGroup
          h={height}
          {...drop}
          {...(Object.keys(drop).length > 0 && { 'data-block-axis': vertical ? 'y' : 'x' })}
        >
          {slides.map((slide, index) => (
            <Carousel.Item
              key={slide.id}
              index={index}
              data-block-slot=""
              // Each slide fills its share of the track, so cards line up
              // at one height and a vertical slide fills the window.
              display="flex"
              flexDirection="column"
              css={{ '& > *': { flex: '1' } }}
            >
              <BlockView block={slide} />
            </Carousel.Item>
          ))}
        </Carousel.ItemGroup>
        {paged && arrows === 'overlay' && (
          <>
            <Carousel.PrevTrigger asChild>
              <IconButton
                {...SLIDER_ARROW}
                {...(vertical
                  ? { top: '2', left: '50%', transform: 'translateX(-50%)' }
                  : { left: '2', top: '50%', transform: 'translateY(-50%)' })}
              >
                <Prev />
              </IconButton>
            </Carousel.PrevTrigger>
            <Carousel.NextTrigger asChild>
              <IconButton
                {...SLIDER_ARROW}
                {...(vertical
                  ? { bottom: '2', left: '50%', transform: 'translateX(-50%)' }
                  : { right: '2', top: '50%', transform: 'translateY(-50%)' })}
              >
                <Next />
              </IconButton>
            </Carousel.NextTrigger>
          </>
        )}
      </Box>
      {paged && (autoplay || indicator !== 'none') && (
        <Flex direction={vertical ? 'column' : 'row'} align="center" justify="center" gap="3">
          {autoplay && (
            // Anything that moves on its own for more than five seconds
            // needs a way to stop it (WCAG 2.2.2).
            <Carousel.AutoplayTrigger asChild>
              <IconButton size="2xs" variant="ghost" rounded="full" color="fg.muted">
                <Carousel.AutoplayIndicator paused={<LuPause />} play={<LuPlay />} />
              </IconButton>
            </Carousel.AutoplayTrigger>
          )}
          {indicator === 'dots' && <Carousel.Indicators />}
          {indicator === 'count' && (
            <Carousel.ProgressText
              fontSize="sm"
              color="fg.muted"
              fontVariantNumeric="tabular-nums"
            />
          )}
        </Flex>
      )}
      <SliderFollowsSelection index={selectedSlide} autoplay={autoplay} />
    </Carousel.Root>
  )
}

/**
 * Editor only: brings the slide holding the selected block into view and
 * holds it there, then lets autoplay carry on once the selection leaves.
 */
function SliderFollowsSelection({ index, autoplay }: { index: number; autoplay: boolean }) {
  const carousel = useCarouselContext()
  useEffect(() => {
    if (index < 0) {
      if (autoplay) carousel.play()
      return
    }
    carousel.pause()
    carousel.scrollToIndex(index)
    // The API object is new on every render; only a new selection should act.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, autoplay])
  return null
}

const MARQUEE_DIRECTIONS = ['left', 'right', 'up', 'down'] as const
const MARQUEE_SIDE = { left: 'start', right: 'end', up: 'top', down: 'bottom' } as const
const MARQUEE_SPEEDS = ['slow', 'normal', 'fast'] as const
/** Pixels per second — the same scale as the logo strip and the testimonials. */
const MARQUEE_SPEED = { slow: 25, normal: 45, fast: 80 } as const
const MARQUEE_ALIGNS = ['start', 'center', 'end'] as const

/**
 * Child blocks in an endless loop. The marquee repeats its content to fill
 * the track; only the first copy is the seller's — the repeats are inert
 * and hidden from assistive tech, and in the editor they render with no
 * selection handles, so a block is never six click targets at once. A
 * selection inside the marquee stops it, so the block holds still while it
 * is edited. Reduced motion gets the row standing still (the recipe's own
 * `_motionReduce`).
 */
function MarqueeBlock({ block }: { block: BlockValue }) {
  const drop = useDropTarget(block.id, 'blocks')
  const { editing } = useRenderEnvironment()
  const items = readBlocks(block.settings, 'blocks')
  const direction = readToken(block.settings, 'direction', MARQUEE_DIRECTIONS, 'left')
  const vertical = direction === 'up' || direction === 'down'
  const speed = MARQUEE_SPEED[readToken(block.settings, 'speed', MARQUEE_SPEEDS, 'normal')]
  const spacing = SPACE_LENGTH[readToken(block.settings, 'gap', SPACES, 'lg')]
  const align =
    COLUMN_JUSTIFY[readToken(block.settings, 'align', MARQUEE_ALIGNS, 'center')] ?? 'center'
  const editingInside = items.some((item) => holdsBlock(item, editing?.selectedBlockId))

  if (items.length === 0) {
    return (
      <Box {...drop}>
        <BlockPlaceholder label={BLOCK_PLACEHOLDERS.drop} />
      </Box>
    )
  }

  return (
    <Marquee.Root
      side={MARQUEE_SIDE[direction]}
      speed={speed}
      spacing={spacing}
      autoFill
      pauseOnInteraction={readBoolean(block.settings, 'pauseOnHover')}
      {...(editingInside && { paused: true })}
      h={
        vertical
          ? TRACK_HEIGHT[readToken(block.settings, 'height', TRACK_HEIGHTS, 'md')]
          : undefined
      }
      minW="0"
      overflow="hidden"
      data-block-hover-group=""
    >
      {readBoolean(block.settings, 'fade') && (
        <>
          <Marquee.Edge side={vertical ? 'top' : 'start'} />
          <Marquee.Edge side={vertical ? 'bottom' : 'end'} />
        </>
      )}
      <Marquee.Viewport>
        <MarqueeCopies alignItems={align} drop={drop}>
          {items.map((item) => (
            <Marquee.Item key={item.id} data-block-slot="">
              <BlockView block={item} />
            </Marquee.Item>
          ))}
        </MarqueeCopies>
      </Marquee.Viewport>
    </Marquee.Root>
  )
}

/**
 * `Marquee.Content`, drawn by hand so each copy can be told apart: the
 * stock part renders the same children into every copy, which would give
 * the editor the same block id several times over.
 */
function MarqueeCopies({
  alignItems,
  drop,
  children,
}: {
  alignItems: string
  drop: Record<string, string>
  children: ReactNode
}) {
  const marquee = useMarqueeContext()
  const styles = useMarqueeStyles()
  return (
    <>
      {Array.from({ length: marquee.contentCount }, (_, index) => (
        <chakra.div
          key={index}
          {...marquee.getContentProps({ index })}
          css={{ ...styles.content, alignItems }}
          {...(index === 0 ? drop : { inert: true })}
        >
          {index === 0 ? (
            children
          ) : (
            // No section id, no editor handles: a repeat is scenery.
            <SectionIdContext.Provider value={null}>{children}</SectionIdContext.Provider>
          )}
        </chakra.div>
      ))}
    </>
  )
}
