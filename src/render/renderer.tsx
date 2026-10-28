/**
 * A layout, drawn.
 *
 * `ThemeScope` puts a theme's CSS variables on one wrapping element, so the
 * same document can show the editor's own chrome in the host's own theme and the
 * preview beside it in the shop's. `SectionsRenderer` walks the section list
 * and hands each one to its renderer, inside the frame its style asks for.
 */

import { Badge, Box, chakra, Stack, type BoxProps } from '@chakra-ui/react'
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { SECTION_STICKY_ENABLED } from '../model/flags'
import { useLocale } from '../locale'

import {
  drawnSections,
  isFullBleed,
  liveSections,
  NO_PAGE_EDGES,
  pageEdges,
  type PageEdges,
} from '../model/drawn'
import type { SectionInstance } from '../model/content'

export { drawnSections, isFullBleed, liveSections, NO_PAGE_EDGES, pageEdges, type PageEdges }
import { resolveLocalizedSettings } from '../model/localize-settings'
import { sectionAnchorId } from '../model/links'
import { localize } from '../model/localized'
import { readSectionStyle, SCHEDULE_LABELS, scheduleState } from '../model/section-style'
import { isFloatingSection } from '../model/sections'
import { effectCss, themeCssVars, themeModeCssVars, type ThemeSettings } from '../model/settings'
import { HEADER_OFFSET_VAR } from './chrome'
import { RenderProvider, useRenderEnvironment, type RenderEnvironment } from './context'
import { SectionFrame } from './frame'
import { requestMotionRefresh } from './motion/engine'
import { SectionElementsContext, SectionIdContext } from './primitives'
import { SECTION_RENDERERS } from './registry'
import { sectionBackground } from './section-background'

/** One shared empty map, so a section without overrides never re-renders on identity. */
const NO_ELEMENTS: Record<string, never> = {}

export function ThemeScope({
  settings,
  mode,
  children,
  ...props
}: {
  settings: ThemeSettings
  /**
   * The colour mode to paint. Omitted, the theme paints as designed (the
   * snapshots and the storefront's server render); the editor preview passes
   * its toolbar's choice so the preview can follow the seller's toggle.
   */
  mode?: 'light' | 'dark'
  children: ReactNode
} & BoxProps) {
  return (
    <Box
      css={mode ? themeModeCssVars(settings, mode) : themeCssVars(settings)}
      bg="bg"
      color="fg"
      fontFamily="body"
      {...props}
    >
      {/* The same effect rules the storefront inlines, so the editor preview
          and snapshots transition like the live page. Unlayered like the
          variables; data-attribute scoped, so dashboard chrome beside the
          preview is untouched. */}
      <style>{effectCss(settings)}</style>
      {children}
    </Box>
  )
}

export interface SectionsRendererProps {
  sections: readonly SectionInstance[]
  env: RenderEnvironment
  /** Editor only: highlights a section and reports clicks on one. */
  selectedId?: string | null
  onSelect?: (id: string) => void
  /**
   * Editor only: quick actions for the selected section (move, duplicate,
   * remove), drawn on its outline. The editor supplies them, so the renderer
   * needs to know nothing about editing.
   */
  toolbar?: (section: SectionInstance) => ReactNode
  /**
   * Editor only: which sections `onSelect` applies to — all of them when
   * omitted. A frame around an article makes only its header pickable.
   */
  pickable?: (section: SectionInstance) => boolean
  /** Editor only: the name a hovered or selected section shows on its outline. */
  label?: (section: SectionInstance) => string
  /**
   * Editor only: a "+" on the hovered section's outline asks for a new section
   * next to it — after it, or before the first one.
   */
  onInsert?: (sectionId: string, place: 'before' | 'after') => void
  /** The "+" button's accessible name. */
  insertLabel?: string
  /**
   * Draw only this section, spaced as it sits among the others — what a
   * fragment swapped into a page that is already showing needs.
   */
  only?: string
}

