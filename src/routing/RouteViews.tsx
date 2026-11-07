import { useAuth } from '../auth/authContext'
import Homepage from '../Homepage'
import LandingPage from '../LandingPage'
import LeaguesPage from '../LeaguesPage'

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
