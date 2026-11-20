import type { Dispatch } from 'react'
import { STEPS } from './leagueDraft'
import type { StepId } from './leagueDraft'
import type { WizardAction } from './leagueWizardReducer'
import { stepIndicatorModel } from './stepIndicatorModel'

interface StepIndicatorProps {
  step: StepId
  dispatch: Dispatch<WizardAction>
  /** Disables navigation while a submission is in flight. */
  disabled?: boolean
}

export function StepIndicator({ step, dispatch, disabled = false }: StepIndicatorProps) {
  const current = STEPS.findIndex((s) => s.id === step) + 1
  const items = stepIndicatorModel(current)

  return (
    <ol className="wizard-steps" aria-label="Progress">
      {items.map((item) => {
        const id = STEPS[item.number - 1].id
        const classes = [
          'wizard-step',
          item.completed ? 'wizard-step--completed' : '',
          item.current ? 'wizard-step--current' : '',
        ]
          .filter(Boolean)
          .join(' ')
        const label = (
          <>
            <span className="wizard-step-number" aria-hidden="true">
              {item.number}
            </span>
            <span className="wizard-step-title">{item.title}</span>
          </>
        )
        return (
          <li
            key={id}
            className={classes}
            aria-current={item.current ? 'step' : undefined}
          >
            {item.clickable ? (
              <button
                type="button"
                className="wizard-step-button"
                disabled={disabled}
                onClick={() => dispatch({ type: 'GO_TO', step: id })}
              >
                {label}
              </button>
            ) : (
              label
            )}
          </li>
        )
      })}
    </ol>
  )
}
