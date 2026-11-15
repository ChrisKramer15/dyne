/** A conversation member that can be tagged. */
export interface MentionMember {
  userId: string
  username: string
}

/** Usernames are 3-20 letters, digits or underscores (see the profiles table). */
const MENTION_TOKEN = /@([A-Za-z0-9_]{3,20})/g

export interface MentionQuery {
  /** Index of the '@' that starts the mention. */
  start: number
  /** Text typed after the '@' so far. */
  query: string
}

/**
 * The mention being typed at the caret, if any: an '@' at the start of the text
 * or after whitespace, followed only by username characters up to the caret.
 */
export function findMentionQuery(text: string, caret: number): MentionQuery | null {
  const before = text.slice(0, caret)
  const match = /(^|\s)@([A-Za-z0-9_]{0,20})$/.exec(before)
  if (!match) return null
  const query = match[2]
  return { start: caret - query.length - 1, query }
}

/** Members whose username starts with the query (case-insensitive), best 5. */
export function filterMembers(
  members: readonly MentionMember[],
  query: string,
  limit = 5,
): MentionMember[] {
  const q = query.toLowerCase()
  return members.filter((m) => m.username.toLowerCase().startsWith(q)).slice(0, limit)
}

/** Replaces the in-progress mention with `@username ` and returns the new caret. */
export function applyMention(
  text: string,
  mention: MentionQuery,
  caret: number,
  username: string,
): { text: string; caret: number } {
  // Reuse an existing space after the caret instead of adding a second one.
  const spaced = /^\s/.test(text.slice(caret))
  const insert = `@${username}`
  return {
    text: text.slice(0, mention.start) + insert + (spaced ? '' : ' ') + text.slice(caret),
    caret: mention.start + insert.length + 1,
  }
}

export type MentionPart = { type: 'text'; value: string } | { type: 'mention'; value: string }

/** Splits message text so tags of known usernames can be highlighted. */
export function splitMentions(text: string, usernames: ReadonlySet<string>): MentionPart[] {
  const parts: MentionPart[] = []
  let last = 0
  for (const m of text.matchAll(MENTION_TOKEN)) {
    const index = m.index ?? 0
    // Not a tag when glued to the preceding word, e.g. an email address.
    if (index > 0 && !/\s/.test(text[index - 1])) continue
    if (!usernames.has(m[1].toLowerCase())) continue
    if (index > last) parts.push({ type: 'text', value: text.slice(last, index) })
    parts.push({ type: 'mention', value: m[0] })
    last = index + m[0].length
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) })
  return parts
}