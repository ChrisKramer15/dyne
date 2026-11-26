import { GUILLOTINE_FORMAT, GUILLOTINE_MIN_TEAMS, MAX_TEAMS } from './leagueValidation'
import { NumberField } from './NumberField'

export const GUILLOTINE_HINT = `${GUILLOTINE_MIN_TEAMS} to ${MAX_TEAMS} teams`

export interface GeneralStepProps {
  /** Selected format name; Guillotine shows the "6 to 32 teams" hint. */
  format: string
  name: string
  /** Raw team count text. */
  teamCount: string
  /** Validation errors to display (already filtered by the reducer's `attempted` logic). */
  errors: { name?: string; teamCount?: string }
  onNameChange: (name: string) => void
  onTeamCountChange: (teamCount: string) => void
}

/** General step: league name and number of teams. */
export function GeneralStep({
  format,
  name,
  teamCount,
  errors,
  onNameChange,
  onTeamCountChange,
}: GeneralStepProps) {
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
      <NumberField
        field="teamCount"
        label="Number of teams"
        inputMode="numeric"
        value={teamCount}
        error={errors.teamCount}
        hint={format === GUILLOTINE_FORMAT ? GUILLOTINE_HINT : undefined}
        onChange={onTeamCountChange}
      />
    </div>
  )
}