/** The space between two sections in the page column. */
const SECTION_GAP = { base: '10', md: '14' } as const

/** The nearest section before `index` that takes part in the page flow. */
function flowBefore(
  visible: readonly SectionInstance[],
  index: number,
): SectionInstance | undefined {
  for (let i = index - 1; i >= 0; i--) {
    const candidate = visible[i]
    if (candidate && !isFloatingSection(candidate.type)) return candidate
  }
  return undefined
}

export function SectionsRenderer({
  sections,
  env,
  selectedId,
  onSelect,
  toolbar,
  pickable,
  label,
  onInsert,
  insertLabel,
  only,
}: SectionsRendererProps) {
  const now = env.now ?? new Date()
  const visible = drawnSections(sections, env.mode, now)

  // Read through a ref, so every item gets the same function and a memoized
  // item is not re-drawn just because the editor rendered again.
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const pick = useCallback((id: string) => onSelectRef.current?.(id), [])
  const onInsertRef = useRef(onInsert)
  onInsertRef.current = onInsert
  const insert = useCallback(
    (id: string, place: 'before' | 'after') => onInsertRef.current?.(id, place),
    [],
  )

  // The editor redraws on every edit; a ScrollTrigger measured against the
  // old layout is re-measured once the new one has painted.
  useEffect(() => {
    requestMotionRefresh()
  }, [sections])

  return (
    <RenderProvider value={env}>
      <Stack gap="0">
        {visible.map((section, index) => {
          if (only !== undefined && section.id !== only) return null
          // Two full-bleed sections in a row touch, like bands on a poster:
          // the page gap between them would be a strip of page background.
          // Their own "space above/below" is what separates them. A floating
          // section paints outside the flow, so it never carries the gap and
          // is skipped when looking for the neighbour a gap is measured from.
          const previous = flowBefore(visible, index)
          const floating = isFloatingSection(section.type)
          const bleed = isFullBleed(section)
          const flush = floating || !previous || (bleed && isFullBleed(previous))
          const selected = section.id === selectedId
          return (
            <SectionItem
              key={section.id}
              section={section}
              flush={flush}
              floating={floating}
              pickable={Boolean(onSelect) && (pickable?.(section) ?? true)}
              selected={selected}
              first={index === 0}
              toolbar={selected && toolbar ? toolbar(section) : null}
              onSelect={pick}
              label={label?.(section)}
              onInsert={onInsert ? insert : undefined}
              insertLabel={insertLabel}
            />
          )
        })}
      </Stack>
    </RenderProvider>
  )
}

/**
 * One drawn section. Memoized: typing into one section's settings changes that
 * section's object and no other, so every other section — and its outline,
 * measured against the layout on each of its renders — is left alone. That is
 * what keeps a keystroke from re-drawing, and re-measuring, the whole page.
 */
