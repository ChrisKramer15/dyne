import type { StepId } from './leagueDraft'
import type { ReviewGroup } from './reviewSummary'

export interface ReviewStepProps {
  /** Groups from `buildReviewSummary`, in display order. */
  groups: readonly ReviewGroup[]
  /** Called with the owning step; the host dispatches `EDIT_GROUP`. */
  onEdit: (step: StepId) => void
}

/** Review step: a summary of every draft value with an "Edit" control per group. */
export function ReviewStep({ groups, onEdit }: ReviewStepProps) {
  return (
    <dl className="wizard-review">
      {groups.map((g) => {
        const errorId = `wizard-review-${g.field}-error`
        const owner = g.step
        return (
          <div
            className={g.invalid ? 'wizard-review-group wizard-review-group--invalid' : 'wizard-review-group'}
            key={g.field}
            data-field={g.field}
            aria-invalid={g.invalid ? true : undefined}
          >
            <dt className="wizard-review-label">{g.label}</dt>
            <dd className="wizard-review-value">
              <span>{g.value}</span>
              {g.invalid && g.error && (
                <span className="wizard-field-error" id={errorId}>
                  {g.error}
                </span>
              )}
            </dd>
            {owner !== null && (
              <dd className="wizard-review-action">
                <button
                  type="button"
                  className="wizard-edit"
                  onClick={() => onEdit(owner)}
                  aria-label={`Edit ${g.label.toLowerCase()}`}
                  aria-describedby={g.invalid && g.error ? errorId : undefined}
                >
                  Edit
                </button>
              </dd>
            )}
          </div>
        )
      })}
    </dl>
  )
}
