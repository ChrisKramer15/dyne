import { useState, type FormEvent } from 'react'
import { validateLogin, type FieldError } from '../validation'
import { errorFor } from './fieldMessages'
import { SubmitButton } from './SubmitButton'
import { TextField } from './TextField'
import type { FormProps } from './types'
import { useFocusOnMount } from './useFocusOnMount'

interface LoginFormProps extends FormProps {
  /** Shared with the register form so a typed username survives switching. */
  username: string
  onUsernameChange: (value: string) => void
}

export function LoginForm({
  service,
  setBanner,
  onClose,
  onAuthenticated,
  username,
  onUsernameChange,
}: LoginFormProps) {
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [errors, setErrors] = useState<FieldError[]>([])
  const [busy, setBusy] = useState(false)
  const firstField = useFocusOnMount()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBanner(null)

    const found = validateLogin({ username, password })
    setErrors(found)
    if (found.length > 0) return

    setBusy(true)
    const result = await service.signIn({ username, password, remember })
    setBusy(false)

    if (!result.ok) {
      setBanner({
        kind: 'error',
        text:
          result.error === 'invalid_credentials'
            ? 'That username or password is incorrect.'
            : 'Something went wrong. Please try again.',
      })
      return
    }
    onAuthenticated?.()
    if (result.rememberFailed) {
      // Stay open so the notice can be read; the auth state change moves the
      // app to /home, which unmounts this dialog.
      setBanner({ kind: 'success', text: "Signed in. We couldn't keep you logged in on this device." })
      return
    }
    onClose()
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
        label="Password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
        error={errorFor(errors, 'password')}
      />
      <label className="auth-check">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        Keep me logged in
      </label>
      <SubmitButton label="Log in" busy={busy} variant="login" />
    </form>
  )
}
