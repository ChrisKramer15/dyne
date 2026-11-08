import { useState, type FormEvent } from 'react'
import { validateUpdatePassword, type FieldError } from '../validation'
import { errorFor } from './fieldMessages'
import { SubmitButton } from './SubmitButton'
import { TextField } from './TextField'
import type { FormProps } from './types'
import { useFocusOnMount } from './useFocusOnMount'

/** Shown after a reset link: set a new password for the recovery session. */
export function UpdatePasswordForm({ service, setBanner, onClose, onAuthenticated }: FormProps) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<FieldError[]>([])
  const [busy, setBusy] = useState(false)
  const firstField = useFocusOnMount()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBanner(null)

    const found = validateUpdatePassword({ newPassword, confirmPassword })
    setErrors(found)
    if (found.length > 0) return

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

  return (
    <form className="auth-form" onSubmit={onSubmit} noValidate>
      <TextField
        label="New password"
        type="password"
        autoComplete="new-password"
        inputRef={firstField}
        value={newPassword}
        onChange={setNewPassword}
        error={errorFor(errors, 'newPassword')}
      />
      <TextField
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        error={errorFor(errors, 'confirmPassword')}
      />
      <SubmitButton label="Save new password" busy={busy} />
    </form>
  )
}
