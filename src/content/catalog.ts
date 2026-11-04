import { z } from 'zod'

export const mediaKindSchema = z.enum(['image', 'video', 'pdf'])
export type MediaKind = z.infer<typeof mediaKindSchema>

const safeAssetUrlSchema = z.string().min(1).superRefine((value, context) => {
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) return
  try {
    const url = new URL(value)
    if (url.protocol === 'https:' && !url.username && !url.password) return
  } catch { /* Report one consistent validation issue below. */ }
  context.addIssue({ code: 'custom', message: 'Asset URLs must be root-relative or use HTTPS.' })
})

export const catalogMediaSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  kind: mediaKindSchema,
  url: safeAssetUrlSchema,
  thumbnailUrl: safeAssetUrlSchema.optional(),
  accent: z.string().regex(/^#[0-9a-f]{6}$/i),
  pageCount: z.number().int().positive().max(1000).optional(),
})

export const catalogProductSchema = z.object({
  id: z.string().min(1),
  marketId: z.string().min(1),
  name: z.string().min(1),
  designation: z.string().min(1),
  description: z.string().min(1),
  specs: z.array(z.object({ name: z.string().min(1), value: z.string().min(1) })).min(1),
  features: z.array(z.object({ name: z.string().min(1), description: z.string().min(1) })).min(1),
  media: z.array(catalogMediaSchema).min(1),
  heroMediaId: z.string().min(1),
  heroMediaLabel: z.string().min(1),
  isFiller: z.boolean(),
}).superRefine((product, context) => {
  if (!product.media.some((media) => media.id === product.heroMediaId)) {
    context.addIssue({ code: 'custom', path: ['heroMediaId'], message: 'Hero media must reference an item in the product media array.' })
  }
})

export const catalogMarketSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  products: z.array(catalogProductSchema).min(1),
})

export const explorerCatalogSchema = z.object({
  schemaVersion: z.literal(1),
  publicationId: z.string().min(1),
  revision: z.string().min(1),
  publishedAt: z.string().datetime(),
  approvalStatus: z.enum(['demonstration', 'approved']),
  copy: z.object({
    title: z.string().min(1),
    introduction: z.string().min(1),
    systemSuffix: z.string().min(1),
    specificationsHeading: z.string().min(1),
    featuresLabel: z.string().min(1),
    shareLabel: z.string().min(1),
    shareIntroduction: z.string().min(1),
  }),
  markets: z.array(catalogMarketSchema).min(1),
}).superRefine((catalog, context) => {
  const marketIds = new Set<string>()
  const productIds = new Set<string>()
  for (const [marketIndex, market] of catalog.markets.entries()) {
    if (marketIds.has(market.id)) context.addIssue({ code: 'custom', path: ['markets', marketIndex, 'id'], message: 'Market IDs must be unique.' })
    marketIds.add(market.id)
    for (const [productIndex, product] of market.products.entries()) {
      if (product.marketId !== market.id) context.addIssue({ code: 'custom', path: ['markets', marketIndex, 'products', productIndex, 'marketId'], message: 'Product marketId must match its containing market.' })
      if (productIds.has(product.id)) context.addIssue({ code: 'custom', path: ['markets', marketIndex, 'products', productIndex, 'id'], message: 'Product IDs must be unique across the publication.' })
      productIds.add(product.id)
      const mediaIds = new Set<string>()
      for (const [mediaIndex, media] of product.media.entries()) {
        if (mediaIds.has(media.id)) context.addIssue({ code: 'custom', path: ['markets', marketIndex, 'products', productIndex, 'media', mediaIndex, 'id'], message: 'Media IDs must be unique within a product.' })
        mediaIds.add(media.id)
      }
      if (catalog.approvalStatus === 'approved' && product.isFiller) {
        context.addIssue({ code: 'custom', path: ['markets', marketIndex, 'products', productIndex, 'isFiller'], message: 'Approved publications cannot contain filler products.' })
      }
    }
  }
})

