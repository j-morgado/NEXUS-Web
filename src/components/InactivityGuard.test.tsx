import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { InactivityGuard } from './InactivityGuard'

describe('global inactivity guard', () => {
  afterEach(() => vi.useRealTimers())
  it('keeps the idle period and warning countdown separate (10 + 5, not 5 + 5 or 10 total)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-02T00:00:00Z'))
    const reset = vi.fn()
    render(<InactivityGuard timeoutSeconds={10} warningSeconds={5} onReset={reset}><div>Experience</div></InactivityGuard>)
    act(() => { vi.advanceTimersByTime(9_750) })
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(reset).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(500) })
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByText(':05')).toBeInTheDocument()
    expect(reset).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(5_000) })
    expect(reset).toHaveBeenCalledTimes(1)
  })

  it('a tap during the warning dismisses it and starts a fresh idle period', () => {
    vi.useFakeTimers()
    const reset = vi.fn()
    render(<InactivityGuard timeoutSeconds={10} warningSeconds={5} onReset={reset}><div>Experience</div></InactivityGuard>)
    act(() => { vi.advanceTimersByTime(10_250) })
    act(() => { screen.getByRole('alertdialog').click() })
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(10_250) })
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(reset).not.toHaveBeenCalled()
  })

  it('treats module and media bridge activity as global activity', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-02T00:00:00Z'))
    const reset = vi.fn()
    render(<InactivityGuard timeoutSeconds={10} warningSeconds={5} onReset={reset}><div>Experience</div></InactivityGuard>)
    act(() => { vi.advanceTimersByTime(7_000) })
    act(() => { window.dispatchEvent(new CustomEvent('nexus:activity', { detail: { type: 'activity', source: 'media' } })) })
    act(() => { vi.advanceTimersByTime(12_000) })
    expect(reset).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(3_100) })
    expect(reset).toHaveBeenCalledTimes(1)
  })
})
