import { useEffect, useRef, useState, type FormEvent } from 'react'
import Modal from '../../../shared/Modal'
import { SPORTS } from '../../home/homeData'
import { GeneralStep } from './GeneralStep'
import { ScoringStep } from './ScoringStep'
import {
  EMPTY_GENERAL,
  minTeamsFor,
  parseTeamCount,
  validateGeneral,
  type GeneralErrors,
  type GeneralSettings,
} from './generalSettings'
import { getDefaultLeagueService, type LeagueService } from './leagueService'
import { defaultScoring, scoringToNumbers, validateScoring, type ScoringErrors } from './scoringSettings'

export interface CreateLeagueWizardProps {
  /** Sport the league is for, e.g. 'Baseball'. The user picks the format inside the wizard. */
  sport: string
  onClose: () => void
  /** Called with the new league's id once it is saved. The host decides where to go next. */
  onCreated?: (leagueId: string) => void
  /** Saves the league. Defaults to the Supabase-backed service; tests pass a fake. */
  service?: LeagueService
}

// Add new views here, in order, and render them below.
const STEPS = [{ id: 'general', title: 'General Settings' }, { id: 'scoring', title: 'Scoring Settings' }] as const

/** Create-league wizard modal, themed with the chosen format's accent color. */
export default function CreateLeagueWizard({ sport, onClose, onCreated, service }: CreateLeagueWizardProps) {
  const formats = SPORTS.find((s) => s.name === sport)?.formats ?? []
  const [formatName, setFormatName] = useState(() => (formats.find((f) => f.enabled) ?? formats[0])?.name ?? '')
  // The wizard takes its accent color from the chosen format.
  const accent = formats.find((f) => f.name === formatName)?.accent ?? 'cyan'
  const [stepIndex, setStepIndex] = useState(0)
  const [general, setGeneral] = useState<GeneralSettings>(EMPTY_GENERAL)
  const [scoring, setScoring] = useState(defaultScoring)
  const [generalErrors, setGeneralErrors] = useState<GeneralErrors>({})
  const [scoringErrors, setScoringErrors] = useState<ScoringErrors>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const shownStep = useRef(stepIndex)

  const step = STEPS[stepIndex]
  const isLast = stepIndex === STEPS.length - 1

  // Move focus into the new view when the step changes (not on first open).
  useEffect(() => {
    if (shownStep.current === stepIndex) return
    shownStep.current = stepIndex
    bodyRef.current?.querySelector<HTMLElement>('input')?.focus()
  }, [stepIndex])

  // Once errors are showing, keep them current as the user fixes things.
  function updateGeneral(next: GeneralSettings) {
    setGeneral(next)
    setGeneralErrors((prev) => (Object.keys(prev).length ? validateGeneral(next, formatName) : prev))
  }
  function updateScoring(next: Record<string, string>) {
    setScoring(next)
    setScoringErrors((prev) => (Object.keys(prev).length ? validateScoring(next) : prev))
  }

  function focusFirstInvalid() {
    // Wait for the error attributes to render.
    requestAnimationFrame(() => bodyRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
  }

  // Closing mid-save would leave the user unsure whether the league exists.
  function close() {
    if (!saving) onClose()
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (saving) return
    if (step.id === 'general') {
      const found = validateGeneral(general, formatName)
      setGeneralErrors(found)
      if (Object.keys(found).length > 0) {
        if (found.name) nameRef.current?.focus()
        else focusFirstInvalid()
        return
      }
    } else {
      const found = validateScoring(scoring)
      setScoringErrors(found)
      if (Object.keys(found).length > 0) {
        focusFirstInvalid()
        return
      }
    }
    if (!isLast) {
      setStepIndex(stepIndex + 1)
      return
    }
    // Both steps validated, so these are set; this narrows the types.
    const teamCount = parseTeamCount(general.teamCount)
    if (!general.avatarId || teamCount === null) return
    setSaving(true)
    setSaveError(null)
    const result = await (service ?? getDefaultLeagueService()).createLeague({
      format: formatName,
      name: general.name.trim(),
      avatarId: general.avatarId,
      teamCount,
      scoring: scoringToNumbers(scoring),
    })
    if (result.ok) {
      onCreated?.(result.id)
      return
    }
    setSaving(false)
    setSaveError(result.reason)
  }

  return (
    <div className={`league-wizard accent-${accent}`}>
      <Modal title={step.title} onClose={close}>
        <p className="modal-subtitle">
          New {formatName} {sport} league · Step {stepIndex + 1} of {STEPS.length}
        </p>
        <form onSubmit={onSubmit} noValidate className="wizard-form" aria-busy={saving}>
          <div ref={bodyRef}>
            {step.id === 'general' && (
              <GeneralStep
                value={general}
                onChange={updateGeneral}
                errors={generalErrors}
                nameRef={nameRef}
                minTeams={minTeamsFor(formatName)}
                formats={formats}
                format={formatName}
                onFormatChange={(name) => {
                  setFormatName(name)
                  setGeneralErrors((prev) => (Object.keys(prev).length ? validateGeneral(general, name) : prev))
                }}
              />
            )}
            {step.id === 'scoring' && <ScoringStep value={scoring} onChange={updateScoring} errors={scoringErrors} />}
          </div>
          {saveError && (
            <p className="auth-banner auth-banner-error wizard-save-error" role="alert">
              {saveError}
            </p>
          )}
          <div className="modal-actions">
            {stepIndex === 0 ? (
              <button type="button" className="modal-button" onClick={close}>
                Cancel
              </button>
            ) : (
              <button
                type="button"
                className="modal-button"
                disabled={saving}
                onClick={() => {
                  setSaveError(null)
                  setStepIndex(stepIndex - 1)
                }}
              >
                Back
              </button>
            )}
            <button type="submit" className="modal-button wizard-primary" disabled={saving}>
              {saving ? 'Creating…' : isLast ? 'Finish' : 'Next'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
