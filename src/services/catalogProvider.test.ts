import { describe, expect, it, vi } from 'vitest'
import { packagedCatalog, type ExplorerCatalog } from '../content/catalog'
import type { CatalogCache } from './catalogCache'
import { HttpCatalogProvider, loadExplorerCatalog, normalizedCatalogAdapter, type CatalogProvider } from './catalogProvider'

const provider = (result: ExplorerCatalog | Error): CatalogProvider => ({
  name: 'test',
  async load() {
    if (result instanceof Error) throw result
    return result
  },
})

const memoryCache = (initial: ExplorerCatalog | null = null): CatalogCache & { value: ExplorerCatalog | null } => ({
  value: initial,
  async read() { return this.value },
  async write(catalog) { this.value = catalog },
})

describe('Explorer catalog providers', () => {
  it('loads and caches a validated remote publication', async () => {
    const remoteCatalog = structuredClone(packagedCatalog)
    remoteCatalog.revision = 'remote-2'
    const cache = memoryCache()
    const result = await loadExplorerCatalog({ remote: provider(remoteCatalog), cache })
    expect(result.source).toBe('remote')
    expect(result.catalog.revision).toBe('remote-2')
    expect(cache.value?.revision).toBe('remote-2')
  })

  it('uses the last validated cache when remote loading fails', async () => {
    const cached = structuredClone(packagedCatalog)
    cached.revision = 'cached-1'
    const result = await loadExplorerCatalog({ remote: provider(new Error('offline')), cache: memoryCache(cached) })
    expect(result.source).toBe('cache')
    expect(result.catalog.revision).toBe('cached-1')
    expect(result.warning).toContain('last validated')
  })

  it('keeps valid remote content available when local caching fails', async () => {
    const cache: CatalogCache = { read: async () => null, write: async () => { throw new Error('storage blocked') } }
    const result = await loadExplorerCatalog({ remote: provider(packagedCatalog), cache })
    expect(result.source).toBe('remote')
    expect(result.warning).toContain('could not save')
  })

  it('uses demonstration content when remote and cache are unavailable', async () => {
    const result = await loadExplorerCatalog({ remote: provider(new Error('offline')), cache: memoryCache() })
    expect(result.source).toBe('packaged')
    expect(result.catalog.approvalStatus).toBe('demonstration')
    expect(result.warning).toContain('packaged demonstration')
  })

  it('rejects malformed remote payloads before they reach the UI', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ markets: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const remote = new HttpCatalogProvider('/content/catalog.json', normalizedCatalogAdapter, fetcher as typeof fetch)
    await expect(remote.load()).rejects.toThrow()
  })

  it('refuses insecure remote publication endpoints', () => {
    expect(() => new HttpCatalogProvider('http://cms.example.test/catalog')).toThrow(/HTTPS/)
    expect(() => new HttpCatalogProvider('/\\cms.example.test/catalog')).toThrow()
    expect(() => new HttpCatalogProvider('https://user:secret@cms.example.test/catalog')).toThrow(/credential-free/)
  })
})
