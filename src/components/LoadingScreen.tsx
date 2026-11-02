export function LoadingScreen({ progress }: { progress?: number }) {
  const value = progress === undefined || progress <= 0 ? undefined : Math.max(0, Math.min(100, progress))
  return <div className="experience-loading" role="status" aria-live="polite">
    <div><p>Loading</p><div className={`experience-progress ${value === undefined ? 'is-indeterminate' : ''}`} role="progressbar" aria-label="Loading experience" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}><span style={value === undefined ? undefined : { width: `${value}%` }} /></div></div>
  </div>
}
