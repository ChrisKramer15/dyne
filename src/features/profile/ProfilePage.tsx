import { useState, type CSSProperties } from 'react'
import '../../App.css'
import BottomNav from '../../shared/BottomNav'
import { useAuth } from '../../auth/authContext'
import type { AuthService } from '../../auth/authService'
import { getDefaultAuthService } from '../../auth/defaultAuthService'
import { getDisplayName, truncateName } from '../../auth/displayName'
import {
  daysSince,
  formatMemberSince,
  getInitials,
  greetingFor,
  hueFromSeed,
} from './profileIdentity'

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
  const email = auth.status === 'authenticated' ? (auth.email ?? '') : ''
  const createdAt = auth.status === 'authenticated' ? auth.createdAt : undefined
  const memberSince = formatMemberSince(createdAt)
  const days = daysSince(createdAt)
  // Each player gets their own accent colour, stable across visits.
  const hue = hueFromSeed(username || email || 'dyne')

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

        <section
          className="profile-hero"
          aria-label="Player card"
          style={{ '--hue': hue } as CSSProperties}
        >
          <div className="profile-avatar" aria-hidden="true">
            {getInitials(username || email)}
          </div>
          <p className="profile-greeting">{greetingFor()}</p>
          <p className="profile-name">{username || 'Player'}</p>
          {memberSince !== '' && <p className="profile-badge">Dyne member since {memberSince}</p>}
        </section>

        {days !== null && (
          <section className="dash-section" aria-labelledby="profile-journey">
            <h2 id="profile-journey" className="dash-heading">
              Your journey
            </h2>
            <ul className="profile-stats">
              <li>
                <span className="profile-stat-value">{days}</span>
                <span className="profile-stat-label">{days === 1 ? 'day on Dyne' : 'days on Dyne'}</span>
              </li>
              <li>
                <span className="profile-stat-value">{Math.floor(days / 7)}</span>
                <span className="profile-stat-label">weeks in the game</span>
              </li>
            </ul>
          </section>
        )}

        <section className="dash-section" aria-labelledby="profile-account">
          <h2 id="profile-account" className="dash-heading">
            Account
          </h2>
          <div className="profile-card">
            <dl className="profile-details">
              {username !== '' && (
                <div>
                  <dt>Username</dt>
                  <dd>{username}</dd>
                </div>
              )}
              {email !== '' && (
                <div>
                  <dt>Email</dt>
                  <dd>{email}</dd>
                </div>
              )}
              {memberSince !== '' && (
                <div>
                  <dt>Member since</dt>
                  <dd>{memberSince}</dd>
                </div>
              )}
            </dl>
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
