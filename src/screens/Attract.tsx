export function Attract({ onBegin }: { onBegin: () => void }) {
  return <main id="main-content" className="reference-attract" onClick={onBegin}>
    <img className="reference-logo" src="/assets/reference/leidos-logo-light.svg" alt="Leidos" />
    <button className="reference-begin" onClick={(event) => { event.stopPropagation(); onBegin() }}>Touch Screen to Begin</button>
  </main>
}
