import { explorerCatalogSchema, packagedCatalog, type ExplorerCatalog } from '../content/catalog'
import { indexedDbCatalogCache, type CatalogCache, type CatalogSourceScope } from './catalogCache'

const DEFAULT_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1_000

export interface CatalogPayloadAdapter {
  adapt(payload: unknown): ExplorerCatalog
}

export interface CatalogProvider {
  readonly name: string
  readonly scope?: CatalogSourceScope
  readonly cacheMaxAgeMs?: number
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

export class CatalogHttpError extends Error {
  constructor(readonly status: number) {
    super(`CMS publication request failed with HTTP ${status}.`)
    this.name = 'CatalogHttpError'
  }
}

export class CatalogPolicyError extends Error {
  constructor(message: string, readonly retirement = false) {
    super(message)
    this.name = 'CatalogPolicyError'
  }
}

const safePublicationEndpoint = (value: string) => {
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) return value
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('CMS publication endpoint must use credential-free HTTPS or be root-relative.')
  return url.href
}

type HttpCatalogProviderOptions = {
  eventId: string
  publicationId: string
  mode?: 'production' | 'demonstration'
  adapter?: CatalogPayloadAdapter
  fetcher?: typeof fetch
  timeoutMs?: number
  cacheMaxAgeMs?: number
}

export class HttpCatalogProvider implements CatalogProvider {
  readonly name = 'remote'
  readonly scope: CatalogSourceScope
  readonly cacheMaxAgeMs: number
  readonly #endpoint: string
  readonly #adapter: CatalogPayloadAdapter
  readonly #fetcher: typeof fetch
  readonly #timeoutMs: number

  constructor(endpoint: string, options: HttpCatalogProviderOptions) {
    this.#endpoint = safePublicationEndpoint(endpoint)
    this.scope = {
      sourceId: this.#endpoint,
      eventId: options.eventId.trim(),
      publicationId: options.publicationId.trim(),
      mode: options.mode ?? 'production',
    }
    if (!this.scope.eventId || !this.scope.publicationId) throw new Error('CMS event and publication IDs are required for cache isolation.')
    this.#adapter = options.adapter ?? normalizedCatalogAdapter
    this.#fetcher = options.fetcher ?? fetch
    this.#timeoutMs = options.timeoutMs ?? 8_000
    this.cacheMaxAgeMs = options.cacheMaxAgeMs ?? DEFAULT_CACHE_MAX_AGE_MS
    if (!Number.isFinite(this.cacheMaxAgeMs) || this.cacheMaxAgeMs <= 0) throw new Error('CMS cache max age must be positive.')
  }

