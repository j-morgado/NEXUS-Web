import type { Vehicle } from '../domain/schemas'

type Addon = Vehicle['addons'][number]

export function AddonInfoPanel({ addon, onClose }: { addon: Addon; onClose: () => void }) {
  return <aside className="addon-info-panel" aria-label={`${addon.label} details`}>
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

