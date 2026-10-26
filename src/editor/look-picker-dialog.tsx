/**
 * Look & Palette Picker Dialog.
 *
 * Lets merchants browse 18 curated brand Looks and 32 Palettes, search by mood
 * ("warm", "hangat", "bold", "mewah", "minimal"), and apply one in a single
 * undo step. Applying only ever writes existing theme settings, so every
 * choice stays editable afterwards.
 *
 * Conforms to the dialog, scroll, and i18n conventions in docs/PAGE-BUILDER.md.
 */

import {
  Badge,
  Box,
  Button,
  CloseButton,
  Dialog,
  Flex,
  HStack,
  Icon,
  Input,
  InputGroup,
  Portal,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
} from '@chakra-ui/react'
import { useMemo, useState } from 'react'
import { LuCheck, LuPalette, LuSearch, LuSparkles } from 'react-icons/lu'

import {
  applyLook,
  applyPalette,
  findFontPair,
  findPalette,
  LOOKS,
  searchLooks,
  searchPalettes,
  type Look,
  type Palette,
} from '../model/looks'
import type { ThemeSettings } from '../model/settings'
import { useBuilderDialogChildOverlay } from './builder-dialog'
import { useEditorText } from './messages'
import { PaletteDots, PaletteStrip } from './palette-swatch'

type PickerTab = 'looks' | 'palettes'

/** One curated look: its swatch, character and an apply button. */
function LookCard({ look, onApply }: { look: Look; onApply: (look: Look) => void }) {
  const { t, l } = useEditorText()
  const palette = findPalette(look.palette)
  const fontPair = findFontPair(look.fontPair)

  return (
    <Box
      borderWidth="1px"
      borderColor="border.subtle"
      rounded="lg"
      p="3.5"
      display="flex"
      flexDirection="column"
      justifyContent="space-between"
      gap="3"
      transition="all 0.15s ease"
      _hover={{
        borderColor: 'brand.solid',
        shadow: 'sm',
        transform: 'translateY(-1px)',
      }}
    >
      <Stack gap="2">
        {/* Color Swatch Strip */}
        <HStack
          gap="0"
          h="6"
          rounded="md"
          overflow="hidden"
          borderWidth="1px"
          borderColor="border.subtle"
        >
          <PaletteStrip colors={palette.colors} />
        </HStack>

        <Box>
          <Text fontWeight="semibold" fontSize="sm">
            {l(look.name)}
          </Text>
          <Text fontSize="xs" color="fg.muted" lineClamp={2}>
            {l(look.description)}
          </Text>
        </Box>

        <HStack wrap="wrap" gap="1">
          <Badge size="xs" variant="surface">
            {fontPair.heading} / {fontPair.body}
          </Badge>
          <Badge size="xs" variant="outline">
            {look.cardStyle} · {look.radius}
          </Badge>
          {look.animation !== 'none' && (
            <Badge size="xs" colorPalette="brand">
              {look.animation}
            </Badge>
          )}
        </HStack>
      </Stack>

      <Button size="xs" colorPalette="brand" variant="solid" w="100%" onClick={() => onApply(look)}>
        <Icon as={LuCheck} />
        <span>{t('applyLook')}</span>
      </Button>
    </Box>
  )
}

interface LookPickerDialogProps {
  open: boolean
  onClose: () => void
  settings: ThemeSettings
  onApply: (settings: ThemeSettings) => void
  /**
   * Look keys a freshly installed template suggests, in order. They render in
   * a recommended group above the library while no search is typed; searching
   * searches the whole library as usual.
   */
  priorityKeys?: readonly string[]
}

