import './App.css'
import { useAuthState } from './auth/useAuthState'
import { formatWelcome } from './auth/displayName'
import { useNavigationGuard } from './navigation/useNavigationGuard'
import type { NavTarget } from './navigation/useNavigationGuard'

// TODO: photographer could not be determined automatically (Unsplash page not
// reachable without auth). Replace with the real name and profile URL from
// https://unsplash.com/photos/man-holding-baseball-bat-on-green-field-syyBwqVX0Hc
export const PHOTOGRAPHER_NAME = 'Christopher Campbell (https://unsplash.com/@chrisjoelcampbell)'
export const PHOTOGRAPHER_URL =
  'https://unsplash.com/photos/man-holding-baseball-bat-on-green-field-syyBwqVX0Hc'
export const UNSPLASH_URL = 'https://unsplash.com/?utm_source=dyne&utm_medium=referral'

export interface LandingPageProps {
  onNavigate?: (target: NavTarget) => void
}

export default function LandingPage({ onNavigate }: LandingPageProps) {
  const auth = useAuthState()
  const { guardedNavigate, error } = useNavigationGuard(onNavigate)

  return (
    <div className="landing">
      <main className="landing-main">
        <h1>Dyne</h1>
        {auth.status === 'loading' && (
          <p className="loading" role="status">
            Loading…
          </p>
        )}
        {auth.status === 'authenticated' && (
          <p className="welcome">{formatWelcome(auth.userMetadata)}</p>
        )}
        {auth.status === 'unauthenticated' && (
          <div className="actions">
            <button type="button" onClick={() => guardedNavigate('login')}>
              Login
            </button>
            <button type="button" onClick={() => guardedNavigate('register')}>
              Register
            </button>
          </div>
        )}
        <div role="alert">
          {error && <p className="error">{error}</p>}
        </div>
      </main>
      <footer className="landing-footer">
        Photo by{' '}
        <a href={PHOTOGRAPHER_URL} target="_blank" rel="noopener noreferrer">
          {PHOTOGRAPHER_NAME}
        </a>{' '}
        on{' '}
        <a href={UNSPLASH_URL} target="_blank" rel="noopener noreferrer">
          Unsplash
        </a>
      </footer>
    </div>
  )
}
