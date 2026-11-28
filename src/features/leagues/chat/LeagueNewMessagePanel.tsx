import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../../auth/authContext'
import { useChat } from '../../chat/chatContext'
import type { UserSummary } from '../../chat/chatService'
import { useUserList } from '../../chat/userLists'

type MembersState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; members: UserSummary[] }

/** Pick a league member to start (or reopen) a private message thread with. */
export function LeagueNewMessagePanel({ leagueId, onClose }: { leagueId: string; onClose: () => void }) {
  const { service } = useChat()
  const auth = useAuth()
  const selfId = auth.status === 'authenticated' ? auth.userId : undefined
  const blocked = useUserList('blocked', selfId)
  const navigate = useNavigate()
  const [state, setState] = useState<MembersState>({ status: 'loading' })
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const mounted = useRef(true)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    mounted.current = true
    inputRef.current?.focus()
    let cancelled = false
    void (async () => {
      const result = (await service.listLeagueMembers?.(leagueId)) ?? { ok: false as const }
      if (cancelled) return
      setState(result.ok ? { status: 'loaded', members: result.members } : { status: 'error' })
    })()
    return () => {
      cancelled = true
      mounted.current = false
    }
  }, [service, leagueId])

  const shown = useMemo(() => {
    if (state.status !== 'loaded') return []
    const q = query.trim().toLowerCase()
    return state.members.filter(
      (m) => m.userId !== selfId && !blocked.has(m.userId) && m.username.toLowerCase().includes(q),
    )
  }, [state, query, selfId, blocked])

  async function open(user: UserSummary) {
    if (busy) return
    setBusy(true)
    setError(null)
    const result = (await service.openLeagueDm?.({ leagueId, otherUserId: user.userId })) ?? {
      ok: false as const,
      error: 'unavailable' as const,
    }
    if (!mounted.current) return
    setBusy(false)
    if (result.ok) {
      onClose()
      navigate(`/leagues/${leagueId}/chat/${result.conversationId}`)
    } else {
      setError(
        result.error === 'not_member'
          ? 'That person is not in this league.'
          : 'The conversation could not be opened.',
      )
    }
  }

  return (
    <section className="new-conversation" aria-label="New private message">
      <div className="new-conversation-header">
        <h2>New private message</h2>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="new-conversation-search">
        <label htmlFor="league-member-search">Find a league member</label>
        <input
          id="league-member-search"
          ref={inputRef}
          type="search"
          value={query}
          autoComplete="off"
          onChange={(e) => setQuery(e.target.value)}
        />
        <div role="status" aria-live="polite">
          {state.status === 'loading' && <p>Loading members…</p>}
          {state.status === 'loaded' && shown.length === 0 && <p>No league members found.</p>}
        </div>
        {state.status === 'error' && <p role="alert">League members could not be loaded.</p>}
        {shown.length > 0 && (
          <ul className="user-results">
            {shown.map((u) => (
              <li key={u.userId}>
                <span>{u.username}</span>{' '}
                <button
                  type="button"
                  disabled={busy}
                  aria-label={`Message ${u.username}`}
                  onClick={() => void open(u)}
                >
                  Message
                </button>
              </li>
            ))}
          </ul>
        )}
        {error !== null && <p role="alert">{error}</p>}
      </div>
    </section>
  )
}
