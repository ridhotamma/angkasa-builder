'use client'

/**
 * The typography picker: a searchable list over the whole font library.
 *
 * A plain select stopped scaling the moment the library grew past a handful:
 * hundreds of options need search, and the one thing that makes a font picker
 * usable — seeing the letters in the face itself — needs the font loaded.
 * Loading all of them would be hundreds of stylesheets, so previews are lazy:
 * exactly one preview stylesheet is in the document at a time, swapped to
 * whichever family is highlighted (or selected). The storefront never sees any
 * of this; it requests only the two families the theme ends up using.
 */

import { Combobox, createListCollection, Portal, ScrollArea, Stack, Text } from '@chakra-ui/react'
import { useEffect, useMemo, useState } from 'react'

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
      onHighlightChange={({ highlightedValue }) =>
        setPreview(typeof highlightedValue === 'string' ? highlightedValue : null)
      }
      positioning={{ sameWidth: true }}
    >
      <Combobox.Control>
        <Combobox.Input placeholder={t('fontSearch')} fontFamily={fontStack(value)} />
        <Combobox.IndicatorGroup>
          <Combobox.Trigger />
        </Combobox.IndicatorGroup>
      </Combobox.Control>
      <Portal>
        <Combobox.Positioner>
          <Combobox.Content p="0" maxH="none" overflow="hidden">
            <ScrollArea.Root size="xs" maxH="xs">
              <ScrollArea.Viewport style={{ overscrollBehavior: 'contain' }}>
                <ScrollArea.Content p="1">
                  <Combobox.Empty>{t('fontNone')}</Combobox.Empty>
                  {collection.items.map((item) => (
                    <Combobox.Item item={item} key={item.value}>
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
                  ))}
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
