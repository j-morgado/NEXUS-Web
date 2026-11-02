import { useEffect, useState } from 'react'
import { ModelStage } from '../components/ModelStage'
import { seedVehicle } from '../content/seed'
import { signalModule } from '../modules/lifecycle'

export function Configurator({ onExit, qualityTier = 'standard' }: { onExit: () => void; qualityTier?: 'standard' | 'high' }) {
  const [activeAddon, setActiveAddon] = useState<number | null>(null)
  const [activeHotspot, setActiveHotspot] = useState<string | null>(null)
  useEffect(() => {
    signalModule('module:ready', 'jltv')
    return () => signalModule('module:exit', 'jltv')
  }, [])
  return <main id="main-content" className="configurator">
    <header className="experience-navigation"><button className="back-button" onClick={onExit}>← Return to hub</button></header>
    <ModelStage vehicle={seedVehicle} addonVisible={activeAddon === 1} activeHotspot={activeHotspot} qualityTier={qualityTier} onHotspot={setActiveHotspot} onExit={onExit} />
    <section className="vehicle-heading"><p className="eyebrow">TACTICAL VEHICLE · INTERACTIVE MODEL</p><h1>JLTV</h1><p>Drag to rotate · Pinch or scroll to zoom</p></section>
    <aside className="configuration-controls" aria-label="Vehicle configuration">
      <h2>Configuration</h2>
      <div className="bottom-config" role="group" aria-label="Add-ons">{[1, 2, 3].map(addon => <button key={addon} className={activeAddon === addon ? 'selected' : ''} aria-pressed={activeAddon === addon} onClick={() => setActiveAddon(current => current === addon ? null : addon)}>Add-on {addon}{addon > 1 && <small>Placeholder</small>}</button>)}</div>
      <p className="configuration-status" role="status">{activeAddon === null ? 'Bare vehicle' : activeAddon === 1 ? 'Add-on 1 attached' : `Add-on ${activeAddon} selected · preview coming soon`}</p>
    </aside>
  </main>
}
