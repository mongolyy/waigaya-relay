// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import UsernameSetupWidget from './UsernameSetupWidget'

// jsdom does not implement <dialog> modal methods; provide minimal stubs.
beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.open = true
    }
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close() {
      this.open = false
      this.dispatchEvent(new Event('close'))
    }
  }
})

afterEach(cleanup)

describe('UsernameSetupWidget', () => {
  it('disables the submit button until a name is entered', async () => {
    const user = userEvent.setup()
    render(<UsernameSetupWidget onSave={() => {}} />)

    const submit = screen.getByRole('button', { name: /start/i })
    expect(submit).toBeDisabled()

    await user.type(screen.getByLabelText(/your name/i), 'Alice')
    expect(submit).toBeEnabled()
  })

  it('calls onSave with the trimmed name on submit', async () => {
    const onSave = vi.fn()
    const user = userEvent.setup()
    render(<UsernameSetupWidget onSave={onSave} />)

    await user.type(screen.getByLabelText(/your name/i), '  Alice  ')
    await user.click(screen.getByRole('button', { name: /start/i }))
    expect(onSave).toHaveBeenCalledWith('Alice')
  })

  it('shows a Cancel button only when changing an existing name', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(
      <UsernameSetupWidget isChanging onSave={() => {}} onCancel={onCancel} />,
    )

    const cancel = screen.getByRole('button', { name: /cancel/i })
    await user.click(cancel)
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('does not render a Cancel button during initial setup', () => {
    render(<UsernameSetupWidget onSave={() => {}} />)
    expect(
      screen.queryByRole('button', { name: /cancel/i }),
    ).not.toBeInTheDocument()
  })
})
