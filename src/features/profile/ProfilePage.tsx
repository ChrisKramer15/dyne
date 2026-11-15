import { useState, type CSSProperties } from 'react'
import '../../App.css'
import BottomNav from '../../shared/BottomNav'
import { useAuth } from '../../auth/authContext'
import type { AuthService } from '../../auth/authService'
import { getDefaultAuthService } from '../../auth/defaultAuthService'
import { getDisplayName, truncateName } from '../../auth/displayName'
import { useUserList } from '../chat/userLists'
import {
  daysSince,
  formatMemberSince,
  getInitials,
  hueFromSeed,
} from './profileIdentity'
import { AVATAR_OPTIONS, readAvatar, writeAvatar, type AvatarOption } from './avatarOptions'
import Modal from '../../shared/Modal'
import EditProfileModal from './EditProfileModal'
import { useAccentColor } from './accentColor'

const iconProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

function CameraIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 8h3l2-2.5h6L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 20h4L19 9l-4-4L4 16v4z" />
      <path d="M13.5 6.5l4 4" />
    </svg>
  )
}

export interface ProfilePageProps {
  /** Injectable for tests; defaults to the real Supabase-backed service. */
  authService?: AuthService
}

type PeopleList = ReturnType<typeof useUserList>

/** Modal listing a saved list of people, each with an x to remove them. */
function PeopleModal({
  title,
  noun,
  empty,
  list,
  onClose,
}: {
  title: string
  /** Used in the remove button's label, e.g. "favorites". */
  noun: string
  empty: string
  list: PeopleList
  onClose: () => void
}) {
  return (
    <Modal title={title} onClose={onClose}>
      {list.list.length === 0 ? (
        <p className="empty-state">{empty}</p>
      ) : (
        <ul className="profile-people">
          {list.list.map((p) => (
            <li key={p.userId}>
              <span
                className="profile-person-avatar"
                aria-hidden="true"
                style={{ '--hue': hueFromSeed(p.username) } as CSSProperties}
              >
                {getInitials(p.username)}
              </span>
              <span className="profile-person-name">{p.username}</span>
              <button
                type="button"
                className="profile-person-remove"
                aria-label={`Remove ${p.username} from ${noun}`}
                onClick={() => list.remove(p.userId)}
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
export default function ProfilePage({ authService }: ProfilePageProps) {
  const auth = useAuth()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const userId = auth.status === 'authenticated' ? auth.userId : undefined
  const favorites = useUserList('favorites', userId)
  const blocked = useUserList('blocked', userId)
  const [avatar, setAvatar] = useState<AvatarOption | null>(() => readAvatar(userId))
  const [pickerOpen, setPickerOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [listOpen, setListOpen] = useState<'favorites' | 'blocked' | null>(null)

  function chooseAvatar(id: string | null) {
    writeAvatar(userId, id)
    setAvatar(AVATAR_OPTIONS.find((o) => o.id === id) ?? null)
    setPickerOpen(false)
  }

  const username =
    auth.status === 'authenticated' ? truncateName(getDisplayName(auth.userMetadata)) : ''
  const email = auth.status === 'authenticated' ? (auth.email ?? '') : ''
  const createdAt = auth.status === 'authenticated' ? auth.createdAt : undefined
  const memberSince = formatMemberSince(createdAt)
  const days = daysSince(createdAt)
  // Each player gets their own accent colour, stable across visits.
  // A chosen primary color wins over the default derived from the name.
  const { accent, setAccent } = useAccentColor(userId)
  const hue = accent?.hue ?? hueFromSeed(username || email || 'dyne')

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
    <div className="app-shell" style={{ '--hue': hue } as CSSProperties}>
      <main className="home-main">
        <header className="home-header">
          <h1 className="wordmark page-title" tabIndex={-1}>
            Profile
          </h1>
        </header>

        <section
          className="profile-hero"
          aria-label="Player card"
        >
          <div className="profile-avatar-row">
            <button
              type="button"
              className="profile-side-btn"
              aria-label="Change avatar"
              aria-haspopup="dialog"
              onClick={() => setPickerOpen(true)}
            >
              <CameraIcon />
            </button>
            <div className="profile-avatar" aria-hidden="true">
              {avatar ? avatar.emoji : getInitials(username || email)}
            </div>
            <button
              type="button"
              className="profile-side-btn"
              aria-label="Edit profile"
              aria-haspopup="dialog"
              onClick={() => setEditOpen(true)}
            >
              <EditIcon />
            </button>
          </div>
          <p className="profile-name">{username || 'Player'}</p>
          {memberSince !== '' && <p className="profile-badge">Dyne member since {memberSince}</p>}
          <hr className="profile-divider" />
        </section>

        <section className="dash-section" aria-label="Your stats">
          <ul className="profile-stats">
            <li>
              <div className="profile-stat">
                <span className="profile-stat-value">{days ?? '–'}</span>
                <span className="profile-stat-label">{days === 1 ? 'day on Dyne' : 'days on Dyne'}</span>
              </div>
            </li>
            <li>
              <button
                type="button"
                className="profile-stat"
                aria-haspopup="dialog"
                onClick={() => setListOpen('favorites')}
              >
                <span className="profile-stat-value">{favorites.list.length}</span>
                <span className="profile-stat-label">Favorites</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="profile-stat"
                aria-haspopup="dialog"
                onClick={() => setListOpen('blocked')}
              >
                <span className="profile-stat-value">{blocked.list.length}</span>
                <span className="profile-stat-label">Blocked</span>
              </button>
            </li>
          </ul>
        </section>
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
      {editOpen && (
        <EditProfileModal
          email={email}
          service={authService ?? getDefaultAuthService()}
          accent={accent}
          onAccentChange={setAccent}
          onClose={() => setEditOpen(false)}
        />
      )}
      {listOpen === 'favorites' && (
        <PeopleModal
          title="Favorites"
          noun="favorites"
          empty="No favorites yet."
          list={favorites}
          onClose={() => setListOpen(null)}
        />
      )}
      {listOpen === 'blocked' && (
        <PeopleModal
          title="Blocked users"
          noun="blocked users"
          empty="You haven’t blocked anyone."
          list={blocked}
          onClose={() => setListOpen(null)}
        />
      )}
      {pickerOpen && (
        <Modal title="Choose an avatar" onClose={() => setPickerOpen(false)}>
          <ul className="avatar-grid">
            {AVATAR_OPTIONS.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  className="avatar-choice"
                  aria-label={o.label}
                  aria-pressed={avatar?.id === o.id}
                  onClick={() => chooseAvatar(o.id)}
                >
                  <span aria-hidden="true">{o.emoji}</span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn avatar-reset" onClick={() => chooseAvatar(null)}>
            Use my initials
          </button>
        </Modal>
      )}
    </div>
  )
}
