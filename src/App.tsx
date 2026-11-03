import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { InactivityGuard } from './components/InactivityGuard'
import { ModuleBoundary } from './components/ModuleBoundary'
import { recordUsage } from './services/analytics'
import { getConfigState, getOperatorSettings, rollbackEventConfig, saveOperatorSettings, type ConfigState, type OperatorSettings } from './services/configStore'
import { activatePublishedUpdate, checkForPublishedUpdate, registerOfflineWorker } from './services/serviceWorker'
import { Attract } from './screens/Attract'
import { Selector } from './screens/Selector'
import { LoadingScreen } from './components/LoadingScreen'

const Configurator = lazy(() => import('./screens/Configurator').then((module) => ({ default: module.Configurator })))
const Explorer = lazy(() => import('./screens/Explorer').then((module) => ({ default: module.Explorer })))

function DestinationReady({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    let cancelled = false
    let frame = 0
    void Promise.all([document.fonts.ready, ...Array.from(document.querySelectorAll<HTMLImageElement>('.catalog-explorer img, .selector img')).map(image => image.decode().catch(() => undefined))]).then(() => {
      frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => { if (!cancelled) onReady() }) })
    })
    return () => { cancelled = true; cancelAnimationFrame(frame) }
  }, [onReady])
  return null
}

type Route = 'attract' | 'selector' | 'jltv' | 'explorer'

