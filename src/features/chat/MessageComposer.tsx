import { useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type Ref } from 'react'
import { MAX_MESSAGE_LENGTH } from './chatService'
import { applyMention, filterMembers, findMentionQuery, type MentionMember } from './mentions'
import { validateMessage } from './messageValidation'

/** A small starter set; enough for quick reactions without a full picker library. */
const EMOJIS = [
  '😀', '😁', '😂', '🤣', '😊', '😍', '😘', '😎',
  '🤔', '😅', '😢', '😭', '😡', '🥳', '😴', '🙄',
  '👍', '👎', '👏', '🙌', '🙏', '💪', '👀', '🤝',
  '❤️', '🔥', '✨', '🎉', '💯', '✅', '❌', '⚡',
  '🏆', '🏈', '🏀', '⚾', '🏒', '🏁', '🎯', '💰',
]

export interface MessageComposerProps {
  /**
   * Sends validated text. Resolves true when the message was stored (the
   * composer then clears) and false otherwise (the text is kept).
   */
  onSend: (text: string) => Promise<boolean>
  /** Focus the textarea when the composer mounts. */
  autoFocus?: boolean
  /** Lets the parent move focus to the textarea (e.g. after jump-to-latest). */
  textareaRef?: Ref<HTMLTextAreaElement>
  /**
   * Set when a message was stored outside the composer (a retry). The
   * composer clears if it still holds that exact text. A new object each time.
   */
  storedElsewhere?: { text: string } | null
  /** People who can be tagged with '@'. Leave empty to turn tagging off. */
  members?: readonly MentionMember[]
}

/**
 * Message input. Enter submits, Shift+Enter inserts a newline. Invalid text is
 * kept and the textarea stays focused. Submits made while a previous one is
 * awaiting its result are ignored.
 */
export function MessageComposer({
  onSend,
  autoFocus = false,
  textareaRef,
  storedElsewhere = null,
  members = [],
}: MessageComposerProps) {
  const id = useId()
  const errorId = `${id}-error`
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const inFlight = useRef(false)
  const [caret, setCaret] = useState(0)
  const [activeIndex, setActiveIndex] = useState(0)
  const [dismissedAt, setDismissedAt] = useState<number | null>(null)
  const [pendingCaret, setPendingCaret] = useState<number | null>(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const listId = `${id}-mentions`
  const mention = members.length > 0 ? findMentionQuery(text, caret) : null
  const options = mention ? filterMembers(members, mention.query) : []
  const popupOpen = mention !== null && options.length > 0 && dismissedAt !== mention.start
  const active = Math.min(activeIndex, Math.max(options.length - 1, 0))
  const innerRef = useRef<HTMLTextAreaElement | null>(null)

  useImperativeHandle(textareaRef, () => innerRef.current as HTMLTextAreaElement, [])

  useEffect(() => {
    if (autoFocus) innerRef.current?.focus()
  }, [autoFocus])

  // Adjust state during render when the prop changes (no effect needed).
  const [seenStored, setSeenStored] = useState(storedElsewhere)
  if (storedElsewhere !== seenStored) {
    setSeenStored(storedElsewhere)
    if (storedElsewhere) {
      const stored = storedElsewhere.text
      setText((current) => (current === stored ? '' : current))
    }
  }

  // Grow with the text up to a few lines, then scroll.
  useLayoutEffect(() => {
    const el = innerRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [text])

  // Put the caret after an inserted tag once React has updated the textarea.
  useEffect(() => {
    if (pendingCaret === null) return
    innerRef.current?.setSelectionRange(pendingCaret, pendingCaret)
    // oxlint-disable-next-line react/set-state-in-effect -- one-shot caret move after the controlled value updates
    setPendingCaret(null)
  }, [pendingCaret])

  function pickMention(member: MentionMember) {
    if (!mention) return
    const next = applyMention(text, mention, caret, member.username)
    setText(next.text)
    setCaret(next.caret)
    setPendingCaret(next.caret)
    setActiveIndex(0)
  }

  function insertEmoji(emoji: string) {
    const el = innerRef.current
    const start = el?.selectionStart ?? text.length
    const end = el?.selectionEnd ?? text.length
    setText(text.slice(0, start) + emoji + text.slice(end))
    setCaret(start + emoji.length)
    setPendingCaret(start + emoji.length)
    setEmojiOpen(false)
    el?.focus()
  }

  async function submit() {
    if (inFlight.current) return
    const result = validateMessage(text)
    if (!result.ok) {
      setError(
        result.error === 'empty'
          ? 'Type a message before sending.'
          : `Messages can be at most ${MAX_MESSAGE_LENGTH} characters.`,
      )
      innerRef.current?.focus()
      return
    }
    setError(null)
    inFlight.current = true
    setSending(true)
    try {
      const stored = await onSend(result.text)
      if (stored) setText('')
    } finally {
      inFlight.current = false
      setSending(false)
      innerRef.current?.focus()
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    void submit()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape' && emojiOpen) {
      e.preventDefault()
      setEmojiOpen(false)
      return
    }
    if (popupOpen && !e.nativeEvent.isComposing) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const step = e.key === 'ArrowDown' ? 1 : -1
        setActiveIndex((active + step + options.length) % options.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        pickMention(options[active])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setDismissedAt(mention.start)
        return
      }
    }
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
    e.preventDefault()
    void submit()
  }

  return (
    <form className="chat-composer" onSubmit={handleSubmit} noValidate>
      <label className="chat-composer-label" htmlFor={id}>
        Message
      </label>
      <div className="chat-composer-field">
          <textarea
            id={id}
            ref={innerRef}
            className="chat-composer-input"
            rows={1}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setCaret(e.target.selectionStart)
              setActiveIndex(0)
              setDismissedAt(null)
              if (error) setError(null)
            }}
            onKeyDown={handleKeyDown}
            onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
            aria-autocomplete={members.length > 0 ? 'list' : undefined}
            aria-controls={popupOpen ? listId : undefined}
            aria-activedescendant={popupOpen ? `${listId}-${active}` : undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
        <div className="chat-composer-tools">
          <button
            type="button"
            className="chat-tool"
            aria-label="Add emoji"
            aria-expanded={emojiOpen}
            onClick={() => setEmojiOpen((o) => !o)}
          >
            <span aria-hidden="true">🙂</span>
          </button>
        </div>
      </div>
      {emojiOpen && (
        <div className="emoji-panel" role="group" aria-label="Emoji">
          {EMOJIS.map((em) => (
            <button key={em} type="button" className="emoji-option" onClick={() => insertEmoji(em)}>
              {em}
            </button>
          ))}
        </div>
      )}
      {popupOpen && (
        <ul className="mention-popup" id={listId} role="listbox" aria-label="Tag a person">
          {options.map((m, i) => (
            <li
              key={m.userId}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'mention-option is-active' : 'mention-option'}
              onMouseDown={(e) => {
                e.preventDefault()
                pickMention(m)
              }}
            >
              @{m.username}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <span className="chat-composer-error" id={errorId} role="alert">
          {error}
        </span>
      )}
      <button type="submit" className="chat-composer-send" aria-disabled={sending || undefined}>
        Send
      </button>
    </form>
  )
}
