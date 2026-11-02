import { bridgeMessageSchema } from '../domain/schemas'

export function signalActivity(source: 'shell' | 'module' | 'explorer' | 'media') {
  window.dispatchEvent(new CustomEvent('nexus:activity', { detail: bridgeMessageSchema.parse({ type: 'activity', source }) }))
}

export function signalModule(type: 'module:ready' | 'module:exit', moduleId: string) {
  window.dispatchEvent(new CustomEvent('nexus:module', { detail: bridgeMessageSchema.parse({ type, moduleId }) }))
}
