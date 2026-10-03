/**
 * Order form — pick products, quantities and a note, then send the order to
 * the shop's WhatsApp.
 *
 * There is no backend here and none is needed: the message is built in the
 * browser and handed to `wa.me`, so the order arrives as a normal WhatsApp
 * chat the seller already answers in. The shop's number comes from shop
 * settings through the render environment (`data.shop.phone`); a widget-level
 * number overrides it. No number at all means the widget stays out of the
 * live storefront and explains itself in the editor's preview.
 */

import { Box, Button, HStack, IconButton, Input, Stack, Text } from '@chakra-ui/react'
import { useMemo, useState } from 'react'
import { LuMinus, LuPlus } from 'react-icons/lu'

import type { BlockSchema } from '../model/fields'
import { readBoolean, readNumber, readText } from '../model/fields'
import { registerWidget, type BlockRendererProps } from '../render/block-registry'
import { useRenderEnvironment } from '../render/context'

/** At most this many products are offered in one form. */
export const MAX_ORDER_ITEMS = 12
const MAX_QUANTITY = 99

export interface OrderLine {
  name: string
  quantity: number
  /** The line's own price label, already formatted. */
  totalLabel: string
}

/**
 * A phone number as `wa.me` wants it: digits only, with an Indonesian leading
 * zero turned into the country code. Anything without a digit is `null`.
 */
export function normalizeWhatsappNumber(phone: string): string | null {
  const digits = phone.replace(/[^\d]/g, '')
  if (!digits) return null
  if (digits.startsWith('0')) return `62${digits.replace(/^0+/, '')}`
  return digits
}

/** The chat message the visitor sends: the order, then the note. */
export function buildOrderMessage(
  shopName: string,
  lines: readonly OrderLine[],
  note: string,
  totalLabel: string,
): string {
  const parts = [`Hello ${shopName}, I would like to order:`, '']
  for (const line of lines) {
    parts.push(`- ${line.quantity}x ${line.name} — ${line.totalLabel}`)
  }
  parts.push('', `Total: ${totalLabel}`)
  const trimmed = note.trim()
  if (trimmed) parts.push('', `Note: ${trimmed}`)
  return parts.join('\n')
}

export function whatsappOrderLink(phone: string, message: string): string | null {
  const number = normalizeWhatsappNumber(phone)
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : null
}

export const orderFormSchema: BlockSchema = {
  type: 'widget-order-form',
  name: { en: 'WhatsApp order form', id: 'Formulir pesanan WhatsApp' },
  description: {
    en: 'Visitors build an order and send it to your WhatsApp, with the total written out.',
    id: 'Pengunjung menyusun pesanan dan mengirimnya ke WhatsApp Anda, lengkap dengan totalnya.',
  },
  fields: [
    {
      kind: 'text',
      key: 'title',
      label: { en: 'Title', id: 'Judul' },
      max: 80,
      default: 'Order on WhatsApp',
    },
    {
      kind: 'textarea',
      key: 'intro',
      label: { en: 'Intro', id: 'Pengantar' },
      max: 240,
      rows: 2,
      default: '',
    },
    {
      kind: 'text',
      key: 'phone',
      label: { en: 'WhatsApp number', id: 'Nomor WhatsApp' },
      help: {
        en: 'Optional — the shop’s own number is used when empty.',
        id: 'Opsional — nomor toko dipakai bila kosong.',
      },
      max: 32,
      default: '',
    },
    {
      kind: 'boolean',
      key: 'noteEnabled',
      label: { en: 'Let visitors add a note', id: 'Izinkan pengunjung menambah catatan' },
      default: true,
    },
    {
      kind: 'text',
      key: 'noteLabel',
      label: { en: 'Note label', id: 'Label catatan' },
      max: 40,
      default: 'Note',
    },
    {
      kind: 'number',
      key: 'maxItems',
      label: { en: 'Products shown', id: 'Produk ditampilkan' },
      min: 1,
      max: MAX_ORDER_ITEMS,
      step: 1,
      default: 6,
    },
    {
      kind: 'text',
      key: 'ctaLabel',
      label: { en: 'Button label', id: 'Label tombol' },
      max: 40,
      default: 'Send order on WhatsApp',
    },
  ],
}

