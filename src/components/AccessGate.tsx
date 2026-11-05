import { type FormEvent, type ReactNode, useState } from 'react'

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
  }

  return <main className="access-gate" id="main-content">
    <section className="access-card" aria-labelledby="access-title">
      <img className="access-logo" src="/assets/reference/leidos-logo-light.svg" alt="Leidos" />
      <h1 id="access-title">NEXUS</h1>
      <form className="access-form" onSubmit={unlock} autoComplete="off" data-1p-ignore="true">
        <label className="visually-hidden" htmlFor="site-password">Password</label>
        <div className="access-field-row">
          <input
            id="site-password"
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              if (error) setError('')
            }}
            autoComplete="off"
            data-1p-ignore="true"
            placeholder="Password"
            aria-invalid={!!error}
            aria-describedby={error ? 'access-error' : undefined}
          />
          <button type="submit" aria-label="Enter site">Enter</button>
        </div>
        <p className="visually-hidden" id="access-error" role="alert" aria-live="polite">{error}</p>
      </form>
      <p className="access-note">Restricted Preview</p>
    </section>
  </main>
}

