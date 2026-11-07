import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import Backdrop from './Backdrop'
import { formatWelcome } from './auth/displayName'
import { createAuthService, type AuthService } from './auth/authService'
import { supabase, authStorage } from './supabase'

export interface HomepageProps {
  userMetadata: unknown
  /** Injectable for tests; defaults to the real Supabase-backed service. */
  authService?: AuthService
  /** Injectable for tests; defaults to 10_000. */
  signOutTimeoutMs?: number
}

const SIGN_OUT_ERROR = 'Sign out failed. Please try again.'

export default function Homepage({
  userMetadata,
  authService,
  signOutTimeoutMs = 10_000,
}: HomepageProps) {
  const inFlight = useRef(false)
  const mounted = useRef(true)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Built lazily so importing this component never initialises Supabase
  // when a test injects its own service.
  const service = useMemo<AuthService>(
    () => authService ?? createAuthService(supabase, authStorage),
    [authService],
  )

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  async function handleSignOut() {
    if (inFlight.current) return
    inFlight.current = true
    setError(null)
    setSigningOut(true)

    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Sign out timed out')), signOutTimeoutMs)
      })
      // Attach a no-op catch so a late rejection after the race is not unhandled.
      const request = Promise.resolve().then(() => service.signOut())
      request.catch(() => {})
      await Promise.race([request, timeout])
    } catch {
      if (mounted.current) setError(SIGN_OUT_ERROR)
    } finally {
      clearTimeout(timer)
      inFlight.current = false
      if (mounted.current) setSigningOut(false)
    }
  }

  return (
    <div className="landing">
      <Backdrop />
      <main className="home-main">
        <h1 className="wordmark" tabIndex={-1}>
          Homepage
        </h1>
        <p className="welcome">{formatWelcome(userMetadata)}</p>
        {error && (
          <p className="signout-error" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          className="btn btn-login"
          disabled={signingOut}
          onClick={handleSignOut}
        >
          {signingOut ? 'Signing outâ€¦' : 'Sign out'}
        </button>
      </main>
    </div>
  )
}
