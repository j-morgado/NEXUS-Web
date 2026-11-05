import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEDUPE_WINDOW_MS, enqueueRequest, getQueueHealth, injectQueueRecordForTest, listRequests, normalizeQueueError, QueuePersistenceError, unconfiguredTransport } from './requestQueue'

describe('durable request queue', () => {
  afterEach(() => vi.restoreAllMocks())
  it('persists pending status and suppresses duplicate taps', async () => {
    const input = { name: 'Test Visitor', email: 'dedupe@example.com', productId: 'jltv-demo' }
    const first = await enqueueRequest(input)
    const second = await enqueueRequest(input)
    expect(first.duplicate).toBe(false)
    expect(second.duplicate).toBe(true)
    expect((await listRequests())).toHaveLength(1)
    expect(first.request.status).toBe('pending-not-configured')
  })

  it('suppresses rapid duplicates across an old fixed-window boundary', async () => {
    const boundary = Math.ceil(Date.now() / DEDUPE_WINDOW_MS) * DEDUPE_WINDOW_MS
    const input = { name: 'Boundary Visitor', email: 'boundary@example.com', productId: 'jltv-demo' }
    vi.spyOn(Date, 'now').mockReturnValue(boundary - 1_000)
    expect((await enqueueRequest(input)).duplicate).toBe(false)
    vi.mocked(Date.now).mockReturnValue(boundary + 1_000)
    expect((await enqueueRequest(input)).duplicate).toBe(true)
  })

  it('quarantines corrupt records without losing valid requests', async () => {
    await injectQueueRecordForTest({ id: 'corrupt-record', email: 'not-an-email', status: 'sent' })
    const requests = await listRequests()
    expect(requests.some((request) => request.id === 'corrupt-record')).toBe(false)
    const health = await getQueueHealth()
    expect(health.quarantined).toBeGreaterThanOrEqual(1)
    expect(health.sent).toBe(0)
    expect(health.transport).toBe('not-configured')
  })

  it('cannot claim delivery through the unconfigured transport', async () => {
    await expect(unconfiguredTransport.send()).rejects.toThrow('not configured')
  })

  it('reports storage quota and availability failures honestly', () => {
    expect(normalizeQueueError(new DOMException('full', 'QuotaExceededError'))).toEqual(expect.objectContaining({ reason: 'quota' }))
    expect(normalizeQueueError(new Error('blocked'))).toEqual(expect.objectContaining({ reason: 'unavailable' }))
    expect(normalizeQueueError(new Error('blocked'))).toBeInstanceOf(QueuePersistenceError)
  })
})
