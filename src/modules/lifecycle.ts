import { bridgeMessageSchema } from '../domain/schemas'

export function signalModule(type: 'module:ready' | 'module:exit', moduleId: string) {
  window.dispatchEvent(new CustomEvent('nexus:module', { detail: bridgeMessageSchema.parse({ type, moduleId }) }))
}