  async load(signal?: AbortSignal) {
    const request = new AbortController()
    let timedOut = false
    const abortFromCaller = () => request.abort(signal?.reason)
    if (signal?.aborted) abortFromCaller()
    else signal?.addEventListener('abort', abortFromCaller, { once: true })
    const timeout = window.setTimeout(() => { timedOut = true; request.abort() }, this.#timeoutMs)
    const fetcher = this.#fetcher
    try {
      const response = await fetcher(this.#endpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'omit',
        cache: 'no-cache',
        signal: request.signal,
      })
      if (!response.ok) throw new CatalogHttpError(response.status)
      return this.#adapter.adapt(await response.json())
    } catch (error) {
      if (timedOut) throw new Error(`CMS publication request timed out after ${this.#timeoutMs}ms.`, { cause: error })
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
  now?: number
}

const describeFailure = (error: unknown) => error instanceof Error ? error.message : 'Unknown catalog error.'
const demonstrationWarning = 'Demonstration content — not approved for production or product claims.'
const isRetirement = (error: unknown) => error instanceof CatalogHttpError && error.status === 410 || error instanceof CatalogPolicyError && error.retirement

const enforcePublicationPolicy = (catalog: ExplorerCatalog, scope: CatalogSourceScope) => {
  if (catalog.publicationId !== scope.publicationId) throw new CatalogPolicyError(`Publication identity mismatch: expected ${scope.publicationId}.`)
  if (catalog.publicationState === 'retired') throw new CatalogPolicyError('CMS publication is retired.', true)
  if (scope.mode === 'production' && catalog.approvalStatus !== 'approved') {
    throw new CatalogPolicyError('Production mode rejected CMS content that is not editorially approved.')
  }
}

export async function loadExplorerCatalog({ remote, packaged = new PackagedCatalogProvider(), cache = indexedDbCatalogCache, signal, now = Date.now() }: LoaderOptions = {}): Promise<CatalogLoadResult> {
  if (!remote) return { catalog: await packaged.load(signal), source: 'packaged', warning: demonstrationWarning }
  if (!remote.scope) {
    const catalog = await packaged.load(signal)
    return { catalog, source: 'packaged', warning: 'Remote CMS configuration has no event/publication cache scope. Showing packaged demonstration content.' }
  }
  const scope = remote.scope

  try {
    const catalog = await remote.load(signal)
    enforcePublicationPolicy(catalog, scope)
    const warning = scope.mode === 'demonstration' ? demonstrationWarning : null
    try {
      await cache.write(scope, catalog, { now, maxAgeMs: remote.cacheMaxAgeMs ?? DEFAULT_CACHE_MAX_AGE_MS })
      return { catalog, source: 'remote', warning }
    } catch {
      return { catalog, source: 'remote', warning: warning ? `${warning} Offline fallback could not be saved.` : 'Live approved content loaded, but this device could not save an offline fallback.' }
    }
  } catch (remoteError) {
    if (signal?.aborted) throw remoteError
    if (isRetirement(remoteError)) {
      try { await cache.invalidate(scope) } catch { /* Retirement still prevents a cache read in this run. */ }
      return {
        catalog: await packaged.load(signal),
        source: 'packaged',
        warning: `The configured CMS publication is retired; its scoped cache was invalidated. ${demonstrationWarning}`,
      }
    }
    try {
      const cached = await cache.read(scope, now)
      if (cached) return { catalog: cached, source: 'cache', warning: `${scope.mode === 'demonstration' ? `${demonstrationWarning} ` : ''}Live content unavailable; showing the fresh publication cached for this event and source. ${describeFailure(remoteError)}` }
    } catch { /* A damaged/unavailable cache must not prevent packaged recovery. */ }
    return {
      catalog: await packaged.load(signal),
      source: 'packaged',
      warning: `Live content unavailable and no fresh cache matched this source, event, and publication. ${demonstrationWarning} ${describeFailure(remoteError)}`,
    }
  }
}

const parsePositiveSeconds = (value: string | boolean | undefined) => {
  if (value === undefined) return DEFAULT_CACHE_MAX_AGE_MS
  if (typeof value !== 'string' || !value.trim()) throw new Error('VITE_NEXUS_CMS_CACHE_MAX_AGE_SECONDS must be a positive number.')
  const seconds = Number(value)
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('VITE_NEXUS_CMS_CACHE_MAX_AGE_SECONDS must be a positive number.')
  return seconds * 1_000
}

export function configuredCatalogProvider(env: Record<string, string | boolean | undefined> = import.meta.env): CatalogProvider | undefined {
  const endpoint = env.VITE_NEXUS_CMS_CATALOG_URL
  if (typeof endpoint !== 'string' || !endpoint.trim()) return undefined
  const eventId = env.VITE_NEXUS_CMS_EVENT_ID
  const publicationId = env.VITE_NEXUS_CMS_PUBLICATION_ID
  const mode = env.VITE_NEXUS_CMS_MODE ?? 'production'
  if (typeof eventId !== 'string' || !eventId.trim() || typeof publicationId !== 'string' || !publicationId.trim()) throw new Error('CMS event and publication IDs are required when a CMS endpoint is configured.')
  if (mode !== 'production' && mode !== 'demonstration') throw new Error('VITE_NEXUS_CMS_MODE must be production or demonstration.')
  return new HttpCatalogProvider(endpoint.trim(), {
    eventId,
    publicationId,
    mode,
    cacheMaxAgeMs: parsePositiveSeconds(env.VITE_NEXUS_CMS_CACHE_MAX_AGE_SECONDS),
  })
}

