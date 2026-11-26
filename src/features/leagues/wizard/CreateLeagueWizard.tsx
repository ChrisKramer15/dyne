import { useEffect, useId, useReducer, useRef } from 'react'
import { GeneralStep } from './GeneralStep'
import { getDefaultLeagueService } from './defaultLeagueService'
import { normalizeDraft, STEPS, toNewLeague } from './leagueDraft'
import { submitLeague } from './leagueService'
import type { LeagueService } from './leagueService'
import { createInitialState, displayedErrors, wizardReducer } from './leagueWizardReducer'
import type { WizardAction, WizardState } from './leagueWizardReducer'
import { RosterStep } from './RosterStep'
import { ScoringStep } from './ScoringStep'
import { statusText } from './stepIndicatorModel'
import { StepIndicator } from './StepIndicator'
import { useFocusOnStepChange } from './useFocusOnStepChange'

export interface CreateLeagueWizardProps {
  /** League_Format name of the card that opened the wizard. */
  format: string
  /** Defaults to the app-wide league service. */
  service?: LeagueService
  /** Called when the wizard closes without creating a league. */
  onClose: () => void
  /** Called with the new league id after a successful submission. */
  onCreated: (leagueId: string) => void
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function reduce(s: WizardState, a: WizardAction): WizardState {
  return wizardReducer(s, a)
}

/** Three-step create-league dialog (General, Roster, Scoring): shell, focus handling, footer and submission. */
export function CreateLeagueWizard({ format, service, onClose, onCreated }: CreateLeagueWizardProps) {
  const [state, dispatch] = useReducer(reduce, format, createInitialState)
  const { step, draft, phase, message } = state
  const busy = phase === 'submitting'
  const confirming = phase === 'confirming-close'
  const stepNumber = STEPS.findIndex((s) => s.id === step) + 1
  const stepTitle = STEPS[stepNumber - 1].title
  const isLast = stepNumber === STEPS.length
  const errors = displayedErrors(state)

  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const messageRef = useRef<HTMLParagraphElement>(null)
  const keepEditingRef = useRef<HTMLButtonElement>(null)
  const lastFocusRef = useRef<HTMLElement | null>(null)
  const prevPhaseRef = useRef(phase)
  const mountedRef = useRef(false)
  const inFlightRef = useRef(false)
  const createdRef = useRef(false)
  const closedNotifiedRef = useRef(false)

  useFocusOnStepChange({ step, focusTarget: state.focusTarget, contentRef, headingRef, messageRef })

  // Unmounted flag; set again on setup so a Strict Mode remount works.
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Submission: one service call per transition to `submitting`.
  useEffect(() => {
    if (phase !== 'submitting' || inFlightRef.current) return
    inFlightRef.current = true
    const svc = service ?? getDefaultLeagueService()
    void submitLeague(svc, toNewLeague(normalizeDraft(draft))).then((result) => {
      inFlightRef.current = false
      if (!mountedRef.current) return
      if (result.ok) {
        createdRef.current = true
        dispatch({ type: 'SUBMIT_SUCCEEDED' })
        onCreated(result.leagueId)
      } else {
        dispatch({ type: 'SUBMIT_FAILED', message: result.message })
      }
    })
  }, [phase, draft, service, onCreated])

  // Closed without creating a league.
  useEffect(() => {
    if (phase !== 'closed' || createdRef.current || closedNotifiedRef.current) return
    closedNotifiedRef.current = true
    onClose()
  }, [phase, onClose])

  // Focus on phase changes: confirmation, back to editing, and while busy.
  useEffect(() => {
    const prev = prevPhaseRef.current
    prevPhaseRef.current = phase
    if (phase === 'confirming-close') {
      keepEditingRef.current?.focus()
    } else if (prev === 'confirming-close' && phase === 'editing') {
      const el = lastFocusRef.current
      if (el?.isConnected) el.focus()
    } else if (phase === 'submitting') {
      dialogRef.current?.focus()
    }
  }, [phase])

  function requestClose() {
    if (phase === 'editing') lastFocusRef.current = document.activeElement as HTMLElement | null
    dispatch({ type: 'REQUEST_CLOSE' })
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      if (confirming) dispatch({ type: 'KEEP_EDITING' })
      else if (!busy) requestClose()
      return
    }
    if (e.key !== 'Tab') return
    const dialog = dialogRef.current
    if (!dialog) return
    const focusable = dialog.querySelectorAll<HTMLElement>(FOCUSABLE)
    if (focusable.length === 0) {
      e.preventDefault()
      dialog.focus()
      return
    }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement
    if (e.shiftKey && (active === first || active === dialog)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const locked = busy || confirming

  return (
    <div
      className="wizard-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy && !confirming) requestClose()
      }}
    >
      <div
        className="wizard-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={busy ? true : undefined}
        tabIndex={-1}
        ref={dialogRef}
        onKeyDown={onKeyDown}
      >
        <div className="wizard-header">
          <h2 className="wizard-title" id={titleId}>
            Create a {format} league
          </h2>
          <button
            type="button"
            className="wizard-close"
            aria-label="Close"
            disabled={locked}
            onClick={requestClose}
          >
            <span aria-hidden="true">Ã—</span>
          </button>
          <StepIndicator step={step} dispatch={dispatch} disabled={locked} />
          <p className="visually-hidden" role="status">
            {statusText(stepNumber)}
          </p>
        </div>

        <div className="wizard-content" ref={contentRef}>
          <p
            className={message !== null && isLast ? 'wizard-message' : 'visually-hidden'}
            role="status"
            tabIndex={-1}
            ref={messageRef}
          >
            {isLast ? message : null}
          </p>

          <h3 className="wizard-step-heading" tabIndex={-1} ref={headingRef}>
            {stepTitle}
          </h3>

          {step === 'general' && (
            <GeneralStep
              format={draft.format}
              name={draft.name}
              teamCount={draft.teamCount}
              errors={errors}
              onNameChange={(name) => dispatch({ type: 'EDIT', patch: { name } })}
              onTeamCountChange={(teamCount) => dispatch({ type: 'EDIT', patch: { teamCount } })}
            />
          )}
          {step === 'roster' && (
            <RosterStep
              roster={draft.roster}
              errors={errors}
              onSlotsChange={(key, value) =>
                dispatch({ type: 'EDIT', patch: { roster: { ...draft.roster, [key]: value } } })
              }
            />
          )}
          {step === 'scoring' && (
            <ScoringStep
              scoring={draft.scoring}
              errors={errors}
              onPointsChange={(key, value) =>
                dispatch({ type: 'EDIT', patch: { scoring: { ...draft.scoring, [key]: value } } })
              }
            />
          )}
        </div>
        {confirming && (
          <div className="wizard-confirm" role="group" aria-label="Discard changes">
            <span>Discard your changes?</span>
            <button type="button" className="btn" onClick={() => dispatch({ type: 'DISCARD' })}>
              Discard
            </button>
            <button
              type="button"
              className="btn btn-primary"
              ref={keepEditingRef}
              onClick={() => dispatch({ type: 'KEEP_EDITING' })}
            >
              Keep editing
            </button>
          </div>
        )}

        <div className="wizard-footer">
          <button
            type="button"
            className="btn"
            disabled={step === STEPS[0].id || locked}
            onClick={() => dispatch({ type: 'BACK' })}
          >
            Back
          </button>
          {isLast ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={locked}
              onClick={() => dispatch({ type: 'SUBMIT' })}
            >
              Create league
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={locked}
              onClick={() => dispatch({ type: 'NEXT' })}
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default CreateLeagueWizard
