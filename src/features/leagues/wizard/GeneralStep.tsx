import { useId, type Ref } from 'react'
import { LEAGUE_NAME_MAX, MAX_TEAMS, type GeneralErrors, type GeneralSettings } from './generalSettings'
import { LEAGUE_AVATARS } from './leagueAvatars'

export interface GeneralStepProps {
  value: GeneralSettings
  onChange: (next: GeneralSettings) => void
  /** Errors to display. Empty until the user tries to continue. */
  errors: GeneralErrors
  nameRef?: Ref<HTMLInputElement>
  /** Lowest allowed team count for this format. */
  minTeams: number
  /** Formats offered for the sport. Ones that are not enabled show as coming soon and cannot be picked. */
  formats: readonly { name: string; enabled: boolean }[]
  format: string
  onFormatChange: (name: string) => void
}

/** Step 1: league format, name, team count and avatar. */
export function GeneralStep({ value, onChange, errors, nameRef, minTeams, formats, format, onFormatChange }: GeneralStepProps) {
  const formatId = useId()
  const nameId = useId()
  const nameErrorId = `${nameId}-error`
  const teamsId = useId()
  const teamsErrorId = `${teamsId}-error`
  const teamsHintId = `${teamsId}-hint`
  const avatarErrorId = useId()
  const groupName = useId()

  return (
    <>
      <label className="auth-label" htmlFor={formatId}>
        League format
      </label>
      <select id={formatId} className="auth-input" value={format} onChange={(e) => onFormatChange(e.target.value)}>
        {formats.map((f) => (
          <option key={f.name} value={f.name} disabled={!f.enabled}>
            {f.enabled ? f.name : `${f.name} (coming soon)`}
          </option>
        ))}
      </select>
      <label className="auth-label" htmlFor={nameId}>
        League name <span className="wizard-required">(required)</span>
      </label>
      <input
        id={nameId}
        ref={nameRef}
        className="auth-input"
        type="text"
        autoComplete="off"
        maxLength={LEAGUE_NAME_MAX}
        required
        value={value.name}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
        aria-invalid={errors.name ? true : undefined}
        aria-describedby={errors.name ? nameErrorId : undefined}
      />
      {errors.name && (
        <p className="modal-error" id={nameErrorId} role="alert">
          {errors.name}
        </p>
      )}

      <label className="auth-label" htmlFor={teamsId}>
        Number of teams <span className="wizard-required">(required)</span>
      </label>
      <input
        id={teamsId}
        className="auth-input wizard-teams"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        required
        value={value.teamCount}
        onChange={(e) => onChange({ ...value, teamCount: e.target.value })}
        aria-invalid={errors.teamCount ? true : undefined}
        aria-describedby={errors.teamCount ? `${teamsHintId} ${teamsErrorId}` : teamsHintId}
      />
      <p className="wizard-hint" id={teamsHintId}>
        {minTeams} to {MAX_TEAMS} teams.
      </p>
      {errors.teamCount && (
        <p className="modal-error" id={teamsErrorId} role="alert">
          {errors.teamCount}
        </p>
      )}

      <fieldset className="wizard-avatars" aria-describedby={errors.avatarId ? avatarErrorId : undefined}>
        <legend className="auth-label">
          League avatar <span className="wizard-required">(required)</span>
        </legend>
        <div className="avatar-grid">
          {LEAGUE_AVATARS.map((a) => (
            <label key={a.id} className="avatar-option" title={a.label}>
              <input
                type="radio"
                name={groupName}
                className="avatar-input"
                value={a.id}
                checked={value.avatarId === a.id}
                onChange={() => onChange({ ...value, avatarId: a.id })}
                aria-label={a.label}
              />
              <span className="avatar-face" aria-hidden="true">
                {a.emoji}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {errors.avatarId && (
        <p className="modal-error" id={avatarErrorId} role="alert">
          {errors.avatarId}
        </p>
      )}
    </>
  )
}
