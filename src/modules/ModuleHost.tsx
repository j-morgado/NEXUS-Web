import { lazy, Suspense, useCallback, useEffect, useMemo } from 'react'
import { LoadingScreen } from '../components/LoadingScreen'
import { ModuleBoundary } from '../components/ModuleBoundary'
import type { HotspotMode } from '../domain/schemas'
import type { VisualSettings } from '../services/visualSettings'
import { createModuleLifecycle } from './lifecycle'
import type { ExperienceModuleDefinition } from './schema'

const Configurator = lazy(() => import('../screens/Configurator').then(module => ({ default: module.Configurator })))

type Props = {
  definition: ExperienceModuleDefinition
  mode: 'hub' | 'standalone'
  onExit: () => void
  hotspotMode?: HotspotMode
  visual?: VisualSettings
  showPerformanceStats?: boolean
  managedLoading?: boolean
  onReadyChange?: (ready: boolean) => void
  onProgress?: (progress: number) => void
}

export function ModuleHost({ definition, mode, onExit, onReadyChange, ...runtime }: Props) {
  const lifecycle = useMemo(() => createModuleLifecycle(definition.id), [definition.id])
  useEffect(() => () => lifecycle.dispose(), [lifecycle])
  const exit = useCallback(() => {
    lifecycle.onExit()
    onExit()
  }, [lifecycle, onExit])
  const fail = useCallback((error: Error) => {
    lifecycle.onError(error)
    onReadyChange?.(true)
  }, [lifecycle, onReadyChange])

  return <ModuleBoundary moduleTitle={definition.presentation.title} onExit={exit} onFailure={fail}>
    <Suspense fallback={runtime.managedLoading ? null : <LoadingScreen />}>
      <Configurator definition={definition} lifecycle={lifecycle} hostMode={mode} onExit={exit} onReadyChange={onReadyChange} {...runtime} />
    </Suspense>
  </ModuleBoundary>
}

