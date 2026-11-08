import { useId, type Ref } from 'react'
import type { FieldError } from '../validation'
import { messageFor } from './fieldMessages'

export interface TextFieldProps {
  label: string
  type?: 'text' | 'email' | 'password'
  autoComplete: string
  value: string
  onChange: (value: string) => void
  /** Validation error for this field, if any. */
  error?: FieldError
  inputRef?: Ref<HTMLInputElement>
}

/** Label, input and inline error, wired together for assistive tech. */
export function TextField({
  label,
  type = 'text',
  autoComplete,
  value,
  onChange,
  error,
  inputRef,
}: TextFieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <>
      <label className="auth-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="auth-input"
        type={type}
        autoComplete={autoComplete}
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {error && (
        <span className="auth-field-error" id={errorId} role="alert">
          {messageFor(error)}
        </span>
      )}
    </>
  )
}
