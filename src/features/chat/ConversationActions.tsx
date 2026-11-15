import { useEffect, useRef, useState } from 'react'
import Modal from '../../shared/Modal'
import type { GroupRole } from './chatService'
import type { ListedUser } from './userLists'

const ICON = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  focusable: false,
  'aria-hidden': true,
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg {...ICON} fill={filled ? 'currentColor' : 'none'}>
      <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
    </svg>
  )
}

function BlockIcon() {
  return (
    <svg {...ICON}>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6l12.8 12.8" />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg {...ICON}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  )
}

export interface GroupMember extends ListedUser {
  /** Absent when the server does not report roles. */
  role?: GroupRole
}

export interface DirectActionsProps {
  /** The other person; null until the member list has loaded. */
  other: ListedUser | null
  isFavorite: boolean
  onToggleFavorite: () => void
  /** Called after the user confirms; the chat then disappears from their list. */
  onBlock: () => void
}

/** Favorite and block buttons for a DM. */
export function DirectActions({
  other,
  isFavorite,
  onToggleFavorite,
  onBlock,
}: DirectActionsProps) {
  const [confirming, setConfirming] = useState(false)
  const name = other?.username ?? 'this user'
  return (
    <div className="conversation-tools">
      <button
        type="button"
        className={isFavorite ? 'icon-action is-on' : 'icon-action'}
        aria-label={isFavorite ? `Remove ${name} from favorites` : `Add ${name} to favorites`}
        aria-pressed={isFavorite}
        disabled={!other}
        onClick={onToggleFavorite}
      >
        <StarIcon filled={isFavorite} />
      </button>
      <button
        type="button"
        className="icon-action is-danger"
        aria-label={`Block ${name}`}
        aria-haspopup="dialog"
        disabled={!other}
        onClick={() => setConfirming(true)}
      >
        <BlockIcon />
      </button>
      {confirming && (
        <Modal title={`Block ${name}?`} onClose={() => setConfirming(false)}>
          <p className="modal-text">
            {name} will disappear from your chats. You won't see their messages, get their
            notifications, or be able to tag or message them until you unblock them from your
            blocked list. They aren't told.
          </p>
          <div className="modal-actions">
            <button type="button" className="modal-button" onClick={() => setConfirming(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="modal-button is-danger"
              onClick={() => {
                onBlock()
                setConfirming(false)
              }}
            >
              Block
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

const ROLES: readonly GroupRole[] = ['admin', 'moderator', 'member']
const ROLE_LABEL: Record<GroupRole, string> = {
  admin: 'Admin',
  moderator: 'Moderator',
  member: 'Member',
}
const ROLE_RANK: Record<GroupRole, number> = { admin: 0, moderator: 1, member: 2 }

export interface GroupActionsProps {
  groupName: string
  members: readonly GroupMember[]
  selfId: string | undefined
  /** Called when the settings modal opens so the member list can be refreshed. */
  onOpen?: () => void
  /** Anyone in the group. Resolves to an error message, or null on success. */
  onAdd?: (userId: string) => Promise<string | null>
  /** Finds users by name; null when the search failed. */
  onSearch?: (query: string) => Promise<ListedUser[] | null>
  /** People you've blocked; they can't be found or added. */
  blockedIds?: ReadonlySet<string>
  /** Admins only. Resolves to an error message, or null on success. */
  onSetRole?: (userId: string, role: GroupRole) => Promise<string | null>
  /** Admins, and moderators for plain members. Resolves to an error message, or null. */
  onRemove?: (userId: string) => Promise<string | null>
}

/** Settings button for a group; opens a modal listing members and their roles. */
export function GroupActions({
  groupName,
  members,
  selfId,
  onOpen,
  onSetRole,
  onRemove,
  onAdd,
  onSearch,
  blockedIds,
}: GroupActionsProps) {
  const [open, setOpen] = useState(false)
  const [removing, setRemoving] = useState<GroupMember | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const myRole = members.find((m) => m.userId === selfId)?.role
  const canChangeRoles = myRole === 'admin' && onSetRole !== undefined
  const canRemove = (m: GroupMember) =>
    onRemove !== undefined &&
    m.userId !== selfId &&
    (myRole === 'admin' || (myRole === 'moderator' && m.role === 'member'))

  // Admins first, then moderators, then members; alphabetical within a role.
  const sorted = [...members].sort(
    (a, b) =>
      (a.role ? ROLE_RANK[a.role] : 3) - (b.role ? ROLE_RANK[b.role] : 3) ||
      a.username.localeCompare(b.username, undefined, { sensitivity: 'base' }),
  )

  async function run(action: () => Promise<string | null>) {
    setBusy(true)
    setError(null)
    const message = await action()
    setBusy(false)
    if (message) setError(message)
  }

  return (
    <div className="conversation-tools">
      <button
        type="button"
        className="icon-action"
        aria-label="Group settings"
        aria-haspopup="dialog"
        onClick={() => {
          setError(null)
          setOpen(true)
          onOpen?.()
        }}
      >
        <GearIcon />
      </button>
      {open && (
        <Modal title="Group settings" onClose={() => setOpen(false)}>
          <p className="modal-subtitle">{groupName}</p>
          <h3 className="modal-section">Members ({members.length})</h3>
          {error && (
            <p className="modal-error" role="alert">
              {error}
            </p>
          )}
          {members.length === 0 ? (
            <p className="modal-text">Members could not be loaded.</p>
          ) : (
            <ul className="member-list">
              {sorted.map((m) => (
                <li key={m.userId} className="member-row">
                  <span className="member-avatar" aria-hidden="true">
                    {Array.from(m.username)[0]?.toUpperCase() ?? '?'}
                  </span>
                  <span className="member-name">{m.username}</span>
                  {m.userId === selfId && <span className="member-you">You</span>}
                  {canChangeRoles && m.role ? (
                    <select
                      className="member-role-select"
                      aria-label={`Role for ${m.username}`}
                      value={m.role}
                      disabled={busy}
                      onChange={(e) => {
                        const role = e.target.value as GroupRole
                        void run(() => onSetRole(m.userId, role))
                      }}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    m.role && (
                      <span className={`member-role is-${m.role}`}>{ROLE_LABEL[m.role]}</span>
                    )
                  )}
                  {canRemove(m) && (
                    <button
                      type="button"
                      className="member-remove"
                      aria-label={`Remove ${m.username} from the group`}
                      disabled={busy}
                      onClick={() => setRemoving(m)}
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {onAdd && onSearch && (
            <AddMember
              members={members}
              blockedIds={blockedIds}
              onSearch={onSearch}
              disabled={busy}
              onAdd={(id) => run(() => onAdd(id))}
            />
          )}
          {removing && (
            <Modal title={`Remove ${removing.username}?`} onClose={() => setRemoving(null)}>
              <p className="modal-text">
                {removing.username} will be removed from {groupName} and can't see it anymore.
              </p>
              <div className="modal-actions">
                <button type="button" className="modal-button" onClick={() => setRemoving(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="modal-button is-danger"
                  onClick={() => {
                    const target = removing
                    setRemoving(null)
                    void run(() => onRemove!(target.userId))
                  }}
                >
                  Remove
                </button>
              </div>
            </Modal>
          )}
        </Modal>
      )}
    </div>
  )
}
function AddMember({
  members,
  blockedIds,
  onSearch,
  onAdd,
  disabled,
}: {
  members: readonly GroupMember[]
  blockedIds?: ReadonlySet<string>
  onSearch: (query: string) => Promise<ListedUser[] | null>
  onAdd: (userId: string) => Promise<void>
  disabled: boolean
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ListedUser[] | null>(null)
  const [failed, setFailed] = useState(false)
  const text = query.trim()
  // The parent passes a new function each render; keep the latest without re-running the search.
  const searchRef = useRef(onSearch)
  useEffect(() => {
    searchRef.current = onSearch
  })

  useEffect(() => {
    if (text === '' || Array.from(text).length > 50) return
    let cancelled = false
    const timer = setTimeout(() => {
      void searchRef.current(text).then((users) => {
        if (cancelled) return
        setFailed(users === null)
        setResults(users ?? [])
      })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [text])

  // Hide people already in the group and anyone you've blocked.
  const inGroup = new Set(members.map((m) => m.userId))
  const shown = text === '' ? [] : (results ?? []).filter((u) => !inGroup.has(u.userId) && !blockedIds?.has(u.userId))

  return (
    <section className="add-member" aria-label="Add a member">
      <h3 className="modal-section">Add a member</h3>
      <input
        type="search"
        className="add-member-input"
        placeholder="Search by username"
        aria-label="Search users to add"
        value={query}
        maxLength={50}
        onChange={(e) => setQuery(e.target.value)}
      />
      {failed && (
        <p className="modal-error" role="alert">
          Users could not be searched.
        </p>
      )}
      {text !== '' && !failed && results !== null && shown.length === 0 && (
        <p className="modal-text">No users to add.</p>
      )}
      {shown.length > 0 && (
        <ul className="member-list">
          {shown.map((u) => (
            <li key={u.userId} className="member-row">
              <span className="member-name">{u.username}</span>
              <button
                type="button"
                className="member-add"
                aria-label={`Add ${u.username} to the group`}
                disabled={disabled}
                onClick={() => void onAdd(u.userId).then(() => setQuery(''))}
              >
                Add
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
