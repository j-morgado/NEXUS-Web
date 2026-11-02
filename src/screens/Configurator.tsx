import { useEffect, useState } from 'react'
import { ModelStage } from '../components/ModelStage'
import { seedVehicle } from '../content/seed'
import { signalModule } from '../modules/lifecycle'

export function Configurator({ onExit, qualityTier = 'standard' }: { onExit: () => void; qualityTier?: 'standard' | 'high' }) {
  const [addonVisible, setAddonVisible] = useState(true)
  const [hotspotOpen, setHotspotOpen] = useState(false)
  useEffect(() => {
    signalModule('module:ready', 'jltv')
    return () => signalModule('module:exit', 'jltv')
  }, [])
  return <main id="main-content" className={`configurator ${hotspotOpen ? 'hotspot-active' : ''}`}>
    <header className="topbar over-model"><button className="wordmark" onClick={onExit}>NEXUS</button><p>JLTV CONFIGURATOR</p><button className="back-button" onClick={onExit}>← All platforms</button></header>
    <ModelStage vehicle={seedVehicle} addonVisible={addonVisible} hotspotOpen={hotspotOpen} qualityTier={qualityTier} onHotspot={() => setHotspotOpen(true)} onExit={onExit} />
    <section className="vehicle-heading"><p className="eyebrow">TACTICAL VEHICLE · INTERACTIVE MODEL</p><h1>JLTV</h1><p>Drag to rotate · Pinch or scroll to zoom</p></section>
    <aside className="config-panel">
      <p className="panel-kicker">MISSION CONFIGURATION</p>
      <h2>Roof system</h2>
      <button className={`option ${!addonVisible ? 'selected' : ''}`} onClick={() => setAddonVisible(false)}><i /><span><strong>Bare vehicle</strong><small>Base platform configuration</small></span></button>
      <button className={`option ${addonVisible ? 'selected' : ''}`} onClick={() => setAddonVisible(true)}><i /><span><strong>Addon 1</strong><small>Temporary demonstrator · not MXR</small></span></button>
      <div className="config-note"><span>i</span><p>Attachment geometry is supplied with the source model. Product designation and compatibility are pending.</p></div>
    </aside>
    <div className="hotspot-legend"><span className="pulse-dot" /> Select markers to inspect vehicle zones</div>
    {hotspotOpen && <aside className="hotspot-panel">
      <button className="close" onClick={() => setHotspotOpen(false)} aria-label="Close hotspot">×</button><p className="eyebrow">HOTSPOT 01</p><h2>{seedVehicle.hotspots[0].label}</h2><p>{seedVehicle.hotspots[0].description}</p><div className="filler-badge">DEMONSTRATION COPY</div>
    </aside>}
  </main>
}
