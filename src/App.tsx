import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { InactivityGuard } from './components/InactivityGuard'
import { ModuleBoundary } from './components/ModuleBoundary'
import { recordUsage } from './services/analytics'
import { getConfigState, getOperatorSettings, rollbackEventConfig, saveOperatorSettings, type ConfigState, type OperatorSettings } from './services/configStore'
import { Attract } from './screens/Attract'
import { Selector } from './screens/Selector'
import { LoadingScreen } from './components/LoadingScreen'

const Configurator = lazy(() => import('./screens/Configurator').then((module) => ({ default: module.Configurator })))
const Explorer = lazy(() => import('./screens/Explorer').then((module) => ({ default: module.Explorer })))

type Route = 'attract' | 'selector' | 'jltv' | 'explorer'

export default function App() {
  const [route, setRoute] = useState<Route>('attract')
  const [operatorOpen, setOperatorOpen] = useState(false)
  const [sessionEpoch, setSessionEpoch] = useState(0)
  const [settings, setSettings] = useState<OperatorSettings>({ inactivitySeconds: 60, qualityTier: 'standard', updateChecksEnabled: true, locallyDisabledModuleIds: [] })
  const [configState, setConfigState] = useState<ConfigState | null>(null)
  const operatorCloseRef = useRef<HTMLButtonElement>(null)
  const go = useCallback((next: Route) => {
    setRoute(next)
    recordUsage({ type: 'screen-enter', moduleId: next === 'jltv' ? 'jltv' : undefined, productId: next === 'explorer' ? 'jltv-demo' : undefined })
  }, [])
  const reset = useCallback(() => { setOperatorOpen(false); setSessionEpoch((value) => value + 1); go('attract') }, [go])

  useEffect(() => {
    Promise.all([getOperatorSettings(), getConfigState()]).then(([storedSettings, storedConfig]) => {
      setSettings(storedSettings)
      setConfigState(storedConfig)
    }).catch((error) => console.error('Local configuration recovery failed', error))
  }, [])

  const updateSettings = useCallback(async (next: OperatorSettings) => {
    setSettings(next)
    await saveOperatorSettings(next)
  }, [])

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOperatorOpen(false)
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'o') setOperatorOpen((value) => !value)
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [])

  useEffect(() => { if (operatorOpen) operatorCloseRef.current?.focus() }, [operatorOpen])

  return <InactivityGuard timeoutSeconds={60} warningSeconds={10} onReset={reset}>
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <div className={`shared-loop-media ${route === 'selector' ? 'is-hub' : ''} ${route !== 'attract' && route !== 'selector' ? 'is-hidden' : ''}`} aria-hidden="true"><video className="placeholder-video" src="/assets/nexus-placeholder-loop.mp4" autoPlay muted loop playsInline preload="auto" /></div>
    <div key={sessionEpoch} data-quality-tier={settings.qualityTier}>
      {route === 'attract' && <Attract onBegin={() => go('selector')} />}
      {route === 'selector' && <Selector onJLTV={() => go('jltv')} onExplorer={() => go('explorer')} onReset={reset} jltvDisabled={settings.locallyDisabledModuleIds.includes('jltv')} />}
      <Suspense fallback={<LoadingScreen />}>
        {route === 'jltv' && <ModuleBoundary onExit={() => go('selector')}><Configurator onExit={() => go('selector')} qualityTier={settings.qualityTier} /></ModuleBoundary>}
        {route === 'explorer' && <Explorer onExit={() => go('selector')} />}
      </Suspense>
    </div>
    <button className="operator-trigger" onClick={() => setOperatorOpen((value) => !value)} aria-label="Open operator controls">•••</button>
    {operatorOpen && <aside className="operator-panel" role="dialog" aria-modal="false" aria-labelledby="operator-title"><button ref={operatorCloseRef} className="close" onClick={() => setOperatorOpen(false)} aria-label="Close operator controls">×</button><p className="eyebrow">OPERATOR CONTROLS</p><h2 id="operator-title">Local event settings</h2>
      <label>Inactivity reset<select value="60" disabled><option value="60">1 minute + 10 second warning</option></select></label>
      <label>Visual quality<select value={settings.qualityTier} onChange={(event) => updateSettings({ ...settings, qualityTier: event.target.value as OperatorSettings['qualityTier'] })}><option value="standard">Standard</option><option value="high">High</option></select></label>
      <label className="operator-check"><input type="checkbox" checked={settings.updateChecksEnabled} onChange={(event) => updateSettings({ ...settings, updateChecksEnabled: event.target.checked })} /> Check for published updates when online</label>
      <label className="operator-check"><input type="checkbox" checked={settings.locallyDisabledModuleIds.includes('jltv')} onChange={(event) => updateSettings({ ...settings, locallyDisabledModuleIds: event.target.checked ? ['jltv'] : [] })} /> Disable JLTV module on this device</label>
      <div className="operator-config"><strong>Active configuration</strong><span>{configState?.active.config.version ?? 'Loading…'}</span><small>Previous: {configState?.previous?.config.version ?? 'none'} · verified local bundle</small></div>
      <button disabled={!configState?.previous} onClick={async () => setConfigState(await rollbackEventConfig())}>Roll back to previous</button><button onClick={reset}>Reset to attract</button><p>Shortcut: Ctrl + Shift + O</p><small>Preferences are local and persistent. This convenience menu is not a security boundary or a CMS.</small></aside>}
  </InactivityGuard>
}
