export function Selector({ onJLTV, onExplorer, onReset, jltvDisabled = false }: { onJLTV: () => void; onExplorer: () => void; onReset: () => void; jltvDisabled?: boolean }) {
  return <main id="main-content" className="reference-hub">
    <button className="hub-home" onClick={onReset} aria-label="NEXUS return to attract">NEXUS</button>
    <img className="reference-logo" src="/assets/reference/leidos-logo-light.svg" alt="Leidos" />
    <h1>Choose an Experience</h1>
    <section className="hub-carousel">
      <button className={`hub-card hub-card-primary ${jltvDisabled ? 'disabled' : ''}`} onClick={onJLTV} disabled={jltvDisabled}><img src="/assets/jltv-card.webp" alt="JLTV platform" /><span className="hub-gradient" /><div><h2>JLTV</h2><p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer consequat viverra efficitur.</p><b className="outline-pill">{jltvDisabled ? 'Disabled' : 'Explore'} <i>→</i></b></div></button>
      <article className="hub-card"><span className="pending-card-art" /><span className="hub-gradient" /><div><h2>Platform 02</h2><p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vehicle selection pending.</p><b className="outline-pill">Coming soon</b></div></article>
      <article className="hub-card"><span className="pending-card-art alternate" /><span className="hub-gradient" /><div><h2>Platform 03</h2><p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vehicle selection pending.</p><b className="outline-pill">Coming soon</b></div></article>
    </section>
    <div className="hub-arrows" aria-label="Experience 1 of 3"><button disabled>←</button><button disabled>→</button></div>
    <button className="hub-explorer" onClick={onExplorer}>Explorer <span>→</span></button>
  </main>
}
