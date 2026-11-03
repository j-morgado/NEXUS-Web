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
  it('starts bare and keeps add-ons mutually exclusive with toggle-off behavior', () => {
    render(<Configurator onExit={vi.fn()} />)
    const buttons = [1, 2, 3].map(number => screen.getByRole('button', { name: new RegExp(`Add-on ${number}`) }))
    const pressed = () => buttons.map(button => button.getAttribute('aria-pressed'))
    expect(pressed()).toEqual(['false', 'false', 'false'])
    expect(screen.getByTestId('attachment')).toHaveAttribute('data-visible', 'false')
    fireEvent.click(buttons[0])
    expect(pressed()).toEqual(['true', 'false', 'false'])
    expect(screen.getByTestId('attachment')).toHaveAttribute('data-visible', 'true')
    fireEvent.click(buttons[1])
    expect(pressed()).toEqual(['false', 'true', 'false'])
    expect(screen.getByTestId('attachment')).toHaveAttribute('data-visible', 'false')
    fireEvent.click(buttons[2])
    expect(pressed()).toEqual(['false', 'false', 'true'])
    fireEvent.click(buttons[2])
    expect(pressed()).toEqual(['false', 'false', 'false'])
    expect(screen.queryByText('Bare vehicle')).not.toBeInTheDocument()
    fireEvent.click(buttons[0]); fireEvent.click(buttons[0])
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
