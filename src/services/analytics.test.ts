import { describe, expect, it } from 'vitest'
import { getUsageEvents, recordUsage } from './analytics'

describe('usage analytics', () => {
  it('stores only non-personal usage fields', () => {
    recordUsage({ type: 'screen-enter', moduleId: 'jltv' })
    const encoded = JSON.stringify(getUsageEvents())
    expect(encoded).not.toMatch(/email|name/i)
  })
})
