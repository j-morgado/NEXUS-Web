import { afterEach, describe, expect, it, vi } from 'vitest'
const activate = vi.hoisted(() => vi.fn(async () => undefined))
vi.mock('virtual:pwa-register', () => ({ registerSW: () => activate }))
import { activatePublishedUpdate, checkForPublishedUpdate, registerOfflineWorker } from './serviceWorker'

afterEach(() => vi.unstubAllGlobals())
describe('published updates', () => {
  it('distinguishes an unavailable update service from being up to date', async () => {
    vi.stubGlobal('navigator', {})
    expect(await checkForPublishedUpdate()).toBe('unavailable')
  })
  it('checks the active registration and detects a downloaded update', async () => {
    const registration = { active: {}, waiting: null as object | null, installing: null, update: vi.fn(async () => undefined) }
    vi.stubGlobal('navigator', { serviceWorker: { ready: Promise.resolve(registration) } })
    expect(await checkForPublishedUpdate()).toBe('current')
    registration.waiting = {}
    expect(await checkForPublishedUpdate()).toBe('available')
    expect(registration.update).toHaveBeenCalledTimes(2)
  })
  it('activates the downloaded worker with a reload only when requested', async () => {
    registerOfflineWorker(vi.fn())
    expect(activate).not.toHaveBeenCalled()
    await activatePublishedUpdate()
    expect(activate).toHaveBeenCalledWith(true)
  })
})
