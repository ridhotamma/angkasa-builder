/**
 * Map URLs that need no key: Google's embed for the store map, and a link a
 * reader can open to route to an address.
 */

/** The keyless Google Maps embed for one pin, as an iframe `src`. */
export function googleMapEmbedUrl(
  coordinates: { latitude: number; longitude: number },
  options: { zoom?: number } = {},
): string {
  const requested = options.zoom ?? 15
  const zoom = Number.isFinite(requested) ? Math.min(21, Math.max(1, Math.round(requested))) : 15
  return `https://maps.google.com/maps?q=${coordinates.latitude},${coordinates.longitude}&z=${zoom}&output=embed`
}

/** The address on a real map, for a reader who wants to route to it. */
export function externalMapUrl(coordinates: { latitude: number; longitude: number }): string {
  return `https://www.google.com/maps/search/?api=1&query=${coordinates.latitude},${coordinates.longitude}`
}
