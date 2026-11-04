import { describe, expect, it } from 'vitest'
import { allCatalogProducts, catalogMarkets, explorerCatalogSchema, packagedCatalog } from './catalog'

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
      expect(product.heroMediaLabel).toBeTruthy()
      expect(product.isFiller).toBe(true)
    }
  })

  it('rejects empty publications and missing product content', () => {
    expect(explorerCatalogSchema.safeParse({ ...packagedCatalog, markets: [] }).success).toBe(false)
    const missingMedia = structuredClone(packagedCatalog)
    missingMedia.markets[0].products[0].media = []
    expect(explorerCatalogSchema.safeParse(missingMedia).success).toBe(false)
  })

  it('rejects unsafe media URLs and cross-market product references', () => {
    const unsafe = structuredClone(packagedCatalog)
    unsafe.markets[0].products[0].media[0].url = 'javascript:alert(1)'
    expect(explorerCatalogSchema.safeParse(unsafe).success).toBe(false)

    const mismatched = structuredClone(packagedCatalog)
    mismatched.markets[0].products[0].marketId = 'sea'
    expect(explorerCatalogSchema.safeParse(mismatched).success).toBe(false)
  })

  it('does not allow filler content to be labeled as an approved publication', () => {
    expect(explorerCatalogSchema.safeParse({ ...packagedCatalog, approvalStatus: 'approved' }).success).toBe(false)
  })

  it('requires a thumbnail when PDF media is selected as the hero', () => {
    const catalog = structuredClone(packagedCatalog)
    const product = catalog.markets[0].products[0]
    const document = product.media.find((media) => media.kind === 'pdf')!
    delete document.thumbnailUrl
    product.heroMediaId = document.id
    expect(explorerCatalogSchema.safeParse(catalog).success).toBe(false)
  })
})
