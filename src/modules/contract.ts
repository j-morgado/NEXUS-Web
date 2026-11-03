import type { ReactNode } from 'react'

export type ModuleLifecycle = {
  onReady: () => void
  onExit: () => void
  onError: (error: Error) => void
  onActivity: () => void
}

export type NexusModule = {
  id: string
  version: string
  engineRange: string
  render: (lifecycle: ModuleLifecycle) => ReactNode
  dispose: () => void
}
