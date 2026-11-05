import { describe, expect, it, vi } from 'vitest'
import { seedEventConfig } from '../content/seed'
import { defaultSettings, getConfigState, getOperatorSettings, injectConfigRecordForTest, isModuleEnabled, rollbackEventConfig, saveOperatorSettings, stageAndActivateEventConfig } from './configStore'

describe('local configuration store', () => {
  it('maintains active and previous bundles and rolls back safely', async () => {
    await stageAndActivateEventConfig(seedEventConfig)
    await stageAndActivateEventConfig({ ...seedEventConfig, version: '0.2.0', activeBundleVersion: 'jltv-0.2.0', previousBundleVersion: 'jltv-0.1.0' })
    const state = await getConfigState()
    expect(state.active.config.version).toBe('0.2.0')
    expect(state.previous?.config.version).toBe('0.1.0')
    const rolledBack = await rollbackEventConfig()
    expect(rolledBack.active.config.version).toBe('0.1.0')
    expect(rolledBack.previous?.config.version).toBe('0.2.0')
  })

  it('rejects invalid staged configuration before activation', async () => {
    const before = await getConfigState()
    await expect(stageAndActivateEventConfig({ ...seedEventConfig, warningSeconds: 4 })).rejects.toThrow()
    expect((await getConfigState()).active.key).toBe(before.active.key)
  })

  it('combines published and device-local module availability', () => {
    expect(isModuleEnabled(seedEventConfig, defaultSettings, 'jltv')).toBe(true)
    expect(isModuleEnabled(seedEventConfig, { ...defaultSettings, locallyDisabledModuleIds: ['jltv'] }, 'jltv')).toBe(false)
    expect(isModuleEnabled({ ...seedEventConfig, enabledModuleIds: ['other'] }, defaultSettings, 'jltv')).toBe(false)
  })

  it('recovers from a corrupt active bundle using the previous verified bundle', async () => {
    const good = await stageAndActivateEventConfig({ ...seedEventConfig, version: '0.3.0', activeBundleVersion: 'jltv-0.3.0' })
    await injectConfigRecordForTest('corrupt@1', { key: 'corrupt@1', config: {}, checksum: 'bad' }, { active: 'corrupt@1', previous: good.key })
    const recovered = await getConfigState()
    expect(recovered.active.key).toBe(good.key)
    expect(recovered.recoveredFrom).toBe('previous')
  })

  it('persists validated operator choices', async () => {
    await saveOperatorSettings({ inactivitySeconds: 300, qualityTier: 'high', updateChecksEnabled: false, locallyDisabledModuleIds: ['demo'] })
    expect(await getOperatorSettings()).toMatchObject({ inactivitySeconds: 300, qualityTier: 'high', updateChecksEnabled: false, locallyDisabledModuleIds: ['demo'] })
  })

  it('writes operator choices synchronously for an immediate reload', async () => {
    const pending = saveOperatorSettings({ inactivitySeconds: 60, qualityTier: 'standard', updateChecksEnabled: false, locallyDisabledModuleIds: [] })
    expect(JSON.parse(localStorage.getItem('nexus-operator-settings-v1') ?? '{}').updateChecksEnabled).toBe(false)
    await pending
  })
  it('falls back to IndexedDB when synchronous storage is blocked', async () => {
    localStorage.clear()
    const blocked = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw new DOMException('blocked', 'SecurityError') })
    await saveOperatorSettings({ ...defaultSettings, inactivitySeconds: 180 })
    blocked.mockRestore()
    expect(await getOperatorSettings()).toMatchObject({ inactivitySeconds: 180 })
  })
  it('migrates legacy quality settings and persists custom effect choices', async () => {
    await saveOperatorSettings({ inactivitySeconds: 60, qualityTier: 'high', updateChecksEnabled: true, locallyDisabledModuleIds: [] })
    const high = await getOperatorSettings()
    expect(high.visual.ssgi).toBe(true)
    expect(high.visual.ssaoSamples).toBe(32)
    const custom = { ...high, qualityTier: 'custom' as const, showPerformanceStats: true, visual: { ...high.visual, ssao: false, ssrSteps: 64, resolutionScale: .75 } }
    await saveOperatorSettings(custom)
    expect(await getOperatorSettings()).toEqual(custom)
    await expect(saveOperatorSettings({ ...custom, visual: { ...custom.visual, ssrSteps: 200 } })).rejects.toThrow()
  })

})
