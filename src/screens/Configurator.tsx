import type { HotspotMode } from '../domain/schemas'
import { visualPresets, type VisualSettings } from '../services/visualSettings'
import { useEffect, useState } from 'react'
import { ModelStage } from '../components/ModelStage'
import { LoadingScreen } from '../components/LoadingScreen'
import { seedVehicle } from '../content/seed'
import { signalModule } from '../modules/lifecycle'

export function Configurator({ onExit, qualityTier = 'standard', visual = visualPresets[qualityTier], hotspotMode = 'in-place', showPerformanceStats = false, managedLoading = false, onReadyChange, onProgress }: { onExit: () => void; qualityTier?: 'standard' | 'high'; visual?: VisualSettings; hotspotMode?: HotspotMode; showPerformanceStats?: boolean; managedLoading?: boolean; onReadyChange?: (ready: boolean) => void; onProgress?: (progress: number) => void }) {
  const [sceneReady, setSceneReady] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [activeAddon, setActiveAddon] = useState<number | null>(null)
  const [activeHotspot, setActiveHotspot] = useState<string | null>(null)
  useEffect(() => { setActiveHotspot(null) }, [hotspotMode])
  useEffect(() => {
    return () => signalModule('module:exit', 'jltv')
  }, [])
  useEffect(() => { if (sceneReady) signalModule('module:ready', 'jltv') }, [sceneReady])
  useEffect(() => { onReadyChange?.(sceneReady) }, [sceneReady, onReadyChange])
  useEffect(() => { onProgress?.(loadingProgress) }, [loadingProgress, onProgress])
  return <main id="main-content" className="configurator" aria-busy={!sceneReady}>
    {!managedLoading && !sceneReady && <LoadingScreen progress={loadingProgress} />}
    <div className={`experience-content ${sceneReady ? 'is-ready' : ''}`} data-ready={sceneReady} aria-hidden={!sceneReady} inert={!sceneReady}>
    <nav className="experience-navigation" aria-label="Experience navigation"><button className="experience-hub" onClick={onExit}><span aria-hidden="true">←</span> Return to Hub</button></nav>
    <ModelStage vehicle={seedVehicle} addonVisible={activeAddon === 1} activeHotspot={activeHotspot} hotspotMode={hotspotMode} visual={visual} showPerformanceStats={showPerformanceStats} onHotspot={setActiveHotspot} onExit={onExit} onReadyChange={setSceneReady} onProgress={setLoadingProgress} />
    <section className="vehicle-heading"><p className="eyebrow">TACTICAL VEHICLE · INTERACTIVE MODEL</p><h1>JLTV</h1></section>
    <aside className="configuration-controls" aria-label="Vehicle configuration">
      <h2>Configuration</h2>
      <div className="bottom-config" role="group" aria-label="Add-ons">{[1, 2, 3].map(addon => <button key={addon} className={activeAddon === addon ? 'selected' : ''} aria-pressed={activeAddon === addon} onClick={() => setActiveAddon(current => current === addon ? null : addon)}>Add-on {addon}{addon > 1 && <small>Placeholder</small>}</button>)}</div>
    </aside>
    </div>
  </main>
}
