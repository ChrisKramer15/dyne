import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { ChatMessage, ConversationEvent } from './chatService'
import { mergeTimeline } from './messageState'
import { splitMentions } from './mentions'

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
  /** Signed-in user; their messages render as right-aligned bubbles. */
  selfId?: string
  /** Usernames in the conversation; '@name' tags of these are highlighted. */
  memberNames?: readonly string[]
  /** Show the sender's name on other people's messages (group chats). */
  showSenderNames?: boolean
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

function dayKey(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toDateString()
}

/** Full date for the divider, e.g. "Tuesday, June 3"; the year is added for other years. */
function dayLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

function timeOnly(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { timeStyle: 'short' })
}

function isNearBottom(el: HTMLElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX
}

export function MessageList({
  messages,
  events,
  pending = [],
  selfName = 'You',
  selfId,
  memberNames = [],
  showSenderNames = true,
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
  const names = new Set(memberNames.map((n) => n.toLowerCase()))
  const renderText = (text: string) =>
    splitMentions(text, names).map((p, i) =>
      p.type === 'mention' ? (
        <span key={i} className="mention">
          {p.value}
        </span>
      ) : (
        p.value
      ),
    )
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
          {timeline.map((item, i) => {
            const prev = timeline[i - 1]
            const newDay = !prev || dayKey(prev.createdAt) !== dayKey(item.createdAt)
            const divider = newDay ? (
              <li key={`d-${item.type}-${item.id}`} className="message-day">
                <span>{dayLabel(item.createdAt)}</span>
              </li>
            ) : null
            if (item.type === 'event') {
              return [
                divider,
                <li key={`e-${item.id}`} className="message-notice">
                  {item.event.userName} {item.event.kind === 'removed' ? 'was removed' : item.event.kind}{' '}
                  <time dateTime={item.createdAt}>{formatTime(item.createdAt)}</time>
                </li>,
              ]
            }
            const mine = selfId !== undefined && item.message.senderId === selfId
            return [
              divider,
              <li key={`m-${item.id}`} className={`message-item ${mine ? 'is-mine' : 'is-theirs'}`}>
                <div className="message-body">
                  <div className="message-bubble">
                    <span
                      className={
                        mine || !showSenderNames ? 'message-sender visually-hidden' : 'message-sender'
                      }
                    >
                      {item.message.senderName}
                    </span>
                    <p className="message-text">{renderText(item.message.text)}</p>
                  </div>
                  <time className="message-time" dateTime={item.message.createdAt}>
                    {timeOnly(item.message.createdAt)}
                  </time>
                </div>
              </li>,
            ]
          })}
          {pending.map((p) => (
            <li key={`p-${p.id}`} className={`message-item is-mine message-${p.status}`}>
              <div className="message-body">
                <div className="message-bubble">
                  <span className="message-sender visually-hidden">{selfName}</span>
                  <p className="message-text">{renderText(p.text)}</p>
                </div>
                {p.createdAt && (
                  <time className="message-time" dateTime={p.createdAt}>
                    {timeOnly(p.createdAt)}
                  </time>
                )}
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
              </div>
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
