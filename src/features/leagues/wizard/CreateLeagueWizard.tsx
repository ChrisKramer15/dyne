import { useRef, useState, type FormEvent } from 'react'
import Modal from '../../../shared/Modal'
import { GeneralStep } from './GeneralStep'
import { EMPTY_GENERAL, validateGeneral, type GeneralErrors, type GeneralSettings } from './generalSettings'

/** The league format the user clicked. `accent` is a class suffix from App.css (accent-green, ...). */
export interface WizardFormat {
  name: string
  sport: string
  accent: string
}

export interface CreateLeagueWizardProps {
  format: WizardFormat
  onClose: () => void
  /** Called with the validated General Settings when the user continues. Later steps will hook in here. */
  onNext?: (general: GeneralSettings) => void
}

/**
 * Create-league wizard modal, themed with the chosen format's accent color.
 * Only the General Settings view exists so far.
 */
export default function CreateLeagueWizard({ format, onClose, onNext }: CreateLeagueWizardProps) {
  const [general, setGeneral] = useState<GeneralSettings>(EMPTY_GENERAL)
  const [errors, setErrors] = useState<GeneralErrors>({})
  const nameRef = useRef<HTMLInputElement>(null)

  function update(next: GeneralSettings) {
    setGeneral(next)
    // Once errors are showing, keep them current as the user fixes things.
    setErrors((prev) => (Object.keys(prev).length ? validateGeneral(next) : prev))
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const found = validateGeneral(general)
    setErrors(found)
    if (found.name) {
      nameRef.current?.focus()
      return
    }
    if (Object.keys(found).length === 0) onNext?.({ ...general, name: general.name.trim() })
  }

  return (
    <div className={`league-wizard accent-${format.accent}`}>
      <Modal title="General Settings" onClose={onClose}>
        <p className="modal-subtitle">
          New {format.name} {format.sport} league
        </p>
        <form onSubmit={onSubmit} noValidate className="wizard-form">
          <GeneralStep value={general} onChange={update} errors={errors} nameRef={nameRef} />
          <div className="modal-actions">
            <button type="button" className="modal-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="modal-button wizard-primary">
              Next
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
