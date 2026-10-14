'use client'

/**
 * The typography picker: a searchable list over the whole font library.
 *
 * A plain select stopped scaling the moment the library grew past a handful:
 * hundreds of options need search, and the one thing that makes a font picker
 * usable — seeing the letters in the face itself — needs the font loaded.
 * Loading all of them would be hundreds of stylesheets, so previews are lazy:
 * exactly one preview stylesheet is in the document at a time, swapped to
 * whichever family is highlighted (or selected) for the *options in the list*.
 * The trigger stays in the interface font — a control whose own text changes
 * face while browsing reads as a glitch, not a preview. The storefront never
 * sees any of this; it requests only the two families the theme ends up using.
 *
 * The library is ~300 families, so the list is virtualised: only the rows in
 * view are in the DOM, and the popup scrolls a spacer of their total height.
 * Keyboard navigation still reaches every row — as Ark highlights one out of
 * view, it is scrolled into view.
 */

import { Combobox, createListCollection, Portal, ScrollArea, Stack, Text } from '@chakra-ui/react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useMemo, useRef, useState } from 'react'

import { FONT_OPTIONS, type FontCategory } from '../model/font-library'
import { fontHref, fontStack } from '../model/settings'
import { useEditorText } from './messages'

const CATEGORY_LABELS: Record<FontCategory, { en: string; id: string }> = {
  sans: { en: 'Sans', id: 'Sans' },
  serif: { en: 'Serif', id: 'Serif' },
  display: { en: 'Display', id: 'Display' },
  handwriting: { en: 'Script', id: 'Skrip' },
  monospace: { en: 'Mono', id: 'Mono' },
}

const PREVIEW_ATTR = 'data-font-preview'

/** A row's starting height — a family line and its category — before it is measured. */
const ROW_HEIGHT = 44
/** Rows kept mounted beyond the viewport, so a fast scroll never shows a gap. */
const OVERSCAN = 8

/** Keep one preview stylesheet in the document, swapped to `family`. */
function usePreviewFont(family: string | null): void {
  useEffect(() => {
    if (!family) return
    const part = fontHref(family)
    if (!part) return
    let link = document.querySelector<HTMLLinkElement>(`link[${PREVIEW_ATTR}]`)
    if (link?.getAttribute(PREVIEW_ATTR) === family) return
    if (link) link.remove()
    link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?${part}&display=swap`
    link.setAttribute(PREVIEW_ATTR, family)
    document.head.appendChild(link)
  }, [family])
}

export function FontSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (family: string) => void
}) {
  const { t, l } = useEditorText()
  const [query, setQuery] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const collection = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const items = (
      needle
        ? FONT_OPTIONS.filter((font) => font.family.toLowerCase().includes(needle))
        : FONT_OPTIONS
    ).map((font) => ({ value: font.family, label: font.family, category: font.category }))
    return createListCollection({ items })
  }, [query])

  usePreviewFont(preview ?? value)

  const virtualizer = useVirtualizer({
    count: collection.items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  })

  // Ark highlights a value, not an index; scroll that row into view so keyboard
  // navigation works even though off-screen rows are not mounted.
  const revealHighlighted = (highlighted: string | null) => {
    if (highlighted === null || !scrollRef.current) return
    const index = collection.items.findIndex((item) => item.value === highlighted)
    if (index >= 0) virtualizer.scrollToIndex(index, { align: 'auto' })
  }

  return (
    <Combobox.Root
      // Remount when the selected family changes from outside (a look applied,
      // the AI's revision), so the input shows the new name.
      key={value}
      collection={collection}
      size="sm"
      width="full"
      inputBehavior="autohighlight"
      openOnClick
      defaultInputValue={value}
      onInputValueChange={({ inputValue }) => setQuery(inputValue)}
      onValueChange={({ value: next }) => onChange(next[0] ?? '')}
      onHighlightChange={({ highlightedValue }) => {
        setPreview(typeof highlightedValue === 'string' ? highlightedValue : null)
        revealHighlighted(typeof highlightedValue === 'string' ? highlightedValue : null)
      }}
      positioning={{ sameWidth: true }}
    >
      <Combobox.Control>
        <Combobox.Input placeholder={t('fontSearch')} />
        <Combobox.IndicatorGroup>
          <Combobox.Trigger />
        </Combobox.IndicatorGroup>
      </Combobox.Control>
      <Portal>
        <Combobox.Positioner>
          <Combobox.Content p="0" maxH="none" overflow="hidden">
            <ScrollArea.Root size="xs" maxH="xs">
              <ScrollArea.Viewport ref={scrollRef} style={{ overscrollBehavior: 'contain' }}>
                <ScrollArea.Content p="1">
                  <Combobox.Empty>{t('fontNone')}</Combobox.Empty>
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      height: virtualizer.getTotalSize(),
                    }}
                  >
                    {virtualizer.getVirtualItems().map((row) => {
                      const item = collection.items[row.index]!
                      return (
                        <Combobox.Item
                          key={item.value}
                          item={item}
                          ref={virtualizer.measureElement}
                          data-index={row.index}
                          aria-setsize={collection.items.length}
                          aria-posinset={row.index + 1}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            transform: `translateY(${row.start}px)`,
                          }}
                        >
                          <Stack gap="0" minW="0" flex="1">
                            <Text truncate style={{ fontFamily: fontStack(item.value) }}>
                              {item.label}
                            </Text>
                            <Text fontSize="2xs" color="fg.subtle">
                              {l(CATEGORY_LABELS[item.category])}
                            </Text>
                          </Stack>
                          <Combobox.ItemIndicator />
                        </Combobox.Item>
                      )
                    })}
                  </div>
                </ScrollArea.Content>
              </ScrollArea.Viewport>
              <ScrollArea.Scrollbar />
            </ScrollArea.Root>
          </Combobox.Content>
        </Combobox.Positioner>
      </Portal>
    </Combobox.Root>
  )
}