export function LookPickerDialog({
  open,
  onClose,
  settings,
  onApply,
  priorityKeys = [],
}: LookPickerDialogProps) {
  const { t, l } = useEditorText()
  useBuilderDialogChildOverlay(open)
  const [tab, setTab] = useState<PickerTab>('looks')
  const [search, setSearch] = useState('')

  const searching = search.trim() !== ''
  const recommended = useMemo(
    () => LOOKS.filter((look) => priorityKeys.includes(look.key)),
    [priorityKeys],
  )
  const filteredLooks = useMemo(() => {
    const found = searchLooks(search)
    // Recommended looks keep their own group above; searching searches all.
    return searching ? found : found.filter((look) => !priorityKeys.includes(look.key))
  }, [search, searching, priorityKeys])
  const filteredPalettes = useMemo(() => searchPalettes(search), [search])

  const handleApplyLook = (look: Look) => {
    onApply(applyLook(settings, look))
    onClose()
  }

  const handleApplyPalette = (palette: Palette) => {
    onApply(applyPalette(settings, palette))
    onClose()
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={({ open: next }) => {
        if (!next) onClose()
      }}
      size="xl"
      // Chakra anchors a dialog to the top by default; this one sits in the
      // middle of the screen, like every other dialog in the editor.
      placement="center"
      scrollBehavior="inside"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxH="min(44rem, calc(100dvh - 4rem))">
            <Dialog.Header flexDirection="column" alignItems="stretch" gap="3">
              <Flex justify="space-between" align="center" w="100%">
                <HStack gap="2.5">
                  <Box p="1.5" rounded="md" bg="brand.subtle" color="brand.solid">
                    <Icon as={LuSparkles} />
                  </Box>
                  <Box>
                    <Dialog.Title>{t('looksAndPalettes')}</Dialog.Title>
                    <Text fontSize="xs" color="fg.muted">
                      {t('looksAndPalettesHelp')}
                    </Text>
                  </Box>
                </HStack>
                <Dialog.CloseTrigger asChild>
                  <CloseButton size="sm" />
                </Dialog.CloseTrigger>
              </Flex>

              <Flex justify="space-between" align="center" gap="4" wrap="wrap">
                <Tabs.Root
                  value={tab}
                  onValueChange={(details) => setTab(details.value as PickerTab)}
                  variant="subtle"
                >
                  <Tabs.List>
                    <Tabs.Trigger value="looks">{t('curatedLooks')}</Tabs.Trigger>
                    <Tabs.Trigger value="palettes">{t('colorPalettes')}</Tabs.Trigger>
                  </Tabs.List>
                </Tabs.Root>

                <Box w={{ base: '100%', sm: '260px' }}>
                  <InputGroup startElement={<Icon as={LuSearch} color="fg.subtle" />}>
                    <Input
                      size="sm"
                      placeholder={t('searchMoodPlaceholder')}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </InputGroup>
                </Box>
              </Flex>
            </Dialog.Header>

            <Dialog.Body pt="1" pb="5">
              {/* TAB 1: LOOKS */}
              {tab === 'looks' && (
                <Stack gap="5">
                  {!searching && recommended.length > 0 && (
                    <Stack gap="2">
                      <Text
                        fontSize="xs"
                        fontWeight="semibold"
                        textTransform="uppercase"
                        letterSpacing="wide"
                        color="fg.muted"
                      >
                        {t('recommendedLooks')}
                      </Text>
                      <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} gap="3">
                        {recommended.map((look) => (
                          <LookCard key={look.key} look={look} onApply={handleApplyLook} />
                        ))}
                      </SimpleGrid>
                    </Stack>
                  )}
                  <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} gap="3">
                    {filteredLooks.map((look) => (
                      <LookCard key={look.key} look={look} onApply={handleApplyLook} />
                    ))}
                  </SimpleGrid>
                </Stack>
              )}

              {/* TAB 2: PALETTES */}
              {tab === 'palettes' && (
                <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} gap="3">
                  {filteredPalettes.map((palette) => (
                    <Box
                      key={palette.key}
                      borderWidth="1px"
                      borderColor="border.subtle"
                      rounded="lg"
                      p="3.5"
                      display="flex"
                      flexDirection="column"
                      justifyContent="space-between"
                      gap="3"
                      _hover={{ borderColor: 'brand.solid', shadow: 'sm' }}
                    >
                      <Stack gap="2">
                        <HStack
                          gap="1.5"
                          p="2"
                          rounded="md"
                          borderWidth="1px"
                          borderColor="border.subtle"
                          bg={palette.colors.background}
                        >
                          <PaletteDots colors={palette.colors} sample />
                        </HStack>

                        <Box>
                          <Text fontWeight="semibold" fontSize="sm">
                            {l(palette.name)}
                          </Text>
                          <HStack gap="1" mt="1" wrap="wrap">
                            {palette.tags.map((tag) => (
                              <Badge key={tag} size="xs" variant="subtle">
                                {tag}
                              </Badge>
                            ))}
                          </HStack>
                        </Box>
                      </Stack>

                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => handleApplyPalette(palette)}
                      >
                        <Icon as={LuPalette} />
                        <span>{t('applyPalette')}</span>
                      </Button>
                    </Box>
                  ))}
                </SimpleGrid>
              )}
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
