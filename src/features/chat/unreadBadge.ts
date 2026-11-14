import { ALERT_CAP } from './chatService'

function unreadPhrase(count: number): string {
  return `${count} unread ${count === 1 ? 'message' : 'messages'}`
}

/** Visible badge text: '' for 0, the exact count for 1..ALERT_CAP, '99+' above. */
export function badgeText(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return ''
  const whole = Math.floor(count)
  if (whole <= 0) return ''
  return whole > ALERT_CAP ? `${ALERT_CAP}+` : String(whole)
}

/** Accessible name of the Chat nav item, with the exact uncapped total. */
export function chatNavLabel(total: number): string {
  const whole = Number.isFinite(total) ? Math.floor(total) : 0
  return whole > 0 ? `Chat, ${unreadPhrase(whole)}` : 'Chat'
}

/**
 * Accessible name of a conversation entry. `unread` is null when the count
 * could not be retrieved; the label is then just the name.
 */
export function conversationLabel(name: string, unread: number | null): string {
  if (unread === null || !Number.isFinite(unread)) return name
  const whole = Math.floor(unread)
  return whole > 0 ? `${name}, ${unreadPhrase(whole)}` : `${name}, no unread messages`
}
