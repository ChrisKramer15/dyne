import type { LeagueVisibility } from './leagueService'
import { GUILLOTINE_FORMAT } from './leagueValidation'

export const GUILLOTINE_HINT = '6 to 20 teams'

export interface SettingsStepProps {
  /** Selected format name; Guillotine shows the "6 to 20 teams" hint. */
  format: string | null
  /** Raw team count text. */
  teamCount: string
  visibility: LeagueVisibility
  errors: { teamCount?: string; visibility?: string }
  onTeamCountChange: (teamCount: string) => void
  onVisibilityChange: (visibility: LeagueVisibility) => void
}

const VISIBILITY_OPTIONS: readonly { value: LeagueVisibility; label: string }[] = [
  { value: 'private', label: 'Private' },
  { value: 'public', label: 'Public' },
]

/** Settings step: team count (numeric text input) and Private/Public radios. */
export function SettingsStep({
  format,
  teamCount,
  visibility,
  errors,
  onTeamCountChange,
  onVisibilityChange,
}: SettingsStepProps) {
  const isGuillotine = format === GUILLOTINE_FORMAT
  const hintId = 'wizard-field-teamCount-hint'
  const errorId = 'wizard-field-teamCount-error'
  const describedBy = [isGuillotine ? hintId : null, errors.teamCount ? errorId : null]
    .filter(Boolean)
    .join(' ')
  const visibilityErrorId = 'wizard-field-visibility-error'

  return (
    <div className="wizard-fields">
      <div className="wizard-field">
        <label htmlFor="wizard-field-teamCount" className="wizard-label">
          Number of teams
        </label>
        <input
          id="wizard-field-teamCount"
          className="wizard-input"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={teamCount}
          onChange={(e) => onTeamCountChange(e.target.value)}
          aria-invalid={errors.teamCount ? true : undefined}
          aria-describedby={describedBy || undefined}
        />
        {isGuillotine && (
          <p className="wizard-hint" id={hintId}>
            {GUILLOTINE_HINT}
          </p>
        )}
        {errors.teamCount && (
          <p className="wizard-field-error" id={errorId} role="alert">
            {errors.teamCount}
          </p>
        )}
      </div>
      <fieldset
        id="wizard-field-visibility"
        className="wizard-fieldset"
        tabIndex={-1}
        aria-invalid={errors.visibility ? true : undefined}
        aria-describedby={errors.visibility ? visibilityErrorId : undefined}
      >
        <legend className="wizard-legend">League visibility</legend>
        {VISIBILITY_OPTIONS.map((o) => {
          const id = `wizard-visibility-${o.value}`
          return (
            <div className="wizard-option" key={o.value}>
              <input
                type="radio"
                id={id}
                name="league-visibility"
                value={o.value}
                checked={visibility === o.value}
                onChange={() => onVisibilityChange(o.value)}
              />
              <label htmlFor={id}>
                <span className="wizard-option-name">{o.label}</span>
              </label>
            </div>
          )
        })}
        {errors.visibility && (
          <p className="wizard-field-error" id={visibilityErrorId} role="alert">
            {errors.visibility}
          </p>
        )}
      </fieldset>
    </div>
  )
}
