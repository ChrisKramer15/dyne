import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useReducer } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthModal } from './AuthModal'
import { authModalReducer, CLOSED_STATE } from './authModalReducer'
import {
  withTimeout,
  type AuthService,
  type ResetResult,
  type SignInResult,
  type SignUpResult,
} from './authService'

interface FakeService extends AuthService {
  signIn: ReturnType<typeof vi.fn<AuthService['signIn']>>
  signUp: ReturnType<typeof vi.fn<AuthService['signUp']>>
  requestPasswordReset: ReturnType<typeof vi.fn<AuthService['requestPasswordReset']>>
}

function makeService(over: Partial<AuthService> = {}): FakeService {
  return {
    signIn: vi.fn(async (): Promise<SignInResult> => ({ ok: true, rememberFailed: false })),
    signUp: vi.fn(
      async (): Promise<SignUpResult> => ({ ok: true, confirmationRequired: false }),
    ),
    requestPasswordReset: vi.fn(async (): Promise<ResetResult> => ({ ok: true })),
    signOut: vi.fn(async () => {}),
    ...over,
  } as FakeService
}

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

function Harness({
  service,
  view = 'login',
  onRememberFailed,
}: {
  service: AuthService
  view?: 'login' | 'register'
  onRememberFailed?: () => void
}) {
  const [state, dispatch] = useReducer(
    authModalReducer,
    CLOSED_STATE,
    (s) => authModalReducer(s, { type: 'OPEN', view }),
  )
  return (
    <div>
      <p data-testid="open">{state.open ? 'open' : 'closed'}</p>
      <button type="button" onClick={() => dispatch({ type: 'OPEN', view: 'login' })}>
        outside-open
      </button>
      <AuthModal
        state={state}
        dispatch={dispatch}
        service={service}
        onRememberFailed={onRememberFailed}
      />
    </div>
  )
}

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
const submitBtn = (name: string) => screen.getByRole('button', { name })
const isOpen = () => screen.getByTestId('open').textContent === 'open'

afterEach(() => {
  vi.useRealTimers()
})

