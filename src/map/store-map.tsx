/**
 * One or more places on a map, as a Google Maps embed.
 *
 * A storefront's locations are not an address form: nobody drags a pin or
 * pans a canvas, they pick a shop and look at where it is. So this is the
 * view-only twin of `AddressMap`'s static mode, drawn as the keyless Google
 * Maps iframe (`googleMapEmbedUrl` in `./urls`) rather than a Geoapify static
 * image proxied through the host app's route: the browser fetches the picture
 * straight from Google, with no key, no proxy and no measured image size.
 *
 * The embed draws a single marker from its `q` query, so one point is chosen:
 * the selected store when there is one, otherwise the first placed point. The
 * list beside a locator still carries every store, each with its own
 * directions link.
 *
 * Before a point has usable coordinates — server HTML, a browser without
 * JavaScript — a quiet pin placeholder stands in.
 */

import { Box, Center, Icon, type BoxProps } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { LuMapPin } from 'react-icons/lu'

import { googleMapEmbedUrl } from './urls'

export interface MapPoint {
  id: string
  latitude: number
  longitude: number
  /** Read out as the map's title, so the iframe is not just "frame". */
  label?: string
}

export interface StoreMapProps {
  points: readonly MapPoint[]
  /** The point the map opens on — the store the shopper picked. */
  selectedId?: string | null
  /** The map box; a responsive theme size works. */
  height?: BoxProps['h']
  /** Opening zoom. Google accepts 1–21; anything else clamps into it. */
  zoom?: number
  /** Rendered instead of the map when no point has usable coordinates. */
  empty?: ReactNode
}

/** Points whose coordinates are finite and on Earth. */
export function mapPoints(points: readonly MapPoint[]): MapPoint[] {
  return points.filter(
    (point) =>
      Number.isFinite(point.latitude) &&
      Number.isFinite(point.longitude) &&
      Math.abs(point.latitude) <= 90 &&
      Math.abs(point.longitude) <= 180 &&
      !(point.latitude === 0 && point.longitude === 0),
  )
}

export function StoreMap({
  points,
  selectedId,
  height = { base: '16rem', md: '22rem' },
  zoom,
  empty,
}: StoreMapProps) {
  const placed = mapPoints(points)
  // A lone pin (the map block) is always the point; several pins only show
  // the one something picked, falling back to the first so a map is never
  // blank while the list beside it has stores.
  const selected = placed.find((point) => point.id === selectedId) ?? placed[0] ?? null

  if (!selected) {
    return (
      empty ?? (
        <Center
          data-store-map=""
          data-store-map-empty=""
          h={height}
          rounded="l2"
          borderWidth="1px"
          borderStyle="dashed"
          borderColor="border"
          bg="bg.subtle"
          color="fg.subtle"
        >
          <Icon as={LuMapPin} boxSize="6" />
        </Center>
      )
    )
  }

  return (
    <Box
      data-store-map=""
      position="relative"
      h={height}
      w="full"
      rounded="l2"
      borderWidth="1px"
      borderColor="border.subtle"
      overflow="hidden"
      bg="bg.subtle"
    >
      <iframe
        title={selected.label?.trim() || 'Map'}
        src={googleMapEmbedUrl(selected, { zoom })}
        width="100%"
        height="100%"
        style={{ border: 0 }}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
    </Box>
  )
}
