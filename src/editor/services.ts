/**
 * What an app plugs into the editor.
 *
 * The editor is the same in the seller dashboard and the developer console;
 * what differs is where an uploaded image goes and which collections exist.
 * Those arrive here, so the editor never imports a server function.
 */

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
  collections: readonly CatalogueOption[]
  categories: readonly CatalogueOption[]
  /** The shop's custom pages, for page links. */
  pages: readonly CatalogueOption[]
}
