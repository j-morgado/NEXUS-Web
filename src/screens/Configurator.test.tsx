import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Configurator } from './Configurator'

vi.mock('../components/ModelStage', () => ({ ModelStage: ({ addonVisible }: { addonVisible: boolean }) => <div data-testid="attachment" data-visible={String(addonVisible)} /> }))

describe('experience configuration', () => {
  afterEach(cleanup)
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
    expect(screen.getByRole('status')).toHaveTextContent('Bare vehicle')
    fireEvent.click(buttons[0]); fireEvent.click(buttons[0])
    expect(screen.getByTestId('attachment')).toHaveAttribute('data-visible', 'false')
  })
  it('offers a return-to-hub action without obsolete navigation', () => {
    const exit = vi.fn()
    render(<Configurator onExit={exit} />)
    expect(screen.queryByRole('button', { name: 'NEXUS' })).not.toBeInTheDocument()
    expect(screen.queryByText('JLTV CONFIGURATOR')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Bare vehicle' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Return to hub/ }))
    expect(exit).toHaveBeenCalledOnce()
  })
})
