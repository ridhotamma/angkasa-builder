/**
 * The products the editor knows about: the preview's own, plus every one the
 * seller has found through the product picker this session.
 *
 * A picked product must show in the preview straight away, before any save —
 * so the picker hands its search result here, and the builder merges this
 * list into the preview's `data.products`.
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

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
  const products = useMemo(() => {
    const byId = new Map<string, StorefrontProductCard>()
    for (const product of [...initial, ...found]) byId.set(product.id, product)
    return [...byId.values()]
  }, [initial, found])

  return (
    <CatalogueContext.Provider value={{ products, remember }}>
      {children(products)}
    </CatalogueContext.Provider>
  )
}

export function useCatalogue(): Catalogue {
  return useContext(CatalogueContext)
}
