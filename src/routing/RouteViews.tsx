import { lazy } from 'react'
import { useParams } from 'react-router'
import { useAuth } from '../auth/authContext'
import NotFoundView from './NotFoundView'
import LandingPage from '../features/landing/LandingPage'

// Signed-in pages load on demand so first-time visitors only download the
// landing page. <RouteGuard> supplies the Suspense boundary.
const Homepage = lazy(() => import('../features/home/Homepage'))
const LeaguesPage = lazy(() => import('../features/leagues/LeaguesPage'))
const ProfilePage = lazy(() => import('../features/profile/ProfilePage'))

const ConversationListPage = lazy(() => import('../features/chat/ConversationListPage'))
const ConversationViewPage = lazy(() => import('../features/chat/ConversationViewPage'))

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function ChatListRoute() {
  return <ConversationListPage />
}

/**
 * A non-UUID id renders NotFoundView without any lookup. The page itself
 * renders NotFoundView when the service reports not_found or no row exists.
 */
export function ChatConversationRoute() {
  const { conversationId } = useParams()
  if (!conversationId || !UUID_PATTERN.test(conversationId)) return <NotFoundView />
  return <ConversationViewPage conversationId={conversationId} />
}

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
