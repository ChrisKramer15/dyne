export interface SubmitButtonProps {
  label: string
  busy: boolean
  /** Login uses the warm gradient; every other form uses the primary one. */
  variant?: 'primary' | 'login'
}

export function SubmitButton({ label, busy, variant = 'primary' }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      className={`btn ${variant === 'login' ? 'btn-login' : 'btn-primary'} auth-submit`}
      disabled={busy}
    >
      {busy ? 'Working…' : label}
    </button>
  )
}
