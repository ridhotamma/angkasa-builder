/**
 * The richer field controls: video, product picker, a spot on an image, a
 * date and time, and a table.
 */

import {
  Box,
  Button,
  Combobox,
  FileUpload,
  HStack,
  Icon,
  IconButton,
  Image,
  Input,
  Portal,
  Progress,
  ScrollArea,
  Stack,
  Tabs,
  Text,
  useListCollection,
} from '@chakra-ui/react'
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { LuFilm, LuMove, LuUpload, LuX } from 'react-icons/lu'

import { InstantPicker } from '@repo/theme'

import { parseVideoUrl, sanitizeVideo, type PointValue, type VideoRef } from '../model/fields'
import type { StorefrontProductCard } from '../render/context'
import { useCatalogue } from './catalogue'
import { useEditorText } from './messages'
import type { EditorServices } from './services'

/* -------------------------------------------------------------------------- */
/* Video                                                                      */
/* -------------------------------------------------------------------------- */

export function VideoControl({
  value,
  onChange,
  services,
  uploadOnly,
}: {
  value: unknown
  onChange: (video: VideoRef | null) => void
  services: EditorServices
  uploadOnly: boolean
}) {
  const { t } = useEditorText()
  const video = sanitizeVideo(value)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [link, setLink] = useState('')
  const [attempt, setAttempt] = useState(0)
  const canUpload = Boolean(services.uploadVideo)
  const [tab, setTab] = useState<'upload' | 'link'>(
    video && video.source !== 'upload' ? 'link' : canUpload ? 'upload' : 'link',
  )

  async function upload(file: File) {
    if (!services.uploadVideo) return
    setError(null)
    setProgress(0)
    try {
      const id = await services.uploadVideo(file, setProgress)
      onChange({ source: 'upload', id })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setProgress(null)
      setAttempt((n) => n + 1)
    }
  }

  const src = video?.source === 'upload' ? (services.videoUrl?.(video.id) ?? null) : null

  const current = video ? (
    <HStack gap="2" p="2" rounded="md" borderWidth="1px" borderColor="border.subtle" bg="bg.subtle">
      {src ? (
        <Box
          as="video"
          boxSize="12"
          rounded="sm"
          objectFit="cover"
          flexShrink="0"
          bg="black"
          {...{ src, muted: true, preload: 'metadata' }}
        />
      ) : (
        <Icon as={LuFilm} boxSize="5" color="fg.muted" />
      )}
      <Text fontSize="sm" flex="1" minW="0" truncate>
        {video.source === 'upload'
          ? t('videoFromUpload')
          : video.source === 'youtube'
            ? `YouTube · ${video.id}`
            : `Vimeo · ${video.id}`}
      </Text>
      <IconButton
        aria-label={t('remove')}
        size="2xs"
        variant="ghost"
        colorPalette="danger"
        onClick={() => onChange(null)}
      >
        <LuX />
      </IconButton>
    </HStack>
  ) : null

  const uploader = canUpload ? (
    <Stack gap="2">
      <FileUpload.Root
        key={attempt}
        accept="video/mp4,video/webm"
        maxFiles={1}
        disabled={progress !== null}
        onFileAccept={({ files }) => {
          const [file] = files
          if (file) void upload(file)
        }}
      >
        <FileUpload.HiddenInput />
        <FileUpload.Trigger asChild>
          <Button size="xs" variant="outline" alignSelf="start" loading={progress !== null}>
            <LuUpload />
            {video?.source === 'upload' ? t('replace') : t('videoUpload')}
          </Button>
        </FileUpload.Trigger>
      </FileUpload.Root>
      {progress !== null && (
        <Progress.Root value={Math.round(progress * 100)} size="xs" colorPalette="brand">
          <Progress.Track>
            <Progress.Range />
          </Progress.Track>
        </Progress.Root>
      )}
    </Stack>
  ) : (
    <Text fontSize="xs" color="fg.muted">
      {t('videoUploadUnavailable')}
    </Text>
  )

  const linker = (
    <Stack gap="1.5">
      <HStack gap="2">
        <Input
          size="sm"
          value={link}
          placeholder="https://youtube.com/watch?v=…"
          onChange={(event) => setLink(event.currentTarget.value)}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const parsed = parseVideoUrl(link)
            if (!parsed) return setError(t('videoLinkInvalid'))
            setError(null)
            setLink('')
            onChange(parsed)
          }}
        >
          {t('applyLink')}
        </Button>
      </HStack>
      <Text fontSize="xs" color="fg.muted">
        {t('videoLinkHelp')}
      </Text>
    </Stack>
  )

  return (
    <Stack gap="2">
      {current}
      {uploadOnly ? (
        uploader
      ) : (
        <Tabs.Root
          value={tab}
          onValueChange={({ value: next }) => setTab(next as 'upload' | 'link')}
          size="sm"
          variant="subtle"
        >
          <Tabs.List>
            <Tabs.Trigger value="upload" disabled={!canUpload}>
              {t('videoUpload')}
            </Tabs.Trigger>
            <Tabs.Trigger value="link">{t('videoLink')}</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="upload" pt="2">
            {uploader}
          </Tabs.Content>
          <Tabs.Content value="link" pt="2">
            {linker}
          </Tabs.Content>
        </Tabs.Root>
      )}
      {error && (
        <Text fontSize="xs" color="danger.fg">
          {error}
        </Text>
      )}
    </Stack>
  )
}

