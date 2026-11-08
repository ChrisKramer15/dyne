import { useState } from 'react'
import '../../App.css'
import BottomNav from '../../shared/BottomNav'
import { useAuth } from '../../auth/authContext'
import type { AuthService } from '../../auth/authService'
import { getDefaultAuthService } from '../../auth/defaultAuthService'
import { getDisplayName, truncateName } from '../../auth/displayName'

export interface ProfilePageProps {
  /** Injectable for tests; defaults to the real Supabase-backed service. */
  authService?: AuthService
}

export default function ProfilePage({ authService }: ProfilePageProps) {
  const auth = useAuth()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const username =
    auth.status === 'authenticated' ? truncateName(getDisplayName(auth.userMetadata)) : ''

  async function onSignOut() {
    if (busy) return
    setBusy(true)
    setFailed(false)
    try {
      // On success Supabase emits SIGNED_OUT; the route guard then sends the
      // user back to the landing page, so there is nothing else to do here.
      await (authService ?? getDefaultAuthService()).signOut()
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app-shell">
      <main className="home-main">
        <header className="home-header">
          <h1 className="wordmark page-title" tabIndex={-1}>
            Profile
          </h1>
        </header>

        <section className="dash-section" aria-labelledby="profile-account">
          <h2 id="profile-account" className="dash-heading">
            Account
          </h2>
          <div className="profile-card">
            {username !== '' && (
              <dl className="profile-details">
                <dt>Username</dt>
                <dd>{username}</dd>
              </dl>
            )}
            <button type="button" className="btn btn-login" onClick={onSignOut} disabled={busy}>
              {busy ? 'Signing out…' : 'Sign out'}
            </button>
            {failed && (
              <p className="auth-banner auth-banner-error profile-error" role="alert">
                Couldn’t sign out. Please try again.
              </p>
            )}
          </div>
        </section>
      </main>
      <BottomNav />
    </div>
  )
}
