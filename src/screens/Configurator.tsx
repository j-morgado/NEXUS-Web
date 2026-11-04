import type { HotspotMode } from '../domain/schemas'
import { visualPresets, type VisualSettings } from '../services/visualSettings'
import { useEffect, useState } from 'react'
import { ModelStage } from '../components/ModelStage'
import { LoadingScreen } from '../components/LoadingScreen'
import type { ExperienceModuleDefinition } from '../modules/schema'
import type { ModuleLifecycle } from '../modules/contract'

export function Configurator({ definition, lifecycle, hostMode, onExit, qualityTier = 'standard', visual = visualPresets[qualityTier], hotspotMode = 'in-place', showPerformanceStats = false, managedLoading = false, onReadyChange, onProgress }: { definition: ExperienceModuleDefinition; lifecycle: ModuleLifecycle; hostMode: 'hub' | 'standalone'; onExit: () => void; qualityTier?: 'standard' | 'high'; visual?: VisualSettings; hotspotMode?: HotspotMode; showPerformanceStats?: boolean; managedLoading?: boolean; onReadyChange?: (ready: boolean) => void; onProgress?: (progress: number) => void }) {
  const [sceneReady, setSceneReady] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [activeAddon, setActiveAddon] = useState<string | null>(null)
  const [activeHotspot, setActiveHotspot] = useState<string | null>(null)
  useEffect(() => { setActiveHotspot(null) }, [hotspotMode])
  useEffect(() => { if (sceneReady) lifecycle.onReady() }, [sceneReady, lifecycle])
  useEffect(() => { onReadyChange?.(sceneReady) }, [sceneReady, onReadyChange])
  useEffect(() => { onProgress?.(loadingProgress) }, [loadingProgress, onProgress])
  return <main id="main-content" className="configurator" aria-busy={!sceneReady} data-module-id={definition.id} data-host-mode={hostMode} onPointerDownCapture={lifecycle.onActivity} onKeyDownCapture={lifecycle.onActivity} onWheelCapture={lifecycle.onActivity}>
    {!managedLoading && !sceneReady && <LoadingScreen progress={loadingProgress} />}
    <div className={`experience-content ${sceneReady ? 'is-ready' : ''}`} data-ready={sceneReady} aria-hidden={!sceneReady} inert={!sceneReady}>
    <nav className="experience-navigation" aria-label="Experience navigation"><button className="experience-hub" onClick={onExit}><span aria-hidden="true">←</span> Return to Hub</button></nav>
    <ModelStage vehicle={definition.vehicle} scene={definition.scene} activeAddonId={activeAddon} activeHotspot={activeHotspot} hotspotMode={hotspotMode} visual={visual} showPerformanceStats={showPerformanceStats} onHotspot={setActiveHotspot} onExit={onExit} onReadyChange={setSceneReady} onProgress={setLoadingProgress} />
    <section className="vehicle-heading"><p className="eyebrow">{definition.presentation.eyebrow}</p><h1>{definition.presentation.title}</h1>{definition.presentation.description && <p>{definition.presentation.description}</p>}</section>
    <aside className="configuration-controls" aria-label="Vehicle configuration">
      <h2>{definition.presentation.configurationLabel}</h2>
      <div className="bottom-config" role="group" aria-label="Add-ons">{definition.vehicle.addons.map(addon => <button key={addon.id} className={activeAddon === addon.id ? 'selected' : ''} aria-pressed={activeAddon === addon.id} onClick={() => setActiveAddon(current => current === addon.id ? null : addon.id)}>{addon.label}</button>)}</div>
    </aside>
    </div>
  </main>
}
