import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import AuthModal, { type AuthMode } from './AuthModal'
import type { AuthService } from './authService'

function makeService(overrides: Partial<AuthService> = {}): AuthService {
  return {
    signIn: vi.fn().mockResolvedValue({ ok: true, rememberFailed: false }),
    signUp: vi.fn().mockResolvedValue({ ok: true, confirmationRequired: false }),
    requestPasswordReset: vi.fn().mockResolvedValue({ ok: true }),
    updatePassword: vi.fn().mockResolvedValue({ ok: true }),
    signOut: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function renderModal(mode: AuthMode, service = makeService()) {
  const onClose = vi.fn()
  const onAuthenticated = vi.fn()
  render(<AuthModal mode={mode} service={service} onClose={onClose} onAuthenticated={onAuthenticated} />)
  return { service, onClose, onAuthenticated }
}

describe('AuthModal', () => {
  it('renders as an accessible modal dialog with a title', () => {
    renderModal('login')
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('heading', { name: 'Log in' })).toBeTruthy()
  })

  it('blocks login submit on blank fields and does not call the service', async () => {
    const user = userEvent.setup()
    const { service } = renderModal('login')
    await user.click(screen.getByRole('button', { name: 'Log in' }))
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)
    expect(service.signIn).not.toHaveBeenCalled()
  })

  it('signs in with remember and closes on success', async () => {
    const user = userEvent.setup()
    const { service, onClose, onAuthenticated } = renderModal('login')
    await user.type(screen.getByLabelText('Username'), 'ahenker')
    await user.type(screen.getByLabelText('Password'), 'secretpw12')
    await user.click(screen.getByLabelText('Keep me logged in'))
    await user.click(screen.getByRole('button', { name: 'Log in' }))
    expect(service.signIn).toHaveBeenCalledWith({
      username: 'ahenker',
      password: 'secretpw12',
      remember: true,
    })
    expect(onAuthenticated).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('shows an error on invalid credentials and stays open', async () => {
    const user = userEvent.setup()
    const service = makeService({
      signIn: vi.fn().mockResolvedValue({ ok: false, error: 'invalid_credentials' }),
    })
    const { onClose } = renderModal('login', service)
    await user.type(screen.getByLabelText('Username'), 'ahenker')
    await user.type(screen.getByLabelText('Password'), 'wrongpass1')
    await user.click(screen.getByRole('button', { name: 'Log in' }))
    expect(await screen.findByText(/incorrect/i)).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('validates register fields (format, invalid email, mismatch)', async () => {
    const user = userEvent.setup()
    const { service } = renderModal('register')
    await user.type(screen.getByLabelText('Username'), 'ab') // too short -> format
    await user.type(screen.getByLabelText('Email'), 'nope')
    await user.type(screen.getByLabelText('Password'), 'longenough1')
    await user.type(screen.getByLabelText('Confirm password'), 'different1')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(screen.getByText(/letters, numbers or underscores/i)).toBeTruthy()
    expect(screen.getByText(/valid email/i)).toBeTruthy()
    expect(screen.getByText(/do not match/i)).toBeTruthy()
    expect(service.signUp).not.toHaveBeenCalled()
  })

  it('reports a taken username from the register result', async () => {
    const user = userEvent.setup()
    const service = makeService({
      signUp: vi.fn().mockResolvedValue({ ok: false, error: 'username_taken' }),
    })
    renderModal('register', service)
    await user.type(screen.getByLabelText('Username'), 'ahenker')
    await user.type(screen.getByLabelText('Email'), 'a@b.co')
    await user.type(screen.getByLabelText('Password'), 'longenough1')
    await user.type(screen.getByLabelText('Confirm password'), 'longenough1')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText(/already taken/i)).toBeTruthy()
  })

  it('shows a confirmation notice when signup requires email confirmation', async () => {
    const user = userEvent.setup()
    const service = makeService({
      signUp: vi.fn().mockResolvedValue({ ok: true, confirmationRequired: true }),
    })
    renderModal('register', service)
    await user.type(screen.getByLabelText('Username'), 'ahenker')
    await user.type(screen.getByLabelText('Email'), 'a@b.co')
    await user.type(screen.getByLabelText('Password'), 'longenough1')
    await user.type(screen.getByLabelText('Confirm password'), 'longenough1')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText(/check your email/i)).toBeTruthy()
  })

  it('sends a password reset and shows a neutral confirmation', async () => {
    const user = userEvent.setup()
    const { service } = renderModal('reset')
    await user.type(screen.getByLabelText('Username or email'), 'ahenker')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))
    expect(service.requestPasswordReset).toHaveBeenCalledWith('ahenker')
    expect(await screen.findByText(/if an account matches/i)).toBeTruthy()
  })

  it('switches between modes', async () => {
    const user = userEvent.setup()
    renderModal('login')
    await user.click(screen.getByRole('button', { name: /create an account/i }))
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /^log in$/i }))
    expect(screen.getByRole('heading', { name: 'Log in' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /forgot password/i }))
    expect(screen.getByRole('heading', { name: 'Reset your password' })).toBeTruthy()
  })

  it('closes on Escape and on the close button', async () => {
    const user = userEvent.setup()
    const { onClose } = renderModal('login')
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
