import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import '../../../App.css'
import NotFoundView from '../../../routing/NotFoundView'
import { Pager } from '../../../shared/Pager'
import { usePagination } from '../../../shared/usePagination'
import LeagueBottomNav from '../../../shared/LeagueBottomNav'
import { useAuth } from '../../../auth/authContext'
import { useChat } from '../../chat/chatContext'
import type { ConversationSummary } from '../../chat/chatService'
import { CONVERSATIONS_PER_PAGE, displayName, previewText, sortConversations } from '../../chat/conversationList'
import { conversationLabel } from '../../chat/unreadBadge'
import UnreadAlertIcon from '../../chat/UnreadAlertIcon'
import { useUserList } from '../../chat/userLists'
import { LeagueNewMessagePanel } from './LeagueNewMessagePanel'

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'not_member' }
  | { status: 'loaded'; chatId: string; conversations: ConversationSummary[] }

function formatTime(iso: string | null): string {
  if (iso === null) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
}

function Entry({
  to,
  name,
  conversation,
  unread,
  group,
}: {
  to: string
  name: string
  conversation: ConversationSummary | undefined
  unread: number | null
  group?: boolean
}) {
  const isUnread = typeof unread === 'number' && unread > 0
  return (
    <li className="conversation-item">
      <Link
        to={to}
        className={`conversation-link ${isUnread ? 'is-unread' : ''}`.trim()}
        aria-label={conversationLabel(name, unread)}
      >
        <span className="conversation-main">
          <span className="conversation-name" style={{ fontWeight: isUnread ? 700 : 400 }}>
            {group && <span className="group-indicator">League</span>} {name}
          </span>
          <span className="conversation-preview" style={{ fontWeight: isUnread ? 700 : 400 }}>
            {previewText(conversation?.latestMessageText ?? null)}
          </span>
        </span>
        <span className="conversation-side">
          {conversation?.latestMessageAt && (
            <time className="conversation-time" dateTime={conversation.latestMessageAt}>
              {formatTime(conversation.latestMessageAt)}
            </time>
          )}
          {typeof unread === 'number' && <UnreadAlertIcon count={unread} />}
        </span>
      </Link>
    </li>
  )
}

/** A league's chat: the group chat for every member, plus private messages between members. */
export default function LeagueChatPage({ leagueId }: { leagueId: string }) {
  const { service, unreadFor, addListener } = useChat()
  const auth = useAuth()
  const blocked = useUserList('blocked', auth.status === 'authenticated' ? auth.userId : undefined)
  const blockedKey = blocked.list.map((u) => u.username.toLowerCase()).join('|')
  const blockedNames = useMemo(() => new Set(blockedKey ? blockedKey.split('|') : []), [blockedKey])
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [showPanel, setShowPanel] = useState(false)
  const requestId = useRef({ value: 0 })

  const load = useCallback(
    async (initial: boolean) => {
      const id = ++requestId.current.value
      if (initial) setState({ status: 'loading' })
      // Opening the league chat creates it on first use. Later refreshes only re-read the list.
      let chatId: string | null = null
      if (initial) {
        const chat = (await service.getOrCreateLeagueChat?.(leagueId)) ?? { ok: false as const, error: 'unavailable' as const }
        if (id !== requestId.current.value) return
        if (!chat.ok) {
          setState({ status: chat.error === 'not_member' ? 'not_member' : 'error' })
          return
        }
        chatId = chat.conversationId
      }
      const list = await service.listConversations()
      if (id !== requestId.current.value) return
      if (!list.ok) {
        if (initial) setState({ status: 'error' })
        return
      }
      const mine = list.conversations.filter((c) => c.leagueId === leagueId)
      setState((prev) => {
        const resolved = chatId ?? (prev.status === 'loaded' ? prev.chatId : null)
        return resolved ? { status: 'loaded', chatId: resolved, conversations: mine } : prev
      })
    },
    [service, leagueId],
  )

  useEffect(() => {
    const box = requestId.current
    // oxlint-disable-next-line react/set-state-in-effect -- initial fetch must start on mount/league change
    void load(true)
    const remove = addListener({
      onMessage: () => void load(false),
      onEvent: () => void load(false),
      onReconnect: () => void load(false),
    })
    return () => {
      box.value++
      remove()
    }
  }, [load, addListener])

  const directs = useMemo(
    () =>
      state.status === 'loaded'
        ? sortConversations(state.conversations).filter(
            (c) => c.kind === 'personal' && !blockedNames.has((c.otherUserName ?? '').toLowerCase()),
          )
        : [],
    [state, blockedNames],
  )
  const { page, pageCount, visible, setPage } = usePagination(directs, CONVERSATIONS_PER_PAGE)

  if (state.status === 'not_member') return <NotFoundView />

  const leagueChat = state.status === 'loaded' ? state.conversations.find((c) => c.id === state.chatId) : undefined
  const base = `/leagues/${leagueId}/chat`

  return (
    <div className="app-shell">
      <main className="home-main">
        <header className="home-header">
          <h1 className="wordmark page-title" tabIndex={-1}>
            Chat
          </h1>
          {state.status === 'loaded' && (
            <button type="button" className="conversation-new" onClick={() => setShowPanel(true)}>
              New message
            </button>
          )}
        </header>

        {showPanel && <LeagueNewMessagePanel leagueId={leagueId} onClose={() => setShowPanel(false)} />}

        {state.status === 'loading' && (
          <p className="loading" role="status">
            Loading…
          </p>
        )}
        {state.status === 'error' && (
          <div role="alert" className="conversation-error">
            <p>Chat could not be loaded.</p>
            <button type="button" onClick={() => void load(true)}>
              Retry
            </button>
          </div>
        )}

        {state.status === 'loaded' && (
          <>
            <section className="dash-section chat-tab-group" aria-label="League chat">
              <ul className="conversation-list">
                <Entry
                  to={`${base}/${state.chatId}`}
                  name={leagueChat ? displayName(leagueChat) : 'League chat'}
                  conversation={leagueChat}
                  unread={unreadFor(state.chatId)}
                  group
                />
              </ul>
            </section>

            <section className="dash-section chat-tab-personal" aria-label="Private messages">
              <h2>Private messages</h2>
              {directs.length === 0 ? (
                <p className="empty-state">No private messages yet.</p>
              ) : (
                <>
                  <ul className="conversation-list">
                    {visible.map((c) => (
                      <Entry
                        key={c.id}
                        to={`${base}/${c.id}`}
                        name={displayName(c)}
                        conversation={c}
                        unread={unreadFor(c.id)}
                      />
                    ))}
                  </ul>
                  <Pager
                    label="Private messages pages"
                    page={page}
                    pageCount={pageCount}
                    onPageChange={setPage}
                  />
                </>
              )}
            </section>
          </>
        )}
      </main>
      <LeagueBottomNav leagueId={leagueId} />
    </div>
  )
}
