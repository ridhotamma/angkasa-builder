/** The probe's browser entry: the geometry, handed to the page as a global. */

import * as geometry from '../src/editor/drop-geometry'

;(globalThis as unknown as { DropGeometry: unknown }).DropGeometry = geometry
