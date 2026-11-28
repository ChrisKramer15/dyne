import { useContext, type CSSProperties } from 'react'
import { NavLink } from 'react-router'
import { AuthContext } from '../auth/authContext'
import { accentCss, useAccentColor } from '../features/profile/accentColor'
import { useLeagueChatUnread } from '../features/chat/chatContext'
import UnreadAlertIcon from '../features/chat/UnreadAlertIcon'
import { chatNavLabel } from '../features/chat/unreadBadge'
import { Bubble } from './BottomNav'

/** Bottom navigation shown on a league page, replacing the global nav. */
export default function LeagueBottomNav({ leagueId }: { leagueId: string }) {
  // Read the context directly: some callers render the nav without an auth provider.
  const auth = useContext(AuthContext)
  const { accent } = useAccentColor(auth?.status === 'authenticated' ? auth.userId : undefined)
  const unread = useLeagueChatUnread(leagueId)
  return (
    <nav
      className="bottom-nav"
      aria-label="League"
      style={accent ? ({ '--nav-accent': accentCss(accent.hue) } as CSSProperties) : undefined}
    >
      <ul>
        <li>
          <NavLink to={`/leagues/${leagueId}`} end className="nav-item">
            <Bubble
              label="Overview"
              icon={
                <>
                  <rect x="4" y="4" width="7" height="7" rx="1" />
                  <rect x="13" y="4" width="7" height="7" rx="1" />
                  <rect x="4" y="13" width="7" height="7" rx="1" />
                  <rect x="13" y="13" width="7" height="7" rx="1" />
                </>
              }
            />
          </NavLink>
        </li>
        <li>
          {/* end={false}: stays highlighted on a conversation inside the league chat. */}
          <NavLink
            to={`/leagues/${leagueId}/chat`}
            end={false}
            className="nav-item"
            aria-label={chatNavLabel(unread)}
          >
            <Bubble
              label="Chat"
              icon={<path d="M4 5h16v11H9l-5 4z" />}
              badges={<UnreadAlertIcon count={unread} variant="group" />}
            />
          </NavLink>
        </li>
        <li>
          <NavLink to="/leagues" end className="nav-item">
            <Bubble
              label="Back to Home"
              icon={<path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5M15 8l4 4-4 4M19 12H9" />}
            />
          </NavLink>
        </li>
      </ul>
    </nav>
  )
}