export default function App() {
  const [route, setRoute] = useState<Route>('attract')
  const [hubEntrance, setHubEntrance] = useState(false)
  const [transition, setTransition] = useState<{ next: Route; phase: 'covering' | 'loading' | 'revealing' } | null>(null)
  const [destinationReady, setDestinationReady] = useState(false)
  const [progress, setProgress] = useState(0)
  const markReady = useCallback(() => setDestinationReady(true), [])
  const sceneReady = useCallback((ready: boolean) => setDestinationReady(ready), [])
  const [operatorOpen, setOperatorOpen] = useState(false)
  const [sessionEpoch, setSessionEpoch] = useState(0)
  const [settings, setSettings] = useState<OperatorSettings>({ inactivitySeconds: 60, qualityTier: 'standard', updateChecksEnabled: true, locallyDisabledModuleIds: [] })
  const [configState, setConfigState] = useState<ConfigState | null>(null)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const operatorCloseRef = useRef<HTMLButtonElement>(null)
  const go = useCallback((next: Route) => {
    setHubEntrance(false)
    setDestinationReady(false)
    setProgress(0)
    setTransition({ next, phase: 'covering' })
    recordUsage({ type: 'screen-enter', moduleId: next === 'jltv' ? 'jltv' : undefined, productId: next === 'explorer' ? 'jltv-demo' : undefined })
  }, [])
  const begin = useCallback(() => {
    setHubEntrance(true)
    setRoute('selector')
    recordUsage({ type: 'screen-enter' })
  }, [])
  const reset = useCallback(() => { setOperatorOpen(false); setSessionEpoch((value) => value + 1); setTransition(null); setRoute('attract') }, [])

  useEffect(() => {
    if (!transition) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (transition.phase === 'covering') {
      const timer = window.setTimeout(() => { setRoute(transition.next); setTransition({ ...transition, phase: 'loading' }) }, reduced ? 0 : 150)
      return () => clearTimeout(timer)
    }
    if (transition.phase === 'loading' && destinationReady) {
      const timer = window.setTimeout(() => setTransition({ ...transition, phase: 'revealing' }), reduced ? 0 : 125)
      return () => clearTimeout(timer)
    }
    if (transition.phase === 'revealing') {
      const timer = window.setTimeout(() => setTransition(null), reduced ? 0 : 200)
      return () => clearTimeout(timer)
    }
  }, [transition, destinationReady])

  useEffect(() => {
    Promise.all([getOperatorSettings(), getConfigState()]).then(([storedSettings, storedConfig]) => {
      setSettings(storedSettings)
      setConfigState(storedConfig)
      setSettingsLoaded(true)
    }).catch((error) => { setSettingsLoaded(true); console.error('Local configuration recovery failed', error) })
  }, [])

  useEffect(() => { registerOfflineWorker(() => setUpdateAvailable(true)) }, [])

  useEffect(() => {
    if (settingsLoaded && settings.updateChecksEnabled) void checkForPublishedUpdate().catch((error) => console.error('Published update check failed', error))
  }, [settingsLoaded, settings.updateChecksEnabled])

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



  return <InactivityGuard enabled={route !== 'attract'} timeoutSeconds={60} warningSeconds={10} onReset={reset}>
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <div className={`shared-loop-media ${route === 'selector' ? 'is-hub' : ''} ${route !== 'attract' && route !== 'selector' ? 'is-hidden' : ''}`} aria-hidden="true"><video className="placeholder-video" src="/assets/attract-loop.mp4" autoPlay muted loop playsInline preload="auto" /></div>
    <div key={sessionEpoch} inert={!!transition} aria-busy={!!transition} data-quality-tier={settings.qualityTier}>
      {route === 'attract' && <Attract onBegin={begin} />}
      {route === 'selector' && <Selector animateEntrance={hubEntrance} onJLTV={() => go('jltv')} onExplorer={() => go('explorer')} onReset={reset} jltvDisabled={settings.locallyDisabledModuleIds.includes('jltv')} />}
      <Suspense fallback={null}>
        {route === 'jltv' && <ModuleBoundary onExit={() => go('selector')} onFailure={markReady}><Configurator onExit={() => go('selector')} qualityTier={settings.qualityTier} managedLoading={!!transition} onReadyChange={sceneReady} onProgress={setProgress} /></ModuleBoundary>}
        {route === 'explorer' && <><Explorer active={!transition} onExit={() => go('selector')} /><DestinationReady onReady={markReady} /></>}
        {route === 'selector' && <DestinationReady onReady={markReady} />}
      </Suspense>
    </div>
    {transition && <LoadingScreen phase={transition.phase} progress={destinationReady ? 100 : progress} />}
    <button className="operator-trigger" onClick={() => setOperatorOpen((value) => !value)} aria-label="Open operator controls">•••</button>
    {operatorOpen && <aside className="operator-panel" role="dialog" aria-modal="false" aria-labelledby="operator-title"><button ref={operatorCloseRef} className="close" onClick={() => setOperatorOpen(false)} aria-label="Close operator controls">×</button><p className="eyebrow">OPERATOR CONTROLS</p><h2 id="operator-title">Local event settings</h2>
      <label>Inactivity reset<select value="60" disabled><option value="60">1 minute + 10 second warning</option></select></label>
      <label>Visual quality<select value={settings.qualityTier} onChange={(event) => updateSettings({ ...settings, qualityTier: event.target.value as OperatorSettings['qualityTier'] })}><option value="standard">Standard</option><option value="high">High</option></select></label>
      <label className="operator-check"><input type="checkbox" checked={settings.updateChecksEnabled} onChange={(event) => updateSettings({ ...settings, updateChecksEnabled: event.target.checked })} /> Run an explicit update check at startup</label>
      <button disabled={!settings.updateChecksEnabled} onClick={() => void checkForPublishedUpdate()}>Check now</button>
      {updateAvailable && <button onClick={async () => { reset(); await activatePublishedUpdate() }}>Activate downloaded update</button>}
      <label className="operator-check"><input type="checkbox" checked={settings.locallyDisabledModuleIds.includes('jltv')} onChange={(event) => updateSettings({ ...settings, locallyDisabledModuleIds: event.target.checked ? ['jltv'] : [] })} /> Disable JLTV module on this device</label>
      <div className="operator-config"><strong>Active configuration</strong><span>{configState?.active.config.version ?? 'Loading…'}</span><small>Previous: {configState?.previous?.config.version ?? 'none'} · verified local bundle</small></div>
      <button disabled={!configState?.previous} onClick={async () => setConfigState(await rollbackEventConfig())}>Roll back to previous</button><button onClick={reset}>Reset to attract</button><p>Shortcut: Ctrl + Shift + O</p><small>Preferences are local and persistent. Update checking is explicit; a downloaded update activates only from this panel. This convenience menu is not a security boundary or a CMS.</small></aside>}
  </InactivityGuard>
}
