import { useId, type Ref } from 'react'
import { LEAGUE_NAME_MAX, type GeneralErrors, type GeneralSettings } from './generalSettings'
import { LEAGUE_AVATARS } from './leagueAvatars'

export interface GeneralStepProps {
  value: GeneralSettings
  onChange: (next: GeneralSettings) => void
  /** Errors to display. Empty until the user tries to continue. */
  errors: GeneralErrors
  nameRef?: Ref<HTMLInputElement>
}

/** Step 1: league name and avatar. Both are required. */
export function GeneralStep({ value, onChange, errors, nameRef }: GeneralStepProps) {
  const nameId = useId()
  const nameErrorId = `${nameId}-error`
  const avatarErrorId = useId()
  const groupName = useId()

  return (
    <>
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
