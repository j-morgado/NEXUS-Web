import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { InactivityGuard } from './InactivityGuard'

describe('global inactivity guard', () => {
  afterEach(() => vi.useRealTimers())
  it('shows the five-second warning and resets at the shortened timeout', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-02T00:00:00Z'))
    const reset = vi.fn()
    render(<InactivityGuard timeoutSeconds={10} warningSeconds={5} onReset={reset}><div>Experience</div></InactivityGuard>)
    act(() => { vi.advanceTimersByTime(5_250) })
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(5_000) })
    expect(reset).toHaveBeenCalledTimes(1)
  })

  it('treats module and media bridge activity as global activity', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-02T00:00:00Z'))
    const reset = vi.fn()
    render(<InactivityGuard timeoutSeconds={10} warningSeconds={5} onReset={reset}><div>Experience</div></InactivityGuard>)
    act(() => { vi.advanceTimersByTime(7_000) })
    act(() => { window.dispatchEvent(new CustomEvent('nexus:activity', { detail: { type: 'activity', source: 'media' } })) })
    act(() => { vi.advanceTimersByTime(7_000) })
    expect(reset).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(3_100) })
    expect(reset).toHaveBeenCalledTimes(1)
  })
})
