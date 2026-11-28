import { useContext, type CSSProperties, type ReactNode } from 'react'
import { NavLink } from 'react-router'
import { AuthContext } from '../auth/authContext'
import { accentCss, useAccentColor } from '../features/profile/accentColor'
import { useChatUnread } from '../features/chat/chatContext'
import UnreadAlertIcon from '../features/chat/UnreadAlertIcon'
import { chatNavLabel } from '../features/chat/unreadBadge'

interface NavItem {
  label: string
  icon: ReactNode
  /** Route this item opens; items without one are placeholders for now. */
  to?: string
}

const NAV_ITEMS: readonly NavItem[] = [
  {
    label: 'Home',
    to: '/home',
    icon: <path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" />,
  },
  {
    label: 'Leagues',
    to: '/leagues',
    icon: (
      <>
        <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
        <path d="M8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M9 20h6" />
      </>
    ),
  },
  { label: 'Chat', to: '/chat', icon: <path d="M4 5h16v11H9l-5 4z" /> },
  {
    label: 'Profile',
    to: '/profile',
    icon: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
      </>
    ),
  },
]

export function Bubble({ icon, label, badges }: { icon: ReactNode; label: string; badges?: ReactNode }) {
  return (
    <>
      <span className="nav-bubble" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          {icon}
        </svg>
        {badges}
      </span>
      <span className="nav-label">{label}</span>
    </>
  )
}

/** Fixed bottom navigation shared by the signed-in pages. */
export default function BottomNav() {
  const { total, totalDms, totalGroups } = useChatUnread()
  // Read the context directly: some callers render the nav without an auth provider.
  const auth = useContext(AuthContext)
  const { accent } = useAccentColor(auth?.status === 'authenticated' ? auth.userId : undefined)
  return (
    <nav
      className="bottom-nav"
      aria-label="Primary"
      style={accent ? ({ '--nav-accent': accentCss(accent.hue) } as CSSProperties) : undefined}
    >
      <ul>
        {NAV_ITEMS.map((item) => (
          <li key={item.label}>
            {item.to ? (
              // NavLink sets aria-current="page" on the active route.
              item.label === 'Chat' ? (
                <NavLink
                  to={item.to}
                  end={false}
                  className="nav-item"
                  aria-label={chatNavLabel(total)}
                >
                  <Bubble
                    icon={item.icon}
                    label={item.label}
                    badges={
                      <>
                        <UnreadAlertIcon count={totalDms} variant="dm" />
                        <UnreadAlertIcon count={totalGroups} variant="group" />
                      </>
                    }
                  />
                </NavLink>
              ) : (
                <NavLink to={item.to} end className="nav-item">
                  <Bubble icon={item.icon} label={item.label} />
                </NavLink>
              )
            ) : (
              <button type="button" className="nav-item">
                <Bubble icon={item.icon} label={item.label} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </nav>
  )
}
