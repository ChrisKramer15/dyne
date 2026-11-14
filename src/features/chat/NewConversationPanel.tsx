import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../auth/authContext'
import { useChat } from './chatContext'
import {
  MAX_GROUP_NAME_LENGTH,
  MAX_GROUP_SIZE,
  MIN_OTHER_GROUP_MEMBERS,
  USER_SEARCH_MAX_QUERY,
} from './chatService'
import type { UserSummary } from './chatService'
import { validateGroup } from './groupValidation'
import type { GroupValidationError } from './groupValidation'

const SEARCH_DEBOUNCE_MS = 300

const GROUP_MESSAGES: Record<GroupValidationError, string> = {
  name_required: 'A group name is required.',
  name_too_long: `Group name must be at most ${MAX_GROUP_NAME_LENGTH} characters.`,
  too_few_members: `Select at least ${MIN_OTHER_GROUP_MEMBERS} other users.`,
  too_many_members: `A group can have at most ${MAX_GROUP_SIZE} participants.`,
}

type Mode = 'direct' | 'group'

type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'too_long' }
  | { status: 'error' }
  | { status: 'done'; users: UserSummary[] }

export function NewConversationPanel({ onClose }: { onClose: () => void }) {
  const { service } = useChat()
  const auth = useAuth()
  const selfId = auth.status === 'authenticated' ? (auth.userId ?? '') : ''
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>('direct')
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState<SearchState>({ status: 'idle' })
  const [personalError, setPersonalError] = useState<string | null>(null)
  const [groupName, setGroupName] = useState('')
  const [members, setMembers] = useState<UserSummary[]>([])
  const [groupError, setGroupError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const searchId = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    inputRef.current?.focus()
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    const id = ++searchId.current
    const text = query.trim()
    if (text === '' || Array.from(text).length > USER_SEARCH_MAX_QUERY) return
    const timer = setTimeout(() => {
      void service.searchUsers(text).then((result) => {
        if (id !== searchId.current) return
        setSearch(result.ok ? { status: 'done', users: result.users } : { status: 'error' })
      })
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query, service])

  async function openPersonal(user: UserSummary) {
    if (busy) return
    setPersonalError(null)
    if (user.userId === selfId) {
      setPersonalError('You cannot start a conversation with yourself.')
      return
    }
    setBusy(true)
    const result = await service.openPersonalConversation(user.userId)
    if (!mounted.current) return
    setBusy(false)
    if (result.ok) {
      onClose()
      navigate(`/chat/${result.conversationId}`)
    } else {
      setPersonalError(
        result.error === 'self'
          ? 'You cannot start a conversation with yourself.'
          : 'The conversation could not be opened.',
      )
    }
  }

  function addMember(user: UserSummary) {
    if (user.userId === selfId) return
    setGroupError(null)
    setMembers((prev) => (prev.some((m) => m.userId === user.userId) ? prev : [...prev, user]))
  }

  function removeMember(userId: string) {
    setGroupError(null)
    setMembers((prev) => prev.filter((m) => m.userId !== userId))
  }

  async function submitGroup(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    const memberIds = members.map((m) => m.userId)
    const check = validateGroup(groupName, memberIds, selfId)
    if (!check.ok) {
      setGroupError(GROUP_MESSAGES[check.error])
      return
    }
    setGroupError(null)
    setBusy(true)
    const result = await service.createGroup({ name: groupName, memberIds })
    if (!mounted.current) return
    setBusy(false)
    if (result.ok) {
      onClose()
      navigate(`/chat/${result.conversationId}`)
    } else {
      setGroupError('The group could not be created.')
    }
  }

  return (
    <section className="new-conversation" aria-label="New conversation">
      <div className="new-conversation-header">
        <h2>New conversation</h2>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="mode-toggle" role="group" aria-label="Conversation type">
        <button type="button" aria-pressed={mode === 'direct'} onClick={() => setMode('direct')}>
          Direct message
        </button>
        <button type="button" aria-pressed={mode === 'group'} onClick={() => setMode('group')}>
          Group chat
        </button>
      </div>

      <div className="new-conversation-search">
        <label htmlFor="user-search">Find a user</label>
        <input
          id="user-search"
          ref={inputRef}
          type="search"
          value={query}
          autoComplete="off"
          onChange={(e) => {
            const value = e.target.value
            const text = value.trim()
            setQuery(value)
            setPersonalError(null)
            if (text === '') setSearch({ status: 'idle' })
            else if (Array.from(text).length > USER_SEARCH_MAX_QUERY) {
              setSearch({ status: 'too_long' })
            } else setSearch({ status: 'loading' })
          }}
        />
        <div role="status" aria-live="polite">
          {search.status === 'loading' && <p>Searching…</p>}
          {search.status === 'too_long' && (
            <p>Search text must be 1 to {USER_SEARCH_MAX_QUERY} characters.</p>
          )}
          {search.status === 'done' && search.users.length === 0 && <p>No users found.</p>}
        </div>
        {search.status === 'error' && <p role="alert">Users could not be searched.</p>}
        {search.status === 'done' && search.users.length > 0 && (
          <ul className="user-results">
            {search.users.map((u) => (
              <li key={u.userId}>
                <span>{u.username}</span>{' '}
                {mode === 'direct' ? (
                  <button
                    type="button"
                    disabled={busy}
                    aria-label={`Message ${u.username}`}
                    onClick={() => void openPersonal(u)}
                  >
                    Message
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label={`Add ${u.username} to group`}
                    disabled={members.some((m) => m.userId === u.userId)}
                    onClick={() => addMember(u)}
                  >
                    Add to group
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {mode === 'direct' && personalError !== null && <p role="alert">{personalError}</p>}
      </div>

      {mode === 'group' && (
      <form className="new-group-form" onSubmit={(e) => void submitGroup(e)} noValidate>
        <h3>New group</h3>
        <label htmlFor="group-name">Group name</label>
        <input
          id="group-name"
          type="text"
          value={groupName}
          autoComplete="off"
          aria-invalid={groupError !== null}
          onChange={(e) => {
            setGroupName(e.target.value)
            setGroupError(null)
          }}
        />
        <p id="group-members-label">Selected users ({members.length})</p>
        <ul aria-labelledby="group-members-label" className="group-members">
          {members.map((m) => (
            <li key={m.userId}>
              <span>{m.username}</span>{' '}
              <button
                type="button"
                aria-label={`Remove ${m.username}`}
                onClick={() => removeMember(m.userId)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        {groupError !== null && <p role="alert">{groupError}</p>}
        <button type="submit" disabled={busy}>
          Create group
        </button>
      </form>
      )}
    </section>
  )
}
