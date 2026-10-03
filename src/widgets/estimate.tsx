/**
 * Estimate — pick options, watch a running total.
 *
 * A quote builder for services and made-to-order shops: each option carries an
 * amount, the visitor ticks what they want, and the total updates. Amounts are
 * stored in the currency's smallest unit, exactly like every other price on
 * the platform, and formatted through the render environment so the storefront
 * locale decides the shape. The total is a suggestion, not an order — the CTA
 * link is what takes the visitor to the next step.
 */

import { Box, Button, Checkbox, HStack, Input, Stack, Text } from '@chakra-ui/react'
import { useMemo, useState } from 'react'

import type { BlockSchema, FieldValues } from '../model/fields'
import { readBoolean, readLink, readList, readNumber, readText } from '../model/fields'
import { registerWidget, type BlockRendererProps } from '../render/block-registry'
import { useRenderEnvironment } from '../render/context'

export const MAX_ESTIMATE_OPTIONS = 12

export interface EstimateOption {
  id: string
  label: string
  detail: string
  /** In the currency's smallest unit (rupiah: the rupiah). */
  amount: number
  selected: boolean
}

export function readEstimateOptions(values: FieldValues): EstimateOption[] {
  return readList(values, 'options')
    .map((item) => ({
      id: item.id,
      label: readText(item, 'label'),
      detail: readText(item, 'detail'),
      amount: Math.max(0, Math.round(readNumber(item, 'amount', 0))),
      selected: readBoolean(item, 'selected'),
    }))
    .filter((option) => option.label.length > 0)
    .slice(0, MAX_ESTIMATE_OPTIONS)
}

/** The sum of the picked options, times the quantity. */
export function estimateTotal(
  options: readonly EstimateOption[],
  picks: readonly boolean[],
  quantity = 1,
): number {
  const each = options.reduce((sum, option, index) => sum + (picks[index] ? option.amount : 0), 0)
  return each * Math.max(1, Math.floor(quantity))
}

export const estimateSchema: BlockSchema = {
  type: 'widget-estimate',
  name: { en: 'Estimate builder', id: 'Pembuat estimasi' },
  description: {
    en: 'Visitors tick the options they want and see a running total — quotes without a spreadsheet.',
    id: 'Pengunjung memilih opsi dan melihat total berjalan — estimasi tanpa spreadsheet.',
  },
  fields: [
    {
      kind: 'text',
      key: 'title',
      label: { en: 'Title', id: 'Judul' },
      max: 80,
      default: 'Build your estimate',
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
      kind: 'list',
      key: 'options',
      label: { en: 'Options', id: 'Opsi' },
      itemLabel: { en: 'Option', id: 'Opsi' },
      titleKey: 'label',
      max: MAX_ESTIMATE_OPTIONS,
      fields: [
        {
          kind: 'text',
          key: 'label',
          label: { en: 'Label', id: 'Label' },
          max: 60,
          default: '',
        },
        {
          kind: 'text',
          key: 'detail',
          label: { en: 'Detail', id: 'Detail' },
          max: 120,
          default: '',
        },
        {
          kind: 'number',
          key: 'amount',
          label: { en: 'Amount', id: 'Jumlah' },
          help: {
            en: 'In the smallest currency unit — rupiah has no cents.',
            id: 'Dalam satuan terkecil — rupiah tanpa sen.',
          },
          min: 0,
          max: 1_000_000_000,
          step: 1_000,
          default: 0,
        },
        {
          kind: 'boolean',
          key: 'selected',
          label: { en: 'Picked by default', id: 'Terpilih secara bawaan' },
          default: false,
        },
      ],
    },
    {
      kind: 'boolean',
      key: 'allowQuantity',
      label: { en: 'Let visitors set a quantity', id: 'Izinkan pengunjung mengatur jumlah' },
      default: false,
    },
    {
      kind: 'text',
      key: 'quantityLabel',
      label: { en: 'Quantity label', id: 'Label jumlah' },
      max: 40,
      default: 'Quantity',
    },
    {
      kind: 'text',
      key: 'ctaLabel',
      label: { en: 'Button label', id: 'Label tombol' },
      help: { en: 'Optional.', id: 'Opsional.' },
      max: 32,
      default: '',
    },
    {
      kind: 'link',
      key: 'ctaLink',
      label: { en: 'Button link', id: 'Tautan tombol' },
    },
  ],
}

