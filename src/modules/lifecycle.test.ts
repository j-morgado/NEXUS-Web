import { describe, expect, it, vi } from 'vitest'
import { createModuleLifecycle } from './lifecycle'

describe('module lifecycle adapter', () => {
  it('emits validated module-scoped messages and de-duplicates terminal events', () => {
    const details: unknown[] = []
    const activity: unknown[] = []
    const onModule = vi.fn((event: Event) => details.push((event as CustomEvent).detail))
    const onActivity = vi.fn((event: Event) => activity.push((event as CustomEvent).detail))
    window.addEventListener('nexus:module', onModule)
    window.addEventListener('nexus:activity', onActivity)

    const lifecycle = createModuleLifecycle('training-rig')
    lifecycle.onReady()
    lifecycle.onReady()
    lifecycle.onActivity()
    lifecycle.onError(new Error('fixture failure'))
    lifecycle.onExit()
    lifecycle.dispose()

    expect(details).toEqual([
      { type: 'module:ready', moduleId: 'training-rig' },
      { type: 'module:error', moduleId: 'training-rig', message: 'fixture failure' },
      { type: 'module:exit', moduleId: 'training-rig' },
    ])
    expect(activity).toEqual([{ type: 'activity', source: 'module', moduleId: 'training-rig' }])

    window.removeEventListener('nexus:module', onModule)
    window.removeEventListener('nexus:activity', onActivity)
  })
})