export type CatalogMedia = z.infer<typeof catalogMediaSchema>
export type CatalogProduct = z.infer<typeof catalogProductSchema>
export type CatalogMarket = z.infer<typeof catalogMarketSchema>
export type ExplorerCatalog = z.infer<typeof explorerCatalogSchema>

const marketNames = ['Land', 'Sea', 'Air', 'Space', 'Cyber', 'Health'] as const
const accents = ['#8d63ea', '#5f7de8', '#b469df', '#6e57c7', '#9554b7', '#6753ac']

const makeProduct = (marketName: string, marketIndex: number, productIndex: number) => {
  const id = `${marketName.toLowerCase()}-${productIndex + 1}`
  const name = productIndex === 0 && marketName === 'Land' ? 'JLTV Overview' : `${marketName} Product ${String(productIndex + 1).padStart(2, '0')}`
  const media = [
    ...Array.from({ length: 3 }, (_, index) => ({ id: `${id}-image-${index + 1}`, name: `${name} Image ${index + 1}`, description: 'Placeholder product image. Final approved media pending.', kind: 'image' as const, url: '/assets/jltv-card.webp', thumbnailUrl: '/assets/jltv-card.webp', accent: accents[(marketIndex + index) % accents.length] })),
    ...Array.from({ length: 2 }, (_, index) => ({ id: `${id}-video-${index + 1}`, name: `${name} Video ${index + 1}`, description: 'Placeholder product video. Final approved media pending.', kind: 'video' as const, url: '/assets/nexus-placeholder-loop.mp4', thumbnailUrl: '/assets/jltv-card.webp', accent: accents[(marketIndex + index + 2) % accents.length] })),
    { id: `${id}-pdf-1`, name: `${name} Overview PDF`, description: 'Placeholder product document. Final approved PDF pending.', kind: 'pdf' as const, url: '/assets/demo-overview.pdf', thumbnailUrl: '/assets/jltv-card.webp', accent: accents[(marketIndex + 4) % accents.length], pageCount: 4 },
  ]
  return {
    id,
    marketId: marketName.toLowerCase(),
    name,
    designation: `${marketName.toUpperCase()} DEMONSTRATION SYSTEM`,
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer consequat viverra efficitur. Aenean quam nibh, dictum et lorem eu, aliquam vulputate lectus.',
    specs: ['Capability', 'Range', 'Role', 'Environment', 'Readiness', 'Integration'].map((label, index) => ({ name: label, value: index < 2 ? 'TBD' : `Placeholder ${index + 1}` })),
    features: Array.from({ length: 5 }, (_, index) => ({ name: `Feature ${index + 1}`, description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed sed odio sit amet tellus dignissim hendrerit.' })),
    media,
    heroMediaId: media[3].id,
    heroMediaLabel: 'Hero video placeholder · final approved media pending',
    isFiller: true,
  }
}

/** Packaged mock publication. It crosses the same schema boundary as a remote CMS payload. */
export const packagedCatalog = explorerCatalogSchema.parse({
  schemaVersion: 1,
  publicationId: 'nexus-explorer-demonstration',
  revision: '2026-11-04.1',
  publishedAt: '2026-11-04T00:00:00.000Z',
  approvalStatus: 'demonstration',
  copy: {
    title: 'Explorer',
    introduction: 'Browse our catalogue of products and services, their related features, details, media and more.',
    systemSuffix: 'system',
    specificationsHeading: 'Specifications',
    featuresLabel: 'Product features',
    shareLabel: 'Share',
    shareIntroduction: 'To receive more information regarding this product please fill out the following information.',
  },
  markets: marketNames.map((name, marketIndex) => ({
    id: name.toLowerCase(),
    name,
    products: Array.from({ length: 5 }, (_, productIndex) => makeProduct(name, marketIndex, productIndex)),
  })),
})

// Compatibility exports for non-runtime reports/tests. Explorer itself loads through a provider.
export const catalogMarkets = packagedCatalog.markets
export const allCatalogProducts = catalogMarkets.flatMap((market) => market.products)
