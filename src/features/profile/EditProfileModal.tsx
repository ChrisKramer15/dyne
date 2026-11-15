import { useId, useState, type FormEvent } from 'react'
import Modal from '../../shared/Modal'
import type { AuthService } from '../../auth/authService'
import { isValidEmail } from '../../auth/validation'
import { ACCENT_COLORS, accentCss, type AccentColor } from './accentColor'

export interface EditProfileModalProps {
  email: string
  service: AuthService
  accent: AccentColor | null
  onAccentChange: (id: string) => void
  onClose: () => void
}

type EmailStatus =
  | { kind: 'idle' }
  | { kind: 'invalid' }
  | { kind: 'taken' }
  | { kind: 'failed' }
  | { kind: 'sent'; to: string }

const ERROR_TEXT = {
  invalid: 'Enter a valid email address.',
  taken: 'That email is already in use.',
  failed: 'Couldn’t update your email. Please try again.',
} as const

/** Edit the email address and pick the neon accent color. */
export default function EditProfileModal({ email, service, accent, onAccentChange, onClose }: EditProfileModalProps) {
  const emailId = useId()
  const errorId = useId()
  const [value, setValue] = useState(email)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<EmailStatus>({ kind: 'idle' })

  const trimmed = value.trim()
  const unchanged = trimmed.toLowerCase() === email.toLowerCase()
  const error = status.kind === 'invalid' || status.kind === 'taken' || status.kind === 'failed' ? status.kind : null

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy || unchanged) return
    if (!isValidEmail(trimmed)) {
      setStatus({ kind: 'invalid' })
      return
    }
    setBusy(true)
    setStatus({ kind: 'idle' })
    try {
      const result = await service.updateEmail(trimmed)
      setStatus(result.ok ? { kind: 'sent', to: trimmed } : { kind: result.error === 'email_taken' ? 'taken' : 'failed' })
    } catch {
      setStatus({ kind: 'failed' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Edit profile" onClose={onClose}>
      <form onSubmit={onSubmit} noValidate>
        <label className="auth-label" htmlFor={emailId}>
          Email
        </label>
        <input
          id={emailId}
          className="auth-input"
          type="email"
          autoComplete="email"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setStatus({ kind: 'idle' })
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        {error && (
          <p className="modal-error" id={errorId} role="alert">
            {ERROR_TEXT[error]}
          </p>
        )}
        {status.kind === 'sent' && (
          <p className="modal-text" role="status">
            We sent a confirmation link to {status.to}. Your email changes once you open it.
          </p>
        )}
        <div className="modal-actions">
          <button type="submit" className="modal-button" disabled={busy || unchanged}>
            {busy ? 'Saving…' : 'Save email'}
          </button>
        </div>
      </form>

      <h3 className="modal-section">Primary color</h3>
      <ul className="color-grid">
        {ACCENT_COLORS.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className="color-swatch"
              aria-label={c.label}
              aria-pressed={accent?.id === c.id}
              style={{ background: accentCss(c.hue) }}
              onClick={() => onAccentChange(c.id)}
            />
          </li>
        ))}
      </ul>
    </Modal>
  )
}
