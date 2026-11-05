import { useEffect } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Configurator } from './Configurator'

const readiness = vi.hoisted(() => ({ defer: false, complete: null as null | ((ready: boolean) => void) }))
vi.mock('../components/ModelStage', () => ({ ModelStage: ({ addonVisible, onReadyChange }: { addonVisible: boolean; onReadyChange: (ready: boolean) => void }) => {
  useEffect(() => { readiness.complete = onReadyChange; if (!readiness.defer) onReadyChange(true) }, [onReadyChange])
  return <div data-testid="attachment" data-visible={String(addonVisible)} />
} }))

describe('experience configuration', () => {
  afterEach(() => { cleanup(); readiness.defer = false; readiness.complete = null })
  it('keeps the panel mounted through exit and cancels stale removal on rapid reopen', async () => {
    render(<Configurator onExit={vi.fn()} />)
    const button = screen.getByRole('button', { name: 'Add-on 1' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(button.querySelector('img')).toHaveAttribute('src', '/assets/addons/addon-1.webp')
    expect(screen.getByTestId('attachment')).toHaveAttribute('data-visible', 'false')
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('attachment')).toHaveAttribute('data-visible', 'true')
    const panel = await screen.findByRole('complementary', { name: 'Add-on 1 details' })
    expect(panel).toHaveAttribute('data-state', 'open')
    expect(screen.getAllByText('Placeholder — pending approved data')).toHaveLength(3)
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(panel).toHaveAttribute('data-state', 'exiting')
    expect(panel).toHaveAttribute('aria-hidden', 'true')
    expect(panel).toHaveAttribute('inert')
    fireEvent.click(button)
    await waitFor(() => expect(panel).toHaveAttribute('data-state', 'open'))
    await new Promise(resolve => setTimeout(resolve, 450))
    expect(panel).toBeInTheDocument()
    expect(button).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Close Add-on 1 details' }))
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(panel).toHaveAttribute('data-state', 'exiting')
    await waitFor(() => expect(panel).not.toBeInTheDocument(), { timeout: 800 })
    expect(screen.queryByText('Bare vehicle')).not.toBeInTheDocument()
    fireEvent.click(button); fireEvent.click(button)
    expect(screen.getByTestId('attachment')).toHaveAttribute('data-visible', 'false')
  })
  it('keeps the whole experience hidden until the renderer signals readiness', () => {
    readiness.defer = true
    render(<Configurator onExit={vi.fn()} />)
    expect(screen.getByText('Loading')).toBeVisible()
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow')
    expect(screen.queryByRole('button', { name: /^Return to Hub$/ })).not.toBeInTheDocument()
    expect(document.querySelector('.experience-content')).toHaveAttribute('inert')
    act(() => readiness.complete?.(true))
    expect(screen.queryByText('Loading')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Return to Hub$/ })).toBeInTheDocument()
  })
  it('offers a return-to-hub action without obsolete navigation', () => {
    const exit = vi.fn()
    render(<Configurator onExit={exit} />)
    expect(screen.queryByRole('button', { name: 'NEXUS' })).not.toBeInTheDocument()
    expect(screen.queryByText('JLTV CONFIGURATOR')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Bare vehicle' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Return to Hub$/ }))
    expect(exit).toHaveBeenCalledOnce()
  })
})
