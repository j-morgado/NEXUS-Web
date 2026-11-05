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

  it('does not advertise or force-focus the preview gate as an account credential', () => {
    render(<AccessGate><div>Protected experience</div></AccessGate>)
    const input = screen.getByLabelText('Password')
    const form = input.closest('form')

    expect(input).toHaveAttribute('type', 'password')
    expect(input).toHaveAttribute('autocomplete', 'off')
    expect(input).toHaveAttribute('data-1p-ignore', 'true')
    expect(input).not.toHaveAttribute('name')
    expect(input).not.toHaveAttribute('autofocus')
    expect(form).toHaveAttribute('autocomplete', 'off')
    expect(form).toHaveAttribute('data-1p-ignore', 'true')
    expect(input).not.toHaveFocus()

    fireEvent.change(input, { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enter site' }))
    expect(input).not.toHaveFocus()
  })

  it('unlocks with the requested password and remembers the browser session', () => {
    const first = render(<AccessGate><div>Protected experience</div></AccessGate>)

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'nexus' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enter site' }))

    expect(screen.getByText('Protected experience')).toBeInTheDocument()
    expect(document.querySelector('input[type="password"]')).not.toBeInTheDocument()
    expect(document.querySelector('.access-form')).not.toBeInTheDocument()
    first.unmount()

    render(<AccessGate><div>Protected experience</div></AccessGate>)
    expect(screen.getByText('Protected experience')).toBeInTheDocument()
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
  })
})

