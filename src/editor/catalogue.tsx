/**
 * The products the editor knows about: the preview's own, plus every one the
 * seller has found through the product picker this session.
 *
 * A picked product must show in the preview straight away, before any save —
 * so the picker hands its search result here, and the builder merges this
 * list into the preview's `data.products`.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import type { StorefrontProductCard } from '../render/context'

interface Catalogue {
  products: StorefrontProductCard[]
  remember: (product: StorefrontProductCard) => void
}

const CatalogueContext = createContext<Catalogue>({ products: [], remember: () => {} })

export function CatalogueProvider({
  initial,
  children,
}: {
  initial: readonly StorefrontProductCard[]
  children: (products: StorefrontProductCard[]) => ReactNode
}) {
  const [found, setFound] = useState<StorefrontProductCard[]>([])
  const remember = useCallback((product: StorefrontProductCard) => {
    setFound((current) =>
      current.some((known) => known.id === product.id) ? current : [...current, product],
    )
  }, [])
  // Keyed on which products there are, not on the array: screens pass
  // `picked = []` and inline lists, and a new list on every render would
  // redraw the whole preview on every keystroke.
  const latestInitial = useRef(initial)
  latestInitial.current = initial
  const initialKey = initial.map((product) => product.id).join('|')
  const products = useMemo(() => {
    const byId = new Map<string, StorefrontProductCard>()
    for (const product of [...latestInitial.current, ...found]) byId.set(product.id, product)
    return [...byId.values()]
  }, [initialKey, found])

  return (
    <CatalogueContext.Provider value={{ products, remember }}>
      {children(products)}
    </CatalogueContext.Provider>
  )
}

export function useCatalogue(): Catalogue {
  return useContext(CatalogueContext)
}
