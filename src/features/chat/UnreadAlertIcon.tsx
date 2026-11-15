import { badgeText } from './unreadBadge'

/**
 * Unread badge. The text is aria-hidden because the owning control carries the
 * exact count in its accessible name. Renders nothing when there is no text.
 */
export default function UnreadAlertIcon({ count, variant }: { count: number; variant?: 'dm' | 'group' }) {
  const text = badgeText(count)
  if (text === '') return null
  return (
    <span className={variant ? `unread-alert unread-alert--${variant}` : 'unread-alert'} aria-hidden="true">
      {text}
    </span>
  )
}
