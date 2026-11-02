import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

type Props = { timeoutSeconds: number; warningSeconds: number; onReset: () => void; children: ReactNode }

export function InactivityGuard({ timeoutSeconds, warningSeconds, onReset, children }: Props) {
  const [remaining, setRemaining] = useState<number | null>(null)
  const deadline = useRef(0)
  const resetTimer = useCallback(() => {
    deadline.current = Date.now() + timeoutSeconds * 1000
    setRemaining(null)
  }, [timeoutSeconds])

  useEffect(() => {
    deadline.current = Date.now() + timeoutSeconds * 1000
    const activity = () => resetTimer()
    const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'nexus:activity'] as const
    events.forEach((name) => window.addEventListener(name, activity, { passive: true }))
    const timer = window.setInterval(() => {
      const seconds = Math.ceil((deadline.current - Date.now()) / 1000)
      if (seconds <= 0) {
        resetTimer()
        onReset()
      } else if (seconds <= warningSeconds) setRemaining(seconds)
    }, 250)
    return () => {
      window.clearInterval(timer)
      events.forEach((name) => window.removeEventListener(name, activity))
    }
  }, [onReset, resetTimer, timeoutSeconds, warningSeconds])

  return <>
    {children}
    {remaining !== null && <div className="timeout-warning" role="alertdialog" aria-label="Session timeout warning">
      <span className="timeout-count">{remaining}</span>
      <div><strong>Still exploring?</strong><p>This experience will reset for the next visitor.</p></div>
      <button onClick={resetTimer}>Continue session</button>
    </div>}
  </>
}
