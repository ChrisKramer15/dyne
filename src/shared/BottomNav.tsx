import type { ReactNode } from 'react'
import { NavLink } from 'react-router'

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
  { label: 'Chat', icon: <path d="M4 5h16v11H9l-5 4z" /> },
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

function Bubble({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <>
      <span className="nav-bubble" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          {icon}
        </svg>
      </span>
      <span className="nav-label">{label}</span>
    </>
  )
}

/** Fixed bottom navigation shared by the signed-in pages. */
export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      <ul>
        {NAV_ITEMS.map((item) => (
          <li key={item.label}>
            {item.to ? (
              // NavLink sets aria-current="page" on the active route.
              <NavLink to={item.to} end className="nav-item">
                <Bubble icon={item.icon} label={item.label} />
              </NavLink>
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
