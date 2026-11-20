import { FORMAT_OPTIONS, NO_FORMATS_MESSAGE, type FormatOption } from './formatOptions'

export interface FormatStepProps {
  /** Currently selected format name, or null. */
  selected: string | null
  onSelect: (format: string) => void
  /** Validation error for the format field, if any. */
  error?: string
  /** Overridable for tests; defaults to the formats in `SPORTS`. */
  formats?: readonly FormatOption[]
}

/** Format step: one native radio per league format, with its name and tagline. */
export function FormatStep({ selected, onSelect, error, formats = FORMAT_OPTIONS }: FormatStepProps) {
  const errorId = 'wizard-field-format-error'
  return (
    <fieldset
      id="wizard-field-format"
      className="wizard-fieldset"
      tabIndex={-1}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
    >
      <legend className="wizard-legend">League format</legend>
      {formats.length === 0 ? (
        <p className="wizard-empty" role="status">
          {NO_FORMATS_MESSAGE}
        </p>
      ) : (
        formats.map((f) => {
          const id = `wizard-format-${f.name}`
          return (
            <div className="wizard-option" key={f.name}>
              <input
                type="radio"
                id={id}
                name="league-format"
                value={f.name}
                checked={selected === f.name}
                onChange={() => onSelect(f.name)}
                aria-describedby={`${id}-tagline`}
              />
              <label htmlFor={id}>
                <span className="wizard-option-name">{f.name}</span>
                <span className="wizard-option-tagline" id={`${id}-tagline`}>
                  {f.tagline}
                </span>
              </label>
            </div>
          )
        })
      )}
      {error && (
        <p className="wizard-field-error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </fieldset>
  )
}
