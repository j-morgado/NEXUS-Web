import { openDB } from 'idb'
import { z } from 'zod'

const pendingRequestSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  name: z.string().min(2),
  email: z.string().email(),
  productId: z.string().min(1),
  status: z.literal('pending-not-configured'),
  dedupeKey: z.string().min(1),
  dedupeIdentity: z.string().min(1).optional(),
})

export type PendingRequest = z.infer<typeof pendingRequestSchema>

export type QueueHealth = {
  pending: number
  quarantined: number
  sent: 0
  transport: 'not-configured'
}

export interface RequestTransport {
  readonly state: 'not-configured'
  send(): Promise<never>
}

export const unconfiguredTransport: RequestTransport = {
  state: 'not-configured',
  async send() { throw new Error('Email service not configured') },
}

export class QueuePersistenceError extends Error {
  constructor(public readonly reason: 'quota' | 'unavailable') {
    super(reason === 'quota' ? 'Local storage is full' : 'Local storage is unavailable')
    this.name = 'QueuePersistenceError'
  }
}

export function normalizeQueueError(error: unknown) {
  if (error instanceof DOMException && error.name === 'QuotaExceededError') return new QueuePersistenceError('quota')
  return new QueuePersistenceError('unavailable')
}

const DB_NAME = 'nexus-local-outbox-v1'
const STORE = 'requests'
const QUARANTINE = 'quarantine'
export const DEDUPE_WINDOW_MS = 5 * 60 * 1000

const db = () => openDB(DB_NAME, 3, {
  upgrade(database, oldVersion, _newVersion, transaction) {
    if (oldVersion < 1) {
      const store = database.createObjectStore(STORE, { keyPath: 'id' })
      store.createIndex('dedupeKey', 'dedupeKey', { unique: true })
    }
    if (oldVersion < 2) database.createObjectStore(QUARANTINE, { keyPath: 'quarantineId' })
    if (oldVersion < 3) {
      const store = transaction.objectStore(STORE)
      if (store.indexNames.contains('dedupeKey')) store.deleteIndex('dedupeKey')
      store.createIndex('dedupeIdentity', 'dedupeIdentity')
    }
  },
})

function dedupeIdentity(email: string, productId: string) {
  return `${email.trim().toLowerCase()}|${productId}`
}

export async function enqueueRequest(input: Pick<PendingRequest, 'name' | 'email' | 'productId'>) {
  const database = await db()
  const identity = dedupeIdentity(input.email, input.productId)
  const now = Date.now()
  const transaction = database.transaction(STORE, 'readwrite')
  const store = transaction.store
  const candidates = await store.getAll()
  const previous = candidates.map(record => pendingRequestSchema.safeParse(record)).find(result => result.success && (result.data.dedupeIdentity ?? result.data.dedupeKey.replace(/\|[^|]+$/, '')) === identity && Date.parse(result.data.createdAt) >= now - DEDUPE_WINDOW_MS)
  if (previous?.success) {
    await transaction.done
    return { request: previous.data, duplicate: true }
  }

  const id = crypto.randomUUID()
  const request = pendingRequestSchema.parse({
    ...input,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    id,
    createdAt: new Date(now).toISOString(),
    status: 'pending-not-configured',
    dedupeKey: `${identity}|${now}|${id}`,
    dedupeIdentity: identity,
  })
  try {
    await store.add(request)
    await transaction.done
    return { request, duplicate: false }
  } catch (error) {
    throw normalizeQueueError(error)
  }
}

export async function listRequests(): Promise<PendingRequest[]> {
  const database = await db()
  const records = await database.getAll(STORE)
  const valid: PendingRequest[] = []
  for (const record of records) {
    const parsed = pendingRequestSchema.safeParse(record)
    if (parsed.success) {
      valid.push(parsed.data)
      continue
    }
    const transaction = database.transaction([STORE, QUARANTINE], 'readwrite')
    await transaction.objectStore(QUARANTINE).put({ quarantineId: crypto.randomUUID(), quarantinedAt: new Date().toISOString(), record })
    if (record && typeof record === 'object' && 'id' in record) await transaction.objectStore(STORE).delete(String(record.id))
    await transaction.done
  }
  return valid.sort((left, right) => left.createdAt.localeCompare(right.createdAt))
}

export async function getQueueHealth(): Promise<QueueHealth> {
  const database = await db()
  const pending = (await listRequests()).length
  const quarantined = await database.count(QUARANTINE)
  return { pending, quarantined, sent: 0, transport: 'not-configured' }
}

export async function injectQueueRecordForTest(record: unknown) {
  await (await db()).put(STORE, record)
}
