/**
 * The built-in template library — intentionally empty.
 *
 * The previous Classic / Bold / Minimal / Studio presets were removed so
 * templates can be designed and built from scratch again. Platform templates
 * are now authored in the developer console (`apps/developer` → Themes),
 * which writes `scope: 'platform'` rows of `themes`; owner templates are
 * saved from a shop via "Save as template". There is no code preset to seed
 * and no `preset:` fallback — see docs/PAGE-BUILDER.md.
 *
 * `ThemePreset`, `THEME_PRESETS` and `findPreset` stay as an empty seam so
 * the next template designed from scratch has somewhere to land if it ever
 * needs a code source again.
 */

import type { Localized } from './localized'
import type { ThemeContent } from './content'

export interface ThemePreset {
  slug: string
  name: string
  description: Localized
  content: () => ThemeContent
}

/** No built-in presets — the library starts empty. */
export const THEME_PRESETS: readonly ThemePreset[] = []

/** Always `null`: there are no code presets to find. */
export function findPreset(_slug: string): ThemePreset | null {
  return null
}
