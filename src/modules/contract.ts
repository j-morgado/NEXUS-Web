import type { ReactNode } from 'react'
import type { ExperienceModuleDefinition } from './schema'

export type ModuleLifecycle = {
  onReady: () => void
  onExit: () => void
  onError: (error: Error) => void
  onActivity: () => void
  dispose: () => void
}

export type NexusModule = {
  definition: ExperienceModuleDefinition
  render: (lifecycle: ModuleLifecycle) => ReactNode
  dispose: () => void
}
