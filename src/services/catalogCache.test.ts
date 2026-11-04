import { describe, expect, it } from 'vitest'
import { packagedCatalog } from '../content/catalog'
import { indexedDbCatalogCache, type CatalogSourceScope } from './catalogCache'

const scope = (suffix: string, mode: 'production' | 'demonstration' = 'production'): CatalogSourceScope => ({
  sourceId: `https://cms.example.test/${suffix}`,
  eventId: `event-${suffix}`,
  publicationId: `publication-${suffix}`,
  mode,
})

const approved = (target: CatalogSourceScope) => {
  const catalog = structuredClone(packagedCatalog)
  catalog.publicationId = target.publicationId
  catalog.approvalStatus = 'approved'
  for (const product of catalog.markets.flatMap((market) => market.products)) product.isFiller = false
  return catalog
}

describe('scoped Explorer catalog cache', () => {
  it('reads only the exact source/event/publication scope and expires stale records', async () => {
    const target = scope('exact')
    await indexedDbCatalogCache.write(target, approved(target), { now: 1_000, maxAgeMs: 500 })
    expect(await indexedDbCatalogCache.read(target, 1_499)).not.toBeNull()
    expect(await indexedDbCatalogCache.read({ ...target, eventId: 'another-event' }, 1_499)).toBeNull()
    expect(await indexedDbCatalogCache.read(target, 1_500)).toBeNull()
  })

  it('invalidates one scope without affecting another', async () => {
    const first = scope('first')
    const second = scope('second')
    await indexedDbCatalogCache.write(first, approved(first), { now: 1_000, maxAgeMs: 10_000 })
    await indexedDbCatalogCache.write(second, approved(second), { now: 1_000, maxAgeMs: 10_000 })
    await indexedDbCatalogCache.invalidate(first)
    expect(await indexedDbCatalogCache.read(first, 1_100)).toBeNull()
    expect(await indexedDbCatalogCache.read(second, 1_100)).not.toBeNull()
  })

  it('will not write demonstration content into a production cache scope', async () => {
    const target = scope('production-only')
    const demonstration = structuredClone(packagedCatalog)
    demonstration.publicationId = target.publicationId
    await expect(indexedDbCatalogCache.write(target, demonstration, { maxAgeMs: 1_000 })).rejects.toThrow(/not eligible/)
  })
})

