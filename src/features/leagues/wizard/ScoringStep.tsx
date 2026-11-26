import { useId } from 'react'
import {
  SCORING_CATEGORIES,
  defaultScoring,
  type ScoringErrors,
  type ScoringStat,
  type ScoringValues,
} from './scoringSettings'

export interface ScoringStepProps {
  value: ScoringValues
  onChange: (next: ScoringValues) => void
  /** Errors keyed by stat key. Empty until the user tries to continue. */
  errors: ScoringErrors
}

function ScoringRow({
  stat,
  value,
  error,
  onChange,
}: {
  stat: ScoringStat
  value: string
  error?: string
  onChange: (v: string) => void
}) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <div className="scoring-row">
      <label className="scoring-label" htmlFor={id}>
        <span>
          {stat.label} <span className="scoring-abbr">({stat.abbr})</span>
        </span>
        {stat.note && <span className="scoring-note">{stat.note}</span>}
      </label>
      <input
        id={id}
        className="auth-input scoring-input"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {error && (
        <p className="modal-error scoring-error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

/** Step 2: points per stat for hitting, pitching and fielding. Starts from common defaults. */
export function ScoringStep({ value, onChange, errors }: ScoringStepProps) {
  return (
    <>
      <p className="modal-text wizard-intro">
        Points awarded for each stat. Use negative numbers to subtract points and decimals such as 0.5 for partial
        points.
      </p>
      {SCORING_CATEGORIES.map((c) => (
        <fieldset key={c.id} className="scoring-group">
          <legend className="scoring-legend">{c.title}</legend>
          {c.stats.map((s) => (
            <ScoringRow
              key={s.key}
              stat={s}
              value={value[s.key] ?? ''}
              error={errors[s.key]}
              onChange={(v) => onChange({ ...value, [s.key]: v })}
            />
          ))}
        </fieldset>
      ))}
      <button type="button" className="modal-button scoring-reset" onClick={() => onChange(defaultScoring())}>
        Reset to defaults
      </button>
    </>
  )
}
