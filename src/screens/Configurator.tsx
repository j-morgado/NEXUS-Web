import { useEffect, useState } from 'react'
import { ModelStage } from '../components/ModelStage'
import { seedVehicle } from '../content/seed'
import { signalModule } from '../modules/lifecycle'

export function Configurator({ onExit, qualityTier = 'standard' }: { onExit: () => void; qualityTier?: 'standard' | 'high' }) {
  const [addonVisible, setAddonVisible] = useState(false)
  const [hotspotOpen, setHotspotOpen] = useState(false)
  useEffect(() => {
    signalModule('module:ready', 'jltv')
    return () => signalModule('module:exit', 'jltv')
  }, [])
  return <main id="main-content" className={`configurator ${hotspotOpen ? 'hotspot-active' : ''}`}>
    <header className="topbar over-model"><button className="wordmark" onClick={onExit}>NEXUS</button><p>JLTV CONFIGURATOR</p><button className="back-button" onClick={onExit}>← All platforms</button></header>
    <ModelStage vehicle={seedVehicle} addonVisible={addonVisible} hotspotOpen={hotspotOpen} qualityTier={qualityTier} onHotspot={() => setHotspotOpen((value) => !value)} onExit={onExit} />
    <section className="vehicle-heading"><p className="eyebrow">TACTICAL VEHICLE · INTERACTIVE MODEL</p><h1>JLTV</h1><p>Drag to rotate · Pinch or scroll to zoom</p></section>
    <aside className="bottom-config"><span>Configuration</span><button className={!addonVisible ? 'selected' : ''} onClick={() => setAddonVisible(false)}>Bare vehicle</button><button className={addonVisible ? 'selected' : ''} onClick={() => setAddonVisible(true)}>Addon 1 <small>temporary · not MXR</small></button></aside>
    <div className="hotspot-legend"><span className="pulse-dot" /> Select markers to inspect vehicle zones</div>
  </main>
}