describe('AuthModal', () => {
  describe('opening and closing', () => {
    it('renders a dialog and focuses the first input on open', () => {
      render(<Harness service={makeService()} />)
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByLabelText('Username')).toHaveFocus()
    })

    it('renders nothing when closed and reopens with focus on the first input', () => {
      render(<Harness service={makeService()} />)
      fireEvent.click(screen.getByRole('button', { name: 'Close' }))
      expect(screen.queryByRole('dialog')).toBeNull()
      fireEvent.click(screen.getByText('outside-open'))
      expect(screen.getByLabelText('Username')).toHaveFocus()
    })

    it('closes via the close control', () => {
      render(<Harness service={makeService()} />)
      fireEvent.click(screen.getByRole('button', { name: 'Close' }))
      expect(isOpen()).toBe(false)
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('closes on Escape', () => {
      render(<Harness service={makeService()} />)
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(isOpen()).toBe(false)
    })

    it('closes on backdrop click', () => {
      render(<Harness service={makeService()} />)
      // dialog -> .auth-modal-frame (stops clicks) -> backdrop
      const frame = screen.getByRole('dialog').parentElement as HTMLElement
      expect(frame).toHaveClass('auth-modal-frame')
      fireEvent.click(frame)
      expect(isOpen()).toBe(true)
      fireEvent.click(frame.parentElement as HTMLElement)
      expect(isOpen()).toBe(false)
    })

    it('stays open when clicking inside the dialog', () => {
      render(<Harness service={makeService()} />)
      fireEvent.click(screen.getByRole('dialog'))
      fireEvent.click(screen.getByRole('heading', { name: 'Hello, Again!' }))
      expect(isOpen()).toBe(true)
    })
  })

  describe('dialog semantics', () => {
    it('is a modal dialog named by the current view heading', () => {
      render(<Harness service={makeService()} />)
      const dialog = screen.getByRole('dialog', { name: 'Hello, Again!' })
      expect(dialog).toHaveAttribute('aria-modal', 'true')

      fireEvent.click(screen.getByRole('button', { name: 'Register' }))
      expect(screen.getByRole('dialog', { name: 'Create account' })).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Login' }))
      fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }))
      expect(screen.getByRole('dialog', { name: 'Reset password' })).toBeInTheDocument()
    })

    it('labels every input in each view and masks passwords', () => {
      render(<Harness service={makeService()} />)
      expect(screen.getByLabelText('Username')).toBeInTheDocument()
      expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
      expect(screen.getByLabelText('Remember me')).toHaveAttribute('type', 'checkbox')

      fireEvent.click(screen.getByRole('button', { name: 'Register' }))
      expect(screen.getByLabelText('Username')).toBeInTheDocument()
      expect(screen.getByLabelText('Email')).toBeInTheDocument()
      expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
      expect(screen.getByLabelText('Confirm password')).toHaveAttribute('type', 'password')

      fireEvent.click(screen.getByRole('button', { name: 'Login' }))
      fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }))
      expect(screen.getByLabelText('Username or email')).toBeInTheDocument()
    })

    it('has an always-present alert region', () => {
      render(<Harness service={makeService()} />)
      expect(screen.getByRole('alert')).toBeEmptyDOMElement()
    })

    it('moves focus to the first input of the new view on toggle', () => {
      render(<Harness service={makeService()} />)
      fireEvent.click(screen.getByRole('button', { name: 'Register' }))
      expect(screen.getByLabelText('Username')).toHaveFocus()
    })
  })

  describe('validation', () => {
    it('shows required errors and does not call the service for blank login', () => {
      const service = makeService()
      render(<Harness service={service} />)
      fireEvent.click(submitBtn('Log in'))
      const alert = screen.getByRole('alert')
      expect(within(alert).getByText('Username is required.')).toBeInTheDocument()
      expect(within(alert).getByText('Password is required.')).toBeInTheDocument()
      expect(service.signIn).not.toHaveBeenCalled()
    })

    it('reports registration rule violations without calling the service', () => {
      const service = makeService()
      render(<Harness service={service} view="register" />)
      type('Username', 'a!')
      type('Email', 'nope')
      type('Password', 'short')
      type('Confirm password', 'other')
      fireEvent.click(submitBtn('Create account'))
      const alert = screen.getByRole('alert')
      expect(alert).toHaveTextContent('Username must be 3 to 20 characters')
      expect(alert).toHaveTextContent('Enter a valid email address.')
      expect(alert).toHaveTextContent('Password must be at least 8 characters.')
      expect(alert).toHaveTextContent('Passwords do not match.')
      expect(service.signUp).not.toHaveBeenCalled()
    })

    it('does not call the service for a blank forgot-password identifier', () => {
      const service = makeService()
      render(<Harness service={service} />)
      fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }))
      fireEvent.click(submitBtn('Send reset link'))
      expect(screen.getByRole('alert')).toHaveTextContent('Username or email is required.')
      expect(service.requestPasswordReset).not.toHaveBeenCalled()
    })
  })

  describe('submission', () => {
    it('passes entered values unchanged to signIn', async () => {
      const service = makeService()
      render(<Harness service={service} />)
      type('Username', 'alice')
      type('Password', ' pw with space ')
      fireEvent.click(screen.getByLabelText('Remember me'))
      fireEvent.click(submitBtn('Log in'))
      await waitFor(() => expect(isOpen()).toBe(false))
      expect(service.signIn).toHaveBeenCalledWith({
        username: 'alice',
        password: ' pw with space ',
        remember: true,
      })
    })

    it('shows a generic error and clears the password on invalid credentials', async () => {
      const service = makeService({
        signIn: vi.fn(async () => ({ ok: false as const, error: 'invalid_credentials' as const })),
      })
      render(<Harness service={service} />)
      type('Username', 'alice')
      type('Password', 'wrongpass')
      fireEvent.click(submitBtn('Log in'))
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent('Invalid username or password.'),
      )
      expect(screen.getByLabelText('Username')).toHaveValue('alice')
      expect(screen.getByLabelText('Password')).toHaveValue('')
      expect(isOpen()).toBe(true)
    })

    it('calls onRememberFailed after a sign-in that could not be remembered', async () => {
      const onRememberFailed = vi.fn()
      const service = makeService({
        signIn: vi.fn(async () => ({ ok: true as const, rememberFailed: true })),
      })
      render(<Harness service={service} onRememberFailed={onRememberFailed} />)
      type('Username', 'alice')
      type('Password', 'password1')
      fireEvent.click(submitBtn('Log in'))
      await waitFor(() => expect(onRememberFailed).toHaveBeenCalledTimes(1))
    })

    it('names the taken value on registration conflicts', async () => {
      const service = makeService({
        signUp: vi.fn(async () => ({ ok: false as const, error: 'username_taken' as const })),
      })
      render(<Harness service={service} view="register" />)
      type('Username', 'alice')
      type('Email', 'a@b.co')
      type('Password', 'password1')
      type('Confirm password', 'password1')
      fireEvent.click(submitBtn('Create account'))
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent('That username is already in use.'),
      )
      expect(screen.getByLabelText('Email')).toHaveValue('a@b.co')
    })

    it('shows the confirmation-required notice and clears passwords', async () => {
      const service = makeService({
        signUp: vi.fn(async () => ({ ok: true as const, confirmationRequired: true })),
      })
      render(<Harness service={service} view="register" />)
      type('Username', 'alice')
      type('Email', 'a@b.co')
      type('Password', 'password1')
      type('Confirm password', 'password1')
      fireEvent.click(submitBtn('Create account'))
      const notice = await screen.findByRole('status')
      expect(notice).toHaveTextContent('Check your email and confirm your address')
      expect(isOpen()).toBe(true)
      expect(screen.getByLabelText('Password')).toHaveValue('')
      expect(screen.getByLabelText('Confirm password')).toHaveValue('')
    })
  })

  describe('pending state', () => {
    it('disables submit, marks the form busy, ignores toggle and resubmits', async () => {
      const d = deferred<SignInResult>()
      const service = makeService({ signIn: vi.fn(() => d.promise) })
      render(<Harness service={service} />)
      type('Username', 'alice')
      type('Password', 'password1')
      const submit = submitBtn('Log in')
      fireEvent.click(submit)

      await waitFor(() => expect(submit).toBeDisabled())
      const form = submit.closest('form') as HTMLFormElement
      expect(form).toHaveAttribute('aria-busy', 'true')

      fireEvent.click(screen.getByRole('button', { name: 'Register' }))
      expect(screen.getByRole('dialog', { name: 'Hello, Again!' })).toBeInTheDocument()

      fireEvent.submit(form)
      expect(service.signIn).toHaveBeenCalledTimes(1)

      await act(async () => {
        d.resolve({ ok: false, error: 'unavailable' })
      })
      expect(submit).toBeEnabled()
      expect(form).toHaveAttribute('aria-busy', 'false')
    })
  })

  describe('10 second timeouts', () => {
    // Mirrors the real service: every call is wrapped in withTimeout and a
    // timeout maps to the "unavailable" result.
    const hanging = () => new Promise<never>(() => {})

    it('shows the unavailable message after a sign-in timeout and re-enables submit', async () => {
      vi.useFakeTimers()
      const service = makeService({
        signIn: vi.fn(async () => {
          try {
            return await withTimeout(hanging(), 10_000)
          } catch {
            return { ok: false as const, error: 'unavailable' as const }
          }
        }),
      })
      render(<Harness service={service} />)
      type('Username', 'alice')
      type('Password', 'password1')
      const submit = submitBtn('Log in')
      fireEvent.click(submit)
      expect(submit).toBeDisabled()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(9_999)
      })
      expect(submit).toBeDisabled()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1)
      })
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Sign-in is temporarily unavailable. Please try again.',
      )
      expect(submit).toBeEnabled()
      expect(screen.getByLabelText('Username')).toHaveValue('alice')
    })

    it('shows the registration-specific message after a sign-up timeout', async () => {
      vi.useFakeTimers()
      const service = makeService({
        signUp: vi.fn(async () => {
          try {
            return await withTimeout(hanging(), 10_000)
          } catch {
            return { ok: false as const, error: 'unavailable' as const }
          }
        }),
      })
      render(<Harness service={service} view="register" />)
      type('Username', 'alice')
      type('Email', 'a@b.co')
      type('Password', 'password1')
      type('Confirm password', 'password1')
      fireEvent.click(submitBtn('Create account'))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000)
      })
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Registration is temporarily unavailable. Please try again.',
      )
    })

    it('shows the reset-unavailable message after a reset timeout', async () => {
      vi.useFakeTimers()
      const service = makeService({
        requestPasswordReset: vi.fn(async () => {
          try {
            return await withTimeout(hanging(), 10_000)
          } catch {
            return { ok: false as const, error: 'reset_unavailable' as const }
          }
        }),
      })
      render(<Harness service={service} />)
      fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }))
      type('Username or email', 'alice')
      fireEvent.click(submitBtn('Send reset link'))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000)
      })
      expect(screen.getByRole('alert')).toHaveTextContent(
        'The request could not be sent. Please try again.',
      )
      expect(submitBtn('Send reset link')).toBeEnabled()
    })
  })

  describe('forgot-password flow', () => {
    async function requestReset(service: AuthService, identifier: string) {
      const { unmount } = render(<Harness service={service} />)
      fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }))
      type('Username or email', identifier)
      fireEvent.click(submitBtn('Send reset link'))
      const notice = await screen.findByRole('status')
      const text = notice.textContent
      unmount()
      return text
    }

    it('shows an identical confirmation regardless of whether an account matched', async () => {
      const matched = makeService()
      const unmatched = makeService()
      const a = await requestReset(matched, 'alice')
      const b = await requestReset(unmatched, 'nobody@nowhere.example')
      expect(a).toBe(b)
      expect(a).toContain('If an account matches')
      expect(matched.requestPasswordReset).toHaveBeenCalledWith('alice')
      expect(unmatched.requestPasswordReset).toHaveBeenCalledWith('nobody@nowhere.example')
    })

    it('returns to a clean login view via Back to log in', async () => {
      render(<Harness service={makeService()} />)
      fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }))
      type('Username or email', 'alice')
      fireEvent.click(submitBtn('Send reset link'))
      await screen.findByRole('status')
      fireEvent.click(screen.getByRole('button', { name: 'Back to log in' }))
      expect(screen.getByRole('dialog', { name: 'Hello, Again!' })).toBeInTheDocument()
      expect(screen.queryByRole('status')).toBeNull()
      expect(screen.getByRole('alert')).toBeEmptyDOMElement()
    })

    it('shows an error when the request fails', async () => {
      const service = makeService({
        requestPasswordReset: vi.fn(async () => ({
          ok: false as const,
          error: 'reset_unavailable' as const,
        })),
      })
      render(<Harness service={service} />)
      fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }))
      type('Username or email', 'alice')
      fireEvent.click(submitBtn('Send reset link'))
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent(
          'The request could not be sent. Please try again.',
        ),
      )
      expect(screen.queryByRole('status')).toBeNull()
    })
  })
})
