import { createPortal } from 'react-dom'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

type Props = { enabled?: boolean; timeoutSeconds: number; warningSeconds: number; onReset: () => void; children: ReactNode }

export function InactivityGuard({ enabled = true, timeoutSeconds, warningSeconds, onReset, children }: Props) {
  const testOverride = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname) ? Number(new URLSearchParams(window.location.search).get('testTimeout')) : 0
  const effectiveTimeout = testOverride >= 2 ? testOverride : timeoutSeconds
  const effectiveWarning = testOverride >= 2 ? Math.min(3, testOverride - 1) : warningSeconds
  const [remaining, setRemaining] = useState<number | null>(null)
  const warningAt = useRef(0)
  const expiresAt = useRef(0)
  const warningShown = useRef(false)
  const resetTimer = useCallback(() => {
    const now = performance.now()
    warningAt.current = now + effectiveTimeout * 1000
    expiresAt.current = warningAt.current + effectiveWarning * 1000
    warningShown.current = false
    setRemaining(null)
  }, [effectiveTimeout, effectiveWarning])

  useEffect(() => {
    const resetFrame = requestAnimationFrame(resetTimer)
    if (!enabled) return () => cancelAnimationFrame(resetFrame)
    const activity = () => resetTimer()
    const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'nexus:activity'] as const
    events.forEach((name) => window.addEventListener(name, activity, { passive: true }))
    const timer = window.setInterval(() => {
      const now = performance.now()
      if (!warningShown.current && now >= warningAt.current) {
        warningShown.current = true
        expiresAt.current = now + effectiveWarning * 1000
        setRemaining(effectiveWarning)
      } else if (warningShown.current && now >= expiresAt.current) {
        resetTimer()
        onReset()
      } else if (warningShown.current) setRemaining(Math.ceil((expiresAt.current - now) / 1000))
    }, 250)
    return () => {
      cancelAnimationFrame(resetFrame)
      window.clearInterval(timer)
      events.forEach((name) => window.removeEventListener(name, activity))
    }
  }, [effectiveWarning, enabled, onReset, resetTimer])

  return <>
    {children}
    {enabled && remaining !== null && createPortal(<div className="timeout-scrim"><button className="timeout-warning" role="alertdialog" aria-label="Session timeout warning" onClick={resetTimer}>
      <strong>Are you still there?</strong><span className="timeout-count">:{String(remaining).padStart(2, '0')}</span><small>Tap to dismiss</small>
    </button></div>, document.fullscreenElement ?? document.body)}
  </>
}
