import { describe, expect, it } from 'vitest'
import { allCatalogProducts, catalogMarkets } from './catalog'

describe('Explorer filler catalog', () => {
  it('contains six markets with five fully structured products each', () => {
    expect(catalogMarkets.map((market) => market.name)).toEqual(['Land', 'Sea', 'Air', 'Space', 'Cyber', 'Health'])
    expect(catalogMarkets.every((market) => market.products.length === 5)).toBe(true)
    expect(allCatalogProducts).toHaveLength(30)
    for (const product of allCatalogProducts) {
      expect(product.specs).toHaveLength(6)
      expect(product.features).toHaveLength(5)
      expect(product.media.filter((media) => media.kind === 'image')).toHaveLength(3)
      expect(product.media.filter((media) => media.kind === 'video')).toHaveLength(2)
      expect(product.media.filter((media) => media.kind === 'pdf')).toHaveLength(1)
      expect(product.heroVideoLabel).toBeTruthy()
      expect(product.isFiller).toBe(true)
    }
  })
})
