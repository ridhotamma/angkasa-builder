/**
 * The icon picker: one searchable grid over the shared icon catalogue.
 *
 * A single box doubles as the current selection and the search field — it shows
 * the chosen icon's name beside its glyph, with a "Close" that clears it — and
 * the grid below draws every glyph, filtered as the seller types. "No icon" is
 * a real choice, so a stored `''` renders as nothing rather than a fallback.
 *
 * Values are the Lucide names the catalogue stores (`shield-check`); see
 * `model/icons` for the names and `render/icons` for the glyphs.
 */

import {
  Box,
  Button,
  Icon,
  IconButton,
  Input,
  InputGroup,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react'
import { useState } from 'react'

import { Tooltip } from '@repo/theme'

import { ICON_NAMES, NO_ICON, resolveIconName, type IconName } from '../model/icons'
import { ICON_GLYPHS } from './icon-glyphs'

import { useEditorText } from './messages'

/** One glyph in the grid, marked when it is the current choice. */
function IconOption({
  name,
  selected,
  onPick,
}: {
  name: IconName
  selected: boolean
  onPick: (name: IconName) => void
}) {
  return (
    <Tooltip content={name}>
      <IconButton
        aria-label={name}
        aria-pressed={selected}
        size="sm"
        variant={selected ? 'subtle' : 'ghost'}
        colorPalette={selected ? 'brand' : undefined}
        rounded="md"
        onClick={() => onPick(name)}
      >
        <Icon as={ICON_GLYPHS[name]} boxSize="4" />
      </IconButton>
    </Tooltip>
  )
}

export function IconPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const { t } = useEditorText()
  // The box follows the stored value when it changes from outside — another
  // block, another section — while a keystroke's own text stays as typed.
  // Updating state during render is React's own pattern for state that mirrors
  // a prop; see `CoordinatesControl` in `./controls`.
  const [draft, setDraft] = useState({ value, text: value })
  if (value !== draft.value) setDraft({ value, text: value })

  const selected = resolveIconName(value)
  const SelectedGlyph = selected ? ICON_GLYPHS[selected] : null
  // The box shows the chosen name, so the text equals the selection until the
  // seller types over it. Only then is it a search, and only then is the grid
  // filtered — picking an icon leaves the whole set on screen with the choice
  // marked, rather than a grid of one.
  const query = draft.text.trim().toLowerCase()
  const searching = query !== NO_ICON && query !== value.toLowerCase()
  const matches = searching ? ICON_NAMES.filter((name) => name.includes(query)) : ICON_NAMES

  function pick(name: IconName) {
    setDraft({ value: name, text: name })
    onChange(name)
  }

  function clear() {
    setDraft({ value: NO_ICON, text: NO_ICON })
    onChange(NO_ICON)
  }

  return (
    <Stack gap="2">
      <InputGroup
        startElement={
          SelectedGlyph ? <Icon as={SelectedGlyph} boxSize="4" color="fg.muted" /> : undefined
        }
        endElement={
          value ? (
            <Button size="2xs" variant="ghost" colorPalette="danger" onClick={clear}>
              {t('iconClear')}
            </Button>
          ) : undefined
        }
      >
        <Input
          size="sm"
          value={draft.text}
          placeholder={t('iconSearch')}
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => setDraft({ value: draft.value, text: event.currentTarget.value })}
          onBlur={() => {
            // A search the seller did not act on falls back to the selection,
            // so the box always names the icon that is actually set.
            if (draft.text !== value) setDraft({ value, text: value })
          }}
        />
      </InputGroup>

      <Box borderWidth="1px" borderColor="border.subtle" rounded="md" bg="bg.panel" p="2">
        <Button
          size="xs"
          variant={value === NO_ICON ? 'subtle' : 'ghost'}
          colorPalette={value === NO_ICON ? 'brand' : undefined}
          justifyContent="flex-start"
          w="full"
          onClick={clear}
        >
          {t('iconNone')}
        </Button>

        {matches.length === 0 ? (
          <Text fontSize="xs" color="fg.muted" textAlign="center" py="4">
            {t('iconNoMatch')}
          </Text>
        ) : (
          <ScrollArea.Root size="xs" maxH="13rem" mt="1">
            <ScrollArea.Viewport style={{ overscrollBehavior: 'contain' }}>
              <ScrollArea.Content>
                <SimpleGrid columns={6} gap="1" p="1">
                  {matches.map((name) => (
                    <IconOption key={name} name={name} selected={name === value} onPick={pick} />
                  ))}
                </SimpleGrid>
              </ScrollArea.Content>
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar />
          </ScrollArea.Root>
        )}
      </Box>
    </Stack>
  )
}
