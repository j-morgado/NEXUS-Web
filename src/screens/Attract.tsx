export function Attract({ onBegin, paused, muted, onTogglePlayback, onToggleMuted }: { onBegin: () => void; paused: boolean; muted: boolean; onTogglePlayback: () => void; onToggleMuted: () => void }) {
  return <main id="main-content" className="reference-attract" onClick={onBegin}>
    <img className="reference-logo" src="/assets/reference/leidos-logo-light.svg" alt="Leidos" />
    <button className="reference-begin" onClick={onBegin}>Touch Screen to Begin</button>
    <div className="attract-media-controls" aria-label="Background video controls">
      <button aria-pressed={muted} aria-label={muted ? 'Muted — unmute background video' : 'Sound — mute background video'} onClick={(event) => { event.stopPropagation(); onToggleMuted() }}>{muted ? 'Muted' : 'Sound'}</button>
      <button aria-pressed={paused} aria-label={paused ? 'Play background video' : 'Pause background video'} onClick={(event) => { event.stopPropagation(); onTogglePlayback() }}>{paused ? 'Play' : 'Pause'}</button>
    </div>
  </main>
}
