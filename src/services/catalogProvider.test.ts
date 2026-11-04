import { describe, expect, it, vi } from 'vitest'
import { packagedCatalog, type ExplorerCatalog } from '../content/catalog'
import type { CatalogCache, CatalogSourceScope } from './catalogCache'
import { CatalogHttpError, HttpCatalogProvider, configuredCatalogProvider, loadExplorerCatalog, type CatalogProvider } from './catalogProvider'

const productionScope: CatalogSourceScope = { sourceId: 'https://cms.example.test/catalog', eventId: 'event-a', publicationId: 'publication-a', mode: 'production' }
const demonstrationScope: CatalogSourceScope = { ...productionScope, mode: 'demonstration' }

const approvedCatalog = (scope = productionScope) => {
  const catalog = structuredClone(packagedCatalog)
  catalog.publicationId = scope.publicationId
  catalog.approvalStatus = 'approved'
  catalog.publicationState = 'published'
  for (const product of catalog.markets.flatMap((market) => market.products)) product.isFiller = false
  return catalog
}

const provider = (result: ExplorerCatalog | Error, scope: CatalogSourceScope = productionScope): CatalogProvider => ({
  name: 'test',
  scope,
  cacheMaxAgeMs: 1_000,
  async load() {
    if (result instanceof Error) throw result
    return result
  },
})
const key = (scope: CatalogSourceScope) => JSON.stringify(scope)
const memoryCache = (): CatalogCache & { values: Map<string, { catalog: ExplorerCatalog; expiresAt: number }>; invalidated: string[] } => ({
  values: new Map(),
  invalidated: [],
  async read(scope, now = Date.now()) {
    const value = this.values.get(key(scope))
    return value && value.expiresAt > now ? value.catalog : null
  },
  async write(scope, catalog, policy) {
    const now = policy.now ?? Date.now()
    this.values.set(key(scope), { catalog, expiresAt: now + policy.maxAgeMs })
  },
  async invalidate(scope) {
    this.values.delete(key(scope))
    this.invalidated.push(key(scope))
  },
})

describe('Explorer catalog providers', () => {
  it('loads and caches only an approved production publication', async () => {
    const catalog = approvedCatalog()
    catalog.revision = 'remote-2'
    const cache = memoryCache()
    const result = await loadExplorerCatalog({ remote: provider(catalog), cache, now: 10 })
    expect(result.source).toBe('remote')
    expect(result.warning).toBeNull()
    expect(cache.values.get(key(productionScope))?.catalog.revision).toBe('remote-2')
  })

  it('rejects an unapproved remote publication in production and never caches it', async () => {
    const demonstration = structuredClone(packagedCatalog)
    demonstration.publicationId = productionScope.publicationId
    for (const product of demonstration.markets.flatMap((market) => market.products)) product.isFiller = false
    const cache = memoryCache()
    const result = await loadExplorerCatalog({ remote: provider(demonstration), cache })
    expect(result.source).toBe('packaged')
    expect(result.warning).toMatch(/not editorially approved/i)
    expect(cache.values.size).toBe(0)
  })

  it('segregates explicitly enabled demonstration mode and always labels it', async () => {
    const demonstration = structuredClone(packagedCatalog)
    demonstration.publicationId = demonstrationScope.publicationId
    const cache = memoryCache()
    const result = await loadExplorerCatalog({ remote: provider(demonstration, demonstrationScope), cache })
    expect(result.source).toBe('remote')
    expect(result.warning).toMatch(/Demonstration content/i)
    expect(cache.values.has(key(demonstrationScope))).toBe(true)
    expect(cache.values.has(key(productionScope))).toBe(false)
  })

  it('uses only a fresh cache matching the exact endpoint, event, publication and mode', async () => {
    const cache = memoryCache()
    const catalog = approvedCatalog()
    await cache.write(productionScope, catalog, { now: 100, maxAgeMs: 1_000 })
    const matching = await loadExplorerCatalog({ remote: provider(new Error('offline')), cache, now: 500 })
    expect(matching.source).toBe('cache')

    const wrongSource = { ...productionScope, sourceId: 'https://other.example.test/catalog' }
    const mismatched = await loadExplorerCatalog({ remote: provider(new Error('offline'), wrongSource), cache, now: 500 })
    expect(mismatched.source).toBe('packaged')

    const expired = await loadExplorerCatalog({ remote: provider(new Error('offline')), cache, now: 1_101 })
    expect(expired.source).toBe('packaged')
  })

  it('invalidates the scoped cache on HTTP 410 and does not show retired content', async () => {
    const cache = memoryCache()
    await cache.write(productionScope, approvedCatalog(), { now: 100, maxAgeMs: 10_000 })
    const result = await loadExplorerCatalog({ remote: provider(new CatalogHttpError(410)), cache, now: 200 })
    expect(result.source).toBe('packaged')
    expect(result.warning).toMatch(/retired.*invalidated/i)
    expect(cache.values.has(key(productionScope))).toBe(false)
    expect(cache.invalidated).toContain(key(productionScope))
  })

  it('invalidates a 200 response explicitly marked retired', async () => {
    const cache = memoryCache()
    await cache.write(productionScope, approvedCatalog(), { now: 100, maxAgeMs: 10_000 })
    const retired = approvedCatalog()
    retired.publicationState = 'retired'
    const result = await loadExplorerCatalog({ remote: provider(retired), cache, now: 200 })
    expect(result.source).toBe('packaged')
    expect(cache.values.has(key(productionScope))).toBe(false)
  })

  it('keeps valid approved remote content available when local caching fails', async () => {
    const cache: CatalogCache = { read: async () => null, write: async () => { throw new Error('storage blocked') }, invalidate: async () => undefined }
    const result = await loadExplorerCatalog({ remote: provider(approvedCatalog()), cache })
    expect(result.source).toBe('remote')
    expect(result.warning).toContain('could not save')
  })

  it('rejects malformed remote payloads before they reach the UI', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ markets: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const remote = new HttpCatalogProvider('/content/catalog.json', { eventId: 'event-a', publicationId: 'publication-a', fetcher: fetcher as typeof fetch })
    await expect(remote.load()).rejects.toThrow()
  })

  it('requires safe endpoints and an explicit event/publication scope', () => {
    const options = { eventId: 'event-a', publicationId: 'publication-a' }
    expect(() => new HttpCatalogProvider('http://cms.example.test/catalog', options)).toThrow(/HTTPS/)
    expect(() => new HttpCatalogProvider('/\\cms.example.test/catalog', options)).toThrow()
    expect(() => new HttpCatalogProvider('https://user:secret@cms.example.test/catalog', options)).toThrow(/credential-free/)
    expect(() => new HttpCatalogProvider('/catalog.json', { eventId: '', publicationId: '' })).toThrow(/required/)
    expect(() => configuredCatalogProvider({ VITE_NEXUS_CMS_CATALOG_URL: '/catalog.json' })).toThrow(/event and publication IDs/)
  })
})
