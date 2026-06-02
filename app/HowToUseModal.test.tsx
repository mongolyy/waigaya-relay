// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import HowToUseModal from './HowToUseModal'

afterEach(cleanup)

describe('HowToUseModal', () => {
  it('renders the dialog', () => {
    render(<HowToUseModal onClose={() => {}} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<HowToUseModal onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<HowToUseModal onClose={onClose} />)
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when the backdrop is clicked but not the dialog body', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<HowToUseModal onClose={onClose} />)

    // Clicking inside the dialog body does not dismiss.
    await user.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()

    // Clicking the backdrop (the dialog's parent) dismisses.
    const backdrop = screen.getByRole('dialog').parentElement as HTMLElement
    await user.click(backdrop)
    expect(onClose).toHaveBeenCalledOnce()
  })
})
