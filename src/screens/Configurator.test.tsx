import { useEffect } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Configurator } from './Configurator'

const readiness = vi.hoisted(() => ({ defer: false, complete: null as null | ((ready: boolean) => void) }))
vi.mock('../components/ModelStage', () => ({ ModelStage: ({ addonVisible, onReadyChange }: { addonVisible: boolean; onReadyChange: (ready: boolean) => void }) => {
  useEffect(() => { readiness.complete = onReadyChange; if (!readiness.defer) onReadyChange(true) }, [onReadyChange])
  return <div data-testid="attachment" data-visible={String(addonVisible)} />
} }))

describe('experience configuration', () => {
  afterEach(() => { cleanup(); readiness.defer = false; readiness.complete = null })
  it('starts bare and toggles the actual add-on with a thumbnail and detail panel', () => {
    render(<Configurator onExit={vi.fn()} />)
    const button = screen.getByRole('button', { name: 'Add-on 1' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(button.querySelector('img')).toHaveAttribute('src', '/assets/addons/addon-1.webp')
    expect(screen.getByTestId('attachment')).toHaveAttribute('data-visible', 'false')
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('attachment')).toHaveAttribute('data-visible', 'true')
    expect(screen.getByRole('complementary', { name: 'Add-on 1 details' })).toBeVisible()
    expect(screen.getAllByText('Placeholder — pending approved data')).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: 'Close Add-on 1 details' }))
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('complementary', { name: 'Add-on 1 details' })).not.toBeInTheDocument()
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
