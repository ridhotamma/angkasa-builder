/**
 * The full-screen translation manager.
 *
 * Opened from the Theme tab's Localization group, one dialog per language. It
 * lists every translatable string on the storefront — section headings, bodies
 * and the copy inside each list item — with the default text beside the target,
 * and writes each keystroke straight into the section's own settings as a locale
 * map (`applyTranslationToSections`). A field left empty falls back to the shop
 * language at render time, so a partial translation is never a broken page.
 *
 * The list is derived, not stored: it is exactly what
 * `collectTranslationEntries` finds, so it can never drift from the layout.
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
import { useMemo, useState } from 'react'

import type { SectionInstance } from '../model/content'
import { translationProgress, type StorefrontLocale } from '../model/localized'
import {
  applyTranslationToSections,
  collectTranslationEntries,
  type TranslationEntry,
} from '../model/translations'
import { useEditorText } from './messages'

const LOCALE_LABEL: Record<StorefrontLocale, string> = { id: 'ID', en: 'EN' }

function entryKey(entry: TranslationEntry): string {
  return [entry.sectionId, entry.listKey ?? '', entry.itemId ?? '', entry.key].join('|')
}

export function TranslationManagerDialog({
  locale,
  open,
  onOpenChange,
  sections,
  onSectionsChange,
}: {
  locale: StorefrontLocale
  open: boolean
  onOpenChange: (open: boolean) => void
  sections: readonly SectionInstance[]
  onSectionsChange: (sections: SectionInstance[]) => void
}) {
  const { t, l } = useEditorText()
  const [untranslatedOnly, setUntranslatedOnly] = useState(false)

  const entries = useMemo(() => collectTranslationEntries(sections, locale), [sections, locale])
  const shown = untranslatedOnly ? entries.filter((entry) => entry.target.trim() === '') : entries
  const percent = Math.round(translationProgress(entries) * 100)

  const write = (entry: TranslationEntry, text: string) => {
    onSectionsChange(applyTranslationToSections(sections, entry, locale, text))
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={({ open: next }) => onOpenChange(next)}
      size="full"
      placement="center"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Stack gap="2" flex="1">
                <Dialog.Title fontSize="md">
                  {t('manageTranslation')} — {LOCALE_LABEL[locale]}
                </Dialog.Title>
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

            <Dialog.Body>
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
                  shown.map((entry) => (
                    <Box
                      key={entryKey(entry)}
                      borderWidth="1px"
                      borderColor="border.subtle"
                      rounded="md"
                      p="3"
                    >
                      <Badge size="xs" variant="surface" mb="2">
                        {l(entry.section)} · {l(entry.field)}
                      </Badge>
                      <SimpleGrid columns={{ base: 1, md: 2 }} gap="3">
                        <Input
                          size="sm"
                          value={entry.source}
                          readOnly
                          aria-label={t('translationDefault')}
                          placeholder={t('translationDefault')}
                          bg="bg.muted"
                        />
                        <Input
                          size="sm"
                          value={entry.target}
                          aria-label={t('translationTarget')}
                          placeholder={t('translationTarget')}
                          onChange={(event) => write(entry, event.currentTarget.value)}
                        />
                      </SimpleGrid>
                    </Box>
                  ))
                )}
              </Stack>
            </Dialog.Body>

            <Dialog.Footer>
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
