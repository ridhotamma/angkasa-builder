/**
 * The image control's picker: upload a new picture or reuse one that already
 * exists.
 *
 * Two tabs, the way every other media picker in the dashboard works. Uploads go
 * through `services.uploadImage` (which also registers the file in the library);
 * the existing pictures come from `services.browseImages`, so the editor never
 * imports a server function. Choosing either closes the dialog.
 */

import {
  AspectRatio,
  Box,
  Center,
  CloseButton,
  Dialog,
  FileUpload,
  Grid,
  Icon,
  Image,
  Input,
  InputGroup,
  Portal,
  Spinner,
  Stack,
  Tabs,
  Text,
} from '@chakra-ui/react'
import { useEffect, useRef, useState } from 'react'
import { LuCheck, LuImage, LuImagePlus, LuSearch } from 'react-icons/lu'

import { useEditorText } from './messages'
import type { EditorMediaItem, EditorServices } from './services'

type PickerTab = 'upload' | 'library'

export function MediaPickerDialog({
  open,
  onClose,
  onSelect,
  selectedId,
  services,
}: {
  open: boolean
  onClose: () => void
  onSelect: (fileId: string) => void
  selectedId: string
  services: EditorServices
}) {
  const { t } = useEditorText()
  const browseImages = services.browseImages
  const [tab, setTab] = useState<PickerTab>('upload')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<EditorMediaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const request = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setError(null)
    setTab(browseImages ? 'library' : 'upload')
    if (browseImages) void load('')
    // The dialog loads only when it opens; `services` is stable for the
    // lifetime of the editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  async function load(term: string) {
    if (!browseImages) return
    const mine = ++request.current
    setLoading(true)
    setError(null)
    try {
      const found = await browseImages(term)
      if (mine === request.current) setItems(found)
    } catch (thrown) {
      if (mine === request.current) {
        setError(thrown instanceof Error ? thrown.message : String(thrown))
      }
    } finally {
      if (mine === request.current) setLoading(false)
    }
  }

  function search(term: string) {
    setQuery(term)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void load(term), 250)
  }

  async function upload(file: File) {
    setUploading(true)
    setError(null)
    try {
      onSelect(await services.uploadImage(file))
      onClose()
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : String(thrown))
    } finally {
      setUploading(false)
      setAttempt((count) => count + 1)
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={({ open: next }) => {
        if (!next) onClose()
      }}
      size="xl"
      placement="center"
      scrollBehavior="inside"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title fontSize="md">{t('mediaLibrary')}</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>

            <Dialog.Body>
              <Tabs.Root
                value={tab}
                onValueChange={({ value }) => setTab(value as PickerTab)}
                variant="line"
                size="sm"
              >
                <Tabs.List mb="4">
                  <Tabs.Trigger value="upload" _focusVisible={{ outline: 'none' }}>
                    {t('mediaUploadTab')}
                  </Tabs.Trigger>
                  {browseImages && (
                    <Tabs.Trigger value="library" _focusVisible={{ outline: 'none' }}>
                      {t('mediaLibraryTab')}
                    </Tabs.Trigger>
                  )}
                </Tabs.List>

                {error && (
                  <Text fontSize="sm" color="danger.fg" mt="3">
                    {error}
                  </Text>
                )}

                <Tabs.Content value="upload" p="0">
                  <FileUpload.Root
                    key={attempt}
                    accept="image/jpeg,image/png,image/webp,image/gif,image/avif,.heic,.heif"
                    maxFiles={1}
                    disabled={uploading}
                    onFileAccept={({ files }) => {
                      const [file] = files
                      if (file) void upload(file)
                    }}
                  >
                    <FileUpload.HiddenInput />
                    <FileUpload.Dropzone
                      w="full"
                      minH="56"
                      rounded="lg"
                      borderWidth="2px"
                      borderStyle="dashed"
                      borderColor="border"
                      cursor="pointer"
                      _hover={{ borderColor: 'brand.solid', bg: 'brand.subtle/30' }}
                      _dragging={{ borderColor: 'brand.solid', bg: 'brand.subtle' }}
                    >
                      <Stack align="center" gap="2" px="6" py="8" textAlign="center">
                        {uploading ? (
                          <Spinner size="sm" color="brand.fg" />
                        ) : (
                          <Center boxSize="10" rounded="full" bg="brand.subtle" color="brand.fg">
                            <Icon as={LuImagePlus} boxSize="5" />
                          </Center>
                        )}
                        <Text fontSize="sm" fontWeight="medium">
                          {t('mediaDropHint')}
                        </Text>
                        <Text fontSize="xs" color="fg.muted">
                          {t('mediaDropHelp')}
                        </Text>
                      </Stack>
                    </FileUpload.Dropzone>
                  </FileUpload.Root>
                </Tabs.Content>

                {browseImages && (
                  <Tabs.Content value="library" p="0">
                    <Stack gap="4">
                      <InputGroup startElement={<Icon as={LuSearch} boxSize="4" />}>
                        <Input
                          size="sm"
                          value={query}
                          placeholder={t('searchMedia')}
                          onChange={(event) => search(event.currentTarget.value)}
                        />
                      </InputGroup>

                      {loading ? (
                        <Center py="12">
                          <Spinner size="sm" />
                        </Center>
                      ) : items.length === 0 ? (
                        <Stack align="center" gap="2" py="12" textAlign="center">
                          <Center boxSize="12" rounded="full" bg="bg.subtle" color="fg.muted">
                            <Icon as={LuImage} boxSize="6" />
                          </Center>
                          <Text fontSize="sm" fontWeight="medium">
                            {t('noMedia')}
                          </Text>
                          <Text fontSize="sm" color="fg.muted">
                            {t('noMediaHint')}
                          </Text>
                        </Stack>
                      ) : (
                        <Grid
                          templateColumns={{
                            base: 'repeat(2, minmax(0, 1fr))',
                            sm: 'repeat(3, minmax(0, 1fr))',
                            md: 'repeat(4, minmax(0, 1fr))',
                          }}
                          gap="3"
                        >
                          {items.map((item) => {
                            const current = item.fileId === selectedId
                            return (
                              <Box
                                key={item.id}
                                as="button"
                                position="relative"
                                rounded="md"
                                overflow="hidden"
                                borderWidth="2px"
                                borderColor={current ? 'brand.solid' : 'border.subtle'}
                                cursor="pointer"
                                textAlign="start"
                                transition="border-color 120ms, transform 120ms"
                                _hover={{
                                  borderColor: current ? 'brand.solid' : 'border.emphasized',
                                }}
                                onClick={() => {
                                  onSelect(item.fileId)
                                  onClose()
                                }}
                              >
                                <AspectRatio ratio={1}>
                                  <Image
                                    src={item.thumbUrl || item.url}
                                    alt={item.name}
                                    objectFit="cover"
                                    loading="lazy"
                                    decoding="async"
                                  />
                                </AspectRatio>
                                <Box
                                  position="absolute"
                                  insetX="0"
                                  bottom="0"
                                  px="2"
                                  pt="6"
                                  pb="1.5"
                                  bgGradient="to-t"
                                  gradientFrom="blackAlpha.800"
                                  gradientTo="transparent"
                                  pointerEvents="none"
                                >
                                  <Text color="white" fontSize="2xs" fontWeight="medium" truncate>
                                    {item.name}
                                  </Text>
                                </Box>
                                {current && (
                                  <Center
                                    position="absolute"
                                    top="1"
                                    insetEnd="1"
                                    boxSize="6"
                                    rounded="full"
                                    bg="brand.solid"
                                    color="brand.contrast"
                                  >
                                    <Icon as={LuCheck} boxSize="3.5" />
                                  </Center>
                                )}
                              </Box>
                            )
                          })}
                        </Grid>
                      )}
                    </Stack>
                  </Tabs.Content>
                )}
              </Tabs.Root>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
