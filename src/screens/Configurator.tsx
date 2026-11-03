import { useEffect, useState } from 'react'
import { ModelStage } from '../components/ModelStage'
import { LoadingScreen } from '../components/LoadingScreen'
import { seedVehicle } from '../content/seed'
import { signalModule } from '../modules/lifecycle'

export function Configurator({ onExit, qualityTier = 'standard' }: { onExit: () => void; qualityTier?: 'standard' | 'high' }) {
  const [sceneReady, setSceneReady] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [activeAddon, setActiveAddon] = useState<number | null>(null)
  const [activeHotspot, setActiveHotspot] = useState<string | null>(null)
  useEffect(() => {
    return () => signalModule('module:exit', 'jltv')
  }, [])
  useEffect(() => { if (sceneReady) signalModule('module:ready', 'jltv') }, [sceneReady])
  return <main id="main-content" className="configurator" aria-busy={!sceneReady}>
    {!sceneReady && <LoadingScreen progress={loadingProgress} />}
    <div className={`experience-content ${sceneReady ? 'is-ready' : ''}`} data-ready={sceneReady} aria-hidden={!sceneReady} inert={!sceneReady}>
    <nav className="experience-navigation" aria-label="Experience navigation"><button className="experience-hub" onClick={onExit}>HUB <span aria-hidden="true">→</span></button></nav>
    <ModelStage vehicle={seedVehicle} addonVisible={activeAddon === 1} activeHotspot={activeHotspot} qualityTier={qualityTier} onHotspot={setActiveHotspot} onExit={onExit} onReadyChange={setSceneReady} onProgress={setLoadingProgress} />
    <section className="vehicle-heading"><p className="eyebrow">TACTICAL VEHICLE · INTERACTIVE MODEL</p><h1>JLTV</h1></section>
    <aside className="configuration-controls" aria-label="Vehicle configuration">
      <h2>Configuration</h2>
      <div className="bottom-config" role="group" aria-label="Add-ons">{[1, 2, 3].map(addon => <button key={addon} className={activeAddon === addon ? 'selected' : ''} aria-pressed={activeAddon === addon} onClick={() => setActiveAddon(current => current === addon ? null : addon)}>Add-on {addon}{addon > 1 && <small>Placeholder</small>}</button>)}</div>
      <p className="configuration-status" role="status">{activeAddon === null ? 'Bare vehicle' : activeAddon === 1 ? 'Add-on 1 attached' : `Add-on ${activeAddon} selected · preview coming soon`}</p>
    </aside>
    </div>
  </main>
}
