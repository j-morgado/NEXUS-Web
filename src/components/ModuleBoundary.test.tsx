import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { ModuleBoundary } from './ModuleBoundary'

it('recovers a failed lazy route with route-specific messaging', () => {
  let failing = true
  const failure = vi.fn()
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  function Route() {
    if (failing) throw new Error('chunk unavailable')
    return <p>Explorer ready</p>
  }

  render(<ModuleBoundary moduleName="Explorer" onExit={vi.fn()} onFailure={failure}><Route /></ModuleBoundary>)
  expect(screen.getByRole('heading', { name: 'Explorer is temporarily unavailable.' })).toBeInTheDocument()
  expect(failure).toHaveBeenCalledOnce()
  failing = false
  fireEvent.click(screen.getByRole('button', { name: /retry module/i }))
  expect(screen.getByText('Explorer ready')).toBeInTheDocument()
  consoleError.mockRestore()
})
