import { useState, type FormEvent } from 'react'
import { validateIdentifier, type FieldError } from '../validation'
import { errorFor } from './fieldMessages'
import { SubmitButton } from './SubmitButton'
import { TextField } from './TextField'
import type { FormProps } from './types'
import { useFocusOnMount } from './useFocusOnMount'

export function ResetForm({ service, setBanner }: Pick<FormProps, 'service' | 'setBanner'>) {
  const [identifier, setIdentifier] = useState('')
  const [errors, setErrors] = useState<FieldError[]>([])
  const [busy, setBusy] = useState(false)
  const firstField = useFocusOnMount()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBanner(null)

    const found = validateIdentifier(identifier)
    setErrors(found)
    if (found.length > 0) return

    setBusy(true)
    const result = await service.requestPasswordReset(identifier)
    setBusy(false)

    setBanner(
      result.ok
        ? { kind: 'success', text: 'If an account matches that, we’ve sent a reset link.' }
        : { kind: 'error', text: 'Something went wrong. Please try again.' },
    )
  }

  return (
    <form className="auth-form" onSubmit={onSubmit} noValidate>
      <TextField
        label="Username or email"
        autoComplete="username"
        inputRef={firstField}
        value={identifier}
        onChange={setIdentifier}
        error={errorFor(errors, 'identifier')}
      />
      <SubmitButton label="Send reset link" busy={busy} />
    </form>
  )
}