/* -------------------------------------------------------------------------- */
/* Product                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A searchable product picker. Searching asks the app (the shop's whole
 * catalogue); without a search service it filters the products the preview
 * already has. The pick is remembered in the editor's catalogue, so the
 * preview can draw it before anything is saved.
 *
 * `by` says what the value is: a section picks a product by id, a link (a
 * menu entry, a button) by slug — the key the storefront's product URL uses.
 */
export function ProductControl({
  value,
  onChange,
  services,
  by = 'id',
}: {
  value: string
  onChange: (value: string) => void
  services: EditorServices
  by?: 'id' | 'slug'
}) {
  const { t } = useEditorText()
  const { products, remember } = useCatalogue()
  // The navigation screen has no catalogue behind it, so the last pick is
  // also kept here, or it would vanish from the field the moment it was made.
  const [picked, setPicked] = useState<StorefrontProductCard | null>(null)
  const matches = (product: StorefrontProductCard) => product[by] === value
  const known = products.find(matches) ?? (picked && matches(picked) ? picked : null) ?? null
  // A link saved before this screen knew the product: its slug is all there is to show.
  const selected: Pick<StorefrontProductCard, 'name' | 'imageUrl'> | null =
    known ?? (by === 'slug' && value ? { name: value, imageUrl: null } : null)
  const { collection, set } = useListCollection<StorefrontProductCard>({
    initialItems: products.slice(0, 20),
    itemToString: (item) => item.name,
    itemToValue: (item) => item.id,
  })
  const [loading, setLoading] = useState(false)
  const request = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), [])

  function search(query: string) {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const mine = ++request.current
      if (!services.searchProducts) {
        const needle = query.trim().toLowerCase()
        set(products.filter((product) => product.name.toLowerCase().includes(needle)).slice(0, 20))
        return
      }
      setLoading(true)
      try {
        const found = await services.searchProducts(query.trim())
        if (mine === request.current) set(found)
      } finally {
        if (mine === request.current) setLoading(false)
      }
    }, 250)
  }

  return (
    <Stack gap="2">
      {selected && (
        <HStack
          gap="2.5"
          p="2"
          rounded="md"
          borderWidth="1px"
          borderColor="border.subtle"
          bg="bg.subtle"
        >
          <Box boxSize="10" rounded="sm" overflow="hidden" bg="bg.muted" flexShrink="0">
            {selected.imageUrl && (
              <Image src={selected.imageUrl} alt="" w="full" h="full" objectFit="cover" />
            )}
          </Box>
          <Text fontSize="sm" flex="1" minW="0" truncate>
            {selected.name}
          </Text>
          <IconButton
            aria-label={t('remove')}
            size="2xs"
            variant="ghost"
            colorPalette="danger"
            onClick={() => onChange('')}
          >
            <LuX />
          </IconButton>
        </HStack>
      )}
      <Combobox.Root
        collection={collection}
        size="sm"
        width="full"
        inputBehavior="autohighlight"
        openOnClick
        onInputValueChange={({ inputValue }) => search(inputValue)}
        onOpenChange={({ open }) => open && search('')}
        onValueChange={({ items }) => {
          const [choice] = items as StorefrontProductCard[]
          if (!choice) return
          remember(choice)
          setPicked(choice)
          onChange(choice[by])
        }}
        positioning={{ sameWidth: true }}
      >
        <Combobox.Control>
          <Combobox.Input placeholder={selected ? t('productChange') : t('productSearch')} />
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
                    {loading ? (
                      <Text fontSize="sm" color="fg.muted" p="2">
                        {t('searching')}
                      </Text>
                    ) : (
                      <Combobox.Empty>{t('productNone')}</Combobox.Empty>
                    )}
                    {collection.items.map((item) => (
                      <Combobox.Item item={item} key={item.id}>
                        <HStack gap="2" minW="0">
                          <Box
                            boxSize="7"
                            rounded="sm"
                            overflow="hidden"
                            bg="bg.muted"
                            flexShrink="0"
                          >
                            {item.imageUrl && (
                              <Image
                                src={item.imageUrl}
                                alt=""
                                w="full"
                                h="full"
                                objectFit="cover"
                              />
                            )}
                          </Box>
                          <Text truncate>{item.name}</Text>
                        </HStack>
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
    </Stack>
  )
}

/* -------------------------------------------------------------------------- */
/* Point on an image                                                          */
/* -------------------------------------------------------------------------- */

/** Keeps the white ring visible on a pale photo. */
const RING_SHADOW = '0 1px 4px rgba(0, 0, 0, 0.35)'

export function PointControl({
  value,
  onChange,
  imageId,
  services,
}: {
  value: PointValue
  onChange: (point: PointValue) => void
  imageId: string
  services: EditorServices
}) {
  const { t } = useEditorText()
  const src = imageId ? services.imageUrl(imageId, { width: 640, height: 640 }) : null
  const [dragging, setDragging] = useState(false)
  // Bumped on every press and every drop, so the ripple and the settle
  // animations replay instead of running once.
  const [presses, setPresses] = useState<{ count: number; at: PointValue }>({
    count: 0,
    at: value,
  })
  const [drops, setDrops] = useState(0)

  function pointAt(event: PointerEvent<HTMLDivElement>): PointValue {
    const rect = event.currentTarget.getBoundingClientRect()
    const share = (offset: number, size: number) =>
      Math.round(Math.min(1, Math.max(0, offset / size)) * 1000) / 10
    return {
      x: share(event.clientX - rect.left, rect.width),
      y: share(event.clientY - rect.top, rect.height),
    }
  }

  function place(next: PointValue) {
    if (next.x !== value.x || next.y !== value.y) onChange(next)
  }

  function drop() {
    if (!dragging) return
    setDragging(false)
    setDrops((count) => count + 1)
  }

  if (!src) {
    return (
      <Text fontSize="xs" color="fg.muted">
        {t('pointNoImage')}
      </Text>
    )
  }

  const at = { left: `${value.x}%`, top: `${value.y}%` }
  // The chip by the dot flips below it near the top edge, and inward near the
  // sides, so it never runs off the photo.
  const chipBelow = value.y < 18
  const chipAlign = value.x < 25 ? '0%' : value.x > 75 ? '-100%' : '-50%'

  return (
    <Stack gap="1.5">
      <Box
        className="group"
        position="relative"
        rounded="md"
        overflow="hidden"
        cursor={dragging ? 'grabbing' : 'grab'}
        borderWidth="1px"
        borderColor="border.subtle"
        userSelect="none"
        // Press to place the dot, keep holding to drag it; the history's
        // coalescing makes one drag one undo step.
        touchAction="none"
        onPointerDown={(event) => {
          const next = pointAt(event)
          setDragging(true)
          setPresses(({ count }) => ({ count: count + 1, at: next }))
          // Keeps the drag going when the pointer leaves the photo.
          try {
            event.currentTarget.setPointerCapture(event.pointerId)
          } catch {
            // Not a live pointer (a synthetic event); the drag still works inside the photo.
          }
          place(next)
        }}
        onPointerMove={(event) => {
          if (dragging) place(pointAt(event))
        }}
        onPointerUp={drop}
        onPointerCancel={drop}
        css={{
          // Animate `scale` alone: `transform` carries the centring offset,
          // and animating it too is what pushed the ring off the dot.
          '@keyframes pb-point-pulse': {
            // A glow spreading off the ring: a shadow follows the ring's own
            // outline, so it cannot drift off-centre.
            '0%': { boxShadow: `0 0 0 0 rgba(255, 255, 255, 0.7), ${RING_SHADOW}` },
            '100%': { boxShadow: `0 0 0 10px rgba(255, 255, 255, 0), ${RING_SHADOW}` },
          },
          '@keyframes pb-point-ripple': {
            '0%': { scale: '0.4', opacity: 0.8 },
            '100%': { scale: '2.4', opacity: 0 },
          },
          '@keyframes pb-point-settle': {
            '0%': { scale: '1.3' },
            '55%': { scale: '0.9' },
            '100%': { scale: '1' },
          },
          '@media (prefers-reduced-motion: reduce)': {
            '& *': { animation: 'none !important', transition: 'none !important' },
          },
        }}
      >
        <Image src={src} alt="" w="full" display="block" draggable={false} />

        {/* Dims the photo while held, so the dot stands out. */}
        <Box
          position="absolute"
          inset="0"
          bg="blackAlpha.400"
          opacity={dragging ? 1 : 0}
          transition="opacity 150ms"
          pointerEvents="none"
        />

        {/* A one-off ripple where the photo was pressed. */}
        {presses.count > 0 && (
          <Box
            key={presses.count}
            position="absolute"
            transform="translate(-50%, -50%)"
            pointerEvents="none"
            style={{ left: `${presses.at.x}%`, top: `${presses.at.y}%` }}
          >
            <Box
              boxSize="6"
              rounded="full"
              bg="whiteAlpha.700"
              opacity="0"
              animation="pb-point-ripple 450ms ease-out"
            />
          </Box>
        )}

        {/* The dot, drawn like the storefront's: a white disc inside a white
            ring. The ring is the disc's padded wrapper, not a layer laid over
            it, so the two stay concentric at any sub-pixel position. It grows
            while held and settles with a small bounce when let go. */}
        <Box position="absolute" transform="translate(-50%, -50%)" pointerEvents="none" style={at}>
          <Box
            key={`dot-${drops}`}
            display="flex"
            p="1"
            rounded="full"
            borderWidth="2px"
            borderColor="white"
            shadow={RING_SHADOW}
            scale={dragging ? '1.3' : '1'}
            transition="scale 150ms ease-out"
            animation={
              dragging
                ? undefined
                : drops > 0
                  ? 'pb-point-settle 320ms ease-out, pb-point-pulse 2.4s ease-out 320ms infinite'
                  : 'pb-point-pulse 2.4s ease-out infinite'
            }
            _groupHover={dragging ? undefined : { scale: '1.1' }}
          >
            <Box
              boxSize="4"
              rounded="full"
              bg="white"
              shadow={dragging ? '0 4px 12px rgba(0, 0, 0, 0.45)' : '0 1px 4px rgba(0, 0, 0, 0.35)'}
              transition="box-shadow 150ms"
            />
          </Box>
        </Box>

        {/* A chip by the dot: "Drag to move" on hover, the position while held. */}
        <HStack
          position="absolute"
          gap="1"
          px="2"
          py="0.5"
          rounded="full"
          bg="blackAlpha.800"
          color="white"
          fontSize="2xs"
          fontWeight="medium"
          whiteSpace="nowrap"
          pointerEvents="none"
          opacity={dragging ? 1 : 0}
          transition="opacity 150ms"
          _groupHover={{ opacity: 1 }}
          style={{
            ...at,
            transform: `translate(${chipAlign}, ${chipBelow ? '28px' : 'calc(-100% - 28px)'})`,
          }}
        >
          {dragging ? (
            <Text fontVariantNumeric="tabular-nums">
              {Math.round(value.x)}% · {Math.round(value.y)}%
            </Text>
          ) : (
            <>
              <Icon as={LuMove} boxSize="3" />
              <Text>{t('pointDrag')}</Text>
            </>
          )}
        </HStack>
      </Box>
      <Text fontSize="xs" color="fg.muted">
        {t('pointHint')}
      </Text>
    </Stack>
  )
}

/* -------------------------------------------------------------------------- */
/* Date and time                                                              */
/* -------------------------------------------------------------------------- */

/**
 * A moment for a section's schedule, as an ISO instant (`''` for none), on
 * the shared Chakra day-and-time picker rather than the browser's native
 * `datetime-local`. The picker joins the day and time in the seller's own
 * time zone — the zone they think of the sale in.
 */
export function DateTimeControl({
  value,
  onChange,
}: {
  value: string
  onChange: (iso: string) => void
}) {
  const { locale } = useEditorText()
  return (
    <InstantPicker
      value={value}
      onChange={onChange}
      locale={locale === 'id' ? 'id-ID' : 'en-US'}
      size="sm"
    />
  )
}

/* -------------------------------------------------------------------------- */
/* Table                                                                      */
/* -------------------------------------------------------------------------- */

export { TableControl } from './table-control'
