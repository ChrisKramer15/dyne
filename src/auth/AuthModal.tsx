import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import {
  validateLogin,
  validateRegister,
  validateIdentifier,
  validateUpdatePassword,
  type Field,
  type FieldError,
} from './validation'
import type { AuthService } from './authService'

export type AuthMode = 'login' | 'register' | 'reset' | 'update-password'

export interface AuthModalProps {
  /** Which form to show when the modal opens. */
  mode: AuthMode
  /** The headless auth service to drive network calls. */
  service: AuthService
  /** Called when the user dismisses the modal (backdrop, Escape or close button). */
  onClose: () => void
  /** Called after a successful sign in so the host can react (e.g. refresh state). */
  onAuthenticated?: () => void
}

// Human-readable copy for each field error code. Kept deliberately vague for
// login so lengths/credentials never leak.
const FIELD_MESSAGES: Record<string, string> = {
  'username:required': 'Enter your username.',
  'username:format': 'Use 3–20 letters, numbers or underscores.',
  'username:taken': 'Pick a different username.',
  'email:required': 'Enter your email.',
  'email:invalid': 'Enter a valid email address.',
  'email:taken': 'Use a different email address.',
  'password:required': 'Enter your password.',
  'password:too_short': 'Use at least 8 characters.',
  'confirmPassword:required': 'Re-enter your password.',
  'confirmPassword:mismatch': 'Passwords do not match.',
  'identifier:required': 'Enter your username or email.',
  'newPassword:required': 'Enter a new password.',
  'newPassword:too_short': 'Use at least 8 characters.',
}

function messageFor(err: FieldError): string {
  return FIELD_MESSAGES[`${err.field}:${err.code}`] ?? 'Check this field.'
}

function errorFor(errors: FieldError[], field: Field): FieldError | undefined {
  return errors.find((e) => e.field === field)
}

const TITLES: Record<AuthMode, string> = {
  login: 'Log in',
  register: 'Create your account',
  reset: 'Reset your password',
  'update-password': 'Choose a new password',
}

// A top-of-form status line: either an error or a success/info note.
type Banner = { kind: 'error' | 'success'; text: string } | null

