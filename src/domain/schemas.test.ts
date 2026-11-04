import { describe, expect, it } from 'vitest'
import { eventConfigSchema, productSchema, vehicleSchema } from './schemas'
import { seedProduct, seedVehicle } from '../content/seed'

describe('versioned schemas', () => {
  it('rejects unsupported product schema versions', () => {
    expect(productSchema.safeParse({ ...seedProduct, schemaVersion: 2 }).success).toBe(false)
  })
  it('requires a five-second timeout warning', () => {
    expect(eventConfigSchema.safeParse({ schemaVersion: 1, id: 'x', version: '1', inactivitySeconds: 10, warningSeconds: 4, enabledModuleIds: ['x'], activeBundleVersion: '1', previousBundleVersion: null }).success).toBe(false)
  })
  it('requires real node references only for available add-ons', () => {
    expect(vehicleSchema.safeParse({ ...seedVehicle, addons: [{ ...seedVehicle.addons[0], available: true, nodeName: null }] }).success).toBe(false)
    expect(vehicleSchema.safeParse({ ...seedVehicle, addons: [{ ...seedVehicle.addons[0], available: false, nodeName: 'PretendNode' }] }).success).toBe(false)
    expect(vehicleSchema.safeParse({ ...seedVehicle, addons: [{ ...seedVehicle.addons[0], available: false, nodeName: null }] }).success).toBe(true)
  })
})
