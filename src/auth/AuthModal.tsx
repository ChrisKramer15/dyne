import { useEffect, useId, useRef, useState, type Dispatch, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { AuthModalAction, AuthModalState, ServiceError } from './authModalReducer'
import type { AuthService } from './authService'
import { useFocusTrap } from './focusTrap'
import {
  LIMITS,
  validateIdentifier,
  validateLogin,
  validateRegister,
  type Field,
  type FieldError,
} from './validation'

export interface AuthModalProps {
  state: AuthModalState
  dispatch: Dispatch<AuthModalAction>
  service: AuthService
  /** Called after a successful sign-in when the login could not be remembered. */
  onRememberFailed?: () => void
}

const SERVICE_MESSAGES: Record<ServiceError, string> = {
  invalid_credentials: 'Invalid username or password.',
  unavailable: 'Sign-in is temporarily unavailable. Please try again.',
  username_taken: 'That username is already in use.',
  email_taken: 'That email is already in use.',
  reset_unavailable: 'The request could not be sent. Please try again.',
}

const NOTICE_MESSAGES = {
  confirm_email: 'Check your email and confirm your address to finish creating your account.',
  reset_sent: 'If an account matches, a password reset link has been sent to its email address.',
} as const

const FIELD_LABELS: Record<Field, string> = {
  username: 'Username',
  email: 'Email',
  password: 'Password',
  confirmPassword: 'Confirm password',
  identifier: 'Username or email',
}

function fieldErrorMessage(e: FieldError): string {
  const label = FIELD_LABELS[e.field]
  switch (e.code) {
    case 'required':
      return `${label} is required.`
    case 'format':
      return 'Username must be 3 to 20 characters: letters, digits and underscores only.'
    case 'invalid':
      return 'Enter a valid email address.'
    case 'too_short':
      return `Password must be at least ${LIMITS.minPassword} characters.`
    case 'mismatch':
      return 'Passwords do not match.'
  }
}

// Registration reports taken values by name; keep the message specific there.
function serviceMessage(error: ServiceError, view: string): string {
  if (error === 'unavailable' && view === 'register') {
    return 'Registration is temporarily unavailable. Please try again.'
  }
  return SERVICE_MESSAGES[error]
}

interface PasswordFieldProps {
  id: string
  name: string
  label: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  maxLength?: number
  autoComplete: string
  invalid: boolean
}

// Visibility is local state; the parent remounts it (via key) on view change.
function PasswordField({ id, name, label, value, onChange, maxLength, autoComplete, invalid }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="auth-modal-field auth-modal-password">
      <label htmlFor={id} className="visually-hidden">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={visible ? 'text' : 'password'}
        className="auth-modal-input"
        placeholder={label}
        value={value}
        onChange={onChange}
        maxLength={maxLength}
        autoComplete={autoComplete}
        aria-invalid={invalid || undefined}
      />
      <button
        type="button"
        className="auth-modal-eye"
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
          {visible && <path d="M3 3l18 18" />}
        </svg>
      </button>
    </div>
  )
}

function SegmentedSwitch({
  view,
  pending,
  onSelect,
}: {
  view: 'login' | 'register'
  pending: boolean
  onSelect: () => void
}) {
  const option = (target: 'login' | 'register', text: string) => (
    <button
      type="button"
      className="auth-modal-switch-option"
      aria-pressed={view === target}
      aria-disabled={pending || undefined}
      onClick={() => {
        if (view !== target) onSelect()
      }}
    >
      <i className="auth-modal-base" aria-hidden="true" />
      {text}
    </button>
  )
  return (
    <div className="auth-modal-switch" role="group" aria-label="Choose form">
      {option('login', 'Login')}
      {option('register', 'Register')}
    </div>
  )
}

