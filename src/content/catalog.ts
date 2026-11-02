export type MediaKind = 'image' | 'video' | 'pdf'

export type CatalogMedia = {
  id: string
  name: string
  description: string
  kind: MediaKind
  accent: string
}

export type CatalogProduct = {
  id: string
  marketId: string
  marketName: string
  name: string
  designation: string
  description: string
  specs: Array<{ name: string; value: string }>
  features: Array<{ name: string; description: string }>
  media: CatalogMedia[]
  heroVideoLabel: string
  isFiller: true
}

export type CatalogMarket = { id: string; name: string; products: CatalogProduct[] }

const marketNames = ['Land', 'Sea', 'Air', 'Space', 'Cyber', 'Health'] as const
const accents = ['#8d63ea', '#5f7de8', '#b469df', '#6e57c7', '#9554b7', '#6753ac']

const makeProduct = (marketName: string, marketIndex: number, productIndex: number): CatalogProduct => {
  const id = `${marketName.toLowerCase()}-${productIndex + 1}`
  const name = productIndex === 0 && marketName === 'Land' ? 'JLTV Overview' : `${marketName} Product ${String(productIndex + 1).padStart(2, '0')}`
  return {
    id,
    marketId: marketName.toLowerCase(),
    marketName,
    name,
    designation: `${marketName.toUpperCase()} DEMONSTRATION SYSTEM`,
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer consequat viverra efficitur. Aenean quam nibh, dictum et lorem eu, aliquam vulputate lectus.',
    specs: ['Capability', 'Range', 'Role', 'Environment', 'Readiness', 'Integration'].map((label, index) => ({ name: label, value: index < 2 ? 'TBD' : `Placeholder ${index + 1}` })),
    features: Array.from({ length: 5 }, (_, index) => ({ name: `Feature ${index + 1}`, description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed sed odio sit amet tellus dignissim hendrerit.' })),
    media: [
      ...Array.from({ length: 3 }, (_, index) => ({ id: `${id}-image-${index + 1}`, name: `${name} Image ${index + 1}`, description: 'Placeholder product image. Final approved media pending.', kind: 'image' as const, accent: accents[(marketIndex + index) % accents.length] })),
      ...Array.from({ length: 2 }, (_, index) => ({ id: `${id}-video-${index + 1}`, name: `${name} Video ${index + 1}`, description: 'Placeholder product video. Final approved media pending.', kind: 'video' as const, accent: accents[(marketIndex + index + 2) % accents.length] })),
      { id: `${id}-pdf-1`, name: `${name} Overview PDF`, description: 'Placeholder product document. Final approved PDF pending.', kind: 'pdf' as const, accent: accents[(marketIndex + 4) % accents.length] },
    ],
    heroVideoLabel: 'Hero video placeholder · final approved media pending',
    isFiller: true,
  }
}

export const catalogMarkets: CatalogMarket[] = marketNames.map((name, marketIndex) => ({
  id: name.toLowerCase(),
  name,
  products: Array.from({ length: 5 }, (_, productIndex) => makeProduct(name, marketIndex, productIndex)),
}))

export const allCatalogProducts = catalogMarkets.flatMap((market) => market.products)
