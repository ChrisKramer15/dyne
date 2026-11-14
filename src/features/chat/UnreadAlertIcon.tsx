import { badgeText } from './unreadBadge'

/**
 * Unread badge. The text is aria-hidden because the owning control carries the
 * exact count in its accessible name. Renders nothing when there is no text.
 */
export default function UnreadAlertIcon({ count }: { count: number }) {
  const text = badgeText(count)
  if (text === '') return null
  return (
    <span className="unread-alert" aria-hidden="true">
      {text}
    </span>
  )
}
