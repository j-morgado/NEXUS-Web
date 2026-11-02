import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

type Props = { timeoutSeconds: number; warningSeconds: number; onReset: () => void; children: ReactNode }

export function InactivityGuard({ timeoutSeconds, warningSeconds, onReset, children }: Props) {
  const testOverride = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname) ? Number(new URLSearchParams(window.location.search).get('testTimeout')) : 0
  const effectiveTimeout = testOverride >= 2 ? testOverride : timeoutSeconds
  const effectiveWarning = testOverride >= 2 ? Math.min(3, testOverride - 1) : warningSeconds
  const [remaining, setRemaining] = useState<number | null>(null)
  const warningAt = useRef(0)
  const expiresAt = useRef(0)
  const resetTimer = useCallback(() => {
    const now = performance.now()
    warningAt.current = now + effectiveTimeout * 1000
    expiresAt.current = warningAt.current + effectiveWarning * 1000
    setRemaining(null)
  }, [effectiveTimeout, effectiveWarning])

  useEffect(() => {
    const mountedAt = performance.now()
    warningAt.current = mountedAt + effectiveTimeout * 1000
    expiresAt.current = warningAt.current + effectiveWarning * 1000
    const activity = () => resetTimer()
    const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'nexus:activity'] as const
    events.forEach((name) => window.addEventListener(name, activity, { passive: true }))
    const timer = window.setInterval(() => {
      const now = performance.now()
      if (now >= expiresAt.current) {
        resetTimer()
        onReset()
      } else if (now >= warningAt.current) setRemaining(Math.ceil((expiresAt.current - now) / 1000))
    }, 250)
    return () => {
      window.clearInterval(timer)
      events.forEach((name) => window.removeEventListener(name, activity))
    }
  }, [effectiveTimeout, effectiveWarning, onReset, resetTimer])

  return <>
    {children}
    {remaining !== null && <div className="timeout-scrim"><button className="timeout-warning" role="alertdialog" aria-label="Session timeout warning" onClick={resetTimer}>
      <strong>Are you still there?</strong><span className="timeout-count">:{String(remaining).padStart(2, '0')}</span><small>Tap to dismiss</small>
    </button></div>}
  </>
}
