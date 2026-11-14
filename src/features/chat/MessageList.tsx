import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { ChatMessage, ConversationEvent } from './chatService'
import { mergeTimeline } from './messageState'

/** Distance from the latest message within which the list counts as "at the bottom". */
export const NEAR_BOTTOM_PX = 50

export interface PendingMessage {
  id: string
  text: string
  status: 'sending' | 'failed'
  /** Optional local ISO timestamp, shown until the server timestamp is known. */
  createdAt?: string
}

export interface MessageListProps {
  messages: readonly ChatMessage[]
  events: readonly ConversationEvent[]
  /** Messages not yet stored; rendered after stored items. */
  pending?: readonly PendingMessage[]
  /** Label for pending messages' sender. */
  selfName?: string
  hasMore?: boolean
  loadingEarlier?: boolean
  onLoadEarlier?: () => void
  onRetry?: (id: string) => void
  /** Called after the list has scrolled to the latest item via the jump control. */
  onJumpToLatest?: () => void
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
}

function isNearBottom(el: HTMLElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX
}

export function MessageList({
  messages,
  events,
  pending = [],
  selfName = 'You',
  hasMore = false,
  loadingEarlier = false,
  onLoadEarlier,
  onRetry,
  onJumpToLatest,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const nearBottomRef = useRef(true)
  const prevRef = useRef<{ first?: string; last?: string; height: number }>({ height: 0 })
  const [showJump, setShowJump] = useState(false)

  const timeline = mergeTimeline(messages, events)
  const firstId = timeline[0]?.id
  const lastId = pending.length ? pending[pending.length - 1].id : timeline[timeline.length - 1]?.id

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const prev = prevRef.current
    const prepended = prev.first !== undefined && firstId !== prev.first && lastId === prev.last
    const appended = lastId !== prev.last
    if (prev.last === undefined || (appended && nearBottomRef.current)) {
      scrollToBottom()
      nearBottomRef.current = true
      setShowJump(false)
    } else if (prepended) {
      // Keep the visible content in place when earlier messages are added above.
      el.scrollTop += el.scrollHeight - prev.height
    } else if (appended) {
      setShowJump(true)
    }
    prevRef.current = { first: firstId, last: lastId, height: el.scrollHeight }
  }, [firstId, lastId, scrollToBottom])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const near = isNearBottom(el)
    nearBottomRef.current = near
    prevRef.current.height = el.scrollHeight
    if (near) setShowJump(false)
  }

  function jump() {
    scrollToBottom()
    nearBottomRef.current = true
    setShowJump(false)
    onJumpToLatest?.()
  }

  return (
    <div className="message-list-wrap">
      <div
        className="message-list"
        ref={scrollRef}
        onScroll={handleScroll}
        tabIndex={0}
        role="region"
        aria-label="Messages"
      >
        {hasMore && (
          <button
            type="button"
            className="message-load-earlier"
            onClick={onLoadEarlier}
            disabled={loadingEarlier}
          >
            {loadingEarlier ? 'Loading earlier messages…' : 'Load earlier messages'}
          </button>
        )}
        <ul className="message-items">
          {timeline.map((item) =>
            item.type === 'event' ? (
              <li key={`e-${item.id}`} className="message-notice">
                {item.event.userName} {item.event.kind}
                {' '}
                <time dateTime={item.createdAt}>{formatTime(item.createdAt)}</time>
              </li>
            ) : (
              <li key={`m-${item.id}`} className="message-item">
                <span className="message-sender">{item.message.senderName}</span>{' '}
                <time className="message-time" dateTime={item.message.createdAt}>
                  {formatTime(item.message.createdAt)}
                </time>
                <p className="message-text">{item.message.text}</p>
              </li>
            ),
          )}
          {pending.map((p) => (
            <li key={`p-${p.id}`} className={`message-item message-${p.status}`}>
              <span className="message-sender">{selfName}</span>{' '}
              {p.createdAt && (
                <time className="message-time" dateTime={p.createdAt}>
                  {formatTime(p.createdAt)}
                </time>
              )}
              <p className="message-text">{p.text}</p>
              {p.status === 'sending' ? (
                <span className="message-status">Sending…</span>
              ) : (
                <span className="message-status" role="alert">
                  Failed to send.{' '}
                  <button type="button" onClick={() => onRetry?.(p.id)}>
                    Retry
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
      {showJump && (
        <button type="button" className="message-jump" onClick={jump}>
          Jump to latest
        </button>
      )}
    </div>
  )
}
