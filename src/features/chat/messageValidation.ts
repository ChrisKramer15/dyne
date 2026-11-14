import { MAX_MESSAGE_LENGTH } from './chatService'

export type MessageValidation =
  | { ok: true; text: string }
  | { ok: false; error: 'empty' | 'too_long' }

/**
 * Accepts text with at least one non-whitespace character and at most
 * MAX_MESSAGE_LENGTH code points (matching the database `char_length`).
 * The accepted text is returned unchanged, not trimmed.
 */
export function validateMessage(text: string): MessageValidation {
  if (text.trim() === '') return { ok: false, error: 'empty' }
  if (Array.from(text).length > MAX_MESSAGE_LENGTH) return { ok: false, error: 'too_long' }
  return { ok: true, text }
}
