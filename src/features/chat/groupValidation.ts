import { MAX_GROUP_NAME_LENGTH, MAX_GROUP_SIZE, MIN_OTHER_GROUP_MEMBERS } from './chatService'

export type GroupValidationError =
  | 'name_required'
  | 'name_too_long'
  | 'too_few_members'
  | 'too_many_members'

export type GroupValidation = { ok: true } | { ok: false; error: GroupValidationError }

/**
 * Check order: empty/whitespace name, name over 60 code points, fewer than 2
 * distinct other members (creator excluded), total participants over Max_Group_Size.
 */
export function validateGroup(
  name: string,
  otherMemberIds: readonly string[],
  creatorId: string,
): GroupValidation {
  if (name.trim() === '') return { ok: false, error: 'name_required' }
  if (Array.from(name).length > MAX_GROUP_NAME_LENGTH) {
    return { ok: false, error: 'name_too_long' }
  }
  const others = new Set(otherMemberIds)
  others.delete(creatorId)
  if (others.size < MIN_OTHER_GROUP_MEMBERS) return { ok: false, error: 'too_few_members' }
  if (others.size + 1 > MAX_GROUP_SIZE) return { ok: false, error: 'too_many_members' }
  return { ok: true }
}
