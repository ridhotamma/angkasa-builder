/**
 * "Choose from library": the image control's reusable alternative to uploading.
 *
 * The list comes from the app through `EditorServices.browseImages`, so the
 * editor never imports a server function. Uploads still go through
 * `uploadImage`; a fresh upload is selected immediately, which is what makes
 * the library grow as sellers pick. The dialog is searchable and closes the
 * moment a picture is chosen.
 */

import {
  AspectRatio,
  Box,
  Button,
  Center,
  CloseButton,
  Dialog,
  FileUpload,
  Grid,
  HStack,
  Icon,
  Image,
  Input,
  InputGroup,
  Portal,
  Spinner,
  Stack,
  Text,
} from '@chakra-ui/react'
import { useEffect, useRef, useState } from 'react'
import { LuCheck, LuImage, LuSearch, LuUpload } from 'react-icons/lu'

import { useEditorText } from './messages'
import type { EditorMediaItem, EditorServices } from './services'

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
  services: EditorServices & { browseImages: NonNullable<EditorServices['browseImages']> }
}) {
  const { t } = useEditorText()
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<EditorMediaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const request = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setError(null)
    void load('')
    // The dialog is the only thing that loads on open; `services` is stable
    // for the lifetime of the editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  async function load(term: string) {
    const mine = ++request.current
    setLoading(true)
    setError(null)
    try {
      const found = await services.browseImages(term)
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
      const fileId = await services.uploadImage(file)
      onSelect(fileId)
      onClose()
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : String(thrown))
    } finally {
      setUploading(false)
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
              <Stack gap="4">
                <HStack gap="2" wrap="wrap">
                  <InputGroup startElement={<Icon as={LuSearch} boxSize="4" />} flex="1 1 14rem">
                    <Input
                      size="sm"
                      value={query}
                      placeholder={t('searchMedia')}
                      onChange={(event) => search(event.currentTarget.value)}
                    />
                  </InputGroup>
                  <FileUpload.Root
                    accept="image/jpeg,image/png,image/webp,image/gif,image/avif,.heic,.heif"
                    maxFiles={1}
                    disabled={uploading}
                    onFileAccept={({ files }) => {
                      const [file] = files
                      if (file) void upload(file)
                    }}
                  >
                    <FileUpload.HiddenInput />
                    <FileUpload.Trigger asChild>
                      <Button size="sm" variant="outline" loading={uploading}>
                        <Icon as={LuUpload} />
                        {t('upload')}
                      </Button>
                    </FileUpload.Trigger>
                  </FileUpload.Root>
                </HStack>

                {error && (
                  <Text fontSize="sm" color="danger.fg">
                    {error}
                  </Text>
                )}

                {loading ? (
                  <Center py="12">
                    <Spinner size="sm" />
                  </Center>
                ) : items.length === 0 ? (
                  <Stack align="center" gap="2" py="12" textAlign="center">
                    <Center boxSize="12" rounded="full" bg="bg.subtle" color="fg.muted">
                      <Icon as={LuImage} boxSize="6" />
                    </Center>
                    <Text fontSize="sm" color="fg.muted">
                      {t('noMedia')}
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
                          _hover={{ borderColor: current ? 'brand.solid' : 'border.emphasized' }}
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
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
