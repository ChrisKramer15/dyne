import { useEffect, useId, useImperativeHandle, useRef, useState, type FormEvent, type KeyboardEvent, type Ref } from 'react'
import { MAX_MESSAGE_LENGTH } from './chatService'
import { validateMessage } from './messageValidation'

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
}: MessageComposerProps) {
  const id = useId()
  const errorId = `${id}-error`
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const inFlight = useRef(false)
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
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
    e.preventDefault()
    void submit()
  }

  return (
    <form className="chat-composer" onSubmit={handleSubmit} noValidate>
      <label className="chat-composer-label" htmlFor={id}>
        Message
      </label>
      <textarea
        id={id}
        ref={innerRef}
        className="chat-composer-input"
        rows={2}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          if (error) setError(null)
        }}
        onKeyDown={handleKeyDown}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
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
