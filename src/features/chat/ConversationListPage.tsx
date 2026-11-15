import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import '../../App.css'
import BottomNav from '../../shared/BottomNav'
import { Pager } from '../../shared/Pager'
import { usePagination } from '../../shared/usePagination'
import { useAuth } from '../../auth/authContext'
import { useChat } from './chatContext'
import { useUserList } from './userLists'
import type { ConversationKind, ConversationSummary } from './chatService'
import {
  CONVERSATIONS_PER_PAGE,
  displayName,
  previewText,
  sortConversations,
} from './conversationList'
import { NewConversationPanel } from './NewConversationPanel'
import { conversationLabel } from './unreadBadge'
import UnreadAlertIcon from './UnreadAlertIcon'

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; conversations: ConversationSummary[] }

function formatTime(iso: string | null): string {
  if (iso === null) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
}

function ConversationEntry({
  conversation,
  unread,
}: {
  conversation: ConversationSummary
  unread: number | null
}) {
  const name = displayName(conversation)
  const isUnread = typeof unread === 'number' && unread > 0
  const weight = isUnread ? 'is-unread' : ''
  return (
    <li className="conversation-item">
      <Link
        to={`/chat/${conversation.id}`}
        className={`conversation-link ${weight}`.trim()}
        aria-label={conversationLabel(name, unread)}
      >
        <span className="conversation-main">
          <span className="conversation-name" style={{ fontWeight: isUnread ? 700 : 400 }}>
            {conversation.kind === 'group' && (
              <span className="group-indicator" data-testid="group-indicator">
                Group
              </span>
            )}{' '}
            {name}
          </span>
          <span className="conversation-preview" style={{ fontWeight: isUnread ? 700 : 400 }}>
            {previewText(conversation.latestMessageText)}
          </span>
        </span>
        <span className="conversation-side">
          {conversation.latestMessageAt !== null && (
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

export default function ConversationListPage() {
  const chat = useChat()
  const auth = useAuth()
  const blocked = useUserList('blocked', auth.status === 'authenticated' ? auth.userId : undefined)
  const blockedKey = blocked.list.map((u) => u.username.toLowerCase()).join('|')
  const blockedNames = useMemo(() => new Set(blockedKey ? blockedKey.split('|') : []), [blockedKey])
  const { service, unreadFor, addListener } = chat
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [showPanel, setShowPanel] = useState(false)
  const [tab, setTab] = useState<ConversationKind>('personal')
  const requestId = useRef({ value: 0 })

  const load = useCallback(
    async (showLoading: boolean) => {
      const id = ++requestId.current.value
      if (showLoading) setState({ status: 'loading' })
      const result = await service.listConversations()
      if (id !== requestId.current.value) return
      if (result.ok) {
        setState({ status: 'loaded', conversations: result.conversations })
      } else if (showLoading) {
        setState({ status: 'error' })
      }
      // A failed background refresh keeps the list already displayed.
    },
    [service],
  )

  useEffect(() => {
    const requestBox = requestId.current
    // oxlint-disable-next-line react/set-state-in-effect -- initial fetch must start on mount/service change; load sets the loading state
    void load(true)
    const remove = addListener({
      onMessage: () => void load(false),
      onEvent: () => void load(false),
      onReconnect: () => void load(false),
    })
    return () => {
      requestBox.value++
      remove()
    }
  }, [load, addListener])

  // DMs with blocked people are left out entirely, as if they didn't exist.
  const sorted = useMemo(
    () =>
      state.status === 'loaded'
        ? sortConversations(state.conversations).filter(
            (c) => c.kind !== 'personal' || !blockedNames.has((c.otherUserName ?? '').toLowerCase()),
          )
        : [],
    [state, blockedNames],
  )
  const shown = useMemo(() => sorted.filter((c) => c.kind === tab), [sorted, tab])
  const { page, pageCount, visible, setPage } = usePagination(shown, CONVERSATIONS_PER_PAGE)

  return (
    <div className="app-shell">
      <main className="home-main">
        <header className="home-header">
          <h1 className="wordmark page-title" tabIndex={-1}>
            Chat
          </h1>
          {state.status === 'loaded' && sorted.length > 0 && (
            <button type="button" className="conversation-new" onClick={() => setShowPanel(true)}>
              New conversation
            </button>
          )}
        </header>

        {showPanel && <NewConversationPanel onClose={() => setShowPanel(false)} />}

        <section className={`dash-section chat-tab-${tab}`} aria-label="Conversations">
          {state.status === 'loaded' && sorted.length > 0 && (
            <div className="chat-toggle" role="group" aria-label="Conversation type">
              <button
                type="button"
                className="chat-toggle-dm"
                aria-pressed={tab === 'personal'}
                onClick={() => {
                  setTab('personal')
                  setPage(0)
                }}
              >
                DMs
              </button>
              <button
                type="button"
                className="chat-toggle-group"
                aria-pressed={tab === 'group'}
                onClick={() => {
                  setTab('group')
                  setPage(0)
                }}
              >
                Group Chats
              </button>
            </div>
          )}
          {state.status === 'loading' && (
            <p className="loading" role="status">
              Loading…
            </p>
          )}
          {state.status === 'error' && (
            <div role="alert" className="conversation-error">
              <p>Conversations could not be loaded.</p>
              <button type="button" onClick={() => void load(true)}>
                Retry
              </button>
            </div>
          )}
          {state.status === 'loaded' && sorted.length === 0 && (
            <div className="empty-state">
              <p>No conversations yet.</p>
              {!showPanel && (
                <button type="button" onClick={() => setShowPanel(true)}>
                  Start a conversation
                </button>
              )}
            </div>
          )}
          {state.status === 'loaded' && sorted.length > 0 && (
            <>
              <ul className="conversation-list">
                {visible.map((c) => (
                  <ConversationEntry
                    key={c.id}
                    conversation={c}
                    unread={unreadFor(c.id)}
                  />
                ))}
              </ul>
              <Pager
                label="Conversations pages"
                page={page}
                pageCount={pageCount}
                onPageChange={setPage}
              />
            </>
          )}
        </section>
      </main>
      <BottomNav />
    </div>
  )
}
