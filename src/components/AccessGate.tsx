import { type FormEvent, type ReactNode, useRef, useState } from 'react'

const ACCESS_KEY = 'nexus:access-granted'
const ACCESS_PASSWORD = 'nexus'

function hasAccess() {
  try {
    return window.sessionStorage.getItem(ACCESS_KEY) === 'true'
  } catch {
    return false
  }
}

export function AccessGate({ children }: { children: ReactNode }) {
  const [granted, setGranted] = useState(hasAccess)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  if (granted) return children

  const unlock = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (password === ACCESS_PASSWORD) {
      try {
        window.sessionStorage.setItem(ACCESS_KEY, 'true')
      } catch {
        // The gate still works for this page load if storage is unavailable.
      }
      setGranted(true)
      return
    }

    setError('That password isn\'t correct. Try again.')
    setPassword('')
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  return <main className="access-gate" id="main-content">
    <div className="access-gate-grid" aria-hidden="true" />
    <div className="access-gate-glow" aria-hidden="true" />
    <section className="access-card" aria-labelledby="access-title">
      <div className="access-brand" aria-label="NEXUS">
        <span className="brand-mark">N</span>
        <span>NEXUS</span>
      </div>
      <p className="eyebrow">PRIVATE PREVIEW</p>
      <h1 id="access-title">Enter NEXUS</h1>
      <p className="access-intro">This working preview is intended for invited collaborators.</p>
      <form className="access-form" onSubmit={unlock}>
        <label htmlFor="site-password">Password</label>
        <div className="access-field-row">
          <input
            ref={inputRef}
            id="site-password"
            name="password"
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              if (error) setError('')
            }}
            autoComplete="current-password"
            autoFocus
            aria-invalid={!!error}
            aria-describedby={error ? 'access-error' : undefined}
          />
          <button type="submit" aria-label="Enter site">Enter <span aria-hidden="true">↗</span></button>
        </div>
        <p className="access-error" id="access-error" role="alert" aria-live="polite">{error}</p>
      </form>
      <p className="access-note">Restricted preview · NEXUS capability configurator</p>
    </section>
  </main>
}

