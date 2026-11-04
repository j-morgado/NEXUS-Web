import { describe, expect, it } from 'vitest'
import { cloneEnvironmentPresets, environmentOrder, environmentPresets, serializeEnvironmentConfig } from './environmentConfig'

describe('environment exploration configuration', () => {
  it('defines distinct review presets for land, sea, and air', () => {
    expect(environmentOrder).toEqual(['land', 'sea', 'air'])
    expect(new Set(environmentOrder.map(kind => environmentPresets[kind].label)).size).toBe(3)
    expect(environmentOrder.every(kind => environmentPresets[kind].motion >= 0 && environmentPresets[kind].motion <= 1)).toBe(true)
  })

  it('clones presets before creator editing and serializes a versioned payload', () => {
    const cloned = cloneEnvironmentPresets()
    cloned.sea.keyLight = 4
    expect(environmentPresets.sea.keyLight).toBe(2.2)
    expect(JSON.parse(serializeEnvironmentConfig('sea', cloned.sea))).toMatchObject({ schemaVersion: 1, environment: 'sea', scene: { keyLight: 4 } })
  })
})
