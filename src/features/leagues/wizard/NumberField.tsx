export interface NumberFieldProps {
  /** Form field name; the input id is `wizard-field-${field}`. */
  field: string
  label: string
  value: string
  error?: string
  /** `numeric` for whole numbers, `decimal` when negatives and fractions are allowed. */
  inputMode: 'numeric' | 'decimal'
  hint?: string
  onChange: (value: string) => void
}

/** Labelled text input for a numeric draft value, with an optional hint and error. */
export function NumberField({ field, label, value, error, inputMode, hint, onChange }: NumberFieldProps) {
  const id = `wizard-field-${field}`
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ')
  return (
    <div className="wizard-field">
      <label htmlFor={id} className="wizard-label">
        {label}
      </label>
      <input
        id={id}
        className="wizard-input"
        type="text"
        inputMode={inputMode}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
      />
      {hint && (
        <p className="wizard-hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="wizard-field-error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
