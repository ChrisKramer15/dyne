import { describe, expect, it } from 'vitest'
import { validateGroup } from './groupValidation'

const ids = (n: number) => Array.from({ length: n }, (_, i) => `u${i}`)

describe('validateGroup', () => {
  it('accepts a valid group', () => {
    expect(validateGroup('Team', ids(2), 'me')).toEqual({ ok: true })
  })

  it('rejects empty or whitespace names', () => {
    expect(validateGroup('', ids(2), 'me')).toEqual({ ok: false, error: 'name_required' })
    expect(validateGroup('  \t\n', ids(2), 'me')).toEqual({ ok: false, error: 'name_required' })
  })

  it('enforces the 60 code point name limit', () => {
    expect(validateGroup('a'.repeat(60), ids(2), 'me').ok).toBe(true)
    expect(validateGroup('😀'.repeat(60), ids(2), 'me').ok).toBe(true)
    expect(validateGroup('a'.repeat(61), ids(2), 'me')).toEqual({ ok: false, error: 'name_too_long' })
  })

  it('requires two distinct other members, ignoring duplicates and the creator', () => {
    expect(validateGroup('G', ids(1), 'me')).toEqual({ ok: false, error: 'too_few_members' })
    expect(validateGroup('G', ['a', 'a', 'me'], 'me')).toEqual({ ok: false, error: 'too_few_members' })
    expect(validateGroup('G', ['a', 'b', 'a'], 'me').ok).toBe(true)
  })

  it('limits the group to 50 participants including the creator', () => {
    expect(validateGroup('G', ids(49), 'me').ok).toBe(true)
    expect(validateGroup('G', ids(50), 'me')).toEqual({ ok: false, error: 'too_many_members' })
  })

  it('reports the name error before the member errors', () => {
    expect(validateGroup('', [], 'me')).toEqual({ ok: false, error: 'name_required' })
    expect(validateGroup('a'.repeat(61), ids(60), 'me')).toEqual({ ok: false, error: 'name_too_long' })
  })
})