export function AuthModal({ state, dispatch, service, onRememberFailed }: AuthModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const uid = useId()
  const open = state.open
  const view = state.open ? state.view : null

  useFocusTrap(dialogRef, open)

  // Focus the first input when the modal opens and whenever the view changes.
  useEffect(() => {
    if (!open) return
    dialogRef.current?.querySelector<HTMLElement>('input:not([type="hidden"])')?.focus()
  }, [open, view])

  // Escape closes the modal.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dispatch({ type: 'CLOSE' })
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, dispatch])

  if (!state.open) return null

  const headingId = `${uid}-heading`
  const subtitleId = `${uid}-subtitle`
  // useId() ids contain colons, which are awkward inside url(#...); strip them.
  const maskId = `${uid.replace(/:/g, '')}-outline-mask`
  const id = (name: string) => `${uid}-${name}`
  const errorsFor = (f: Field) => state.fieldErrors.some((e) => e.field === f)

  const change =
    (field: 'username' | 'email' | 'password' | 'confirmPassword' | 'identifier') =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      dispatch({ type: 'CHANGE', field, value: e.target.value })

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!state.open || state.pending) return

    if (state.view === 'login') {
      const errors = validateLogin(state)
      if (errors.length) return dispatch({ type: 'SUBMIT_INVALID', errors })
      dispatch({ type: 'SUBMIT_START' })
      const r = await service.signIn({
        username: state.username,
        password: state.password,
        remember: state.remember,
      })
      if (!r.ok) return dispatch({ type: 'SUBMIT_FAILED', error: r.error })
      if (r.rememberFailed) onRememberFailed?.()
      dispatch({ type: 'SESSION_CHANGED', authenticated: true })
    } else if (state.view === 'register') {
      const errors = validateRegister(state)
      if (errors.length) return dispatch({ type: 'SUBMIT_INVALID', errors })
      dispatch({ type: 'SUBMIT_START' })
      const r = await service.signUp({
        username: state.username,
        email: state.email,
        password: state.password,
      })
      if (!r.ok) return dispatch({ type: 'SUBMIT_FAILED', error: r.error })
      if (r.confirmationRequired) dispatch({ type: 'CONFIRM_EMAIL' })
      else dispatch({ type: 'SESSION_CHANGED', authenticated: true })
    } else {
      const errors = validateIdentifier(state.identifier)
      if (errors.length) return dispatch({ type: 'SUBMIT_INVALID', errors })
      dispatch({ type: 'SUBMIT_START' })
      const r = await service.requestPasswordReset(state.identifier)
      if (!r.ok) return dispatch({ type: 'SUBMIT_FAILED', error: r.error })
      dispatch({ type: 'RESET_SENT' })
    }
  }

  const textField = (
    name: 'username' | 'email' | 'identifier',
    type: 'text' | 'email',
    value: string,
    extra: { maxLength?: number; autoComplete: string },
  ) => (
    <div className="auth-modal-field">
      <label htmlFor={id(name)} className="visually-hidden">
        {FIELD_LABELS[name]}
      </label>
      <input
        id={id(name)}
        name={name}
        type={type}
        className="auth-modal-input"
        placeholder={FIELD_LABELS[name]}
        value={value}
        onChange={change(name)}
        maxLength={extra.maxLength}
        autoComplete={extra.autoComplete}
        aria-invalid={errorsFor(name) || undefined}
      />
    </div>
  )

  const passwordField = (
    name: 'password' | 'confirmPassword',
    value: string,
    extra: { maxLength?: number; autoComplete: string },
  ) => (
    <PasswordField
      key={`${state.view}-${name}`}
      id={id(name)}
      name={name}
      label={FIELD_LABELS[name]}
      value={value}
      onChange={change(name)}
      maxLength={extra.maxLength}
      autoComplete={extra.autoComplete}
      invalid={errorsFor(name)}
    />
  )

  let heading: string
  let subtitle: string
  let fields: ReactNode
  let submitLabel: string
  let belowSubmit: ReactNode

  if (state.view === 'login') {
    heading = 'Hello, Again!'
    subtitle = 'We are happy to have you back.'
    submitLabel = 'Log in'
    fields = (
      <>
        {textField('username', 'text', state.username, {
          maxLength: LIMITS.loginUsername,
          autoComplete: 'username',
        })}
        {passwordField('password', state.password, {
          maxLength: LIMITS.loginPassword,
          autoComplete: 'current-password',
        })}
        <div className="auth-modal-remember">
          <input
            id={id('remember')}
            type="checkbox"
            checked={state.remember}
            onChange={(e) => dispatch({ type: 'SET_REMEMBER', value: e.target.checked })}
          />
          <label htmlFor={id('remember')}>Remember me</label>
        </div>
      </>
    )
    belowSubmit = (
      <button
        type="button"
        className="auth-modal-link auth-modal-forgot"
        onClick={() => dispatch({ type: 'FORGOT' })}
      >
        Forgot password?
      </button>
    )
  } else if (state.view === 'register') {
    heading = 'Create account'
    subtitle = 'Create your Dyne account.'
    submitLabel = 'Create account'
    fields = (
      <>
        {textField('username', 'text', state.username, { autoComplete: 'username' })}
        {textField('email', 'email', state.email, {
          maxLength: LIMITS.email,
          autoComplete: 'email',
        })}
        {passwordField('password', state.password, { autoComplete: 'new-password' })}
        {passwordField('confirmPassword', state.confirmPassword, { autoComplete: 'new-password' })}
      </>
    )
    belowSubmit = null
  } else {
    heading = 'Reset password'
    subtitle = 'Enter your username or email and we will send a reset link.'
    submitLabel = 'Send reset link'
    fields = textField('identifier', 'text', state.identifier, {
      maxLength: LIMITS.email,
      autoComplete: 'username',
    })
    belowSubmit = (
      <button
        type="button"
        className="auth-modal-link auth-modal-forgot"
        onClick={() => dispatch({ type: 'BACK_TO_LOGIN' })}
      >
        Back to log in
      </button>
    )
  }
  const messages: string[] = [
    ...state.fieldErrors.map(fieldErrorMessage),
    ...(state.serviceError ? [serviceMessage(state.serviceError, state.view)] : []),
  ]

  return createPortal(
    <div
      className="auth-modal-backdrop"
      onClick={() => dispatch({ type: 'CLOSE' })}
    >
      <div className="auth-modal-frame" onClick={(e) => e.stopPropagation()}>
      <div
        ref={dialogRef}
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-describedby={subtitleId}
        onClick={(e) => e.stopPropagation()}
      >
        <svg className="auth-modal-outline" aria-hidden="true" focusable="false">
          <defs>
            <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
              <rect className="auth-modal-outline-reveal" pathLength={1} />
            </mask>
          </defs>
          <rect className="auth-modal-outline-path" mask={`url(#${maskId})`} />
        </svg>
        <button
          type="button"
          className="auth-modal-close"
          aria-label="Close"
          onClick={() => dispatch({ type: 'CLOSE' })}
        >
          ×
        </button>
        <header className="auth-modal-header">
          <svg className="auth-modal-plate" viewBox="0 0 34 34" aria-hidden="true" focusable="false">
            <path d="M5 5h24v13L17 30 5 18z" fill="currentColor" />
          </svg>
          <h2 id={headingId} className="auth-modal-title">
            {heading}
          </h2>
          <p id={subtitleId} className="auth-modal-subtitle">
            {subtitle}
          </p>
        </header>
        <form
          className="auth-modal-form"
          onSubmit={submit}
          noValidate
          aria-busy={state.pending}
        >
          {fields}
          <div className="auth-modal-error" role="alert">
            {messages.map((m) => (
              <p key={m}>{m}</p>
            ))}
          </div>
          {state.notice && (
            <p className="auth-modal-notice" role="status">
              {NOTICE_MESSAGES[state.notice]}
            </p>
          )}
          <button type="submit" className="auth-modal-submit" disabled={state.pending}>
            {submitLabel}
          </button>
          {belowSubmit}
        </form>
        {state.view !== 'forgot' && (
          <SegmentedSwitch
            view={state.view}
            pending={state.pending}
            onSelect={() => dispatch({ type: 'TOGGLE' })}
          />
        )}
      </div>
      </div>
    </div>,
    document.body,
  )
}
