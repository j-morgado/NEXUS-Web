import { describe, expect, it } from 'vitest'
import { eventConfigSchema, productSchema } from './schemas'
import { seedProduct } from '../content/seed'

describe('versioned schemas', () => {
  it('rejects unsupported product schema versions', () => {
    expect(productSchema.safeParse({ ...seedProduct, schemaVersion: 2 }).success).toBe(false)
  })
  it('requires a five-second timeout warning', () => {
    expect(eventConfigSchema.safeParse({ schemaVersion: 1, id: 'x', version: '1', inactivitySeconds: 10, warningSeconds: 4, enabledModuleIds: ['x'], activeBundleVersion: '1', previousBundleVersion: null }).success).toBe(false)
  })
})
