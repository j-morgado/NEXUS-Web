import { openDB } from 'idb'
import { z } from 'zod'
import { explorerCatalogSchema, type ExplorerCatalog } from '../content/catalog'

const DB_NAME = 'nexus-explorer-content-v2'
const STORE = 'publications'

export const catalogSourceScopeSchema = z.object({
  sourceId: z.string().min(1),
  eventId: z.string().min(1),
  publicationId: z.string().min(1),
  mode: z.enum(['production', 'demonstration']),
})

const cachedCatalogSchema = z.object({
  scope: catalogSourceScopeSchema,
  storedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  catalog: explorerCatalogSchema,
})

export type CatalogSourceScope = z.infer<typeof catalogSourceScopeSchema>
export type CachedCatalog = z.infer<typeof cachedCatalogSchema>
export type CacheWritePolicy = { now?: number; maxAgeMs: number }

const database = () => openDB(DB_NAME, 1, {
  upgrade(db) {
    db.createObjectStore(STORE)
  },
})

const scopeKey = (scope: CatalogSourceScope) => JSON.stringify(catalogSourceScopeSchema.parse(scope))
const sameScope = (left: CatalogSourceScope, right: CatalogSourceScope) => scopeKey(left) === scopeKey(right)

const isEligibleForScope = (catalog: ExplorerCatalog, scope: CatalogSourceScope) => (
  catalog.publicationId === scope.publicationId
  && catalog.publicationState === 'published'
  && (scope.mode === 'demonstration' || catalog.approvalStatus === 'approved')
)

export interface CatalogCache {
  read(scope: CatalogSourceScope, now?: number): Promise<ExplorerCatalog | null>
  write(scope: CatalogSourceScope, catalog: ExplorerCatalog, policy: CacheWritePolicy): Promise<void>
  invalidate(scope: CatalogSourceScope): Promise<void>
}

export const indexedDbCatalogCache: CatalogCache = {
  async read(scope, now = Date.now()) {
    const db = await database()
    const key = scopeKey(scope)
    const record = cachedCatalogSchema.safeParse(await db.get(STORE, key))
    if (!record.success || !sameScope(record.data.scope, scope) || !isEligibleForScope(record.data.catalog, scope) || Date.parse(record.data.expiresAt) <= now) {
      await db.delete(STORE, key)
      return null
    }
    return record.data.catalog
  },
  async write(scope, catalog, { now = Date.now(), maxAgeMs }) {
    const validatedScope = catalogSourceScopeSchema.parse(scope)
    const validatedCatalog = explorerCatalogSchema.parse(catalog)
    if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0) throw new Error('Catalog cache max age must be positive.')
    if (!isEligibleForScope(validatedCatalog, validatedScope)) throw new Error('Catalog is not eligible for this cache scope.')
    const record = cachedCatalogSchema.parse({
      scope: validatedScope,
      storedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + maxAgeMs).toISOString(),
      catalog: validatedCatalog,
    })
    await (await database()).put(STORE, record, scopeKey(validatedScope))
  },
  async invalidate(scope) {
    await (await database()).delete(STORE, scopeKey(scope))
  },
}

