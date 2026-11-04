import { explorerCatalogSchema, packagedCatalog, type ExplorerCatalog } from '../content/catalog'
import { indexedDbCatalogCache, type CatalogCache } from './catalogCache'

export interface CatalogPayloadAdapter {
  adapt(payload: unknown): ExplorerCatalog
}

export interface CatalogProvider {
  readonly name: string
  load(signal?: AbortSignal): Promise<ExplorerCatalog>
}

export const normalizedCatalogAdapter: CatalogPayloadAdapter = {
  adapt(payload) {
    return explorerCatalogSchema.parse(payload)
  },
}

export class PackagedCatalogProvider implements CatalogProvider {
  readonly name = 'packaged'
  async load() {
    return explorerCatalogSchema.parse(packagedCatalog)
  }
}

const safePublicationEndpoint = (value: string) => {
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) return value
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('CMS publication endpoint must use credential-free HTTPS or be root-relative.')
  return url.href
}

export class HttpCatalogProvider implements CatalogProvider {
  readonly name = 'remote'
  readonly #endpoint: string

  constructor(endpoint: string, private readonly adapter: CatalogPayloadAdapter = normalizedCatalogAdapter, private readonly fetcher: typeof fetch = fetch, private readonly timeoutMs = 8_000) {
    this.#endpoint = safePublicationEndpoint(endpoint)
  }

  async load(signal?: AbortSignal) {
    const request = new AbortController()
    let timedOut = false
    const abortFromCaller = () => request.abort(signal?.reason)
    if (signal?.aborted) abortFromCaller()
    else signal?.addEventListener('abort', abortFromCaller, { once: true })
    const timeout = window.setTimeout(() => { timedOut = true; request.abort() }, this.timeoutMs)
    // Native fetch must not receive the provider instance as its `this` value.
    const fetcher = this.fetcher
    try {
      const response = await fetcher(this.#endpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'omit',
        cache: 'no-cache',
        signal: request.signal,
      })
      if (!response.ok) throw new Error(`CMS publication request failed with HTTP ${response.status}.`)
      return this.adapter.adapt(await response.json())
    } catch (error) {
      if (timedOut) throw new Error(`CMS publication request timed out after ${this.timeoutMs}ms.`, { cause: error })
      throw error
    } finally {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', abortFromCaller)
    }
  }
}

export type CatalogLoadResult = {
  catalog: ExplorerCatalog
  source: 'remote' | 'cache' | 'packaged'
  warning: string | null
}

type LoaderOptions = {
  remote?: CatalogProvider
  packaged?: CatalogProvider
  cache?: CatalogCache
  signal?: AbortSignal
}

const describeFailure = (error: unknown) => error instanceof Error ? error.message : 'Unknown catalog error.'

export async function loadExplorerCatalog({ remote, packaged = new PackagedCatalogProvider(), cache = indexedDbCatalogCache, signal }: LoaderOptions = {}): Promise<CatalogLoadResult> {
  if (!remote) return { catalog: await packaged.load(signal), source: 'packaged', warning: null }

  try {
    const catalog = await remote.load(signal)
    try {
      await cache.write(catalog)
      return { catalog, source: 'remote', warning: null }
    } catch {
      return { catalog, source: 'remote', warning: 'Live content loaded, but this device could not save an offline fallback.' }
    }
  } catch (remoteError) {
    if (signal?.aborted) throw remoteError
    try {
      const cached = await cache.read()
      if (cached) return { catalog: cached, source: 'cache', warning: `Live content unavailable; showing the last validated publication. ${describeFailure(remoteError)}` }
    } catch { /* A damaged/unavailable cache must not prevent packaged recovery. */ }
    return {
      catalog: await packaged.load(signal),
      source: 'packaged',
      warning: `Live content unavailable and no validated cache was found; showing packaged demonstration content. ${describeFailure(remoteError)}`,
    }
  }
}

export function configuredCatalogProvider(env: Record<string, string | boolean | undefined> = import.meta.env): CatalogProvider | undefined {
  const endpoint = env.VITE_NEXUS_CMS_CATALOG_URL
  return typeof endpoint === 'string' && endpoint.trim() ? new HttpCatalogProvider(endpoint.trim()) : undefined
}

