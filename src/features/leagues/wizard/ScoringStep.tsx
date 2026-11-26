import { categoriesFor, SCORING_GROUPS } from './leagueCategories'
import type { FieldErrors } from './leagueValidation'
import { scoringField } from './leagueValidation'
import { NumberField } from './NumberField'

export interface ScoringStepProps {
  /** Points per unit per category key, as raw input. */
  scoring: Record<string, string>
  errors: FieldErrors
  onPointsChange: (key: string, value: string) => void
}

/** Scoring step: points per unit for every hitting, pitching and fielding category. */
export function ScoringStep({ scoring, errors, onPointsChange }: ScoringStepProps) {
  return (
    <div className="wizard-fields">
      <p className="wizard-hint">Points awarded per unit. Use a negative number to deduct points.</p>
      {SCORING_GROUPS.map((group) => (
        <fieldset className="wizard-fieldset" key={group}>
          <legend className="wizard-legend">{group}</legend>
          <div className="wizard-grid">
            {categoriesFor(group).map((c) => {
              const field = scoringField(c.key)
              return (
                <NumberField
                  key={c.key}
                  field={field}
                  label={`${c.label} (${c.abbr})`}
                  inputMode="decimal"
                  value={scoring[c.key] ?? ''}
                  error={errors[field]}
                  onChange={(v) => onPointsChange(c.key, v)}
                />
              )
            })}
          </div>
        </fieldset>
      ))}
    </div>
  )
}
