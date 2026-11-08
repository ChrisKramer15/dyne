import { useId, useRef, useState } from 'react'
import type { AuthService } from './authService'
import { LoginForm } from './forms/LoginForm'
import { RegisterForm } from './forms/RegisterForm'
import { ResetForm } from './forms/ResetForm'
import { UpdatePasswordForm } from './forms/UpdatePasswordForm'
import type { Banner } from './forms/types'

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

const TITLES: Record<AuthMode, string> = {
  login: 'Log in',
  register: 'Create your account',
  reset: 'Reset your password',
  'update-password': 'Choose a new password',
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Dialog shell: overlay, focus trap, title, status banner and the links that
 * switch between modes. Each mode's fields and submit logic live in ./forms.
 */
export default function AuthModal({ mode: initialMode, service, onClose, onAuthenticated }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [banner, setBanner] = useState<Banner>(null)
  // Shared by the login and register forms so it survives switching between them.
  const [username, setUsername] = useState('')

  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const bannerId = useId()

  function switchMode(next: AuthMode) {
    setMode(next)
    setBanner(null)
  }

  // Escape closes; Tab is trapped within the dialog.
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab') return
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
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

        {mode === 'login' && (
          <LoginForm
            service={service}
            setBanner={setBanner}
            onClose={onClose}
            onAuthenticated={onAuthenticated}
            username={username}
            onUsernameChange={setUsername}
          />
        )}
        {mode === 'register' && (
          <RegisterForm
            service={service}
            setBanner={setBanner}
            username={username}
            onUsernameChange={setUsername}
          />
        )}
        {mode === 'reset' && <ResetForm service={service} setBanner={setBanner} />}
        {mode === 'update-password' && (
          <UpdatePasswordForm
            service={service}
            setBanner={setBanner}
            onClose={onClose}
            onAuthenticated={onAuthenticated}
          />
        )}

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