const SectionItem = memo(function SectionItem({
  section,
  flush,
  floating,
  pickable,
  selected,
  first,
  toolbar,
  onSelect,
  label,
  onInsert,
  insertLabel,
}: {
  section: SectionInstance
  flush: boolean
  floating: boolean
  pickable: boolean
  selected: boolean
  first: boolean
  toolbar: ReactNode
  onSelect: (id: string) => void
  label?: string
  onInsert?: (sectionId: string, place: 'before' | 'after') => void
  insertLabel?: string
}) {
  const { now } = useRenderEnvironment()
  const Section = SECTION_RENDERERS[section.type]
  const { locale } = useLocale()
  // The seller's copy, resolved to the reader's locale. Identity is preserved
  // when nothing is translated, so a single-language shop re-renders as before.
  const settings = useMemo(
    () => resolveLocalizedSettings(section.type, section.settings, locale),
    [section.type, section.settings, locale],
  )
  if (!Section) return null
  const mt = flush ? '0' : SECTION_GAP

  /**
   * The section's "Stick while scrolling" band.
   *
   * The position goes on this wrapper, never on the frame inside it. A sticky
   * box is clamped to its containing block, and the frame's parent is this
   * wrapper — exactly the frame's own height, so a sticky frame has nowhere to
   * travel and scrolls away like any other. The wrapper's containing block is
   * the whole column of sections, so here the section holds at the top while
   * the sections after it (later in the DOM, painted above) scroll up over it.
   *
   * Switched off for now (`SECTION_STICKY_ENABLED`): a stored `sticky: true`
   * is read but not applied, so no layout pins a section until the feature is
   * turned back on.
   */
  const sticky =
    SECTION_STICKY_ENABLED && readSectionStyle(section.style).sticky
      ? ({ position: 'sticky', top: '0' } as const)
      : null

  const rendered = (
    <SectionIdContext.Provider value={section.id}>
      <SectionElementsContext.Provider value={section.elements ?? NO_ELEMENTS}>
        <SectionFrame
          style={section.style}
          background={sectionBackground(section)}
          floating={floating}
        >
          <Section settings={settings} />
        </SectionFrame>
      </SectionElementsContext.Provider>
    </SectionIdContext.Provider>
  )
  // Every drawn section lands below the sticky header when a section link
  // scrolls to it, and carries the anchor that link targets (`anchorId`).
  const anchorStyle = { scrollMarginTop: `var(${HEADER_OFFSET_VAR}, 0px)` }

  if (!pickable)
    return (
      <Box id={sectionAnchorId(section.id)} mt={mt} {...sticky} {...anchorStyle}>
        {rendered}
      </Box>
    )

  return (
    <PickableSection
      mt={mt}
      id={section.id}
      anchorId={sectionAnchorId(section.id)}
      {...sticky}
      {...anchorStyle}
      selected={selected}
      first={first}
      toolbar={toolbar}
      label={label}
      onInsert={onInsert && ((place) => onInsert(section.id, place))}
      insertLabel={insertLabel}
      badge={<ScheduleBadge section={section} now={now ?? new Date()} />}
      onClickCapture={(event) => {
        const target = event.target as HTMLElement
        // A slider's arrows and dots are navigation, not an action that leaves
        // the canvas: let the seller try them without the picker swallowing
        // the click. Everything else stays a selection, as below.
        if (target.closest('[data-slider-control]')) return
        // A block or element inside the section owns its own click: it
        // selects itself and the section on the way up, and clearing it here
        // first would unmount the very field the click was aiming at.
        if (target.closest('[data-block-id]') || target.closest('[data-element-id]')) return
        // The selected section's own toolbar (move, duplicate, remove) works.
        if (target.closest('[data-section-outline]')) return
        // Anywhere else, a click is a *selection*, not a use: links do not
        // navigate and controls do not act — no accordion opens, no tab
        // switches, no slider moves, no dialog or drawer appears. The seller
        // tries the section out in the storefront preview instead. Editable
        // text is left alone so the caret can land in it.
        if (!target.closest('[data-editable]')) {
          event.preventDefault()
          event.stopPropagation()
        }
        onSelect(section.id)
      }}
    >
      {rendered}
    </PickableSection>
  )
})

/** How far the outline stands off a section, and how far in it sits where the section meets the page edge. */
const OUTLINE_GAP = 6
const OUTLINE_INSET = 2

/** The outline's box, in the wrapper's coordinates. */
interface OutlineBox {
  top: number
  left: number
  width: number
  height: number
  /** The section runs across the page, edge to edge. */
  band: boolean
}

/**
 * Where the outline goes: around the box the section is actually drawn in.
 *
 * That is not the wrapper. A full-width or edge-to-edge section breaks out of
 * the page column, so an outline on the column's wrapper cut through it. The
 * frame's offset box is measured instead, which the scroll-reveal transform
 * does not skew. The outline stands off the section, but is kept inside the
 * page so the frame's edges never cut it off. A section that spans the page
 * gets its outline just inside its own edges.
 */
