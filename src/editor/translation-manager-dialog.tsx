/**
 * The full-screen translation manager.
 *
 * Opened from the Theme tab's Localization group. One dialog, one column per
 * storefront language, every translatable string on the storefront — section
 * headings, bodies and the copy inside each list item.
 *
 * There is no separate "source" and "target": each language is editable beside
 * the others, so writing one never clears another. A field left empty falls
 * back to the shop's language at render time, so a partial translation is never
 * a broken page. Each keystroke is written straight into the section's own
 * settings as a locale map (`applyTranslationToSections`).
 *
 * The list is derived, not stored — exactly what `collectTranslationFields`
 * finds — so it can never drift from the layout.
 */

import {
  Badge,
  Box,
  Button,
  CloseButton,
  Dialog,
  Input,
  Portal,
  Progress,
  SimpleGrid,
  Stack,
  Switch,
  Text,
} from '@chakra-ui/react'
import { useEffect, useMemo, useState } from 'react'

import type { SectionInstance } from '../model/content'
import { STOREFRONT_LOCALES, type StorefrontLocale } from '../model/localized'
import {
  applyTranslationToSections,
  collectTranslationFields,
  type TranslationField,
} from '../model/translations'
import { useEditorText } from './messages'

function fieldKey(field: TranslationField): string {
  return [field.sectionId, field.listKey ?? '', field.itemId ?? '', field.key].join('|')
}

/** How many fields carry every language but the shop's own, on a 0–1 scale. */
function completeness(fields: readonly TranslationField[], source: StorefrontLocale): number {
  if (fields.length === 0) return 1
  const others = STOREFRONT_LOCALES.filter((locale) => locale !== source)
  const done = fields.filter((field) =>
    others.every((locale) => (field.values[locale] ?? '').trim().length > 0),
  ).length
  return done / fields.length
}

/**
 * One language's input for one field.
 *
 * Kept local and committed on blur (or Enter), not on every keystroke: writing
 * per character would reshape the whole section list on each letter, re-rendering
 * the editor behind the dialog. Typing stays in this box; the write happens once
 * the seller leaves it.
 */
function TranslationInput({
  value,
  label,
  placeholder,
  onCommit,
}: {
  value: string
  label: string
  placeholder?: string
  onCommit: (text: string) => void
}) {
  const [text, setText] = useState(value)
  // Follow the stored value when it changes from elsewhere — the same field
  // edited in the section form, or a re-render after a commit.
  useEffect(() => setText(value), [value])

  return (
    <Input
      size="sm"
      value={text}
      aria-label={label}
      placeholder={placeholder}
      onChange={(event) => setText(event.currentTarget.value)}
      onBlur={() => {
        if (text !== value) onCommit(text)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
    />
  )
}

export function TranslationManagerDialog({
  open,
  onOpenChange,
  sections,
  onSectionsChange,
  sourceLocale = STOREFRONT_LOCALES[0],
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sections: readonly SectionInstance[]
  onSectionsChange: (sections: SectionInstance[]) => void
  /** The language the shop's own copy is written in: a plain string seeds here. */
  sourceLocale?: StorefrontLocale
}) {
  const { t, l } = useEditorText()
  const [untranslatedOnly, setUntranslatedOnly] = useState(false)

  const fields = useMemo(() => collectTranslationFields(sections), [sections])
  const others = STOREFRONT_LOCALES.filter((locale) => locale !== sourceLocale)
  const shown = untranslatedOnly
    ? fields.filter((field) => others.some((locale) => !(field.values[locale] ?? '').trim()))
    : fields
  const percent = Math.round(completeness(fields, sourceLocale) * 100)

  /** Write one language solely into its own slot — the others are untouched. */
  const write = (field: TranslationField, locale: StorefrontLocale, text: string) => {
    onSectionsChange(applyTranslationToSections(sections, field, locale, text, sourceLocale))
  }

  return (
    <Dialog.Root open={open} onOpenChange={({ open: next }) => onOpenChange(next)} placement="center">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content
            maxW="5xl"
            w="full"
            h="min(90vh, 52rem)"
            mx="auto"
            rounded="xl"
            overflow="hidden"
            display="flex"
            flexDirection="column"
            borderWidth="1px"
            borderColor="border.subtle"
          >
            <Dialog.Header>
              <Stack gap="2" flex="1">
                <Dialog.Title fontSize="md">{t('manageTranslation')}</Dialog.Title>
                <Stack gap="1">
                  <Progress.Root value={percent} size="xs" rounded="full">
                    <Progress.Track>
                      <Progress.Range />
                    </Progress.Track>
                  </Progress.Root>
                  <Text fontSize="xs" color="fg.muted">
                    {percent}% {t('translationDone')}
                  </Text>
                </Stack>
              </Stack>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>

            <Dialog.Body flex="1" minH="0" overflowY="auto">
              <Stack gap="4" pb="4">
                <Switch.Root
                  size="sm"
                  checked={untranslatedOnly}
                  onCheckedChange={({ checked }) => setUntranslatedOnly(checked)}
                >
                  <Switch.HiddenInput />
                  <Switch.Control />
                  <Switch.Label fontSize="sm">{t('translationUntranslatedOnly')}</Switch.Label>
                </Switch.Root>

                {shown.length === 0 ? (
                  <Text fontSize="sm" color="fg.muted">
                    {t('translationEmpty')}
                  </Text>
                ) : (
                  shown.map((field) => (
                    <Box
                      key={fieldKey(field)}
                      borderWidth="1px"
                      borderColor="border.subtle"
                      rounded="md"
                      p="3"
                    >
                      <Badge size="xs" variant="surface" mb="2">
                        {l(field.section)} · {l(field.field)}
                      </Badge>
                      <SimpleGrid
                        columns={{ base: 1, md: STOREFRONT_LOCALES.length }}
                        gap="3"
                        alignItems="end"
                      >
                        {STOREFRONT_LOCALES.map((locale) => (
                          <Stack key={locale} gap="1">
                            <Text
                              fontSize="2xs"
                              color="fg.muted"
                              textTransform="uppercase"
                              letterSpacing="wide"
                            >
                              {locale.toUpperCase()}
                              {locale === sourceLocale ? ` · ${t('translationDefault')}` : ''}
                            </Text>
                            <TranslationInput
                              value={field.values[locale] ?? ''}
                              label={locale}
                              placeholder={locale === sourceLocale ? '' : t('translationTarget')}
                              onCommit={(text) => write(field, locale, text)}
                            />
                          </Stack>
                        ))}
                      </SimpleGrid>
                    </Box>
                  ))
                )}
              </Stack>
            </Dialog.Body>

            <Dialog.Footer
              position="sticky"
              bottom="0"
              bg="bg.panel"
              borderTopWidth="1px"
              borderColor="border.subtle"
            >
              <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
                {t('translationClose')}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
