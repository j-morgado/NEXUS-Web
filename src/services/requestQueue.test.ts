import { describe, expect, it } from 'vitest'
import { enqueueRequest, getQueueHealth, injectQueueRecordForTest, listRequests, normalizeQueueError, QueuePersistenceError, unconfiguredTransport } from './requestQueue'

describe('durable request queue', () => {
  it('persists pending status and suppresses duplicate taps', async () => {
    const input = { name: 'Test Visitor', email: 'dedupe@example.com', productId: 'jltv-demo' }
    const first = await enqueueRequest(input)
    const second = await enqueueRequest(input)
    expect(first.duplicate).toBe(false)
    expect(second.duplicate).toBe(true)
    expect((await listRequests())).toHaveLength(1)
    expect(first.request.status).toBe('pending-not-configured')
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