export default function AuthModal({ mode: initialMode, service, onClose, onAuthenticated }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([])
  const [banner, setBanner] = useState<Banner>(null)
  const [busy, setBusy] = useState(false)

  // Controlled inputs. Kept across mode switches where it makes sense.
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [remember, setRemember] = useState(false)

  const dialogRef = useRef<HTMLDivElement>(null)
  const firstFieldRef = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const bannerId = useId()

  // Reset transient UI whenever the mode changes.
  function switchMode(next: AuthMode) {
    setMode(next)
    setFieldErrors([])
    setBanner(null)
  }

  // Focus the first field on open and on mode change.
  useEffect(() => {
    firstFieldRef.current?.focus()
  }, [mode])

  // Escape closes; Tab is trapped within the dialog.
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab') return
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    if (!focusable || focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBanner(null)

    if (mode === 'login') {
      const errors = validateLogin({ username, password })
      setFieldErrors(errors)
      if (errors.length > 0) return
      setBusy(true)
      const result = await service.signIn({ username, password, remember })
      setBusy(false)
      if (result.ok) {
        onAuthenticated?.()
        if (result.rememberFailed) {
          // Stay open so the notice can be read; the auth state change moves
          // the app to /home, which unmounts this dialog.
          setBanner({ kind: 'success', text: "Signed in. We couldn't keep you logged in on this device." })
          return
        }
        onClose()
        return
      }
      setBanner({
        kind: 'error',
        text:
          result.error === 'invalid_credentials'
            ? 'That username or password is incorrect.'
            : 'Something went wrong. Please try again.',
      })
      return
    }

    if (mode === 'register') {
      const errors = validateRegister({ username, email, password, confirmPassword })
      setFieldErrors(errors)
      if (errors.length > 0) return
      setBusy(true)
      const result = await service.signUp({ username, email, password })
      setBusy(false)
      if (result.ok) {
        setBanner({
          kind: 'success',
          text: result.confirmationRequired
            ? 'Account created. Check your email to confirm your address.'
            : 'Account created. You can now log in.',
        })
        return
      }
      if (result.error === 'username_taken') {
        setFieldErrors([{ field: 'username', code: 'taken' }])
        setBanner({ kind: 'error', text: 'That username is already taken.' })
      } else if (result.error === 'email_taken') {
        setFieldErrors([{ field: 'email', code: 'taken' }])
        setBanner({ kind: 'error', text: 'That email is already registered.' })
      } else {
        setBanner({ kind: 'error', text: 'Something went wrong. Please try again.' })
      }
      return
    }

    if (mode === 'reset') {
      const errors = validateIdentifier(identifier)
      setFieldErrors(errors)
      if (errors.length > 0) return
      setBusy(true)
      const result = await service.requestPasswordReset(identifier)
      setBusy(false)
      if (result.ok) {
        setBanner({
          kind: 'success',
          text: 'If an account matches that, we’ve sent a reset link.',
        })
      } else {
        setBanner({ kind: 'error', text: 'Something went wrong. Please try again.' })
      }
      return
    }

    // update-password (reached from a reset link)
    const errors = validateUpdatePassword({ newPassword, confirmPassword })
    setFieldErrors(errors)
    if (errors.length > 0) return
    setBusy(true)
    const result = await service.updatePassword(newPassword)
    setBusy(false)
    if (result.ok) {
      onAuthenticated?.()
      onClose()
    } else {
      setBanner({ kind: 'error', text: 'Something went wrong. Please try again.' })
    }
  }

  // Field markup helper so the three forms stay consistent and accessible.
  function fieldProps(field: Field) {
    const err = errorFor(fieldErrors, field)
    const errId = `${titleId}-${field}-error`
    return {
      err,
      errId,
      inputProps: {
        'aria-invalid': err ? true : undefined,
        'aria-describedby': err ? errId : undefined,
      },
    }
  }

  function renderError(field: Field) {
    const err = errorFor(fieldErrors, field)
    if (!err) return null
    return (
      <span className="auth-field-error" id={`${titleId}-${field}-error`} role="alert">
        {messageFor(err)}
      </span>
    )
  }

  return (
    <div
      className="auth-overlay"
      // Click on the backdrop (not the dialog) closes.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={`auth-dialog auth-dialog-${mode}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={banner ? bannerId : undefined}
        ref={dialogRef}
        onKeyDown={onKeyDown}
      >
        <button type="button" className="auth-close" aria-label="Close" onClick={onClose}>
          <span aria-hidden="true">×</span>
        </button>

        <h2 className="auth-title" id={titleId}>
          {TITLES[mode]}
        </h2>

        {banner && (
          <p className={`auth-banner auth-banner-${banner.kind}`} id={bannerId} role="status">
            {banner.text}
          </p>
        )}

        <form className="auth-form" onSubmit={onSubmit} noValidate>
          {mode === 'login' && (
            <>
              <label className="auth-label" htmlFor={`${titleId}-username`}>
                Username
              </label>
              <input
                id={`${titleId}-username`}
                className="auth-input"
                type="text"
                autoComplete="username"
                ref={firstFieldRef}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                {...fieldProps('username').inputProps}
              />
              {renderError('username')}

              <label className="auth-label" htmlFor={`${titleId}-password`}>
                Password
              </label>
              <input
                id={`${titleId}-password`}
                className="auth-input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                {...fieldProps('password').inputProps}
              />
              {renderError('password')}

              <label className="auth-check">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                Keep me logged in
              </label>
            </>
          )}

          {mode === 'register' && (
            <>
              <label className="auth-label" htmlFor={`${titleId}-username`}>
                Username
              </label>
              <input
                id={`${titleId}-username`}
                className="auth-input"
                type="text"
                autoComplete="username"
                ref={firstFieldRef}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                {...fieldProps('username').inputProps}
              />
              {renderError('username')}

              <label className="auth-label" htmlFor={`${titleId}-email`}>
                Email
              </label>
              <input
                id={`${titleId}-email`}
                className="auth-input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                {...fieldProps('email').inputProps}
              />
              {renderError('email')}

              <label className="auth-label" htmlFor={`${titleId}-password`}>
                Password
              </label>
              <input
                id={`${titleId}-password`}
                className="auth-input"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                {...fieldProps('password').inputProps}
              />
              {renderError('password')}

              <label className="auth-label" htmlFor={`${titleId}-confirm`}>
                Confirm password
              </label>
              <input
                id={`${titleId}-confirm`}
                className="auth-input"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                {...fieldProps('confirmPassword').inputProps}
              />
              {renderError('confirmPassword')}
            </>
          )}

          {mode === 'reset' && (
            <>
              <label className="auth-label" htmlFor={`${titleId}-identifier`}>
                Username or email
              </label>
              <input
                id={`${titleId}-identifier`}
                className="auth-input"
                type="text"
                autoComplete="username"
                ref={firstFieldRef}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                {...fieldProps('identifier').inputProps}
              />
              {renderError('identifier')}
            </>
          )}

          {mode === 'update-password' && (
            <>
              <label className="auth-label" htmlFor={`${titleId}-new-password`}>
                New password
              </label>
              <input
                id={`${titleId}-new-password`}
                className="auth-input"
                type="password"
                autoComplete="new-password"
                ref={firstFieldRef}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                {...fieldProps('newPassword').inputProps}
              />
              {renderError('newPassword')}

              <label className="auth-label" htmlFor={`${titleId}-confirm`}>
                Confirm new password
              </label>
              <input
                id={`${titleId}-confirm`}
                className="auth-input"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                {...fieldProps('confirmPassword').inputProps}
              />
              {renderError('confirmPassword')}
            </>
          )}

          <button
            type="submit"
            className={`btn ${mode === 'login' ? 'btn-login' : 'btn-primary'} auth-submit`}
            disabled={busy}
          >
            {busy
              ? 'Working…'
              : mode === 'login'
                ? 'Log in'
                : mode === 'register'
                  ? 'Create account'
                  : mode === 'reset'
                    ? 'Send reset link'
                    : 'Save new password'}
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'login' && (
            <>
              <button type="button" className="auth-link" onClick={() => switchMode('reset')}>
                Forgot password?
              </button>
              <p className="auth-switch-line">
                New here?{' '}
                <button type="button" className="auth-link" onClick={() => switchMode('register')}>
                  Create an account
                </button>
              </p>
            </>
          )}
          {mode === 'register' && (
            <p className="auth-switch-line">
              Already have an account?{' '}
              <button type="button" className="auth-link" onClick={() => switchMode('login')}>
                Log in
              </button>
            </p>
          )}
          {mode === 'reset' && (
            <p className="auth-switch-line">
              Remembered it?{' '}
              <button type="button" className="auth-link" onClick={() => switchMode('login')}>
                Back to log in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
