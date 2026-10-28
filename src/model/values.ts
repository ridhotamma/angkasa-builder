/** Small checks on stored values, shared by the field sanitisers. */

/**
 * Whether an image reference is an object-storage key (`shop/abc.jpg`) rather
 * than a file id, a URL or a stock photo.
 */
export function isAssetKey(reference: string): boolean {
  return reference.includes('/') && !reference.includes('://') && !reference.startsWith('stock:')
}

/** Whether a latitude and longitude are a real place: finite, in range, and not 0,0. */
export function hasCoordinates(address: {
  latitude?: number | null
  longitude?: number | null
}): address is { latitude: number; longitude: number } {
  const { latitude, longitude } = address
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return false
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false
  if (latitude === 0 && longitude === 0) return false
  return Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
}
