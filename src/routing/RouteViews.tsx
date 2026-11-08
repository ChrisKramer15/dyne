import { lazy } from 'react'
import { useAuth } from '../auth/authContext'
import LandingPage from '../features/landing/LandingPage'

// Signed-in pages load on demand so first-time visitors only download the
// landing page. <RouteGuard> supplies the Suspense boundary.
const Homepage = lazy(() => import('../features/home/Homepage'))
const LeaguesPage = lazy(() => import('../features/leagues/LeaguesPage'))
const ProfilePage = lazy(() => import('../features/profile/ProfilePage'))

export function LandingRoute() {
  return <LandingPage />
}

export function HomeRoute() {
  const auth = useAuth()
  // The guard already prevents any other status; this narrows the type.
  if (auth.status !== 'authenticated') return null
  return <Homepage />
}

export function LeaguesRoute() {
  return <LeaguesPage />
}

export function ProfileRoute() {
  return <ProfilePage />
}
