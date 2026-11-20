export interface DetailsStepProps {
  name: string
  description: string
  /** Validation errors to display (already filtered by the reducer's `attempted` logic). */
  errors: { name?: string; description?: string }
  onNameChange: (name: string) => void
  onDescriptionChange: (description: string) => void
}

/** Details step: league name input and optional description textarea. */
export function DetailsStep({
  name,
  description,
  errors,
  onNameChange,
  onDescriptionChange,
}: DetailsStepProps) {
  return (
    <div className="wizard-fields">
      <div className="wizard-field">
        <label htmlFor="wizard-field-name" className="wizard-label">
          League name
        </label>
        <input
          id="wizard-field-name"
          className="wizard-input"
          type="text"
          autoComplete="off"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? 'wizard-field-name-error' : undefined}
        />
        {errors.name && (
          <p className="wizard-field-error" id="wizard-field-name-error" role="alert">
            {errors.name}
          </p>
        )}
      </div>
      <div className="wizard-field">
        <label htmlFor="wizard-field-description" className="wizard-label">
          Description (optional)
        </label>
        <textarea
          id="wizard-field-description"
          className="wizard-input wizard-textarea"
          rows={4}
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={errors.description ? 'wizard-field-description-error' : undefined}
        />
        {errors.description && (
          <p className="wizard-field-error" id="wizard-field-description-error" role="alert">
            {errors.description}
          </p>
        )}
      </div>
    </div>
  )
}
