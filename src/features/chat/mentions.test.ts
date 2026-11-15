import { describe, expect, it } from 'vitest'
import { applyMention, filterMembers, findMentionQuery, splitMentions } from './mentions'

const members = [
  { userId: '1', username: 'alice_w' },
  { userId: '2', username: 'Alan99' },
  { userId: '3', username: 'bob_smith' },
]

describe('findMentionQuery', () => {
  it('finds an @ at the start or after whitespace', () => {
    expect(findMentionQuery('@al', 3)).toEqual({ start: 0, query: 'al' })
    expect(findMentionQuery('hey @', 5)).toEqual({ start: 4, query: '' })
  })
  it('ignores an @ inside a word and text after a space', () => {
    expect(findMentionQuery('me@example', 10)).toBeNull()
    expect(findMentionQuery('@alice hi', 9)).toBeNull()
  })
  it('only looks at text before the caret', () => {
    expect(findMentionQuery('hi @bob later', 6)).toEqual({ start: 3, query: 'bo' })
  })
})

describe('filterMembers', () => {
  it('matches by case-insensitive prefix', () => {
    expect(filterMembers(members, 'AL').map((m) => m.username)).toEqual(['alice_w', 'Alan99'])
    expect(filterMembers(members, '').length).toBe(3)
    expect(filterMembers(members, 'zed')).toEqual([])
  })
})

describe('applyMention', () => {
  it('replaces the partial tag and moves the caret past the trailing space', () => {
    const mention = findMentionQuery('hi @al there', 6)!
    expect(applyMention('hi @al there', mention, 6, 'alice_w')).toEqual({
      text: 'hi @alice_w there',
      caret: 12,
    })
  })
})

describe('splitMentions', () => {
  const names = new Set(['alice_w', 'bob_smith'])
  it('highlights known usernames only', () => {
    expect(splitMentions('hi @Alice_W and @nobody', names)).toEqual([
      { type: 'text', value: 'hi ' },
      { type: 'mention', value: '@Alice_W' },
      { type: 'text', value: ' and @nobody' },
    ])
  })
  it('does not tag email addresses', () => {
    expect(splitMentions('mail me@bob_smith.com', names)).toEqual([
      { type: 'text', value: 'mail me@bob_smith.com' },
    ])
  })
  it('returns plain text unchanged', () => {
    expect(splitMentions('hello', names)).toEqual([{ type: 'text', value: 'hello' }])
  })
})