import { useEffect, useRef, useState, type TransitionEvent } from 'react'
import type { Vehicle } from '../domain/schemas'

type Addon = Vehicle['addons'][number]
// Transition-end is the primary completion path. Keep the fallback comfortably
// beyond 720ms so a busy WebGL frame cannot remove the panel before motion starts.
const EXIT_FALLBACK_MS = 8000

export function AddonInfoPanel({ addon, open, onClose, onExited }: { addon: Addon; open: boolean; onClose: () => void; onExited: () => void }) {
  const [revealed, setRevealed] = useState(false)
  const onExitedRef = useRef(onExited)
  useEffect(() => { onExitedRef.current = onExited }, [onExited])
  useEffect(() => {
    if (open) {
      let revealFrame = 0
      const mountFrame = requestAnimationFrame(() => { revealFrame = requestAnimationFrame(() => setRevealed(true)) })
      return () => { cancelAnimationFrame(mountFrame); cancelAnimationFrame(revealFrame) }
    }

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const timer = window.setTimeout(() => onExitedRef.current(), reducedMotion ? 0 : EXIT_FALLBACK_MS)
    return () => window.clearTimeout(timer)
  }, [open])

  const visible = open && revealed

  const handleTransitionEnd = (event: TransitionEvent<HTMLElement>) => {
    if (!open && event.target === event.currentTarget && event.propertyName === 'transform') onExitedRef.current()
  }

  return <aside className={`addon-info-panel ${visible ? 'is-open' : ''}`} data-state={visible ? 'open' : open ? 'entering' : 'exiting'} data-addon-id={addon.id} aria-label={`${addon.label} details`} aria-hidden={!visible} inert={!visible} onTransitionEnd={handleTransitionEnd}>
    <button className="addon-panel-close" type="button" onClick={onClose} aria-label={`Close ${addon.label} details`}>×</button>
    <img className="addon-panel-image" src={addon.thumbnailUrl} alt={`${addon.label} shown on the JLTV demonstrator`} />
    <div className="addon-panel-content">
      <p className="addon-panel-kicker">Selected add-on</p>
      <h2>{addon.label}</h2>
      <p className="addon-panel-description">{addon.description}</p>
      <dl className="addon-specs">
        {addon.specs.map(spec => <div key={spec.label}><dt>{spec.label}</dt><dd>{spec.value}</dd></div>)}
      </dl>
      <small>Placeholder specifications · product approval required</small>
    </div>
  </aside>
}

