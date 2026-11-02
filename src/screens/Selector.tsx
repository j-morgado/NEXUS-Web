export function Selector({ onJLTV, onExplorer, onReset, jltvDisabled = false }: { onJLTV: () => void; onExplorer: () => void; onReset: () => void; jltvDisabled?: boolean }) {
  return <main id="main-content" className="selector">
    <div className="experience-backdrop selector-media" aria-hidden="true" />
    <div className="selector-scrim" aria-hidden="true" />
    <header className="selector-brand"><button className="nexus-wordmark" onClick={onReset}>NEXUS</button><span className="leidos-wordmark"><i aria-hidden="true">◆</i> leidos</span></header>
    <section className="selector-content">
      <div className="selector-heading"><p className="eyebrow">CONFIGURE THE MISSION</p><h1>Where we<br />deliver.</h1></div>
      <button className={`platform-card ${jltvDisabled ? 'unavailable locally-disabled' : 'active'}`} onClick={onJLTV} disabled={jltvDisabled}>
        <span className="card-number">01 / 03</span>
        <img className="vehicle-card-image" src="/assets/jltv-card.webp" alt="JLTV demonstrator platform" />
        <div className="platform-copy"><p>TACTICAL VEHICLE · WORKING DEMONSTRATOR</p><h2>JLTV</h2><span>Explore the configurable vehicle and temporary included add-on.</span><b>{jltvDisabled ? 'Disabled on this device' : 'Configure platform →'}</b></div>
      </button>
      <article className="platform-card unavailable"><span className="card-number">02 / 03</span><div className="platform-copy"><p>FIRST RELEASE</p><h2>Platform 02</h2><span>Vehicle selection pending</span></div></article>
      <article className="platform-card unavailable"><span className="card-number">03 / 03</span><div className="platform-copy"><p>FIRST RELEASE</p><h2>Platform 03</h2><span>Vehicle selection pending</span></div></article>
    </section>
    <button className="explorer-entry" onClick={onExplorer}>Explore products <span aria-hidden="true">→</span></button>
    <div className="selector-progress" aria-label="Platform 1 of 3"><button disabled aria-label="Previous platform">←</button><span><b>01</b> / 03</span><button disabled aria-label="Next platform">→</button></div>
  </main>
}
