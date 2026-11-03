import type { HotspotMode } from '../domain/schemas'
import { useRef, useEffect, useState } from 'react'
import type { OperatorSettings } from '../services/configStore'
import { visualPresets, type VisualSettings, type QualityTier } from '../services/visualSettings'
import { activatePublishedUpdate, checkForPublishedUpdate } from '../services/serviceWorker'

type Props = { settings: OperatorSettings; onChange: (settings: OperatorSettings) => Promise<void>; onClose: () => void; updateAvailable: boolean }
export function DevOptions({ settings, onChange, onClose, updateAvailable }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { closeRef.current?.focus() }, [])
  const save = (next: OperatorSettings) => { void onChange(next).catch(() => setMessage('Unable to save settings on this device.')) }
  const visual = (patch: Partial<VisualSettings>) => save({ ...settings, qualityTier: 'custom', visual: { ...settings.visual, ...patch } })
  const effects = [
    { key: 'ssgi', label: 'SSGI', quality: 'ssgiSamples', unit: 'samples', min: 8, max: 32, step: 8 },
    { key: 'ssao', label: 'SSAO', quality: 'ssaoSamples', unit: 'samples', min: 8, max: 32, step: 8 },
    { key: 'ssr', label: 'SSR', quality: 'ssrSteps', unit: 'ray steps', min: 16, max: 64, step: 16 },
    { key: 'motionBlur', label: 'Motion Blur', quality: 'motionBlurSamples', unit: 'samples', min: 3, max: 15, step: 2 },
  ] as const
  const update = async (activate: boolean) => {
    setBusy(true); setMessage('Checking for updates…')
    try {
      const result = await checkForPublishedUpdate()
      if (result === 'unavailable') setMessage('Updates are unavailable in this browser or local preview.')
      else if (result === 'downloading') setMessage('An update is downloading. Select Update now when it is ready.')
      else if (activate && (result === 'available' || updateAvailable)) { setMessage('Installing update…'); await activatePublishedUpdate() }
      else setMessage(result === 'available' || updateAvailable ? 'An update is ready. Select Update now to install it.' : 'You’re up to date.')
    } catch { setMessage('Could not check for updates. Please try again.') }
    finally { setBusy(false) }
  }
  return <aside className="operator-panel dev-options" role="dialog" aria-modal="false" aria-labelledby="dev-options-title">
    <button ref={closeRef} className="close" onClick={onClose} aria-label="Close Dev Options">×</button>
    <h2 id="dev-options-title">Dev Options</h2>
    <label>Visual quality<select aria-label="Visual quality" value={settings.qualityTier} onChange={event => { const tier = event.target.value as QualityTier; save({ ...settings, qualityTier: tier, visual: tier === 'custom' ? settings.visual : { ...visualPresets[tier] } }) }}>{(['standard', 'low', 'high', 'custom'] as const).map(tier => <option key={tier} value={tier}>{tier[0].toUpperCase() + tier.slice(1)}</option>)}</select></label>
    <fieldset><legend>Screen effects</legend>{effects.map(effect => <div className="dev-effect" key={effect.key}>
      <label className="operator-check"><input type="checkbox" checked={settings.visual[effect.key]} onChange={event => visual({ [effect.key]: event.target.checked })} />{effect.label}</label>
      <label htmlFor={`dev-${effect.quality}`}>{effect.label} quality <output>{settings.visual[effect.quality]} {effect.unit}</output><input id={`dev-${effect.quality}`} type="range" min={effect.min} max={effect.max} step={effect.step} disabled={!settings.visual[effect.key]} value={settings.visual[effect.quality]} onChange={event => visual({ [effect.quality]: Number(event.target.value) })} /></label>
    </div>)}</fieldset>
    <fieldset><legend>Rendering</legend>
      <label htmlFor="dev-render-resolution">Render resolution <output>{Math.round(settings.visual.resolutionScale * 100)}%</output><input id="dev-render-resolution" type="range" min={.5} max={1} step={.05} value={settings.visual.resolutionScale} onChange={event => visual({ resolutionScale: Number(event.target.value) })} /></label>
      <label htmlFor="dev-max-dpr">Maximum pixel ratio <output>{settings.visual.maxDpr.toFixed(2)}</output><input id="dev-max-dpr" type="range" min={1} max={2} step={.25} value={settings.visual.maxDpr} onChange={event => visual({ maxDpr: Number(event.target.value) })} /></label>
      <label className="operator-check"><input type="checkbox" checked={settings.visual.planarReflections} onChange={event => visual({ planarReflections: event.target.checked })} />Planar ground reflections</label>
      <label>Planar reflection resolution<select aria-label="Planar reflection resolution" disabled={!settings.visual.planarReflections} value={settings.visual.reflectionResolution} onChange={event => visual({ reflectionResolution: Number(event.target.value) as VisualSettings['reflectionResolution'] })}>{[256, 512, 1024].map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Shadow resolution<select aria-label="Shadow resolution" value={settings.visual.shadowResolution} onChange={event => visual({ shadowResolution: Number(event.target.value) as VisualSettings['shadowResolution'] })}>{[512, 1024, 2048].map(value => <option key={value}>{value}</option>)}</select></label>
    </fieldset>
    <fieldset><legend>Hotspots</legend><label>Preview mode<select aria-label="Hotspot preview mode" value={settings.hotspotMode} onChange={event => save({ ...settings, hotspotMode: event.target.value as HotspotMode })}><option value="in-place">In place</option><option value="zoom-in-place">Zoom in place</option><option value="zoom-sidebar">Zoom side bar</option></select></label></fieldset>
    <fieldset><legend>Updates</legend><label className="operator-check"><input type="checkbox" checked={settings.updateChecksEnabled} onChange={event => save({ ...settings, updateChecksEnabled: event.target.checked })} />Check for updates at startup</label>
      <div className="dev-update-actions"><button disabled={busy} onClick={() => void update(false)}>Check for updates</button><button disabled={busy} onClick={() => void update(true)}>Update now</button></div>
      {(message || updateAvailable) && <p role="status">{message || 'An update is ready to install.'}</p>}
    </fieldset>
    <label className="operator-check"><input type="checkbox" checked={settings.showPerformanceStats} onChange={event => save({ ...settings, showPerformanceStats: event.target.checked })} />Display performance stats</label>
  </aside>
}