function measureOutline(wrapper: HTMLElement): OutlineBox | null {
  const frame = wrapper.firstElementChild as HTMLElement | null
  // A section hidden on this device has no box to outline.
  if (!frame || frame.offsetWidth === 0) return null
  const page = wrapper.ownerDocument.documentElement.clientWidth
  const wrapperRect = wrapper.getBoundingClientRect()
  const origin = wrapperRect.left
  let start = frame.offsetLeft
  let end = start + frame.offsetWidth
  // A full-bleed block escapes the frame it sits in; the section's outline
  // should cover it rather than cut through it.
  for (const node of frame.querySelectorAll<HTMLElement>('[data-block-id]')) {
    const rect = node.getBoundingClientRect()
    start = Math.min(start, rect.left - origin)
    end = Math.max(end, rect.right - origin)
  }
  const band = origin + start <= OUTLINE_GAP && origin + end >= page - OUTLINE_GAP
  const gap = band ? -OUTLINE_INSET : OUTLINE_GAP
  const left = Math.max(start - gap, OUTLINE_INSET - origin)
  const right = Math.min(end + gap, page - OUTLINE_INSET - origin)
  return {
    top: frame.offsetTop - gap,
    left,
    width: right - left,
    height: frame.offsetHeight + 2 * gap,
    band,
  }
}

function sameBox(a: OutlineBox | null, b: OutlineBox | null) {
  if (!a || !b) return a === b
  return (
    a.top === b.top &&
    a.left === b.left &&
    a.width === b.width &&
    a.height === b.height &&
    a.band === b.band
  )
}

/**
 * A section in the editor: clickable, outlined when hovered or selected, with
 * the selected one's toolbar on the outline's top-right corner. The toolbar
 * tucks inside the corner on a section that spans the page, where above is
 * the section before it, and on the first section, where above is the store
 * header.
 */
