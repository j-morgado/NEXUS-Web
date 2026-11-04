import { openDB } from 'idb'
import { explorerCatalogSchema, type ExplorerCatalog } from '../content/catalog'

const DB_NAME = 'nexus-explorer-content-v1'
const STORE = 'publications'
const ACTIVE_KEY = 'last-validated'

const database = () => openDB(DB_NAME, 1, {
  upgrade(db) {
    db.createObjectStore(STORE)
  },
})

export interface CatalogCache {
  read(): Promise<ExplorerCatalog | null>
  write(catalog: ExplorerCatalog): Promise<void>
}

export const indexedDbCatalogCache: CatalogCache = {
  async read() {
    const record = await (await database()).get(STORE, ACTIVE_KEY)
    const parsed = explorerCatalogSchema.safeParse(record)
    return parsed.success ? parsed.data : null
  },
  async write(catalog) {
    const validated = explorerCatalogSchema.parse(catalog)
    await (await database()).put(STORE, validated, ACTIVE_KEY)
  },
}

