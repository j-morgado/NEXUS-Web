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
const DEDUPE_WINDOW_MS = 5 * 60 * 1000

const db = () => openDB(DB_NAME, 2, {
  upgrade(database, oldVersion) {
    if (oldVersion < 1) {
      const store = database.createObjectStore(STORE, { keyPath: 'id' })
      store.createIndex('dedupeKey', 'dedupeKey', { unique: true })
    }
    if (oldVersion < 2) database.createObjectStore(QUARANTINE, { keyPath: 'quarantineId' })
  },
})

function dedupeKey(email: string, productId: string, now = Date.now()) {
  return `${email.trim().toLowerCase()}|${productId}|${Math.floor(now / DEDUPE_WINDOW_MS)}`
}

export async function enqueueRequest(input: Pick<PendingRequest, 'name' | 'email' | 'productId'>) {
  const database = await db()
  const key = dedupeKey(input.email, input.productId)
  const previous = await database.getFromIndex(STORE, 'dedupeKey', key)
  const parsedPrevious = pendingRequestSchema.safeParse(previous)
  if (parsedPrevious.success) return { request: parsedPrevious.data, duplicate: true }

  const request = pendingRequestSchema.parse({
    ...input,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: 'pending-not-configured',
    dedupeKey: key,
  })
  try {
    await database.add(STORE, request)
    return { request, duplicate: false }
  } catch (error) {
    const concurrent = await database.getFromIndex(STORE, 'dedupeKey', key)
    const parsedConcurrent = pendingRequestSchema.safeParse(concurrent)
    if (parsedConcurrent.success) return { request: parsedConcurrent.data, duplicate: true }
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
