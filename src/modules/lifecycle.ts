import { bridgeMessageSchema } from '../domain/schemas'
import type { ModuleLifecycle } from './contract'

function dispatch(detail: unknown, eventName: 'nexus:activity' | 'nexus:module') {
  const message = bridgeMessageSchema.parse(detail)
  window.dispatchEvent(new CustomEvent(eventName, { detail: message }))
}

export function signalActivity(source: 'shell' | 'module' | 'explorer' | 'media', moduleId?: string) {
  dispatch({ type: 'activity', source, moduleId }, 'nexus:activity')
}

export function signalModule(type: 'module:ready' | 'module:exit', moduleId: string) {
  dispatch({ type, moduleId }, 'nexus:module')
}

export function signalModuleError(moduleId: string, error: Error) {
  dispatch({ type: 'module:error', moduleId, message: error.message || 'Unknown module error' }, 'nexus:module')
}

export function createModuleLifecycle(moduleId: string): ModuleLifecycle {
  let ready = false
  let exited = false
  const exit = () => {
    if (exited) return
    exited = true
    signalModule('module:exit', moduleId)
  }
  return {
    onReady: () => {
      if (ready || exited) return
      ready = true
      signalModule('module:ready', moduleId)
    },
    onExit: exit,
    onError: error => signalModuleError(moduleId, error),
    onActivity: () => signalActivity('module', moduleId),
    dispose: exit,
  }
}
