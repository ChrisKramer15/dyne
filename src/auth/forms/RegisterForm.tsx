import { useState, type FormEvent } from 'react'
import { validateRegister, type FieldError } from '../validation'
import { errorFor } from './fieldMessages'
import { SubmitButton } from './SubmitButton'
import { TextField } from './TextField'
import type { FormProps } from './types'
import { useFocusOnMount } from './useFocusOnMount'

interface RegisterFormProps extends Pick<FormProps, 'service' | 'setBanner'> {
  /** Shared with the login form so a typed username survives switching. */
  username: string
  onUsernameChange: (value: string) => void
}

export function RegisterForm({ service, setBanner, username, onUsernameChange }: RegisterFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<FieldError[]>([])
  const [busy, setBusy] = useState(false)
  const firstField = useFocusOnMount()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBanner(null)

    const found = validateRegister({ username, email, password, confirmPassword })
    setErrors(found)
    if (found.length > 0) return

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
    } else if (result.error === 'username_taken') {
      setErrors([{ field: 'username', code: 'taken' }])
      setBanner({ kind: 'error', text: 'That username is already taken.' })
    } else if (result.error === 'email_taken') {
      setErrors([{ field: 'email', code: 'taken' }])
      setBanner({ kind: 'error', text: 'That email is already registered.' })
    } else {
      setBanner({ kind: 'error', text: 'Something went wrong. Please try again.' })
    }
  }

  return (
    <form className="auth-form" onSubmit={onSubmit} noValidate>
      <TextField
        label="Username"
        autoComplete="username"
        inputRef={firstField}
        value={username}
        onChange={onUsernameChange}
        error={errorFor(errors, 'username')}
      />
      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={setEmail}
        error={errorFor(errors, 'email')}
      />
      <TextField
        label="Password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={setPassword}
        error={errorFor(errors, 'password')}
      />
      <TextField
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        error={errorFor(errors, 'confirmPassword')}
      />
      <SubmitButton label="Create account" busy={busy} />
    </form>
  )
}
