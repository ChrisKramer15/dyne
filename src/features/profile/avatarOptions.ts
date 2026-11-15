export interface AvatarOption {
  id: string
  emoji: string
  label: string
}

/** The 50 built-in avatars a player can pick from. Ids are stored, so never reorder or reuse them. */
export const AVATAR_OPTIONS: readonly AvatarOption[] = [
  { id: 'fox', emoji: '🦊', label: 'Fox' },
  { id: 'lion', emoji: '🦁', label: 'Lion' },
  { id: 'tiger', emoji: '🐯', label: 'Tiger' },
  { id: 'bear', emoji: '🐻', label: 'Bear' },
  { id: 'panda', emoji: '🐼', label: 'Panda' },
  { id: 'koala', emoji: '🐨', label: 'Koala' },
  { id: 'wolf', emoji: '🐺', label: 'Wolf' },
  { id: 'cat', emoji: '🐱', label: 'Cat' },
  { id: 'dog', emoji: '🐶', label: 'Dog' },
  { id: 'monkey', emoji: '🐵', label: 'Monkey' },
  { id: 'unicorn', emoji: '🦄', label: 'Unicorn' },
  { id: 'horse', emoji: '🐴', label: 'Horse' },
  { id: 'cow', emoji: '🐮', label: 'Cow' },
  { id: 'pig', emoji: '🐷', label: 'Pig' },
  { id: 'frog', emoji: '🐸', label: 'Frog' },
  { id: 'chicken', emoji: '🐔', label: 'Chicken' },
  { id: 'penguin', emoji: '🐧', label: 'Penguin' },
  { id: 'owl', emoji: '🦉', label: 'Owl' },
  { id: 'eagle', emoji: '🦅', label: 'Eagle' },
  { id: 'duck', emoji: '🦆', label: 'Duck' },
  { id: 'butterfly', emoji: '🦋', label: 'Butterfly' },
  { id: 'bee', emoji: '🐝', label: 'Bee' },
  { id: 'turtle', emoji: '🐢', label: 'Turtle' },
  { id: 'snake', emoji: '🐍', label: 'Snake' },
  { id: 'dragon', emoji: '🐲', label: 'Dragon' },
  { id: 'whale', emoji: '🐳', label: 'Whale' },
  { id: 'dolphin', emoji: '🐬', label: 'Dolphin' },
  { id: 'shark', emoji: '🦈', label: 'Shark' },
  { id: 'octopus', emoji: '🐙', label: 'Octopus' },
  { id: 'crab', emoji: '🦀', label: 'Crab' },
  { id: 'robot', emoji: '🤖', label: 'Robot' },
  { id: 'alien', emoji: '👽', label: 'Alien' },
  { id: 'ghost', emoji: '👻', label: 'Ghost' },
  { id: 'skull', emoji: '💀', label: 'Skull' },
  { id: 'ninja', emoji: '🥷', label: 'Ninja' },
  { id: 'astronaut', emoji: '🧑‍🚀', label: 'Astronaut' },
  { id: 'wizard', emoji: '🧙', label: 'Wizard' },
  { id: 'cool', emoji: '😎', label: 'Sunglasses' },
  { id: 'rocket', emoji: '🚀', label: 'Rocket' },
  { id: 'star', emoji: '⭐', label: 'Star' },
  { id: 'fire', emoji: '🔥', label: 'Fire' },
  { id: 'lightning', emoji: '⚡', label: 'Lightning' },
  { id: 'rainbow', emoji: '🌈', label: 'Rainbow' },
  { id: 'moon', emoji: '🌙', label: 'Moon' },
  { id: 'sun', emoji: '☀️', label: 'Sun' },
  { id: 'trophy', emoji: '🏆', label: 'Trophy' },
  { id: 'baseball', emoji: '⚾', label: 'Baseball' },
  { id: 'basketball', emoji: '🏀', label: 'Basketball' },
  { id: 'football', emoji: '🏈', label: 'Football' },
  { id: 'hockey', emoji: '🏒', label: 'Hockey' },
]

const storageKey = (ownerId: string) => `dyne:avatar:${ownerId}`

/** The saved avatar for a user, or null when none is saved or the id is unknown. */
export function readAvatar(ownerId: string | undefined): AvatarOption | null {
  if (!ownerId) return null
  try {
    const id = localStorage.getItem(storageKey(ownerId))
    return AVATAR_OPTIONS.find((a) => a.id === id) ?? null
  } catch {
    return null
  }
}

/** Saves the avatar id (or clears it with null). Storage failures are ignored; the choice then lasts for this visit only. */
export function writeAvatar(ownerId: string | undefined, id: string | null): void {
  if (!ownerId) return
  try {
    if (id === null) localStorage.removeItem(storageKey(ownerId))
    else localStorage.setItem(storageKey(ownerId), id)
  } catch {
    // Storage unavailable (private mode, quota).
  }
}
