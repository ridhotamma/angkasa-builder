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
import { useEffect, useRef, useState } from 'react'
import { LuFilm, LuPlus, LuTrash2, LuUpload, LuX } from 'react-icons/lu'

import {
  parseVideoUrl,
  sanitizeVideo,
  type PointValue,
  type TableValue,
  type VideoRef,
} from '../model/fields'
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
    <HStack
      gap="2"
      p="2"
      rounded="md"
      borderWidth="1px"
      borderColor="border.subtle"
      bg="bg.subtle"
    >
      {src ? (
        <Box as="video" boxSize="12" rounded="sm" objectFit="cover" flexShrink="0" bg="black" {...{ src, muted: true, preload: 'metadata' }} />
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
      <IconButton aria-label={t('remove')} size="2xs" variant="ghost" colorPalette="danger" onClick={() => onChange(null)}>
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
        <Tabs.Root value={tab} onValueChange={({ value: next }) => setTab(next as 'upload' | 'link')} size="sm" variant="subtle">
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
 */
export function ProductControl({
  value,
  onChange,
  services,
}: {
  value: string
  onChange: (id: string) => void
  services: EditorServices
}) {
  const { t } = useEditorText()
  const { products, remember } = useCatalogue()
  const selected = products.find((product) => product.id === value) ?? null
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
        <HStack gap="2.5" p="2" rounded="md" borderWidth="1px" borderColor="border.subtle" bg="bg.subtle">
          <Box boxSize="10" rounded="sm" overflow="hidden" bg="bg.muted" flexShrink="0">
            {selected.imageUrl && <Image src={selected.imageUrl} alt="" w="full" h="full" objectFit="cover" />}
          </Box>
          <Text fontSize="sm" flex="1" minW="0" truncate>
            {selected.name}
          </Text>
          <IconButton aria-label={t('remove')} size="2xs" variant="ghost" colorPalette="danger" onClick={() => onChange('')}>
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
          const [picked] = items as StorefrontProductCard[]
          if (!picked) return
          remember(picked)
          onChange(picked.id)
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
                          <Box boxSize="7" rounded="sm" overflow="hidden" bg="bg.muted" flexShrink="0">
                            {item.imageUrl && <Image src={item.imageUrl} alt="" w="full" h="full" objectFit="cover" />}
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

  if (!src) {
    return (
      <Text fontSize="xs" color="fg.muted">
        {t('pointNoImage')}
      </Text>
    )
  }

  return (
    <Stack gap="1.5">
      <Box
        position="relative"
        rounded="md"
        overflow="hidden"
        cursor="crosshair"
        borderWidth="1px"
        borderColor="border.subtle"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          onChange({
            x: Math.round(((event.clientX - rect.left) / rect.width) * 1000) / 10,
            y: Math.round(((event.clientY - rect.top) / rect.height) * 1000) / 10,
          })
        }}
      >
        <Image src={src} alt="" w="full" display="block" draggable={false} />
        <Box
          position="absolute"
          boxSize="4"
          rounded="full"
          bg="white"
          borderWidth="3px"
          borderColor="brand.solid"
          shadow="md"
          transform="translate(-50%, -50%)"
          pointerEvents="none"
          style={{ left: `${value.x}%`, top: `${value.y}%` }}
        />
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

/** An ISO moment as the `datetime-local` value for the seller's own time zone. */
function toLocalInput(iso: string): string {
  const time = Date.parse(iso)
  if (!Number.isFinite(time)) return ''
  const date = new Date(time)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function DateTimeControl({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const { t } = useEditorText()
  return (
    <HStack gap="2">
      <Input
        size="sm"
        type="datetime-local"
        value={toLocalInput(value)}
        onChange={(event) => {
          const raw = event.currentTarget.value
          // `datetime-local` has no zone; `new Date` reads it as local time,
          // which is the seller's — the zone they will think of the sale in.
          onChange(raw ? new Date(raw).toISOString() : '')
        }}
      />
      {value && (
        <IconButton aria-label={t('clear')} size="xs" variant="ghost" onClick={() => onChange('')}>
          <LuX />
        </IconButton>
      )}
    </HStack>
  )
}

/* -------------------------------------------------------------------------- */
/* Table                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A small spreadsheet: a header row and body rows of short text cells.
 * Pasting a block copied from a spreadsheet into any cell fills the grid
 * from there — the usual way a size chart arrives.
 */
export function TableControl({
  value,
  onChange,
  maxColumns,
  maxRows,
}: {
  value: TableValue
  onChange: (table: TableValue) => void
  maxColumns: number
  maxRows: number
}) {
  const { t } = useEditorText()
  const { columns, rows } = value

  const setCell = (row: number, column: number, text: string) => {
    if (row < 0) {
      onChange({ columns: columns.map((cell, index) => (index === column ? text : cell)), rows })
    } else {
      onChange({
        columns,
        rows: rows.map((cells, index) =>
          index === row ? cells.map((cell, at) => (at === column ? text : cell)) : cells,
        ),
      })
    }
  }

  const paste = (row: number, column: number, text: string): boolean => {
    if (!text.includes('\t') && !text.includes('\n')) return false
    const grid = text.replace(/\r/g, '').replace(/\n$/, '').split('\n').map((line) => line.split('\t'))
    const width = Math.min(maxColumns, Math.max(columns.length, column + Math.max(...grid.map((line) => line.length))))
    const nextColumns = Array.from({ length: width }, (_, index) => columns[index] ?? '')
    const nextRows = rows.map((cells) => Array.from({ length: width }, (_, index) => cells[index] ?? ''))
    grid.forEach((line, lineIndex) => {
      const target = row + lineIndex
      line.forEach((cell, cellIndex) => {
        const at = column + cellIndex
        if (at >= width) return
        if (target < 0) nextColumns[at] = cell.trim()
        else {
          if (target >= maxRows) return
          while (nextRows.length <= target) nextRows.push(Array.from({ length: width }, () => ''))
          nextRows[target]![at] = cell.trim()
        }
      })
    })
    onChange({ columns: nextColumns, rows: nextRows })
    return true
  }

  const cell = (row: number, column: number, text: string) => (
    <Input
      key={`${row}:${column}`}
      size="xs"
      value={text}
      maxLength={80}
      fontWeight={row < 0 ? 'semibold' : undefined}
      bg={row < 0 ? 'bg.muted' : undefined}
      minW="16"
      onChange={(event) => setCell(row, column, event.currentTarget.value)}
      onPaste={(event) => {
        if (paste(row, column, event.clipboardData.getData('text/plain'))) event.preventDefault()
      }}
    />
  )

  return (
    <Stack gap="2">
      <ScrollArea.Root size="xs">
        <ScrollArea.Viewport>
          <ScrollArea.Content style={{ minWidth: 0 }}>
            <Stack gap="1">
              <HStack gap="1">
                {columns.map((text, column) => cell(-1, column, text))}
                <Box w="6" flexShrink="0" />
              </HStack>
              {rows.map((cells, row) => (
                <HStack key={row} gap="1">
                  {cells.map((text, column) => cell(row, column, text))}
                  <IconButton
                    aria-label={t('tableRemoveRow')}
                    size="2xs"
                    variant="ghost"
                    colorPalette="danger"
                    flexShrink="0"
                    onClick={() => onChange({ columns, rows: rows.filter((_, index) => index !== row) })}
                  >
                    <LuTrash2 />
                  </IconButton>
                </HStack>
              ))}
            </Stack>
          </ScrollArea.Content>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="horizontal" />
      </ScrollArea.Root>
      <HStack gap="2" wrap="wrap">
        <Button
          size="xs"
          variant="outline"
          disabled={rows.length >= maxRows}
          onClick={() => onChange({ columns, rows: [...rows, columns.map(() => '')] })}
        >
          <LuPlus />
          {t('tableAddRow')}
        </Button>
        <Button
          size="xs"
          variant="outline"
          disabled={columns.length >= maxColumns}
          onClick={() => onChange({ columns: [...columns, ''], rows: rows.map((cells) => [...cells, '']) })}
        >
          <LuPlus />
          {t('tableAddColumn')}
        </Button>
        <Button
          size="xs"
          variant="ghost"
          colorPalette="danger"
          disabled={columns.length <= 1}
          onClick={() =>
            onChange({ columns: columns.slice(0, -1), rows: rows.map((cells) => cells.slice(0, -1)) })
          }
        >
          {t('tableRemoveColumn')}
        </Button>
      </HStack>
      <Text fontSize="xs" color="fg.muted">
        {t('tablePasteHint')}
      </Text>
    </Stack>
  )
}
