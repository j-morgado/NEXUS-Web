export function Selector({ onJLTV, onExplorer, onReset, jltvDisabled = false }: { onJLTV: () => void; onExplorer: () => void; onReset: () => void; jltvDisabled?: boolean }) {
  return <main id="main-content" className="selector">
    <div className="selector-backdrop" />
    <header className="topbar"><button className="wordmark" onClick={onReset}>NEXUS</button><p>SELECT A PLATFORM</p><button className="text-button" onClick={onExplorer}>Explore products <span>↗</span></button></header>
    <section className="selector-content">
      <div><p className="eyebrow">CONFIGURE THE MISSION</p><h1>Choose your<br />platform.</h1></div>
      <button className={`platform-card ${jltvDisabled ? 'unavailable locally-disabled' : 'active'}`} onClick={onJLTV} disabled={jltvDisabled}>
        <span className="card-number">01 / 03</span>
        <img className="vehicle-card-image" src="/assets/jltv-card.webp" alt="JLTV demonstrator platform" />
        <div><p>TACTICAL VEHICLE</p><h2>JLTV</h2><span>{jltvDisabled ? 'Disabled on this device' : 'Configure platform →'}</span></div>
      </button>
      <article className="platform-card unavailable"><span className="card-number">02 / 03</span><div><p>COMING NEXT</p><h2>Platform 02</h2><span>Vehicle selection pending</span></div></article>
      <article className="platform-card unavailable"><span className="card-number">03 / 03</span><div><p>COMING NEXT</p><h2>Platform 03</h2><span>Vehicle selection pending</span></div></article>
    </section>
    <footer><span>ONE WORKING CONFIGURATOR · TWO RELEASE VEHICLES PENDING</span><span>DEMONSTRATION BUILD 0.1</span></footer>
  </main>
}
