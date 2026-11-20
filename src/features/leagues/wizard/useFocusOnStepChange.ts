import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type { StepId } from './leagueDraft'
import type { FocusTarget } from './leagueWizardReducer'

export const FIRST_INTERACTIVE_SELECTOR =
  'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

export interface FocusOnStepChangeOptions {
  step: StepId
  /** Set by the reducer; a new object per request, so repeated requests re-focus. */
  focusTarget: FocusTarget
  /** Element containing the step content; searched for the first interactive element on mount. */
  contentRef: RefObject<HTMLElement | null>
  /** Step heading (needs `tabIndex={-1}`); focused after the step changes. */
  headingRef: RefObject<HTMLElement | null>
  /** Submission failure message region (needs `tabIndex={-1}`). */
  messageRef?: RefObject<HTMLElement | null>
}

/**
 * Focus management for the wizard:
 * - on mount, the first interactive element of the content;
 * - when the step changes, the step heading;
 * - when `focusTarget` is set, the targeted field, heading or message;
 * - otherwise (e.g. navigation blocked without a target) focus is left alone.
 */
export function useFocusOnStepChange({
  step,
  focusTarget,
  contentRef,
  headingRef,
  messageRef,
}: FocusOnStepChangeOptions): void {
  const previousStep = useRef<StepId | null>(null)

  useEffect(() => {
    contentRef.current?.querySelector<HTMLElement>(FIRST_INTERACTIVE_SELECTOR)?.focus()
    // Mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (previousStep.current !== null && previousStep.current !== step) {
      headingRef.current?.focus()
    }
    previousStep.current = step
  }, [step, headingRef])

  useEffect(() => {
    if (focusTarget === null) return
    switch (focusTarget.kind) {
      case 'field':
        document.getElementById(`wizard-field-${focusTarget.field}`)?.focus()
        break
      case 'heading':
        headingRef.current?.focus()
        break
      case 'message':
        messageRef?.current?.focus()
        break
    }
  }, [focusTarget, headingRef, messageRef])
}
