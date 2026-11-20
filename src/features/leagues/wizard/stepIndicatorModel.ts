import { STEPS, TOTAL_STEPS } from './leagueDraft'

export interface IndicatorItem {
  number: number
  title: string
  completed: boolean
  current: boolean
  clickable: boolean
}

/** Builds the indicator items for a 1-based current step number. */
export function stepIndicatorModel(current: number): IndicatorItem[] {
  return STEPS.map((step, i) => {
    const number = i + 1
    const completed = number < current
    return {
      number,
      title: step.title,
      completed,
      current: number === current,
      clickable: completed,
    }
  })
}

/** Status text such as "Step 2 of 3: Details". */
export function statusText(current: number): string {
  const title = STEPS[current - 1]?.title ?? ''
  return `Step ${current} of ${TOTAL_STEPS}: ${title}`
}