export function EstimateWidget({ block }: BlockRendererProps) {
  const options = useMemo(() => readEstimateOptions(block.settings), [block.settings])
  const title = readText(block.settings, 'title')
  const intro = readText(block.settings, 'intro')
  const allowQuantity = readBoolean(block.settings, 'allowQuantity')
  const quantityLabel = readText(block.settings, 'quantityLabel') || 'Quantity'
  const ctaLabel = readText(block.settings, 'ctaLabel')
  const ctaLink = readLink(block.settings, 'ctaLink')
  const { formatPrice, data, href } = useRenderEnvironment()

  const [picks, setPicks] = useState<boolean[]>(() => options.map((option) => option.selected))
  const [quantity, setQuantity] = useState(1)

  if (options.length === 0) return null

  const total = estimateTotal(options, picks, allowQuantity ? quantity : 1)
  const ctaHref = href?.(ctaLink) ?? null

  return (
    <Stack gap="4" data-widget="estimate" maxW="lg">
      {title && <Text fontWeight="semibold">{title}</Text>}
      {intro && (
        <Text fontSize="sm" color="fg.muted">
          {intro}
        </Text>
      )}

      <Stack gap="1.5">
        {options.map((option, index) => (
          <HStack
            key={option.id}
            gap="3"
            align="start"
            borderWidth="1px"
            borderColor="border.subtle"
            rounded="lg"
            px="3"
            py="2.5"
          >
            <Checkbox.Root
              checked={picks[index] ?? false}
              onCheckedChange={({ checked }) =>
                setPicks((current) =>
                  current.map((value, at) => (at === index ? checked === true : value)),
                )
              }
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control mt="0.5" />
            </Checkbox.Root>
            <Stack gap="0.5" flex="1" minW="0">
              <Text fontSize="sm" fontWeight="medium">
                {option.label}
              </Text>
              {option.detail && (
                <Text fontSize="xs" color="fg.muted">
                  {option.detail}
                </Text>
              )}
            </Stack>
            <Text fontSize="sm" fontVariantNumeric="tabular-nums" flexShrink="0">
              {formatPrice(option.amount, data.shop.currency)}
            </Text>
          </HStack>
        ))}
      </Stack>

      <HStack justify="space-between" gap="3" wrap="wrap">
        {allowQuantity && (
          <HStack gap="2">
            <Text fontSize="sm" color="fg.muted">
              {quantityLabel}
            </Text>
            <Input
              type="number"
              size="sm"
              w="20"
              min={1}
              max={999}
              value={quantity}
              onChange={(event) => {
                const value = Number(event.target.value)
                setQuantity(
                  Number.isFinite(value) ? Math.min(999, Math.max(1, Math.floor(value))) : 1,
                )
              }}
            />
          </HStack>
        )}
        <Box ms="auto" textAlign="right">
          <Text fontSize="xs" color="fg.muted">
            Estimated total
          </Text>
          <Text fontSize="xl" fontWeight="bold" fontVariantNumeric="tabular-nums">
            {formatPrice(total, data.shop.currency)}
          </Text>
        </Box>
      </HStack>

      {ctaLabel && (
        <Button asChild colorPalette="brand" alignSelf="start">
          <a href={ctaHref ?? '#'}>{ctaLabel}</a>
        </Button>
      )}
    </Stack>
  )
}

/** Registers the schema and its renderer. Idempotent; see `./index`. */
export function registerEstimate(): void {
  registerWidget(estimateSchema, EstimateWidget)
}
