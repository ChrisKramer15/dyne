import { useCallback, useMemo, useState } from 'react'

export type NavTarget = 'login' | 'register'

const PATHS: Record<NavTarget, string> = {
  login: '/login',
  register: '/register',
}

/** Default navigation: full page load of the target path. */
export function defaultNavigate(target: NavTarget): void {
  window.location.assign(PATHS[target])
}

/**
 * Wraps `navigate` so activations for the same target within `windowMs` of the
 * last accepted activation are ignored. The clock is injectable for tests.
 */
export function createNavigationGuard(
  navigate: (target: NavTarget) => void,
  windowMs = 1000,
  now: () => number = Date.now,
): (target: NavTarget) => void {
  const lastAccepted: Partial<Record<NavTarget, number>> = {}
  return (target) => {
    const t = now()
    const last = lastAccepted[target]
    if (last !== undefined && t - last < windowMs) return
    lastAccepted[target] = t
    navigate(target)
  }
}

export function useNavigationGuard(
  navigate: (target: NavTarget) => void = defaultNavigate,
): { guardedNavigate: (target: NavTarget) => void; error: string | null } {
  const [error, setError] = useState<string | null>(null)

  const safeNavigate = useCallback(
    (target: NavTarget) => {
      try {
        navigate(target)
        setError(null)
      } catch {
        setError(`Could not open the ${target} page.`)
      }
    },
    [navigate],
  )

  const guardedNavigate = useMemo(
    () => createNavigationGuard(safeNavigate),
    [safeNavigate],
  )

  return { guardedNavigate, error }
}
