export function Attract({ onBegin }: { onBegin: () => void }) {
  return <main id="main-content" className="attract" onClick={onBegin}>
    <div className="ambient-grid" />
    <div className="attract-orbit orbit-one" />
    <div className="attract-orbit orbit-two" />
    <header className="brand"><span className="brand-mark">L</span><span>LEIDOS</span><i /></header>
    <section className="attract-copy">
      <p className="eyebrow">MISSION SYSTEMS · INTERACTIVE</p>
      <h1>Capability,<br /><em>configured.</em></h1>
      <p className="dek">Explore integrated platforms and shape the mission-ready system around your needs.</p>
      <button className="primary-cta" onClick={onBegin}>Begin experience <span>→</span></button>
    </section>
    <aside className="attract-index"><span>01</span><div /><span>03</span></aside>
    <footer><span>TOUCH ANYWHERE TO BEGIN</span><span>NEXUS / 2026</span></footer>
  </main>
}
