import { ROSTER_POSITIONS } from './leagueCategories'
import type { FieldErrors } from './leagueValidation'
import { rosterField } from './leagueValidation'
import { NumberField } from './NumberField'

export interface RosterStepProps {
  /** Starting slots per position key, as raw input. */
  roster: Record<string, string>
  errors: FieldErrors
  onSlotsChange: (key: string, value: string) => void
}

/** Roster step: number of starting slots for each position. */
export function RosterStep({ roster, errors, onSlotsChange }: RosterStepProps) {
  return (
    <div className="wizard-fields wizard-grid">
      {ROSTER_POSITIONS.map((p) => {
        const field = rosterField(p.key)
        return (
          <NumberField
            key={p.key}
            field={field}
            label={p.label}
            inputMode="numeric"
            value={roster[p.key] ?? ''}
            error={errors[field]}
            onChange={(v) => onSlotsChange(p.key, v)}
          />
        )
      })}
    </div>
  )
}
