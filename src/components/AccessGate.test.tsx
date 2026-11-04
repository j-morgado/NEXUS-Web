import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AccessGate } from './AccessGate'

describe('site access gate', () => {
  beforeEach(() => window.sessionStorage.clear())
  afterEach(cleanup)

  it('blocks the experience when the password is wrong', () => {
    render(<AccessGate><div>Protected experience</div></AccessGate>)

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enter site' }))

    expect(screen.getByRole('alert')).toHaveTextContent("That password isn't correct. Try again.")
    expect(screen.queryByText('Protected experience')).not.toBeInTheDocument()
  })

  it('unlocks with the requested password and remembers the browser session', () => {
    const first = render(<AccessGate><div>Protected experience</div></AccessGate>)

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'nexus' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enter site' }))

    expect(screen.getByText('Protected experience')).toBeInTheDocument()
    first.unmount()

    render(<AccessGate><div>Protected experience</div></AccessGate>)
    expect(screen.getByText('Protected experience')).toBeInTheDocument()
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
  })
})

