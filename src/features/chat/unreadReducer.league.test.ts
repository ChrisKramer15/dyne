import { describe, expect, it } from 'vitest'
import {
  initialUnreadState,
  leagueConversationIds,
  unreadByKind,
  unreadForLeague,
  unreadReducer,
} from './unreadReducer'

const loaded = unreadReducer(initialUnreadState, {
  type: 'LOADED',
  entries: [
    { conversationId: 'global-dm', unread: 2, lastReadAt: 't', kind: 'personal' },
    { conversationId: 'a-chat', unread: 3, lastReadAt: 't', kind: 'group', leagueId: 'A' },
    { conversationId: 'a-dm', unread: 4, lastReadAt: 't', kind: 'personal', leagueId: 'A' },
    { conversationId: 'b-dm', unread: 5, lastReadAt: 't', kind: 'personal', leagueId: 'B' },
  ],
})

describe('league unread counts', () => {
  it('counts each league separately', () => {
    expect(unreadForLeague(loaded, 'A')).toBe(7)
    expect(unreadForLeague(loaded, 'B')).toBe(5)
    expect(unreadForLeague(loaded, 'C')).toBe(0)
  })

  it('leaves league conversations out of the global totals when excluded', () => {
    const excluded = leagueConversationIds(loaded)
    expect([...excluded].sort()).toEqual(['a-chat', 'a-dm', 'b-dm'])
    expect(unreadByKind(loaded, 'personal', excluded)).toBe(2)
    expect(unreadByKind(loaded, 'group', excluded)).toBe(0)
  })

  it('forgets a removed conversation', () => {
    const next = unreadReducer(loaded, { type: 'CONVERSATION_REMOVED', conversationId: 'a-dm' })
    expect(unreadForLeague(next, 'A')).toBe(3)
  })
})
