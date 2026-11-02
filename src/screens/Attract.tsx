export function Attract({ onBegin }: { onBegin: () => void }) {
  return <main id="main-content" className="attract" onClick={onBegin}>
    <div className="experience-backdrop" aria-hidden="true" />
    <div className="attract-scrim" aria-hidden="true" />
    <header className="attract-brand" aria-label="Nexus by Leidos">
      <span className="nexus-wordmark">NEXUS</span>
      <span className="leidos-wordmark"><i aria-hidden="true">◆</i> leidos</span>
    </header>
    <button className="begin-prompt" onClick={onBegin}>Touch screen to begin <span aria-hidden="true">↓</span></button>
    <div className="attract-controls" aria-label="Presentation media controls">
      <button type="button" disabled aria-label="Audio is unavailable in this static preview">⌁</button>
      <button type="button" disabled aria-label="Attract video is unavailable in this static preview">Ⅱ</button>
    </div>
    <span className="attract-note">APPROVED PLACEHOLDER MEDIA · FINAL ATTRACT VIDEO PENDING</span>
  </main>
}
