/**
 * What an app plugs into the editor.
 *
 * The editor is the same in the seller dashboard and the developer console;
 * what differs is where an uploaded file goes and which catalogue exists.
 * Those arrive here, so the editor never imports a server function.
 */

import type { StorefrontProductCard } from '../render/context'

export interface EditorOption {
  value: string
  label: string
}

/** A catalogue entry: picked by id in section settings, linked to by slug. */
export interface CatalogueOption {
  id: string
  slug: string
  name: string
}

export interface EditorServices {
  /** Store an image and return its media file id. Throw with a message to show. */
  uploadImage: (file: File) => Promise<string>
  imageUrl: (fileId: string, size: { width: number; height: number }) => string | null
  /**
   * Store a video and return its file id, reporting progress from 0 to 1.
   * Omitted where videos cannot be uploaded; the video control then offers
   * YouTube and Vimeo links only.
   */
  uploadVideo?: (file: File, onProgress: (share: number) => void) => Promise<string>
  videoUrl?: (fileId: string) => string | null
  /**
   * The shop's products whose name matches `query`, for the product picker.
   * Omitted where there is no catalogue (the developer console's sample
   * data); the picker then lists the preview's own products.
   */
  searchProducts?: (query: string) => Promise<StorefrontProductCard[]>
  collections: readonly CatalogueOption[]
  categories: readonly CatalogueOption[]
  /** The shop's custom pages, for page links. */
  pages: readonly CatalogueOption[]
}