export function OrderFormWidget({ block }: BlockRendererProps) {
  const { data, formatPrice, mode } = useRenderEnvironment()
  const title = readText(block.settings, 'title')
  const intro = readText(block.settings, 'intro')
  const noteEnabled = readBoolean(block.settings, 'noteEnabled')
  const noteLabel = readText(block.settings, 'noteLabel') || 'Note'
  const ctaLabel = readText(block.settings, 'ctaLabel') || 'Send order on WhatsApp'
  const phone = readText(block.settings, 'phone') || data.shop.phone || ''
  const limit = Math.min(
    MAX_ORDER_ITEMS,
    Math.max(1, Math.round(readNumber(block.settings, 'maxItems', 6))),
  )

  const products = useMemo(() => data.latest.slice(0, limit), [data.latest, limit])
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [note, setNote] = useState('')

  const lines: OrderLine[] = products
    .filter((product) => (quantities[product.id] ?? 0) > 0)
    .map((product) => ({
      name: product.name,
      quantity: quantities[product.id]!,
      totalLabel: formatPrice(product.price * quantities[product.id]!, data.shop.currency),
    }))
  const total = products.reduce(
    (sum, product) => sum + product.price * (quantities[product.id] ?? 0),
    0,
  )
  const totalLabel = formatPrice(total, data.shop.currency)
  const link = whatsappOrderLink(phone, buildOrderMessage(data.shop.name, lines, note, totalLabel))

  if (products.length === 0 || !link) {
    if (mode !== 'preview') return null
    return (
      <Box
        data-widget="order-form"
        borderWidth="1px"
        borderStyle="dashed"
        borderColor="border"
        rounded="lg"
        minH="24"
        display="flex"
        alignItems="center"
        justifyContent="center"
        px="4"
      >
        <Text fontSize="sm" color="fg.muted" textAlign="center">
          {products.length === 0
            ? 'Products will appear here once the shop has them.'
            : 'Add a WhatsApp number in shop settings, or on this block.'}
        </Text>
      </Box>
    )
  }

  const step = (id: string, by: number) =>
    setQuantities((current) => {
      const next = Math.min(MAX_QUANTITY, Math.max(0, (current[id] ?? 0) + by))
      return { ...current, [id]: next }
    })

  return (
    <Stack gap="4" data-widget="order-form" maxW="lg">
      {title && <Text fontWeight="semibold">{title}</Text>}
      {intro && (
        <Text fontSize="sm" color="fg.muted">
          {intro}
        </Text>
      )}

      <Stack gap="1.5">
        {products.map((product) => (
          <HStack
            key={product.id}
            gap="3"
            borderWidth="1px"
            borderColor="border.subtle"
            rounded="lg"
            px="3"
            py="2"
          >
            <Text fontSize="sm" flex="1" minW="0" truncate>
              {product.name}
            </Text>
            <Text fontSize="sm" color="fg.muted" flexShrink="0" fontVariantNumeric="tabular-nums">
              {formatPrice(product.price, data.shop.currency)}
            </Text>
            <HStack gap="1" flexShrink="0">
              <IconButton
                aria-label={`Remove one ${product.name}`}
                size="xs"
                variant="outline"
                disabled={(quantities[product.id] ?? 0) === 0}
                onClick={() => step(product.id, -1)}
              >
                <LuMinus />
              </IconButton>
              <Text w="6" textAlign="center" fontSize="sm" fontVariantNumeric="tabular-nums">
                {quantities[product.id] ?? 0}
              </Text>
              <IconButton
                aria-label={`Add one ${product.name}`}
                size="xs"
                variant="outline"
                disabled={(quantities[product.id] ?? 0) >= MAX_QUANTITY}
                onClick={() => step(product.id, 1)}
              >
                <LuPlus />
              </IconButton>
            </HStack>
          </HStack>
        ))}
      </Stack>

      {noteEnabled && (
        <Stack gap="1">
          <Text fontSize="sm" color="fg.muted">
            {noteLabel}
          </Text>
          <Input
            size="sm"
            maxLength={300}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Delivery address, preferred time…"
          />
        </Stack>
      )}

      <HStack justify="space-between" wrap="wrap" gap="3">
        <Text fontSize="sm">
          Total{' '}
          <Text as="span" fontWeight="bold" fontVariantNumeric="tabular-nums">
            {totalLabel}
          </Text>
        </Text>
        <Button asChild colorPalette="brand" disabled={lines.length === 0}>
          <a href={link} target="_blank" rel="noopener noreferrer">
            {ctaLabel}
          </a>
        </Button>
      </HStack>
    </Stack>
  )
}

/** Registers the schema and its renderer. Idempotent; see `./index`. */
export function registerOrderForm(): void {
  registerWidget(orderFormSchema, OrderFormWidget)
}
