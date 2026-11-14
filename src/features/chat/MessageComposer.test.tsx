import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MessageComposer } from './MessageComposer'

describe('MessageComposer', () => {
  it('submits on Enter and clears after a stored message', async () => {
    const onSend = vi.fn().mockResolvedValue(true)
    render(<MessageComposer onSend={onSend} />)
    const box = screen.getByRole('textbox', { name: 'Message' })
    await userEvent.type(box, 'hello{Enter}')
    expect(onSend).toHaveBeenCalledWith('hello')
    expect(box).toHaveValue('')
    expect(box).toHaveFocus()
  })

  it('inserts a newline on Shift+Enter without submitting', async () => {
    const onSend = vi.fn().mockResolvedValue(true)
    render(<MessageComposer onSend={onSend} />)
    const box = screen.getByRole('textbox')
    await userEvent.type(box, 'a{Shift>}{Enter}{/Shift}b')
    expect(onSend).not.toHaveBeenCalled()
    expect(box).toHaveValue('a\nb')
  })

  it('keeps text and focus on whitespace-only input', async () => {
    const onSend = vi.fn()
    render(<MessageComposer onSend={onSend} />)
    const box = screen.getByRole('textbox')
    await userEvent.type(box, '   {Enter}')
    expect(onSend).not.toHaveBeenCalled()
    expect(box).toHaveValue('   ')
    expect(box).toHaveFocus()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('shows the limit for text over 2000 characters', async () => {
    const onSend = vi.fn()
    render(<MessageComposer onSend={onSend} />)
    const box = screen.getByRole('textbox')
    await userEvent.click(box)
    await userEvent.paste('x'.repeat(2001))
    await userEvent.keyboard('{Enter}')
    expect(onSend).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('2000')
  })

  it('keeps text when sending fails', async () => {
    const onSend = vi.fn().mockResolvedValue(false)
    render(<MessageComposer onSend={onSend} />)
    const box = screen.getByRole('textbox')
    await userEvent.type(box, 'hi{Enter}')
    expect(box).toHaveValue('hi')
  })

  it('ignores a submit while one is in flight', async () => {
    let resolve!: (v: boolean) => void
    const onSend = vi.fn(() => new Promise<boolean>((r) => (resolve = r)))
    render(<MessageComposer onSend={onSend} />)
    const box = screen.getByRole('textbox')
    await userEvent.type(box, 'hi{Enter}{Enter}')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(onSend).toHaveBeenCalledTimes(1)
    resolve(true)
    await vi.waitFor(() => expect(box).toHaveValue(''))
  })
})
