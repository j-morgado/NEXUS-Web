import type { HotspotMode } from '../domain/schemas'
import { visualPresets, type VisualSettings } from '../services/visualSettings'
import { useEffect, useState } from 'react'
import { ModelStage } from '../components/ModelStage'
import { AddonInfoPanel } from '../components/AddonInfoPanel'
import { LoadingScreen } from '../components/LoadingScreen'
import { seedVehicle } from '../content/seed'
import { signalModule } from '../modules/lifecycle'

export function Configurator({ onExit, qualityTier = 'standard', visual = visualPresets[qualityTier], hotspotMode = 'in-place', showPerformanceStats = false, managedLoading = false, onReadyChange, onProgress }: { onExit: () => void; qualityTier?: 'standard' | 'high'; visual?: VisualSettings; hotspotMode?: HotspotMode; showPerformanceStats?: boolean; managedLoading?: boolean; onReadyChange?: (ready: boolean) => void; onProgress?: (progress: number) => void }) {
  const [sceneReady, setSceneReady] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [activeAddon, setActiveAddon] = useState<string | null>(null)
  const [panelAddon, setPanelAddon] = useState<string | null>(null)
  const [hotspotSelection, setHotspotSelection] = useState<{ id: string | null; mode: HotspotMode }>({ id: null, mode: hotspotMode })
  const activeHotspot = hotspotSelection.mode === hotspotMode ? hotspotSelection.id : null
  const setActiveHotspot = (id: string | null) => setHotspotSelection({ id, mode: hotspotMode })
  useEffect(() => {
    return () => signalModule('module:exit', 'jltv')
  }, [])
  useEffect(() => { if (sceneReady) signalModule('module:ready', 'jltv') }, [sceneReady])
  useEffect(() => { onReadyChange?.(sceneReady) }, [sceneReady, onReadyChange])
  useEffect(() => { onProgress?.(loadingProgress) }, [loadingProgress, onProgress])
  const toggleAddon = (addonId: string) => {
    const next = activeAddon === addonId ? null : addonId
    if (next) setPanelAddon(next)
    setActiveAddon(next)
  }
  const panelDetails = seedVehicle.addons.find(addon => addon.id === panelAddon)
  return <main id="main-content" className="configurator" aria-busy={!sceneReady}>
    {!managedLoading && !sceneReady && <LoadingScreen progress={loadingProgress} />}
    <div className={`experience-content ${sceneReady ? 'is-ready' : ''}`} data-ready={sceneReady} aria-hidden={!sceneReady} inert={!sceneReady}>
    <nav className="experience-navigation" aria-label="Experience navigation"><button className="experience-hub" onClick={onExit}><span aria-hidden="true">←</span> Return to Hub</button></nav>
    <ModelStage vehicle={seedVehicle} addonVisible={activeAddon === seedVehicle.addons[0]?.id} activeHotspot={activeHotspot} hotspotMode={hotspotMode} visual={visual} showPerformanceStats={showPerformanceStats} onHotspot={setActiveHotspot} onExit={onExit} onReadyChange={setSceneReady} onProgress={setLoadingProgress} />
    <section className="vehicle-heading"><p className="eyebrow">TACTICAL VEHICLE · INTERACTIVE MODEL</p><h1>JLTV</h1></section>
    <aside className="configuration-controls" aria-label="Vehicle configuration">
      <h2>Configuration</h2>
      <div className="bottom-config" role="group" aria-label="Add-ons">{seedVehicle.addons.map(addon => <button key={addon.id} className={`addon-menu-item ${activeAddon === addon.id ? 'selected' : ''}`} aria-pressed={activeAddon === addon.id} onClick={() => toggleAddon(addon.id)}><span className="addon-menu-thumb" aria-hidden="true"><img src={addon.thumbnailUrl} alt="" /></span><span>{addon.label}</span></button>)}</div>
    </aside>
    {panelDetails && <AddonInfoPanel addon={panelDetails} open={activeAddon === panelDetails.id} onClose={() => setActiveAddon(null)} onExited={() => setPanelAddon(current => activeAddon === null && current === panelDetails.id ? null : current)} />}
    </div>
  </main>
}
