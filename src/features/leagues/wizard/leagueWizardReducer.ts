import { initialDraft, isDirty, STEPS } from './leagueDraft'
import type { LeagueDraft, StepId } from './leagueDraft'
import { FIELD_ORDER, firstInvalidStep, validateStep } from './leagueValidation'
import type { FieldErrors, FieldName } from './leagueValidation'

export type WizardPhase = 'editing' | 'confirming-close' | 'submitting' | 'closed'

export type FocusTarget =
  | { kind: 'field'; field: FieldName }
  | { kind: 'heading' }
  | { kind: 'message' }
  | null

export interface WizardState {
  step: StepId
  draft: LeagueDraft
  /** Draft at open time, used for the dirty check. */
  initial: LeagueDraft
  /** Steps where the user tried to advance or submit; their errors are displayed. */
  attempted: ReadonlySet<StepId>
  phase: WizardPhase
  /** Submission failure message. */
  message: string | null
  /** Consumed by the UI focus effect. */
  focusTarget: FocusTarget
}

export type WizardAction =
  | { type: 'EDIT'; patch: Partial<LeagueDraft> }
  | { type: 'SELECT_FORMAT'; format: string }
  | { type: 'NEXT' }
  | { type: 'BACK' }
  | { type: 'GO_TO'; step: StepId }
  | { type: 'EDIT_GROUP'; step: StepId }
  | { type: 'SUBMIT' }
  | { type: 'SUBMIT_SUCCEEDED' }
  | { type: 'SUBMIT_FAILED'; message: string }
  | { type: 'REQUEST_CLOSE' }
  | { type: 'KEEP_EDITING' }
  | { type: 'DISCARD' }

export function createInitialState(format: string): WizardState {
  const initial = initialDraft(format)
  return {
    step: 'format',
    draft: initial,
    initial,
    attempted: new Set<StepId>(),
    phase: 'editing',
    message: null,
    focusTarget: null,
  }
}

function indexOf(step: StepId): number {
  return STEPS.findIndex((s) => s.id === step)
}

function moveTo(s: WizardState, step: StepId): WizardState {
  return { ...s, step, focusTarget: { kind: 'heading' } }
}

function firstInvalidField(errors: FieldErrors, step: StepId): FocusTarget {
  const field = FIELD_ORDER[step].find((f) => errors[f] !== undefined)
  return field ? { kind: 'field', field } : null
}

function withAttempted(s: WizardState, step: StepId, add: boolean): ReadonlySet<StepId> {
  const next = new Set(s.attempted)
  if (add) next.add(step)
  else next.delete(step)
  return next
}

function editing(
  s: WizardState,
  a: WizardAction,
  formats?: readonly string[],
): WizardState {
  switch (a.type) {
    case 'EDIT':
      return { ...s, draft: { ...s.draft, ...a.patch }, focusTarget: null }
    case 'SELECT_FORMAT':
      return { ...s, draft: { ...s.draft, format: a.format }, focusTarget: null }
    case 'NEXT': {
      if (s.step === 'review') return s
      const errors = validateStep(s.draft, s.step, formats)
      if (Object.keys(errors).length > 0) {
        return {
          ...s,
          attempted: withAttempted(s, s.step, true),
          focusTarget: firstInvalidField(errors, s.step),
        }
      }
      return {
        ...moveTo(s, STEPS[indexOf(s.step) + 1].id),
        attempted: withAttempted(s, s.step, false),
      }
    }
    case 'BACK': {
      const i = indexOf(s.step)
      return i === 0 ? s : moveTo(s, STEPS[i - 1].id)
    }
    case 'GO_TO':
      return indexOf(a.step) < indexOf(s.step) ? moveTo(s, a.step) : s
    case 'EDIT_GROUP':
      return s.step === 'review' && a.step !== 'review' ? moveTo(s, a.step) : s
    case 'SUBMIT': {
      if (s.step !== 'review') return s
      const invalid = firstInvalidStep(s.draft, formats)
      if (invalid === null) {
        return { ...s, message: null, phase: 'submitting', focusTarget: null }
      }
      return {
        ...s,
        step: invalid,
        attempted: withAttempted(s, invalid, true),
        focusTarget: firstInvalidField(validateStep(s.draft, invalid, formats), invalid),
      }
    }
    case 'REQUEST_CLOSE':
      return isDirty(s.draft, s.initial)
        ? { ...s, phase: 'confirming-close', focusTarget: null }
        : { ...s, phase: 'closed', focusTarget: null }
    default:
      return s
  }
}

export function wizardReducer(
  s: WizardState,
  a: WizardAction,
  formats?: readonly string[],
): WizardState {
  switch (s.phase) {
    case 'closed':
      return s
    case 'submitting':
      if (a.type === 'SUBMIT_SUCCEEDED') return { ...s, phase: 'closed', focusTarget: null }
      if (a.type === 'SUBMIT_FAILED') {
        return {
          ...s,
          step: 'review',
          phase: 'editing',
          message: a.message,
          focusTarget: { kind: 'message' },
        }
      }
      return s
    case 'confirming-close':
      if (a.type === 'KEEP_EDITING') return { ...s, phase: 'editing', focusTarget: null }
      if (a.type === 'DISCARD') return { ...s, phase: 'closed', focusTarget: null }
      return s
    case 'editing':
      return editing(s, a, formats)
  }
}

/** Errors to display: only for steps the user has tried to leave, always live. */
export function displayedErrors(s: WizardState, formats?: readonly string[]): FieldErrors {
  return s.attempted.has(s.step) ? validateStep(s.draft, s.step, formats) : {}
}
