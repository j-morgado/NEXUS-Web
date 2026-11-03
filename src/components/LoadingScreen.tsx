export function LoadingScreen({ progress, phase = 'loading' }: { progress?: number; phase?: 'covering' | 'loading' | 'revealing' }) {
  const value = progress === undefined || progress <= 0 ? undefined : Math.max(0, Math.min(100, progress))
  return <div className={`experience-loading ${phase === 'revealing' ? 'is-leaving' : ''}`} data-phase={phase} role="status" aria-live="polite">
    <div><p>Loading</p><div className={`experience-progress ${value === undefined ? 'is-indeterminate' : ''}`} role="progressbar" aria-label="Loading module" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}><span style={value === undefined ? undefined : { width: `${value}%` }} /></div></div>
  </div>
}
