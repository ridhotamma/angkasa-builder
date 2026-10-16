/**
 * What an app plugs into the editor.
 *
 * The editor is the same in the seller dashboard and the developer console;
 * what differs is where an uploaded file goes and which catalogue exists.
 * Those arrive here, so the editor never imports a server function.
 */

import type { StorefrontLocale } from '../model/localized'
import type { StorefrontProductCard, StorefrontVoucherData } from '../render/context'

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

/** An article to link to: slugs are unique per blog, so the blog comes along. */
export interface ArticleOption extends CatalogueOption {
  blogHandle: string
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
  /** The shop's blogs, for blog links; `slug` is the blog's handle. Omitted where there are none. */
  blogs?: readonly CatalogueOption[]
  /** The shop's articles, for article links, each with the handle of the blog it is in. */
  articles?: readonly ArticleOption[]
  vouchers?: readonly StorefrontVoucherData[]
  /**
   * Translate a batch of strings from one storefront language to another, in
   * order, for the translation manager's AI button. Omitted where the app has
   * no AI configured, which is also how the button knows to stay hidden.
   */
  translate?: (input: {
    from: StorefrontLocale
    to: StorefrontLocale
    texts: string[]
  }) => Promise<string[]>
}
