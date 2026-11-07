import { useEffect, useRef } from 'react'
import { useMatches } from 'react-router'
import type { DyneRouteHandle } from './decideRoute'

const RECOVERY_KEY = 'recovery'
const DIALOG_SELECTOR = '[role="dialog"]'

export interface RouteEffectsProps {
  /** Identifies the settled view; effects run once per distinct key. */
  settledKey: string
}

/**
 * After a view settles, sets document.title and moves focus to the first
 * `main h1`. Skips repeated keys and defers while a dialog is open.
 */
export function RouteEffects({ settledKey }: RouteEffectsProps) {
  const matches = useMatches()
  const handle = matches.at(-1)?.handle as DyneRouteHandle | undefined
  const routeTitle = handle?.title
  const lastHandled = useRef<string | null>(null)

  useEffect(() => {
    if (lastHandled.current === settledKey) return

    const apply = (): boolean => {
      if (document.querySelector(DIALOG_SELECTOR)) return false
      const isLanding = settledKey === RECOVERY_KEY || !routeTitle || routeTitle === 'Dyne'
      document.title = isLanding ? 'Dyne' : `${routeTitle} – Dyne`
      document.querySelector<HTMLElement>('main h1')?.focus()
      lastHandled.current = settledKey
      return true
    }

    if (apply()) return

    // A dialog is open: retry once it leaves the document.
    const observer = new MutationObserver(() => {
      if (apply()) observer.disconnect()
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [settledKey, routeTitle])

  return null
}
