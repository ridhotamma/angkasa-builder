/**
 * The order-tracking section: a form that looks an order up by its number and
 * the phone it was placed with, then opens it.
 *
 * The lookup is the host's — it owns the shop's orders and its routes — so the
 * whole interactive form arrives through `env.slots.orderTracking`. The editor,
 * which has no orders behind it, gets an inert stand-in drawn from the same
 * labels, so the section reads true on the canvas.
 */

import { Button, Card, Field, Heading, Input, Stack, Text } from '@chakra-ui/react'

import { readText } from '../model/fields'
import { useRenderEnvironment } from './context'
import { alignOf, type SectionProps } from './sections'

export function OrderTracking({ settings }: SectionProps) {
  const { slots } = useRenderEnvironment()
  const align = alignOf(settings)
  const heading = readText(settings, 'heading')
  const body = readText(settings, 'subheading')

  return (
    <Stack
      as="section"
      gap="4"
      alignItems={align === 'center' ? 'center' : 'flex-start'}
      textAlign={align}
    >
      {heading && (
        <Heading as="h2" size="xl">
          {heading}
        </Heading>
      )}
      {body && <Text color="fg.muted">{body}</Text>}
      {slots?.orderTracking ? slots.orderTracking(settings) : <OrderTrackingStandIn settings={settings} />}
    </Stack>
  )
}

/** The editor's view: the same fields, inert, before a shopper is there. */
function OrderTrackingStandIn({ settings }: SectionProps) {
  return (
    <Card.Root bg="bg.panel" maxW="md" w="full">
      <Card.Body>
        <Stack gap="3">
          <Field.Root>
            <Field.Label>{readText(settings, 'orderNumberLabel')}</Field.Label>
            <Input size="sm" placeholder="INV-0001" disabled />
          </Field.Root>
          <Field.Root>
            <Field.Label>{readText(settings, 'phoneLabel')}</Field.Label>
            <Input size="sm" placeholder="0812 3456 7890" disabled />
          </Field.Root>
          <Button size="sm" alignSelf="start" disabled>
            {readText(settings, 'submitLabel')}
          </Button>
        </Stack>
      </Card.Body>
    </Card.Root>
  )
}
