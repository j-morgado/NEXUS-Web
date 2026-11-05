import { useEffect, useRef, useState } from 'react'
import type { Vehicle } from '../domain/schemas'

type Addon = Vehicle['addons'][number]
// Keep the inert panel mounted briefly after the 360ms transition so the final
// fully-offscreen frame paints before React removes it.
const EXIT_FALLBACK_MS = 560

export function AddonInfoPanel({ addon, open, onClose, onExited }: { addon: Addon; open: boolean; onClose: () => void; onExited: () => void }) {
  const [visible, setVisible] = useState(false)
  const onExitedRef = useRef(onExited)
  useEffect(() => { onExitedRef.current = onExited }, [onExited])
  useEffect(() => {
    if (open) {
      const frame = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(frame)
    }

    setVisible(false)
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const timer = window.setTimeout(() => onExitedRef.current(), reducedMotion ? 0 : EXIT_FALLBACK_MS)
    return () => window.clearTimeout(timer)
  }, [open])

  return <aside className={`addon-info-panel ${visible ? 'is-open' : ''}`} data-state={visible ? 'open' : open ? 'entering' : 'exiting'} data-addon-id={addon.id} aria-label={`${addon.label} details`} aria-hidden={!visible} inert={!visible}>
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