function PickableSection({
  id,
  anchorId,
  selected,
  first,
  toolbar,
  badge,
  label,
  onInsert,
  insertLabel,
  children,
  ...props
}: {
  /** The section's own id, for the editor's `data-section-id` hook. */
  id: string
  /** The DOM id a section link scrolls to — `section-<id>`. */
  anchorId: string
  selected: boolean
  first: boolean
  toolbar: ReactNode
  badge: ReactNode
  /** The section's name, tagged on the outline's corner while hovered or selected. */
  label?: string
  onInsert?: (place: 'before' | 'after') => void
  insertLabel?: string
  children: ReactNode
} & BoxProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<OutlineBox | null>(null)

  const update = () => {
    const wrapper = ref.current
    if (!wrapper) return
    const next = measureOutline(wrapper)
    setBox((previous) => (sameBox(previous, next) ? previous : next))
  }

  // Every render: a style change can swap the frame for a wider one without
  // resizing the wrapper.
  useLayoutEffect(update)

  // And whenever the section or the page changes size on its own: images
  // loading, the device switched, a scrollbar appearing.
  useLayoutEffect(() => {
    const wrapper = ref.current
    const view = wrapper?.ownerDocument.defaultView
    if (!wrapper || !view) return
    const observer = new view.ResizeObserver(update)
    observer.observe(wrapper)
    observer.observe(wrapper.ownerDocument.documentElement)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const inside = first || !!box?.band
  return (
    <Box
      ref={ref}
      id={anchorId}
      data-section-id={id}
      position="relative"
      cursor="pointer"
      css={{
        '&:hover > [data-section-outline]': {
          borderColor: selected ? 'brand.solid' : 'brand.muted',
        },
        // The name tag and the "+" show with the outline; the selected
        // section keeps its tag.
        '&:hover > [data-section-outline] [data-outline-extra]': { opacity: 1 },
      }}
      {...props}
    >
      {children}
      {badge}
      {box && (
        <Box
          data-section-outline=""
          position="absolute"
          // Over the store header (`docked`, 10), so the selected section's
          // toolbar is never under a sticky or see-through header — and below
          // dropdowns (1000), so the header's own menus still open over it.
          zIndex="11"
          pointerEvents="none"
          rounded="md"
          borderWidth="2px"
          borderColor={selected ? 'brand.solid' : 'transparent'}
          transition="border-color 120ms"
          style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
        >
          {label && (
            <Box
              data-outline-extra=""
              position="absolute"
              left={inside ? '2' : '-2px'}
              top={inside ? '2' : '-2px'}
              transform={inside ? undefined : 'translateY(-100%)'}
              opacity={selected ? 1 : 0}
              transition="opacity 120ms"
              px="1.5"
              py="0.5"
              roundedTop={inside ? 'sm' : 'md'}
              roundedBottom={inside ? 'sm' : '0'}
              bg={selected ? 'brand.solid' : 'brand.muted'}
              color={selected ? 'brand.contrast' : 'brand.fg'}
              fontSize="11px"
              fontWeight="semibold"
              lineHeight="1.4"
              whiteSpace="nowrap"
              maxW="60%"
              overflow="hidden"
              textOverflow="ellipsis"
              fontFamily="system-ui, sans-serif"
            >
              {label}
            </Box>
          )}
          {onInsert && first && (
            <InsertButton place="top" label={insertLabel} onClick={() => onInsert('before')} />
          )}
          {onInsert && (
            <InsertButton place="bottom" label={insertLabel} onClick={() => onInsert('after')} />
          )}
          {toolbar && (
            <Box
              position="absolute"
              pointerEvents="auto"
              // The border is inside the box: -2px lines the toolbar up with its outer edge.
              right={inside ? '2' : '-2px'}
              top={inside ? '2' : '-2px'}
              transform={inside ? undefined : 'translateY(calc(-100% - 4px))'}
            >
              {toolbar}
            </Box>
          )}
        </Box>
      )}
    </Box>
  )
}

/**
 * The "+" on a hovered section's top or bottom edge: a new section goes in
 * right there, instead of at the end of the page.
 */
function InsertButton({
  place,
  label,
  onClick,
}: {
  place: 'top' | 'bottom'
  label?: string
  onClick: () => void
}) {
  return (
    <chakra.button
      type="button"
      data-outline-extra=""
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      position="absolute"
      left="50%"
      {...(place === 'top' ? { top: '0' } : { bottom: '0' })}
      transform={`translate(-50%, ${place === 'top' ? '-50%' : '50%'})`}
      pointerEvents="auto"
      opacity={0}
      transition="opacity 120ms, transform 120ms"
      boxSize="7"
      rounded="full"
      bg="brand.solid"
      color="brand.contrast"
      shadow="md"
      display="flex"
      alignItems="center"
      justifyContent="center"
      cursor="pointer"
      _hover={{ bg: 'brand.emphasized' }}
      _focusVisible={{ opacity: 1, outline: '2px solid', outlineColor: 'brand.focusRing' }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
    </chakra.button>
  )
}

/** In the editor: says a section is timed, and dims one that is not on the storefront now. */
function ScheduleBadge({ section, now }: { section: SectionInstance; now: Date }) {
  const { locale } = useLocale()
  const style = readSectionStyle(section.style)
  const state = scheduleState(style, now)
  if (state === 'always') return null
  const when = state === 'scheduled' ? style.showFrom : style.showUntil
  const date = when?.toLocaleString(locale === 'id' ? 'id-ID' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  return (
    <Badge
      position="absolute"
      top="2"
      right="2"
      zIndex="2"
      colorPalette={state === 'live' ? 'green' : state === 'scheduled' ? 'blue' : 'gray'}
      variant="solid"
      shadow="sm"
    >
      {localize(SCHEDULE_LABELS[state], locale)}
      {date ? ` · ${date}` : ''}
    </Badge>
  )
}
